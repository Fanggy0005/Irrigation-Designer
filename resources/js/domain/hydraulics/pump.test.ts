import { describe, expect, it } from 'vitest';
import { pumpDuty } from './pump';

describe('pumpDuty', () => {
    it('works out head and power for 10 L/s at 30 m', () => {
        // H = 25 + 4 + 1 = 30 m
        // P_water = 9.80665 kN/m³ × 0.01 m³/s × 30 m = 2.942 kW
        // P_shaft = 2.942 / 0.6 = 4.903 kW = 6.58 hp
        const duty = pumpDuty({ flowLph: 36_000, dischargePressureM: 25, suctionLiftM: 4, suctionLossM: 1, efficiency: 0.6 });
        expect(duty.flowM3ph).toBe(36);
        expect(duty.totalHeadM).toBe(30);
        expect(duty.hydraulicPowerKw).toBeCloseTo(2.942, 3);
        expect(duty.shaftPowerKw).toBeCloseTo(4.903, 3);
        expect(duty.shaftPowerHp).toBeCloseTo(6.5755, 3); // 4,903.3 W ÷ 745.7 W/hp
    });

    it('subtracts the lift when the pump sits below the water surface', () => {
        const duty = pumpDuty({ flowLph: 36_000, dischargePressureM: 25, suctionLiftM: -2, suctionLossM: 1, efficiency: 0.6 });
        expect(duty.totalHeadM).toBe(24);
    });

    it('rejects an efficiency outside (0, 1]', () => {
        const base = { flowLph: 1_000, dischargePressureM: 20, suctionLiftM: 0, suctionLossM: 0 };
        expect(() => pumpDuty({ ...base, efficiency: 0 })).toThrow(RangeError);
        expect(() => pumpDuty({ ...base, efficiency: 60 })).toThrow(RangeError);
    });
});
