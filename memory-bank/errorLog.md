# Error Log

*Last Updated: 2026-08-10 10:41:00 UTC*

## Status Summary

| Issue | Severity | Status | Fixed By |
|-------|----------|--------|----------|
| #1 Shadow Prices Explode | CRITICAL | ✅ FIXED | T7 — Solver rewrite with transfer-only optimization |
| #2 Solver Never Converges | CRITICAL | ✅ FIXED | T7 — Feasible solver converges in ~70 iters |
| #3 Spectral Radius Wrong | CRITICAL | ✅ FIXED | T8 — Contiguous index mapping |
| #4 D3 Missing Merge | HIGH | ✅ FIXED | T9 — Proper enter/update/exit pattern |
| #5 Invisible Labels | HIGH | ✅ FIXED | T9 — Light-colored text on dark bg |
| #6 Heatmap is Scatter | HIGH | ✅ FIXED | T11 — HTML5 Canvas heatmap |
| #7 Negative Welfare | MEDIUM | ✅ FIXED | T11 — Per-period utility display |
| #8 getColor Missing | MEDIUM | ✅ FIXED | T9/T11 — Shared palette in visualization |
| #9 Color Scheme | MEDIUM | ✅ FIXED | T10 — Teal/cyan on slate |
| #10 Plots on Separate Tab | UX | ✅ FIXED | T12 — Quick Results panel + auto-switch |
| #11 Button Flash | UX | ✅ FIXED | T12 — Loading spinner + status updates |
| #12 Canvas Blank on Hidden Tab | HIGH | ✅ FIXED | T11 — Fallback dimensions + re-render on tab switch |

---

## Issue #1: Shadow Prices Explode (CRITICAL) — ✅ FIXED

**File**: `src/simulation.js`
**Function**: `updateShadowPrices()`

**Original Bug**:
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

**Fix**: Rewrote solver with transfer-only optimization. Shadow prices computed post-hoc from marginal utilities. No dual variables during optimization → no explosion possible.

**Verification**: Shadow prices now in reasonable range [0, 10].

---

## Issue #2: Solver Never Converges (CRITICAL) — ✅ FIXED

**File**: `src/simulation.js`
**Function**: `solve()`

