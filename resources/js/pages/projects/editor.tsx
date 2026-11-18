import { parseProject, type Project } from '@/domain/project';
import { EditorMap } from '@/editor/map/EditorMap';
import { EditorPanel } from '@/editor/panel/EditorPanel';
import { EditorProvider, useEditorStore } from '@/editor/store';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useMemo } from 'react';

type Props = { project: { id: number; name: string; design: unknown } };

export default function Editor({ project }: Props) {
    const parsed = useMemo((): { design: Project } | { error: string } => {
        try {
            return { design: parseProject(project.design) };
        } catch (error) {
            return { error: error instanceof Error ? error.message : String(error) };
        }
    }, [project.design]);

    if ('error' in parsed) {
        return (
            <main className="mx-auto grid max-w-xl gap-3 p-8">
                <Head title={project.name} />
                <h1 className="text-xl font-semibold">เปิดโครงการนี้ไม่ได้</h1>
                <p>ข้อมูลแบบที่บันทึกไว้ไม่ตรงกับรูปแบบที่แอปรู้จัก</p>
                <pre className="bg-muted overflow-x-auto rounded p-3 text-xs">{parsed.error}</pre>
                <Link href={route('projects.index')} className="underline">
                    กลับไปหน้าโครงการ
                </Link>
            </main>
        );
    }

    return (
        <EditorProvider initial={{ id: project.id, name: project.name, project: parsed.design }}>
            <Head title={project.name} />
            <LeaveGuard />
            <div className="flex h-screen">
                <aside className="bg-background w-80 shrink-0 border-r">
                    <EditorPanel />
                </aside>
                {/* isolate: keeps Leaflet's z-indexes below dropdowns opened from the panel */}
                <main className="relative isolate flex-1">
                    <EditorMap />
                </main>
            </div>
        </EditorProvider>
    );
}

/** Warns before leaving while the last edits are not saved yet. */
function LeaveGuard() {
    const store = useEditorStore();

    useEffect(() => {
        const unsaved = () => store.getState().saveStatus !== 'saved';
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (unsaved()) e.preventDefault();
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        const removeInertiaGuard = router.on('before', (event) => {
            if (event.detail.visit.method === 'get' && unsaved() && !window.confirm('ยังบันทึกไม่เสร็จ ออกจากหน้านี้เลยหรือไม่?')) {
                event.preventDefault();
            }
        });
        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            removeInertiaGuard();
        };
    }, [store]);

    return null;
}
