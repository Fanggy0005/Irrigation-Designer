import { CircleMarker, Polygon, Tooltip } from 'react-leaflet';
import { useEditor } from '../store';

export const COLORS = {
    boundary: '#facc15',
    exclusion: '#ef4444',
    waterSource: '#2563eb',
    plant: '#22c55e',
    addedPlant: '#22d3ee',
};

/** Boundary, excluded areas and water source as drawn by the designer. */
export function DesignLayers() {
    const boundary = useEditor((s) => s.project.boundary);
    const exclusions = useEditor((s) => s.project.exclusions);
    const waterSource = useEditor((s) => s.project.site.waterSource);
    // While the boundary is being edited, the editing tool draws it instead.
    const editingBoundary = useEditor((s) => s.tool === 'editBoundary');

    return (
        <>
            {boundary.length >= 3 && !editingBoundary && (
                <Polygon positions={boundary} interactive={false} pathOptions={{ color: COLORS.boundary, weight: 3, fillOpacity: 0.05 }} />
            )}
            {exclusions.map((ring, i) => (
                <Polygon
                    key={i}
                    positions={ring}
                    interactive={false}
                    pathOptions={{ color: COLORS.exclusion, weight: 2, dashArray: '6 4', fillOpacity: 0.25 }}
                />
            ))}
            {waterSource && (
                <CircleMarker
                    center={waterSource}
                    radius={8}
                    pathOptions={{ color: '#ffffff', weight: 2, fillColor: COLORS.waterSource, fillOpacity: 1 }}
                >
                    <Tooltip permanent direction="right" offset={[10, 0]}>
                        แหล่งน้ำ
                    </Tooltip>
                </CircleMarker>
            )}
        </>
    );
}
