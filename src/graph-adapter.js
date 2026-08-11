/**
 * EconomicGraph adapter — wraps @space-cadet/graph-core GraphologyAdapter
 * with the legacy EconomicGraph API for backward compatibility.
 */

import { GraphologyAdapter } from 'https://cdn.jsdelivr.net/npm/@space-cadet/graph-core@0.1.2/dist/index.mjs';

class EconomicGraph {
  constructor() {
    this._graph = new GraphologyAdapter('econ-graph');
    this._nextId = 0;
    this._nodeMap = new Map(); // numeric id -> string id
    this._reverseMap = new Map(); // string id -> numeric id
  }

  // Proxy property access to underlying graph
  get nodeCount() {
    return this._graph.nodeCount;
  }

  get edgeCount() {
    return this._graph.edgeCount;
  }

  get nodes() {
    // Return a Map-like object for compatibility
    const map = new Map();
    for (const node of this._graph.getNodes()) {
      const numId = this._reverseMap.get(node.id);
      if (numId !== undefined) {
        map.set(numId, this._enrichNode(node, numId));
      }
    }
    return map;
  }

  get edges() {
    const map = new Map();
    for (const edge of this._graph.getEdges()) {
      const key = `${this._reverseMap.get(edge.sourceId)}-${this._reverseMap.get(edge.targetId)}`;
      map.set(key, this._enrichEdge(edge));
    }
    return map;
  }

  addNode(type, params = {}) {
    const numId = this._nextId++;
    const strId = `n${numId}`;
    this._nodeMap.set(numId, strId);
    this._reverseMap.set(strId, numId);

    const node = {
      id: numId,
      type,
      x: params.x ?? (100 + Math.random() * 600),
      y: params.y ?? (50 + Math.random() * 400),
      productivity: params.productivity || 1.0,
      welfareWeight: params.welfareWeight || 1.0,
      riskAversion: params.riskAversion || 2.0,
      stock: params.stock || 0,
      label: params.label || (type === 'producer' ? `P${numId}` : `H${numId}`),
    };

    // Store in graph-core
    this._graph.addNode({
      id: strId,
      type,
      properties: { ...node },
    });

    return node;
  }

  removeNode(numId) {
    const strId = this._nodeMap.get(numId);
    if (strId) {
      this._graph.removeNode(strId);
      this._nodeMap.delete(numId);
      this._reverseMap.delete(strId);
    }
  }

  addEdge(sourceNumId, targetNumId, params = {}) {
    const sourceStr = this._nodeMap.get(sourceNumId);
    const targetStr = this._nodeMap.get(targetNumId);
    if (!sourceStr || !targetStr) return null;

    const key = `${sourceNumId}-${targetNumId}`;
    const edge = {
      source: sourceNumId,
      target: targetNumId,
      capacity: params.capacity || Infinity,
      cost: params.cost || 0,
      flow: 0,
    };

    this._graph.addEdge({
      id: `e-${sourceStr}-${targetStr}`,
      sourceId: sourceStr,
      targetId: targetStr,
      type: 'default',
      directed: false,
      properties: { ...edge },
    });

    return edge;
  }

  removeEdge(sourceNumId, targetNumId) {
    const sourceStr = this._nodeMap.get(sourceNumId);
    const targetStr = this._nodeMap.get(targetNumId);
    if (sourceStr && targetStr) {
      this._graph.dropEdge(`e-${sourceStr}-${targetStr}`);
    }
  }

  getNeighbors(numId) {
    const strId = this._nodeMap.get(numId);
    if (!strId) return [];
    const neighbors = this._graph.getAdjacentNodes(strId);
    return neighbors.map(n => this._reverseMap.get(n.id)).filter(id => id !== undefined);
  }

  getOutgoingEdges(numId) {
    const strId = this._nodeMap.get(numId);
    if (!strId) return [];
    const edges = this._graph.getOutgoingEdges(strId);
    return edges.map(e => this._enrichEdge(e));
  }

  getIncomingEdges(numId) {
    const strId = this._nodeMap.get(numId);
    if (!strId) return [];
    const edges = this._graph.getIncomingEdges(strId);
    return edges.map(e => this._enrichEdge(e));
  }

  getAdjacencyMatrix() {
    const mat = this._graph.toAdjacencyMatrix();
    const size = mat.size()[0];
    const A = [];
    const labels = [];
    const idToIndex = new Map();

    const nodes = this._graph.getNodes();
    for (let i = 0; i < size; i++) {
      A[i] = [];
      labels[i] = nodes[i]?.properties?.label || `N${i}`;
      const numId = this._reverseMap.get(nodes[i].id);
      idToIndex.set(numId, i);
      for (let j = 0; j < size; j++) {
        A[i][j] = mat.get([i, j]);
      }
    }

    return { matrix: A, labels, idToIndex };
  }

  getHouseholds() {
    return this._graph.getNodes()
      .filter(n => n.type === 'household')
      .map(n => this._enrichNode(n, this._reverseMap.get(n.id)));
  }

  getProducers() {
    return this._graph.getNodes()
      .filter(n => n.type === 'producer')
      .map(n => this._enrichNode(n, this._reverseMap.get(n.id)));
  }

  spectralRadius() {
    return this._graph.spectralRadius();
  }

  isStable() {
    return true;
  }

  toJSON() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    };
  }

  fromJSON(data) {
    this._graph.clear();
    this._nodeMap.clear();
    this._reverseMap.clear();
    this._nextId = 0;

    for (const n of data.nodes) {
      this.addNode(n.type, n);
    }
    for (const e of data.edges) {
      this.addEdge(e.source, e.target, e);
    }
  }

  // Internal helpers
  _enrichNode(node, numId) {
    return {
      id: numId,
      type: node.type,
      ...node.properties,
    };
  }

  _enrichEdge(edge) {
    return {
      source: this._reverseMap.get(edge.sourceId),
      target: this._reverseMap.get(edge.targetId),
      ...edge.properties,
    };
  }
}

// Utility functions (unchanged)
function utility(c, gamma) {
  if (gamma === 1) return Math.log(c);
  return Math.pow(c, 1 - gamma) / (1 - gamma);
}

function marginalUtility(c, gamma) {
  if (c <= 0.001) return 1000;
  return Math.pow(c, -gamma);
}

function inverseMarginalUtility(mu, gamma) {
  return Math.pow(mu, -1 / gamma);
}

function production(x, A) {
  return A * x;
}

export { EconomicGraph, utility, marginalUtility, inverseMarginalUtility, production };
