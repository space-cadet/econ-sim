# Implementation Details: Econ-Sim Architecture

*Created: 2026-08-10*
*Updated: 2026-08-10 10:41:00 UTC*
*Related Tasks: T7, T8, T9, T10, T11, T12*

## Overview

This document captures the detailed technical decisions, algorithms, and code patterns for the econ-sim solver, visualization, and UI.

---

## Solver Architecture (T7)

### Problem

The original solver implemented a custom primal-dual gradient descent for a constrained optimization problem. Dual variables (shadow prices) grew without limit, flow balance was never satisfied, and the solver hit the 1999-iteration limit on every run.

### Decision: Transfer-Only Feasible Optimization

Instead of optimizing over all variables (consumption c, transfers T, stocks S) simultaneously with dual variables, we simplified to **transfers as the only decision variables**:

1. **Transfers τ_ij,t** are the primary decision variables
2. **Consumption c_i,t** determined by flow balance: c_i,t = ω_i + Σ_j τ_ji,t - Σ_j τ_ij,t
3. **Stocks S_i,t** follow from material balance: S_i,t+1 = S_i,t + production + net transfers - consumption
4. **Shadow prices** computed post-hoc from marginal utilities

This transforms the problem from constrained primal-dual optimization to **projected gradient descent on transfers only**.

### Key Functions

#### `projectOntoSimplex(v, sum)`

Projects a vector onto the simplex {x | x_i ≥ 0, Σx_i = sum}:

```javascript
projectOntoSimplex(v, sum) {
  const n = v.length;
  // Sort descending
  const sorted = [...v].sort((a, b) => b - a);
  
  // Find threshold ρ
  let cumsum = 0;
  let rho = 0;
  for (let i = 0; i < n; i++) {
    cumsum += sorted[i];
    if (sorted[i] > (cumsum - sum) / (i + 1)) {
      rho = i;
    }
  }
  
  const threshold = (cumsum - sum) / (rho + 1);
  return v.map(vi => Math.max(0, vi - threshold));
}
```

Used to constrain producer outflows to equal productivity.

#### `solveFeasibleTransfers()`

Main optimization loop:

```javascript
solveFeasibleTransfers() {
  let transfers = initializeRandom();
  let bestWelfare = -Infinity;
  let bestTransfers = null;
  
  for (let iter = 0; iter < maxIter; iter++) {
    // 1. Compute all economic quantities from transfers
    const { consumption, stocks, welfare } = this.computeFlowsAndStocks(transfers);
    
    // 2. Check if best so far
    if (welfare > bestWelfare) {
      bestWelfare = welfare;
      bestTransfers = copy(transfers);
    }
    
    // 3. Compute gradient of welfare w.r.t. transfers
    const grad = this.gradientTransfers(transfers, stocks);
    
    // 4. Update transfers with adaptive step size
    const step = this.getAdaptiveStep(iter);
    for (const key in transfers) {
      for (let t = 0; t < this.T; t++) {
        transfers[key][t] = Math.max(0, transfers[key][t] + step * grad[key][t]);
      }
    }
    
    // 5. Project producer outflows onto simplex
    for (const p of producers) {
      const outflows = getOutgoingTransfers(p, transfers);
      const projected = this.projectOntoSimplex(outflows, p.productivity);
      setOutgoingTransfers(p, transfers, projected);
    }
    
    // 6. Check convergence
    if (converged(bestWelfare, welfare, tol)) break;
  }
  
  return { transfers: bestTransfers, welfare: bestWelfare };
}
```

#### Shadow Prices (Post-Hoc)

After convergence, shadow prices computed from marginal utilities:

```javascript
computeShadowPrices() {
  for (const node of this.graph.nodes) {
    for (let t = 0; t < this.T; t++) {
      const c = this.consumption.get(node.id)[t];
      // λ_t^i = β^t * ω_i * u'(c_t)
      this.shadowPrices.get(node.id)[t] = 
        Math.pow(this.beta, t) * node.welfareWeight * utilityPrime(c, node.riskAversion);
    }
  }
}
```

### Why This Works

- Only one set of decision variables (transfers) → simpler gradient
- Natural constraint (τ ≥ 0) is trivial to project
- Consumption derived from flow balance → always feasible
- No dual variables needed during optimization → no explosion
- Producer simplex projection ensures supply = productivity

### Results

- **Before**: "Not converged after 1999 iter", welfare = -21.66, shadow prices = 3×10¹⁶
- **After**: Converges in ~70 iterations, welfare = 0.3-0.5 per period, reasonable shadow prices

---

