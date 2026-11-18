import { BaseLayers } from '@/map/BaseLayers';
import { MAX_ZOOM } from '@/map/osm/tileLayers';
import { PlaceSearch } from '@/map/PlaceSearch';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useState } from 'react';
import { MapContainer, ScaleControl } from 'react-leaflet';
import { useEditorStore } from '../store';
import { ClickTool } from './ClickTool';
import { DesignLayers } from './DesignLayers';
import { DrawTool } from './DrawTool';
import { PipeLayer } from './PipeLayer';
import { PlantLayer } from './PlantLayer';
import { ZoneLayer } from './ZoneLayer';

const THAILAND = { center: L.latLng(13.5, 101), zoom: 6 };

export function EditorMap() {
    const store = useEditorStore();
    // Only the first render picks the view; after that the designer moves the map.
    const [initialView] = useState(() => {
        const { boundary, site } = store.getState().project;
        if (boundary.length >= 3) return { bounds: L.latLngBounds(boundary).pad(0.1) };
        if (site.waterSource) return { center: L.latLng(site.waterSource), zoom: 17 };
        return THAILAND;
    });

    return (
        <MapContainer {...initialView} maxZoom={MAX_ZOOM} className="h-full w-full">
            <BaseLayers />
            <ScaleControl imperial={false} position="bottomright" />
            <PlaceSearch />
            <DesignLayers />
            <ZoneLayer />
            <PlantLayer />
            <PipeLayer />
            <DrawTool />
            <ClickTool />
        </MapContainer>
    );
}
