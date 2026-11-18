import { useEditor } from '../store';
import { Hint, ToolButton } from './controls';

export function SiteStep() {
    const waterSource = useEditor((s) => s.project.site.waterSource);

    return (
        <div className="grid gap-4">
            <Hint>ค้นหาตำแหน่งสวนจากช่องค้นหาบนแผนที่ แล้วปักจุดแหล่งน้ำ เช่น ปั๊มหรือบ่อ</Hint>
            <ToolButton tool="placeWaterSource" activeLabel="คลิกบนแผนที่เพื่อวางจุด (กดอีกครั้งเพื่อยกเลิก)">
                {waterSource ? 'ย้ายจุดแหล่งน้ำ' : 'ปักจุดแหล่งน้ำ'}
            </ToolButton>
            {waterSource && (
                <p className="text-sm">
                    แหล่งน้ำ: {waterSource.lat.toFixed(6)}, {waterSource.lng.toFixed(6)}
                </p>
            )}
        </div>
    );
}
