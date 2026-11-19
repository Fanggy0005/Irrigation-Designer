import { describe, expect, it } from 'vitest';
import { series } from '../data/pipes';
import { localFrame } from '../geometry';
import { layoutLaterals } from '../laterals';
import { connectPipes } from '../pipes';
import { layoutPlants } from '../planting';
import { assignPlantsToZones, zoneOfPath } from '../zones';
import { analyseHydraulics, pumpDuties } from './designHydraulics';
import { frictionLossM } from './pipeFlow';

// Source at (0, 0). A 120 m main runs east to (120, 0); a 20 m submain runs north from there
// into a 60 × 20 m zone (x 100–160). Rows run east–west at y = 17.5 and 7.5, plants every
// 5 m from x = 102.5, so each row has 4 plants west of the submain and 8 east of it.
const frame = localFrame({ lat: 14, lng: 101 });
const at = (x: number, y: number) => frame.toLatLng({ x, y });
const source = at(0, 0);
const field = [at(100, 0), at(160, 0), at(160, 20), at(100, 20)];
const plants = layoutPlants(
    field,
    [],
    { spacingM: 5, rowSpacingM: 10, rowBearingDeg: 90, staggered: false, edgeSetbackM: 2.5 },
    { removed: [], added: [] },
);

// Hypothetical sizes, so the expected numbers follow from the formulas alone.
const catalog = [
    ...series({ idPrefix: 'P', material: 'PVC', series: 'P', ratingM: 50, c: 150, source: 'test' }, [
        { nominal: 'small', outerDiameterMm: 19, wallMm: 2 }, // 15 mm inside
        { nominal: 'large', outerDiameterMm: 36, wallMm: 2 }, // 32 mm inside
    ]),
    ...series({ idPrefix: 'L', material: 'PE', series: 'L', ratingM: 25, c: 140, source: 'test' }, [
        { nominal: 'small', outerDiameterMm: 12, wallMm: 1 }, // 10 mm
        { nominal: 'large', outerDiameterMm: 16, wallMm: 1 }, // 14 mm
    ]),
];

type Options = {
    mainSpecId?: string | null;
    zoneElevationM?: number;
    withMain?: boolean;
    withDrawnLateral?: boolean;
    /** The main comes in from the west at y = 12.5 and ends on the middle of the submain. */
    mainToMiddle?: boolean;
    /** The drawn lateral crosses the submain, with a point on it, to a second plant to the west. */
    lateralBothWays?: boolean;
};

// A plant placed by hand between the rows, on a lateral drawn east from the submain.
const handPlaced = { id: 'a0', position: at(140, 12), row: null };
const handPlacedWest = { id: 'a1', position: at(110, 12), row: null };

function analyse({
    mainSpecId = null,
    zoneElevationM = 0,
    withMain = true,
    withDrawnLateral = false,
    mainToMiddle = false,
    lateralBothWays = false,
}: Options = {}) {
    const drawnLateral = {
        id: 'p9',
        kind: 'lateral' as const,
        path: lateralBothWays ? [at(105, 12), at(120, 12), at(150, 12)] : [at(120, 12), at(150, 12)],
        specId: null,
    };
    const allPlants = [...plants, ...(withDrawnLateral ? [handPlaced] : []), ...(withDrawnLateral && lateralBothWays ? [handPlacedWest] : [])];
    const zones = [{ id: 'z1', name: 'โซน 1', polygon: field, elevationM: zoneElevationM }];
    const pipes = [
        ...(withMain
            ? [
                  {
                      id: 'm1',
                      kind: 'main' as const,
                      path: mainToMiddle ? [at(0, 0), at(0, 12.5), at(120, 12.5)] : [at(0, 0), at(120, 0)],
                      specId: mainSpecId,
                  },
              ]
            : []),
        { id: 's1', kind: 'submain' as const, path: [at(120, 0), at(120, 20)], specId: null },
        ...(withDrawnLateral ? [drawnLateral] : []),
    ];
    const pipeZones = { s1: zoneOfPath([at(120, 0), at(120, 20)], zones), p9: zoneOfPath(drawnLateral.path, zones) };
    const { laterals } = layoutLaterals({
        zones: assignPlantsToZones(allPlants, zones).zones,
        submains: [{ id: 's1', zoneId: 'z1', path: [at(120, 0), at(120, 20)] }],
        drawnLaterals: withDrawnLateral ? [{ id: 'p9', zoneId: 'z1', path: drawnLateral.path }] : [],
        rowBearingDeg: 90,
        spacingM: 5,
        rowSpacingM: 10,
        removed: [],
    });
    return analyseHydraulics({
        waterSource: source,
        sourceElevationM: 0,
        pipes,
        connections: connectPipes(source, pipes),
        pipeZones,
        zones,
        laterals,
        plantPositions: new Map(allPlants.map((p) => [p.id, p.position])),
        emitter: { flowLph: 60, pressureM: 10, perPlant: 1 },
        lateralSpecId: null,
        settings: { minorLossPct: 10, maxVelocityMps: 1.5, maxPressureVariationPct: 20 },
        catalog,
        suggestedSeries: { main: 'P', submain: 'P', lateral: 'L' },
    });
}

