/**
 * UI Controller for Econ-Sim
 * Manages panels, controls, and simulation workflow
 */

import { EconomicGraph } from './graph.js';
import { Simulator } from './simulation.js';
import { NetworkVisualization } from './visualization.js';
import { PlotManager } from './plots.js';

class App {
  constructor() {
    this.graph = new EconomicGraph();
    this.simulator = null;
    this.visualization = null;
    this.plots = new PlotManager();
    this.isRunning = false;
    this.currentTime = 0;
    this.animationId = null;
    
    this.init();
  }

  init() {
    // Create default network: 2 producers, 3 households, star topology
    this.createDefaultNetwork();
    
    // Initialize visualization
    this.visualization = new NetworkVisualization('#network-viz', 800, 500);
    this.visualization.init(this.graph);
    this.visualization.onNodeClick = (node) => this.onNodeSelected(node);
    
    // Set up event listeners
    this.setupControls();
    this.setupTabs();
    
    // Update stability indicator
    this.updateStabilityIndicator();
    
    // Initial plot
    this.runSimulation();
  }

  createDefaultNetwork() {
    // Producer 0 (center)
    const p0 = this.graph.addNode('producer', { 
      x: 400, y: 250, 
      productivity: 2.0, 
      label: 'P0 (Hub)' 
    });
    
    // Producer 1
    const p1 = this.graph.addNode('producer', { 
      x: 200, y: 150, 
      productivity: 1.5, 
      label: 'P1' 
    });
    
    // Households
    const h0 = this.graph.addNode('household', { 
      x: 600, y: 200, 
      welfareWeight: 1.0, 
      riskAversion: 2.0, 
      label: 'H0' 
    });
    const h1 = this.graph.addNode('household', { 
      x: 350, y: 400, 
      welfareWeight: 0.8, 
      riskAversion: 1.5, 
      label: 'H1' 
    });
    const h2 = this.graph.addNode('household', { 
      x: 550, y: 350, 
      welfareWeight: 1.2, 
      riskAversion: 3.0, 
      label: 'H2' 
    });

    // Edges
    this.graph.addEdge(p0.id, h0.id);
    this.graph.addEdge(p0.id, h1.id);
    this.graph.addEdge(p1.id, p0.id);
    this.graph.addEdge(p1.id, h2.id);
    this.graph.addEdge(p0.id, h2.id);
  }

