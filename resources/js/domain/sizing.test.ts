import { describe, expect, it } from 'vitest';
import { suggestPipeSize } from './sizing';

// Deliberately out of order: the function must not rely on the caller sorting.
const sizes = [
    { id: 'd34', innerDiameterMm: 34 },
    { id: 'd20', innerDiameterMm: 20 },
    { id: 'd26', innerDiameterMm: 26 },
];

describe('suggestPipeSize', () => {
    it('picks the smallest size at or under the velocity limit', () => {
        // 2,000 L/h: 1.77 m/s in 20 mm (too fast), 1.05 m/s in 26 mm
        const suggestion = suggestPipeSize(2_000, sizes, 1.5);
        expect(suggestion.size.id).toBe('d26');
        expect(suggestion.velocityMps).toBeCloseTo(1.046, 3);
        expect(suggestion.withinLimit).toBe(true);
    });

    it('accepts a velocity exactly at the limit', () => {
        const flowAtLimit = 1.5 * ((Math.PI * 0.02 ** 2) / 4) * 3_600_000;
        expect(suggestPipeSize(flowAtLimit, sizes, 1.5).size.id).toBe('d20');
    });

    it('falls back to the largest size and flags it when nothing is slow enough', () => {
        const suggestion = suggestPipeSize(20_000, sizes, 1.5);
        expect(suggestion.size.id).toBe('d34');
        expect(suggestion.withinLimit).toBe(false);
    });

    it('needs at least one size', () => {
        expect(() => suggestPipeSize(100, [], 1.5)).toThrow();
    });
});