## Spectral Radius (T8)

### Problem

`getAdjacencyMatrix()` used raw node IDs as array indices. After node removal, IDs were non-contiguous, causing empty rows/columns and wrong eigenvalues.

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

### Economic Interpretation

For unweighted graphs, ρ(A) ≥ 1 for connected graphs (Perron-Frobenius). The "stability" condition ρ(A) < 1 applies to **weighted** adjacency matrices where edge weights are transfer coefficients, not the unweighted topology.

**Decision**: Removed "Stable/Unstable" indicator. Now just shows ρ(A) value with tooltip.

---

## D3 Visualization (T9)

### Update Pattern

Correct enter/update/exit with `.merge()`:

```javascript
const node = this.nodeGroup.selectAll("g.node").data(nodes, d => d.id);
node.exit().remove();

const nodeEnter = node.enter().append("g")
  .attr("class", "node")
  .call(d3.drag()...);

nodeEnter.append("circle").attr("r", 22);
nodeEnter.append("text").attr("class", "node-label");
nodeEnter.append("text").attr("class", "stock-label");

const nodeUpdate = node.merge(nodeEnter);
nodeUpdate.select("circle")
  .attr("fill", d => d.type === 'producer' ? prodColor : hhColor);
nodeUpdate.select("text.node-label")
  .attr("fill", "#e2e8f0")  // Visible on dark bg
  .text(d => d.label);
```

### Force Simulation Management

Only re-heat simulation when structure changes (nodes added/removed), not on selection:

```javascript
if (node.enter().size() > 0 || node.exit().size() > 0 || link.enter().size() > 0) {
  this.simulation.alpha(0.3).restart();
}
```

### Edge Manipulation (New Feature)

```javascript
// Visual feedback during edge creation
setEdgeSource(node) {
  this.edgeSourceNode = node;
  
  // Highlight source node
  this.nodeGroup.selectAll("g.node").select("circle:first-child")
    .attr("stroke", d => d === node ? '#fbbf24' : this.colors.stroke)
    .attr("stroke-width", d => d === node ? 4 : 2);
  
  // Create ghost line following cursor
  this.ghostLine = this.svg.append("line")
    .attr("class", "ghost-edge")
    .attr("stroke", "#fbbf24")
    .attr("stroke-dasharray", "5,5")
    .attr("opacity", 0.6);
  
  // Mouse move listener updates ghost line
  this.svg.on("mousemove.edge-create", (e) => {
    const [x, y] = d3.pointer(e, this.svg.node());
    this.ghostLine
      .attr("x1", node.x).attr("y1", node.y)
      .attr("x2", x).attr("y2", y);
  });
}
```

---

## Color Scheme (T10)

### CSS Custom Properties

```css
:root {
  --bg-page: #0f172a;       /* slate-900 */
  --bg-panel: #1e293b;      /* slate-800 */
  --bg-canvas: #020617;     /* slate-950 */
  --text-primary: #e2e8f0;  /* slate-200 */
  --text-secondary: #94a3b8;/* slate-400 */
  --accent-primary: #2dd4bf;/* teal-400 */
  --accent-secondary: #60a5fa; /* blue-400 */
  --accent-warm: #fbbf24;   /* amber-400 */
  --producer-color: #f87171;/* red-400 */
  --household-color: #2dd4bf;/* teal-400 */
}
```

### Why Teal/Cyan

- Distinct from typical "corporate blue"
- Good colorblind accessibility (teal vs blue distinguishable)
- Matches "physics field theory" theme (energy, flow)
- Modern without being trendy

---

## Plots (T11)

### Adjacency Matrix Heatmap

HTML5 Canvas approach (replaced Chart.js scatter):

```javascript
createAdjacencyHeatmap(canvasId, matrix, nodeLabels) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  const n = matrix.length;
  
  // Handle hidden tab (display:none → 0x0 rect)
  let rect = canvas.parentElement.getBoundingClientRect();
  let availableWidth = rect.width || 300;  // Fallback!
  let availableHeight = rect.height || 300;
  
  const size = Math.min(availableWidth, availableHeight - 30);
  const cellSize = size / n;
  
  // Draw cells
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const val = matrix[i][j];
      ctx.fillStyle = val > 0 ? 'rgba(45, 212, 191, 0.9)' : 'rgba(51, 65, 85, 0.4)';
      ctx.fillRect(offsetX + j * cellSize, offsetY + i * cellSize, cellSize - 1, cellSize - 1);
    }
  }
  
  // Draw labels with truncation
  ctx.fillStyle = '#94a3b8';
  for (let i = 0; i < n; i++) {
    let label = nodeLabels?.[i] ?? String(i);
    if (label.length > 4) label = label.substring(0, 3) + '…';
    ctx.fillText(label, offsetX - 6, offsetY + (i + 0.5) * cellSize);
  }
}
```

