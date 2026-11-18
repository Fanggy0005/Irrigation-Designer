import { layoutPlants, type Plant, TooManyPlantsError } from '@/domain/planting';
import { type Project } from '@/domain/project';
import { useEditor } from './store';

export type PlantLayoutResult = { plants: Plant[]; error: string | null };

let last: { boundary: unknown; exclusions: unknown; planting: unknown; result: PlantLayoutResult } | null = null;

/**
 * The current plants, computed once per change of the design and shared by every
 * component that asks (the map layer and the side panel).
 */
export function usePlantLayout(): PlantLayoutResult {
    const boundary = useEditor((s) => s.project.boundary);
    const exclusions = useEditor((s) => s.project.exclusions);
    const planting = useEditor((s) => s.project.planting);
    return computeLayout(boundary, exclusions, planting);
}

function computeLayout(boundary: Project['boundary'], exclusions: Project['exclusions'], planting: Project['planting']): PlantLayoutResult {
    if (last && last.boundary === boundary && last.exclusions === exclusions && last.planting === planting) return last.result;

    let result: PlantLayoutResult;
    try {
        result = { plants: layoutPlants(boundary, exclusions, planting, planting), error: null };
    } catch (error) {
        if (!(error instanceof TooManyPlantsError)) throw error;
        result = {
            plants: [],
            error: `ระยะปลูกนี้จะได้ต้นไม้ประมาณ ${Math.round(error.estimate).toLocaleString()} ต้น เกินขีดจำกัด กรุณาตรวจระยะปลูก`,
        };
    }
    last = { boundary, exclusions, planting, result };
    return result;
}
