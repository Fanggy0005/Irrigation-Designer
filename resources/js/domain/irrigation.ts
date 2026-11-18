/** Minutes a zone must run each day to give every plant its daily water. */
export function runMinutesPerDay(waterLPerPlantPerDay: number, emittersPerPlant: number, emitterFlowLph: number): number {
    const plantFlowLph = emittersPerPlant * emitterFlowLph;
    if (!(plantFlowLph > 0)) throw new RangeError('each plant needs at least one emitter with a positive flow');
    if (waterLPerPlantPerDay < 0) throw new RangeError(`daily water must be >= 0, got ${waterLPerPlantPerDay}`);

    return (waterLPerPlantPerDay / plantFlowLph) * 60;
}
