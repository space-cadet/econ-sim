/**
 * Core simulation engine for networked intertemporal optimization
 * 
 * Solver approach: Optimize over transfers only, derive consumption from flow balance.
 * Each producer's total outflow is constrained to equal its productivity.
 * This makes the problem feasible by construction and avoids dual variable blowup.
 */

import { EconomicGraph, utility, marginalUtility } from './graph.js?v=5';

class Simulator {
  constructor(graph, params = {}) {
    this.graph = graph;
    this.beta = params.beta || 0.95;
    this.T = params.T || 50;
    
    // Decision variables: transfers along each edge
    this.transfers = new Map(); // "i-j" -> array[T]
    
    // Derived quantities
    this.consumption = new Map(); // household_id -> array[T]
    this.shadowPrices = new Map(); // node_id -> array[T]
    
    this.welfare = 0;
    this.converged = false;
    this.iterations = 0;
    this.welfareTrajectory = [];
  }

  initialize() {
    const edges = Array.from(this.graph.edges.values());
    const households = this.graph.getHouseholds();
    
    // Initialize transfers: distribute equally among outgoing edges
    for (const edge of edges) {
      this.transfers.set(`${edge.source}-${edge.target}`, Array(this.T).fill(0));
    }
    
    for (const h of households) {
      this.consumption.set(h.id, Array(this.T).fill(0));
    }
    
    // Set initial transfers: producers split output equally among outgoing edges
    const producers = this.graph.getProducers();
    for (const p of producers) {
      const outEdges = this.graph.getOutgoingEdges(p.id);
      if (outEdges.length > 0) {
        const share = p.productivity / outEdges.length;
        for (const edge of outEdges) {
          const arr = this.transfers.get(`${edge.source}-${edge.target}`);
          for (let t = 0; t < this.T; t++) {
            arr[t] = share;
          }
        }
      }
    }
  }

  // Compute consumption from transfers using flow balance
  // Household consumption = sum of incoming transfers
  computeConsumption() {
    const households = this.graph.getHouseholds();
    
    for (let t = 0; t < this.T; t++) {
      for (const h of households) {
        let inflow = 0;
        const incoming = this.graph.getIncomingEdges(h.id);
        for (const edge of incoming) {
          inflow += this.transfers.get(`${edge.source}-${edge.target}`)?.[t] || 0;
        }
        this.consumption.get(h.id)[t] = Math.max(0.001, inflow);
      }
    }
  }

  // Compute welfare objective
  computeWelfare() {
    let W = 0;
    const households = this.graph.getHouseholds();
    
    for (let t = 0; t < this.T; t++) {
      let periodWelfare = 0;
      for (const h of households) {
        const c = this.consumption.get(h.id)[t];
        periodWelfare += h.welfareWeight * utility(c, h.riskAversion);
      }
      W += Math.pow(this.beta, t) * periodWelfare;
    }
    return W;
  }

  // Compute per-period welfare (for trajectory)
  computePeriodWelfare(t) {
    let periodWelfare = 0;
    const households = this.graph.getHouseholds();
    for (const h of households) {
      const c = this.consumption.get(h.id)[t];
      periodWelfare += h.welfareWeight * utility(c, h.riskAversion);
    }
    return periodWelfare;
  }

  // Compute shadow price for a node (welfare-weighted marginal utility)
  computeShadowPrice(nodeId, t) {
    const node = this.graph.nodes.get(nodeId);
    if (!node) return 0;
    
    if (node.type === 'household') {
      const c = this.consumption.get(nodeId)[t];
      return node.welfareWeight * marginalUtility(c, node.riskAversion);
    }
    
    // For producers: shadow price is max of downstream household shadow prices
    // (or average if multiple paths)
    const outEdges = this.graph.getOutgoingEdges(nodeId);
    if (outEdges.length === 0) return 0;
    
    let maxShadow = 0;
    for (const edge of outEdges) {
      const targetShadow = this.computeShadowPrice(edge.target, t);
      maxShadow = Math.max(maxShadow, targetShadow);
    }
    return maxShadow;
  }

  // Compute all shadow prices
  computeAllShadowPrices() {
    const nodes = Array.from(this.graph.nodes.values());
    for (const node of nodes) {
      if (!this.shadowPrices.has(node.id)) {
        this.shadowPrices.set(node.id, Array(this.T).fill(0));
      }
      for (let t = 0; t < this.T; t++) {
        this.shadowPrices.get(node.id)[t] = this.computeShadowPrice(node.id, t);
      }
    }
  }

