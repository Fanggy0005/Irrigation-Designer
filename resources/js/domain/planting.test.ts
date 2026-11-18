import { describe, expect, it } from 'vitest';
import { localFrame, type XY } from './geometry';
import { layoutPlants, type PlantingLayout, TooManyPlantsError } from './planting';

// Shapes are drawn in metres around this origin. Each boundary starts at (0, 0), which is
// also the origin layoutPlants picks, so local coordinates line up exactly.
const frame = localFrame({ lat: 14, lng: 101 });
const ring = (...points: [number, number][]) => points.map(([x, y]) => frame.toLatLng({ x, y }));
const local = (plants: { position: { lat: number; lng: number } }[]): XY[] =>
    plants.map((p) => {
        const { x, y } = frame.toLocal(p.position);
        return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
    });

const square40 = ring([0, 0], [40, 0], [40, 40], [0, 40]);
const layout: PlantingLayout = { spacingM: 10, rowSpacingM: 10, rowBearingDeg: 0, staggered: false, edgeSetbackM: 5 };
const noEdits = { removed: [], added: [] };

describe('layoutPlants', () => {
    it('fills a 40 m square with a 10 m grid set back 5 m from the edge', () => {
        const plants = layoutPlants(square40, [], layout, noEdits);
        expect(plants).toHaveLength(16);
        const xs = [...new Set(local(plants).map((p) => p.x))].sort((a, b) => a - b);
        expect(xs).toEqual([5, 15, 25, 35]);
    });

    it('keeps plants out of excluded areas and their setback', () => {
        // A 10 m pond in the middle touches the four centre plants.
        const pond = ring([15, 15], [25, 15], [25, 25], [15, 25]);
        const plants = layoutPlants(square40, [pond], layout, noEdits);
        expect(plants).toHaveLength(12);
        expect(local(plants)).not.toContainEqual({ x: 15, y: 15 });
    });

    it('runs rows along the bearing', () => {
        const strip = ring([0, 0], [60, 0], [60, 20], [0, 20]);
        const rowLayout = { spacingM: 5, rowSpacingM: 10, staggered: false, edgeSetbackM: 2.5 };

        const eastWest = layoutPlants(strip, [], { ...rowLayout, rowBearingDeg: 90 }, noEdits);
        expect(eastWest).toHaveLength(24); // 2 rows × 12
        const firstRow = eastWest.filter((p) => p.row === 0).map((p) => p.position.lat);
        expect(new Set(firstRow.map((lat) => lat.toFixed(9))).size).toBe(1);

        const northSouth = layoutPlants(strip, [], { ...rowLayout, rowBearingDeg: 0 }, noEdits);
        expect(northSouth).toHaveLength(24); // 6 rows × 4
        const firstColumn = northSouth.filter((p) => p.row === 0).map((p) => p.position.lng);
        expect(new Set(firstColumn.map((lng) => lng.toFixed(9))).size).toBe(1);
    });

    it('shifts every other row by half a spacing when staggered', () => {
        const plants = layoutPlants(square40, [], { ...layout, staggered: true }, noEdits);
        const yOf = (row: number) => local(plants.filter((p) => p.row === row)).map((p) => p.y);
        expect(yOf(0)).toEqual([5, 15, 25, 35]);
        expect(yOf(1)).toEqual([10, 20, 30]);
    });

    it('applies removed and added plants', () => {
        const all = layoutPlants(square40, [], layout, noEdits);
        const target = all[5].position;
        // Clicked 1 m off the plant: still within a quarter spacing (2.5 m).
        const nearTarget = frame.toLatLng({ x: frame.toLocal(target).x + 1, y: frame.toLocal(target).y });
        const extra = frame.toLatLng({ x: 20, y: 20 });

        const plants = layoutPlants(square40, [], layout, { removed: [nearTarget], added: [extra] });

        expect(plants).toHaveLength(16);
        expect(plants.map((p) => p.id)).not.toContain(all[5].id);
        expect(plants.at(-1)).toEqual({ id: 'a0', position: extra, row: null });
    });

    it('returns nothing until the boundary has three points', () => {
        expect(layoutPlants(ring([0, 0], [10, 0]), [], layout, noEdits)).toEqual([]);
    });

    it('refuses a layout that would create too many plants', () => {
        const km = ring([0, 0], [1000, 0], [1000, 1000], [0, 1000]);
        expect(() => layoutPlants(km, [], { ...layout, spacingM: 0.5, rowSpacingM: 0.5 }, noEdits)).toThrow(TooManyPlantsError);
    });
});
