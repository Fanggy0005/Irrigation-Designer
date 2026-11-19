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
 * (another pipe's tee, a lateral, a plant). A pipe fed from its middle becomes two such
 * chains, one each way from where the water enters. Each plant is one node drawing its
 * emitters' flow at their operating pressure; the short tube from lateral to plant is
 * ignored. The stretch of pipe past its last joint carries no water, so it is left out.
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

/** A pipe, or the part of one on one side of where its water enters, running from there. */
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

    // Drawn pipes that reach the source, as lines running from where their water enters.
    const drawnLines = new Map<string, Line[]>(); // by pipe id
    const lineByKey = new Map<string, Line>();
    for (const pipe of input.pipes) {
        const connection = input.connections[pipe.id];
        if (!connection) continue;
        const zoneId = input.pipeZones[pipe.id];
        const elevationM = pipe.kind === 'main' || !zoneId ? input.sourceElevationM : (zoneLevel.get(zoneId) ?? input.sourceElevationM);
        const parts = linesFrom(pipe.path.map(frame.toLocal), connection.entryM).map(
            (xy, i): Line => ({
                key: i === 0 ? pipe.id : `${pipe.id}~back`,
                owner: { kind: pipe.kind, pipeId: pipe.id, lateralId: null },
                xy,
                elevationM,
                // The feed's pipe id for now; `attach` swaps it for the line of that pipe.
                feed: connection.fromPipeId === null ? null : { key: connection.fromPipeId, atM: 0 },
            }),
        );
        drawnLines.set(pipe.id, parts);
        for (const line of parts) lineByKey.set(line.key, line);
    }
    /** The line of a drawn pipe nearest to a point, and how far along it the point is. */
    const attach = (point: XY, pipeId: string) => {
        let best: { key: string; atM: number; distance: number } | null = null;
        for (const line of drawnLines.get(pipeId)!) {
            const hit = closestPointOnPath(point, line.xy)!;
            if (!best || hit.distance < best.distance) best = { key: line.key, atM: hit.alongM, distance: hit.distance };
        }
        return { key: best!.key, atM: best!.atM };
    };
    for (const line of lineByKey.values()) if (line.feed) line.feed = attach(line.xy[0], line.feed.key);

    return input.zones.map((zone) => {
        const lines = new Map<string, Line>();
        const plantStops: { lineKey: string; atM: number; plantId: string }[] = [];
        const disconnectedPlantIds: string[] = [];

        const addWithFeeds = (line: Line) => {
            for (let current: Line | undefined = line; current && !lines.has(current.key); ) {
                lines.set(current.key, current);
                current = current.feed ? lineByKey.get(current.feed.key) : undefined;
            }
        };

        for (const lateral of input.laterals) {
            if (lateral.zoneId !== zone.id) continue;
            const parts = lateralLines(lateral, drawnLines, attach, frame.toLocal, zone.elevationM);
            if (parts.length === 0) {
                disconnectedPlantIds.push(...lateral.plantIds);
                continue;
            }
            for (const line of parts) addWithFeeds(line);
            for (const plantId of lateral.plantIds) {
                const position = input.plantPositions.get(plantId);
                if (!position) continue;
                const p = frame.toLocal(position);
                const hits = parts.map((line) => ({ line, hit: closestPointOnPath(p, line.xy)! }));
                const nearest = hits.reduce((a, b) => (b.hit.distance < a.hit.distance ? b : a));
                plantStops.push({ lineKey: nearest.line.key, atM: nearest.hit.alongM, plantId });
            }
        }
        return { zoneId: zone.id, ...chainLines(lines, plantStops, input), disconnectedPlantIds };
    });
}

/** A lateral as lines fed from its submain (generated) or its own connection (drawn); none if it is not fed. */
function lateralLines(
    lateral: Lateral,
    drawnLines: ReadonlyMap<string, Line[]>,
    attach: (point: XY, pipeId: string) => { key: string; atM: number },
    toLocal: (p: LatLng) => XY,
    elevationM: number,
): Line[] {
    if (lateral.pipeId !== null) {
        const lines = drawnLines.get(lateral.pipeId) ?? [];
        return lines.map((line) => ({ ...line, owner: { kind: 'lateral', pipeId: lateral.pipeId, lateralId: lateral.id }, elevationM }));
    }
    if (lateral.submainId === null || !drawnLines.has(lateral.submainId)) return [];
    const xy = lateral.path.map(toLocal);
    return [
        {
            key: `lateral:${lateral.id}`,
            owner: { kind: 'lateral', pipeId: null, lateralId: lateral.id },
            xy,
            elevationM,
            feed: attach(xy[0], lateral.submainId),
        },
    ];
}

/**
 * A path as the lines water runs along from `entryM` m along it: the whole path from an
 * end, or the two parts either side of a point in the middle (the forward part first).
 */
function linesFrom(xy: readonly XY[], entryM: number): XY[][] {
    const backwards = [...xy].reverse();
    let walked = 0;
    for (let i = 1; i < xy.length; i++) {
        const length = Math.hypot(xy[i].x - xy[i - 1].x, xy[i].y - xy[i - 1].y);
        if (walked + length < entryM) {
            walked += length;
            continue;
        }
        const t = length === 0 ? 0 : (entryM - walked) / length;
        const entry = { x: xy[i - 1].x + t * (xy[i].x - xy[i - 1].x), y: xy[i - 1].y + t * (xy[i].y - xy[i - 1].y) };
        const forward = withoutStubs([entry, ...xy.slice(i)]);
        const back = withoutStubs([entry, ...xy.slice(0, i).reverse()]);
        if (back.length < 2) return [forward];
        if (forward.length < 2) return [back];
        return [forward, back];
    }
    return [backwards];
}

/** Drops points that sit on the one before, so no segment is shorter than SAME_POINT_M. */
function withoutStubs(path: XY[]): XY[] {
    return path.filter((p, i) => i === 0 || Math.hypot(p.x - path[i - 1].x, p.y - path[i - 1].y) > SAME_POINT_M);
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
