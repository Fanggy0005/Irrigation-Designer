import { describe, expect, it } from 'vitest';
import { frictionLossM, velocityMps } from './pipeFlow';

/**
 * Independent check: the US-customary form of Hazen-Williams,
 *   hf (ft per 100 ft) = 0.2083 · (100/C)^1.852 · q^1.852 / d^4.8655   (q gpm, d inches).
 * Its rounded constants differ from the SI form, so the two agree to about 2%, not exactly.
 * A unit mistake (L/h vs m³/s, mm vs m) would be off by orders of magnitude.
 */
function usCustomaryLossPer100(flowLph: number, innerDiameterMm: number, c: number): number {
    const gpm = (flowLph / 3_600_000) * 15_850.323;
    const inches = innerDiameterMm / 25.4;
    return (0.2083 * (100 / c) ** 1.852 * gpm ** 1.852) / inches ** 4.8655;
}

describe('frictionLossM', () => {
    it.each([
        // flow L/h, inner diameter mm, C — from a lateral tail up to a 4" main
        [500, 13.6, 140],
        [2_000, 16, 140],
        [20_000, 55.4, 150],
        [36_000, 100, 150],
    ])('matches the US-customary formula within 2%% (%d L/h in %d mm, C=%d)', (flow, id, c) => {
        const si = frictionLossM(flow, id, 100, c);
        const us = usCustomaryLossPer100(flow, id, c);
        expect(Math.abs(si / us - 1)).toBeLessThan(0.02);
    });

    it('gives 1.46 m per 100 m for 10 L/s in a 100 mm pipe at C=150', () => {
        expect(frictionLossM(36_000, 100, 100, 150)).toBeCloseTo(1.4603, 3);
    });

    it('scales linearly with length', () => {
        expect(frictionLossM(5_000, 32, 250, 140)).toBeCloseTo(2.5 * frictionLossM(5_000, 32, 100, 140), 10);
    });

    it('is zero with no flow', () => {
        expect(frictionLossM(0, 20, 100, 140)).toBe(0);
    });

    it('rejects impossible inputs', () => {
        expect(() => frictionLossM(-1, 20, 100, 140)).toThrow(RangeError);
        expect(() => frictionLossM(100, 0, 100, 140)).toThrow(RangeError);
        expect(() => frictionLossM(100, 20, -5, 140)).toThrow(RangeError);
        expect(() => frictionLossM(100, 20, 100, 0)).toThrow(RangeError);
    });
});

describe('velocityMps', () => {
    it('gives 0.509 m/s for 1 L/s in a 50 mm pipe', () => {
        // 0.001 m³/s ÷ (π · 0.05² / 4 = 0.0019635 m²)
        expect(velocityMps(3_600, 50)).toBeCloseTo(0.5093, 4);
    });
});
