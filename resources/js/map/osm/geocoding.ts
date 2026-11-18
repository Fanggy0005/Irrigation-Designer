/**
 * Place search and reverse geocoding backed by Photon (https://photon.komoot.io),
 * which serves OpenStreetMap data and, unlike Nominatim, permits search-as-you-type.
 * The public instance is fair-use only: callers should debounce and abort stale requests.
 */
import type { LatLng } from '@/domain/geometry';

const PHOTON_BASE_URL = 'https://photon.komoot.io';

/** minLon,minLat,maxLon,maxLat — keeps results inside Thailand, like Google's country restriction. */
const THAILAND_BBOX = '97.3,5.6,105.7,20.5';

/**
 * Photon otherwise follows the browser's Accept-Language and answers English browsers with
 * English names; "default" returns the local (Thai) names to match the Thai UI.
 */
const RESULT_LANGUAGE = 'default';

export interface PlaceResult {
    id: string;
    name: string;
    /** Full address, most specific part first. */
    address: string;
    location: LatLng;
}

interface PhotonProperties {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    housenumber?: string;
    street?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
}

interface PhotonFeature {
    geometry: { coordinates: [number, number] };
    properties: PhotonProperties;
}

interface PhotonResponse {
    features: PhotonFeature[];
}

interface RequestOptions {
    signal?: AbortSignal;
}

function formatAddress(p: PhotonProperties): string {
    const street = [p.housenumber, p.street].filter(Boolean).join(' ');
    const parts = [p.name, street, p.district, p.city, p.county, p.state, p.postcode];
    // OSM often repeats a name across levels (e.g. district and city both "บ้านแพ้ว").
    return parts.filter((part, i) => part && parts.indexOf(part) === i).join(', ');
}

function toPlaceResult(feature: PhotonFeature): PlaceResult {
    const [lng, lat] = feature.geometry.coordinates;
    const p = feature.properties;
    return {
        id: p.osm_type && p.osm_id ? `${p.osm_type}${p.osm_id}` : `${lat},${lng}`,
        name: p.name || p.street || 'ตำแหน่งที่เลือก',
        address: formatAddress(p),
        location: { lat, lng },
    };
}

async function fetchPhoton(path: string, params: URLSearchParams, signal?: AbortSignal) {
    const response = await fetch(`${PHOTON_BASE_URL}${path}?${params}`, { signal });
    if (!response.ok) {
        throw new Error(`Place search failed (HTTP ${response.status})`);
    }
    return ((await response.json()) as PhotonResponse).features;
}

export async function searchPlaces(query: string, { signal, limit = 6 }: RequestOptions & { limit?: number } = {}): Promise<PlaceResult[]> {
    const params = new URLSearchParams({
        q: query,
        limit: String(limit),
        bbox: THAILAND_BBOX,
        lang: RESULT_LANGUAGE,
    });
    const features = await fetchPhoton('/api/', params, signal);
    // OSM often has several objects for one place (e.g. a district and its town) that read
    // identically in a list; keep the first (best-ranked) of each.
    const unique = new Map<string, PlaceResult>();
    for (const place of features.map(toPlaceResult)) {
        const key = `${place.name}|${place.address}`;
        if (!unique.has(key)) unique.set(key, place);
    }
    return [...unique.values()];
}

/** Returns the nearest known address, or an empty string when there is none. */
export async function reverseGeocode(location: LatLng, { signal }: RequestOptions = {}): Promise<string> {
    const params = new URLSearchParams({
        lat: String(location.lat),
        lon: String(location.lng),
        lang: RESULT_LANGUAGE,
    });
    const [nearest] = await fetchPhoton('/reverse', params, signal);
    return nearest ? formatAddress(nearest.properties) : '';
}
