import { type LatLng } from '@/domain/geometry';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import L from 'leaflet';
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { COLORS, PIPE_COLORS, PIPE_WEIGHTS, zoneColor } from '../colors';
import { type EditorState, type Tool, useEditor, useEditorStore } from '../store';

type DrawSpec = {
    shape: 'Polygon' | 'Line';
    color: string;
    /** Stay in the tool after each shape, to draw several in a row. */
    repeat: boolean;
    finish: (state: EditorState, path: LatLng[]) => void;
};

const DRAW: Partial<Record<Tool, DrawSpec>> = {
    drawBoundary: { shape: 'Polygon', color: COLORS.boundary, repeat: false, finish: (s, ring) => s.setBoundary(ring) },
    drawExclusion: { shape: 'Polygon', color: COLORS.exclusion, repeat: false, finish: (s, ring) => s.addExclusion(ring) },
    drawZone: { shape: 'Polygon', color: COLORS.zone, repeat: true, finish: (s, ring) => s.addZone(ring) },
    drawMain: { shape: 'Line', color: PIPE_COLORS.main, repeat: true, finish: (s, path) => s.addPipe('main', path) },
    drawSubmain: { shape: 'Line', color: PIPE_COLORS.submain, repeat: true, finish: (s, path) => s.addPipe('submain', path) },
    drawLateral: { shape: 'Line', color: PIPE_COLORS.lateral, repeat: true, finish: (s, path) => s.addPipe('lateral', path) },
};

type EditShape = { key: string; path: LatLng[]; closed: boolean; color: string; weight: number };

type EditSpec = {
    shapes: (state: EditorState) => EditShape[];
    save: (state: EditorState, paths: ReadonlyMap<string, LatLng[]>) => void;
};

const EDIT: Partial<Record<Tool, EditSpec>> = {
    editBoundary: {
        shapes: (s) => [{ key: 'boundary', path: s.project.boundary, closed: true, color: COLORS.boundary, weight: 3 }],
        save: (s, paths) => s.setBoundary(paths.get('boundary')!),
    },
    editZones: {
        shapes: (s) => s.project.zones.map((z, i) => ({ key: z.id, path: z.polygon, closed: true, color: zoneColor(i), weight: 2 })),
        save: (s, paths) => s.setZonePolygons(paths),
    },
    editPipes: {
        shapes: (s) =>
            s.project.pipes.map((p) => ({ key: p.id, path: p.path, closed: false, color: PIPE_COLORS[p.kind], weight: PIPE_WEIGHTS[p.kind] })),
        save: (s, paths) => s.setPipePaths(paths),
    },
};

/** Polygon and line drawing and vertex editing (Leaflet-Geoman), driven by the editor's current tool. */
export function DrawTool() {
    const map = useMap();
    const store = useEditorStore();
    const tool = useEditor((s) => s.tool);

    useEffect(() => {
        // Geoman has no Thai; override the English tooltips this app shows.
        map.pm.setLang('en', {
            tooltips: {
                firstVertex: 'คลิกเพื่อวางจุดแรก',
                continueLine: 'คลิกเพื่อวางจุดถัดไป',
                finishPoly: 'คลิกที่จุดแรกเพื่อปิดรูป',
                finishLine: 'ดับเบิลคลิก หรือคลิกที่จุดสุดท้ายเพื่อจบเส้น',
            },
        });
    }, [map]);

    useEffect(() => {
        const spec = DRAW[tool];
        if (!spec) return;

        const onCreate: L.PM.CreateEventHandler = ({ layer }) => {
            const path = withoutRepeats(readPath(layer as L.Polyline));
            layer.remove(); // the store's copy is drawn by the design layers
            const state = store.getState();
            if (path.length >= (spec.shape === 'Polygon' ? 3 : 2)) spec.finish(state, path);
            if (!spec.repeat) state.setTool('none');
        };

        map.on('pm:create', onCreate);
        map.pm.enableDraw(spec.shape, {
            allowSelfIntersection: spec.shape === 'Line',
            continueDrawing: spec.repeat,
            finishOn: spec.shape === 'Line' ? 'dblclick' : null,
            templineStyle: { color: spec.color },
            hintlineStyle: { color: spec.color, dashArray: '5 5' },
            pathOptions: { color: spec.color },
        });
        return () => {
            map.off('pm:create', onCreate);
            map.pm.disableDraw();
        };
    }, [map, store, tool]);

    useEffect(() => {
        const spec = EDIT[tool];
        if (!spec) return;

        const layers = spec
            .shapes(store.getState())
            .filter((shape) => shape.path.length >= (shape.closed ? 3 : 2))
            .map((shape) => {
                const style = { color: shape.color, weight: shape.weight, fillOpacity: 0.05 };
                const layer = shape.closed ? L.polygon(shape.path, style) : L.polyline(shape.path, style);
                layer.addTo(map);
                layer.pm.enable({ allowSelfIntersection: !shape.closed });
                return { key: shape.key, layer };
            });
        // The edit is saved when the tool is switched off (the "done" button or another tool).
        return () => {
            const paths = new Map(layers.map(({ key, layer }) => [key, withoutRepeats(readPath(layer))]));
            for (const { layer } of layers) {
                layer.pm.disable();
                layer.remove();
            }
            spec.save(store.getState(), paths);
        };
    }, [map, store, tool]);

    return null;
}

/** The outline of a polygon or the points of a line, as plain coordinates. */
function readPath(layer: L.Polyline | L.Polygon): LatLng[] {
    const latLngs = layer instanceof L.Polygon ? (layer.getLatLngs() as L.LatLng[][])[0] : (layer.getLatLngs() as L.LatLng[]);
    return latLngs.map(({ lat, lng }) => ({ lat, lng }));
}

/** Finishing a line with a double click leaves its last point twice. */
function withoutRepeats(path: LatLng[]): LatLng[] {
    return path.filter((p, i) => i === 0 || p.lat !== path[i - 1].lat || p.lng !== path[i - 1].lng);
}
