/**
 * Base map tiles used in place of Google Maps' map types.
 *
 * OpenStreetMap has no satellite imagery, so satellite views come from Esri World Imagery
 * (free, no API key, attribution required). Before heavy commercial traffic, review Esri's
 * terms and the OSM tile usage policy (https://operations.osmfoundation.org/policies/tiles/).
 */

export type BaseLayerId = 'hybrid' | 'satellite' | 'street';

export interface TileSource {
    url: string;
    attribution: string;
    /** Highest zoom the server has tiles for; Leaflet upscales beyond it. */
    maxNativeZoom: number;
}

/** Lets users zoom past the imagery's native resolution when laying out small plots. */
export const MAX_ZOOM = 21;

const ESRI_ATTRIBUTION =
    'Tiles &copy; <a href="https://www.esri.com">Esri</a> &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const ESRI_BASE = 'https://server.arcgisonline.com/ArcGIS/rest/services';

export const TILE_SOURCES = {
    esriImagery: {
        url: `${ESRI_BASE}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
        attribution: ESRI_ATTRIBUTION,
        maxNativeZoom: 19,
    },
    esriTransportation: {
        url: `${ESRI_BASE}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`,
        attribution: ESRI_ATTRIBUTION,
        maxNativeZoom: 19,
    },
    esriLabels: {
        url: `${ESRI_BASE}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
        attribution: ESRI_ATTRIBUTION,
        maxNativeZoom: 19,
    },
    osmStreet: {
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: OSM_ATTRIBUTION,
        maxNativeZoom: 19,
    },
} satisfies Record<string, TileSource>;

export const BASE_LAYER_NAMES: Record<BaseLayerId, string> = {
    hybrid: 'ดาวเทียม + ชื่อสถานที่',
    satellite: 'ดาวเทียม',
    street: 'แผนที่ถนน',
};
