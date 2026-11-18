import { z } from 'zod';

/**
 * The saved design of one project: everything the designer entered, nothing computed.
 * Plants, flows and pressures are derived from this on every render.
 *
 * Every field has a default, so a new project is `parseProject(null)` and a field added
 * later is filled in when an older design loads. Bump `version` (and migrate) only for
 * changes a default cannot cover, such as renaming or reshaping a field.
 */

const latLng = z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
});
const ring = z.array(latLng);

export const projectSchema = z.object({
    version: z.literal(1).default(1),
    site: z
        .object({
            waterSource: latLng.nullable().default(null),
        })
        .prefault({}),
    boundary: ring.default(() => []),
    exclusions: z.array(ring).default(() => []),
    planting: z
        .object({
            plantName: z.string().max(100).default(''),
            spacingM: z.number().min(0.5).max(50).default(6),
            rowSpacingM: z.number().min(0.5).max(50).default(6),
            rowBearingDeg: z.number().min(0).max(180).default(0),
            staggered: z.boolean().default(false),
            edgeSetbackM: z.number().min(0).max(50).default(1),
            removed: ring.default(() => []),
            added: ring.default(() => []),
        })
        .prefault({}),
});

export type Project = z.infer<typeof projectSchema>;
export type Planting = Project['planting'];

/** Reads a saved design (null for a new project). Throws if the data is not a valid design. */
export function parseProject(design: unknown): Project {
    return projectSchema.parse(design ?? {});
}
