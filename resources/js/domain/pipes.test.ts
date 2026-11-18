import { describe, expect, it } from 'vitest';
import { localFrame } from './geometry';
import { connectPipes, type PipeLine } from './pipes';

const frame = localFrame({ lat: 14, lng: 101 });
const line = (id: string, kind: PipeLine['kind'], ...points: [number, number][]): PipeLine => ({
    id,
    kind,
    path: points.map(([x, y]) => frame.toLatLng({ x, y })),
});
const source = frame.toLatLng({ x: 0, y: 0 });

describe('connectPipes', () => {
    //  source ── main m1 (100 m east) ── main m2 (north from 60 m along m1)
    //                                      └── submain s1 (east from m2's end)
    const m1 = line('m1', 'main', [0, 0], [100, 0]);
    const m2 = line('m2', 'main', [60, 0], [60, 50]);
    const s1 = line('s1', 'submain', [60, 50], [90, 50]);

    it('follows the tree from the source, recording where each pipe tees off', () => {
        const result = connectPipes(source, [m1, m2, s1]);
        expect(result.m1).toEqual({ fromPipeId: null, atM: 0, reversed: false });
        expect(result.m2.fromPipeId).toBe('m1');
        expect(result.m2.atM).toBeCloseTo(60, 6);
        expect(result.s1.fromPipeId).toBe('m2');
        expect(result.s1.atM).toBeCloseTo(50, 6);
    });

    it('does not depend on the order the pipes were drawn in', () => {
        const result = connectPipes(source, [s1, m2, m1]);
        expect(Object.keys(result).sort()).toEqual(['m1', 'm2', 's1']);
    });

    it('accepts a pipe drawn towards its feed', () => {
        const backwards = line('m2', 'main', [60, 50], [60, 0.4]); // ends 0.4 m short of m1: within tolerance
        const result = connectPipes(source, [m1, backwards]);
        expect(result.m2).toMatchObject({ fromPipeId: 'm1', reversed: true });
    });

    it('leaves out pipes that do not reach a feed', () => {
        const gap = line('m2', 'main', [60, 5], [60, 50]); // 5 m short of m1
        const result = connectPipes(source, [m1, gap, s1]);
        expect(result.m2).toBeUndefined();
        expect(result.s1).toBeUndefined(); // fed only through m2
    });

    it('lets each kind take water only from what may feed it', () => {
        // A lateral cannot come straight off a main, nor a main off a submain.
        const lateral = line('l1', 'lateral', [30, 0], [30, 20]);
        const mainOffSubmain = line('m3', 'main', [90, 50], [90, 80]);
        const result = connectPipes(source, [m1, m2, s1, lateral, mainOffSubmain]);
        expect(result.l1).toBeUndefined();
        expect(result.m3).toBeUndefined();

        const lateralOffSubmain = line('l2', 'lateral', [75, 50], [75, 70]);
        expect(connectPipes(source, [m1, m2, s1, lateralOffSubmain]).l2).toMatchObject({ fromPipeId: 's1' });
    });

    it('lets a submain start at the source when there is no main', () => {
        expect(connectPipes(source, [line('s1', 'submain', [0, 0], [0, 40])]).s1).toMatchObject({ fromPipeId: null });
    });

    it('connects nothing without a water source', () => {
        expect(connectPipes(null, [m1, m2])).toEqual({});
    });
});
