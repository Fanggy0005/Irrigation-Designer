import { type LatLng } from '@/domain/geometry';
import { type Lateral, layoutLaterals } from '@/domain/laterals';
import { connectPipes, missedJoints, type PipeConnection } from '@/domain/pipes';
import { type Project } from '@/domain/project';
import { zoneOfPath, type ZonePlants } from '@/domain/zones';
import { memoizeLast } from './memo';
import { useEditor } from './store';
import { useZonePlants } from './zones';

export type PipeLayout = {
    /** How each connected pipe gets its water; pipes missing here are not connected. */
    connections: Record<string, PipeConnection>;
    /** Unconnected pipes that cross a pipe they could take water from: pipe id → the pipe crossed. */
    missedJoints: Record<string, string>;
    /** Zone of each submain and drawn lateral (null when it lies in no zone). */
    pipeZones: Record<string, string | null>;
    /** Drawn and generated laterals in every zone. */
    laterals: Lateral[];
    unservedPlantIds: Set<string>;
};

/** Laterals and pipe connections for the current design, shared like `usePlantLayout`. */
export function usePipeLayout(): PipeLayout {
    const zonePlants = useZonePlants();
    const zones = useEditor((s) => s.project.zones);
    const pipes = useEditor((s) => s.project.pipes);
    const waterSource = useEditor((s) => s.project.site.waterSource);
    const planting = useEditor((s) => s.project.planting);
    const removed = useEditor((s) => s.project.laterals.removed);
    return computePipeLayout(zonePlants, zones, pipes, waterSource, planting, removed);
}

const computePipeLayout = memoizeLast(
    (
        zonePlants: ZonePlants,
        zones: Project['zones'],
        pipes: Project['pipes'],
        waterSource: LatLng | null,
        planting: Project['planting'],
        removed: LatLng[],
    ): PipeLayout => {
        const pipeZones: Record<string, string | null> = {};
        for (const pipe of pipes) if (pipe.kind !== 'main') pipeZones[pipe.id] = zoneOfPath(pipe.path, zones);

        const inZone = (kind: 'submain' | 'lateral') =>
            pipes.flatMap((p) => {
                const zoneId = pipeZones[p.id];
                return p.kind === kind && zoneId ? [{ id: p.id, zoneId, path: p.path }] : [];
            });

        const { laterals, unservedPlantIds } = layoutLaterals({
            zones: zonePlants.zones,
            submains: inZone('submain'),
            drawnLaterals: inZone('lateral'),
            rowBearingDeg: planting.rowBearingDeg,
            spacingM: planting.spacingM,
            rowSpacingM: planting.rowSpacingM,
            removed,
        });

        const connections = connectPipes(waterSource, pipes);
        return {
            connections,
            missedJoints: missedJoints(waterSource, pipes, connections),
            pipeZones,
            laterals,
            unservedPlantIds: new Set(unservedPlantIds),
        };
    },
);