  setupControls() {
    // Add node buttons
    document.getElementById('add-producer').addEventListener('click', () => {
      this.graph.addNode('producer', { 
        productivity: parseFloat(document.getElementById('prod-productivity').value) || 1.0 
      });
      this.visualization.update();
      this.updateStabilityIndicator();
    });

    document.getElementById('add-household').addEventListener('click', () => {
      this.graph.addNode('household', {
        welfareWeight: parseFloat(document.getElementById('hh-weight').value) || 1.0,
        riskAversion: parseFloat(document.getElementById('hh-gamma').value) || 2.0,
      });
      this.visualization.update();
      this.updateStabilityIndicator();
    });

    document.getElementById('remove-node').addEventListener('click', () => {
      if (this.visualization.selectedNode !== null) {
        this.graph.removeNode(this.visualization.selectedNode.id);
        this.visualization.selectedNode = null;
        this.visualization.update();
        this.updateStabilityIndicator();
      }
    });

    // Simulation controls
    document.getElementById('run-sim').addEventListener('click', () => this.runSimulation());
    document.getElementById('reset-sim').addEventListener('click', () => this.resetSimulation());
    document.getElementById('play-animation').addEventListener('click', () => this.toggleAnimation());

    // Parameter sliders
    document.getElementById('beta-slider').addEventListener('input', (e) => {
      document.getElementById('beta-value').textContent = e.target.value;
    });

    document.getElementById('horizon-slider').addEventListener('input', (e) => {
      document.getElementById('horizon-value').textContent = e.target.value;
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === ' ') {
        e.preventDefault();
        this.toggleAnimation();
      }
    });
  }

  setupTabs() {
    const tabs = document.querySelectorAll('.tab-button');
    const panels = document.querySelectorAll('.tab-panel');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(target).classList.add('active');
      });
    });
  }

  onNodeSelected(node) {
    const panel = document.getElementById('node-properties');
    panel.innerHTML = `
      <h4>Node ${node.id}: ${node.label}</h4>
      <p>Type: ${node.type}</p>
      <p>Stock: ${node.stock?.toFixed(2) || 0}</p>
      ${node.type === 'producer' ? `
        <p>Productivity: ${node.productivity}</p>
      ` : `
        <p>Welfare Weight: ${node.welfareWeight}</p>
        <p>Risk Aversion (γ): ${node.riskAversion}</p>
      `}
    `;
  }

  updateStabilityIndicator() {
    const rho = this.graph.spectralRadius();
    const stable = this.graph.isStable();
    const el = document.getElementById('stability-indicator');
    
    el.innerHTML = `
      <span class="stability-${stable ? 'stable' : 'unstable'}">
        ρ(A) = ${rho.toFixed(3)} ${stable ? '✓ Stable' : '✗ Unstable'}
      </span>
    `;
  }

  runSimulation() {
    const beta = parseFloat(document.getElementById('beta-slider').value);
    const T = parseInt(document.getElementById('horizon-slider').value);
    
    this.simulator = new Simulator(this.graph, { beta, T });
    const result = this.simulator.solve();
    
    document.getElementById('welfare-value').textContent = result.welfare.toFixed(4);
    document.getElementById('convergence-status').textContent = 
      result.converged ? `Converged (${result.iterations} iter)` : `Not converged (${result.iterations} iter)`;
    
    this.updatePlots();
    this.currentTime = 0;
  }

  resetSimulation() {
    this.stopAnimation();
    this.graph = new EconomicGraph();
    this.createDefaultNetwork();
    this.visualization.init(this.graph);
    this.runSimulation();
  }

  toggleAnimation() {
    if (this.isRunning) {
      this.stopAnimation();
    } else {
      this.startAnimation();
    }
  }

  startAnimation() {
    if (!this.simulator) return;
    this.isRunning = true;
    document.getElementById('play-animation').textContent = '⏸ Pause';
    
    const animate = () => {
      if (!this.isRunning) return;
      
      // Update flow visualization
      const flows = this.simulator.getFlowData(this.currentTime);
      this.visualization.updateFlows(flows, this.currentTime);
      
      // Update stocks display
      const stocks = new Map();
      for (const [id, arr] of this.simulator.stocks) {
        stocks.set(id, arr[this.currentTime]);
      }
      this.visualization.updateStocks(stocks);
      
      // Update time display
      document.getElementById('time-display').textContent = `t = ${this.currentTime}`;
      
      // Advance time
      this.currentTime = (this.currentTime + 1) % this.simulator.T;
      
      this.animationId = setTimeout(animate, 500);
    };
    
    animate();
  }

  stopAnimation() {
    this.isRunning = false;
    document.getElementById('play-animation').textContent = '▶ Play';
    if (this.animationId) {
      clearTimeout(this.animationId);
      this.animationId = null;
    }
  }

  updatePlots() {
    if (!this.simulator) return;
    
    const labels = Array.from({ length: this.simulator.T }, (_, i) => i);
    
    // Consumption plot
    const households = this.graph.getHouseholds();
    const consumptionDatasets = households.map((h, i) => ({
      label: h.label,
      data: this.simulator.getTimeSeries('consumption', h.id),
      color: this.visualization?.getColor?.(i) || null,
    }));
    this.plots.createTimeSeriesPlot('consumption-plot', consumptionDatasets, labels);
    
    // Shadow prices plot
    const nodes = Array.from(this.graph.nodes.values());
    const shadowPriceData = new Map();
    nodes.forEach(n => {
      shadowPriceData.set(n.id, this.simulator.getTimeSeries('shadowPrice', n.id));
    });
    this.plots.createShadowPricePlot('shadow-price-plot', shadowPriceData, labels);
    
    // Welfare trajectory
    this.plots.createWelfarePlot('welfare-plot', this.simulator.getWelfareTrajectory(), labels);
    
    // Adjacency matrix
    const A = this.graph.getAdjacencyMatrix();
    const nodeLabels = nodes.map(n => n.label);
    this.plots.createAdjacencyHeatmap('adjacency-plot', A, nodeLabels);
  }
}

export { App };
