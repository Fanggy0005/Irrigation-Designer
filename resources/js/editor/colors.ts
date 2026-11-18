import { type PipeKind } from '@/domain/project';

export const COLORS = {
    boundary: '#facc15',
    exclusion: '#ef4444',
    waterSource: '#2563eb',
    plant: '#22c55e',
    addedPlant: '#22d3ee',
    unservedPlant: '#dc2626',
    zone: '#f97316',
};

export const PIPE_COLORS: Record<PipeKind, string> = {
    main: '#1d4ed8',
    submain: '#0ea5e9',
    lateral: '#a5f3fc',
};

export const PIPE_WEIGHTS: Record<PipeKind, number> = { main: 5, submain: 4, lateral: 2 };

const ZONE_COLORS = ['#f97316', '#a855f7', '#ec4899', '#14b8a6', '#eab308', '#6366f1', '#84cc16', '#f43f5e'];

/** Zones cycle through a palette by their position in the list. */
export function zoneColor(index: number): string {
    return ZONE_COLORS[index % ZONE_COLORS.length];
}
