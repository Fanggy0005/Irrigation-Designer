import L from 'leaflet';
import { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import { usePlantLayout } from '../plants';
import { COLORS } from './DesignLayers';

/**
 * Plants drawn on their own canvas. An orchard can have tens of thousands of plants;
 * plain Leaflet markers on a canvas handle that, one React element per plant would not.
 */
export function PlantLayer() {
    const map = useMap();
    const { plants } = usePlantLayout();
    const [renderer] = useState(() => L.canvas({ padding: 0.5 }));

    useEffect(() => {
        const group = L.layerGroup(
            plants.map((plant) =>
                L.circleMarker(plant.position, {
                    renderer,
                    interactive: false,
                    radius: 3,
                    weight: 1,
                    color: '#14532d',
                    fillColor: plant.row === null ? COLORS.addedPlant : COLORS.plant,
                    fillOpacity: 1,
                }),
            ),
        );
        group.addTo(map);
        return () => {
            group.remove();
        };
    }, [map, plants, renderer]);

    return null;
}
