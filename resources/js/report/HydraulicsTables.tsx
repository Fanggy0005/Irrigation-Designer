import { pathLengthM } from '@/domain/geometry';
import { pumpDuties } from '@/domain/hydraulics/designHydraulics';
import { runMinutesPerDay } from '@/domain/irrigation';
import { useHydraulics } from '@/editor/hydraulics';
import { PIPE_KIND_LABELS, pipeLabel, zoneLabel } from '@/editor/labels';
import { formatMinutes } from '@/editor/panel/controls';
import { usePipeLayout } from '@/editor/pipes';
import { useEditor } from '@/editor/store';
import { useZonePlants } from '@/editor/zones';
import { fixed, Row, Section, Table } from './table';

/** Each zone's flow, run time and pressures with the pump it needs, then every pipe's size. */
export function HydraulicsTables() {
    const { result } = useHydraulics();
    if (!result) return null;
    return (
        <>
            <ZoneTable />
            <PumpTable />
            <PipeTable />
        </>
    );
}

function ZoneTable() {
    const zones = useEditor((s) => s.project.zones);
    const emitter = useEditor((s) => s.project.emitter);
    const waterLPerDay = useEditor((s) => s.project.planting.waterLPerDay);
    const zonePlants = useZonePlants();
    const { result } = useHydraulics();
    const suggested = waterLPerDay > 0 ? runMinutesPerDay(waterLPerDay, emitter.perPlant, emitter.flowLph) : null;

    return (
        <Section title="ชลศาสตร์แต่ละโซน (เปิดทีละโซน)">
            <Table
                head={[
                    'โซน',
                    'ต้น',
                    'Q (ม³/ชม.)',
                    'เวลา/วัน',
                    'แรงดันที่ปั๊ม (ม.)',
                    'สูญเสีย เมน / ย่อย / แขนง (ม.)',
                    'ระดับ (ม.)',
                    'แรงดันหัวจ่าย (ม.)',
                    'ต่างกัน',
                    'v สูงสุด (ม./วิ)',
                ]}
            >
                {zones.map((zone, i) => {
                    const solution = result!.zones[i]?.solution;
                    const minutes = zone.runMinutes ?? suggested;
                    const plants = zonePlants.zones[i]?.plants.length ?? 0;
                    if (!solution)
                        return (
                            <Row
                                key={zone.id}
                                warn
                                cells={[zoneLabel(zone, i), plants, 'ยังไม่มีท่อแขนงที่ต่อถึงแหล่งน้ำ', '', '', '', '', '', '', '']}
                            />
                        );
                    const { lossesM: l, emitterPressureM: p } = solution;
                    return (
                        <Row
                            key={zone.id}
                            warn={solution.overVariation}
                            cells={[
                                zoneLabel(zone, i),
                                plants,
                                fixed(solution.flowLph / 1000, 2),
                                minutes === null ? '–' : formatMinutes(minutes),
                                fixed(solution.requiredPressureM, 1),
                                `${fixed(l.main, 2)} / ${fixed(l.submain, 2)} / ${fixed(l.lateral, 2)}`,
                                `${solution.riseM >= 0 ? '+' : ''}${fixed(solution.riseM, 1)}`,
                                `${fixed(p.min, 1)}–${fixed(p.max, 1)}`,
                                `${fixed(solution.variationPct, 1)}%`,
                                fixed(solution.maxVelocityMps, 2),
                            ]}
                        />
                    );
                })}
            </Table>
            <p className="text-[11px] text-gray-600">
                หัวจ่าย {emitter.flowLph} ลิตร/ชม. ที่ {emitter.pressureM} ม. จำนวน {emitter.perPlant} หัวต่อต้น ·
                แรงดันที่ปั๊มคือแรงดันขาออกที่ทำให้หัวจ่ายที่ไกลที่สุดได้แรงดันใช้งานพอดี
            </p>
        </Section>
    );
}

