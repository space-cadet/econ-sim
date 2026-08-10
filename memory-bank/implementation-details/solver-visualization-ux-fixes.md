# Implementation Details: Econ-Sim Bug-Fix Sprint

*Created: 2026-08-10*
*Related Tasks: T7, T8, T9, T10, T11, T12*

## Overview

This document captures the detailed technical decisions and code patterns for fixing the critical issues in the econ-sim solver, visualization, and UX.

---

## Solver Architecture Decision (T7)

### Problem

The current solver implements a custom primal-dual gradient descent for a constrained optimization problem. The issues:

1. **Dual variables unbounded** — Shadow prices grow without limit
2. **No constraint projection** — Flow balance never satisfied
3. **Inappropriate algorithm** — Gradient descent on constrained problem without projection is guaranteed to fail

### Decision: Simplify the Economic Model

For a demo/learning tool, we should use a **feasible solver** that always produces valid results:

#### Revised Model

Instead of optimizing over all variables (c, T, S) simultaneously, we structure the problem hierarchically:

1. **Transfers T** are the primary decision variables
2. **Consumption c** determined by flow balance: c = production + net transfers - ΔS
3. **Stocks S** follow a simple rule: save excess, draw down deficits

This transforms the problem from constrained optimization to **unconstrained optimization over transfers only**, which is much easier to solve.

#### Algorithm: Projected Gradient Descent on Transfers

```
For each iteration:
  1. Given current transfers T, compute implied consumption c
  2. Compute welfare W(T) = Σ β^t Σ ω u(c)
  3. Compute gradient ∂W/∂T numerically or analytically
  4. Update T ← T + lr * gradient
  5. Project T ≥ 0 (no negative transfers)
  6. Check convergence
```

#### Why This Works

- Only one set of decision variables (transfers)
- Natural constraint (T ≥ 0) is easy to project
- Consumption derived from flow balance → always feasible
- No dual variables needed

### Implementation

Replace the full `Simulator.solve()` with:

```javascript
solve() {
  this.initialize();
  
  for (let iter = 0; iter < maxIter; iter++) {
    // 1. Compute consumption from transfers + production
    this.updateConsumptionFromTransfers();
    
    // 2. Compute welfare
    const welfare = this.computeWelfare();
    
    // 3. Numerical gradient of welfare w.r.t. each transfer
    const grad = this.computeTransferGradient();
    
    // 4. Update transfers with projection
    for (const [key, arr] of this.transfers) {
      for (let t = 0; t < this.T; t++) {
        arr[t] = Math.max(0, arr[t] + lr * grad.get(key)[t]);
      }
    }
    
    // 5. Check convergence
    if (Math.abs(welfare - prevWelfare) < tol) {
      this.converged = true;
      break;
    }
  }
}
```

#### Shadow Prices

Shadow prices (Lagrange multipliers) are computed **after** convergence as:

```javascript
// λ_t^i = ∂W/∂production_t^i
// For household nodes: λ = β^t * ω * u'(c)
```

This gives economically meaningful shadow prices without the dual update instability.

---

## Spectral Radius Fix (T8)

### Problem

`getAdjacencyMatrix()` uses raw node IDs as array indices. After node removal, IDs are non-contiguous.

### Solution

Map IDs to contiguous indices before building matrix:

```javascript
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
      A[j][i] = 1;  // undirected
    }
  }
  
  return { matrix: A, labels: nodes.map(n => n.label) };
}
```

### Economic Interpretation of ρ(A)

For an undirected graph, ρ(A) is the largest eigenvalue. The "stability" condition ρ(A) < 1 is actually a **network effect threshold**, not a graph property:

- In standard graph theory, ρ(A) for connected graph ≥ 1 (Perron-Frobenius)
- The economic "stability" refers to a **weighted** adjacency matrix where edge weights are transfer coefficients
- We should rename "Stability" to "Network Condition" and show the actual value without the ✓/✗

### Revised Display

```
ρ(A) = 2.343  [? tooltip: "Spectral radius of unweighted adjacency"]
Network: Connected
```

Remove the "Stable/Unstable" indicator since it's economically misleading for unweighted graphs.

---

## D3 Update Pattern Fix (T9)

### Current Broken Pattern

```javascript
const node = this.nodeGroup.selectAll("g").data(nodes, d => d.id);
const nodeEnter = node.enter().append("g");
nodeEnter.append("circle");
nodeEnter.append("text");
// Missing: node.merge(nodeEnter)!
```

### Correct Pattern

```javascript
const node = this.nodeGroup.selectAll("g").data(nodes, d => d.id);

// EXIT
node.exit().remove();

// ENTER
const nodeEnter = node.enter().append("g")
  .attr("class", "node")
  .call(d3.drag()...);

nodeEnter.append("circle").attr("r", 20);
nodeEnter.append("text").attr("class", "label");
nodeEnter.append("text").attr("class", "stock-label");

// MERGE + UPDATE
const nodeUpdate = node.merge(nodeEnter);
nodeUpdate.select("circle")
  .attr("fill", d => d.type === 'producer' ? prodColor : hhColor)
  .attr("stroke", d => d === this.selectedNode ? highlightColor : strokeColor);
nodeUpdate.select("text.label")
  .attr("fill", "#eee")  // Fix: visible on dark bg
  .text(d => d.label);
```

