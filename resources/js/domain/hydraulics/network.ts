import { frictionLossM, velocityMps } from './pipeFlow';

/**
 * Steady-state solver for a branching (tree) pipe network fed from one point, such as
 * pump → main → submain → laterals → emitters. Every pipe in an irrigation zone is
 * modelled the same way: an emitter is a node with a demand, a lateral is a chain of
 * short pipes between emitters.
 *
 * Demands are fixed (emitters at their nominal flow), so the flow in each pipe is the
 * sum of the demands downstream of it. That is the standard design assumption, valid
 * while the pressure variation in a zone stays within the usual ~20% limit.
 */

export type NetworkNode = {
    id: string;
    elevationM: number;
    /** Water drawn at this node, L/h. 0 for plain junctions. */
    demandLph: number;
    /** Pressure this node needs to work, m (e.g. an emitter's operating pressure). */
    minPressureM?: number;
};

/** Endpoints may be given in either order; the solver orients pipes away from the root. */
export type NetworkPipe = {
    id: string;
    a: string;
    b: string;
    lengthM: number;
    innerDiameterMm: number;
    /** Hazen-Williams C. */
    c: number;
};

export type Network = {
    rootId: string;
    nodes: NetworkNode[];
    pipes: NetworkPipe[];
};

export type SolveOptions = {
    /** Fittings and valves, as a percentage of each pipe's friction loss. */
    minorLossPct: number;
    /** Pressure at the root. Defaults to the pressure the network requires. */
    rootPressureM?: number;
};

export type PipeResult = {
    /** Upstream end. */
    from: string;
    to: string;
    flowLph: number;
    velocityMps: number;
    frictionLossM: number;
    /** Friction plus minor losses. */
    lossM: number;
};

export type NetworkResult = {
    totalDemandLph: number;
    /**
     * Lowest root pressure that gives every node with `minPressureM` at least that
     * pressure. Negative when elevation alone delivers it. 0 when no node sets a minimum.
     */
    requiredRootPressureM: number;
    /** Node that sets `requiredRootPressureM`, or null when no node sets a minimum. */
    criticalNodeId: string | null;
    /** Root pressure the node pressures below were computed with. */
    rootPressureM: number;
    nodePressureM: Record<string, number>;
    /** Lowest and highest pressure among nodes that draw water, or null if none do. */
    demandPressureRangeM: { min: number; max: number } | null;
    pipes: Record<string, PipeResult>;
};

type Link = { pipe: NetworkPipe; other: string };

export function solveNetwork(network: Network, options: SolveOptions): NetworkResult {
    const nodes = indexNodes(network);
    const { order, parentPipe } = orientFromRoot(network, nodes);

    // Flow in the pipe above each node = demand of the node's whole subtree.
    const subtreeDemand = new Map<string, number>();
    for (const id of order) subtreeDemand.set(id, nodes.get(id)!.demandLph);
    for (const id of [...order].reverse()) {
        const link = parentPipe.get(id);
        if (link) subtreeDemand.set(link.other, subtreeDemand.get(link.other)! + subtreeDemand.get(id)!);
    }

    const minorFactor = 1 + options.minorLossPct / 100;
    const pipes: Record<string, PipeResult> = {};
    const lossFromRoot = new Map<string, number>([[network.rootId, 0]]);
    for (const id of order) {
        const link = parentPipe.get(id);
        if (!link) continue;
        const { pipe, other: parent } = link;
        const flowLph = subtreeDemand.get(id)!;
        const friction = frictionLossM(flowLph, pipe.innerDiameterMm, pipe.lengthM, pipe.c);
        const lossM = friction * minorFactor;
        pipes[pipe.id] = {
            from: parent,
            to: id,
            flowLph,
            velocityMps: velocityMps(flowLph, pipe.innerDiameterMm),
            frictionLossM: friction,
            lossM,
        };
        lossFromRoot.set(id, lossFromRoot.get(parent)! + lossM);
    }

    const rootElevation = nodes.get(network.rootId)!.elevationM;
    // Pressure at a node = root pressure − (rise from root) − (losses on the way).
    const drop = (node: NetworkNode) => node.elevationM - rootElevation + lossFromRoot.get(node.id)!;

    let requiredRootPressureM = 0;
    let criticalNodeId: string | null = null;
    for (const node of nodes.values()) {
        if (node.minPressureM === undefined) continue;
        const needed = node.minPressureM + drop(node);
        if (criticalNodeId === null || needed > requiredRootPressureM) {
            requiredRootPressureM = needed;
            criticalNodeId = node.id;
        }
    }

    const rootPressureM = options.rootPressureM ?? requiredRootPressureM;
    const nodePressureM: Record<string, number> = {};
    let demandPressureRangeM: NetworkResult['demandPressureRangeM'] = null;
    for (const node of nodes.values()) {
        const pressure = rootPressureM - drop(node);
        nodePressureM[node.id] = pressure;
        if (node.demandLph > 0) {
            demandPressureRangeM = demandPressureRangeM
                ? { min: Math.min(demandPressureRangeM.min, pressure), max: Math.max(demandPressureRangeM.max, pressure) }
                : { min: pressure, max: pressure };
        }
    }

    return {
        totalDemandLph: subtreeDemand.get(network.rootId)!,
        requiredRootPressureM,
        criticalNodeId,
        rootPressureM,
        nodePressureM,
        demandPressureRangeM,
        pipes,
    };
}

function indexNodes(network: Network): Map<string, NetworkNode> {
    const nodes = new Map<string, NetworkNode>();
    for (const node of network.nodes) {
        if (nodes.has(node.id)) throw new Error(`duplicate node id "${node.id}"`);
        if (node.demandLph < 0) throw new RangeError(`node "${node.id}" has negative demand`);
        nodes.set(node.id, node);
    }
    if (!nodes.has(network.rootId)) throw new Error(`root node "${network.rootId}" not found`);
    return nodes;
}

/** Breadth-first walk from the root. Throws unless the pipes form a tree spanning every node. */
function orientFromRoot(network: Network, nodes: Map<string, NetworkNode>) {
    const links = new Map<string, Link[]>();
    for (const id of nodes.keys()) links.set(id, []);
    for (const pipe of network.pipes) {
        for (const end of [pipe.a, pipe.b]) {
            if (!nodes.has(end)) throw new Error(`pipe "${pipe.id}" connects to unknown node "${end}"`);
        }
        if (pipe.a === pipe.b) throw new Error(`pipe "${pipe.id}" connects node "${pipe.a}" to itself`);
        links.get(pipe.a)!.push({ pipe, other: pipe.b });
        links.get(pipe.b)!.push({ pipe, other: pipe.a });
    }

    const order: string[] = [network.rootId];
    /** For each non-root node: the pipe to its parent, and the parent's id. */
    const parentPipe = new Map<string, Link>();
    const seen = new Set([network.rootId]);
    for (let i = 0; i < order.length; i++) {
        const id = order[i];
        for (const link of links.get(id)!) {
            if (link.pipe === parentPipe.get(id)?.pipe) continue;
            if (seen.has(link.other)) throw new Error(`pipes form a loop at node "${link.other}"; the network must be a tree`);
            seen.add(link.other);
            parentPipe.set(link.other, { pipe: link.pipe, other: id });
            order.push(link.other);
        }
    }

    const unreached = [...nodes.keys()].filter((id) => !seen.has(id));
    if (unreached.length > 0) throw new Error(`nodes not connected to the root: ${unreached.join(', ')}`);

    return { order, parentPipe };
}
