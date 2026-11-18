import { Input } from '@/components/ui/input';
import { type PlaceResult, searchPlaces } from '@/map/osm/geocoding';
import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';

const DEBOUNCE_MS = 350;

/** Search box over the map (Photon, limited to Thailand). Picking a result flies there. */
export function PlaceSearch() {
    const map = useMap();
    const container = useRef<HTMLDivElement>(null);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<PlaceResult[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Clicks and scrolls on the box must not pan or zoom the map underneath.
    useEffect(() => {
        if (!container.current) return;
        L.DomEvent.disableClickPropagation(container.current);
        L.DomEvent.disableScrollPropagation(container.current);
    }, []);

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setResults([]);
            return;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => {
            searchPlaces(q, { signal: controller.signal })
                .then((found) => {
                    setResults(found);
                    setError(null);
                })
                .catch(() => {
                    if (!controller.signal.aborted) setError('ค้นหาไม่สำเร็จ ลองใหม่อีกครั้ง');
                });
        }, DEBOUNCE_MS);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query]);

    const pick = (place: PlaceResult) => {
        map.flyTo(place.location, 17);
        setQuery(place.name);
        setResults([]);
    };

    return (
        <div ref={container} className="absolute top-3 left-14 z-[1000] w-80 max-w-[calc(100%-8rem)]">
            <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาสถานที่ เช่น ตำบล อำเภอ"
                className="bg-background shadow-md"
            />
            {error && <p className="bg-background mt-1 rounded-md p-2 text-sm text-red-600 shadow-md">{error}</p>}
            {results.length > 0 && (
                <ul className="bg-background mt-1 max-h-72 overflow-y-auto rounded-md shadow-md">
                    {results.map((place) => (
                        <li key={place.id}>
                            <button type="button" onClick={() => pick(place)} className="hover:bg-accent w-full px-3 py-2 text-left">
                                <div className="text-sm font-medium">{place.name}</div>
                                <div className="text-muted-foreground text-xs">{place.address}</div>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
