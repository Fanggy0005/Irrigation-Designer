import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useEditor } from '../store';
import { BoundaryStep } from './BoundaryStep';
import { EmitterStep } from './EmitterStep';
import { PipeStep } from './PipeStep';
import { PlantingStep } from './PlantingStep';
import { SiteStep } from './SiteStep';
import { ZoneStep } from './ZoneStep';

const STEPS = [
    { id: 'site', label: 'ที่ตั้ง', Component: SiteStep },
    { id: 'boundary', label: 'ขอบเขต', Component: BoundaryStep },
    { id: 'planting', label: 'การปลูก', Component: PlantingStep },
    { id: 'emitter', label: 'หัวจ่าย', Component: EmitterStep },
    { id: 'zones', label: 'โซน', Component: ZoneStep },
    { id: 'pipes', label: 'ท่อ', Component: PipeStep },
] as const;

export function EditorPanel() {
    const [stepId, setStepId] = useState<(typeof STEPS)[number]['id']>('site');
    const setTool = useEditor((s) => s.setTool);
    const step = STEPS.find((s) => s.id === stepId)!;

    return (
        <div className="flex h-full flex-col">
            <header className="grid gap-2 border-b p-4">
                <Link href={route('projects.index')} className="text-muted-foreground flex items-center gap-1 text-sm hover:underline">
                    <ArrowLeft className="size-4" /> โครงการทั้งหมด
                </Link>
                <ProjectName />
                <SaveStatus />
            </header>
            <nav className="grid grid-cols-3 border-b">
                {STEPS.map((s) => (
                    <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                            setTool('none');
                            setStepId(s.id);
                        }}
                        className={cn('py-2 text-sm', s.id === stepId ? 'border-primary border-b-2 font-medium' : 'text-muted-foreground')}
                    >
                        {s.label}
                    </button>
                ))}
            </nav>
            <div className="flex-1 overflow-y-auto p-4">
                <step.Component />
            </div>
        </div>
    );
}

/** Edited locally and stored on blur, so an empty name never reaches the server. */
function ProjectName() {
    const name = useEditor((s) => s.name);
    const setName = useEditor((s) => s.setName);
    const [text, setText] = useState(name);

    const commit = () => {
        const trimmed = text.trim();
        if (trimmed && trimmed !== name) setName(trimmed);
        else setText(name);
    };

    return (
        <Input
            value={text}
            maxLength={255}
            aria-label="ชื่อโครงการ"
            className="font-medium"
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
    );
}

function SaveStatus() {
    const status = useEditor((s) => s.saveStatus);
    const error = useEditor((s) => s.saveError);
    const retry = useEditor((s) => s.retrySave);

    if (status === 'error') {
        return (
            <div className="flex items-center justify-between gap-2 text-sm text-red-600">
                <span>บันทึกไม่สำเร็จ: {error}</span>
                <Button type="button" size="sm" variant="outline" onClick={retry}>
                    ลองอีกครั้ง
                </Button>
            </div>
        );
    }
    return <p className="text-muted-foreground text-xs">{status === 'saved' ? 'บันทึกแล้ว' : 'กำลังบันทึก…'}</p>;
}
