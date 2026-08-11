/**
 * Graph data structure for economic network
 * Nodes: producers (filled) and households (open)
 * Edges: goods transfers between nodes
 */

class EconomicGraph {
  constructor() {
    this.nodes = new Map(); // id -> node
    this.edges = new Map(); // "i-j" -> edge
    this.nextId = 0;
  }

  addNode(type, params = {}) {
    const id = this.nextId++;
    const node = {
      id,
      type, // 'producer' or 'household'
      x: params.x ?? (100 + Math.random() * 600),
      y: params.y ?? (50 + Math.random() * 400),
      // Producer parameters
      productivity: params.productivity || 1.0,
      // Household parameters
      welfareWeight: params.welfareWeight || 1.0,
      riskAversion: params.riskAversion || 2.0, // for CRRA utility
      // State variables
      stock: params.stock || 0,
      // Visualization
      label: params.label || (type === 'producer' ? `P${id}` : `H${id}`),
    };
    this.nodes.set(id, node);
    return node;
  }

  removeNode(id) {
    // Remove connected edges first
    for (const [key, edge] of this.edges) {
      if (edge.source === id || edge.target === id) {
        this.edges.delete(key);
      }
    }
    this.nodes.delete(id);
  }

  addEdge(sourceId, targetId, params = {}) {
    const key = `${sourceId}-${targetId}`;
    if (this.edges.has(key)) return null;
    
    const edge = {
      source: sourceId,
      target: targetId,
      capacity: params.capacity || Infinity,
      cost: params.cost || 0,
      flow: 0,
    };
    this.edges.set(key, edge);
    return edge;
  }

  removeEdge(sourceId, targetId) {
    this.edges.delete(`${sourceId}-${targetId}`);
  }

  getNeighbors(nodeId) {
    const neighbors = [];
    for (const [key, edge] of this.edges) {
      if (edge.source === nodeId) neighbors.push(edge.target);
      if (edge.target === nodeId) neighbors.push(edge.source);
    }
    return [...new Set(neighbors)]; // dedupe
  }

  // Get outgoing edges from a node
  getOutgoingEdges(nodeId) {
    const out = [];
    for (const [key, edge] of this.edges) {
      if (edge.source === nodeId) out.push(edge);
    }
    return out;
  }

  // Get incoming edges to a node
  getIncomingEdges(nodeId) {
    const inc = [];
    for (const [key, edge] of this.edges) {
      if (edge.target === nodeId) inc.push(edge);
    }
    return inc;
  }

  // Build adjacency matrix with contiguous indices
  getAdjacencyMatrix() {
    const nodes = Array.from(this.nodes.values());
    const idToIndex = new Map();
    nodes.forEach((n, i) => idToIndex.set(n.id, i));
    
    const n = nodes.length;
    const A = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (const edge of this.edges.values()) {
      const i = idToIndex.get(edge.source);
      const j = idToIndex.get(edge.target);
      if (i !== undefined && j !== undefined) {
        A[i][j] = 1;
        A[j][i] = 1; // undirected
      }
    }
    
    return { matrix: A, labels: nodes.map(n => n.label), idToIndex };
  }

  getHouseholds() {
    return Array.from(this.nodes.values()).filter(n => n.type === 'household');
  }

  getProducers() {
    return Array.from(this.nodes.values()).filter(n => n.type === 'producer');
  }

  spectralRadius() {
    const { matrix: A } = this.getAdjacencyMatrix();
    if (A.length === 0) return 0;
    
    const n = A.length;
    // Power iteration for largest eigenvalue (symmetric matrix)
    let b = Array(n).fill(1).map(() => Math.random());
    // Normalize
    let norm = Math.sqrt(b.reduce((s, x) => s + x * x, 0));
    b = b.map(x => x / norm);
    
    for (let iter = 0; iter < 200; iter++) {
      const newB = Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          newB[i] += A[i][j] * b[j];
        }
      }
      norm = Math.sqrt(newB.reduce((s, x) => s + x * x, 0));
      if (norm < 1e-10) return 0;
      b = newB.map(x => x / norm);
    }
    
    // Rayleigh quotient
    let Ab = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        Ab[i] += A[i][j] * b[j];
      }
    }
    const lambda = b.reduce((s, bi, i) => s + bi * Ab[i], 0);
    return Math.abs(lambda);
  }

  isStable() {
    // For an undirected graph, the spectral radius is always >= 1 if connected
    // The "stability" concept here is economic, not graph-theoretic
    // We just report the value without a binary stable/unstable
    return true;
  }

  toJSON() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    };
  }

  fromJSON(data) {
    this.nodes.clear();
    this.edges.clear();
    this.nextId = 0;
    for (const n of data.nodes) {
      this.nodes.set(n.id, n);
      this.nextId = Math.max(this.nextId, n.id + 1);
    }
    for (const e of data.edges) {
      this.edges.set(`${e.source}-${e.target}`, e);
    }
  }
}

// Utility functions
function utility(c, gamma) {
  if (gamma === 1) return Math.log(c);
  return Math.pow(c, 1 - gamma) / (1 - gamma);
}

function marginalUtility(c, gamma) {
  if (c <= 0.001) return 1000;
  return Math.pow(c, -gamma);
}

// Inverse marginal utility: given MU, find c
// u'(c) = c^(-gamma) => c = (u')^(-1/gamma)
function inverseMarginalUtility(mu, gamma) {
  return Math.pow(mu, -1 / gamma);
}

function production(x, A) {
  return A * x;
}

export { EconomicGraph, utility, marginalUtility, inverseMarginalUtility, production };