describe('analyseHydraulics', () => {
    const result = analyse();
    const zone = result.zones[0].solution!;

    it('sizes each pipe for its flow at the velocity limit', () => {
        expect(plants).toHaveLength(24);
        // 24 plants × 60 L/h = 1,440 L/h: 2.26 m/s in 15 mm, 0.50 m/s in 32 mm.
        expect(result.pipes.m1).toMatchObject({ designFlowLph: 1_440, chosen: false });
        expect(result.pipes.m1.spec.id).toBe('P-36');
        expect(result.pipes.s1.spec.id).toBe('P-36');
        // The longest lateral feeds 8 plants: 480 L/h is 1.70 m/s in 10 mm, 0.87 m/s in 14 mm.
        expect(result.laterals.designFlowLph).toBe(480);
        expect(result.laterals.spec.id).toBe('L-16');
        expect(result.laterals.velocityMps).toBeCloseTo(0.866, 3);
    });

    it('adds up the losses along the path to the farthest emitter, as worked by hand', () => {
        const minor = 1.1; // 10% minor losses
        const main = frictionLossM(1_440, 32, 120, 150) * minor;
        // Submain: 7.5 m to the first row carrying both rows, then 10 m carrying one row.
        const submain = (frictionLossM(1_440, 32, 7.5, 150) + frictionLossM(720, 32, 10, 150)) * minor;
        // East lateral of the far row: 2.5 m to the first plant, then 5 m between plants,
        // the flow dropping by one plant's 60 L/h at each.
        let lateral = frictionLossM(480, 14, 2.5, 140);
        for (let plantsLeft = 7; plantsLeft >= 1; plantsLeft--) lateral += frictionLossM(plantsLeft * 60, 14, 5, 140);
        lateral *= minor;

        expect(zone.flowLph).toBe(1_440);
        expect(zone.lossesM.main).toBeCloseTo(main, 4);
        expect(zone.lossesM.submain).toBeCloseTo(submain, 4);
        expect(zone.lossesM.lateral).toBeCloseTo(lateral, 4);
        expect(zone.requiredPressureM).toBeCloseTo(10 + main + submain + lateral, 4);
        expect(zone.riseM).toBe(0);
        expect(zone.criticalPlantIds).toHaveLength(1);
        const critical = frame.toLocal(plants.find((p) => p.id === zone.criticalPlantIds[0])!.position);
        expect(critical.x).toBeCloseTo(157.5, 3);
        expect(critical.y).toBeCloseTo(17.5, 3);
    });

    it('reports the spread of emitter pressure in the zone', () => {
        expect(zone.emitterPressureM.min).toBeCloseTo(10, 6);
        expect(zone.variationPct).toBeCloseTo(((zone.emitterPressureM.max - 10) / 10) * 100, 6);
        expect(zone.overVariation).toBe(zone.variationPct > 20);
    });

    it('splits the flow both ways along a submain fed from its middle', () => {
        // The main ends on the submain at y = 12.5, between the rows: each 5 m half carries one row.
        const split = analyse({ mainToMiddle: true });
        const minor = 1.1;
        // 720 L/h is 1.13 m/s in 15 mm, under the limit, so the submain comes out smaller.
        expect(split.pipes.s1).toMatchObject({ designFlowLph: 720 });
        expect(split.pipes.s1.spec.id).toBe('P-19');
        const solution = split.zones[0].solution!;
        expect(solution.flowLph).toBe(1_440);
        expect(solution.lossesM.main).toBeCloseTo(frictionLossM(1_440, 32, 132.5, 150) * minor, 4);
        expect(solution.lossesM.submain).toBeCloseTo(frictionLossM(720, 15, 5, 150) * minor, 4);
        expect(solution.lossesM.lateral).toBeCloseTo(zone.lossesM.lateral, 6);
    });

    it('uses the size the designer chose and flags what it breaks', () => {
        const small = analyse({ mainSpecId: 'P-19' });
        expect(small.pipes.m1).toMatchObject({ chosen: true, overVelocity: true });
        expect(small.pipes.m1.spec.id).toBe('P-19');
        expect(small.pipes.m1.suggested.id).toBe('P-36');
        expect(small.zones[0].solution!.requiredPressureM).toBeGreaterThan(zone.requiredPressureM);
    });

    it('flags a pipe whose pressure is over its rating', () => {
        // The lateral series is rated 25 m; nothing in this zone comes close.
        expect(result.laterals.overRating).toBe(false);
        expect(result.pipes.m1.maxPressureM).toBeCloseTo(zone.requiredPressureM, 6);
        const uphill = analyse({ zoneElevationM: 45 });
        expect(uphill.pipes.m1.overRating).toBe(true); // over the 50 m rating
    });

    it('adds the rise when the zone sits above the source', () => {
        const uphill = analyse({ zoneElevationM: 5 }).zones[0].solution!;
        expect(uphill.riseM).toBe(5);
        expect(uphill.requiredPressureM).toBeCloseTo(zone.requiredPressureM + 5, 6);
    });

    it('waters a hand-placed plant through a drawn lateral, sized on its own', () => {
        const withLateral = analyse({ withDrawnLateral: true });
        expect(withLateral.zones[0].solution!.flowLph).toBe(25 * 60);
        expect(withLateral.pipes.p9).toMatchObject({ designFlowLph: 60, chosen: false });
        expect(withLateral.pipes.p9.spec.id).toBe('L-12'); // 60 L/h is slow even in 10 mm
        expect(withLateral.pipes.s1.designFlowLph).toBe(25 * 60);
    });

    it('waters plants both ways along a drawn lateral fed from its middle', () => {
        const both = analyse({ withDrawnLateral: true, lateralBothWays: true });
        expect(both.zones[0].disconnectedPlantIds).toEqual([]);
        expect(both.zones[0].solution!.flowLph).toBe(26 * 60);
        expect(both.pipes.p9.designFlowLph).toBe(60); // each side carries its one plant
    });

    it('leaves a zone unsolved when its submain does not reach the source', () => {
        const cut = analyse({ withMain: false });
        expect(cut.zones[0].solution).toBeNull();
        expect(cut.zones[0].disconnectedPlantIds).toHaveLength(24);
    });
});

describe('pumpDuties', () => {
    it('works out each zone and picks the one needing the most power', () => {
        const zones = analyse().zones;
        const { duties, heaviestZoneId } = pumpDuties(zones, { suctionLiftM: 3, suctionLossM: 1, efficiencyPct: 50 });
        expect(heaviestZoneId).toBe('z1');
        expect(duties.z1.flowLph).toBe(1_440);
        expect(duties.z1.totalHeadM).toBeCloseTo(zones[0].solution!.requiredPressureM + 4, 6);
    });

    it('has no heaviest zone when nothing is solved', () => {
        expect(pumpDuties(analyse({ withMain: false }).zones, { suctionLiftM: 0, suctionLossM: 0, efficiencyPct: 60 }).heaviestZoneId).toBeNull();
    });
});