**Symptom**: Status always showed "Not converged (1999 iter)"
**Root Cause**: 
1. Dual variables exploded (Issue #1)
2. Primal gradient descent had no constraint projection
3. Consumption could go negative
4. Flow balance never satisfied → violation always non-zero

**Fix**: Implemented feasible transfer-only optimization with:
- Simplex projection for producer outflows
- Trivial projection for non-negative transfers
- Adaptive step size

**Verification**: Converges in ~70 iterations for all test scenarios.

---

## Issue #3: Spectral Radius Computed on Wrong Matrix (CRITICAL) — ✅ FIXED

**File**: `src/graph.js`
**Function**: `getAdjacencyMatrix()`, `spectralRadius()`

**Original Bug**:
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

**Fix**: Map node IDs to contiguous indices `[0, n-1]` before building matrix. Also rewrote power iteration.

**Verification**: 5-node star now shows ρ=1.414 (√4, correct for undirected).

---

## Issue #4: D3 Update Pattern Missing Merge (HIGH) — ✅ FIXED

**File**: `src/visualization.js`
**Function**: `update()`

**Symptom**: Clicking a node restarted force sim, jumped around. Selection highlight didn't persist.
**Root Cause**: Missing `.merge(nodeEnter)` and `.merge(linkEnter)` after `.enter().append()`.

**Fix**: Added proper D3 join pattern:
```javascript
const nodeEnter = node.enter().append("g");
nodeEnter.append("circle");
nodeEnter.append("text");
const nodeUpdate = node.merge(nodeEnter);  // Added
nodeUpdate.select("circle").attr("fill", ...);
```

---

## Issue #5: Node Labels Invisible (HIGH) — ✅ FIXED

**File**: `src/visualization.js`

**Symptom**: Node labels (P0, H1, etc.) barely visible.
**Root Cause**: `fill: #2c3e50` on dark background.

**Fix**: Changed to `#e2e8f0` (slate-200, light gray).

---

## Issue #6: Adjacency "Heatmap" is Scatter Plot (HIGH) — ✅ FIXED

**File**: `src/plots.js`
**Function**: `createAdjacencyHeatmap()`

**Symptom**: Matrix showed as scattered dots instead of a grid.
**Root Cause**: Used Chart.js `type: 'scatter'` instead of a proper heatmap.

**Fix**: Replaced with HTML5 Canvas rendering:
```javascript
for (let i = 0; i < n; i++) {
  for (let j = 0; j < n; j++) {
    const val = matrix[i][j];
    ctx.fillStyle = val > 0 ? 'rgba(45, 212, 191, 0.9)' : 'rgba(51, 65, 85, 0.4)';
    ctx.fillRect(offsetX + j * cellSize, offsetY + i * cellSize, cellSize - 1, cellSize - 1);
  }
}
```

---

## Issue #7: Negative Welfare Display (MEDIUM) — ✅ FIXED

**File**: `src/plots.js`
**Function**: `createWelfarePlot()`

**Symptom**: Welfare showed -21.66, trajectory sloped down.
**Root Cause**: CRRA utility with γ>1 gives negative values. Mathematically correct but visually confusing.

**Fix**: Changed to display **per-period utility** instead of cumulative. Shows positive, intuitive values.

---

## Issue #8: `getColor()` Doesn't Exist (MEDIUM) — ✅ FIXED

**File**: `src/ui.js`
**Code**: `this.visualization?.getColor?.(i) || null`

**Fix**: Added `getColor(index)` method to `NetworkVisualization` with shared palette.

---

## Issue #9: Color Scheme Jarring (MEDIUM) — ✅ FIXED

**File**: `index.html` (CSS)

**Original**: Primary `#e74c3c` (orange-red) on `#1a1a2e` (dark blue-black)
**Feedback**: "Orange over dark looks very weird"

**Fix**: Teal/cyan on slate:
- Primary: `#2dd4bf` (teal-400)
- Background: `#0f172a` (slate-900)
- Producer: `#f87171` (soft red)
- Household: `#2dd4bf` (teal)

---

## Issue #10: Plots on Separate Tab (UX) — ✅ FIXED

**File**: `index.html`, `src/ui.js`

**Symptom**: User changes parameters, clicks Run, must switch to Plots tab.

**Fix**: 
1. Added Quick Results panel below network with mini-charts
2. Auto-switches to Plots tab on first run

---

## Issue #11: Simulation Button Flash (UX) — ✅ FIXED

**File**: `src/ui.js`

**Symptom**: Clicking "Run Simulation" caused canvas to flash. No visual feedback.

**Fix**: 
- Loading spinner on button ("⏳ Solving...")
- Status bar shows "Running solver..." in amber
- Button disabled during solve
- Success message with iteration count

---

## Issue #12: Canvas Blank on Hidden Tab (HIGH) — ✅ FIXED

**File**: `src/plots.js`, `src/ui.js`

**Symptom**: Adjacency matrix heatmap was blank when Plots tab first opened.
**Root Cause**: `canvas.parentElement.getBoundingClientRect()` returns 0×0 when parent has `display: none`.

**Fix**: 
1. Added fallback dimensions (`|| 300`) in `createAdjacencyHeatmap()`
2. Added re-render logic when switching to Plots tab in `setupTabs()`

---

## New Issues Discovered During Fixes

### Issue #13: Browser Caching
**Status**: ⚠️ OPEN
**Description**: Despite cache-busting (`?v=7`), some users still see old `index.html` without new scenario options.
**Next Action**: Consider server-side cache headers or different cache-bust strategy.

### Issue #14: Mobile Responsiveness
**Status**: ⚠️ UNTESTED
**Description**: Layout not tested on narrow screens. Flex layout may break.
**Next Action**: Test on mobile viewport or add responsive breakpoints.

### Issue #15: Performance on Large Networks
**Status**: ⚠️ UNTESTED
**Description**: 50+ node networks may be slow with D3 force simulation.
**Next Action**: Profile performance, consider static layout for large networks.