  // Gradient of welfare w.r.t. transfer from source to target at time t
  // ∂W/∂T_{source→target,t} = β^t * (λ_target - λ_source)
  // where λ = shadow price = welfare-weighted marginal utility
  gradientTransfer(sourceId, targetId, t) {
    const lambdaSource = this.computeShadowPrice(sourceId, t);
    const lambdaTarget = this.computeShadowPrice(targetId, t);
    return Math.pow(this.beta, t) * (lambdaTarget - lambdaSource);
  }

  // Project producer outflows onto simplex: total outflow = productivity
  projectProducerFlows() {
    const producers = this.graph.getProducers();
    
    for (let t = 0; t < this.T; t++) {
      for (const p of producers) {
        const outEdges = this.graph.getOutgoingEdges(p.id);
        if (outEdges.length === 0) continue;
        
        // Get current outflows
        let totalOut = 0;
        const flows = [];
        for (const edge of outEdges) {
          const key = `${edge.source}-${edge.target}`;
          const val = this.transfers.get(key)[t];
          flows.push({ key, val });
          totalOut += val;
        }
        
        if (totalOut === 0) {
          // If no flow, distribute equally
          const share = p.productivity / outEdges.length;
          for (const { key } of flows) {
            this.transfers.get(key)[t] = share;
          }
        } else {
          // Scale to match productivity
          const scale = p.productivity / totalOut;
          for (const { key } of flows) {
            this.transfers.get(key)[t] *= scale;
          }
        }
      }
    }
  }

  // Main solve loop
  solve(maxIter = 1000, tol = 1e-6) {
    this.initialize();
    this.welfareTrajectory = [];
    
    let prevWelfare = -Infinity;
    let bestWelfare = -Infinity;
    let patience = 0;
    const patienceLimit = 100;
    
    for (let iter = 0; iter < maxIter; iter++) {
      this.iterations = iter;
      
      // Compute consumption from current transfers
      this.computeConsumption();
      
      // Compute welfare
      const welfare = this.computeWelfare();
      this.welfare = welfare;
      
      // Record trajectory
      this.welfareTrajectory.push(welfare);
      
      // Check convergence
      const diff = Math.abs(welfare - prevWelfare);
      
      if (welfare > bestWelfare) {
        bestWelfare = welfare;
        patience = 0;
      } else {
        patience++;
      }
      
      if (patience > patienceLimit && iter > 100) {
        this.converged = true;
        this.welfare = bestWelfare;
        break;
      }
      
      if (diff < tol && iter > 50) {
        this.converged = true;
        this.welfare = welfare;
        break;
      }
      
      // Adaptive learning rate
      let lr = 0.5;
      if (iter < 100) lr = 0.5;
      else if (iter < 300) lr = 0.2;
      else lr = 0.05;
      
      // Gradient ascent on transfers
      for (const [key, arr] of this.transfers) {
        const [source, target] = key.split('-').map(Number);
        for (let t = 0; t < this.T; t++) {
          const grad = this.gradientTransfer(source, target, t);
          arr[t] = Math.max(0, arr[t] + lr * grad);
        }
      }
      
      // Project onto feasible set (producer flow constraints)
      this.projectProducerFlows();
      
      prevWelfare = welfare;
    }
    
    // Final computation
    this.computeConsumption();
    this.computeAllShadowPrices();
    this.welfare = this.computeWelfare();
    
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

  // Get welfare trajectory (for plotting)
  getWelfareTrajectory() {
    // Return per-period utility (shifted to be positive for display)
    const traj = Array(this.T).fill(0);
    const households = this.graph.getHouseholds();
    
    // Find minimum utility for shifting
    let minUtil = 0;
    for (let t = 0; t < this.T; t++) {
      for (const h of households) {
        const c = this.consumption.get(h.id)[t];
        const u = utility(c, h.riskAversion);
        minUtil = Math.min(minUtil, u);
      }
    }
    const offset = Math.abs(minUtil) + 1; // Ensure all values positive
    
    for (let t = 0; t < this.T; t++) {
      let periodWelfare = 0;
      for (const h of households) {
        const c = this.consumption.get(h.id)[t];
        periodWelfare += h.welfareWeight * (utility(c, h.riskAversion) + offset);
      }
      traj[t] = periodWelfare;
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

  // Get total production in the network
  getTotalProduction() {
    return this.graph.getProducers().reduce((sum, p) => sum + p.productivity, 0);
  }

  // Get total consumption in the network at time t
  getTotalConsumption(t) {
    let total = 0;
    for (const [id, arr] of this.consumption) {
      total += arr[t] || 0;
    }
    return total;
  }
}

export { Simulator };
