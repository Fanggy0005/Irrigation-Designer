import { type LatLng } from '@/domain/geometry';
import { type Planting, type Project } from '@/domain/project';
import { HttpError, putJson } from '@/lib/http';
import { createContext, type ReactNode, useContext, useState } from 'react';
import { createStore, type StoreApi, useStore } from 'zustand';

/** What a click or drag on the map does right now. */
export type Tool = 'none' | 'placeWaterSource' | 'drawBoundary' | 'editBoundary' | 'drawExclusion' | 'removePlant' | 'addPlant';

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error';

export type EditorState = {
    projectId: number;
    name: string;
    project: Project;
    tool: Tool;
    saveStatus: SaveStatus;
    saveError: string | null;

    setName: (name: string) => void;
    setTool: (tool: Tool) => void;
    setWaterSource: (point: LatLng | null) => void;
    setBoundary: (ring: LatLng[]) => void;
    addExclusion: (ring: LatLng[]) => void;
    removeExclusion: (index: number) => void;
    updatePlanting: (patch: Partial<Omit<Planting, 'removed' | 'added'>>) => void;
    removeGeneratedPlant: (position: LatLng) => void;
    restoreRemovedPlants: () => void;
    addPlant: (position: LatLng) => void;
    removeAddedPlant: (index: number) => void;
    retrySave: () => void;
};

export type EditorStore = StoreApi<EditorState>;

const AUTOSAVE_DELAY_MS = 1000;

export function createEditorStore(initial: { id: number; name: string; project: Project }): EditorStore {
    const store = createStore<EditorState>()((set) => {
        const updateProject = (change: (p: Project) => Partial<Project>) => set((s) => ({ project: { ...s.project, ...change(s.project) } }));
        const updatePlanting = (change: (p: Planting) => Partial<Planting>) =>
            updateProject((p) => ({ planting: { ...p.planting, ...change(p.planting) } }));

        return {
            projectId: initial.id,
            name: initial.name,
            project: initial.project,
            tool: 'none',
            saveStatus: 'saved',
            saveError: null,

            setName: (name) => set({ name }),
            setTool: (tool) => set({ tool }),
            setWaterSource: (point) => updateProject((p) => ({ site: { ...p.site, waterSource: point } })),
            setBoundary: (ring) => updateProject(() => ({ boundary: ring })),
            addExclusion: (ring) => updateProject((p) => ({ exclusions: [...p.exclusions, ring] })),
            removeExclusion: (index) => updateProject((p) => ({ exclusions: p.exclusions.filter((_, i) => i !== index) })),
            updatePlanting: (patch) => updatePlanting(() => patch),
            removeGeneratedPlant: (position) => updatePlanting((p) => ({ removed: [...p.removed, position] })),
            restoreRemovedPlants: () => updatePlanting(() => ({ removed: [] })),
            addPlant: (position) => updatePlanting((p) => ({ added: [...p.added, position] })),
            removeAddedPlant: (index) => updatePlanting((p) => ({ added: p.added.filter((_, i) => i !== index) })),
            retrySave: () => void save(),
        };
    });

    // Autosave: wait for a pause in editing, and never run two saves at once, so an
    // older save can't land after a newer one.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let saving = false;
    let saveAgain = false;

    async function save() {
        if (saving) {
            saveAgain = true;
            return;
        }
        saving = true;
        const { projectId, name, project } = store.getState();
        store.setState({ saveStatus: 'saving' });
        try {
            await putJson(route('projects.update', projectId), { name, design: project });
            const now = store.getState();
            if (now.project === project && now.name === name) store.setState({ saveStatus: 'saved', saveError: null });
        } catch (error) {
            store.setState({ saveStatus: 'error', saveError: describeSaveError(error) });
        } finally {
            saving = false;
            if (saveAgain) {
                saveAgain = false;
                void save();
            }
        }
    }

    store.subscribe((state, previous) => {
        if (state.project === previous.project && state.name === previous.name) return;
        store.setState({ saveStatus: 'pending' });
        clearTimeout(timer);
        timer = setTimeout(save, AUTOSAVE_DELAY_MS);
    });

    return store;
}

function describeSaveError(error: unknown): string {
    if (error instanceof HttpError && (error.status === 401 || error.status === 419)) return 'หมดเวลาเข้าสู่ระบบ กรุณารีเฟรชหน้าแล้วเข้าสู่ระบบใหม่';
    if (error instanceof HttpError && error.status === 422) return 'ข้อมูลไม่ถูกต้อง (ชื่อโครงการว่างหรือยาวเกินไป)';
    if (error instanceof HttpError) return `เซิร์ฟเวอร์ตอบกลับผิดพลาด (${error.status})`;
    return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้';
}

const EditorContext = createContext<EditorStore | null>(null);

export function EditorProvider({ initial, children }: { initial: Parameters<typeof createEditorStore>[0]; children: ReactNode }) {
    const [store] = useState(() => createEditorStore(initial));
    return <EditorContext.Provider value={store}>{children}</EditorContext.Provider>;
}

export function useEditorStore(): EditorStore {
    const store = useContext(EditorContext);
    if (!store) throw new Error('useEditor must be used inside <EditorProvider>');
    return store;
}

export function useEditor<T>(selector: (state: EditorState) => T): T {
    return useStore(useEditorStore(), selector);
}
