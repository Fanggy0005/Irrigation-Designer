import { type LatLng } from '@/domain/geometry';
import { type Plant } from '@/domain/planting';
import L from 'leaflet';
import { useEffect } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import { usePipeLayout } from '../pipes';
import { usePlantLayout } from '../plants';
import { type Tool, useEditor, useEditorStore } from '../store';

const CLICK_TOOLS: Tool[] = ['placeWaterSource', 'removePlant', 'addPlant', 'removePipe'];
/** How close (in screen pixels) a click must be to a plant or pipe to pick it. */
const PICK_RADIUS_PX = 10;

/** Map clicks for the tools that place or pick single points or pipes. */
export function ClickTool() {
    const map = useMap();
    const store = useEditorStore();
    const tool = useEditor((s) => s.tool);
    const pipes = useEditor((s) => s.project.pipes);
    const { plants } = usePlantLayout();
    const { laterals } = usePipeLayout();

    useEffect(() => {
        map.getContainer().style.cursor = CLICK_TOOLS.includes(tool) ? 'crosshair' : '';
    }, [map, tool]);

    useMapEvents({
        click(e) {
            const position = { lat: e.latlng.lat, lng: e.latlng.lng };
            const state = store.getState();
            if (tool === 'placeWaterSource') {
                state.setWaterSource(position);
                state.setTool('none');
            } else if (tool === 'addPlant') {
                state.addPlant(position);
            } else if (tool === 'removePlant') {
                const plant = nearestPlant(map, plants, e.containerPoint);
                if (!plant) return;
                if (plant.row === null) state.removeAddedPlant(Number(plant.id.slice(1)));
                else state.removeGeneratedPlant(plant.position);
            } else if (tool === 'removePipe') {
                // Drawn pipes and generated laterals; a generated lateral is removed by its midpoint.
                const candidates = [
                    ...pipes.map((pipe) => ({ path: pipe.path, remove: () => state.removePipe(pipe.id) })),
                    ...laterals
                        .filter((l) => l.pipeId === null)
                        .map((l) => ({ path: l.path, remove: () => state.removeGeneratedLateral(midpoint(l.path[0], l.path[1])) })),
                ];
                nearestPath(map, candidates, e.containerPoint)?.remove();
            }
        },
    });

    return null;
}

function nearestPlant(map: L.Map, plants: Plant[], click: L.Point): Plant | null {
    let best: Plant | null = null;
    let bestDistance = PICK_RADIUS_PX;
    for (const plant of plants) {
        const distance = map.latLngToContainerPoint(plant.position).distanceTo(click);
        if (distance <= bestDistance) {
            best = plant;
            bestDistance = distance;
        }
    }
    return best;
}

function nearestPath<T extends { path: LatLng[] }>(map: L.Map, items: T[], click: L.Point): T | null {
    let best: T | null = null;
    let bestDistance = PICK_RADIUS_PX;
    for (const item of items) {
        const points = item.path.map((p) => map.latLngToContainerPoint(p));
        for (let i = 1; i < points.length; i++) {
            const distance = L.LineUtil.pointToSegmentDistance(click, points[i - 1], points[i]);
            if (distance <= bestDistance) {
                best = item;
                bestDistance = distance;
            }
        }
    }
    return best;
}

/** Halfway between two points a farm's width apart: averaging the coordinates is exact enough. */
function midpoint(a: LatLng, b: LatLng): LatLng {
    return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}
