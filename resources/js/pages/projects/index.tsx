import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import { type FormEvent } from 'react';

type ProjectSummary = { id: number; name: string; updated_at: string };

export default function Projects({ projects }: { projects: ProjectSummary[] }) {
    const form = useForm({ name: '' });

    const create = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('projects.store'));
    };

    return (
        <AppLayout breadcrumbs={[{ title: 'โครงการ', href: route('projects.index') }]}>
            <Head title="โครงการ" />
            <div className="grid max-w-3xl gap-6 p-4">
                <form onSubmit={create} className="grid gap-2">
                    <h1 className="text-lg font-semibold">สร้างโครงการใหม่</h1>
                    <div className="flex gap-2">
                        <Input
                            value={form.data.name}
                            onChange={(e) => form.setData('name', e.target.value)}
                            placeholder="ชื่อโครงการ เช่น สวนทุเรียน นายสมชาย"
                            maxLength={255}
                            aria-label="ชื่อโครงการ"
                        />
                        <Button type="submit" disabled={form.processing}>
                            สร้าง
                        </Button>
                    </div>
                    <InputError message={form.errors.name} />
                </form>

                <section className="grid gap-2">
                    <h2 className="text-lg font-semibold">โครงการของฉัน</h2>
                    {projects.length === 0 && <p className="text-muted-foreground">ยังไม่มีโครงการ</p>}
                    <ul className="divide-y rounded-md border">
                        {projects.map((project) => (
                            <li key={project.id} className="flex items-center justify-between gap-2 p-3">
                                <Link href={route('projects.edit', project.id)} className="grid hover:underline">
                                    <span className="font-medium">{project.name}</span>
                                    <span className="text-muted-foreground text-xs">
                                        แก้ไขล่าสุด {new Date(project.updated_at).toLocaleString('th-TH')}
                                    </span>
                                </Link>
                                <DeleteProject project={project} />
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </AppLayout>
    );
}

function DeleteProject({ project }: { project: ProjectSummary }) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`ลบ ${project.name}`}>
                    <Trash2 className="size-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>ลบโครงการ “{project.name}”?</DialogTitle>
                <DialogDescription>แบบทั้งหมดในโครงการนี้จะถูกลบและกู้คืนไม่ได้</DialogDescription>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">ยกเลิก</Button>
                    </DialogClose>
                    <Button variant="destructive" onClick={() => router.delete(route('projects.destroy', project.id))}>
                        ลบโครงการ
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
