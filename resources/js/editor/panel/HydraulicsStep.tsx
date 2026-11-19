import { type ZoneHydraulics } from '@/domain/hydraulics/designHydraulics';
import { type Zone } from '@/domain/project';
import { cn } from '@/lib/utils';
import { zoneColor } from '../colors';
import { useHydraulics } from '../hydraulics';
import { pipeLabel, zoneLabel } from '../labels';
import { useEditor } from '../store';
import { formatFlow, formatHead, Hint, NumberField } from './controls';
import { SizeSelect } from './SizeSelect';

export function HydraulicsStep() {
    const zones = useEditor((s) => s.project.zones);
    const pipes = useEditor((s) => s.project.pipes);
    const site = useEditor((s) => s.project.site);
    const settings = useEditor((s) => s.project.settings);
    const updateSettings = useEditor((s) => s.updateSettings);
    const setSourceElevation = useEditor((s) => s.setSourceElevation);
    const setPipeSpec = useEditor((s) => s.setPipeSpec);
    const { result, error } = useHydraulics();

    if (!site.waterSource) return <Hint>ปักจุดแหล่งน้ำ แบ่งโซน และวางท่อก่อน แล้วจึงคำนวณชลศาสตร์</Hint>;

    return (
        <div className="grid gap-4">
            <section className="grid grid-cols-2 gap-3">
                <NumberField
                    label="Minor loss"
                    unit="%"
                    min={0}
                    max={100}
                    value={settings.minorLossPct}
                    onChange={(minorLossPct) => updateSettings({ minorLossPct })}
                />
                <NumberField
                    label="ความเร็วสูงสุด"
                    unit="ม./วิ"
                    min={0.1}
                    max={5}
                    value={settings.maxVelocityMps}
                    onChange={(maxVelocityMps) => updateSettings({ maxVelocityMps })}
                />
                <NumberField
                    label="แรงดันในโซนต่างกันได้"
                    unit="%"
                    min={1}
                    max={100}
                    value={settings.maxPressureVariationPct}
                    onChange={(maxPressureVariationPct) => updateSettings({ maxPressureVariationPct })}
                />
                <NumberField
                    label="ระดับพื้นที่แหล่งน้ำ"
                    unit="ม."
                    min={-1000}
                    max={10_000}
                    value={site.sourceElevationM}
                    onChange={setSourceElevation}
                />
            </section>

            {error && <p className="text-sm text-red-600">คำนวณไม่ได้: {error}</p>}

            {result && (
                <>
                    <section className="grid gap-3 border-t pt-4">
                        <h3 className="font-medium">ผลแต่ละโซน</h3>
                        {zones.length === 0 && <Hint>ยังไม่มีโซน</Hint>}
                        {zones.map((zone, i) => (
                            <ZoneResult
                                key={zone.id}
                                zone={zone}
                                index={i}
                                hydraulics={result.zones[i]}
                                maxVariationPct={settings.maxPressureVariationPct}
                            />
                        ))}
                    </section>

                    <section className="grid gap-4 border-t pt-4">
                        <h3 className="font-medium">ขนาดท่อ</h3>
                        <SizeSelect
                            label="ท่อแขนงอัตโนมัติ (ทุกเส้น)"
                            sizing={result.laterals}
                            onChange={(lateralSpecId) => updateSettings({ lateralSpecId })}
                        />
                        {pipes.map((pipe) => (
                            <SizeSelect
                                key={pipe.id}
                                label={pipeLabel(pipe, pipes)}
                                sizing={result.pipes[pipe.id]}
                                onChange={(specId) => setPipeSpec(pipe.id, specId)}
                            />
                        ))}
                    </section>
                </>
            )}
        </div>
    );
}

function ZoneResult({
    zone,
    index,
    hydraulics,
    maxVariationPct,
}: {
    zone: Zone;
    index: number;
    hydraulics: ZoneHydraulics;
    maxVariationPct: number;
}) {
    const updateZone = useEditor((s) => s.updateZone);
    const solution = hydraulics.solution;

    return (
        <div className="grid gap-2 rounded-md border p-2 text-sm">
            <p className="flex items-center gap-2 font-medium">
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: zoneColor(index) }} />
                {zoneLabel(zone, index)}
            </p>
            <NumberField
                label="ระดับพื้นโซน"
                unit="ม."
                min={-1000}
                max={10_000}
                value={zone.elevationM}
                onChange={(elevationM) => updateZone(zone.id, { elevationM })}
            />
            {solution ? (
                <div className="grid gap-0.5">
                    <p>อัตราไหล {formatFlow(solution.flowLph)}</p>
                    <p className="font-medium">แรงดันที่ปั๊มต้องจ่าย {formatHead(solution.requiredPressureM)}</p>
                    <p className="text-muted-foreground text-xs">
                        ตามเส้นทางวิกฤต: เมน {solution.lossesM.main.toFixed(2)} + เมนย่อย {solution.lossesM.submain.toFixed(2)} + แขนง{' '}
                        {solution.lossesM.lateral.toFixed(2)} ม. · ระดับ {solution.riseM >= 0 ? '+' : ''}
                        {solution.riseM.toFixed(1)} ม.
                    </p>
                    <p className={cn(solution.overVariation && 'text-red-600')}>
                        แรงดันหัวจ่าย {solution.emitterPressureM.min.toFixed(1)}–{solution.emitterPressureM.max.toFixed(1)} ม. (ต่างกัน{' '}
                        {solution.variationPct.toFixed(1)}%{solution.overVariation && ` เกิน ${maxVariationPct}%`})
                    </p>
                    <p>ความเร็วสูงสุด {solution.maxVelocityMps.toFixed(2)} ม./วินาที</p>
                </div>
            ) : (
                <p className="text-amber-700">ยังไม่มีท่อแขนงที่ต่อถึงแหล่งน้ำ</p>
            )}
            {hydraulics.disconnectedPlantIds.length > 0 && solution && (
                <p className="text-amber-700">ไม่นับ {hydraulics.disconnectedPlantIds.length.toLocaleString()} ต้นที่ท่อยังไม่ต่อถึงแหล่งน้ำ</p>
            )}
        </div>
    );
}
