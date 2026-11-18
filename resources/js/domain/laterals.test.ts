import { describe, expect, it } from 'vitest';
import { localFrame, pathLengthM, type XY } from './geometry';
import { type LateralInput, layoutLaterals } from './laterals';
import { layoutPlants, type Plant } from './planting';

const frame = localFrame({ lat: 14, lng: 101 });
const at = (x: number, y: number) => frame.toLatLng({ x, y });
const ring = (...points: [number, number][]) => points.map(([x, y]) => at(x, y));
const local = (p: { lat: number; lng: number }): XY => {
    const { x, y } = frame.toLocal(p);
    return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
};

// 60 × 20 m zone, rows east–west 10 m apart (y = 17.5 and 7.5), plants every 5 m from x = 2.5.
const field = ring([0, 0], [60, 0], [60, 20], [0, 20]);
const plants = layoutPlants(
    field,
    [],
    { spacingM: 5, rowSpacingM: 10, rowBearingDeg: 90, staggered: false, edgeSetbackM: 2.5 },
    { removed: [], added: [] },
);
const zone = { id: 'z1', plants };
// Submain across the rows at x = 20 (between the 4th and 5th plants).
const submain = { id: 's1', zoneId: 'z1', path: ring([20, -5], [20, 20]) };

const input = (overrides: Partial<LateralInput> = {}): LateralInput => ({
    zones: [zone],
    submains: [submain],
    drawnLaterals: [],
    rowBearingDeg: 90,
    spacingM: 5,
    rowSpacingM: 10,
    removed: [],
    ...overrides,
});

describe('layoutLaterals', () => {
    it('runs one lateral each way along every row from the submain', () => {
        const { laterals, unservedPlantIds } = layoutLaterals(input());
        expect(plants).toHaveLength(24);
        expect(laterals).toHaveLength(4); // 2 rows × 2 sides
        expect(unservedPlantIds).toEqual([]);

        const row0West = laterals.find((l) => l.path.length === 2 && local(l.path[1]).x === 2.5 && local(l.path[1]).y === 17.5)!;
        expect(local(row0West.path[0])).toEqual({ x: 20, y: 17.5 }); // the tee
        expect(row0West.plantIds).toHaveLength(4); // x = 17.5, 12.5, 7.5, 2.5
        expect(pathLengthM(row0West.path)).toBeCloseTo(17.5, 3);
        expect(row0West.submainId).toBe('s1');
        expect(row0West.pipeId).toBeNull();

        const lengths = laterals.map((l) => Math.round(pathLengthM(l.path) * 10) / 10).sort((a, b) => a - b);
        expect(lengths).toEqual([17.5, 17.5, 37.5, 37.5]);
    });

    it('orders plants from the tee outwards', () => {
        const { laterals } = layoutLaterals(input());
        for (const lateral of laterals) {
            const tee = local(lateral.path[0]);
            const distances = lateral.plantIds.map((id) => Math.abs(local(plants.find((p) => p.id === id)!.position).x - tee.x));
            expect(distances).toEqual([...distances].sort((a, b) => a - b));
        }
    });

    it('splits a row between two submains at the plant nearest each', () => {
        const second = { id: 's2', zoneId: 'z1', path: ring([45, -5], [45, 20]) };
        const { laterals } = layoutLaterals(input({ submains: [submain, second] }));
        // Per row: west of s1, s1 → midpoint, midpoint → s2, east of s2.
        expect(laterals).toHaveLength(8);
        expect(new Set(laterals.flatMap((l) => l.plantIds)).size).toBe(24);
    });

    it('leaves rows the submain does not reach unserved', () => {
        const short = { id: 's1', zoneId: 'z1', path: ring([20, 10], [20, 20]) }; // crosses only the y = 17.5 row
        const { laterals, unservedPlantIds } = layoutLaterals(input({ submains: [short] }));
        expect(laterals).toHaveLength(2);
        expect(unservedPlantIds).toHaveLength(12);
    });

    it('ignores submains of other zones', () => {
        const elsewhere = { ...submain, zoneId: 'z2' };
        expect(layoutLaterals(input({ submains: [elsewhere] })).unservedPlantIds).toHaveLength(24);
    });

    it('drops a removed lateral and leaves its plants unserved', () => {
        const { laterals } = layoutLaterals(input());
        const target = laterals[0];
        const mid = { lat: (target.path[0].lat + target.path[1].lat) / 2, lng: (target.path[0].lng + target.path[1].lng) / 2 };

        const after = layoutLaterals(input({ removed: [mid] }));
        expect(after.laterals.map((l) => l.id)).not.toContain(target.id);
        expect(after.laterals).toHaveLength(3);
        expect(after.unservedPlantIds.sort()).toEqual([...target.plantIds].sort());
    });

    it('lets a drawn lateral take the plants near it first', () => {
        // Hand-drawn along the east half of the y = 7.5 row, 1.5 m off the row line. It reaches
        // 2.5 m (half the 5 m plant spacing): the plant at x = 17.5 is 2.9 m from its end.
        const drawn = { id: 'p9', zoneId: 'z1', path: ring([20, 6], [60, 6]) };
        const added: Plant = { id: 'a0', position: at(50, 4), row: null };
        const { laterals, unservedPlantIds } = layoutLaterals(input({ zones: [{ id: 'z1', plants: [...plants, added] }], drawnLaterals: [drawn] }));

        const mine = laterals.find((l) => l.id === 'p9')!;
        expect(mine.pipeId).toBe('p9');
        expect(mine.plantIds).toHaveLength(9); // 8 row plants east of x = 20, plus the hand-placed one
        expect(mine.plantIds).toContain('a0');
        // The generated lateral on that side of the row has nothing left to serve.
        expect(laterals).toHaveLength(4);
        expect(unservedPlantIds).toEqual([]);
    });

    it('leaves hand-placed plants unserved until a lateral is drawn to them', () => {
        const added: Plant = { id: 'a0', position: at(50, 10), row: null };
        const { unservedPlantIds } = layoutLaterals(input({ zones: [{ id: 'z1', plants: [...plants, added] }] }));
        expect(unservedPlantIds).toEqual(['a0']);
    });

    it('gives a zone without a submain no laterals', () => {
        const { laterals, unservedPlantIds } = layoutLaterals(input({ submains: [] }));
        expect(laterals).toEqual([]);
        expect(unservedPlantIds).toHaveLength(24);
    });
});
