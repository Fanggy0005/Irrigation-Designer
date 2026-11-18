import { closestPointOnPath, type LatLng, localFrame, type XY } from '../geometry';
import { type Lateral } from '../laterals';
import { type PipeConnection } from '../pipes';
import { type PipeKind } from '../project';
import { type NetworkNode } from './network';

/**
 * Turns the drawn design into one pipe network per zone, for `solveNetwork`. Zones run one
 * at a time, so each network holds only that zone's laterals and the pipes that carry its
 * water from the source: other zones' pipes carry nothing while it runs.
 *
 * A drawn pipe becomes a chain of segments between the points where something joins it
 * (another pipe's tee, a lateral, a plant). Each plant is one node drawing its emitters'
 * flow at their operating pressure; the short tube from lateral to plant is ignored. The
 * stretch of pipe past its last joint carries no water, so it is left out.
 *
 * Levels: nodes on mains sit at the source's level, everything else at its zone's level.
 */

export const SOURCE_NODE = 'source';

/** Which pipe a segment is part of: a drawn pipe, or a generated lateral. */
export type SegmentOwner = { kind: PipeKind; pipeId: string | null; lateralId: string | null };

export type Segment = { id: string; a: string; b: string; lengthM: number; owner: SegmentOwner };

export type ZoneLayout = {
    zoneId: string;
    nodes: NetworkNode[];
    segments: Segment[];
    /** Plants drawing water at each node. */
    plantsAt: Record<string, string[]>;
    /** Plants of the zone on laterals that do not reach the source. */
    disconnectedPlantIds: string[];
};

export type DesignNetworkInput = {
    waterSource: LatLng;
    sourceElevationM: number;
    pipes: readonly { id: string; kind: PipeKind; path: readonly LatLng[] }[];
    connections: Readonly<Record<string, PipeConnection>>;
    pipeZones: Readonly<Record<string, string | null>>;
    zones: readonly { id: string; elevationM: number }[];
    laterals: readonly Lateral[];
    plantPositions: ReadonlyMap<string, LatLng>;
    emitter: { flowLph: number; pressureM: number; perPlant: number };
};

/** Joints closer than this along a pipe share a node, m. */
const SAME_POINT_M = 1e-3;

/** A pipe oriented from where its water enters. */
type Line = {
    key: string;
    owner: SegmentOwner;
    xy: XY[];
    elevationM: number;
    feed: { key: string; atM: number } | null; // null = the source
};

export function buildZoneLayouts(input: DesignNetworkInput): ZoneLayout[] {
    const frame = localFrame(input.waterSource);
    const zoneLevel = new Map(input.zones.map((z) => [z.id, z.elevationM]));

    // Drawn pipes that reach the source, oriented from their feed.
    const drawn = new Map<string, Line>();
    for (const pipe of input.pipes) {
        const connection = input.connections[pipe.id];
        if (!connection) continue;
        const xy = pipe.path.map(frame.toLocal);
        if (connection.reversed) xy.reverse();
        const zoneId = input.pipeZones[pipe.id];
        drawn.set(pipe.id, {
            key: pipe.id,
            owner: { kind: pipe.kind, pipeId: pipe.id, lateralId: null },
            xy,
            elevationM: pipe.kind === 'main' || !zoneId ? input.sourceElevationM : (zoneLevel.get(zoneId) ?? input.sourceElevationM),
            feed: connection.fromPipeId === null ? null : { key: connection.fromPipeId, atM: 0 },
        });
    }
    // Where each drawn pipe joins its feed, measured from where the feed's own water enters.
    for (const line of drawn.values()) {
        if (line.feed) line.feed.atM = closestPointOnPath(line.xy[0], drawn.get(line.feed.key)!.xy)!.alongM;
    }

    return input.zones.map((zone) => {
        const lines = new Map<string, Line>();
        const plantStops: { lineKey: string; atM: number; plantId: string }[] = [];
        const disconnectedPlantIds: string[] = [];

        const addWithFeeds = (line: Line) => {
            for (let current: Line | undefined = line; current && !lines.has(current.key); ) {
                lines.set(current.key, current);
                current = current.feed ? drawn.get(current.feed.key) : undefined;
            }
        };

        for (const lateral of input.laterals) {
            if (lateral.zoneId !== zone.id) continue;
            const line = lateralLine(lateral, drawn, frame.toLocal, zone.elevationM);
            if (!line) {
                disconnectedPlantIds.push(...lateral.plantIds);
                continue;
            }
            addWithFeeds(line);
            for (const plantId of lateral.plantIds) {
                const position = input.plantPositions.get(plantId);
                if (position) plantStops.push({ lineKey: line.key, atM: closestPointOnPath(frame.toLocal(position), line.xy)!.alongM, plantId });
            }
        }
        return { zoneId: zone.id, ...chainLines(lines, plantStops, input), disconnectedPlantIds };
    });
}

