import { describe, expect, it } from 'vitest';
import { barToMHead, kgfPerCm2ToMHead, lphToLpm, lphToM3ps, m2ToRaiNganWa, m3psToLph, mHeadToBar, mHeadToKgfPerCm2 } from './units';

describe('area', () => {
    it('splits square metres into rai, ngan and square wa', () => {
        expect(m2ToRaiNganWa(1_600)).toEqual({ rai: 1, ngan: 0, wa: 0 });
        expect(m2ToRaiNganWa(2_004)).toEqual({ rai: 1, ngan: 1, wa: 1 });
        expect(m2ToRaiNganWa(1_599)).toEqual({ rai: 0, ngan: 3, wa: 99.75 });
    });
});

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