function PumpTable() {
    const zones = useEditor((s) => s.project.zones);
    const pump = useEditor((s) => s.project.pump);
    const { result } = useHydraulics();
    const { duties, heaviestZoneId } = pumpDuties(result!.zones, pump);
    if (heaviestZoneId === null) return null;
    const heaviest = duties[heaviestZoneId];
    const name = (id: string) =>
        zoneLabel(
            zones.find((z) => z.id === id),
            zones.findIndex((z) => z.id === id),
        );

    return (
        <Section title="ปั๊ม">
            <p className="text-sm">
                จุดทำงาน ({name(heaviestZoneId)}): <b>Q {fixed(heaviest.flowM3ph, 2)} ม³/ชม.</b> ({fixed(heaviest.flowLph / 60, 0)} ลิตร/นาที) ·{' '}
                <b>TDH {fixed(heaviest.totalHeadM, 1)} ม.</b> · กำลังที่เพลา {fixed(heaviest.shaftPowerKw, 2)} kW ({fixed(heaviest.shaftPowerHp, 2)}{' '}
                แรงม้า)
            </p>
            <Table head={['โซน', 'Q (ม³/ชม.)', 'TDH (ม.)', 'กำลังที่ให้น้ำ (kW)', 'กำลังที่เพลา (kW)']}>
                {Object.entries(duties).map(([zoneId, duty]) => (
                    <Row
                        key={zoneId}
                        cells={[
                            name(zoneId),
                            fixed(duty.flowM3ph, 2),
                            fixed(duty.totalHeadM, 1),
                            fixed(duty.hydraulicPowerKw, 2),
                            fixed(duty.shaftPowerKw, 2),
                        ]}
                    />
                ))}
            </Table>
            <p className="text-[11px] text-gray-600">
                ความสูงดูด {pump.suctionLiftM} ม. · การสูญเสียในท่อดูด {pump.suctionLossM} ม. · ประสิทธิภาพปั๊ม {pump.efficiencyPct}% ·
                ยังไม่ได้เลือกรุ่นปั๊ม ให้เทียบ Q และ TDH ของทุกโซนกับกราฟปั๊ม
            </p>
        </Section>
    );
}

function PipeTable() {
    const pipes = useEditor((s) => s.project.pipes);
    const zones = useEditor((s) => s.project.zones);
    const { pipeZones, laterals } = usePipeLayout();
    const { result } = useHydraulics();
    const generated = laterals.filter((l) => l.pipeId === null);
    const zoneName = (id: string | null | undefined) =>
        id
            ? zoneLabel(
                  zones.find((z) => z.id === id),
                  zones.findIndex((z) => z.id === id),
              )
            : '–';
    const lateralSizing = result!.laterals;

    return (
        <Section title="ขนาดท่อ">
            <Table head={['ท่อ', 'โซน', 'ขนาด', 'ยาว (ม.)', 'Q ออกแบบ (ลิตร/ชม.)', 'v (ม./วิ)', 'แรงดันสูงสุด / ชั้นท่อ (ม.)']}>
                {pipes.map((pipe) => {
                    const sizing = result!.pipes[pipe.id];
                    return (
                        <Row
                            key={pipe.id}
                            warn={sizing.overVelocity || sizing.overRating}
                            cells={[
                                pipeLabel(pipe, pipes),
                                pipe.kind === 'main' ? '–' : zoneName(pipeZones[pipe.id]),
                                `${sizing.spec.series} ${sizing.spec.nominal}`,
                                fixed(pathLengthM(pipe.path), 1),
                                Math.round(sizing.designFlowLph),
                                fixed(sizing.velocityMps, 2),
                                `${sizing.maxPressureM === null ? '–' : fixed(sizing.maxPressureM, 1)} / ${fixed(sizing.spec.ratingM, 0)}`,
                            ]}
                        />
                    );
                })}
                {generated.length > 0 && (
                    <Row
                        warn={lateralSizing.overVelocity || lateralSizing.overRating}
                        cells={[
                            `${PIPE_KIND_LABELS.lateral}อัตโนมัติ ${generated.length} เส้น`,
                            'ทุกโซน',
                            `${lateralSizing.spec.series} ${lateralSizing.spec.nominal}`,
                            fixed(
                                generated.reduce((sum, l) => sum + pathLengthM(l.path), 0),
                                1,
                            ),
                            Math.round(lateralSizing.designFlowLph),
                            fixed(lateralSizing.velocityMps, 2),
                            `${lateralSizing.maxPressureM === null ? '–' : fixed(lateralSizing.maxPressureM, 1)} / ${fixed(lateralSizing.spec.ratingM, 0)}`,
                        ]}
                    />
                )}
            </Table>
        </Section>
    );
}
