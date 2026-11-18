import { describe, expect, it } from 'vitest';
import { localFrame } from './geometry';
import { type Plant } from './planting';
import { assignPlantsToZones, zoneOfPath } from './zones';

const frame = localFrame({ lat: 14, lng: 101 });
const at = (x: number, y: number) => frame.toLatLng({ x, y });
const rect = (x0: number, y0: number, x1: number, y1: number) => [at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1)];
const plant = (id: string, x: number, y: number): Plant => ({ id, position: at(x, y), row: 0 });

// Two 20 × 20 m zones side by side.
const west = { id: 'z1', polygon: rect(0, 0, 20, 20) };
const east = { id: 'z2', polygon: rect(20, 0, 40, 20) };

describe('assignPlantsToZones', () => {
    it('puts each plant in the zone that contains it', () => {
        const plants = [plant('a', 5, 5), plant('b', 25, 5), plant('c', 35, 15), plant('d', 50, 5)];
        const result = assignPlantsToZones(plants, [west, east]);
        expect(result.zones.map((z) => z.plants.map((p) => p.id))).toEqual([['a'], ['b', 'c']]);
        expect(result.unzoned.map((p) => p.id)).toEqual(['d']);
    });

    it('gives plants under overlapping zones to the earlier zone', () => {
        const overlap = { id: 'z3', polygon: rect(10, 0, 30, 20) };
        const result = assignPlantsToZones([plant('a', 15, 5), plant('b', 25, 5)], [west, overlap]);
        expect(result.zones.map((z) => z.plants.map((p) => p.id))).toEqual([['a'], ['b']]);
    });

    it('keeps zones without plants, and leaves everything unzoned when there are no zones', () => {
        expect(assignPlantsToZones([], [west]).zones).toEqual([{ id: 'z1', plants: [] }]);
        expect(assignPlantsToZones([plant('a', 5, 5)], []).unzoned).toHaveLength(1);
    });
});

describe('zoneOfPath', () => {
    it('picks the zone holding most of the pipe, even when an end lies outside', () => {
        // Starts on a main 5 m west of the field, runs 15 m into the west zone.
        expect(zoneOfPath([at(-5, 10), at(15, 10)], [west, east])).toBe('z1');
        // Crosses into the east zone, but most of it is in the east zone.
        expect(zoneOfPath([at(15, 10), at(40, 10)], [west, east])).toBe('z2');
    });

    it('is null for a pipe outside every zone', () => {
        expect(zoneOfPath([at(-10, 0), at(-10, 20)], [west, east])).toBeNull();
        expect(zoneOfPath([at(5, 5), at(6, 6)], [])).toBeNull();
    });
});
