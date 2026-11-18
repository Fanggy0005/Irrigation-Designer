import { velocityMps } from './hydraulics/pipeFlow';

export type PipeSize = { id: string; innerDiameterMm: number };

export type SizeSuggestion<T extends PipeSize> = {
    size: T;
    velocityMps: number;
    /** False when even the largest size is over the velocity limit. */
    withinLimit: boolean;
};

/**
 * Smallest size that keeps the velocity at or under the limit (commonly 1.5 m/s for
 * plastic pipe). This is only a starting point: the network solver then checks pressure
 * at the emitters, and the designer can upsize a pipe where the zone's pressure varies
 * too much.
 */
export function suggestPipeSize<T extends PipeSize>(flowLph: number, sizes: readonly T[], maxVelocityMps: number): SizeSuggestion<T> {
    if (sizes.length === 0) throw new Error('no pipe sizes to choose from');

    const bySize = [...sizes].sort((a, b) => a.innerDiameterMm - b.innerDiameterMm);
    for (const size of bySize) {
        const v = velocityMps(flowLph, size.innerDiameterMm);
        if (v <= maxVelocityMps) return { size, velocityMps: v, withinLimit: true };
    }

    const largest = bySize[bySize.length - 1];
    return { size: largest, velocityMps: velocityMps(flowLph, largest.innerDiameterMm), withinLimit: false };
}
