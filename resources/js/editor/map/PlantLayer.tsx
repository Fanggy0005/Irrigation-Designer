import L from 'leaflet';
import { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import { COLORS } from '../colors';
import { usePipeLayout } from '../pipes';
import { usePlantLayout } from '../plants';
import { useEditor } from '../store';

/**
 * Plants drawn on their own canvas. An orchard can have tens of thousands of plants;
 * plain Leaflet markers on a canvas handle that, one React element per plant would not.
 *
 * Once the designer has drawn a submain, plants in a zone that no lateral reaches are
 * outlined in red.
 */
export function PlantLayer() {
    const map = useMap();
    const { plants } = usePlantLayout();
    const { unservedPlantIds } = usePipeLayout();
    const hasSubmain = useEditor((s) => s.project.pipes.some((p) => p.kind === 'submain'));
    const [renderer] = useState(() => L.canvas({ padding: 0.5 }));

    useEffect(() => {
        const group = L.layerGroup(
            plants.map((plant) => {
                const unserved = hasSubmain && unservedPlantIds.has(plant.id);
                return L.circleMarker(plant.position, {
                    renderer,
                    interactive: false,
                    // Snapping to thousands of plants would slow drawing down, and pipes don't end on plants.
                    snapIgnore: true,
                    radius: unserved ? 4 : 3,
                    weight: unserved ? 2 : 1,
                    color: unserved ? COLORS.unservedPlant : '#14532d',
                    fillColor: plant.row === null ? COLORS.addedPlant : COLORS.plant,
                    fillOpacity: 1,
                });
            }),
        );
        group.addTo(map);
        return () => {
            group.remove();
        };
    }, [map, plants, renderer, hasSubmain, unservedPlantIds]);

    return null;
}
