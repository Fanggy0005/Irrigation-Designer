import { BASE_LAYER_NAMES, type BaseLayerId, MAX_ZOOM, TILE_SOURCES, type TileSource } from '@/map/osm/tileLayers';
import { LayerGroup, LayersControl, TileLayer } from 'react-leaflet';

const Tiles = ({ source }: { source: TileSource }) => (
    <TileLayer url={source.url} attribution={source.attribution} maxNativeZoom={source.maxNativeZoom} maxZoom={MAX_ZOOM} />
);

/**
 * Base-map switcher for a react-leaflet MapContainer. "hybrid" stacks road and
 * place-name overlays on the satellite imagery.
 */
export function BaseLayers({ defaultLayer = 'hybrid' }: { defaultLayer?: BaseLayerId }) {
    return (
        <LayersControl position="topright">
            <LayersControl.BaseLayer name={BASE_LAYER_NAMES.hybrid} checked={defaultLayer === 'hybrid'}>
                <LayerGroup>
                    <Tiles source={TILE_SOURCES.esriImagery} />
                    <Tiles source={TILE_SOURCES.esriTransportation} />
                    <Tiles source={TILE_SOURCES.esriLabels} />
                </LayerGroup>
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name={BASE_LAYER_NAMES.satellite} checked={defaultLayer === 'satellite'}>
                <Tiles source={TILE_SOURCES.esriImagery} />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name={BASE_LAYER_NAMES.street} checked={defaultLayer === 'street'}>
                <Tiles source={TILE_SOURCES.osmStreet} />
            </LayersControl.BaseLayer>
        </LayersControl>
    );
}
