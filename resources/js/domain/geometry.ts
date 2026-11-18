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
        min = Math.min(min, distanceToSegment(p, ring[i], ring[(i + 1) % ring.length]));
    }
    return min;
}

function distanceToSegment(p: XY, a: XY, b: XY): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
