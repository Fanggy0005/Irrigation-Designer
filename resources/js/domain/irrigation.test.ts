import { describe, expect, it } from 'vitest';
import { runMinutesPerDay } from './irrigation';

describe('runMinutesPerDay', () => {
    it('runs 60 minutes to give 40 L through two 20 L/h emitters', () => {
        expect(runMinutesPerDay(40, 2, 20)).toBe(60);
    });

    it('needs at least one working emitter', () => {
        expect(() => runMinutesPerDay(40, 0, 20)).toThrow(RangeError);
        expect(() => runMinutesPerDay(40, 2, 0)).toThrow(RangeError);
    });
});
