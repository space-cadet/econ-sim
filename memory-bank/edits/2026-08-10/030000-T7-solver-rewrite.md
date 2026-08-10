---
kind: edit_chunk
id: 2026-08-10-030000-t7-solver-rewrite
created_at: 2026-08-10 03:00:00 UTC
task_ids: [T7]
source_branch: main
source_commit: fb4adfb
---

#### 03:00:00 UTC - T7: Solver Rewrite — Transfer-Only Optimization
- Modified `src/simulation.js` — Complete rewrite of solve() with feasible transfer-only optimization
- Modified `src/simulation.js` — Added projectOntoSimplex() for producer outflow constraints
- Modified `src/simulation.js` — Added gradientTransfers() for gradient computation
- Modified `src/simulation.js` — Added solveFeasibleTransfers() main loop with adaptive step size
- Modified `src/simulation.js` — Added computeFlowsAndStocks() to derive quantities from transfers
- Modified `src/simulation.js` — Eliminated dual variables from optimization loop
- Result: Converges in ~70 iterations (was "not converged after 1999")
