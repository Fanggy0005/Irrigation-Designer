import { COLORS, PIPE_COLORS } from '@/editor/colors';
import { DesignLayers } from '@/editor/map/DesignLayers';
import { PipeLayer } from '@/editor/map/PipeLayer';
import { PlantLayer } from '@/editor/map/PlantLayer';
import { ZoneLayer } from '@/editor/map/ZoneLayer';
import { useEditorStore } from '@/editor/store';
import { MAX_ZOOM, TILE_SOURCES } from '@/map/osm/tileLayers';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useState } from 'react';
import { MapContainer, ScaleControl, TileLayer } from 'react-leaflet';

/**
 * The layout on satellite imagery. The map has a fixed size in millimetres so it prints
 * exactly as it shows; the designer can still pan and zoom it to frame the print.
 */
export function ReportMap() {
    const store = useEditorStore();
    const [bounds] = useState(() => {
        const { boundary, site, pipes } = store.getState().project;
        const points = [...boundary, ...pipes.flatMap((p) => p.path), ...(site.waterSource ? [site.waterSource] : [])];
        return points.length > 0 ? L.latLngBounds(points).pad(0.05) : null;
    });

    if (!bounds) return <p className="text-sm text-gray-600">ยังไม่มีขอบเขตแปลง</p>;

    const imagery = TILE_SOURCES.esriImagery;
    return (
        <div className="grid gap-1">
            <MapContainer bounds={bounds} maxZoom={MAX_ZOOM} zoomControl={false} scrollWheelZoom={false} className="h-[150mm] w-full">
                <TileLayer url={imagery.url} attribution={imagery.attribution} maxNativeZoom={imagery.maxNativeZoom} maxZoom={MAX_ZOOM} />
                <ScaleControl imperial={false} position="bottomright" />
                <DesignLayers />
                <ZoneLayer />
                <PlantLayer />
                <PipeLayer />
            </MapContainer>
            <Legend />
        </div>
    );
}

function Legend() {
    const items = [
        { label: 'แหล่งน้ำ', color: COLORS.waterSource, dot: true },
        { label: 'ท่อเมน', color: PIPE_COLORS.main },
        { label: 'ท่อเมนย่อย', color: PIPE_COLORS.submain },
        { label: 'ท่อแขนง', color: PIPE_COLORS.lateral },
        { label: 'ต้นไม้', color: COLORS.plant, dot: true },
        { label: 'ต้นที่ยังไม่มีท่อแขนง', color: COLORS.unservedPlant, dot: true },
        { label: 'ขอบเขตแปลง', color: COLORS.boundary },
        { label: 'พื้นที่ยกเว้น', color: COLORS.exclusion },
    ];
    return (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            {items.map((item) => (
                <span key={item.label} className="flex items-center gap-1">
                    <span
                        className={item.dot ? 'size-2.5 rounded-full border border-gray-500' : 'h-1 w-5 border border-gray-500'}
                        style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                </span>
            ))}
            <span className="text-gray-600">เส้นประ = ท่อที่ยังไม่ต่อถึงแหล่งน้ำ</span>
        </div>
    );
}
