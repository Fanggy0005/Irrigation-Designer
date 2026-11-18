import { Button } from '@/components/ui/button';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';

export default function Welcome() {
    const { auth } = usePage<SharedData>().props;

    return (
        <>
            <Head title="ออกแบบระบบน้ำสวนไม้ผล" />
            <main className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
                <h1 className="text-3xl font-semibold">Irrigation Designer</h1>
                <p className="text-muted-foreground max-w-md">ออกแบบระบบน้ำสวนไม้ผลบนแผนที่ คำนวณขนาดท่อ แรงดัน และปั๊ม พร้อมรายการวัสดุ</p>
                <nav className="flex gap-3">
                    {auth.user ? (
                        <Button asChild>
                            <Link href={route('dashboard')}>เข้าสู่ระบบงาน</Link>
                        </Button>
                    ) : (
                        <>
                            <Button asChild>
                                <Link href={route('login')}>เข้าสู่ระบบ</Link>
                            </Button>
                            <Button asChild variant="outline">
                                <Link href={route('register')}>สมัครสมาชิก</Link>
                            </Button>
                        </>
                    )}
                </nav>
            </main>
        </>
    );
}
