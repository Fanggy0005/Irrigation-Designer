import { describe, expect, it } from 'vitest';
import { localFrame } from './geometry';
import { connectPipes, missedJoints, type PipeLine } from './pipes';

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
        expect(result.m1).toMatchObject({ fromPipeId: null, atM: 0, entryM: 0 });
        expect(result.m2).toMatchObject({ fromPipeId: 'm1', entryM: 0 });
        expect(result.m2.atM).toBeCloseTo(60, 6);
        expect(frame.toLocal(result.m2.point).x).toBeCloseTo(60, 6);
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
        expect(result.m2.fromPipeId).toBe('m1');
        expect(result.m2.entryM).toBeCloseTo(49.6, 6); // water enters at its last point
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

describe('joints in the middle of a pipe', () => {
    const m1 = line('m1', 'main', [0, 0], [100, 0]);

    it('feeds a pipe from the middle where another pipe ends on it', () => {
        // m1 ends against the middle of s1: an upside-down T.
        const s1 = line('s1', 'submain', [100, -20], [100, 20]);
        const result = connectPipes(source, [m1, s1]);
        expect(result.s1.fromPipeId).toBe('m1');
        expect(result.s1.atM).toBeCloseTo(100, 6);
        expect(result.s1.entryM).toBeCloseTo(20, 6);
        expect(frame.toLocal(result.s1.point)).toMatchObject({ x: expect.closeTo(100, 6), y: expect.closeTo(0, 6) });
    });

    it('feeds a pipe from the middle where one of its points sits on another pipe', () => {
        // s2 crosses m1 with a point placed on it: a cross.
        const s2 = line('s2', 'submain', [50, -20], [50, 0], [50, 30]);
        const result = connectPipes(source, [m1, s2]);
        expect(result.s2.fromPipeId).toBe('m1');
        expect(result.s2.atM).toBeCloseTo(50, 6);
        expect(result.s2.entryM).toBeCloseTo(20, 6);
    });

    it('does not join pipes that only cross', () => {
        const s3 = line('s3', 'submain', [50, -20], [50, 30]);
        expect(connectPipes(source, [m1, s3]).s3).toBeUndefined();
    });

    it('keeps the joint at an end when an end touches', () => {
        // s4 starts on m1's end, and m1's end is also on s4: the end joint wins.
        const s4 = line('s4', 'submain', [100, 0], [100, 40]);
        expect(connectPipes(source, [m1, s4]).s4).toMatchObject({ fromPipeId: 'm1', entryM: 0 });
    });

    it('still lets only what may feed a pipe feed it', () => {
        // A main cannot take water from a submain, whichever way they meet.
        const s1 = line('s1', 'submain', [0, 0], [0, 50]); // fed straight from the source
        const m5 = line('m5', 'main', [-20, 50], [20, 50]); // s1 ends on its middle
        const m6 = line('m6', 'main', [-20, 30], [0, 30], [20, 30]); // has a point on s1's middle
        const result = connectPipes(source, [s1, m5, m6]);
        expect(result.m5).toBeUndefined();
        expect(result.m6).toBeUndefined();
    });
});

describe('missedJoints', () => {
    const m1 = line('m1', 'main', [0, 0], [100, 0]);

    it('finds a pipe left unconnected where it crosses a pipe that could feed it', () => {
        const s3 = line('s3', 'submain', [50, -20], [50, 30]);
        const pipes = [m1, s3];
        expect(missedJoints(source, pipes, connectPipes(source, pipes))).toEqual({ s3: 'm1' });
    });

    it('says nothing of pipes that are connected or could not take water from what they cross', () => {
        const joined = line('s2', 'submain', [50, -20], [50, 0], [50, 30]);
        const lateral = line('l1', 'lateral', [30, -10], [30, 10]); // a lateral cannot come off a main
        const pipes = [m1, joined, lateral];
        expect(missedJoints(source, pipes, connectPipes(source, pipes))).toEqual({});
    });
});
