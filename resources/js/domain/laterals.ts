import { closestPointOnPath, type LatLng, localFrame, rowFrame, type XY } from './geometry';
import { type Plant } from './planting';

/** A pipe that belongs to one zone. */
export type ZonePipe = { id: string; zoneId: string; path: readonly LatLng[] };

export type LateralInput = {
    /** Each zone's plants, as `assignPlantsToZones` gives them. */
    zones: readonly { id: string; plants: readonly Plant[] }[];
    submains: readonly ZonePipe[];
    /** Laterals the designer drew by hand. */
    drawnLaterals: readonly ZonePipe[];
    rowBearingDeg: number;
    spacingM: number;
    rowSpacingM: number;
    /** Points on generated laterals the designer removed. */
    removed: readonly LatLng[];
};

export type Lateral = {
    /** The drawn pipe's id, or `<zone>:r<row>:<tee><side>` for a generated lateral. */
    id: string;
    zoneId: string;
    /** For a generated lateral: from the tee on the submain to the last plant. */
    path: LatLng[];
    /** Plants on this lateral, in order along its path. */
    plantIds: string[];
    /** The drawn pipe, or null when generated. */
    pipeId: string | null;
    /** The submain a generated lateral tees off. Null for a drawn one, whose feed comes from `connectPipes`. */
    submainId: string | null;
};

export type LateralLayout = {
    laterals: Lateral[];
    /** Plants in a zone that no lateral reaches. */
    unservedPlantIds: string[];
};

/**
 * Laterals for every zone. One lateral runs along each row on each side of the point where
 * one of the zone's submains crosses that row, out to the last plant on that side. Every
 * plant joins the crossing nearest to it along the row.
 *
 * Drawn laterals come first: each takes the plants within half a plant or row spacing
 * (whichever is smaller) of it, and only the plants left over get generated laterals. Plants placed by hand are off the row
 * grid, so they need a drawn lateral. A removed point drops the generated lateral that
 * passes within a quarter row spacing of it, and that lateral's plants go unserved.
 */
export function layoutLaterals(input: LateralInput): LateralLayout {
    const laterals: Lateral[] = [];
    const unservedPlantIds: string[] = [];
    for (const zone of input.zones) {
        if (zone.plants.length === 0) continue;
        const result = zoneLaterals(zone, input);
        laterals.push(...result.laterals);
        unservedPlantIds.push(...result.unservedPlantIds);
    }
    return { laterals, unservedPlantIds };
}

function zoneLaterals(zone: LateralInput['zones'][number], input: LateralInput): LateralLayout {
    const frame = localFrame(zone.plants[0].position);
    const { toUV, fromUV } = rowFrame(input.rowBearingDeg);
    const inZone = (pipes: readonly ZonePipe[]) => pipes.filter((p) => p.zoneId === zone.id && p.path.length >= 2);

    const reach = Math.min(input.spacingM, input.rowSpacingM) / 2;
    const drawn = drawnLaterals(zone, inZone(input.drawnLaterals), reach, frame.toLocal);
    const taken = new Set(drawn.flatMap((l) => l.plantIds));
    const left = zone.plants.filter((p) => !taken.has(p.id));

    const submains = inZone(input.submains).map((s) => ({ id: s.id, uv: s.path.map((p) => toUV(frame.toLocal(p))) }));
    const toLatLng = (q: XY) => frame.toLatLng(fromUV(q));
    const generated: Lateral[] = [];
    const unservedPlantIds: string[] = [];

    for (const [row, members] of rowsOf(left)) {
        const plants = members.map((plant) => ({ plant, uv: toUV(frame.toLocal(plant.position)) }));
        if (row === null) {
            unservedPlantIds.push(...members.map((p) => p.id));
            continue;
        }
        const v = plants.reduce((sum, p) => sum + p.uv.y, 0) / plants.length;
        const tees = crossings(submains, v);
        if (tees.length === 0) {
            unservedPlantIds.push(...members.map((p) => p.id));
            continue;
        }

        // Each plant joins the nearest tee, on the side of it where it stands.
        const runs = new Map<string, { tee: number; side: '-' | '+'; plants: typeof plants }>();
        for (const p of plants) {
            let tee = 0;
            for (let t = 1; t < tees.length; t++) if (Math.abs(p.uv.x - tees[t].u) < Math.abs(p.uv.x - tees[tee].u)) tee = t;
            const side = p.uv.x < tees[tee].u ? '-' : '+';
            const key = `${tee}${side}`;
            if (!runs.has(key)) runs.set(key, { tee, side, plants: [] });
            runs.get(key)!.plants.push(p);
        }

        for (const [key, run] of runs) {
            const { u, submainId } = tees[run.tee];
            const ordered = run.plants.sort((a, b) => Math.abs(a.uv.x - u) - Math.abs(b.uv.x - u));
            generated.push({
                id: `${zone.id}:r${row}:${key}`,
                zoneId: zone.id,
                path: [toLatLng({ x: u, y: v }), toLatLng({ x: ordered[ordered.length - 1].uv.x, y: v })],
                plantIds: ordered.map((p) => p.plant.id),
                pipeId: null,
                submainId,
            });
        }
    }

    const removed = removedLaterals(generated, input.removed, input.rowSpacingM / 4, frame.toLocal);
    for (const lateral of generated) if (removed.has(lateral.id)) unservedPlantIds.push(...lateral.plantIds);

    return { laterals: [...drawn, ...generated.filter((l) => !removed.has(l.id))], unservedPlantIds };
}

