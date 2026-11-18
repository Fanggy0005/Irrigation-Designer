import { type Plant } from '@/domain/planting';
import { type Project } from '@/domain/project';
import { assignPlantsToZones, type ZonePlants } from '@/domain/zones';
import { memoizeLast } from './memo';
import { usePlantLayout } from './plants';
import { useEditor } from './store';

/** Which plants each zone waters, shared like `usePlantLayout`. */
export function useZonePlants(): ZonePlants {
    const { plants } = usePlantLayout();
    const zones = useEditor((s) => s.project.zones);
    return computeZonePlants(plants, zones);
}

const computeZonePlants = memoizeLast((plants: Plant[], zones: Project['zones']) => assignPlantsToZones(plants, zones));
