import { type Plant } from '@/domain/planting';
import type L from 'leaflet';
import { useEffect } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import { usePlantLayout } from '../plants';
import { type Tool, useEditor, useEditorStore } from '../store';

const CLICK_TOOLS: Tool[] = ['placeWaterSource', 'removePlant', 'addPlant'];
/** How close (in screen pixels) a click must be to a plant to pick it. */
const PICK_RADIUS_PX = 10;

/** Map clicks for the tools that place or pick single points. */
export function ClickTool() {
    const map = useMap();
    const store = useEditorStore();
    const tool = useEditor((s) => s.tool);
    const { plants } = usePlantLayout();

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
