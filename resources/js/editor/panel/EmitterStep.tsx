import { plantFlowLph, runMinutesPerDay } from '@/domain/irrigation';
import { mHeadToBar } from '@/domain/units';
import { usePlantLayout } from '../plants';
import { useEditor } from '../store';
import { formatFlow, formatMinutes, Hint, NumberField } from './controls';

export function EmitterStep() {
    const emitter = useEditor((s) => s.project.emitter);
    const waterLPerDay = useEditor((s) => s.project.planting.waterLPerDay);
    const update = useEditor((s) => s.updateEmitter);
    const { plants } = usePlantLayout();
    const perPlant = plantFlowLph(emitter.perPlant, emitter.flowLph);

    return (
        <div className="grid gap-4">
            <Hint>สเปกหัวจ่ายที่ใช้ทั้งแปลง เช่น มินิสปริงเกลอร์หรือหัวน้ำหยด</Hint>
            <NumberField
                label="อัตราไหลต่อหัว (ที่แรงดันใช้งาน)"
                unit="ลิตร/ชม."
                min={0.5}
                max={5000}
                value={emitter.flowLph}
                onChange={(flowLph) => update({ flowLph })}
            />
            <div className="grid gap-1">
                <NumberField
                    label="แรงดันใช้งาน"
                    unit="ม."
                    min={1}
                    max={100}
                    value={emitter.pressureM}
                    onChange={(pressureM) => update({ pressureM })}
                />
                <p className="text-muted-foreground text-xs">≈ {mHeadToBar(emitter.pressureM).toFixed(2)} บาร์</p>
            </div>
            <NumberField
                label="จำนวนหัวต่อต้น"
                unit="หัว"
                min={1}
                max={20}
                integer
                value={emitter.perPlant}
                onChange={(perPlant) => update({ perPlant })}
            />

            <section className="grid gap-1 border-t pt-4 text-sm">
                <p>น้ำต่อต้น {formatFlow(perPlant)}</p>
                <p>
                    ทั้งแปลง ({plants.length.toLocaleString()} ต้น) {formatFlow(perPlant * plants.length)}
                </p>
                {waterLPerDay > 0 ? (
                    <p>
                        ให้น้ำ {waterLPerDay.toLocaleString()} ลิตร/ต้น/วัน ต้องเปิดโซนละ{' '}
                        {formatMinutes(runMinutesPerDay(waterLPerDay, emitter.perPlant, emitter.flowLph))}
                    </p>
                ) : (
                    <Hint>กรอกปริมาณน้ำต่อต้นในขั้นการปลูก เพื่อคำนวณเวลารดน้ำ</Hint>
                )}
            </section>
        </div>
    );
}