### Force Simulation Management

Don't restart the force simulation on every update. Instead:

1. On initial load: start force simulation
2. On node add/remove: update simulation nodes/links, re-heat
3. On node selection: just update styles, don't re-heat

```javascript
update(graph) {
  this.graph = graph;
  const nodes = Array.from(graph.nodes.values());
  const links = Array.from(graph.edges.values());
  
  // Update simulation data
  this.simulation.nodes(nodes);
  this.simulation.force("link").links(links);
  
  // Only re-heat if structure changed
  this.simulation.alpha(0.3).restart();
}
```

---

## Color Scheme Implementation (T10)

### CSS Custom Properties Approach

Define all colors as CSS variables for easy theming:

```css
:root {
  /* Backgrounds */
  --bg-page: #0f172a;
  --bg-panel: #1e293b;
  --bg-canvas: #020617;
  
  /* Text */
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  
  /* Accents */
  --accent-primary: #2dd4bf;    /* teal */
  --accent-secondary: #60a5fa;  /* blue */
  --accent-warm: #f472b6;       /* pink */
  
  /* Node colors */
  --producer-color: #f87171;    /* soft red */
  --household-color: #2dd4bf;   /* teal */
  --highlight-color: #fbbf24;   /* amber */
  
  /* Status */
  --success: #34d399;
  --warning: #fbbf24;
  --error: #f87171;
}
```

### D3 Color Access

Since D3 doesn't read CSS variables directly, pass colors during init:

```javascript
const colors = {
  producer: getComputedStyle(document.documentElement).getPropertyValue('--producer-color').trim(),
  household: getComputedStyle(document.documentElement).getPropertyValue('--household-color').trim(),
};
this.visualization = new NetworkVisualization('#network-viz', colors);
```

---

## Plot Fixes (T11)

### Welfare Display

Instead of cumulative CRRA (negative), show **per-period utility**:

```javascript
getWelfareTrajectory() {
  const traj = Array(this.T).fill(0);
  const households = this.graph.getHouseholds();
  
  for (let t = 0; t < this.T; t++) {
    let periodWelfare = 0;
    for (const h of households) {
      const c = this.consumption.get(h.id)[t];
      periodWelfare += h.welfareWeight * utility(Math.max(c, 0.001), h.riskAversion);
    }
    // Shift to positive for display: add offset based on gamma
    // For CRRA: u(c) = c^(1-γ)/(1-γ), most negative at c→0
    // Offset = |u(0.01)| for the most risk-averse household
    traj[t] = periodWelfare + this.welfareOffset;
  }
  return traj;
}
```

### Adjacency Matrix Heatmap

Replace Chart.js scatter with HTML canvas:

```javascript
createAdjacencyHeatmap(canvasId, matrix, labels) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  const n = matrix.length;
  
  // Set canvas size
  const cellSize = Math.min(canvas.width / n, canvas.height / n);
  canvas.width = cellSize * n;
  canvas.height = cellSize * n;
  
  // Draw cells
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const val = matrix[i][j];
      ctx.fillStyle = val > 0 ? 'rgba(45, 212, 191, 0.8)' : 'rgba(30, 41, 59, 0.5)';
      ctx.fillRect(j * cellSize, i * cellSize, cellSize - 1, cellSize - 1);
    }
  }
  
  // Draw labels
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px sans-serif';
  for (let i = 0; i < n; i++) {
    ctx.fillText(labels[i], 0, (i + 0.7) * cellSize);
    ctx.fillText(labels[i], (i + 0.3) * cellSize, 10);
  }
}
```

---

## UX Improvements (T12)

### Inline Quick Results

Add a collapsible panel below the network:

```html
<div id="quick-results" class="quick-results">
  <h4>Quick Results</h4>
  <div class="mini-plots">
    <canvas id="mini-consumption" width="300" height="150"></canvas>
    <canvas id="mini-welfare" width="300" height="150"></canvas>
  </div>
</div>
```

Show these on every Run, no tab switch needed.

### Loading State

```javascript
runSimulation() {
  const btn = document.getElementById('run-sim');
  const originalText = btn.textContent;
  btn.textContent = '⏳ Solving...';
  btn.disabled = true;
  
  // Run solver (may take ~500ms)
  const result = this.simulator.solve();
  
  // Update UI
  btn.textContent = originalText;
  btn.disabled = false;
  
  // Flash success
  document.getElementById('convergence-status').classList.add('flash-success');
  setTimeout(() => status.classList.remove('flash-success'), 1000);
}
```

### Auto-switch to Plots

```javascript
// After first run, offer to switch
if (!this.hasShownPlots) {
  this.hasShownPlots = true;
  document.querySelector('[data-tab="plots-tab"]').click();
}
```

---

## Testing Checklist

Before deploying fixes:

- [ ] Solver converges in < 200 iterations for all scenarios
- [ ] Shadow prices in [0, 100] range
- [ ] Spectral radius correct for star: ρ = √(n-1)
- [ ] Node labels visible (light color on dark bg)
- [ ] Clicking node doesn't restart force layout
- [ ] Quick results show after Run without tab switch
- [ ] All plots render without console errors
- [ ] Colorblind-friendly: producer/household distinguishable
- [ ] Mobile: layout stacks vertically, readable
