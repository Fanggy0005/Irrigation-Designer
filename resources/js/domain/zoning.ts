import { clipRingToBox, type LatLng, localFrame, rowFrame } from './geometry';
import { type Plant } from './planting';

export type ZoningInput = {
    boundary: readonly LatLng[];
    plants: readonly Plant[];
    /** Compass bearing of the rows, as in the planting layout. */
    rowBearingDeg: number;
    maxPlantsPerZone: number;
};

/**
 * Splits the field into zones of at most `maxPlantsPerZone` plants, made of whole rows,
 * so each zone's submain crosses its rows and no lateral runs into another zone. When a
 * single row holds more plants than one zone may, the field is first cut across the rows
 * into bands of equal plant count.
 *
 * Within each band it uses the fewest zones that keep every zone under the limit, with
 * plant counts as even as whole rows allow. A zone goes over the limit only when one row
 * of a band does on its own (an odd boundary shape).
 *
 * Returns each zone's outline (the boundary clipped to the zone's block), band by band
 * and row by row.
 */
export function splitIntoZones({ boundary, plants, rowBearingDeg, maxPlantsPerZone }: ZoningInput): LatLng[][] {
    if (!(maxPlantsPerZone >= 1)) throw new RangeError(`a zone must hold at least one plant, got ${maxPlantsPerZone}`);
    if (boundary.length < 3 || plants.length === 0) return [];

    const frame = localFrame(boundary[0]);
    const { toUV, fromUV } = rowFrame(rowBearingDeg);
    const outline = boundary.map((p) => toUV(frame.toLocal(p)));
    // Plants placed by hand have no row; each one counts as a row of its own.
    const points = plants.map((plant, i) => ({ ...toUV(frame.toLocal(plant.position)), row: plant.row ?? `added${i}` }));

    const longestRow = Math.max(...countBy(points, (p) => p.row).values());
    const bandCount = Math.ceil(longestRow / maxPlantsPerZone);
    const uCuts = equalCountCuts(
        points.map((p) => p.x),
        bandCount,
    );
    const bandEdges = [-Infinity, ...uCuts, Infinity];

    const zones: LatLng[][] = [];
    for (let b = 0; b + 1 < bandEdges.length; b++) {
        const [minX, maxX] = [bandEdges[b], bandEdges[b + 1]];
        const inBand = points.filter((p) => p.x >= minX && p.x < maxX);

        const rows = [...groupBy(inBand, (p) => p.row).values()]
            .map((members) => ({ v: members.reduce((sum, p) => sum + p.y, 0) / members.length, count: members.length }))
            .sort((a, b) => a.v - b.v);

        for (const [start, end] of splitRows(
            rows.map((r) => r.count),
            maxPlantsPerZone,
        )) {
            const minY = start === 0 ? -Infinity : (rows[start - 1].v + rows[start].v) / 2;
            const maxY = end === rows.length ? Infinity : (rows[end - 1].v + rows[end].v) / 2;
            const ring = clipRingToBox(outline, { minX, maxX, minY, maxY });
            if (ring.length >= 3) zones.push(ring.map((q) => frame.toLatLng(fromUV(q))));
        }
    }
    return zones;
}

/**
 * Groups consecutive rows into the fewest zones that each hold at most `max` plants (a
 * single row over the limit gets a zone to itself), with counts as even as possible.
 * Returns [start, end) row indices.
 */
export function splitRows(counts: readonly number[], max: number): [number, number][] {
    const total = counts.reduce((a, b) => a + b, 0);
    for (let zoneCount = Math.max(1, Math.ceil(total / max)); zoneCount < counts.length; zoneCount++) {
        const groups = rangesFromCuts(cutsNearTargets(counts, zoneCount), counts.length);
        const fits = groups.every(([start, end]) => end - start === 1 || sum(counts, start, end) <= max);
        if (fits) return groups;
    }
    return counts.map((_, i) => [i, i + 1]);
}

/**
 * Where to cut a list of weighted items into `parts` runs of nearly equal total weight:
 * the item indices (1 … n−1) whose running total lands nearest each target.
 */
function cutsNearTargets(weights: readonly number[], parts: number): number[] {
    const total = weights.reduce((a, b) => a + b, 0);
    const running = [0];
    for (const w of weights) running.push(running[running.length - 1] + w);

    const cuts: number[] = [];
    for (let k = 1; k < parts; k++) {
        const target = (total * k) / parts;
        let best = 1;
        for (let i = 2; i < weights.length; i++) {
            if (Math.abs(running[i] - target) < Math.abs(running[best] - target)) best = i;
        }
        if (best > (cuts.at(-1) ?? 0) && best < weights.length) cuts.push(best);
    }
    return cuts;
}

function rangesFromCuts(cuts: readonly number[], length: number): [number, number][] {
    const edges = [0, ...cuts, length];
    return edges.slice(1).map((end, i) => [edges[i], end]);
}

/** Positions that split the values into `parts` groups of nearly equal size, never between equal values. */
function equalCountCuts(values: readonly number[], parts: number): number[] {
    if (parts <= 1) return [];
    const distinct = [...countBy(values, (v) => Math.round(v * 1000) / 1000).entries()].sort((a, b) => a[0] - b[0]);
    const cuts = cutsNearTargets(
        distinct.map(([, n]) => n),
        parts,
    );
    return cuts.map((i) => (distinct[i - 1][0] + distinct[i][0]) / 2);
}

function sum(values: readonly number[], start: number, end: number): number {
    let total = 0;
    for (let i = start; i < end; i++) total += values[i];
    return total;
}

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
    const groups = new Map<K, T[]>();
    for (const item of items) {
        const k = key(item);
        const group = groups.get(k);
        if (group) group.push(item);
        else groups.set(k, [item]);
    }
    return groups;
}

function countBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, number> {
    const counts = new Map<K, number>();
    for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
    return counts;
}
