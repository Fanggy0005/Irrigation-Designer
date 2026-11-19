import { cn } from '@/lib/utils';
import { type ReactNode } from 'react';

/** Small print-friendly table pieces for the report. */

export function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="grid gap-2">
            <h2 className="break-after-avoid border-b border-gray-400 pb-1 text-base font-semibold">{title}</h2>
            {children}
        </section>
    );
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
    return (
        <table className="w-full border-collapse text-[11px] leading-tight">
            <thead>
                <tr className="bg-gray-100">
                    {head.map((cell, i) => (
                        <th key={i} className="border border-gray-300 px-1 py-1 text-left font-medium">
                            {cell}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>{children}</tbody>
        </table>
    );
}

export function Row({ cells, warn = false }: { cells: ReactNode[]; warn?: boolean }) {
    return (
        <tr className={cn('break-inside-avoid', warn && 'text-red-700')}>
            {cells.map((cell, i) => (
                <td key={i} className={cn('border border-gray-300 px-1 py-0.5', typeof cell === 'number' && 'text-right')}>
                    {cell}
                </td>
            ))}
        </tr>
    );
}

export const fixed = (value: number, digits: number) => value.toFixed(digits);
