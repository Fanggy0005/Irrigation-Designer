import { type PipeKind } from '../project';
import { barToMHead } from '../units';

/**
 * Standard plastic pipe sizes. Every series takes all its numbers from one source table,
 * named next to it; nothing is estimated or merged from other tables. The research behind
 * each choice, with the sources it was checked against, is in docs/research/pipe-sizes.md.
 */

export type PipeMaterial = 'PVC' | 'PE';

export type PipeSpec = {
    id: string;
    material: PipeMaterial;
    /** Standard and pressure class as the designer knows it, e.g. "PVC 8.5 (มอก. 17-2561)". */
    series: string;
    /** Size as the source names it. */
    nominal: string;
    outerDiameterMm: number;
    wallMm: number;
    /** Outer diameter less twice the wall. */
    innerDiameterMm: number;
    /** Pressure class from the source, as m of head. */
    ratingM: number;
    /** Hazen-Williams C. */
    c: number;
    /** Where the numbers come from. */
    source: string;
};

/**
 * Hazen-Williams C for plastic pipe by inside diameter: USDA NRCS, National Engineering
 * Handbook Part 623, Ch. 7 "Microirrigation" (2013), Table 7-23: 130 up to 1 in (26 mm),
 * 140 below 3 in (76 mm), 150 from 3 in up. Small pipe loses more than C = 150 predicts.
 */
export function plasticPipeC(innerDiameterMm: number): number {
    if (innerDiameterMm <= 26) return 130;
    if (innerDiameterMm < 76) return 140;
    return 150;
}

type Row = { nominal: string; outerDiameterMm: number; wallMm: number };
type SeriesBase = Pick<PipeSpec, 'material' | 'series' | 'ratingM' | 'source'> & { idPrefix: string; c?: number };

/** Specs for one series. C follows `plasticPipeC` unless the series gives its own. */
export function series({ idPrefix, c, ...common }: SeriesBase, rows: readonly Row[]): PipeSpec[] {
    return rows.map((row) => {
        const innerDiameterMm = Math.round((row.outerDiameterMm - 2 * row.wallMm) * 100) / 100;
        return { ...common, ...row, id: `${idPrefix}-${row.outerDiameterMm}`, innerDiameterMm, c: c ?? plasticPipeC(innerDiameterMm) };
    });
}

/** Rows from parallel lists of outer diameters and walls; null = not in the table. */
function rows(nominal: (od: number) => string, ods: readonly number[], walls: readonly (number | null)[]): Row[] {
    if (ods.length !== walls.length) throw new Error('every outer diameter needs a wall (or null)');
    return ods.flatMap((outerDiameterMm, i) =>
        walls[i] === null ? [] : [{ nominal: nominal(outerDiameterMm), outerDiameterMm, wallMm: walls[i]! }],
    );
}

// ── PVC: มอก. 17-2561 ท่อพีวีซีแข็งสำหรับใช้เป็นท่อน้ำดื่ม ──────────────────────────────
// Source: the standard's full text from TISI, https://service.tisi.go.th/fulltext/TIS-17_2561.pdf
// Table 2: size designation, mean outside diameter D and wall e (mean ± tolerance; the mean is
// used here). Table 1: nominal pressure at 27 °C in MPa (1 MPa = 10 bar).
const TIS17_SOURCE = 'มอก. 17-2561 ตารางที่ 1–2';
const TIS17_SIZE_BY_OD: Record<number, number> = {
    22: 18,
    26: 20,
    34: 25,
    42: 35,
    48: 40,
    60: 55,
    76: 65,
    89: 80,
    114: 100,
    140: 125,
    165: 150,
    216: 200,
};
const TIS17_OD = [22, 26, 34, 42, 48, 60, 76, 89, 114, 140, 165, 216];
const TIS17_CLASSES: { name: string; mpa: number; walls: (number | null)[] }[] = [
    { name: '5', mpa: 0.51, walls: [null, null, null, 1.5, 1.5, 1.8, 2.2, 2.6, 3.2, 3.9, 4.6, 5.4] },
    { name: '7', mpa: 0.7, walls: [1.5, 1.5, 1.5, 1.8, 1.9, 2.4, 2.9, 3.5, 4.3, 5.3, 6.2, 7.3] },
    { name: '8.5', mpa: 0.85, walls: [2.0, 2.0, 2.0, 2.2, 2.3, 2.9, 3.5, 4.1, 5.2, 6.4, 7.5, 8.8] },
    { name: '10.5', mpa: 1.08, walls: [2.3, 2.3, 2.4, 2.6, 2.8, 3.5, 4.4, 5.2, 6.5, 8.0, 9.4, 11.1] },
    { name: '13.5', mpa: 1.36, walls: [2.6, 2.6, 3.0, 3.1, 3.5, 4.3, 5.4, 6.4, 8.1, 9.9, 11.7, 13.7] },
];
const PVC_TIS17 = TIS17_CLASSES.flatMap((cls) =>
    series(
        {
            idPrefix: `pvc-tis17-${cls.name}`,
            material: 'PVC',
            series: `PVC ${cls.name} (มอก. 17-2561)`,
            ratingM: barToMHead(cls.mpa * 10),
            source: TIS17_SOURCE,
        },
        rows((od) => `ขนาด ${TIS17_SIZE_BY_OD[od]}`, TIS17_OD, cls.walls),
    ),
);

