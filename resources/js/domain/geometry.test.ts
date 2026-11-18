import { describe, expect, it } from 'vitest';
import { distanceToRing, localFrame, pointInRing, polygonAreaM2 } from './geometry';

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
