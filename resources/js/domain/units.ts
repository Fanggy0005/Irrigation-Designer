/**
 * The app stores and computes in one set of units:
 *   length m, inner diameter mm, flow L/h, pressure m of water head.
 * Convert only at the edges (user input, display, formulas that need SI).
 */

const STANDARD_GRAVITY = 9.80665; // m/s²
const WATER_DENSITY = 1000; // kg/m³
const PA_PER_M_HEAD = WATER_DENSITY * STANDARD_GRAVITY;

export function lphToM3ps(lph: number): number {
    return lph / 3_600_000;
}

export function m3psToLph(m3ps: number): number {
    return m3ps * 3_600_000;
}

export function lphToLpm(lph: number): number {
    return lph / 60;
}

export function barToMHead(bar: number): number {
    return (bar * 100_000) / PA_PER_M_HEAD;
}

export function mHeadToBar(m: number): number {
    return (m * PA_PER_M_HEAD) / 100_000;
}

/** 1 kgf/cm² is exactly 10 m of water head. */
export function kgfPerCm2ToMHead(kgfPerCm2: number): number {
    return kgfPerCm2 * 10;
}

export function mHeadToKgfPerCm2(m: number): number {
    return m / 10;
}

/** Thai land units: 1 rai = 4 ngan = 400 square wa = 1,600 m². */
export function m2ToRaiNganWa(m2: number): { rai: number; ngan: number; wa: number } {
    const totalWa = m2 / 4;
    const rai = Math.floor(totalWa / 400);
    const ngan = Math.floor((totalWa - rai * 400) / 100);
    return { rai, ngan, wa: totalWa - rai * 400 - ngan * 100 };
}
