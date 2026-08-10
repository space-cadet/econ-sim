---
kind: edit_chunk
id: 2026-08-10-040000-t8-spectral-radius
created_at: 2026-08-10 04:00:00 UTC
task_ids: [T8]
source_branch: main
source_commit: fb4adfb
---

#### 04:00:00 UTC - T8: Fix Spectral Radius Calculation
- Modified `src/graph.js` — Rewrote getAdjacencyMatrix() with contiguous index mapping via idToIndex Map
- Modified `src/graph.js` — Fixed spectralRadius() with proper power iteration on correctly-indexed matrix
- Modified `src/graph.js` — Added nodeCount getter
- Modified `src/ui.js` — Removed misleading "Stable/Unstable" indicator
- Result: ρ(A) now displays correctly (e.g., 1.414 for 5-node star)