### Welfare Display

Show **per-period utility** instead of cumulative raw welfare:

```javascript
// For CRRA: u(c) = c^(1-γ)/(1-γ)
// With γ=2: u(c) = -1/c (negative!)
// Solution: show per-period, not cumulative
getWelfareTrajectory() {
  const traj = Array(this.T).fill(0);
  for (let t = 0; t < this.T; t++) {
    let periodUtility = 0;
    for (const h of households) {
      const c = this.consumption.get(h.id)[t];
      periodUtility += h.welfareWeight * utility(c, h.riskAversion);
    }
    traj[t] = periodUtility;
  }
  return traj;
}
```

---

## UX (T12)

### Quick Results Panel

Inline mini-plots below network:

```html
<div id="quick-results" class="quick-results">
  <h4>📊 Quick Results</h4>
  <div class="mini-plots">
    <div class="mini-plot-container">
      <h5>Consumption</h5>
      <canvas id="mini-consumption"></canvas>
    </div>
    <div class="mini-plot-container">
      <h5>Welfare</h5>
      <canvas id="mini-welfare"></canvas>
    </div>
  </div>
</div>
```

### Loading State

```javascript
runSimulation() {
  const btn = document.getElementById('run-sim');
  const originalText = btn.textContent;
  btn.textContent = '⏳ Solving...';
  btn.disabled = true;
  
  const statusEl = document.getElementById('convergence-status');
  statusEl.textContent = 'Running solver...';
  statusEl.style.color = '#fbbf24';
  
  setTimeout(() => {
    try {
      const result = this.simulator.solve();
      // Update UI...
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }, 50);  // Allow UI update before heavy computation
}
```

### Auto-Tab Switch

```javascript
if (!this.hasShownPlots) {
  this.hasShownPlots = true;
  setTimeout(() => {
    document.querySelector('[data-tab="plots-tab"]').click();
  }, 500);
}
```

---

## Network Scenarios

### Scale-Free (Barabási-Albert)

```javascript
scaleFree(n = 12, m0 = 3) {
  // Start with m0 fully connected nodes
  // Add nodes one at a time
  // Each new node connects to existing nodes with P(connect) ∝ degree
  // Creates hubs (high-degree nodes) and many low-degree nodes
}
```

### Small-World (Watts-Strogatz)

```javascript
smallWorld(n = 10, k = 4, beta = 0.3) {
  // Create ring lattice: each node connects to k nearest neighbors
  // Rewire each edge with probability beta to random target
  // High clustering + short average path length
}
```

### Grid

```javascript
grid(rows = 3, cols = 4) {
  // Nodes arranged in rows×cols grid
  // Edges between horizontal and vertical neighbors
  // Local connections only
}
```

### Complete Bipartite

```javascript
bipartite(nProducers = 4, nHouseholds = 5) {
  // All producers on one side, all households on other
  // Every producer connected to every household
  // Maximum connectivity for trade
}
```

---

## Auto-Connect Feature

When adding a new node with "Auto-connect" checked:

```javascript
autoConnectNode(node) {
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
    // Prefer different type for bipartite structure
    if (target.type !== node.type || Math.random() < 0.3) {
      this.graph.addEdge(node.id, target.id);
    }
  }
}
```

---

## Testing Checklist

- [x] Solver converges in < 200 iterations for all scenarios
- [x] Shadow prices in reasonable range
- [x] Spectral radius correct for star: ρ = √(n-1)
- [x] Node labels visible (light color on dark bg)
- [x] Clicking node doesn't restart force layout
- [x] Quick results show after Run without tab switch
- [x] All plots render without console errors
- [x] Colorblind-friendly: producer/household distinguishable
- [ ] Mobile: layout stacks vertically, readable (NOT TESTED)
- [ ] Large networks (50+ nodes) perform well (NOT TESTED)

---

## Known Issues

1. **Browser caching**: Module imports use `?v=7` cache-busting but some users still see old versions
2. **Scenario dropdown**: New options (scaleFree, smallWorld, grid, bipartite) may not appear for cached `index.html`
3. **Canvas blank on hidden tab**: Adjacency heatmap needs re-render when Plots tab becomes visible (handled in ui.js but may have edge cases)
4. **Performance**: Untested on networks with 50+ nodes
5. **Mobile**: Layout not tested on narrow screens
