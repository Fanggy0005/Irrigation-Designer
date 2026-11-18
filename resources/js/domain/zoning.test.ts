import { describe, expect, it } from 'vitest';
import { localFrame, polygonAreaM2 } from './geometry';
import { layoutPlants, type PlantingLayout } from './planting';
import { assignPlantsToZones } from './zones';
import { splitIntoZones, splitRows } from './zoning';

const frame = localFrame({ lat: 14, lng: 101 });
const ring = (...points: [number, number][]) => points.map(([x, y]) => frame.toLatLng({ x, y }));
const noEdits = { removed: [], added: [] };

describe('splitRows', () => {
    it('uses the fewest zones and evens out the plant counts', () => {
        // 60 plants, 25 per zone: 3 zones of 20, not 20 + 20 + 20 found by luck.
        expect(splitRows([10, 10, 10, 10, 10, 10], 25)).toEqual([
            [0, 2],
            [2, 4],
            [4, 6],
        ]);
        // 70 plants in rows of 7, 25 per zone: 3 zones cannot hold them in whole rows.
        expect(splitRows([7, 7, 7, 7, 7, 7, 7, 7, 7, 7], 25)).toEqual([
            [0, 2],
            [2, 5],
            [5, 7],
            [7, 10],
        ]);
    });

    it('keeps everything in one zone when it fits', () => {
        expect(splitRows([5, 5, 5], 100)).toEqual([[0, 3]]);
    });

    it('gives a row over the limit a zone of its own', () => {
        expect(splitRows([3, 30, 3], 10)).toEqual([
            [0, 1],
            [1, 2],
            [2, 3],
        ]);
    });
});

describe('splitIntoZones', () => {
    // 60 × 40 m field, rows east–west 10 m apart, plants every 5 m: 4 rows of 12.
    const field = ring([0, 0], [60, 0], [60, 40], [0, 40]);
    const layout: PlantingLayout = { spacingM: 5, rowSpacingM: 10, rowBearingDeg: 90, staggered: false, edgeSetbackM: 2.5 };
    const plants = layoutPlants(field, [], layout, noEdits);

    const zonesFor = (maxPlantsPerZone: number) => splitIntoZones({ boundary: field, plants, rowBearingDeg: 90, maxPlantsPerZone });
    const plantCounts = (zones: ReturnType<typeof zonesFor>) =>
        assignPlantsToZones(
            plants,
            zones.map((polygon, i) => ({ id: `z${i}`, polygon })),
        ).zones.map((z) => z.plants.length);

    it('makes blocks of whole rows that cover the field', () => {
        expect(plants).toHaveLength(48);
        const zones = zonesFor(24);
        expect(plantCounts(zones)).toEqual([24, 24]);
        // Rows lie at y = 37.5, 27.5, 17.5 and 7.5 (2.5 m in from the north edge). The cut
        // goes midway between the second and third, at y = 22.5.
        expect(zones.map((z) => polygonAreaM2(z))).toEqual([expect.closeTo(60 * 17.5, 2), expect.closeTo(60 * 22.5, 2)]);
        // Each zone holds whole rows.
        const rowsByZone = assignPlantsToZones(
            plants,
            zones.map((polygon, i) => ({ id: `z${i}`, polygon })),
        ).zones.map((z) => new Set(z.plants.map((p) => p.row)).size);
        expect(rowsByZone).toEqual([2, 2]);
    });

    it('returns the whole field as one zone when it fits', () => {
        const zones = zonesFor(100);
        expect(zones).toHaveLength(1);
        expect(polygonAreaM2(zones[0])).toBeCloseTo(2_400, 3);
    });

    it('cuts across the rows when one row is more than a zone can take', () => {
        // 8 per zone: each 12-plant row is split in two bands of 6 columns, then rows paired.
        const counts = plantCounts(zonesFor(8));
        expect(counts.every((n) => n <= 8)).toBe(true);
        expect(counts.reduce((a, b) => a + b, 0)).toBe(48);
        expect(counts).toHaveLength(8);
    });

    it('needs a limit of at least one plant', () => {
        expect(() => zonesFor(0)).toThrow(RangeError);
    });

    it('returns nothing without a boundary or plants', () => {
        expect(splitIntoZones({ boundary: [], plants, rowBearingDeg: 0, maxPlantsPerZone: 10 })).toEqual([]);
        expect(splitIntoZones({ boundary: field, plants: [], rowBearingDeg: 0, maxPlantsPerZone: 10 })).toEqual([]);
    });
});