// ── PE100 pressure pipe, ISO 4427 ──────────────────────────────────────────────────────
// Source: S-lon, "Dimension Table for S-lon PE pipes in accordance with SLS 1498
// (ISO 4427-2007 & EN12201-2011)", PE 100, p. 1:
// https://www.s-lon.lk/storage/app/uploads/public/5ab/36a/0ca/5ab36a0ca27c4546733484.pdf
// A manufacturer's table (the standard itself could not be reached). Outside diameter is
// the nominal dn; the wall is the minimum (= nominal in ISO 4427). PN is bar at 20 °C.
const SLON_SOURCE = 'S-lon PE 100 dimension table (SLS 1498 / ISO 4427)';
const SLON_OD = [20, 25, 32, 40, 50, 63, 75, 90, 110, 125, 140, 160, 180, 200, 225, 250];
const SLON_SDRS: { sdr: string; pn: number; walls: (number | null)[] }[] = [
    { sdr: '11', pn: 16, walls: [2.0, 2.3, 3.0, 3.7, 4.6, 5.8, 6.8, 8.2, 10.0, 11.4, 12.7, 14.6, 16.4, 18.2, 20.5, 22.7] },
    { sdr: '13.6', pn: 12.5, walls: [null, 2.0, 2.4, 3.0, 3.7, 4.7, 5.6, 6.7, 8.1, 9.2, 10.3, 11.8, 13.3, 14.7, 16.6, 18.4] },
    { sdr: '17', pn: 10, walls: [null, null, 2.0, 2.4, 3.0, 3.8, 4.5, 5.4, 6.6, 7.4, 8.3, 9.5, 10.7, 11.9, 13.4, 14.8] },
    { sdr: '21', pn: 8, walls: [null, null, null, 2.0, 2.4, 3.0, 3.6, 4.3, 5.3, 6.0, 6.7, 7.7, 8.6, 9.6, 10.8, 11.9] },
    { sdr: '26', pn: 6, walls: [null, null, null, null, 2.0, 2.5, 2.9, 3.5, 4.2, 4.8, 5.4, 6.2, 6.9, 7.7, 8.6, 9.6] },
];
const PE100_SLON = SLON_SDRS.flatMap((s) =>
    series(
        {
            idPrefix: `pe100-sdr${s.sdr}`,
            material: 'PE',
            series: `PE100 SDR ${s.sdr} PN ${s.pn} (ISO 4427)`,
            ratingM: barToMHead(s.pn),
            source: SLON_SOURCE,
        },
        rows((od) => `${od} มม.`, SLON_OD, s.walls),
    ),
);

// ── PE laterals, ISO 8779:2001 ─────────────────────────────────────────────────────────
// Source: ISO 8779:2001 "Polyethylene (PE) pipes for irrigation laterals — Specifications",
// Table 1 "Nominal wall thicknesses, en" (sample pages via iTeh). A withdrawn edition: the
// current tables (2010, 2020) are not freely available. PN is bar at 20 °C.
const ISO8779_SOURCE = 'ISO 8779:2001 Table 1';
const ISO8779_OD = [12, 16, 20, 25, 32];
const ISO8779_SERIES: { material: string; pn: number; walls: (number | null)[] }[] = [
    { material: 'PE32', pn: 2.5, walls: [1.0, 1.2, 1.3, 1.4, 1.6] },
    { material: 'PE32', pn: 4, walls: [1.1, 1.4, 1.5, 1.9, 2.4] },
    { material: 'PE32', pn: 6, walls: [1.4, 1.8, 2.3, 2.8, 3.6] },
    { material: 'PE40', pn: 2.5, walls: [null, 1.0, 1.2, 1.2, 1.5] },
    { material: 'PE40', pn: 4, walls: [1.0, 1.2, 1.5, 1.5, 1.9] },
    { material: 'PE40', pn: 6, walls: [1.1, 1.5, 1.9, 2.3, 2.9] },
    { material: 'PE63', pn: 10, walls: [1.1, 1.5, 1.9, 2.3, 2.9] },
];
const LATERALS_ISO8779 = ISO8779_SERIES.flatMap((s) =>
    series(
        {
            idPrefix: `iso8779-${s.material.toLowerCase()}-pn${s.pn}`,
            material: 'PE',
            series: `${s.material} PN ${s.pn} (ISO 8779:2001)`,
            ratingM: barToMHead(s.pn),
            source: ISO8779_SOURCE,
        },
        rows((od) => `${od} มม.`, ISO8779_OD, s.walls),
    ),
);

export const PIPE_SPECS: readonly PipeSpec[] = [...PVC_TIS17, ...PE100_SLON, ...LATERALS_ISO8779];

/** The series size suggestions pick from, for each kind of pipe. */
export const SUGGESTED_SERIES: Record<PipeKind, string> = {
    main: 'PVC 8.5 (มอก. 17-2561)',
    submain: 'PVC 8.5 (มอก. 17-2561)',
    lateral: 'PE40 PN 4 (ISO 8779:2001)',
};
