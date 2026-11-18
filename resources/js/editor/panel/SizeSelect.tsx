import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PIPE_SPECS, type PipeSpec } from '@/domain/data/pipes';
import { type PipeSizing } from '@/domain/hydraulics/designHydraulics';
import { cn } from '@/lib/utils';
import { formatFlow, formatHead } from './controls';

const SUGGESTED = 'suggested';

export function specLabel(spec: PipeSpec): string {
    return `${spec.series} ${spec.nominal}`;
}

const SERIES = [...new Set(PIPE_SPECS.map((s) => s.series))].map((name) => ({ name, specs: PIPE_SPECS.filter((s) => s.series === name) }));

/** A pipe's size (suggested or chosen) with the checks that depend on it. */
export function SizeSelect({ label, sizing, onChange }: { label: string; sizing: PipeSizing; onChange: (specId: string | null) => void }) {
    return (
        <div className="grid gap-1 text-sm">
            <span className="font-medium">{label}</span>
            <Select value={sizing.chosen ? sizing.spec.id : SUGGESTED} onValueChange={(value) => onChange(value === SUGGESTED ? null : value)}>
                <SelectTrigger aria-label={`ขนาด${label}`}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={SUGGESTED}>แนะนำ: {specLabel(sizing.suggested)}</SelectItem>
                    {SERIES.map((series) => (
                        <SelectGroup key={series.name}>
                            <SelectLabel>{series.name}</SelectLabel>
                            {series.specs.map((spec) => (
                                <SelectItem key={spec.id} value={spec.id}>
                                    {spec.nominal} (ใน {spec.innerDiameterMm} มม.)
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    ))}
                </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
                {sizing.chosen && `${specLabel(sizing.spec)} · `}ใน {sizing.spec.innerDiameterMm} มม. · {formatFlow(sizing.designFlowLph)}
            </p>
            <p className={cn('text-xs', sizing.overVelocity ? 'text-red-600' : 'text-muted-foreground')}>
                ความเร็ว {sizing.velocityMps.toFixed(2)} ม./วินาที{sizing.overVelocity && ' เกินเกณฑ์'}
            </p>
            {sizing.maxPressureM !== null && (
                <p className={cn('text-xs', sizing.overRating ? 'text-red-600' : 'text-muted-foreground')}>
                    แรงดันสูงสุด {formatHead(sizing.maxPressureM)}
                    {sizing.overRating && ` เกินที่ท่อรับได้ (${formatHead(sizing.spec.ratingM)})`}
                </p>
            )}
        </div>
    );
}
