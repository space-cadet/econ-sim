/**
 * UI Controller for Econ-Sim
 * Manages panels, controls, and simulation workflow
 */

import { EconomicGraph } from './graph.js?v=6';
import { Simulator } from './simulation.js?v=6';
import { NetworkVisualization } from './visualization.js?v=6';
import { PlotManager } from './plots.js?v=6';
import { Scenarios } from './scenarios.js?v=6';

class App {
  constructor() {
    this.graph = new EconomicGraph();
    this.simulator = null;
    this.visualization = null;
    this.plots = new PlotManager();
    this.isRunning = false;
    this.currentTime = 0;
    this.animationId = null;
    this.hasShownPlots = false;
    
    this.edgeCreationMode = false;
    this.edgeSourceNode = null;
    
    this.init();
  }

  init() {
    // Create default network
    this.createDefaultNetwork();
    
    // Initialize visualization with color palette
    const colors = {
      producer: getComputedStyle(document.documentElement).getPropertyValue('--producer-color').trim() || '#f87171',
      household: getComputedStyle(document.documentElement).getPropertyValue('--household-color').trim() || '#2dd4bf',
      edge: '#475569',
      text: '#e2e8f0',
      highlight: '#fbbf24',
      stroke: '#1e293b',
      flow: '#fbbf24',
    };
    
    this.visualization = new NetworkVisualization('#network-viz', 800, 500, colors);
    this.visualization.init(this.graph);
    this.visualization.onNodeClick = (node) => this.onNodeSelected(node);
    this.visualization.onEdgeClick = (edge) => this.onEdgeSelected(edge);
    
    // Set up event listeners
    this.setupControls();
    this.setupTabs();
    
    // Update stability indicator
    this.updateStabilityIndicator();
    
    // Initial plot
    this.runSimulation();
  }

  loadScenario(name) {
    this.stopAnimation();
    this.graph = Scenarios[name]();
    this.visualization.init(this.graph);
    this.visualization.onNodeClick = (node) => this.onNodeSelected(node);
    this.visualization.onEdgeClick = (edge) => this.onEdgeSelected(edge);
    this.updateStabilityIndicator();
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

    // Edges - bipartite: producers only connect to households
    this.graph.addEdge(p0.id, h0.id);
    this.graph.addEdge(p0.id, h1.id);
    this.graph.addEdge(p0.id, h2.id);
    this.graph.addEdge(p1.id, h0.id);
    this.graph.addEdge(p1.id, h1.id);
  }

