import { lphToM3ps } from '../units';

const WATER_SPECIFIC_WEIGHT_KN_PER_M3 = 9.80665; // ρg for water, kN/m³
const WATTS_PER_HP = 745.7; // mechanical horsepower, as on Thai pump nameplates

export type PumpDutyInput = {
    flowLph: number;
    /** Pressure needed at the pump outlet, m: the network's required root pressure. */
    dischargePressureM: number;
    /** Height of the pump above the water surface, m. Negative when the pump sits below it. */
    suctionLiftM: number;
    /** Friction in the suction pipe and foot valve, m. */
    suctionLossM: number;
    /** Overall pump efficiency, 0–1. */
    efficiency: number;
};

export type PumpDuty = {
    flowLph: number;
    flowM3ph: number;
    totalHeadM: number;
    /** Power delivered to the water. */
    hydraulicPowerKw: number;
    /** Power the motor must supply to the pump shaft. */
    shaftPowerKw: number;
    shaftPowerHp: number;
};

export function pumpDuty(input: PumpDutyInput): PumpDuty {
    if (input.flowLph < 0) throw new RangeError(`flow must be >= 0, got ${input.flowLph}`);
    if (!(input.efficiency > 0 && input.efficiency <= 1)) throw new RangeError(`efficiency must be in (0, 1], got ${input.efficiency}`);

    const totalHeadM = input.dischargePressureM + input.suctionLiftM + input.suctionLossM;
    const hydraulicPowerKw = WATER_SPECIFIC_WEIGHT_KN_PER_M3 * lphToM3ps(input.flowLph) * totalHeadM;
    const shaftPowerKw = hydraulicPowerKw / input.efficiency;

    return {
        flowLph: input.flowLph,
        flowM3ph: input.flowLph / 1000,
        totalHeadM,
        hydraulicPowerKw,
        shaftPowerKw,
        shaftPowerHp: (shaftPowerKw * 1000) / WATTS_PER_HP,
    };
}
