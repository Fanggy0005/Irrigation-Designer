import { describe, expect, it } from 'vitest';
import { maxPlantsPerZone, plantFlowLph, runMinutesPerDay } from './irrigation';

describe('runMinutesPerDay', () => {
    it('runs 60 minutes to give 40 L through two 20 L/h emitters', () => {
        expect(runMinutesPerDay(40, 2, 20)).toBe(60);
    });

    it('needs at least one working emitter', () => {
        expect(() => runMinutesPerDay(40, 0, 20)).toThrow(RangeError);
        expect(() => runMinutesPerDay(40, 2, 0)).toThrow(RangeError);
    });
});

describe('plantFlowLph', () => {
    it('is emitters per plant times emitter flow', () => {
        expect(plantFlowLph(2, 35)).toBe(70);
    });
});

describe('maxPlantsPerZone', () => {
    it('fits 83 plants of 60 L/h in 5,000 L/h (83 × 60 = 4,980)', () => {
        expect(maxPlantsPerZone(5_000, 1, 60)).toBe(83);
    });

    it('counts a zone that lands exactly on the limit', () => {
        expect(maxPlantsPerZone(5_000, 1, 500)).toBe(10);
        // 0.1 L/h emitters: 3 × 0.1 is 0.30000000000000004 in floating point
        expect(maxPlantsPerZone(0.9, 3, 0.1)).toBe(3);
    });

    it('is 0 when one plant alone is over the limit', () => {
        expect(maxPlantsPerZone(100, 2, 60)).toBe(0);
    });

    it('needs a positive plant flow', () => {
        expect(() => maxPlantsPerZone(5_000, 1, 0)).toThrow(RangeError);
    });
});
