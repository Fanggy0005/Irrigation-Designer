import { Button } from '@/components/ui/button';
import { polygonAreaM2 } from '@/domain/geometry';
import { parseProject, type Project } from '@/domain/project';
import { formatArea } from '@/editor/panel/controls';
import { usePlantLayout } from '@/editor/plants';
import { EditorProvider, useEditor } from '@/editor/store';
import { BomSection, ReportNotes } from '@/report/BomSection';
import { HydraulicsTables } from '@/report/HydraulicsTables';
import { ReportMap } from '@/report/ReportMap';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Printer } from 'lucide-react';
import { useMemo } from 'react';

type Props = { project: { id: number; name: string; design: unknown; updated_at: string } };

/**
 * The saved design as an A4 report, printed or saved as PDF from the browser. It reads the
 * same derived data as the editor (plants, laterals, hydraulics, materials), and changes
 * nothing, so nothing is saved from here.
 */
export default function Report({ project }: Props) {
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
                <h1 className="text-xl font-semibold">เปิดรายงานไม่ได้</h1>
                <pre className="bg-muted overflow-x-auto rounded p-3 text-xs">{parsed.error}</pre>
            </main>
        );
    }

    return (
        <EditorProvider initial={{ id: project.id, name: project.name, project: parsed.design }}>
            <Head title={`รายงาน ${project.name}`} />
            <style>{'@page { size: A4; margin: 10mm; } @media print { html, body { background: white; } }'}</style>
            {/* Paper colours in both themes: the report is meant to look like the printout. */}
            <div className="min-h-screen bg-gray-200 text-black print:bg-white">
                <div className="mx-auto flex w-[190mm] items-center justify-between gap-2 py-4 print:hidden">
                    <Link href={route('projects.edit', project.id)} className="flex items-center gap-1 text-sm hover:underline">
                        <ArrowLeft className="size-4" /> กลับไปแก้แบบ
                    </Link>
                    <Button type="button" onClick={() => window.print()}>
                        <Printer className="size-4" /> พิมพ์ / บันทึกเป็น PDF
                    </Button>
                </div>
                <article className="mx-auto grid w-[190mm] gap-6 bg-white p-[8mm] shadow print:p-0 print:shadow-none">
                    <ReportHeader name={project.name} savedAt={project.updated_at} />
                    <ReportMap />
                    <HydraulicsTables />
                    <BomSection />
                    <ReportNotes />
                </article>
                <div className="h-8 print:hidden" />
            </div>
        </EditorProvider>
    );
}

function ReportHeader({ name, savedAt }: { name: string; savedAt: string }) {
    const project = useEditor((s) => s.project);
    const { plants } = usePlantLayout();
    const { planting, emitter } = project;

    const facts: [string, string][] = [
        ['พื้นที่', formatArea(polygonAreaM2(project.boundary))],
        ['พืช', `${planting.plantName || '–'} · ${plants.length.toLocaleString()} ต้น`],
        ['ระยะปลูก', `${planting.spacingM} × ${planting.rowSpacingM} ม. แนวแถว ${planting.rowBearingDeg}°${planting.staggered ? ' สลับฟันปลา' : ''}`],
        ['น้ำต่อต้น', planting.waterLPerDay > 0 ? `${planting.waterLPerDay} ลิตร/วัน` : '–'],
        ['หัวจ่าย', `${emitter.flowLph} ลิตร/ชม. ที่ ${emitter.pressureM} ม. · ${emitter.perPlant} หัวต่อต้น`],
        ['จำนวนโซน', `${project.zones.length} โซน`],
    ];

    return (
        <header className="grid break-inside-avoid gap-2">
            <div className="flex items-baseline justify-between gap-4 border-b-2 border-gray-800 pb-1">
                <h1 className="text-xl font-semibold">{name}</h1>
                <span className="text-xs text-gray-600">
                    แบบบันทึกเมื่อ {new Date(savedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm">
                {facts.map(([label, value]) => (
                    <div key={label} className="flex gap-2">
                        <dt className="w-20 shrink-0 text-gray-600">{label}</dt>
                        <dd>{value}</dd>
                    </div>
                ))}
            </dl>
        </header>
    );
}
