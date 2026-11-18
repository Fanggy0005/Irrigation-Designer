import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { plantFlowLph, runMinutesPerDay } from '@/domain/irrigation';
import { type Zone } from '@/domain/project';
import { cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';
import { zoneColor } from '../colors';
import { useEditor } from '../store';
import { useZonePlants } from '../zones';
import { formatFlow, formatMinutes, Hint, NumberField } from './controls';

const MINUTES_PER_DAY = 24 * 60;

/** Each zone's plants, flow and daily run time, then the total time to water every zone. */
export function ZoneList() {
    const zones = useEditor((s) => s.project.zones);
    const emitter = useEditor((s) => s.project.emitter);
    const waterLPerDay = useEditor((s) => s.project.planting.waterLPerDay);
    const maxZoneFlowLph = useEditor((s) => s.project.settings.maxZoneFlowLph);
    const zonePlants = useZonePlants();

    if (zones.length === 0) return null;

    const perPlant = plantFlowLph(emitter.perPlant, emitter.flowLph);
    const suggested = waterLPerDay > 0 ? runMinutesPerDay(waterLPerDay, emitter.perPlant, emitter.flowLph) : null;
    const totalMinutes = zones.reduce((sum, z) => sum + (z.runMinutes ?? suggested ?? 0), 0);

    return (
        <div className="grid gap-3">
            {zones.map((zone, i) => (
                <ZoneCard
                    key={zone.id}
                    zone={zone}
                    color={zoneColor(i)}
                    plantCount={zonePlants.zones[i]?.plants.length ?? 0}
                    plantFlowLph={perPlant}
                    maxZoneFlowLph={maxZoneFlowLph}
                    suggestedMinutes={suggested}
                />
            ))}
            <p className={cn('text-sm font-medium', totalMinutes > MINUTES_PER_DAY && 'text-red-600')}>
                รวมเวลารดน้ำทุกโซน {formatMinutes(totalMinutes)} ต่อวัน
                {totalMinutes > MINUTES_PER_DAY && ' (เกิน 24 ชั่วโมง)'}
            </p>
        </div>
    );
}

function ZoneCard(props: {
    zone: Zone;
    color: string;
    plantCount: number;
    plantFlowLph: number;
    maxZoneFlowLph: number;
    suggestedMinutes: number | null;
}) {
    const { zone, color, plantCount, plantFlowLph, maxZoneFlowLph, suggestedMinutes } = props;
    const updateZone = useEditor((s) => s.updateZone);
    const removeZone = useEditor((s) => s.removeZone);
    const flow = plantCount * plantFlowLph;

    return (
        <div className="grid gap-2 rounded-md border p-2">
            <div className="flex items-center gap-2">
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                <Input
                    value={zone.name}
                    maxLength={100}
                    aria-label="ชื่อโซน"
                    className="h-8"
                    onChange={(e) => updateZone(zone.id, { name: e.target.value })}
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeZone(zone.id)} aria-label={`ลบ${zone.name}`}>
                    <Trash2 className="size-4" />
                </Button>
            </div>
            <p className={cn('text-sm', flow > maxZoneFlowLph && 'text-red-600')}>
                {plantCount.toLocaleString()} ต้น · {formatFlow(flow)}
                {flow > maxZoneFlowLph && ' เกินอัตราไหลสูงสุด'}
            </p>
            <NumberField
                label="เวลารดน้ำต่อวัน"
                unit="นาที"
                min={0}
                max={1440}
                value={zone.runMinutes ?? Math.round(suggestedMinutes ?? 0)}
                onChange={(runMinutes) => updateZone(zone.id, { runMinutes })}
            />
            {zone.runMinutes === null ? (
                <Hint>{suggestedMinutes === null ? 'กรอกปริมาณน้ำต่อต้นในขั้นการปลูกเพื่อคำนวณ' : 'คำนวณจากปริมาณน้ำต่อต้น'}</Hint>
            ) : (
                suggestedMinutes !== null && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => updateZone(zone.id, { runMinutes: null })}>
                        ใช้ค่าที่คำนวณ ({formatMinutes(suggestedMinutes)})
                    </Button>
                )
            )}
        </div>
    );
}
