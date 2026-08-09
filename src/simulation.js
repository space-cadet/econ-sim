/**
 * Core simulation engine for networked intertemporal optimization
 * Implements the planner's problem with gradient-based solver
 */

import { EconomicGraph, utility, marginalUtility, production } from './graph.js';

class Simulator {
  constructor(graph, params = {}) {
    this.graph = graph;
    this.beta = params.beta || 0.95; // discount factor
    this.T = params.T || 50; // time horizon (finite approximation)
    this.dt = params.dt || 1.0; // time step
    
    // Initialize state arrays: [time][node_id]
    this.consumption = new Map(); // household_id -> array[T]
    this.transfers = new Map(); // "i-j" -> array[T]
    this.stocks = new Map(); // node_id -> array[T]
    this.shadowPrices = new Map(); // node_id -> array[T]
    
    this.welfare = 0;
    this.converged = false;
    this.iterations = 0;
  }

  initialize() {
    const households = this.graph.getHouseholds();
    const edges = Array.from(this.graph.edges.values());
    const nodes = Array.from(this.graph.nodes.values());

    // Initialize with uniform consumption and zero transfers
    for (const h of households) {
      this.consumption.set(h.id, Array(this.T).fill(0.5));
    }
    for (const edge of edges) {
      this.transfers.set(`${edge.source}-${edge.target}`, Array(this.T).fill(0));
    }
    for (const node of nodes) {
      this.stocks.set(node.id, Array(this.T).fill(node.stock || 0));
      this.shadowPrices.set(node.id, Array(this.T).fill(1));
    }
  }

  // Compute welfare objective
  computeWelfare() {
    let W = 0;
    const households = this.graph.getHouseholds();
    
    for (let t = 0; t < this.T; t++) {
      for (const h of households) {
        const c = this.consumption.get(h.id)[t];
        const weight = h.welfareWeight;
        const gamma = h.riskAversion;
        W += Math.pow(this.beta, t) * weight * utility(Math.max(c, 0.001), gamma);
      }
    }
    return W;
  }

  // Check node flow balance constraint
  checkFlowBalance(nodeId, t) {
    const node = this.graph.nodes.get(nodeId);
    const neighbors = this.graph.getNeighbors(nodeId);
    
    let production = 0;
    if (node.type === 'producer') {
      production = node.productivity; // simplified: constant production
    }
    
    let netTransfers = 0;
    for (const nbr of neighbors) {
      const outKey = `${nodeId}-${nbr}`;
      const inKey = `${nbr}-${nodeId}`;
      const outFlow = this.transfers.get(outKey)?.[t] || 0;
      const inFlow = this.transfers.get(inKey)?.[t] || 0;
      netTransfers += inFlow - outFlow;
    }
    
    let consumption = 0;
    if (node.type === 'household') {
      consumption = this.consumption.get(nodeId)[t] || 0;
    }
    
    const stock_t = this.stocks.get(nodeId)[t] || 0;
    const stock_tp1 = t < this.T - 1 ? (this.stocks.get(nodeId)[t + 1] || 0) : stock_t;
    const deltaStock = stock_tp1 - stock_t;
    
    return production + netTransfers - consumption - deltaStock;
  }

  // Compute gradient of Lagrangian w.r.t. consumption
  gradientConsumption(householdId, t) {
    const h = this.graph.nodes.get(householdId);
    const c = Math.max(this.consumption.get(householdId)[t], 0.001);
    const weight = h.welfareWeight;
    const gamma = h.riskAversion;
    
    // ∂L/∂c = β^t · ω · u'(c) - λ_t
    const shadowPrice = this.shadowPrices.get(householdId)[t];
    const grad = Math.pow(this.beta, t) * weight * marginalUtility(c, gamma) - shadowPrice;
    
    return grad;
  }

  // Compute gradient w.r.t. transfers
  gradientTransfer(sourceId, targetId, t) {
    const lambdaSource = this.shadowPrices.get(sourceId)[t];
    const lambdaTarget = this.shadowPrices.get(targetId)[t];
    return lambdaTarget - lambdaSource; // λ_target - λ_source
  }

  // Compute gradient w.r.t. stocks (Euler equation)
  gradientStock(nodeId, t) {
    if (t === 0) return 0; // initial stock fixed
    
    const lambda_t = this.shadowPrices.get(nodeId)[t];
    const lambda_prev = this.shadowPrices.get(nodeId)[t - 1];
    
    // Euler: λ_t = β(1 + MP)λ_{t+1}
    // Simplified: λ_t = β · λ_{t+1} (with constant MP = 0)
    const lambda_next = t < this.T - 1 ? this.shadowPrices.get(nodeId)[t + 1] : lambda_t;
    const mp = 0.05; // marginal product of storage
    
    return lambda_prev - this.beta * (1 + mp) * lambda_t;
  }