/** A lateral as a line fed from its submain (generated) or its own connection (drawn); null if it is not fed. */
function lateralLine(lateral: Lateral, drawn: ReadonlyMap<string, Line>, toLocal: (p: LatLng) => XY, elevationM: number): Line | null {
    if (lateral.pipeId !== null) {
        const line = drawn.get(lateral.pipeId);
        return line ? { ...line, owner: { kind: 'lateral', pipeId: lateral.pipeId, lateralId: lateral.id }, elevationM } : null;
    }
    const submain = lateral.submainId === null ? undefined : drawn.get(lateral.submainId);
    if (!submain) return null;
    const xy = lateral.path.map(toLocal);
    return {
        key: `lateral:${lateral.id}`,
        owner: { kind: 'lateral', pipeId: null, lateralId: lateral.id },
        xy,
        elevationM,
        feed: { key: submain.key, atM: closestPointOnPath(xy[0], submain.xy)!.alongM },
    };
}

/** Nodes and segments for a set of lines that all trace back to the source. */
function chainLines(
    lines: ReadonlyMap<string, Line>,
    plantStops: readonly { lineKey: string; atM: number; plantId: string }[],
    input: DesignNetworkInput,
): Pick<ZoneLayout, 'nodes' | 'segments' | 'plantsAt'> {
    // Everything that joins each line, by distance from where its water enters.
    type Stop = { atM: number; childKey?: string; plantId?: string };
    const stops = new Map<string, Stop[]>([...lines.keys()].map((key) => [key, []]));
    for (const line of lines.values()) if (line.feed) stops.get(line.feed.key)!.push({ atM: line.feed.atM, childKey: line.key });
    for (const stop of plantStops) stops.get(stop.lineKey)!.push({ atM: stop.atM, plantId: stop.plantId });

    const nodes = new Map<string, NetworkNode>([[SOURCE_NODE, { id: SOURCE_NODE, elevationM: input.sourceElevationM, demandLph: 0 }]]);
    const segments: Segment[] = [];
    const plantsAt: Record<string, string[]> = {};
    const startNode = new Map<string, string>(); // line key → node its water enters at
    const plantDemand = input.emitter.perPlant * input.emitter.flowLph;

    // Lines fed by the source first, then each line after its feed.
    const queue = [...lines.values()].filter((l) => l.feed === null);
    for (const line of queue) startNode.set(line.key, SOURCE_NODE);

    for (let i = 0; i < queue.length; i++) {
        const line = queue[i];
        let previous = startNode.get(line.key)!;
        let previousAt = 0;
        const sorted = stops.get(line.key)!.sort((a, b) => a.atM - b.atM);

        for (let s = 0; s < sorted.length; s++) {
            const stop = sorted[s];
            // Stops at the same point share the node; one at the entry shares the start node.
            if (stop.atM - previousAt > SAME_POINT_M) {
                const id = `${line.key}#${segments.length}`;
                nodes.set(id, { id, elevationM: line.elevationM, demandLph: 0 });
                segments.push({ id: `${line.key}/${segments.length}`, a: previous, b: id, lengthM: stop.atM - previousAt, owner: line.owner });
                previous = id;
                previousAt = stop.atM;
            }
            if (stop.childKey) {
                startNode.set(stop.childKey, previous);
                queue.push(lines.get(stop.childKey)!);
            }
            if (stop.plantId) {
                const node = nodes.get(previous)!;
                node.demandLph += plantDemand;
                node.minPressureM = input.emitter.pressureM;
                (plantsAt[previous] ??= []).push(stop.plantId);
            }
        }
    }

    return { nodes: [...nodes.values()], segments, plantsAt };
}
