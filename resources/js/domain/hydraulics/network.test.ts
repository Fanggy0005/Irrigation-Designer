import { describe, expect, it } from 'vitest';
import { type Network, type NetworkNode, type NetworkPipe, solveNetwork } from './network';
import { frictionLossM } from './pipeFlow';

const pipe = (id: string, a: string, b: string, lengthM = 100, innerDiameterMm = 50, c = 150): NetworkPipe => ({
    id,
    a,
    b,
    lengthM,
    innerDiameterMm,
    c,
});

const node = (id: string, demandLph = 0, elevationM = 0, minPressureM?: number): NetworkNode => ({ id, demandLph, elevationM, minPressureM });

describe('single pipe', () => {
    const hf = frictionLossM(3_600, 50, 100, 150);
    const network: Network = {
        rootId: 'pump',
        nodes: [node('pump'), node('end', 3_600, 0, 10)],
        pipes: [pipe('p1', 'pump', 'end')],
    };

    it('needs the end pressure plus the friction loss at the root', () => {
        const result = solveNetwork(network, { minorLossPct: 0 });
        expect(result.requiredRootPressureM).toBeCloseTo(10 + hf, 10);
        expect(result.criticalNodeId).toBe('end');
        expect(result.nodePressureM.end).toBeCloseTo(10, 10);
        expect(result.pipes.p1).toMatchObject({ from: 'pump', to: 'end', flowLph: 3_600 });
    });

    it('adds minor losses as a percentage of friction', () => {
        const result = solveNetwork(network, { minorLossPct: 10 });
        expect(result.pipes.p1.lossM).toBeCloseTo(1.1 * hf, 10);
        expect(result.requiredRootPressureM).toBeCloseTo(10 + 1.1 * hf, 10);
    });

    it('needs 5 m more when the end is 5 m higher, and 5 m less when lower', () => {
        const up = { ...network, nodes: [node('pump'), node('end', 3_600, 5, 10)] };
        const down = { ...network, nodes: [node('pump'), node('end', 3_600, -5, 10)] };
        expect(solveNetwork(up, { minorLossPct: 0 }).requiredRootPressureM).toBeCloseTo(15 + hf, 10);
        expect(solveNetwork(down, { minorLossPct: 0 }).requiredRootPressureM).toBeCloseTo(5 + hf, 10);
    });

    it('computes node pressures from a given root pressure', () => {
        const result = solveNetwork(network, { minorLossPct: 0, rootPressureM: 30 });
        expect(result.rootPressureM).toBe(30);
        expect(result.nodePressureM.pump).toBe(30);
        expect(result.nodePressureM.end).toBeCloseTo(30 - hf, 10);
    });

    it('accepts pipes drawn from the far end towards the root', () => {
        const reversed = { ...network, pipes: [pipe('p1', 'end', 'pump')] };
        const result = solveNetwork(reversed, { minorLossPct: 0 });
        expect(result.pipes.p1).toMatchObject({ from: 'pump', to: 'end' });
        expect(result.requiredRootPressureM).toBeCloseTo(10 + hf, 10);
    });
});

describe('branching network', () => {
    //   pump ── j ──┬── near (short branch)
    //               └── far  (long branch)
    const network: Network = {
        rootId: 'pump',
        nodes: [node('pump'), node('j', 500), node('near', 1_000, 0, 10), node('far', 2_000, 0, 10)],
        pipes: [pipe('main', 'pump', 'j', 200, 40), pipe('toNear', 'j', 'near', 20, 25), pipe('toFar', 'j', 'far', 150, 25)],
    };
    const result = solveNetwork(network, { minorLossPct: 0 });

    it('carries the sum of downstream demands in each pipe', () => {
        expect(result.pipes.main.flowLph).toBe(3_500);
        expect(result.pipes.toNear.flowLph).toBe(1_000);
        expect(result.pipes.toFar.flowLph).toBe(2_000);
        expect(result.totalDemandLph).toBe(3_500);
    });

    it('sizes the root pressure for the worst branch', () => {
        const toJ = frictionLossM(3_500, 40, 200, 150);
        const toFar = toJ + frictionLossM(2_000, 25, 150, 150);
        expect(result.criticalNodeId).toBe('far');
        expect(result.requiredRootPressureM).toBeCloseTo(10 + toFar, 10);
        expect(result.nodePressureM.far).toBeCloseTo(10, 10);
        expect(result.nodePressureM.near).toBeGreaterThan(10);
    });

    it('reports the pressure range over nodes that draw water', () => {
        expect(result.demandPressureRangeM).toEqual({
            min: result.nodePressureM.far,
            max: result.nodePressureM.j,
        });
    });
});

