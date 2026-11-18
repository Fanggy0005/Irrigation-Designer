import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePlantLayout } from '../plants';
import { useEditor } from '../store';
import { Hint, NumberField, ToolButton } from './controls';

export function PlantingStep() {
    const hasBoundary = useEditor((s) => s.project.boundary.length >= 3);
    const planting = useEditor((s) => s.project.planting);
    const update = useEditor((s) => s.updatePlanting);
    const restoreRemoved = useEditor((s) => s.restoreRemovedPlants);
    const { plants, error } = usePlantLayout();

    if (!hasBoundary) return <Hint>วาดขอบเขตแปลงก่อน แล้วจึงกำหนดผังการปลูก</Hint>;

    return (
        <div className="grid gap-4">
            <div className="grid gap-1.5">
                <Label htmlFor="plant-name">ชนิดพืช</Label>
                <Input
                    id="plant-name"
                    maxLength={100}
                    value={planting.plantName}
                    placeholder="เช่น ทุเรียน"
                    onChange={(e) => update({ plantName: e.target.value })}
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <NumberField label="ระยะต้น" unit="ม." min={0.5} max={50} value={planting.spacingM} onChange={(spacingM) => update({ spacingM })} />
                <NumberField
                    label="ระยะแถว"
                    unit="ม."
                    min={0.5}
                    max={50}
                    value={planting.rowSpacingM}
                    onChange={(rowSpacingM) => update({ rowSpacingM })}
                />
            </div>
            <NumberField
                label="แนวแถว (องศาจากทิศเหนือ)"
                unit="°"
                min={0}
                max={180}
                value={planting.rowBearingDeg}
                onChange={(rowBearingDeg) => update({ rowBearingDeg })}
            />
            <NumberField
                label="ระยะห่างจากขอบแปลง"
                unit="ม."
                min={0}
                max={50}
                value={planting.edgeSetbackM}
                onChange={(edgeSetbackM) => update({ edgeSetbackM })}
            />
            <NumberField
                label="ปริมาณน้ำต่อต้นต่อวัน"
                unit="ลิตร"
                min={0}
                max={5000}
                value={planting.waterLPerDay}
                onChange={(waterLPerDay) => update({ waterLPerDay })}
            />
            <div className="flex items-center gap-2">
                <Checkbox id="staggered" checked={planting.staggered} onCheckedChange={(checked) => update({ staggered: checked === true })} />
                <Label htmlFor="staggered">ปลูกสลับฟันปลา (แถวคู่เลื่อนครึ่งระยะต้น)</Label>
            </div>

            <section className="grid gap-2 border-t pt-4">
                {error ? (
                    <p className="text-sm text-red-600">{error}</p>
                ) : (
                    <p className="text-sm font-medium">จำนวนต้นไม้ {plants.length.toLocaleString()} ต้น</p>
                )}
                <ToolButton tool="removePlant" activeLabel="เสร็จสิ้นการลบ">
                    ลบต้นไม้ (คลิกที่ต้น)
                </ToolButton>
                <ToolButton tool="addPlant" activeLabel="เสร็จสิ้นการเพิ่ม">
                    เพิ่มต้นไม้ (คลิกบนแผนที่)
                </ToolButton>
                {planting.removed.length > 0 && (
                    <Button type="button" variant="ghost" onClick={restoreRemoved}>
                        คืนต้นที่ลบทั้งหมด ({planting.removed.length})
                    </Button>
                )}
            </section>
        </div>
    );
}
