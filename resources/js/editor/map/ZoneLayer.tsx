import { Polygon, Tooltip } from 'react-leaflet';
import { zoneColor } from '../colors';
import { zoneLabel } from '../labels';
import { useEditor } from '../store';

/** Zone outlines with their names. */
export function ZoneLayer() {
    const zones = useEditor((s) => s.project.zones);
    // While zones are being edited, the editing tool draws them instead.
    const editing = useEditor((s) => s.tool === 'editZones');
    if (editing) return null;

    return zones.map(
        (zone, i) =>
            zone.polygon.length >= 3 && (
                <Polygon
                    key={zone.id}
                    positions={zone.polygon}
                    interactive={false}
                    pathOptions={{ color: zoneColor(i), weight: 2, fillOpacity: 0.12 }}
                >
                    <Tooltip permanent direction="center" opacity={0.85}>
                        {zoneLabel(zone, i)}
                    </Tooltip>
                </Polygon>
            ),
    );
}
