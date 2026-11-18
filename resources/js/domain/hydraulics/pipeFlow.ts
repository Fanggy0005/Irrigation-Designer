import { lphToM3ps } from '../units';

/**
 * Hazen-Williams friction loss, SI form:
 *   hf = 10.67 · L · Q^1.852 / (C^1.852 · D^4.8704)    (hf, L, D in m; Q in m³/s)
 * Valid for water at ordinary temperatures in turbulent flow, which covers
 * irrigation mains and submains. Very low flows at the tail of a lateral are laminar,
 * where the formula overestimates loss slightly (the safe side for design).
 */
export function frictionLossM(flowLph: number, innerDiameterMm: number, lengthM: number, c: number): number {
    if (flowLph < 0) throw new RangeError(`flow must be >= 0, got ${flowLph}`);
    if (innerDiameterMm <= 0) throw new RangeError(`inner diameter must be > 0, got ${innerDiameterMm}`);
    if (lengthM < 0) throw new RangeError(`length must be >= 0, got ${lengthM}`);
    if (c <= 0) throw new RangeError(`Hazen-Williams C must be > 0, got ${c}`);

    const q = lphToM3ps(flowLph);
    const d = innerDiameterMm / 1000;
    return (10.67 * lengthM * q ** 1.852) / (c ** 1.852 * d ** 4.8704);
}

export function velocityMps(flowLph: number, innerDiameterMm: number): number {
    if (innerDiameterMm <= 0) throw new RangeError(`inner diameter must be > 0, got ${innerDiameterMm}`);

    const d = innerDiameterMm / 1000;
    return lphToM3ps(flowLph) / ((Math.PI * d * d) / 4);
}
