# Active Context

*Last Updated: 2026-08-10 11:33:00 IST*

## Current Focus

**Bug-Fix Sprint: T7-T12**

Post-deployment QA (2026-08-10 morning) revealed that while T1-T6 are functionally "complete," the deployed page has critical numerical, visual, and UX issues that make it unsuitable for public use.

## Critical Issues Found

### 1. Solver Numerical Instability (T7)
- Shadow prices explode to ~1e16
- Dual update has no normalization/constraint
- Solver hits 1999-iteration limit every time ("Not converged")
- Gradient descent lacks proper constraint projection
- Consumption/transfers wander outside feasible region

### 2. Spectral Radius Bug (T8)
- `getAdjacencyMatrix()` indexes by raw node IDs
- After add/remove, matrix has empty rows → wrong eigenvalue
- Star network (should have ρ<1) shows ρ=2.343 "Unstable"

### 3. D3 Visualization Broken (T9)
- Missing `.merge()` in D3 update pattern
- Labels use #2c3e50 (invisible on dark bg)
- Force simulation restarts from scratch on every click
- Nodes cluster in corner, don't use available space
- Stock labels never update from initial 0.0

### 4. Color Scheme (T10)
- Primary #e74c3c (orange-red) on #1a1a2e (dark blue-black) looks harsh
- Needs cohesive, professional palette
- User feedback: "Orange over dark looks very weird"

### 5. Plots & Data Display (T11)
- Shadow price plot shows 3e16 (nonsense)
- Welfare negative (CRRA γ>1) — looks like crash
- Adjacency "heatmap" is scatter plot with dots
- `visualization.getColor()` doesn't exist → fallback colors

### 6. UX: Tab Separation (T12)
- User must switch tabs to see results after changing parameters
- Clicking "Run Simulation" flashes canvas but no feedback
- No loading state during solver execution

## Next Steps

1. **T7**: Rewrite solver with proper constraint projection and dual normalization
2. **T8**: Fix adjacency matrix to use contiguous indices
3. **T9**: Fix D3 update pattern, label colors, force layout
4. **T10**: Design new color scheme (cool blues/teals or sophisticated neutrals)
5. **T11**: Fix plot data (shift welfare for display, replace scatter heatmap)
6. **T12**: Move key plots inline with simulation OR add auto-tab-switch

## System Status

- Project: econ-sim at `code/econ-sim/`
- Deployed: `quantumofgravity.com/projects/econ-sim/`
- Status: LIVE but with critical bugs
