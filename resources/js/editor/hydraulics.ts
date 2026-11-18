import { PIPE_SPECS, SUGGESTED_SERIES } from '@/domain/data/pipes';
import { type LatLng } from '@/domain/geometry';
import { analyseHydraulics, type HydraulicsResult } from '@/domain/hydraulics/designHydraulics';
import { type Plant } from '@/domain/planting';
import { type Project } from '@/domain/project';
import { memoizeLast } from './memo';
import { type PipeLayout, usePipeLayout } from './pipes';
import { usePlantLayout } from './plants';
import { useEditor } from './store';

export type HydraulicsState = { result: HydraulicsResult | null; error: string | null };

/**
 * Pipe sizes and each zone's pressures for the current design, recomputed live as the
 * design changes and shared like `usePlantLayout`. Null until there is a water source.
 */
export function useHydraulics(): HydraulicsState {
    const { plants } = usePlantLayout();
    const pipeLayout = usePipeLayout();
    const site = useEditor((s) => s.project.site);
    const pipes = useEditor((s) => s.project.pipes);
    const zones = useEditor((s) => s.project.zones);
    const emitter = useEditor((s) => s.project.emitter);
    const settings = useEditor((s) => s.project.settings);
    return compute(plants, pipeLayout, site, pipes, zones, emitter, settings);
}

const compute = memoizeLast(
    (
        plants: Plant[],
        layout: PipeLayout,
        site: Project['site'],
        pipes: Project['pipes'],
        zones: Project['zones'],
        emitter: Project['emitter'],
        settings: Project['settings'],
    ): HydraulicsState => {
        const waterSource: LatLng | null = site.waterSource;
        if (!waterSource) return { result: null, error: null };
        try {
            const result = analyseHydraulics({
                waterSource,
                sourceElevationM: site.sourceElevationM,
                pipes,
                connections: layout.connections,
                pipeZones: layout.pipeZones,
                zones,
                laterals: layout.laterals,
                plantPositions: new Map(plants.map((p) => [p.id, p.position])),
                emitter,
                lateralSpecId: settings.lateralSpecId,
                settings,
                catalog: PIPE_SPECS,
                suggestedSeries: SUGGESTED_SERIES,
            });
            return { result, error: null };
        } catch (error) {
            // Keep the rest of the editor usable; the panel shows what went wrong.
            console.error(error);
            return { result: null, error: error instanceof Error ? error.message : String(error) };
        }
    },
);
