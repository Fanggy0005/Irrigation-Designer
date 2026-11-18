import { describe, expect, it } from 'vitest';
import {
    clipRingToBox,
    closestPointOnPath,
    distanceToRing,
    localFrame,
    pathLengthM,
    pointInRing,
    pointsAlongPath,
    polygonAreaM2,
    rowFrame,
} from './geometry';

describe('localFrame', () => {
    // Reference lengths of one degree on WGS84 at 15°N (standard tables): 110,649 m of
    // latitude and 107,551 m of longitude.
    const frame = localFrame({ lat: 15, lng: 100 });

    it('measures one degree of latitude at 15°N as 110,649 m', () => {
        const { y } = frame.toLocal({ lat: 15.001, lng: 100 });
        expect(y * 1000).toBeCloseTo(110_649, -1);
    });

    it('measures one degree of longitude at 15°N as 107,551 m', () => {
        const { x } = frame.toLocal({ lat: 15, lng: 100.001 });
        expect(x * 1000).toBeCloseTo(107_551, -1);
    });

    it('round-trips coordinates', () => {
        const p = { lat: 15.0123, lng: 100.0456 };
        const back = frame.toLatLng(frame.toLocal(p));
        expect(back.lat).toBeCloseTo(p.lat, 12);
        expect(back.lng).toBeCloseTo(p.lng, 12);
    });
});

describe('polygonAreaM2', () => {
    it('gives 1 rai (1,600 m²) for a 40 × 40 m square, either winding', () => {
        const frame = localFrame({ lat: 14, lng: 101 });
        const square = [
            { x: 0, y: 0 },
            { x: 40, y: 0 },
            { x: 40, y: 40 },
            { x: 0, y: 40 },
        ].map(frame.toLatLng);
        expect(polygonAreaM2(square)).toBeCloseTo(1_600, 6);
        // Reversed, the frame is centred on another corner 40 m away: a few mm² different.
        expect(polygonAreaM2([...square].reverse())).toBeCloseTo(1_600, 1);
    });

    it('is 0 for fewer than three points', () => {
        expect(polygonAreaM2([{ lat: 14, lng: 101 }])).toBe(0);
    });
});

describe('pointInRing and distanceToRing', () => {
    const square = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
    ];

    it('tells inside from outside', () => {
        expect(pointInRing({ x: 5, y: 5 }, square)).toBe(true);
        expect(pointInRing({ x: 15, y: 5 }, square)).toBe(false);
    });

    it('measures to the nearest edge, including the closing edge and corners', () => {
        expect(distanceToRing({ x: 5, y: 2 }, square)).toBeCloseTo(2, 12);
        expect(distanceToRing({ x: 1, y: 5 }, square)).toBeCloseTo(1, 12); // closing edge x = 0
        expect(distanceToRing({ x: 13, y: 14 }, square)).toBeCloseTo(5, 12); // corner (10, 10)
    });
});

describe('rowFrame', () => {
    it('puts u along the rows and v across them', () => {
        // Rows running east–west (bearing 90): a point 10 m east is 10 m along a row.
        const { toUV } = rowFrame(90);
        const east = toUV({ x: 10, y: 0 });
        expect(east.x).toBeCloseTo(10, 12);
        expect(east.y).toBeCloseTo(0, 12);
        const north = toUV({ x: 0, y: 10 });
        expect(north.x).toBeCloseTo(0, 12);
        expect(Math.abs(north.y)).toBeCloseTo(10, 12);
    });

    it('round-trips', () => {
        const { toUV, fromUV } = rowFrame(37);
        const back = fromUV(toUV({ x: 3, y: -4 }));
        expect(back.x).toBeCloseTo(3, 12);
        expect(back.y).toBeCloseTo(-4, 12);
    });
});

describe('pathLengthM', () => {
    it('adds up the segments: 30 m east then 40 m north is 70 m', () => {
        const frame = localFrame({ lat: 14, lng: 101 });
        const path = [
            { x: 0, y: 0 },
            { x: 30, y: 0 },
            { x: 30, y: 40 },
        ].map(frame.toLatLng);
        expect(pathLengthM(path)).toBeCloseTo(70, 6);
        expect(pathLengthM(path.slice(0, 1))).toBe(0);
    });
});

describe('closestPointOnPath', () => {
    const path = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
    ];

    it('finds the nearest point and how far along the path it is', () => {
        expect(closestPointOnPath({ x: 4, y: 3 }, path)).toEqual({ point: { x: 4, y: 0 }, distance: 3, alongM: 4 });
        expect(closestPointOnPath({ x: 12, y: 6 }, path)).toEqual({ point: { x: 10, y: 6 }, distance: 2, alongM: 16 });
    });

    it('stops at the ends (no closing edge)', () => {
        const hit = closestPointOnPath({ x: -3, y: 4 }, path)!;
        expect(hit.point).toEqual({ x: 0, y: 0 });
        expect(hit.distance).toBe(5);
        expect(closestPointOnPath({ x: 0, y: 10 }, path)!.distance).toBe(10); // not 0 via a closing edge
    });

    it('handles single points and empty paths', () => {
        expect(closestPointOnPath({ x: 3, y: 4 }, [{ x: 0, y: 0 }])).toEqual({ point: { x: 0, y: 0 }, distance: 5, alongM: 0 });
        expect(closestPointOnPath({ x: 3, y: 4 }, [])).toBeNull();
    });
});

describe('pointsAlongPath', () => {
    it('spreads points evenly by length, across vertices', () => {
        const path = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
        ];
        expect(pointsAlongPath(path, 5)).toEqual([
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 5 },
            { x: 10, y: 10 },
        ]);
    });
});

describe('clipRingToBox', () => {
    const square = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
    ];
    const area = (ring: { x: number; y: number }[]) =>
        Math.abs(ring.reduce((sum, a, i) => sum + a.x * ring[(i + 1) % ring.length].y - ring[(i + 1) % ring.length].x * a.y, 0)) / 2;

    it('keeps the part inside the box', () => {
        const clipped = clipRingToBox(square, { minX: 4, maxX: Infinity, minY: -Infinity, maxY: 7 });
        expect(area(clipped)).toBeCloseTo(6 * 7, 10);
        expect(clipped.every((p) => p.x >= 4 && p.y <= 7)).toBe(true);
    });

    it('returns the polygon unchanged for an open box, and nothing for a box beside it', () => {
        expect(clipRingToBox(square, { minX: -Infinity, maxX: Infinity, minY: -Infinity, maxY: Infinity })).toEqual(square);
        expect(clipRingToBox(square, { minX: 20, maxX: 30, minY: 0, maxY: 10 })).toEqual([]);
    });

    it('clips a concave polygon without losing area', () => {
        // U shape: two 2 m arms joined by a 2 m base; a band across the arms cuts it in two.
        const u = [
            { x: 0, y: 0 },
            { x: 6, y: 0 },
            { x: 6, y: 6 },
            { x: 4, y: 6 },
            { x: 4, y: 2 },
            { x: 2, y: 2 },
            { x: 2, y: 6 },
            { x: 0, y: 6 },
        ];
        const band = clipRingToBox(u, { minX: -Infinity, maxX: Infinity, minY: 3, maxY: 5 });
        expect(area(band)).toBeCloseTo(2 * 2 + 2 * 2, 10);
        expect(pointInRing({ x: 1, y: 4 }, band)).toBe(true);
        expect(pointInRing({ x: 3, y: 4 }, band)).toBe(false); // the gap between the arms
    });
});
