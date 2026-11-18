/** Flow to one plant while its zone runs, L/h. */
export function plantFlowLph(emittersPerPlant: number, emitterFlowLph: number): number {
    return emittersPerPlant * emitterFlowLph;
}

/**
 * Most plants one zone can hold without drawing more than `maxZoneFlowLph`.
 * 0 when even one plant needs more.
 */
export function maxPlantsPerZone(maxZoneFlowLph: number, emittersPerPlant: number, emitterFlowLph: number): number {
    const perPlant = plantFlowLph(emittersPerPlant, emitterFlowLph);
    if (!(perPlant > 0)) throw new RangeError('each plant needs at least one emitter with a positive flow');
    // Rounding slack, so 10 plants of 500 L/h fit a 5,000 L/h limit despite floating point.
    return Math.floor(maxZoneFlowLph / perPlant + 1e-9);
}

/** Minutes a zone must run each day to give every plant its daily water. */
export function runMinutesPerDay(waterLPerPlantPerDay: number, emittersPerPlant: number, emitterFlowLph: number): number {
    const plantFlow = plantFlowLph(emittersPerPlant, emitterFlowLph);
    if (!(plantFlow > 0)) throw new RangeError('each plant needs at least one emitter with a positive flow');
    if (waterLPerPlantPerDay < 0) throw new RangeError(`daily water must be >= 0, got ${waterLPerPlantPerDay}`);

    return (waterLPerPlantPerDay / plantFlow) * 60;
}
