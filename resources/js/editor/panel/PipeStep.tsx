import { Button } from '@/components/ui/button';
import { pathLengthM } from '@/domain/geometry';
import { type PipeKind } from '@/domain/project';
import { CheckCircle2 } from 'lucide-react';
import { usePipeLayout } from '../pipes';
import { useEditor } from '../store';
import { useZonePlants } from '../zones';
import { formatLength, Hint, ToolButton } from './controls';

const KIND_LABELS: Record<PipeKind, string> = { main: 'ท่อเมน', submain: 'ท่อเมนย่อย', lateral: 'ท่อแขนง' };

export function PipeStep() {
    const hasSource = useEditor((s) => s.project.site.waterSource !== null);
    const hasZones = useEditor((s) => s.project.zones.length > 0);
    const pipes = useEditor((s) => s.project.pipes);
    const removedCount = useEditor((s) => s.project.laterals.removed.length);
    const restoreRemoved = useEditor((s) => s.restoreRemovedLaterals);
    const { laterals } = usePipeLayout();

    if (!hasSource) return <Hint>ปักจุดแหล่งน้ำในขั้นที่ตั้งก่อน แล้วจึงวางท่อ</Hint>;
    if (!hasZones) return <Hint>แบ่งโซนก่อน แล้วจึงวางท่อ</Hint>;

    const drawn = (kind: PipeKind) => pipes.filter((p) => p.kind === kind);
    const generated = laterals.filter((l) => l.pipeId === null);
    const totals: { label: string; count: number; lengthM: number }[] = [
        { label: KIND_LABELS.main, count: drawn('main').length, lengthM: sumLength(drawn('main')) },
        { label: KIND_LABELS.submain, count: drawn('submain').length, lengthM: sumLength(drawn('submain')) },
        {
            label: `${KIND_LABELS.lateral} (วาดเอง ${drawn('lateral').length})`,
            count: generated.length + drawn('lateral').length,
            lengthM: sumLength(generated) + sumLength(drawn('lateral')),
        },
    ];

    return (
        <div className="grid gap-4">
            <Hint>
                วาดท่อเมนจากแหล่งน้ำไปยังโซน แล้ววาดท่อเมนย่อยในแต่ละโซนให้ตัดผ่านแถวปลูก ระบบจะวางท่อแขนงตามแถวให้เอง ดับเบิลคลิกเพื่อจบเส้น
                และปลายท่อจะดูดติดท่อเส้นอื่นเมื่อลากเข้าใกล้
            </Hint>
            <div className="grid gap-2">
                <ToolButton tool="drawMain" activeLabel="เสร็จสิ้นการวาดท่อเมน">
                    วาดท่อเมน
                </ToolButton>
                <ToolButton tool="drawSubmain" activeLabel="เสร็จสิ้นการวาดท่อเมนย่อย">
                    วาดท่อเมนย่อย
                </ToolButton>
                <ToolButton tool="drawLateral" activeLabel="เสร็จสิ้นการวาดท่อแขนง">
                    วาดท่อแขนงเอง
                </ToolButton>
                {pipes.length > 0 && (
                    <ToolButton tool="editPipes" activeLabel="เสร็จสิ้นการแก้ไข">
                        แก้ไขแนวท่อ
                    </ToolButton>
                )}
                <ToolButton tool="removePipe" activeLabel="เสร็จสิ้นการลบ">
                    ลบท่อ (คลิกที่ท่อ)
                </ToolButton>
                {removedCount > 0 && (
                    <Button type="button" variant="ghost" onClick={restoreRemoved}>
                        คืนท่อแขนงที่ลบทั้งหมด ({removedCount})
                    </Button>
                )}
            </div>

            <section className="grid gap-1 border-t pt-4 text-sm">
                <h3 className="font-medium">ความยาวท่อ</h3>
                {totals.map((t) => (
                    <p key={t.label} className="flex justify-between gap-2">
                        <span>
                            {t.label} · {t.count.toLocaleString()} เส้น
                        </span>
                        <span>{formatLength(t.lengthM)}</span>
                    </p>
                ))}
            </section>

            <PipeChecks />
        </div>
    );
}

/** What still keeps water from reaching every plant. */
function PipeChecks() {
    const zones = useEditor((s) => s.project.zones);
    const pipes = useEditor((s) => s.project.pipes);
    const { connections, pipeZones, unservedPlantIds } = usePipeLayout();
    const zonePlants = useZonePlants();

    const problems: string[] = [];
    const numberOf = (id: string, kind: PipeKind) => pipes.filter((p) => p.kind === kind).findIndex((p) => p.id === id) + 1;
    for (const pipe of pipes) {
        const label = `${KIND_LABELS[pipe.kind]} ${numberOf(pipe.id, pipe.kind)}`;
        if (pipe.kind !== 'main' && pipeZones[pipe.id] === null) problems.push(`${label} ไม่อยู่ในโซนใด`);
        else if (!connections[pipe.id]) problems.push(`${label} ยังไม่ต่อถึงแหล่งน้ำ (เส้นประบนแผนที่)`);
    }
    zones.forEach((zone, i) => {
        const name = zone.name || `โซน ${i + 1}`;
        const hasSubmain = pipes.some((p) => p.kind === 'submain' && pipeZones[p.id] === zone.id);
        const unserved = zonePlants.zones[i]?.plants.filter((p) => unservedPlantIds.has(p.id)).length ?? 0;
        if (!hasSubmain) problems.push(`${name} ยังไม่มีท่อเมนย่อย`);
        else if (unserved > 0) problems.push(`${name} มี ${unserved.toLocaleString()} ต้นที่ยังไม่มีท่อแขนง (ขอบแดงบนแผนที่)`);
    });
    if (zonePlants.unzoned.length > 0) problems.push(`มี ${zonePlants.unzoned.length.toLocaleString()} ต้นที่ยังไม่อยู่ในโซนใด`);

    return (
        <section className="grid gap-1 border-t pt-4 text-sm">
            <h3 className="font-medium">ตรวจแบบ</h3>
            {problems.length === 0 ? (
                <p className="flex items-center gap-1 text-green-700">
                    <CheckCircle2 className="size-4" /> ท่อทุกเส้นต่อถึงแหล่งน้ำ และทุกต้นมีท่อแขนง
                </p>
            ) : (
                <ul className="list-disc space-y-1 pl-5 text-amber-700">
                    {problems.map((problem) => (
                        <li key={problem}>{problem}</li>
                    ))}
                </ul>
            )}
        </section>
    );
}

function sumLength(lines: readonly { path: { lat: number; lng: number }[] }[]): number {
    return lines.reduce((sum, line) => sum + pathLengthM(line.path), 0);
}
