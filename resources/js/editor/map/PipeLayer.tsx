import { type Lateral } from '@/domain/laterals';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import { Pane, Polyline, useMap } from 'react-leaflet';
import { PIPE_COLORS, PIPE_WEIGHTS } from '../colors';
import { usePipeLayout } from '../pipes';
import { useEditor } from '../store';

const PANE = 'pipes';

/**
 * Pipes above the plants: the designer's mains, submains and laterals, plus the laterals
 * generated along the rows. A drawn pipe that does not reach the water source is dashed.
 */
export function PipeLayer() {
    const pipes = useEditor((s) => s.project.pipes);
    // While pipes are being edited, the editing tool draws the drawn ones instead.
    const editing = useEditor((s) => s.tool === 'editPipes');
    const { connections, laterals } = usePipeLayout();

    return (
        <Pane name={PANE} style={{ zIndex: 450 }}>
            <GeneratedLaterals laterals={laterals} />
            {!editing &&
                pipes.map(
                    (pipe) =>
                        pipe.path.length >= 2 && (
                            <Polyline
                                key={pipe.id}
                                positions={pipe.path}
                                interactive={false}
                                pathOptions={{
                                    color: PIPE_COLORS[pipe.kind],
                                    weight: PIPE_WEIGHTS[pipe.kind],
                                    dashArray: connections[pipe.id] ? undefined : '8 6',
                                }}
                            />
                        ),
                )}
        </Pane>
    );
}

/** There can be thousands of generated laterals, so like the plants they go on a canvas. */
function GeneratedLaterals({ laterals }: { laterals: Lateral[] }) {
    const map = useMap();
    const [renderer] = useState(() => L.canvas({ pane: PANE, padding: 0.5 }));

    useEffect(() => {
        const group = L.layerGroup(
            laterals
                .filter((l) => l.pipeId === null)
                .map((l) =>
                    L.polyline(l.path, {
                        renderer,
                        interactive: false,
                        snapIgnore: true,
                        color: PIPE_COLORS.lateral,
                        weight: PIPE_WEIGHTS.lateral,
                        opacity: 0.9,
                    }),
                ),
        );
        group.addTo(map);
        return () => {
            group.remove();
        };
    }, [map, laterals, renderer]);

    return null;
}
