import { describe, expect, it } from 'vitest';
import { type BomInput, billOfMaterials } from './bom';
import { series } from './data/pipes';
import { localFrame } from './geometry';
import { type Lateral } from './laterals';
import { connectPipes } from './pipes';

const frame = localFrame({ lat: 14, lng: 101 });
const at = (x: number, y: number) => frame.toLatLng({ x, y });

const [pvcSmall, pvcLarge] = series({ idPrefix: 'P', material: 'PVC', series: 'PVC test', ratingM: 80, source: 'test' }, [
    { nominal: 'small', outerDiameterMm: 26, wallMm: 2 },
    { nominal: 'large', outerDiameterMm: 48, wallMm: 2 },
]);
const [lateralSpec] = series({ idPrefix: 'L', material: 'PE', series: 'PE test', ratingM: 40, source: 'test' }, [
    { nominal: '16', outerDiameterMm: 16, wallMm: 1.2 },
]);

// Source at (0, 0). Main m1 runs 100 m east, then turns 90° north for 50 m. Main m2 carries on
// from m1's far end. Submain s1 tees off the middle of m1 and runs 40 m south.
const pipes: BomInput['pipes'] = [
    { id: 'm1', kind: 'main', path: [at(0, 0), at(100, 0), at(100, 50)] },
    { id: 'm2', kind: 'main', path: [at(100, 50), at(100, 80)] },
    { id: 's1', kind: 'submain', path: [at(40, 0), at(40, -40)] },
];
const lateral = (id: string, x0: number, x1: number, plants: number): Lateral => ({
    id,
    zoneId: 'z1',
    path: [at(x0, -10), at(x1, -10)],
    plantIds: Array.from({ length: plants }, (_, i) => `${id}-${i}`),
    pipeId: null,
    submainId: 's1',
});
const laterals = [lateral('a', 40, 10, 6), lateral('b', 40, 75, 7)];

const input = (overrides: Partial<BomInput> = {}): BomInput => ({
    pipes,
    pipeSpecs: { m1: pvcLarge, m2: pvcLarge, s1: pvcSmall },
    laterals,
    lateralSpec,
    connections: connectPipes(at(0, 0), pipes),
    emittersPerPlant: 2,
    pieceLengthM: {},
    ...overrides,
});

describe('billOfMaterials', () => {
    it('adds up pipe length by size', () => {
        const { pipes: lines } = billOfMaterials(input());
        const byId = Object.fromEntries(lines.map((l) => [l.spec.id, l.lengthM]));
        expect(byId['P-48']).toBeCloseTo(150 + 30, 3);
        expect(byId['P-26']).toBeCloseTo(40, 3);
        expect(byId['L-16']).toBeCloseTo(30 + 35, 3);
    });

    it('rounds up to whole pieces when the series has a piece length, and leaves metres only otherwise', () => {
        const { pipes: lines } = billOfMaterials(input({ pieceLengthM: { 'PVC test': 4 } }));
        const large = lines.find((l) => l.spec.id === 'P-48')!;
        expect(large).toMatchObject({ pieceLengthM: 4, pieces: 45 }); // 180 m / 4 m
        expect(lines.find((l) => l.spec.id === 'P-26')!.pieces).toBe(10); // exactly 40 m
        expect(lines.find((l) => l.spec.id === 'L-16')).toMatchObject({ pieceLengthM: null, pieces: null });
    });

    it('counts emitters on the laterals', () => {
        expect(billOfMaterials(input()).emitters).toBe((6 + 7) * 2);
    });

    it('estimates fittings from how the pipes join', () => {
        expect(billOfMaterials(input()).fittings).toEqual({
            tees: 1, // s1 off the middle of m1
            endJoints: 1, // m2 from the end of m1
            elbows: 1, // m1 turns north
            lateralConnectors: 2,
            endCaps: 2 + 1, // two laterals and the submain
            zoneValves: 1,
        });
    });

    it('ignores gentle bends', () => {
        const gentle = [{ id: 'm1', kind: 'main' as const, path: [at(0, 0), at(100, 0), at(200, 20)] }]; // about 11°
        expect(billOfMaterials(input({ pipes: gentle, pipeSpecs: { m1: pvcLarge }, connections: {} })).fittings.elbows).toBe(0);
    });
});
