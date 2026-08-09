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
      x: params.x || Math.random() * 600 + 50,
      y: params.y || Math.random() * 400 + 50,
      // Producer parameters
      productivity: params.productivity || 1.0,
      // Household parameters
      welfareWeight: params.welfareWeight || 1.0,
      riskAversion: params.riskAversion || 2.0, // for CRRA utility
      // State variables
      stock: params.stock || 0,
      // Visualization
      label: params.label || (type === 'producer' ? `P${id}` : `H${id}`),
      color: params.color || (type === 'producer' ? '#e74c3c' : '#3498db'),
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
    return neighbors;
  }

  getAdjacencyMatrix() {
    const n = this.nodes.size;
    const A = Array(n).fill(null).map(() => Array(n).fill(0));
    for (const edge of this.edges.values()) {
      A[edge.source][edge.target] = 1;
      if (!edge.directed) {
        A[edge.target][edge.source] = 1;
      }
    }
    return A;
  }

  getHouseholds() {
    return Array.from(this.nodes.values()).filter(n => n.type === 'household');
  }

  getProducers() {
    return Array.from(this.nodes.values()).filter(n => n.type === 'producer');
  }

  spectralRadius() {
    const A = this.getAdjacencyMatrix();
    if (A.length === 0) return 0;
    // Power iteration to find largest eigenvalue
    let b = Array(A.length).fill(1);
    for (let iter = 0; iter < 100; iter++) {
      const newB = Array(A.length).fill(0);
      for (let i = 0; i < A.length; i++) {
        for (let j = 0; j < A.length; j++) {
          newB[i] += A[i][j] * b[j];
        }
      }
      const norm = Math.sqrt(newB.reduce((s, x) => s + x * x, 0));
      b = newB.map(x => x / norm);
    }
    // Rayleigh quotient
    let Ab = Array(A.length).fill(0);
    for (let i = 0; i < A.length; i++) {
      for (let j = 0; j < A.length; j++) {
        Ab[i] += A[i][j] * b[j];
      }
    }
    const lambda = b.reduce((s, bi, i) => s + bi * Ab[i], 0);
    return lambda;
  }

  isStable() {
    return this.spectralRadius() < 1;
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

function production(x, A) {
  return A * x;
}

export { EconomicGraph, utility, marginalUtility, production };
