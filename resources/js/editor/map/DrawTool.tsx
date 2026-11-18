import { type LatLng } from '@/domain/geometry';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import L from 'leaflet';
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { useEditor, useEditorStore } from '../store';
import { COLORS } from './DesignLayers';

const toRing = (polygon: L.Polygon): LatLng[] => (polygon.getLatLngs() as L.LatLng[][])[0].map(({ lat, lng }) => ({ lat, lng }));

/** Polygon drawing and vertex editing (Leaflet-Geoman), driven by the editor's current tool. */
export function DrawTool() {
    const map = useMap();
    const store = useEditorStore();
    const tool = useEditor((s) => s.tool);

    useEffect(() => {
        // Geoman has no Thai; override the English tooltips this app shows.
        map.pm.setLang('en', {
            tooltips: {
                firstVertex: 'คลิกเพื่อวางจุดมุมแรก',
                continueLine: 'คลิกเพื่อวางจุดมุมถัดไป',
                finishPoly: 'คลิกที่จุดแรกเพื่อปิดรูป',
            },
        });
    }, [map]);

    useEffect(() => {
        if (tool !== 'drawBoundary' && tool !== 'drawExclusion') return;
        const color = tool === 'drawBoundary' ? COLORS.boundary : COLORS.exclusion;

        const onCreate: L.PM.CreateEventHandler = ({ layer }) => {
            const ring = toRing(layer as L.Polygon);
            layer.remove(); // the store's copy is drawn by DesignLayers
            const { setBoundary, addExclusion, setTool } = store.getState();
            if (tool === 'drawBoundary') setBoundary(ring);
            else addExclusion(ring);
            setTool('none');
        };

        map.on('pm:create', onCreate);
        map.pm.enableDraw('Polygon', {
            allowSelfIntersection: false,
            templineStyle: { color },
            hintlineStyle: { color, dashArray: '5 5' },
            pathOptions: { color },
        });
        return () => {
            map.off('pm:create', onCreate);
            map.pm.disableDraw();
        };
    }, [map, store, tool]);

    useEffect(() => {
        if (tool !== 'editBoundary') return;

        const layer = L.polygon(store.getState().project.boundary, { color: COLORS.boundary, weight: 3, fillOpacity: 0.05 }).addTo(map);
        layer.pm.enable({ allowSelfIntersection: false });
        // The edit is saved when the tool is switched off (the "done" button or another tool).
        return () => {
            const ring = toRing(layer);
            layer.pm.disable();
            layer.remove();
            store.getState().setBoundary(ring);
        };
    }, [map, store, tool]);

    return null;
}