  // Update shadow prices from constraints
  updateShadowPrices() {
    const nodes = Array.from(this.graph.nodes.values());
    const alpha = 0.1; // learning rate
    
    for (let t = 0; t < this.T; t++) {
      for (const node of nodes) {
        const violation = this.checkFlowBalance(node.id, t);
        const current = this.shadowPrices.get(node.id)[t];
        this.shadowPrices.get(node.id)[t] = Math.max(0.01, current + alpha * violation);
      }
    }
  }

  // One step of gradient descent on primal variables
  primalStep(learningRate = 0.01) {
    const households = this.graph.getHouseholds();
    const edges = Array.from(this.graph.edges.values());
    
    // Update consumption
    for (const h of households) {
      const arr = this.consumption.get(h.id);
      for (let t = 0; t < this.T; t++) {
        const grad = this.gradientConsumption(h.id, t);
        arr[t] = Math.max(0.01, arr[t] + learningRate * grad);
      }
    }
    
    // Update transfers
    for (const edge of edges) {
      const key = `${edge.source}-${edge.target}`;
      const arr = this.transfers.get(key);
      for (let t = 0; t < this.T; t++) {
        const grad = this.gradientTransfer(edge.source, edge.target, t);
        arr[t] = Math.max(0, arr[t] + learningRate * grad);
      }
    }
    
    // Update stocks
    const nodes = Array.from(this.graph.nodes.values());
    for (const node of nodes) {
      const arr = this.stocks.get(node.id);
      for (let t = 1; t < this.T; t++) { // t=0 is initial condition
        const grad = this.gradientStock(node.id, t);
        arr[t] = Math.max(0, arr[t] + learningRate * grad);
      }
    }
  }

  // Main solve loop
  solve(maxIter = 1000, tol = 1e-6) {
    this.initialize();
    let prevWelfare = -Infinity;
    
    for (let iter = 0; iter < maxIter; iter++) {
      this.iterations = iter;
      
      // Primal update
      this.primalStep(0.05 / (1 + iter * 0.001));
      
      // Dual update (shadow prices)
      this.updateShadowPrices();
      
      // Check convergence
      const welfare = this.computeWelfare();
      const diff = Math.abs(welfare - prevWelfare);
      
      if (diff < tol && iter > 100) {
        this.converged = true;
        this.welfare = welfare;
        break;
      }
      
      prevWelfare = welfare;
      this.welfare = welfare;
    }
    
    return {
      welfare: this.welfare,
      converged: this.converged,
      iterations: this.iterations,
    };
  }

  // Get time series for a variable
  getTimeSeries(variable, id) {
    switch (variable) {
      case 'consumption':
        return this.consumption.get(id) || [];
      case 'stock':
        return this.stocks.get(id) || [];
      case 'shadowPrice':
        return this.shadowPrices.get(id) || [];
      case 'transfer':
        return this.transfers.get(id) || [];
      default:
        return [];
    }
  }

  // Get aggregate consumption over time
  getAggregateConsumption() {
    const agg = Array(this.T).fill(0);
    for (const [id, arr] of this.consumption) {
      for (let t = 0; t < this.T; t++) {
        agg[t] += arr[t];
      }
    }
    return agg;
  }

  // Get welfare trajectory (discounted cumulative)
  getWelfareTrajectory() {
    const traj = Array(this.T).fill(0);
    const households = this.graph.getHouseholds();
    
    for (let t = 0; t < this.T; t++) {
      let periodWelfare = 0;
      for (const h of households) {
        const c = this.consumption.get(h.id)[t];
        periodWelfare += h.welfareWeight * utility(Math.max(c, 0.001), h.riskAversion);
      }
      traj[t] = (t > 0 ? traj[t - 1] : 0) + Math.pow(this.beta, t) * periodWelfare;
    }
    return traj;
  }

  // Get flow data for visualization
  getFlowData(t) {
    const flows = [];
    for (const [key, arr] of this.transfers) {
      const [source, target] = key.split('-').map(Number);
      flows.push({
        source,
        target,
        value: arr[t] || 0,
      });
    }
    return flows;
  }
}

export { Simulator };