/** Drawn laterals of one zone, each with the plants within `reach` of it (a plant joins the nearest). */
function drawnLaterals(zone: LateralInput['zones'][number], pipes: readonly ZonePipe[], reach: number, toLocal: (p: LatLng) => XY): Lateral[] {
    const lines = pipes.map((pipe) => ({ pipe, xy: pipe.path.map(toLocal), plants: [] as { id: string; alongM: number }[] }));
    for (const plant of zone.plants) {
        const xy = toLocal(plant.position);
        let best: { line: (typeof lines)[number]; distance: number; alongM: number } | null = null;
        for (const line of lines) {
            const hit = closestPointOnPath(xy, line.xy)!;
            if (hit.distance <= reach && (!best || hit.distance < best.distance)) best = { line, distance: hit.distance, alongM: hit.alongM };
        }
        best?.line.plants.push({ id: plant.id, alongM: best.alongM });
    }
    return lines.map(({ pipe, plants }) => ({
        id: pipe.id,
        zoneId: pipe.zoneId,
        path: [...pipe.path],
        plantIds: plants.sort((a, b) => a.alongM - b.alongM).map((p) => p.id),
        pipeId: pipe.id,
        submainId: null,
    }));
}

/** Plants grouped by row number, in order of first appearance; hand-placed plants under null. */
function rowsOf(plants: readonly Plant[]): Map<number | null, Plant[]> {
    const rows = new Map<number | null, Plant[]>();
    for (const plant of plants) {
        const row = rows.get(plant.row);
        if (row) row.push(plant);
        else rows.set(plant.row, [plant]);
    }
    return rows;
}

/** Where submains cross the row line v = const (in row coordinates), ordered along the row. */
function crossings(submains: readonly { id: string; uv: XY[] }[], v: number): { u: number; submainId: string }[] {
    const tees: { u: number; submainId: string }[] = [];
    for (const submain of submains) {
        for (let i = 1; i < submain.uv.length; i++) {
            const a = submain.uv[i - 1];
            const b = submain.uv[i];
            // Half-open test, so a vertex lying exactly on the row counts once.
            if (a.y <= v === b.y <= v) continue;
            tees.push({ u: a.x + ((v - a.y) * (b.x - a.x)) / (b.y - a.y), submainId: submain.id });
        }
    }
    return tees.sort((a, b) => a.u - b.u);
}

/** Generated laterals hit by a removed point: for each point, the nearest within `tolerance`. */
function removedLaterals(laterals: readonly Lateral[], points: readonly LatLng[], tolerance: number, toLocal: (p: LatLng) => XY): Set<string> {
    const removed = new Set<string>();
    if (laterals.length === 0) return removed;
    const lines = laterals.map((l) => ({ id: l.id, xy: l.path.map(toLocal) }));
    for (const point of points) {
        const xy = toLocal(point);
        let best: { id: string; distance: number } | null = null;
        for (const line of lines) {
            const { distance } = closestPointOnPath(xy, line.xy)!;
            if (distance <= tolerance && (!best || distance < best.distance)) best = { id: line.id, distance };
        }
        if (best) removed.add(best.id);
    }
    return removed;
}
