import { distanceToRing, type LatLng, localFrame, pointInRing, type XY } from './geometry';

export type PlantingLayout = {
    /** Distance between plants along a row, m. */
    spacingM: number;
    /** Distance between rows, m. */
    rowSpacingM: number;
    /** Compass bearing of the rows: 0 = rows run north–south, 90 = east–west. */
    rowBearingDeg: number;
    /** Shift every other row by half a spacing (triangular planting). */
    staggered: boolean;
    /** Keep plants at least this far from the boundary and from excluded areas, m. */
    edgeSetbackM: number;
};

export type PlantEdits = {
    /** Positions of generated plants the designer removed. */
    removed: readonly LatLng[];
    /** Plants the designer placed by hand. */
    added: readonly LatLng[];
};

export type Plant = {
    /** `r<row>c<col>` for generated plants; `a<i>` for `edits.added[i]`. */
    id: string;
    position: LatLng;
    /** Row number for generated plants, null for plants placed by hand. */
    row: number | null;
};

/** Safety limit so a typo such as 0.05 m spacing cannot freeze the browser. */
export const MAX_PLANTS = 100_000;

export class TooManyPlantsError extends Error {
    constructor(public readonly estimate: number) {
        super(`about ${Math.round(estimate).toLocaleString()} plants, more than the ${MAX_PLANTS.toLocaleString()} limit`);
    }
}

/**
 * Plants on a row grid inside the boundary, minus excluded areas and the designer's edits.
 * Generated plants keep their position as long as the boundary and layout stay the same,
 * which is what lets `removed` refer to them by position.
 */
export function layoutPlants(
    boundary: readonly LatLng[],
    exclusions: readonly (readonly LatLng[])[],
    layout: PlantingLayout,
    edits: PlantEdits,
): Plant[] {
    if (boundary.length < 3) return [];

    const frame = localFrame(boundary[0]);
    const generated = gridPlants(boundary, exclusions, layout, frame.toLocal);

    // A removed position matches the generated plant within a quarter spacing of it.
    const tolerance = Math.min(layout.spacingM, layout.rowSpacingM) / 4;
    const removed = edits.removed.map(frame.toLocal);
    const kept = generated.filter(({ xy }) => !removed.some((r) => Math.hypot(r.x - xy.x, r.y - xy.y) <= tolerance));

    return [
        ...kept.map(({ row, col, xy }) => ({ id: `r${row}c${col}`, position: frame.toLatLng(xy), row })),
        ...edits.added.map((position, i) => ({ id: `a${i}`, position, row: null })),
    ];
}

function gridPlants(
    boundary: readonly LatLng[],
    exclusions: readonly (readonly LatLng[])[],
    layout: PlantingLayout,
    toLocal: (p: LatLng) => XY,
): { row: number; col: number; xy: XY }[] {
    // Work in a frame rotated to the rows: u runs along a row, v across rows.
    const b = layout.rowBearingDeg * (Math.PI / 180);
    const along = { x: Math.sin(b), y: Math.cos(b) };
    const across = { x: Math.cos(b), y: -Math.sin(b) };
    const toUV = (p: XY): XY => ({ x: p.x * along.x + p.y * along.y, y: p.x * across.x + p.y * across.y });
    const fromUV = (q: XY): XY => ({ x: q.x * along.x + q.y * across.x, y: q.x * along.y + q.y * across.y });

    const outline = boundary.map((p) => toUV(toLocal(p)));
    const holes = exclusions.filter((ring) => ring.length >= 3).map((ring) => ring.map((p) => toUV(toLocal(p))));

    const us = outline.map((p) => p.x);
    const vs = outline.map((p) => p.y);
    const [uMin, uMax, vMin, vMax] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
    const setback = layout.edgeSetbackM;
    // A plant exactly at the setback distance counts as far enough, despite rounding.
    const tooClose = (p: XY, ring: XY[]) => distanceToRing(p, ring) < setback - 1e-6;

    const estimate = ((uMax - uMin) / layout.spacingM + 1) * ((vMax - vMin) / layout.rowSpacingM + 1);
    if (estimate > MAX_PLANTS) throw new TooManyPlantsError(estimate);

    const plants: { row: number; col: number; xy: XY }[] = [];
    for (let row = 0; vMin + setback + row * layout.rowSpacingM <= vMax; row++) {
        const v = vMin + setback + row * layout.rowSpacingM;
        const shift = layout.staggered && row % 2 === 1 ? layout.spacingM / 2 : 0;
        for (let col = 0; uMin + setback + shift + col * layout.spacingM <= uMax; col++) {
            const p = { x: uMin + setback + shift + col * layout.spacingM, y: v };
            if (!pointInRing(p, outline) || tooClose(p, outline)) continue;
            if (holes.some((hole) => pointInRing(p, hole) || tooClose(p, hole))) continue;
            plants.push({ row, col, xy: fromUV(p) });
        }
    }
    return plants;
}
