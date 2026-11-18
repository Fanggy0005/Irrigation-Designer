import { describe, expect, it } from 'vitest';
import { parseProject } from './project';

describe('parseProject', () => {
    it('creates a complete empty design for a new project', () => {
        const project = parseProject(null);
        expect(project).toEqual({
            version: 1,
            site: { waterSource: null },
            boundary: [],
            exclusions: [],
            planting: { plantName: '', spacingM: 6, rowSpacingM: 6, rowBearingDeg: 0, staggered: false, edgeSetbackM: 1, removed: [], added: [] },
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

    it('rejects values outside their range', () => {
        expect(() => parseProject({ planting: { spacingM: 0.1 } })).toThrow();
        expect(() => parseProject({ boundary: [{ lat: 95, lng: 100 }] })).toThrow();
        expect(() => parseProject({ version: 2 })).toThrow();
    });
});
