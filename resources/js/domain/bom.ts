import { type PipeSpec } from './data/pipes';
import { type LatLng, localFrame, pathLengthM } from './geometry';
import { type Lateral } from './laterals';
import { type PipeConnection } from './pipes';
import { type PipeKind } from './project';

/**
 * Bill of materials. Pipe lengths are measured off the drawing; fittings are counted from
 * how the pipes join, so they are an estimate for ordering, not a fitting schedule.
 * Offcuts and spares are not added.
 */

export type BomInput = {
    pipes: readonly { id: string; kind: PipeKind; path: readonly LatLng[] }[];
    /** Size in use for each drawn pipe. */
    pipeSpecs: Readonly<Record<string, PipeSpec>>;
    /** Every lateral, generated and drawn, as `layoutLaterals` gives them. */
    laterals: readonly Lateral[];
    /** Size of the generated laterals. */
    lateralSpec: PipeSpec;
    connections: Readonly<Record<string, PipeConnection>>;
    emittersPerPlant: number;
    /** Length of one pipe piece or roll, by series; a series without one is listed in metres only. */
    pieceLengthM: Readonly<Record<string, number>>;
};

export type PipeBomLine = {
    spec: PipeSpec;
    lengthM: number;
    pieceLengthM: number | null;
    /** Whole pieces or rolls covering `lengthM`; null without a piece length. */
    pieces: number | null;
};

export type Fittings = {
    /** A main or submain branching off the middle of another, or fed in its middle from the end of another. */
    tees: number;
    /** A main or submain fed in its middle from the middle of another, the two crossing. */
    crosses: number;
    /** A main or submain continuing from the end of another (coupling or elbow). */
    endJoints: number;
    /** Bends of BEND_DEG or more along drawn pipes. */
    elbows: number;
    /** One per lateral where it leaves the submain, two for a drawn lateral running both ways from it. */
    lateralConnectors: number;
    /** The far end of every lateral and every submain, both ends of one fed in its middle. */
    endCaps: number;
    /** One per zone that has laterals. */
    zoneValves: number;
};

export type Bom = { pipes: PipeBomLine[]; emitters: number; fittings: Fittings };

/** Turns smaller than this are taken up by the pipe itself, m. */
export const BEND_DEG = 30;
/** Lengths come off a map; a millimetre over a whole number of pieces is rounding, not another piece. */
const LENGTH_SLACK_M = 0.001;
/** A joint this close to the end of a pipe counts as at its end, m. */
const END_M = 0.5;

export function billOfMaterials(input: BomInput): Bom {
    const lengths = new Map<string, { spec: PipeSpec; lengthM: number }>();
    const add = (spec: PipeSpec, lengthM: number) => {
        const line = lengths.get(spec.id) ?? { spec, lengthM: 0 };
        line.lengthM += lengthM;
        lengths.set(spec.id, line);
    };
    for (const pipe of input.pipes) add(input.pipeSpecs[pipe.id], pathLengthM(pipe.path));
    for (const lateral of input.laterals) if (lateral.pipeId === null) add(input.lateralSpec, pathLengthM(lateral.path));

    const pipes = [...lengths.values()]
        .filter((line) => line.lengthM > 0)
        .sort((a, b) => a.spec.series.localeCompare(b.spec.series) || a.spec.outerDiameterMm - b.spec.outerDiameterMm)
        .map(({ spec, lengthM }): PipeBomLine => {
            const pieceLengthM = input.pieceLengthM[spec.series] ?? null;
            return { spec, lengthM, pieceLengthM, pieces: pieceLengthM ? Math.ceil((lengthM - LENGTH_SLACK_M) / pieceLengthM) : null };
        });

    return {
        pipes,
        emitters: input.laterals.reduce((n, l) => n + l.plantIds.length, 0) * input.emittersPerPlant,
        fittings: countFittings(input),
    };
}

function countFittings(input: BomInput): Fittings {
    const byId = new Map(input.pipes.map((p) => [p.id, p]));
    /** How many ways the water runs from where it enters a pipe: 2 when fed in its middle. */
    const ways = (pipeId: string) => {
        const connection = input.connections[pipeId];
        const pipe = byId.get(pipeId);
        return connection && pipe && isMiddle(connection.entryM, pathLengthM(pipe.path)) ? 2 : 1;
    };

    let tees = 0;
    let crosses = 0;
    let endJoints = 0;
    for (const pipe of input.pipes) {
        const connection = input.connections[pipe.id];
        // A drawn lateral's joint is its lateral connector.
        if (pipe.kind === 'lateral' || !connection) continue;
        const parent = connection.fromPipeId ? byId.get(connection.fromPipeId) : undefined;
        const offMiddle = parent !== undefined && isMiddle(connection.atM, pathLengthM(parent.path));
        if (ways(pipe.id) === 2) {
            if (offMiddle) crosses++;
            else tees++;
        } else if (parent) {
            if (offMiddle) tees++;
            else endJoints++;
        }
    }

    const lateralWays = (l: Lateral) => (l.pipeId === null ? 1 : ways(l.pipeId));
    const lateralEnds = input.laterals.reduce((n, l) => n + lateralWays(l), 0);
    return {
        tees,
        crosses,
        endJoints,
        elbows: input.pipes.reduce((n, p) => n + bends(p.path), 0),
        lateralConnectors: lateralEnds,
        endCaps: lateralEnds + input.pipes.filter((p) => p.kind === 'submain').reduce((n, p) => n + ways(p.id), 0),
        zoneValves: new Set(input.laterals.map((l) => l.zoneId)).size,
    };
}

function isMiddle(atM: number, lengthM: number): boolean {
    return atM > END_M && atM < lengthM - END_M;
}

/** Points along a line where it turns by BEND_DEG or more. */
function bends(path: readonly LatLng[]): number {
    if (path.length < 3) return 0;
    const pts = path.map(localFrame(path[0]).toLocal);
    let count = 0;
    for (let i = 1; i + 1 < pts.length; i++) {
        const a = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
        const b = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
        const turn = Math.abs(((b - a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
        if (turn >= (BEND_DEG * Math.PI) / 180) count++;
    }
    return count;
}
