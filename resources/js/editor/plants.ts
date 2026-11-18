import { layoutPlants, type Plant, TooManyPlantsError } from '@/domain/planting';
import { type Project } from '@/domain/project';
import { memoizeLast } from './memo';
import { useEditor } from './store';

export type PlantLayoutResult = { plants: Plant[]; error: string | null };

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

const computeLayout = memoizeLast(
    (boundary: Project['boundary'], exclusions: Project['exclusions'], planting: Project['planting']): PlantLayoutResult => {
        try {
            return { plants: layoutPlants(boundary, exclusions, planting, planting), error: null };
        } catch (error) {
            if (!(error instanceof TooManyPlantsError)) throw error;
            return {
                plants: [],
                error: `ระยะปลูกนี้จะได้ต้นไม้ประมาณ ${Math.round(error.estimate).toLocaleString()} ต้น เกินขีดจำกัด กรุณาตรวจระยะปลูก`,
            };
        }
    },
);
