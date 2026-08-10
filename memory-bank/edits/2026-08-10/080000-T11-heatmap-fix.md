---
kind: edit_chunk
id: 2026-08-10-080000-t11-heatmap-fix
created_at: 2026-08-10 08:00:00 UTC
task_ids: [T11]
source_branch: main
source_commit: fb4adfb
---

#### 08:00:00 UTC - T11: Fix Adjacency Matrix Heatmap
- Modified `src/plots.js` — Added fallback dimensions when canvas parent is hidden (display:none)
- Modified `src/plots.js` — Fixed createAdjacencyHeatmap() to handle 0x0 getBoundingClientRect()
- Modified `src/ui.js` — Re-render adjacency heatmap when switching to Plots tab
- Result: Heatmap now renders correctly instead of being blank
