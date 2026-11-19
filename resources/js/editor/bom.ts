import { type Bom, billOfMaterials } from '@/domain/bom';
import { type HydraulicsResult } from '@/domain/hydraulics/designHydraulics';
import { type Project } from '@/domain/project';
import { useHydraulics } from './hydraulics';
import { memoizeLast } from './memo';
import { type PipeLayout, usePipeLayout } from './pipes';
import { useEditor } from './store';

/** Bill of materials for the current design, with the sizes the hydraulics settled on. Null until those exist. */
export function useBom(): Bom | null {
    const { result } = useHydraulics();
    const layout = usePipeLayout();
    const pipes = useEditor((s) => s.project.pipes);
    const perPlant = useEditor((s) => s.project.emitter.perPlant);
    const pieceLengthM = useEditor((s) => s.project.bom.pieceLengthM);
    return compute(result, layout, pipes, perPlant, pieceLengthM);
}

const compute = memoizeLast(
    (result: HydraulicsResult | null, layout: PipeLayout, pipes: Project['pipes'], perPlant: number, pieceLengthM: Record<string, number>) =>
        result &&
        billOfMaterials({
            pipes,
            pipeSpecs: Object.fromEntries(pipes.map((p) => [p.id, result.pipes[p.id].spec])),
            laterals: layout.laterals,
            lateralSpec: result.laterals.spec,
            connections: layout.connections,
            emittersPerPlant: perPlant,
            pieceLengthM,
        }),
);
