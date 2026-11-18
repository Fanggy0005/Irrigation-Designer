export type LatLng = { lat: number; lng: number };

/** Metres east (x) and north (y) of a local origin. */
export type XY = { x: number; y: number };

export type LocalFrame = {
    toLocal: (p: LatLng) => XY;
    toLatLng: (p: XY) => LatLng;
};

// WGS84 ellipsoid
const A = 6_378_137;
const E2 = 0.00669437999014;
const RAD = Math.PI / 180;

/**
 * Flat metre coordinates around `origin`, using the ellipsoid's radii of curvature at the
 * origin's latitude. Over a few kilometres (any farm) distances and areas are within about
 * 0.02% of geodesic values; a spherical Earth would be off by up to 0.5% north–south.
 */
export function localFrame(origin: LatLng): LocalFrame {
    const sin = Math.sin(origin.lat * RAD);
    const w = 1 - E2 * sin * sin;
    const meridianRadius = (A * (1 - E2)) / w ** 1.5;
    const primeVerticalRadius = A / Math.sqrt(w);
    const mPerDegLat = meridianRadius * RAD;
    const mPerDegLng = primeVerticalRadius * Math.cos(origin.lat * RAD) * RAD;

    return {
        toLocal: (p) => ({ x: (p.lng - origin.lng) * mPerDegLng, y: (p.lat - origin.lat) * mPerDegLat }),
        toLatLng: (p) => ({ lat: origin.lat + p.y / mPerDegLat, lng: origin.lng + p.x / mPerDegLng }),
    };
}

/**
 * Local metres turned to the planting rows: x (u) runs along a row, y (v) across the rows.
 * `bearingDeg` is the compass bearing of the rows (0 = rows run north–south).
 */
export function rowFrame(bearingDeg: number): { toUV: (p: XY) => XY; fromUV: (q: XY) => XY } {
    const b = bearingDeg * RAD;
    const along = { x: Math.sin(b), y: Math.cos(b) };
    const across = { x: Math.cos(b), y: -Math.sin(b) };
    return {
        toUV: (p) => ({ x: p.x * along.x + p.y * along.y, y: p.x * across.x + p.y * across.y }),
        fromUV: (q) => ({ x: q.x * along.x + q.y * across.x, y: q.x * along.y + q.y * across.y }),
    };
}

/** Area of a polygon given as its outline (not closed: the last point joins the first). */
export function polygonAreaM2(ring: readonly LatLng[]): number {
    if (ring.length < 3) return 0;
    const frame = localFrame(ring[0]);
    const pts = ring.map(frame.toLocal);
    let twiceArea = 0;
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        twiceArea += a.x * b.y - b.x * a.y;
    }
    return Math.abs(twiceArea) / 2;
}

/** Length of a line through the points in order. */
export function pathLengthM(path: readonly LatLng[]): number {
    if (path.length < 2) return 0;
    const pts = path.map(localFrame(path[0]).toLocal);
    let length = 0;
    for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return length;
}

export function pointInRing(p: XY, ring: readonly XY[]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i];
        const b = ring[j];
        if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
}

/** Shortest distance from `p` to the outline of `ring`, including the closing edge. */
export function distanceToRing(p: XY, ring: readonly XY[]): number {
    let min = Infinity;
    for (let i = 0; i < ring.length; i++) {
        min = Math.min(min, closestOnSegment(p, ring[i], ring[(i + 1) % ring.length]).distance);
    }
    return min;
}

export type PathPoint = {
    /** Closest point on the path. */
    point: XY;
    /** Distance from the query point to `point`. */
    distance: number;
    /** Distance along the path from its first point to `point`. */
    alongM: number;
};

/** The point on an open line (no closing edge) nearest to `p`. Null for an empty path. */
export function closestPointOnPath(p: XY, path: readonly XY[]): PathPoint | null {
    if (path.length === 0) return null;
    if (path.length === 1) return { point: path[0], distance: Math.hypot(p.x - path[0].x, p.y - path[0].y), alongM: 0 };

    let best: PathPoint | null = null;
    let walked = 0;
    for (let i = 1; i < path.length; i++) {
        const a = path[i - 1];
        const b = path[i];
        const hit = closestOnSegment(p, a, b);
        const segmentLength = Math.hypot(b.x - a.x, b.y - a.y);
        if (!best || hit.distance < best.distance) best = { point: hit.point, distance: hit.distance, alongM: walked + hit.t * segmentLength };
        walked += segmentLength;
    }
    return best;
}

/** `count` points spread evenly along an open line, both ends included. */
export function pointsAlongPath(path: readonly XY[], count: number): XY[] {
    if (path.length === 0) return [];
    const lengths = [0];
    for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
    const total = lengths[lengths.length - 1];
    if (count < 2 || total === 0) return [path[0]];

    const points: XY[] = [];
    let segment = 1;
    for (let k = 0; k < count; k++) {
        const at = (total * k) / (count - 1);
        while (segment < path.length - 1 && lengths[segment] < at) segment++;
        const a = path[segment - 1];
        const b = path[segment];
        const span = lengths[segment] - lengths[segment - 1];
        const t = span === 0 ? 0 : (at - lengths[segment - 1]) / span;
        points.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
    }
    return points;
}

/** An axis-aligned rectangle; use ±Infinity for an open side. */
export type Box = { minX: number; maxX: number; minY: number; maxY: number };

/**
 * The part of a polygon inside a box (Sutherland–Hodgman). A concave polygon that the box
 * cuts into several pieces comes back as one outline joined by zero-width seams along the
 * box edge; areas and point-in-polygon tests are unaffected.
 */
export function clipRingToBox(ring: readonly XY[], box: Box): XY[] {
    const sides: ((p: XY) => number)[] = [];
    if (Number.isFinite(box.minX)) sides.push((p) => p.x - box.minX);
    if (Number.isFinite(box.maxX)) sides.push((p) => box.maxX - p.x);
    if (Number.isFinite(box.minY)) sides.push((p) => p.y - box.minY);
    if (Number.isFinite(box.maxY)) sides.push((p) => box.maxY - p.y);

    let points = [...ring];
    for (const inside of sides) points = clipHalfPlane(points, inside);

    // Drop repeated points left where the outline crossed a box edge exactly at a vertex.
    return points.filter((p, i) => {
        const prev = points[(i + points.length - 1) % points.length];
        return points.length === 1 || Math.hypot(p.x - prev.x, p.y - prev.y) > 1e-9;
    });
}

/** Keeps the part of the polygon where `inside(p) >= 0`. */
function clipHalfPlane(points: XY[], inside: (p: XY) => number): XY[] {
    const out: XY[] = [];
    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const fa = inside(a);
        const fb = inside(b);
        if (fa >= 0) out.push(a);
        if (fa >= 0 !== fb >= 0) {
            const t = fa / (fa - fb);
            out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
        }
    }
    return out;
}

function closestOnSegment(p: XY, a: XY, b: XY): { point: XY; distance: number; t: number } {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
    const point = { x: a.x + t * dx, y: a.y + t * dy };
    return { point, distance: Math.hypot(p.x - point.x, p.y - point.y), t };
}
