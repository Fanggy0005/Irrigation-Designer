import { describe, expect, it } from 'vitest';
import { barToMHead, kgfPerCm2ToMHead, lphToLpm, lphToM3ps, m3psToLph, mHeadToBar, mHeadToKgfPerCm2 } from './units';

describe('flow', () => {
    it('converts L/h to m³/s and back', () => {
        expect(lphToM3ps(3600)).toBeCloseTo(0.001, 12);
        expect(m3psToLph(0.001)).toBeCloseTo(3600, 9);
    });

    it('converts L/h to L/min', () => {
        expect(lphToLpm(120)).toBe(2);
    });
});

describe('pressure', () => {
    it('treats 1 bar as about 10.197 m of head', () => {
        expect(barToMHead(1)).toBeCloseTo(10.197, 3);
        expect(mHeadToBar(barToMHead(2.5))).toBeCloseTo(2.5, 12);
    });

    it('treats 1 kgf/cm² as exactly 10 m of head', () => {
        expect(kgfPerCm2ToMHead(1.5)).toBe(15);
        expect(mHeadToKgfPerCm2(15)).toBe(1.5);
    });
});
