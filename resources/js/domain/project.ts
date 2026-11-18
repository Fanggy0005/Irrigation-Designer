import { z } from 'zod';

/**
 * The saved design of one project: everything the designer entered, nothing computed.
 * Plants, flows and pressures are derived from this on every render.
 *
 * Every field has a default, so a new project is `parseProject(null)` and a field added
 * later is filled in when an older design loads. Bump `version` (and migrate) only for
 * changes a default cannot cover, such as renaming or reshaping a field.
 *
 * The ranges here are what the editor's inputs allow; a design outside them will not load.
 */

const latLng = z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
});
const ring = z.array(latLng);
const id = z.string().min(1).max(20);

export const PIPE_KINDS = ['main', 'submain', 'lateral'] as const;

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
            /** Water each plant needs per day, L. 0 = not entered yet. */
            waterLPerDay: z.number().min(0).max(5000).default(0),
        })
        .prefault({}),
    emitter: z
        .object({
            flowLph: z.number().min(0.5).max(5000).default(60),
            /** Operating pressure, m of head. */
            pressureM: z.number().min(1).max(100).default(15),
            perPlant: z.number().int().min(1).max(20).default(1),
        })
        .prefault({}),
    zones: z
        .array(
            z.object({
                id,
                name: z.string().max(100),
                polygon: ring,
                /** Minutes per day; null = the time that gives each plant `planting.waterLPerDay`. */
                runMinutes: z.number().min(0).max(1440).nullable().default(null),
            }),
        )
        .default(() => []),
    /**
     * Mains, submains and laterals the designer drew. Laterals along the rows are generated
     * (see `domain/laterals.ts`), so only hand-drawn ones are stored. Which zone a pipe
     * serves follows from where it lies, so it is not stored either.
     */
    pipes: z
        .array(
            z.object({
                id,
                kind: z.enum(PIPE_KINDS),
                path: ring,
            }),
        )
        .default(() => []),
    laterals: z
        .object({
            /** Points on generated laterals the designer removed (each lateral's midpoint). */
            removed: ring.default(() => []),
        })
        .prefault({}),
    settings: z
        .object({
            /** Largest flow one zone may draw, L/h: the limit automatic zoning works to. */
            maxZoneFlowLph: z.number().min(10).max(1_000_000).default(5000),
        })
        .prefault({}),
});

export type Project = z.infer<typeof projectSchema>;
export type Planting = Project['planting'];
export type Emitter = Project['emitter'];
export type Zone = Project['zones'][number];
export type DesignPipe = Project['pipes'][number];
export type PipeKind = DesignPipe['kind'];
export type Settings = Project['settings'];

/** Reads a saved design (null for a new project). Throws if the data is not a valid design. */
export function parseProject(design: unknown): Project {
    return projectSchema.parse(design ?? {});
}

/** `prefix` followed by one more than the highest number already used with it: z1, z2, … */
export function nextId(prefix: string, existing: readonly { id: string }[]): string {
    let highest = 0;
    for (const { id } of existing) {
        if (!id.startsWith(prefix)) continue;
        const n = Number(id.slice(prefix.length));
        if (Number.isInteger(n) && n > highest) highest = n;
    }
    return `${prefix}${highest + 1}`;
}
