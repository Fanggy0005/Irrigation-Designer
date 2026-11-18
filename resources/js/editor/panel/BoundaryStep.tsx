import { Button } from '@/components/ui/button';
import { polygonAreaM2 } from '@/domain/geometry';
import { Trash2 } from 'lucide-react';
import { useEditor } from '../store';
import { formatArea, Hint, ToolButton } from './controls';

export function BoundaryStep() {
    const boundary = useEditor((s) => s.project.boundary);
    const exclusions = useEditor((s) => s.project.exclusions);
    const removeExclusion = useEditor((s) => s.removeExclusion);
    const hasBoundary = boundary.length >= 3;

    return (
        <div className="grid gap-4">
            <Hint>คลิกบนแผนที่ทีละมุม แล้วคลิกที่จุดแรกเพื่อปิดรูป</Hint>

            {hasBoundary ? (
                <>
                    <p className="text-sm font-medium">พื้นที่แปลง {formatArea(polygonAreaM2(boundary))}</p>
                    <ToolButton tool="editBoundary" activeLabel="เสร็จสิ้นการแก้ไข">
                        แก้ไขจุดมุม
                    </ToolButton>
                    <ToolButton tool="drawBoundary" activeLabel="ยกเลิกการวาด">
                        วาดขอบเขตใหม่
                    </ToolButton>
                </>
            ) : (
                <ToolButton tool="drawBoundary" activeLabel="ยกเลิกการวาด">
                    วาดขอบเขตแปลง
                </ToolButton>
            )}

            {hasBoundary && (
                <section className="grid gap-2 border-t pt-4">
                    <h3 className="font-medium">พื้นที่ยกเว้น</h3>
                    <Hint>บริเวณที่ปลูกไม่ได้ เช่น บ่อ บ้าน หรือถนน</Hint>
                    {exclusions.map((ring, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 text-sm">
                            <span>
                                #{i + 1} · {formatArea(polygonAreaM2(ring))}
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeExclusion(i)}
                                aria-label={`ลบพื้นที่ยกเว้น ${i + 1}`}
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        </div>
                    ))}
                    <ToolButton tool="drawExclusion" activeLabel="ยกเลิกการวาด">
                        เพิ่มพื้นที่ยกเว้น
                    </ToolButton>
                </section>
            )}
        </div>
    );
}
