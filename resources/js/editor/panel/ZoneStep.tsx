import { Button } from '@/components/ui/button';
import { maxPlantsPerZone, plantFlowLph } from '@/domain/irrigation';
import { splitIntoZones } from '@/domain/zoning';
import { usePlantLayout } from '../plants';
import { useEditor, useEditorStore } from '../store';
import { useZonePlants } from '../zones';
import { formatFlow, Hint, NumberField, ToolButton } from './controls';
import { ZoneList } from './ZoneList';

export function ZoneStep() {
    const store = useEditorStore();
    const hasBoundary = useEditor((s) => s.project.boundary.length >= 3);
    const zoneCount = useEditor((s) => s.project.zones.length);
    const maxZoneFlowLph = useEditor((s) => s.project.settings.maxZoneFlowLph);
    const emitter = useEditor((s) => s.project.emitter);
    const editingZones = useEditor((s) => s.tool === 'editZones');
    const updateSettings = useEditor((s) => s.updateSettings);
    const { plants } = usePlantLayout();
    const { unzoned } = useZonePlants();

    if (!hasBoundary) return <Hint>วาดขอบเขตแปลงก่อน แล้วจึงแบ่งโซน</Hint>;

    const perPlant = plantFlowLph(emitter.perPlant, emitter.flowLph);
    const maxPlants = maxPlantsPerZone(maxZoneFlowLph, emitter.perPlant, emitter.flowLph);

    const split = () => {
        const { project, replaceZones } = store.getState();
        if (zoneCount > 0 && !window.confirm(`แบ่งโซนใหม่จะแทนที่โซนเดิมทั้ง ${zoneCount} โซน ทำต่อหรือไม่?`)) return;
        replaceZones(
            splitIntoZones({ boundary: project.boundary, plants, rowBearingDeg: project.planting.rowBearingDeg, maxPlantsPerZone: maxPlants }),
        );
    };

    return (
        <div className="grid gap-4">
            <section className="grid gap-2">
                <h3 className="font-medium">แบ่งโซนอัตโนมัติ</h3>
                <Hint>แบ่งเป็นกลุ่มแถวต่อเนื่องกัน ให้แต่ละโซนใช้น้ำไม่เกินอัตราไหลที่กำหนด</Hint>
                <NumberField
                    label="อัตราไหลสูงสุดต่อโซน"
                    unit="ลิตร/ชม."
                    min={10}
                    max={1_000_000}
                    value={maxZoneFlowLph}
                    onChange={(value) => updateSettings({ maxZoneFlowLph: value })}
                />
                {maxPlants > 0 ? (
                    <Hint>
                        ได้ไม่เกิน {maxPlants.toLocaleString()} ต้นต่อโซน (ต้นละ {formatFlow(perPlant)})
                    </Hint>
                ) : (
                    <p className="text-sm text-red-600">น้อยกว่าน้ำที่ต้นเดียวใช้ ({formatFlow(perPlant)})</p>
                )}
                <Button type="button" variant="outline" disabled={maxPlants < 1 || plants.length === 0 || editingZones} onClick={split}>
                    {zoneCount > 0 ? 'แบ่งโซนใหม่' : 'แบ่งโซนอัตโนมัติ'}
                </Button>
            </section>

            <section className="grid gap-2 border-t pt-4">
                <h3 className="font-medium">โซน</h3>
                <ToolButton tool="drawZone" activeLabel="เสร็จสิ้นการวาด">
                    วาดโซนเอง
                </ToolButton>
                {zoneCount > 0 && (
                    <ToolButton tool="editZones" activeLabel="เสร็จสิ้นการแก้ไข">
                        แก้ไขรูปโซน
                    </ToolButton>
                )}
                {zoneCount > 0 && unzoned.length > 0 && (
                    <p className="text-sm text-amber-600">มีต้นที่ยังไม่อยู่ในโซนใด {unzoned.length.toLocaleString()} ต้น</p>
                )}
                <ZoneList />
            </section>
        </div>
    );
}
