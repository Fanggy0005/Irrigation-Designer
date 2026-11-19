import { BEND_DEG, type Fittings } from '@/domain/bom';
import { useBom } from '@/editor/bom';
import { useHydraulics } from '@/editor/hydraulics';
import { zoneLabel } from '@/editor/labels';
import { usePipeLayout } from '@/editor/pipes';
import { useEditor } from '@/editor/store';
import { useZonePlants } from '@/editor/zones';
import { fixed, Row, Section, Table } from './table';

const FITTINGS: { key: keyof Fittings; label: string; rule: string }[] = [
    { key: 'zoneValves', label: 'วาล์วโซน', rule: 'โซนละ 1 ตัว' },
    { key: 'tees', label: 'สามทาง (ท่อเมน/เมนย่อย)', rule: 'ท่อที่แยกออกจากกลางท่ออีกเส้น หรือรับน้ำตรงกลางจากปลายท่ออีกเส้น' },
    { key: 'crosses', label: 'สี่ทาง (ท่อเมน/เมนย่อย)', rule: 'ท่อที่ต่อผ่านกลางท่ออีกเส้น' },
    { key: 'endJoints', label: 'ข้อต่อตรงหรือข้องอที่ปลายท่อ', rule: 'ท่อที่ต่อจากปลายท่ออีกเส้น' },
    { key: 'elbows', label: 'ข้องอ', rule: `จุดหักเลี้ยวตั้งแต่ ${BEND_DEG}° ตามแนวท่อที่วาด` },
    { key: 'lateralConnectors', label: 'ข้อต่อท่อแขนงเข้าท่อเมนย่อย', rule: 'ท่อแขนงละ 1 ตัว (2 ตัวถ้าวาดผ่านท่อเมนย่อย)' },
    { key: 'endCaps', label: 'ปลายปิด', rule: 'ปลายท่อแขนงทุกเส้นและปลายท่อเมนย่อย (ทั้งสองปลายถ้ารับน้ำตรงกลาง)' },
];

/** Pipe by size, emitters and an estimate of the fittings. */
export function BomSection() {
    const bom = useBom();
    const emitter = useEditor((s) => s.project.emitter);
    if (!bom) return null;

    return (
        <Section title="รายการวัสดุ">
            <Table head={['รายการ', 'ขนาด', 'จำนวน', 'หน่วย', 'หมายเหตุ']}>
                {bom.pipes.map((line) => (
                    <Row
                        key={line.spec.id}
                        cells={[
                            line.spec.series,
                            line.spec.nominal,
                            line.pieces ?? fixed(line.lengthM, 1),
                            line.pieces === null ? 'ม.' : 'ท่อน/ม้วน',
                            line.pieces === null
                                ? 'ยังไม่ได้กำหนดความยาวต่อท่อน/ม้วน'
                                : `รวม ${fixed(line.lengthM, 1)} ม. ท่อน/ม้วนละ ${line.pieceLengthM} ม.`,
                        ]}
                    />
                ))}
                <Row
                    cells={[
                        'หัวจ่าย',
                        `${emitter.flowLph} ลิตร/ชม. ที่ ${emitter.pressureM} ม.`,
                        bom.emitters,
                        'หัว',
                        `${emitter.perPlant} หัวต่อต้น เฉพาะต้นที่มีท่อแขนง`,
                    ]}
                />
                {FITTINGS.map((f) => (
                    <Row key={f.key} cells={[f.label, 'ตามขนาดท่อที่ต่อ', bom.fittings[f.key], 'ชิ้น', `ประมาณ: ${f.rule}`]} />
                ))}
            </Table>
            <p className="text-[11px] text-gray-600">
                ความยาวท่อวัดจากแบบ ยังไม่รวมเศษตัดและส่วนเผื่อ ข้อต่อเป็นจำนวนประมาณสำหรับสั่งของ ไม่ใช่ผังข้อต่อ
            </p>
        </Section>
    );
}

/** Problems still in the design, and where the numbers come from. */
export function ReportNotes() {
    const zones = useEditor((s) => s.project.zones);
    const { result } = useHydraulics();
    const { unservedPlantIds } = usePipeLayout();
    const { unzoned } = useZonePlants();

    const problems: string[] = [];
    if (unzoned.length > 0) problems.push(`${unzoned.length.toLocaleString()} ต้นยังไม่อยู่ในโซนใด`);
    if (unservedPlantIds.size > 0) problems.push(`${unservedPlantIds.size.toLocaleString()} ต้นในโซนยังไม่มีท่อแขนง`);
    if (result) {
        result.zones.forEach((z, i) => {
            if (z.solution?.overVariation) problems.push(`${zoneLabel(zones[i], i)}: แรงดันหัวจ่ายต่างกันเกินเกณฑ์`);
        });
        const flagged = Object.values(result.pipes).concat(result.laterals);
        if (flagged.some((s) => s.overVelocity)) problems.push('มีท่อที่ความเร็วน้ำเกินเกณฑ์ (ดูแถวสีแดงในตารางขนาดท่อ)');
        if (flagged.some((s) => s.overRating)) problems.push('มีท่อที่แรงดันเกินชั้นท่อ (ดูแถวสีแดงในตารางขนาดท่อ)');
    }
    const sources = result ? [...new Set([...Object.values(result.pipes), result.laterals].map((s) => s.spec.source))] : [];

    return (
        <Section title="หมายเหตุ">
            {problems.length > 0 && (
                <div className="text-sm text-red-700">
                    <p className="font-medium">ข้อที่ยังต้องแก้ในแบบ</p>
                    <ul className="list-disc pl-5">
                        {problems.map((p) => (
                            <li key={p}>{p}</li>
                        ))}
                    </ul>
                </div>
            )}
            <ul className="list-disc pl-5 text-[11px] text-gray-700">
                <li>
                    คำนวณการสูญเสียด้วยสูตร Hazen–Williams บวก minor loss เป็นร้อยละของการสูญเสียจากแรงเสียดทาน ค่า C ตาม USDA NRCS NEH 623 Table 7-23
                </li>
                <li>หัวจ่ายทุกหัวจ่ายน้ำตามอัตราที่กำหนด แต่ละโซนถือว่าพื้นราบที่ระดับของโซน ไม่คิดท่อเล็กจากท่อแขนงถึงต้น</li>
                <li>เทียบแรงดันกับชั้นท่อโดยไม่ลดค่าตามอุณหภูมิ (PVC อ้างอิง 27 °C, PE อ้างอิง 20 °C)</li>
                {sources.length > 0 && <li>ขนาดท่อจาก: {sources.join(' · ')}</li>}
            </ul>
        </Section>
    );
}