  setupControls() {
    // Scenario loading
    document.getElementById('load-scenario').addEventListener('change', (e) => {
      const scenario = e.target.value;
      if (scenario && Scenarios[scenario]) {
        this.loadScenario(scenario);
      }
    });
    
    // Edge creation mode
    document.getElementById('toggle-edge-mode').addEventListener('click', () => {
      this.edgeCreationMode = !this.edgeCreationMode;
      const btn = document.getElementById('toggle-edge-mode');
      btn.textContent = this.edgeCreationMode ? '✓ Edge Mode ON' : '🔗 Edge Mode';
      btn.style.background = this.edgeCreationMode ? '#059669' : '#475569';
    });
    
    // Add node buttons
    document.getElementById('add-producer').addEventListener('click', () => {
      const node = this.graph.addNode('producer', { 
        productivity: parseFloat(document.getElementById('prod-productivity').value) || 1.0 
      });
      
      if (document.getElementById('auto-connect')?.checked) {
        this.autoConnectNode(node);
      }
      
      this.visualization.update();
      this.updateStabilityIndicator();
    });

    document.getElementById('add-household').addEventListener('click', () => {
      const node = this.graph.addNode('household', {
        welfareWeight: parseFloat(document.getElementById('hh-weight').value) || 1.0,
        riskAversion: parseFloat(document.getElementById('hh-gamma').value) || 2.0,
      });
      
      if (document.getElementById('auto-connect')?.checked) {
        this.autoConnectNode(node);
      }
      
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
      if (e.key === ' ' && e.target.tagName !== 'INPUT') {
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
        
        // Resize charts when plots tab becomes visible
        if (target === 'plots-tab') {
          setTimeout(() => {
            this.plots.charts.forEach(c => c?.resize());
            // Re-render adjacency heatmap since canvas size may have been wrong when hidden
            if (this.simulator) {
              const { matrix: A, labels: nodeLabels } = this.graph.getAdjacencyMatrix();
              this.plots.createAdjacencyHeatmap('adjacency-plot', A, nodeLabels);
            }
          }, 100);
        }
      });
    });
  }

  onNodeSelected(node) {
    if (this.edgeCreationMode && this.edgeSourceNode === null) {
      this.edgeSourceNode = node;
      this.visualization.setEdgeSource(node);
      document.getElementById('node-properties').innerHTML = 
        `<p style="color: #fbbf24; font-weight: 500;">✓ Selected ${node.label} as source. Click target node to connect.</p>`;
      return;
    } else if (this.edgeCreationMode && this.edgeSourceNode !== null) {
      if (this.edgeSourceNode.id !== node.id) {
        this.graph.addEdge(this.edgeSourceNode.id, node.id);
        this.visualization.clearEdgeSource();
        this.visualization.update();
        this.updateStabilityIndicator();
        
        document.getElementById('node-properties').innerHTML = 
          `<p style="color: #34d399; font-weight: 500;">✓ Created edge: ${this.edgeSourceNode.label} → ${node.label}</p>`;
      }
      this.edgeSourceNode = null;
      this.edgeCreationMode = false;
      document.getElementById('toggle-edge-mode').textContent = '🔗 Edge Mode';
      document.getElementById('toggle-edge-mode').style.background = '#475569';
      return;
    } else {
      this.visualization.selectNode(node);
    }
    
    const panel = document.getElementById('node-properties');
    const typeColor = node.type === 'producer' ? 'var(--producer-color)' : 'var(--household-color)';
    panel.innerHTML = `
      <h4 style="color: ${typeColor}; margin-bottom: 8px;">Node ${node.id}: ${node.label}</h4>
      <p><strong>Type:</strong> ${node.type === 'producer' ? 'Producer 🔴' : 'Household 🟢'}</p>
      ${node.type === 'producer' ? `
        <p><strong>Productivity:</strong> ${node.productivity.toFixed(2)}</p>
      ` : `
        <p><strong>Welfare Weight:</strong> ${node.welfareWeight.toFixed(2)}</p>
        <p><strong>Risk Aversion (γ):</strong> ${node.riskAversion.toFixed(2)}</p>
      `}
    `;
  }

  onEdgeSelected(edge) {
    const source = this.graph.nodes.get(edge.source.id || edge.source);
    const target = this.graph.nodes.get(edge.target.id || edge.target);
    const panel = document.getElementById('node-properties');
    panel.innerHTML = `
      <h4 style="color: #fbbf24; margin-bottom: 8px;">Edge: ${source?.label || '?'} → ${target?.label || '?'}</h4>
      <p><strong>Flow:</strong> ${edge.value?.toFixed(3) || '0.000'}</p>
      <button id="delete-edge" class="danger" style="margin-top: 8px;">🗑️ Delete Edge</button>
    `;
    
    document.getElementById('delete-edge').addEventListener('click', () => {
      this.graph.removeEdge(edge.source.id || edge.source, edge.target.id || edge.target);
      this.visualization.clearEdgeSelection();
      this.visualization.update();
      this.updateStabilityIndicator();
      panel.innerHTML = `<p style="color: #f87171;">Edge deleted</p>`;
    });
  }

  autoConnectNode(node) {
    // Connect to nearest 2 compatible nodes (producers connect to households, households to producers)
    const allNodes = Array.from(this.graph.nodes.values()).filter(n => n.id !== node.id);
    if (allNodes.length === 0) return;
    
    // Sort by distance
    const byDistance = allNodes.map(n => ({
      node: n,
      dist: Math.hypot((n.x || 0) - (node.x || 0), (n.y || 0) - (node.y || 0)),
    })).sort((a, b) => a.dist - b.dist);
    
    // Connect to nearest 2-3 nodes
    const nConnect = Math.min(3, byDistance.length);
    for (let i = 0; i < nConnect; i++) {
      const target = byDistance[i].node;
      // Prefer connecting to different type for bipartite structure
      if (target.type !== node.type || Math.random() < 0.3) {
        this.graph.addEdge(node.id, target.id);
      }
    }
  }

  updateStabilityIndicator() {
    const rho = this.graph.spectralRadius();
    const el = document.getElementById('stability-indicator');
    
    el.innerHTML = `
      <span style="color: var(--text-secondary);">
        ρ(A) = <strong style="color: var(--accent-primary);">${rho.toFixed(3)}</strong>
      </span>
    `;
  }

  runSimulation() {
    const btn = document.getElementById('run-sim');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Solving...';
    btn.disabled = true;
    
    const statusEl = document.getElementById('convergence-status');
    statusEl.textContent = 'Running solver...';
    statusEl.style.color = '#fbbf24';
    
    // Use setTimeout to allow UI update before heavy computation
    setTimeout(() => {
      try {
        const beta = parseFloat(document.getElementById('beta-slider').value);
        const T = parseInt(document.getElementById('horizon-slider').value);
        
        this.simulator = new Simulator(this.graph, { beta, T });
        const result = this.simulator.solve();
        
        // Update status
        document.getElementById('welfare-value').textContent = result.welfare.toFixed(4);
        document.getElementById('convergence-status').textContent = 
          result.converged ? `✓ Converged (${result.iterations} iters)` : `⚠ Not converged (${result.iterations} iters)`;
        document.getElementById('convergence-status').style.color = result.converged ? '#34d399' : '#f87171';
        
        // Update time display
        document.getElementById('time-display').textContent = `t = 0 / ${T}`;
        
        // Update plots
        this.updatePlots();
        this.updateInlinePlots();
        
        // Show quick results panel
        document.getElementById('quick-results').style.display = 'block';
        
        // Auto-switch to plots on first run
        if (!this.hasShownPlots) {
          this.hasShownPlots = true;
          setTimeout(() => {
            document.querySelector('[data-tab="plots-tab"]').click();
          }, 500);
        }
      } catch (err) {
        console.error('Simulation error:', err);
        document.getElementById('convergence-status').textContent = 'Error: ' + err.message;
        document.getElementById('convergence-status').style.color = '#f87171';
      } finally {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    }, 50);
  }

  resetSimulation() {
    this.stopAnimation();
    this.edgeCreationMode = false;
    this.edgeSourceNode = null;
    this.graph = new EconomicGraph();
    this.createDefaultNetwork();
    this.visualization.init(this.graph);
    this.visualization.onNodeClick = (node) => this.onNodeSelected(node);
    this.visualization.onEdgeClick = (edge) => this.onEdgeSelected(edge);
    this.updateStabilityIndicator();
    document.getElementById('welfare-value').textContent = '—';
    document.getElementById('convergence-status').textContent = '—';
    document.getElementById('convergence-status').style.color = '';
    document.getElementById('time-display').textContent = 't = 0';
    document.getElementById('quick-results').style.display = 'none';
    this.plots.destroyAll();
    this.hasShownPlots = false;
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
      
      // Update time display
      document.getElementById('time-display').textContent = `t = ${this.currentTime} / ${this.simulator.T}`;
      
      // Advance time
      this.currentTime = (this.currentTime + 1) % this.simulator.T;
      
      this.animationId = setTimeout(animate, 600);
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
    this.plots.createTimeSeriesPlot('consumption-plot', consumptionDatasets, labels, {
      title: 'Consumption Paths',
      yLabel: 'Consumption',
    });
    
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
    const { matrix: A, labels: nodeLabels } = this.graph.getAdjacencyMatrix();
    this.plots.createAdjacencyHeatmap('adjacency-plot', A, nodeLabels);
  }

  updateInlinePlots() {
    if (!this.simulator) return;
    
    const labels = Array.from({ length: this.simulator.T }, (_, i) => i);
    const households = this.graph.getHouseholds();
    
    // Mini consumption plot
    const consumptionDatasets = households.slice(0, 3).map((h, i) => ({
      label: h.label,
      data: this.simulator.getTimeSeries('consumption', h.id),
      color: this.visualization?.getColor?.(i) || null,
    }));
    this.plots.createMiniPlot('mini-consumption', consumptionDatasets, labels);
    
    // Mini welfare plot
    this.plots.createMiniPlot('mini-welfare', [{
      label: 'Welfare',
      data: this.simulator.getWelfareTrajectory(),
      color: '#2dd4bf',
    }], labels);
  }
}

export { App };
