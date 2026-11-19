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
 * How close, in metres, a point of a pipe must be to the source or to another pipe to join
 * it. The map snaps a drawn point onto the line, so this only absorbs rounding and a slightly
 * missed click.
 */
export const CONNECT_TOLERANCE_M = 1;

export type PipeConnection = {
    /** The pipe this one takes water from; null for the water source itself. */
    fromPipeId: string | null;
    /** Where on that pipe the water comes off, m along its path (0 for the source). */
    atM: number;
    /**
     * Where the water enters this pipe, m along its own path: 0 at its first point, its length
     * at its last, in between when it is fed from the middle and the water runs both ways.
     */
    entryM: number;
    /** Where the two meet. */
    point: LatLng;
};

/** A pipe in the source's local frame, with the distance along it to each of its points. */
type Traced = { pipe: PipeLine; xy: XY[]; along: number[] };

/**
 * Traces which pipes get water from the source. Two pipes join where a point of one (an
 * end, or a point placed in the middle) lies on the other; pipes that merely cross, with no
 * point where they cross, pass each other. So a pipe is fed when
 *  - one of its points lies on the source or on a fed pipe that may feed it (see `FEEDS`), or
 *  - the source or an end of such a pipe lies on it.
 * A joint at one of its ends wins over one in its middle, where the water runs both ways.
 * Each pipe takes water at one point only, so the result is a tree; any other point where
 * it touches a pipe is ignored.
 *
 * Pipes left out of the result are not connected. Earlier pipes are traced first, and of
 * several possible feeds the nearest wins (the first point of the path on a tie).
 */
export function connectPipes(source: LatLng | null, pipes: readonly PipeLine[], toleranceM = CONNECT_TOLERANCE_M): Record<string, PipeConnection> {
    const result: Record<string, PipeConnection> = {};
    if (!source) return result;

    const frame = localFrame(source);
    const sourceXY = frame.toLocal(source);
    const items = trace(pipes, frame.toLocal);
    const fed: Traced[] = [];

    for (let changed = true; changed; ) {
        changed = false;
        for (const item of items) {
            if (result[item.pipe.id]) continue;
            const joint = findFeed(item, sourceXY, fed, toleranceM);
            if (!joint) continue;
            const { fromPipeId, atM, entryM, point } = joint;
            result[item.pipe.id] = { fromPipeId, atM, entryM, point: frame.toLatLng(point) };
            fed.push(item);
            changed = true;
        }
    }
    return result;
}

/**
 * Pipes left unconnected that cross a connected pipe they could take water from, with no
 * point placed where they cross (see `connectPipes`): pipe id → the pipe it crosses.
 */
export function missedJoints(
    source: LatLng | null,
    pipes: readonly PipeLine[],
    connections: Readonly<Record<string, PipeConnection>>,
): Record<string, string> {
    const result: Record<string, string> = {};
    if (!source) return result;

    const items = trace(pipes, localFrame(source).toLocal);
    const fed = items.filter((item) => connections[item.pipe.id]);
    for (const item of items) {
        if (connections[item.pipe.id]) continue;
        const crossed = fed.find((parent) => FEEDS[item.pipe.kind].includes(parent.pipe.kind) && pathsCross(item.xy, parent.xy));
        if (crossed) result[item.pipe.id] = crossed.pipe.id;
    }
    return result;
}

function trace(pipes: readonly PipeLine[], toLocal: (p: LatLng) => XY): Traced[] {
    return pipes
        .filter((p) => p.path.length >= 2)
        .map((pipe) => {
            const xy = pipe.path.map(toLocal);
            const along = [0];
            for (let i = 1; i < xy.length; i++) along.push(along[i - 1] + Math.hypot(xy[i].x - xy[i - 1].x, xy[i].y - xy[i - 1].y));
            return { pipe, xy, along };
        });
}

type Joint = { fromPipeId: string | null; atM: number; entryM: number; point: XY; distance: number; atEnd: boolean };

function findFeed(item: Traced, source: XY, fed: readonly Traced[], toleranceM: number): Joint | null {
    const feeds = FEEDS[item.pipe.kind];
    const parents = fed.filter((parent) => feeds.includes(parent.pipe.kind));
    const last = item.xy.length - 1;
    let best: Joint | null = null;
    const consider = (joint: Joint) => {
        if (joint.distance > toleranceM) return;
        if (!best || (joint.atEnd && !best.atEnd) || (joint.atEnd === best.atEnd && joint.distance < best.distance)) best = joint;
    };

    // This pipe's points on the source or a feed: its ends first, then the points between.
    for (const i of [0, last, ...Array.from({ length: last - 1 }, (_, k) => k + 1)]) {
        const p = item.xy[i];
        const atEnd = i === 0 || i === last;
        if (feeds.includes('source')) {
            consider({ fromPipeId: null, atM: 0, entryM: item.along[i], point: source, distance: Math.hypot(p.x - source.x, p.y - source.y), atEnd });
        }
        for (const parent of parents) {
            const hit = closestPointOnPath(p, parent.xy)!;
            consider({ fromPipeId: parent.pipe.id, atM: hit.alongM, entryM: item.along[i], point: hit.point, distance: hit.distance, atEnd });
        }
    }

    // The source or a feed's end on this pipe's line.
    if (feeds.includes('source')) {
        const hit = closestPointOnPath(source, item.xy)!;
        consider({ fromPipeId: null, atM: 0, entryM: hit.alongM, point: source, distance: hit.distance, atEnd: false });
    }
    for (const parent of parents) {
        for (const end of [0, parent.xy.length - 1]) {
            const hit = closestPointOnPath(parent.xy[end], item.xy)!;
            consider({
                fromPipeId: parent.pipe.id,
                atM: parent.along[end],
                entryM: hit.alongM,
                point: parent.xy[end],
                distance: hit.distance,
                atEnd: false,
            });
        }
    }
    return best;
}

/** True when two lines cross each other (touching without crossing does not count). */
function pathsCross(a: readonly XY[], b: readonly XY[]): boolean {
    for (let i = 1; i < a.length; i++) {
        for (let j = 1; j < b.length; j++) if (segmentsCross(a[i - 1], a[i], b[j - 1], b[j])) return true;
    }
    return false;
}

function segmentsCross(a: XY, b: XY, c: XY, d: XY): boolean {
    const side = (p: XY, q: XY, r: XY) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}
