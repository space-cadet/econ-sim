/**
 * Pre-configured network scenarios for demonstration
 */

import { EconomicGraph } from './graph.js?v=5';

const Scenarios = {
  // Star network: one central producer, multiple households
  star: () => {
    const g = new EconomicGraph();
    const hub = g.addNode('producer', { x: 400, y: 250, productivity: 3.0, label: 'Hub' });
    
    const households = [
      { x: 400, y: 100, weight: 1.0, gamma: 2.0, label: 'H0' },
      { x: 600, y: 200, weight: 0.8, gamma: 1.5, label: 'H1' },
      { x: 550, y: 400, weight: 1.2, gamma: 3.0, label: 'H2' },
      { x: 250, y: 400, weight: 0.9, gamma: 2.5, label: 'H3' },
      { x: 200, y: 200, weight: 1.1, gamma: 2.0, label: 'H4' },
    ];
    
    for (const h of households) {
      const node = g.addNode('household', h);
      g.addEdge(hub.id, node.id);
    }
    
    return g;
  },

  // Chain network: linear sequence of producers and households
  chain: () => {
    const g = new EconomicGraph();
    
    const p1 = g.addNode('producer', { x: 100, y: 250, productivity: 2.0, label: 'P1' });
    const h1 = g.addNode('household', { x: 250, y: 250, welfareWeight: 1.0, riskAversion: 2.0, label: 'H1' });
    const p2 = g.addNode('producer', { x: 400, y: 250, productivity: 1.5, label: 'P2' });
    const h2 = g.addNode('household', { x: 550, y: 250, welfareWeight: 0.8, riskAversion: 1.5, label: 'H2' });
    const p3 = g.addNode('producer', { x: 700, y: 250, productivity: 1.0, label: 'P3' });
    
    // Chain: P1 -> H1, P2 -> H1, P2 -> H2, P3 -> H2 (bipartite)
    g.addEdge(p1.id, h1.id);
    g.addEdge(p2.id, h1.id);
    g.addEdge(p2.id, h2.id);
    g.addEdge(p3.id, h2.id);
    
    return g;
  },

  // Two islands: disconnected subgraphs demonstrating trade benefits
  twoIslands: () => {
    const g = new EconomicGraph();
    
    // Island 1: rich producer, poor household
    const p1 = g.addNode('producer', { x: 200, y: 200, productivity: 3.0, label: 'P1 (Rich)' });
    const h1 = g.addNode('household', { x: 350, y: 200, welfareWeight: 0.5, riskAversion: 2.0, label: 'H1' });
    g.addEdge(p1.id, h1.id);
    
    // Island 2: poor producer, rich household
    const p2 = g.addNode('producer', { x: 500, y: 350, productivity: 0.5, label: 'P2 (Poor)' });
    const h2 = g.addNode('household', { x: 650, y: 350, welfareWeight: 1.5, riskAversion: 2.0, label: 'H2' });
    g.addEdge(p2.id, h2.id);
    
    return g;
  },

  // Cycle network: circular flow
  cycle: () => {
    const g = new EconomicGraph();
    
    const nodes = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * 2 * Math.PI;
      const x = 400 + 200 * Math.cos(angle);
      const y = 250 + 150 * Math.sin(angle);
      
      if (i % 2 === 0) {
        nodes.push(g.addNode('producer', { x, y, productivity: 1.0 + i * 0.2, label: `P${i/2}` }));
      } else {
        nodes.push(g.addNode('household', { x, y, welfareWeight: 1.0, riskAversion: 2.0, label: `H${Math.floor(i/2)}` }));
      }
    }
    
    // Create cycle
    for (let i = 0; i < nodes.length; i++) {
      g.addEdge(nodes[i].id, nodes[(i + 1) % nodes.length].id);
    }
    
    return g;
  },

  // Scale-free network (Barabási-Albert preferential attachment)
  scaleFree: (n = 12, m0 = 3) => {
    const g = new EconomicGraph();
    
    // Start with m0 fully connected producers
    const initialNodes = [];
    for (let i = 0; i < m0; i++) {
      const angle = (i / m0) * 2 * Math.PI;
      initialNodes.push(g.addNode('producer', {
        x: 400 + 100 * Math.cos(angle),
        y: 250 + 80 * Math.sin(angle),
        productivity: 1.0 + Math.random(),
        label: `P${i}`,
      }));
    }
    
    // Connect initial nodes
    for (let i = 0; i < m0; i++) {
      for (let j = i + 1; j < m0; j++) {
        g.addEdge(initialNodes[i].id, initialNodes[j].id);
      }
    }
    
    // Preferential attachment
    const degrees = new Map(initialNodes.map(n => [n.id, m0 - 1]));
    
    for (let i = m0; i < n; i++) {
      const isProducer = i < n * 0.4;
      const type = isProducer ? 'producer' : 'household';
      const angle = (i / n) * 2 * Math.PI;
      const r = 80 + (i / n) * 180;
      
      const newNode = g.addNode(type, {
        x: 400 + r * Math.cos(angle),
        y: 250 + r * Math.sin(angle) * 0.75,
        productivity: isProducer ? 0.5 + Math.random() : undefined,
        welfareWeight: isProducer ? undefined : 0.5 + Math.random(),
        riskAversion: isProducer ? undefined : 1.0 + Math.random() * 2,
        label: isProducer ? `P${i}` : `H${i - m0}`,
      });
      
      // Connect to existing nodes with prob proportional to degree
      const totalDegree = Array.from(degrees.values()).reduce((a, b) => a + b, 0);
      const targets = [];
      
      for (const [nodeId, deg] of degrees) {
        const prob = deg / totalDegree;
        if (Math.random() < prob || targets.length === 0) {
          targets.push(nodeId);
        }
      }
      
      // Ensure at least 1 and at most 3 connections
      const nConnections = Math.max(1, Math.min(3, targets.length));
      for (let j = 0; j < nConnections; j++) {
        g.addEdge(newNode.id, targets[j % targets.length]);
      }
      
      degrees.set(newNode.id, nConnections);
      for (let j = 0; j < nConnections; j++) {
        const tid = targets[j % targets.length];
        degrees.set(tid, (degrees.get(tid) || 0) + 1);
      }
    }
    
    return g;
  },

  // Small-world network (Watts-Strogatz)
  smallWorld: (n = 10, k = 4, beta = 0.3) => {
    const g = new EconomicGraph();
    const nodes = [];
    
    // Create ring of nodes
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * 2 * Math.PI;
      const isProducer = i % 2 === 0;
      nodes.push(g.addNode(isProducer ? 'producer' : 'household', {
        x: 400 + 200 * Math.cos(angle),
        y: 250 + 150 * Math.sin(angle),
        productivity: isProducer ? 0.8 + Math.random() : undefined,
        welfareWeight: isProducer ? undefined : 0.5 + Math.random(),
        riskAversion: isProducer ? undefined : 1.0 + Math.random() * 2,
        label: isProducer ? `P${i/2|0}` : `H${i/2|0}`,
      }));
    }
    
    // Ring lattice: connect each node to k nearest neighbors
    for (let i = 0; i < n; i++) {
      for (let j = 1; j <= k / 2; j++) {
        const target = (i + j) % n;
        g.addEdge(nodes[i].id, nodes[target].id);
      }
    }
    
    // Rewire with probability beta
    for (let i = 0; i < n; i++) {
      for (let j = 1; j <= k / 2; j++) {
        if (Math.random() < beta) {
          const oldTarget = (i + j) % n;
          g.removeEdge(nodes[i].id, nodes[oldTarget].id);
          
          // Connect to random other node
          let newTarget;
          do {
            newTarget = Math.floor(Math.random() * n);
          } while (newTarget === i || newTarget === oldTarget);
          
          g.addEdge(nodes[i].id, nodes[newTarget].id);
        }
      }
    }
    
    return g;
  },

  // Grid network
  grid: (rows = 3, cols = 4) => {
    const g = new EconomicGraph();
    const nodes = [];
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isProducer = (r + c) % 3 === 0;
        nodes.push(g.addNode(isProducer ? 'producer' : 'household', {
          x: 150 + c * 140,
          y: 100 + r * 120,
          productivity: isProducer ? 0.8 + Math.random() : undefined,
          welfareWeight: isProducer ? undefined : 0.5 + Math.random(),
          riskAversion: isProducer ? undefined : 1.0 + Math.random() * 2,
          label: isProducer ? `P${r}-${c}` : `H${r}-${c}`,
        }));
      }
    }
    
    // Horizontal and vertical edges
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        
        // Right neighbor
        if (c + 1 < cols) {
          g.addEdge(nodes[idx].id, nodes[idx + 1].id);
        }
        // Bottom neighbor
        if (r + 1 < rows) {
          g.addEdge(nodes[idx].id, nodes[idx + cols].id);
        }
      }
    }
    
    return g;
  },

  // Complete bipartite (many-to-many matching)
  bipartite: (nProducers = 4, nHouseholds = 5) => {
    const g = new EconomicGraph();
    const producers = [];
    const households = [];
    
    for (let i = 0; i < nProducers; i++) {
      producers.push(g.addNode('producer', {
        x: 200,
        y: 80 + (i / (nProducers - 1 || 1)) * 340,
        productivity: 0.5 + Math.random() * 1.5,
        label: `P${i}`,
      }));
    }
    
    for (let i = 0; i < nHouseholds; i++) {
      households.push(g.addNode('household', {
        x: 600,
        y: 80 + (i / (nHouseholds - 1 || 1)) * 340,
        welfareWeight: 0.5 + Math.random(),
        riskAversion: 1.0 + Math.random() * 2,
        label: `H${i}`,
      }));
    }
    
    // Connect every producer to every household
    for (const p of producers) {
      for (const h of households) {
        g.addEdge(p.id, h.id);
      }
    }
    
    return g;
  },

  // Random network
  random: (n = 8, p = 0.3) => {
    const g = new EconomicGraph();
    
    // Add nodes
    for (let i = 0; i < n; i++) {
      const type = Math.random() > 0.5 ? 'producer' : 'household';
      const x = 100 + Math.random() * 600;
      const y = 50 + Math.random() * 400;
      
      if (type === 'producer') {
        g.addNode('producer', { x, y, productivity: 0.5 + Math.random() * 2, label: `P${i}` });
      } else {
        g.addNode('household', { x, y, welfareWeight: 0.5 + Math.random(), riskAversion: 1 + Math.random() * 2, label: `H${i}` });
      }
    }
    
    // Add edges randomly
    const nodes = Array.from(g.nodes.values());
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (Math.random() < p) {
          g.addEdge(nodes[i].id, nodes[j].id);
        }
      }
    }
    
    return g;
  },
};

export { Scenarios };
