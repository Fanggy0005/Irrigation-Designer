import { closestPointOnPath, type LatLng, localFrame, type XY } from './geometry';
import { type PipeKind } from './project';

export type PipeLine = { id: string; kind: PipeKind; path: readonly LatLng[] };

/** What each kind of pipe may take water from. */
const FEEDS: Record<PipeKind, readonly ('source' | PipeKind)[]> = {
    main: ['source', 'main'],
    // A small farm may put the zone valves at the pump, with no main at all.
    submain: ['source', 'main', 'submain'],
    lateral: ['submain'],
};

/**
 * How close, in metres, a pipe's end must be to the source or to another pipe to join it.
 * The map snaps a drawn end onto the line, so this only absorbs rounding and a slightly
 * missed click.
 */
export const CONNECT_TOLERANCE_M = 1;

export type PipeConnection = {
    /** The pipe this one takes water from; null for the water source itself. */
    fromPipeId: string | null;
    /** Where on that pipe the water comes off, m along its path (0 for the source). */
    atM: number;
    /** True when water enters at the last point of the path (drawn towards the source). */
    reversed: boolean;
};

/**
 * Traces which pipes get water from the source: a pipe is fed when one of its ends touches
 * the source or any point of a pipe that is already fed and may feed it (see `FEEDS`). Each
 * pipe takes water at one end only, so the result is a tree; a second end touching another
 * pipe is ignored.
 *
 * Pipes left out of the result are not connected. Earlier pipes are traced first, and of
 * several possible feeds the nearest wins (the first point of the path on a tie).
 */
export function connectPipes(source: LatLng | null, pipes: readonly PipeLine[], toleranceM = CONNECT_TOLERANCE_M): Record<string, PipeConnection> {
    const result: Record<string, PipeConnection> = {};
    if (!source) return result;

    const frame = localFrame(source);
    const sourceXY = frame.toLocal(source);
    const items = pipes.filter((p) => p.path.length >= 2).map((pipe) => ({ pipe, xy: pipe.path.map(frame.toLocal) }));
    const fed: typeof items = [];

    for (let changed = true; changed; ) {
        changed = false;
        for (const item of items) {
            if (result[item.pipe.id]) continue;
            const connection = findFeed(item.pipe.kind, item.xy, sourceXY, fed, toleranceM);
            if (!connection) continue;
            result[item.pipe.id] = connection;
            fed.push(item);
            changed = true;
        }
    }
    return result;
}

function findFeed(
    kind: PipeKind,
    path: readonly XY[],
    source: XY,
    fed: readonly { pipe: PipeLine; xy: XY[] }[],
    toleranceM: number,
): PipeConnection | null {
    const feeds = FEEDS[kind];
    const candidates: (PipeConnection & { distance: number })[] = [];

    for (const reversed of [false, true]) {
        const end = reversed ? path[path.length - 1] : path[0];
        if (feeds.includes('source')) {
            candidates.push({ fromPipeId: null, atM: 0, reversed, distance: Math.hypot(end.x - source.x, end.y - source.y) });
        }
        for (const parent of fed) {
            if (!feeds.includes(parent.pipe.kind)) continue;
            const hit = closestPointOnPath(end, parent.xy)!;
            candidates.push({ fromPipeId: parent.pipe.id, atM: hit.alongM, reversed, distance: hit.distance });
        }
    }

    let best: (PipeConnection & { distance: number }) | null = null;
    for (const candidate of candidates) {
        if (candidate.distance <= toleranceM && (!best || candidate.distance < best.distance)) best = candidate;
    }
    if (!best) return null;
    const { fromPipeId, atM, reversed } = best;
    return { fromPipeId, atM, reversed };
}
