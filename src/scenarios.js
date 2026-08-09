/**
 * Pre-configured network scenarios for demonstration
 */

import { EconomicGraph } from './graph.js';

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
    
    g.addEdge(p1.id, h1.id);
    g.addEdge(h1.id, p2.id);
    g.addEdge(p2.id, h2.id);
    g.addEdge(h2.id, p3.id);
    
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
    
    // Trade link (initially disabled, user can add)
    // g.addEdge(p1.id, p2.id);
    
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