describe('lateral with equally spaced emitters', () => {
    /** Christiansen's F: share of the full-flow loss that a pipe with N equal outlets loses. */
    function christiansenF(n: number, m = 1.852): number {
        return 1 / (m + 1) + 1 / (2 * n) + Math.sqrt(m - 1) / (6 * n * n);
    }

    it.each([10, 50, 200])('matches Christiansen F with %d outlets, first outlet one spacing from the inlet', (n) => {
        const spacingM = 3;
        const emitterLph = 40;
        const nodes = [node('inlet'), ...Array.from({ length: n }, (_, i) => node(`e${i + 1}`, emitterLph, 0, 10))];
        const pipes = Array.from({ length: n }, (_, i) => pipe(`s${i + 1}`, i === 0 ? 'inlet' : `e${i}`, `e${i + 1}`, spacingM, 16, 140));

        const result = solveNetwork({ rootId: 'inlet', nodes, pipes }, { minorLossPct: 0 });

        const fullFlowLoss = frictionLossM(n * emitterLph, 16, n * spacingM, 140);
        const lateralLoss = result.requiredRootPressureM - 10;
        expect(result.criticalNodeId).toBe(`e${n}`);
        expect(lateralLoss / (christiansenF(n) * fullFlowLoss)).toBeCloseTo(1, 3);
    });
});

describe('networks it refuses', () => {
    const solve = (network: Network) => () => solveNetwork(network, { minorLossPct: 0 });

    it('rejects a loop', () => {
        const loop: Network = {
            rootId: 'a',
            nodes: [node('a'), node('b'), node('c')],
            pipes: [pipe('ab', 'a', 'b'), pipe('bc', 'b', 'c'), pipe('ca', 'c', 'a')],
        };
        expect(solve(loop)).toThrow(/loop/);
    });

    it('rejects two pipes between the same nodes', () => {
        const parallel: Network = { rootId: 'a', nodes: [node('a'), node('b')], pipes: [pipe('p', 'a', 'b'), pipe('q', 'b', 'a')] };
        expect(solve(parallel)).toThrow(/loop/);
    });

    it('rejects a node with no path to the root', () => {
        const island: Network = { rootId: 'a', nodes: [node('a'), node('b'), node('lost')], pipes: [pipe('ab', 'a', 'b')] };
        expect(solve(island)).toThrow(/not connected.*lost/);
    });

    it('rejects unknown nodes, duplicate ids, a missing root and negative demand', () => {
        expect(solve({ rootId: 'a', nodes: [node('a')], pipes: [pipe('p', 'a', 'ghost')] })).toThrow(/unknown node "ghost"/);
        expect(solve({ rootId: 'a', nodes: [node('a'), node('a')], pipes: [] })).toThrow(/duplicate/);
        expect(solve({ rootId: 'x', nodes: [node('a')], pipes: [] })).toThrow(/root/);
        expect(solve({ rootId: 'a', nodes: [node('a', -1)], pipes: [] })).toThrow(RangeError);
    });
});

it('needs no root pressure when no node sets a minimum', () => {
    const result = solveNetwork({ rootId: 'a', nodes: [node('a'), node('b', 100)], pipes: [pipe('p', 'a', 'b')] }, { minorLossPct: 0 });
    expect(result.requiredRootPressureM).toBe(0);
    expect(result.criticalNodeId).toBeNull();
});
