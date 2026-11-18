import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { m2ToRaiNganWa, mHeadToBar } from '@/domain/units';
import { type ReactNode, useId, useState } from 'react';
import { type Tool, useEditor } from '../store';

/** Turns a map tool on, or off again while it is on. */
export function ToolButton({ tool, children, activeLabel }: { tool: Tool; children: ReactNode; activeLabel: ReactNode }) {
    const active = useEditor((s) => s.tool === tool);
    const setTool = useEditor((s) => s.setTool);
    return (
        <Button type="button" variant={active ? 'default' : 'outline'} onClick={() => setTool(active ? 'none' : tool)} className="w-full">
            {active ? activeLabel : children}
        </Button>
    );
}

/**
 * A number input that only reports values inside [min, max] (whole numbers only with
 * `integer`). While the text is incomplete or out of range ("", "6.", "0") the last good
 * value stays in the design. Keep the limits in line with `domain/project.ts`, or the
 * saved design will not load again.
 */
export function NumberField(props: {
    label: string;
    unit?: string;
    value: number;
    min: number;
    max: number;
    integer?: boolean;
    onChange: (value: number) => void;
}) {
    const { label, unit, value, min, max, integer = false, onChange } = props;
    const id = useId();
    const [text, setText] = useState(String(value));
    const [shownValue, setShownValue] = useState(value);

    // Follow changes made elsewhere, but don't rewrite what the user is typing.
    if (value !== shownValue) {
        setShownValue(value);
        if (Number(text) !== value) setText(String(value));
    }

    const parse = (s: string) => {
        const n = Number(s);
        return s.trim() !== '' && Number.isFinite(n) && n >= min && n <= max && (!integer || Number.isInteger(n)) ? n : null;
    };
    const valid = parse(text) !== null;

    return (
        <div className="grid gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            <div className="flex items-center gap-2">
                <Input
                    id={id}
                    // Text, not type="number": browsers disagree on what a half-typed number reads as.
                    type="text"
                    inputMode={integer ? 'numeric' : 'decimal'}
                    value={text}
                    aria-invalid={!valid}
                    onChange={(e) => {
                        setText(e.target.value);
                        const n = parse(e.target.value);
                        if (n !== null) onChange(n);
                    }}
                />
                {unit && <span className="text-muted-foreground shrink-0 text-sm">{unit}</span>}
            </div>
            {!valid && (
                <p className="text-xs text-red-600">
                    ใส่{integer ? 'จำนวนเต็ม' : 'ค่า'}ระหว่าง {min} ถึง {max}
                </p>
            )}
        </div>
    );
}

export function formatArea(m2: number): string {
    const { rai, ngan, wa } = m2ToRaiNganWa(m2);
    return `${rai.toLocaleString()} ไร่ ${ngan} งาน ${wa.toFixed(1)} ตร.วา (${Math.round(m2).toLocaleString()} ม²)`;
}

export function formatFlow(lph: number): string {
    return `${Math.round(lph).toLocaleString()} ลิตร/ชม. (${(lph / 1000).toFixed(2)} ม³/ชม.)`;
}

/** Pressure as m of head, with bar alongside. */
export function formatHead(m: number): string {
    return `${m.toFixed(1)} ม. (${mHeadToBar(m).toFixed(2)} บาร์)`;
}

export function formatLength(m: number): string {
    return `${Math.round(m).toLocaleString()} ม.`;
}

export function formatMinutes(minutes: number): string {
    const rounded = Math.round(minutes);
    if (rounded < 60) return `${rounded} นาที`;
    const hours = Math.floor(rounded / 60);
    return rounded % 60 === 0 ? `${hours} ชม.` : `${hours} ชม. ${rounded % 60} นาที`;
}

export function Hint({ children }: { children: ReactNode }) {
    return <p className="text-muted-foreground text-sm">{children}</p>;
}
