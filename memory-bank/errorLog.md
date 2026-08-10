# Error Log

*Last Updated: 2026-08-10 11:33:00 IST*

## Issue #1: Shadow Prices Explode (CRITICAL)

**File**: `src/simulation.js`
**Function**: `updateShadowPrices()`

```javascript
updateShadowPrices() {
  const alpha = 0.1;
  for (let t = 0; t < this.T; t++) {
    for (const node of nodes) {
      const violation = this.checkFlowBalance(node.id, t);
      const current = this.shadowPrices.get(node.id)[t];
      this.shadowPrices.get(node.id)[t] = Math.max(0.01, current + alpha * violation);
      // BUG: violation can be large positive → prices grow without bound
      // No normalization, no clipping, no damping
    }
  }
}
```

**Symptom**: Shadow prices reach 3×10¹⁶ in ~50 iterations.
**Impact**: Shadow price plot is useless. Solver never converges.
**Fix**: Add normalization step, clip to reasonable range, or use proper augmented Lagrangian.

---

## Issue #2: Solver Never Converges (CRITICAL)

**File**: `src/simulation.js`
**Function**: `solve()`

**Symptom**: Status always shows "Not converged (1999 iter)"
**Root Cause**: 
1. Dual variables explode (Issue #1)
2. Primal gradient descent has no constraint projection
3. Consumption can go negative (clamped at 0.01 but still infeasible)
4. Flow balance never satisfied → violation always non-zero

**Fix**: Implement proper constraint projection or use a feasible-direction method.

---

## Issue #3: Spectral Radius Computed on Wrong Matrix (CRITICAL)

**File**: `src/graph.js`
**Function**: `getAdjacencyMatrix()`, `spectralRadius()`

```javascript
getAdjacencyMatrix() {
  const n = this.nodes.size;
  const A = Array(n).fill(null).map(() => Array(n).fill(0));
  for (const edge of this.edges.values()) {
    A[edge.source][edge.target] = 1;  // BUG: indexes by node ID, not contiguous index
    // If node IDs are [0,2,5], matrix is 6×6 with holes
  }
}
```

**Symptom**: 5-node star shows ρ=2.343 "Unstable" when it should be <1.
**Fix**: Map node IDs to contiguous indices `[0, n-1]` before building matrix.

---

## Issue #4: D3 Update Pattern Missing Merge (HIGH)

**File**: `src/visualization.js`
**Function**: `update()`

**Symptom**: Clicking a node restarts force sim, jumps around. Selection highlight doesn't persist.
**Root Cause**: Missing `.merge(nodeEnter)` and `.merge(linkEnter)` after `.enter().append()`.

```javascript
// Current (broken):
const nodeEnter = node.enter().append("g")...;
// Missing: node.merge(nodeEnter) to update existing nodes
```

**Fix**: Add proper D3 join pattern with merge + update selection.

---

## Issue #5: Node Labels Invisible (HIGH)

**File**: `src/visualization.js`

**Symptom**: Node labels (P0, H1, etc.) barely visible.
**Root Cause**: `fill: #2c3e50` on dark background.
**Fix**: Change to `#eee` or `#fff`.

---

## Issue #6: Adjacency "Heatmap" is Scatter Plot (HIGH)

**File**: `src/plots.js`
**Function**: `createAdjacencyHeatmap()`

**Symptom**: Matrix shows as scattered dots instead of a grid.
**Root Cause**: Uses Chart.js `type: 'scatter'` instead of a proper heatmap.
**Fix**: Use HTML canvas with manual pixel drawing, or Chart.js matrix plugin.

---

## Issue #7: Negative Welfare Display (MEDIUM)

**File**: `src/plots.js`
**Function**: `createWelfarePlot()`

**Symptom**: Welfare shows -21.66, trajectory slopes down.
**Root Cause**: CRRA utility with γ>1 gives negative values. Mathematically correct but visually confusing.
**Fix**: Shift for display (add constant) or show per-period utility instead.

---

## Issue #8: `getColor()` Doesn't Exist (MEDIUM)

**File**: `src/ui.js` line ~210
**Code**: `this.visualization?.getColor?.(i) || null`
**Symptom**: Chart.js uses default colors instead of matching node colors.
**Fix**: Add `getColor()` to `NetworkVisualization` or use shared palette.

---

## Issue #9: Color Scheme Jarring (MEDIUM)

**File**: `index.html` (CSS)

**Current**: Primary `#e74c3c` (orange-red) on `#1a1a2e` (dark blue-black)
**Feedback**: "Orange over dark looks very weird"
**Fix**: Try cooler palette — teal/cyan primary, or sophisticated navy/gold.

---

## Issue #10: Plots on Separate Tab (UX)

**File**: `index.html`

**Symptom**: User changes parameters, clicks Run, sees nothing (must switch to Plots tab).
**Feedback**: "The plots are on a different tab so one has to switch tabs to see what happens"
**Fix**: Either (a) auto-switch to Plots tab after Run, or (b) show mini-plots inline.

---

## Issue #11: Simulation Button Flash (UX)

**File**: `src/ui.js`

**Symptom**: Clicking "Run Simulation" causes canvas to flash.
**Root Cause**: `runSimulation()` creates new simulator, which may trigger re-render.
**Feedback**: "Is the network supposed to evolve in some way that can be visualised?"
**Fix**: Add visual feedback (loading spinner), and animate flow on network during solve.
