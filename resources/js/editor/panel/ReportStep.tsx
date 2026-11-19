import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText } from 'lucide-react';
import { useId, useState } from 'react';
import { useBom } from '../bom';
import { useEditor } from '../store';
import { formatLength, Hint } from './controls';

export function ReportStep() {
    const projectId = useEditor((s) => s.projectId);
    const saved = useEditor((s) => s.saveStatus === 'saved');
    const pieceLengthM = useEditor((s) => s.project.bom.pieceLengthM);
    const bom = useBom();

    // One length per series, so list each series once.
    const series = bom ? [...new Map(bom.pipes.map((line) => [line.spec.series, line])).keys()] : [];

    return (
        <div className="grid gap-4">
            <Hint>รายงานรวมแผนผัง ตารางชลศาสตร์แต่ละโซน ปั๊ม และรายการวัสดุ เปิดแล้วกดพิมพ์หรือบันทึกเป็น PDF จากเบราว์เซอร์</Hint>
            <Button asChild={saved} disabled={!saved}>
                {saved ? (
                    <a href={route('projects.report', projectId)} target="_blank" rel="noreferrer">
                        <FileText className="size-4" /> เปิดรายงาน
                    </a>
                ) : (
                    <span>รอบันทึกแบบล่าสุด…</span>
                )}
            </Button>

            {!bom ? (
                <Hint>ปักจุดแหล่งน้ำ แบ่งโซน และวางท่อก่อน จึงจะมีรายการวัสดุ</Hint>
            ) : (
                <>
                    <section className="grid gap-3 border-t pt-4">
                        <h3 className="font-medium">ความยาวท่อต่อท่อน/ม้วน</h3>
                        <Hint>ใส่ตามที่ซื้อจริง ถ้าเว้นว่างไว้ รายการวัสดุจะแสดงเป็นเมตร</Hint>
                        {series.map((name) => (
                            <PieceLengthField key={name} series={name} value={pieceLengthM[name] ?? null} />
                        ))}
                    </section>

                    <section className="grid gap-1 border-t pt-4 text-sm">
                        <h3 className="font-medium">สรุปรายการวัสดุ</h3>
                        {bom.pipes.map((line) => (
                            <p key={line.spec.id} className="flex justify-between gap-2">
                                <span>
                                    {line.spec.series} {line.spec.nominal}
                                </span>
                                <span className="shrink-0">
                                    {formatLength(line.lengthM)}
                                    {line.pieces !== null && ` (${line.pieces} ท่อน/ม้วน)`}
                                </span>
                            </p>
                        ))}
                        <p className="flex justify-between gap-2">
                            <span>หัวจ่าย</span>
                            <span>{bom.emitters.toLocaleString()} หัว</span>
                        </p>
                        <Hint>ข้อต่อโดยประมาณอยู่ในรายงาน</Hint>
                    </section>
                </>
            )}
        </div>
    );
}

/** Empty means "not given"; anything else must be 1–10,000 m, matching the design schema. */
function PieceLengthField({ series, value }: { series: string; value: number | null }) {
    const id = useId();
    const setPieceLength = useEditor((s) => s.setPieceLength);
    const [text, setText] = useState(value === null ? '' : String(value));
    const parse = (s: string): number | null | undefined => {
        if (s.trim() === '') return null;
        const n = Number(s);
        return Number.isFinite(n) && n >= 1 && n <= 10_000 ? n : undefined;
    };
    const valid = parse(text) !== undefined;

    return (
        <div className="grid gap-1">
            <label htmlFor={id} className="text-sm">
                {series}
            </label>
            <div className="flex items-center gap-2">
                <Input
                    id={id}
                    type="text"
                    inputMode="decimal"
                    placeholder="ไม่ระบุ"
                    value={text}
                    aria-invalid={!valid}
                    onChange={(e) => {
                        setText(e.target.value);
                        const n = parse(e.target.value);
                        if (n !== undefined) setPieceLength(series, n);
                    }}
                />
                <span className="text-muted-foreground shrink-0 text-sm">ม.</span>
            </div>
            {!valid && <p className="text-xs text-red-600">ใส่ค่าระหว่าง 1 ถึง 10000 หรือเว้นว่าง</p>}
        </div>
    );
}
