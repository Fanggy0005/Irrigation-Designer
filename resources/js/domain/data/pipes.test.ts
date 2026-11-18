import { describe, expect, it } from 'vitest';
import { PIPE_SPECS, plasticPipeC, SUGGESTED_SERIES } from './pipes';

const spec = (id: string) => PIPE_SPECS.find((s) => s.id === id)!;

describe('PIPE_SPECS', () => {
    it('has unique ids, a sensible bore and a rating for every size', () => {
        expect(new Set(PIPE_SPECS.map((s) => s.id)).size).toBe(PIPE_SPECS.length);
        for (const s of PIPE_SPECS) {
            expect(s.innerDiameterMm).toBeGreaterThan(0);
            expect(s.innerDiameterMm).toBeLessThan(s.outerDiameterMm);
            expect(s.ratingM).toBeGreaterThan(0);
        }
    });

    it('suggests from series that exist', () => {
        for (const name of Object.values(SUGGESTED_SERIES)) expect(PIPE_SPECS.some((s) => s.series === name)).toBe(true);
    });

    // Spot checks against docs/research/pipe-sizes.md, to catch a value typed into the wrong column.
    it('matches มอก. 17-2561 Table 2 (D and mean e) and Table 1 (nominal pressure)', () => {
        expect(spec('pvc-tis17-8.5-34')).toMatchObject({ nominal: 'ขนาด 25', outerDiameterMm: 34, wallMm: 2.0, innerDiameterMm: 30 });
        expect(spec('pvc-tis17-8.5-42').wallMm).toBe(2.2); // changed from 2.0 in the 2532 edition
        expect(spec('pvc-tis17-13.5-22').wallMm).toBe(2.6);
        expect(spec('pvc-tis17-5-89').wallMm).toBe(2.6);
        expect(spec('pvc-tis17-10.5-216').wallMm).toBe(11.1);
        expect(spec('pvc-tis17-7-114')).toMatchObject({ nominal: 'ขนาด 100', wallMm: 4.3 });
        expect(spec('pvc-tis17-5-22')).toBeUndefined(); // PVC 5 starts at size 35
        // 0.85 MPa = 8.5 bar = 86.7 m of water
        expect(spec('pvc-tis17-8.5-34').ratingM).toBeCloseTo(86.68, 2);
        expect(spec('pvc-tis17-13.5-34').ratingM).toBeCloseTo(138.68, 2); // 1.36 MPa
    });

    it('matches the S-lon PE 100 table (ISO 4427)', () => {
        expect(spec('pe100-sdr11-20')).toMatchObject({ wallMm: 2.0, innerDiameterMm: 16 });
        expect(spec('pe100-sdr17-110')).toMatchObject({ wallMm: 6.6, innerDiameterMm: 96.8 });
        expect(spec('pe100-sdr26-250').wallMm).toBe(9.6);
        expect(spec('pe100-sdr21-32')).toBeUndefined();
        expect(spec('pe100-sdr17-110').ratingM).toBeCloseTo(101.97, 2); // PN 10
    });

    it('matches ISO 8779:2001 Table 1', () => {
        expect(spec('iso8779-pe40-pn4-16')).toMatchObject({ wallMm: 1.2, innerDiameterMm: 13.6 });
        expect(spec('iso8779-pe32-pn6-32').wallMm).toBe(3.6);
        expect(spec('iso8779-pe63-pn10-25').wallMm).toBe(2.3);
        expect(spec('iso8779-pe40-pn2.5-12')).toBeUndefined();
    });
});

describe('plasticPipeC', () => {
    it('follows NRCS NEH 623 Table 7-23 by inside diameter', () => {
        expect(plasticPipeC(13.6)).toBe(130);
        expect(plasticPipeC(26)).toBe(130);
        expect(plasticPipeC(30)).toBe(140);
        expect(plasticPipeC(75.9)).toBe(140);
        expect(plasticPipeC(76)).toBe(150);
        expect(spec('pvc-tis17-8.5-114').c).toBe(150); // 103.6 mm inside
    });
});
