import { type LatLng, localFrame, pointInRing, pointsAlongPath, type XY } from './geometry';
import { type Plant } from './planting';

export type ZoneShape = { id: string; polygon: readonly LatLng[] };

export type ZonePlants = {
    /** Every zone, in the order given, with the plants it waters. */
    zones: { id: string; plants: Plant[] }[];
    /** Plants outside every zone. */
    unzoned: Plant[];
};

/**
 * Puts each plant in the first zone whose outline contains it. Zones may overlap; the
 * earlier zone then gets the shared plants.
 */
export function assignPlantsToZones(plants: readonly Plant[], zones: readonly ZoneShape[]): ZonePlants {
    const outlines = zoneOutlines(zones);
    const byZone = new Map<string, Plant[]>(zones.map((z) => [z.id, []]));
    const unzoned: Plant[] = [];

    for (const plant of plants) {
        const zoneId = outlines?.find(plant.position);
        if (zoneId) byZone.get(zoneId)!.push(plant);
        else unzoned.push(plant);
    }
    return { zones: zones.map((z) => ({ id: z.id, plants: byZone.get(z.id)! })), unzoned };
}

/** Points sampled along a pipe to decide which zone it lies in. */
const PATH_SAMPLES = 21;

/**
 * The zone a pipe serves: the one holding most of its length. Its ends often lie outside
 * (a submain starts on the main at the zone's edge), so the whole line is sampled rather
 * than one point. Ties go to the earlier zone. Null when the pipe is in no zone.
 */
export function zoneOfPath(path: readonly LatLng[], zones: readonly ZoneShape[]): string | null {
    const outlines = zoneOutlines(zones);
    if (!outlines || path.length === 0) return null;

    const hits = new Map<string, number>();
    for (const p of pointsAlongPath(path.map(outlines.frame.toLocal), PATH_SAMPLES)) {
        const zoneId = outlines.findLocal(p);
        if (zoneId) hits.set(zoneId, (hits.get(zoneId) ?? 0) + 1);
    }

    let best: string | null = null;
    for (const zone of zones) {
        const n = hits.get(zone.id) ?? 0;
        if (n > 0 && (best === null || n > hits.get(best)!)) best = zone.id;
    }
    return best;
}

/** Zone outlines in one local frame, with bounding boxes to skip most containment tests. */
function zoneOutlines(zones: readonly ZoneShape[]) {
    const valid = zones.filter((z) => z.polygon.length >= 3);
    if (valid.length === 0) return null;

    const frame = localFrame(valid[0].polygon[0]);
    const outlines = valid.map((z) => {
        const ring = z.polygon.map(frame.toLocal);
        const xs = ring.map((p) => p.x);
        const ys = ring.map((p) => p.y);
        return { id: z.id, ring, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
    });

    const findLocal = (p: XY): string | null =>
        outlines.find((o) => p.x >= o.minX && p.x <= o.maxX && p.y >= o.minY && p.y <= o.maxY && pointInRing(p, o.ring))?.id ?? null;

    return { frame, findLocal, find: (p: LatLng) => findLocal(frame.toLocal(p)) };
}
