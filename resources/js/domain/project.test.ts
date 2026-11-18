import { describe, expect, it } from 'vitest';
import { nextId, parseProject } from './project';

describe('parseProject', () => {
    it('creates a complete empty design for a new project', () => {
        const project = parseProject(null);
        expect(project).toEqual({
            version: 1,
            site: { waterSource: null },
            boundary: [],
            exclusions: [],
            planting: {
                plantName: '',
                spacingM: 6,
                rowSpacingM: 6,
                rowBearingDeg: 0,
                staggered: false,
                edgeSetbackM: 1,
                removed: [],
                added: [],
                waterLPerDay: 0,
            },
            emitter: { flowLph: 60, pressureM: 15, perPlant: 1 },
            zones: [],
            pipes: [],
            laterals: { removed: [] },
            settings: { maxZoneFlowLph: 5000 },
        });
    });

    it('fills fields missing from an older design', () => {
        const project = parseProject({ version: 1, planting: { spacingM: 8 } });
        expect(project.planting.spacingM).toBe(8);
        expect(project.planting.rowSpacingM).toBe(6);
        expect(project.site.waterSource).toBeNull();
    });

    it('does not share default arrays between projects', () => {
        const a = parseProject(null);
        const b = parseProject(null);
        expect(a.boundary).not.toBe(b.boundary);
        expect(a.planting.removed).not.toBe(b.planting.removed);
    });

    it('reads zones and pipes, with defaults for what an older zone lacks', () => {
        const point = { lat: 14, lng: 101 };
        const project = parseProject({
            zones: [{ id: 'z1', name: 'โซน 1', polygon: [point, point, point] }],
            pipes: [{ id: 'p1', kind: 'main', path: [point, point] }],
        });
        expect(project.zones[0].runMinutes).toBeNull();
        expect(project.pipes[0].kind).toBe('main');
    });

    it('rejects values outside their range', () => {
        expect(() => parseProject({ planting: { spacingM: 0.1 } })).toThrow();
        expect(() => parseProject({ boundary: [{ lat: 95, lng: 100 }] })).toThrow();
        expect(() => parseProject({ version: 2 })).toThrow();
        expect(() => parseProject({ emitter: { perPlant: 1.5 } })).toThrow();
        expect(() => parseProject({ pipes: [{ id: 'p1', kind: 'drip', path: [] }] })).toThrow();
    });
});

describe('nextId', () => {
    it('numbers one past the highest id with the prefix', () => {
        expect(nextId('z', [])).toBe('z1');
        expect(nextId('z', [{ id: 'z1' }, { id: 'z7' }, { id: 'z3' }])).toBe('z8');
    });

    it('ignores ids with another prefix or no number', () => {
        expect(nextId('p', [{ id: 'z9' }, { id: 'pump' }, { id: 'p2' }])).toBe('p3');
    });
});
