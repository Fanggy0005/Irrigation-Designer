import { pumpDuties } from '@/domain/hydraulics/designHydraulics';
import { type PumpDuty } from '@/domain/hydraulics/pump';
import { useHydraulics } from '../hydraulics';
import { zoneLabel } from '../labels';
import { useEditor } from '../store';
import { Hint, NumberField } from './controls';

export function PumpStep() {
    const pump = useEditor((s) => s.project.pump);
    const zones = useEditor((s) => s.project.zones);
    const updatePump = useEditor((s) => s.updatePump);
    const { result } = useHydraulics();

    const { duties, heaviestZoneId } = result ? pumpDuties(result.zones, pump) : { duties: {}, heaviestZoneId: null };
    const zoneName = (id: string) => {
        const i = zones.findIndex((z) => z.id === id);
        return zoneLabel(zones[i], i);
    };

    return (
        <div className="grid gap-4">
            <section className="grid grid-cols-2 gap-3">
                <NumberField
                    label="ความสูงดูด"
                    unit="ม."
                    min={-50}
                    max={15}
                    value={pump.suctionLiftM}
                    onChange={(suctionLiftM) => updatePump({ suctionLiftM })}
                />
                <NumberField
                    label="การสูญเสียในท่อดูด"
                    unit="ม."
                    min={0}
                    max={50}
                    value={pump.suctionLossM}
                    onChange={(suctionLossM) => updatePump({ suctionLossM })}
                />
                <NumberField
                    label="ประสิทธิภาพปั๊ม"
                    unit="%"
                    min={10}
                    max={100}
                    value={pump.efficiencyPct}
                    onChange={(efficiencyPct) => updatePump({ efficiencyPct })}
                />
            </section>
            <Hint>ความสูงดูดคือระดับปั๊มเหนือผิวน้ำ ถ้าปั๊มอยู่ต่ำกว่าผิวน้ำให้ใส่ค่าติดลบ</Hint>

            {heaviestZoneId === null ? (
                <Hint>ยังไม่มีโซนที่คำนวณได้ ดูขั้นชลศาสตร์</Hint>
            ) : (
                <>
                    <section className="grid gap-1 rounded-md border p-3">
                        <h3 className="font-medium">จุดทำงานของปั๊ม ({zoneName(heaviestZoneId)} ใช้กำลังมากที่สุด)</h3>
                        <DutyLines duty={duties[heaviestZoneId]} />
                    </section>
                    <section className="grid gap-2 border-t pt-4 text-sm">
                        <h3 className="font-medium">ทุกโซน</h3>
                        {Object.entries(duties).map(([zoneId, duty]) => (
                            <p key={zoneId} className="flex justify-between gap-2">
                                <span>{zoneName(zoneId)}</span>
                                <span>
                                    {duty.flowM3ph.toFixed(2)} ม³/ชม. · {duty.totalHeadM.toFixed(1)} ม. · {duty.shaftPowerKw.toFixed(2)} kW
                                </span>
                            </p>
                        ))}
                        <Hint>ยังไม่เลือกรุ่นปั๊ม นำอัตราไหลและแรงดันรวม (TDH) ของทุกโซนไปเทียบกับกราฟของปั๊มที่จะใช้</Hint>
                    </section>
                </>
            )}
        </div>
    );
}

function DutyLines({ duty }: { duty: PumpDuty }) {
    return (
        <div className="grid gap-0.5 text-sm">
            <p>
                อัตราไหล (Q) {duty.flowM3ph.toFixed(2)} ม³/ชม. ({(duty.flowLph / 60).toFixed(0)} ลิตร/นาที)
            </p>
            <p>แรงดันรวม (TDH) {duty.totalHeadM.toFixed(1)} ม.</p>
            <p className="font-medium">
                กำลังที่เพลาปั๊ม {duty.shaftPowerKw.toFixed(2)} kW ({duty.shaftPowerHp.toFixed(2)} แรงม้า)
            </p>
            <p className="text-muted-foreground text-xs">กำลังที่ให้กับน้ำ {duty.hydraulicPowerKw.toFixed(2)} kW</p>
        </div>
    );
}
