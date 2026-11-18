import { type PipeSpec } from '../data/pipes';
import { type PipeKind } from '../project';
import { suggestPipeSize } from '../sizing';
import { buildZoneLayouts, type DesignNetworkInput, type SegmentOwner, SOURCE_NODE, type ZoneLayout } from './designNetwork';
import { pipeFlows, solveNetwork } from './network';
import { velocityMps } from './pipeFlow';
import { pumpDuty, type PumpDuty } from './pump';

export type HydraulicsInput = Omit<DesignNetworkInput, 'pipes'> & {
    /** Drawn pipes, each with the size the designer chose (null = suggested). */
    pipes: readonly (DesignNetworkInput['pipes'][number] & { specId: string | null })[];
    /** Chosen size for generated laterals; null = suggested. */
    lateralSpecId: string | null;
    settings: { minorLossPct: number; maxVelocityMps: number; maxPressureVariationPct: number };
    catalog: readonly PipeSpec[];
    /** Series each kind's suggestion picks from. */
    suggestedSeries: Readonly<Record<PipeKind, string>>;
};

export type PipeSizing = {
    /** The size in use: the designer's choice, or else the suggestion. */
    spec: PipeSpec;
    suggested: PipeSpec;
    /** True when the designer chose the size. */
    chosen: boolean;
    /** Highest flow while any one zone runs, L/h. */
    designFlowLph: number;
    velocityMps: number;
    /** Highest pressure in the pipe while any one zone runs, m; null when no zone uses it. */
    maxPressureM: number | null;
    overVelocity: boolean;
    overRating: boolean;
};

export type ZoneSolution = {
    flowLph: number;
    /** Pressure needed at the pump outlet for every emitter to get its operating pressure, m. */
    requiredPressureM: number;
    criticalPlantIds: string[];
    /** Losses on the way to the critical emitter, by kind of pipe (friction plus minor losses). */
    lossesM: Record<PipeKind, number>;
    /** Zone level less source level, m. */
    riseM: number;
    emitterPressureM: { min: number; max: number };
    /** Spread of emitter pressure, % of the emitter's operating pressure. */
    variationPct: number;
    overVariation: boolean;
    maxVelocityMps: number;
};

export type ZoneHydraulics = {
    zoneId: string;
    /** Null when no lateral in the zone reaches the source. */
    solution: ZoneSolution | null;
    disconnectedPlantIds: string[];
};

export type HydraulicsResult = {
    zones: ZoneHydraulics[];
    /** Every drawn pipe, by id. */
    pipes: Record<string, PipeSizing>;
    /** All generated laterals share one size. */
    laterals: PipeSizing;
};

/** Owner key for sizing: the drawn pipe, or the group of generated laterals. */
const GENERATED_LATERALS = '';
const ownerKey = (owner: SegmentOwner) => owner.pipeId ?? GENERATED_LATERALS;
/** Velocities equal to the limit up to rounding count as within it. */
const SLACK = 1e-9;

/**
 * Sizes every pipe and solves every zone. Flows come first: they depend only on the
 * emitters, so each pipe is sized for the highest flow any one zone sends through it
 * (zones run one at a time). Then each zone is solved with those sizes.
 */
export function analyseHydraulics(input: HydraulicsInput): HydraulicsResult {
    const layouts = buildZoneLayouts(input);

    const designFlow = new Map<string, number>();
    for (const layout of layouts) {
        if (layout.segments.length === 0) continue;
        const flows = pipeFlows({ rootId: SOURCE_NODE, nodes: layout.nodes, pipes: layout.segments });
        for (const segment of layout.segments) {
            const key = ownerKey(segment.owner);
            designFlow.set(key, Math.max(designFlow.get(key) ?? 0, flows[segment.id]));
        }
    }

    const catalog = new Map(input.catalog.map((s) => [s.id, s]));
    const size = (kind: PipeKind, flowLph: number, specId: string | null) => {
        const options = input.catalog.filter((s) => s.series === input.suggestedSeries[kind]);
        const suggested = suggestPipeSize(flowLph, options, input.settings.maxVelocityMps).size;
        const chosen = specId === null ? undefined : catalog.get(specId);
        return { spec: chosen ?? suggested, suggested, chosen: chosen !== undefined };
    };
    const sizes = new Map(input.pipes.map((p) => [p.id, size(p.kind, designFlow.get(p.id) ?? 0, p.specId)]));
    const lateralSize = size('lateral', designFlow.get(GENERATED_LATERALS) ?? 0, input.lateralSpecId);
    const specOf = (owner: SegmentOwner) => (owner.pipeId === null ? lateralSize.spec : sizes.get(owner.pipeId)!.spec);

    const maxPressure = new Map<string, number>();
    const zones = layouts.map((layout): ZoneHydraulics => {
        const solution = layout.segments.length === 0 ? null : solveZone(layout, specOf, input, maxPressure);
        return { zoneId: layout.zoneId, solution, disconnectedPlantIds: layout.disconnectedPlantIds };
    });

    const sizing = (key: string, chosen: ReturnType<typeof size>): PipeSizing => {
        const designFlowLph = designFlow.get(key) ?? 0;
        const velocity = velocityMps(designFlowLph, chosen.spec.innerDiameterMm);
        const pressure = maxPressure.get(key) ?? null;
        return {
            ...chosen,
            designFlowLph,
            velocityMps: velocity,
            maxPressureM: pressure,
            overVelocity: velocity > input.settings.maxVelocityMps + SLACK,
            overRating: pressure !== null && pressure > chosen.spec.ratingM,
        };
    };

    return {
        zones,
        pipes: Object.fromEntries(input.pipes.map((p) => [p.id, sizing(p.id, sizes.get(p.id)!)])),
        laterals: sizing(GENERATED_LATERALS, lateralSize),
    };
}

