# Active Context

*Last Updated: 2026-08-10 23:12:00 UTC*

## Current Focus

**T13: Econ-sim refactor to use @space-cadet/graph-core — PAUSED/BROKEN**

The refactor is partially deployed but NOT FUNCTIONAL. After multiple attempts to load graph-core via CDN, the app fails to initialize.

### What Was Done This Session
- ✅ Switched `src/graph.js` from old `graph-legacy.js` to new adapter wrapping `@space-cadet/graph-core`
- ✅ Bumped cache-busting versions (`?v=7` → `?v=9` for graph.js, `?v=12` for ui.js)
- ❌ **esm.sh CDN import fails** — browser caches stale/incomplete build for `@space-cadet/graph-core@0.1.3`
- ❌ **jsdelivr CDN import fails** — bare specifier `import "mathjs"` in npm raw file, browser can't resolve
- ❌ **esm.sh direct path fails** — still serving incomplete build with missing `getOutgoingEdges`

### Current Error
`TypeError: this._graph.getOutgoingEdges is not a function` — the GraphologyAdapter from esm.sh is missing methods.

### Root Cause
esm.sh builds packages lazily on first request. `@space-cadet/graph-core@0.1.3` was published very recently, and esm.sh may not have completed building it. The `immutable` cache header means any incomplete response gets locked in the browser for a year.

### Files Changed (in workspace, deployed to server)
- `src/graph.js` — imports from esm.sh direct path
- `src/ui.js` — `?v=12`
- `src/simulation.js` — `?v=9`
- `src/scenarios.js` — `?v=9`
- `index.html` — `?v=12`

### Next Session Plan
1. **Option A**: Build a self-contained IIFE bundle of graph-core and vendor it into econ-sim (no CDN)
2. **Option B**: Republish `@space-cadet/graph-core` as v0.1.4 and wait for esm.sh cache to settle
3. **Option C**: Test with a different CDN or with ?no-cache query param
4. Verify full end-to-end functionality once graph loads
5. Remove dead code (`graph-legacy.js`, old `graph-adapter.js`)
6. Update this memory bank

---

## Previous Focus (Before This Session)

**Graph-tools published.** v0.1.0–0.1.3 released to npm with READMEs, CHANGELOG, and all missing methods.

## System Status

- **Project**: econ-sim at `code/econ-sim/`
- **Deployed**: `quantumofgravity.com/projects/econ-sim/`
- **Version**: v1.1 with graph-core adapter (partial refactor, NOT FUNCTIONAL)
- **Status**: Deployed but BROKEN — needs fix and completion

## Graph-Tools Integration Plan

### Current State
- ✅ Monorepo scaffolded at https://github.com/space-cadet/graph-tools
- ✅ graph-core migrated with cleaned deps
- ✅ graph-ui migrated with fixed imports
- ✅ Memory bank initialized for graph-tools repo

### Econ-Sim Refactor Plan (Future)
1. Publish `@space-cadet/graph-core` v0.1.0
2. Publish `@space-cadet/graph-ui` v0.1.0  
3. Refactor `EconomicGraph` to extend `GraphologyAdapter`
4. Refactor `NetworkVisualization` to use `@space-cadet/graph-ui` D3 renderer
5. Remove local graph/viz code, import from packages

## Completed Work Summary

### Solver (T7)
- Transfer-only feasible optimization
- Converges in ~70 iterations
- No more price explosions

### Spectral Radius (T8)
- Correct contiguous index mapping
- Accurate power iteration
- Misleading "Stable/Unstable" label removed

### Visualization (T9)
- Proper D3 update pattern with `.merge()`
- Visible node labels
- Flow animation particles
- Drag-and-drop

### Color Scheme (T10)
- Teal/cyan on slate backgrounds
- Professional, accessible

### Plots (T11)
- Canvas adjacency heatmap
- Per-period welfare display
- Inline mini-plots

### UX (T12)
- Quick Results panel
- Loading spinner
- Auto-tab-switch

### New Features
- Edge creation with ghost line
- Edge selection and deletion
- Auto-connect checkbox
- 9 total scenarios including Scale-Free, Small-World, Grid, Bipartite

### Deployment Fix (2026-08-10 Session)
- **Root cause**: Edited wrong file path — Apache DocumentRoot is `/home/quantumofgravity/public_html/`, NOT `/home/quantumofgravity/domains/quantumofgravity.com/public_html/`
- **Fix**: Copied files from domains/ ghost copy to actual DocumentRoot
- **Cache-busting**: Added `Cache-Control: no-cache` meta tags + bumped JS version params (?v=5 → ?v=6)
- **Cleanup**: Deleted stale ghost copies (astro-learn, econ-sim, strings-sim) from domains/ to prevent future footguns
- **Logged**: All operations recorded in `file-operations.log`

## Remaining Issues for Next Session

1. **T13: Continue graph-tools port** — D3 renderer, flow animation, edge creation
2. Mobile responsiveness — Layout may break on narrow screens
3. Performance — 50+ node networks may be slow
4. Flow particle visibility — May need brighter colors
5. Econ-sim refactor to use published packages

## Architecture Decisions (Current)

1. Transfer-only optimization is correct approach for this problem structure
2. HTML5 Canvas preferred for adjacency matrix (performance)
3. CSS custom properties enable easy theming
4. Quick Results panel provides immediate feedback without tab switching
5. Auto-connect reduces friction for network building
6. **Always verify Apache DocumentRoot before editing server files**
7. **@space-cadet/graph-* packages** will replace local graph/viz code in future refactor