function solveZone(
    layout: ZoneLayout,
    specOf: (owner: SegmentOwner) => PipeSpec,
    input: HydraulicsInput,
    maxPressure: Map<string, number>,
): ZoneSolution {
    const segments = new Map(layout.segments.map((s) => [s.id, s]));
    const result = solveNetwork(
        {
            rootId: SOURCE_NODE,
            nodes: layout.nodes,
            pipes: layout.segments.map((s) => ({
                id: s.id,
                a: s.a,
                b: s.b,
                lengthM: s.lengthM,
                innerDiameterMm: specOf(s.owner).innerDiameterMm,
                c: specOf(s.owner).c,
            })),
        },
        { minorLossPct: input.settings.minorLossPct },
    );

    let maxVelocity = 0;
    const segmentAbove = new Map<string, string>(); // node → segment feeding it
    for (const [id, pipe] of Object.entries(result.pipes)) {
        segmentAbove.set(pipe.to, id);
        maxVelocity = Math.max(maxVelocity, pipe.velocityMps);
        // Pressure is highest where water enters a segment.
        const key = ownerKey(segments.get(id)!.owner);
        maxPressure.set(key, Math.max(maxPressure.get(key) ?? -Infinity, result.nodePressureM[pipe.from]));
    }

    const lossesM: Record<PipeKind, number> = { main: 0, submain: 0, lateral: 0 };
    for (let node = result.criticalNodeId; node !== null && segmentAbove.has(node); ) {
        const id: string = segmentAbove.get(node)!;
        lossesM[segments.get(id)!.owner.kind] += result.pipes[id].lossM;
        node = result.pipes[id].from;
    }

    const critical = result.criticalNodeId;
    const range = result.demandPressureRangeM ?? { min: 0, max: 0 };
    const variationPct = ((range.max - range.min) / input.emitter.pressureM) * 100;
    const criticalLevel = layout.nodes.find((n) => n.id === critical)?.elevationM ?? input.sourceElevationM;
    return {
        flowLph: result.totalDemandLph,
        requiredPressureM: result.requiredRootPressureM,
        criticalPlantIds: critical === null ? [] : (layout.plantsAt[critical] ?? []),
        lossesM,
        riseM: criticalLevel - input.sourceElevationM,
        emitterPressureM: range,
        variationPct,
        overVariation: variationPct > input.settings.maxPressureVariationPct + SLACK,
        maxVelocityMps: maxVelocity,
    };
}

export type PumpInput = { suctionLiftM: number; suctionLossM: number; efficiencyPct: number };

/**
 * The pump duty for each solved zone, and the heaviest zone (the one needing the most
 * power). A pump that meets the heaviest zone usually meets the rest, but check every
 * zone's flow and head against the pump curve.
 */
export function pumpDuties(zones: readonly ZoneHydraulics[], pump: PumpInput): { duties: Record<string, PumpDuty>; heaviestZoneId: string | null } {
    const duties: Record<string, PumpDuty> = {};
    let heaviestZoneId: string | null = null;
    for (const zone of zones) {
        if (!zone.solution) continue;
        const duty = pumpDuty({
            flowLph: zone.solution.flowLph,
            dischargePressureM: zone.solution.requiredPressureM,
            suctionLiftM: pump.suctionLiftM,
            suctionLossM: pump.suctionLossM,
            efficiency: pump.efficiencyPct / 100,
        });
        duties[zone.zoneId] = duty;
        if (heaviestZoneId === null || duty.shaftPowerKw > duties[heaviestZoneId].shaftPowerKw) heaviestZoneId = zone.zoneId;
    }
    return { duties, heaviestZoneId };
}
