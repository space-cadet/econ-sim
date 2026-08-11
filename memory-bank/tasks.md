# Memory Bank — Econ-Sim

*Created: 2026-08-09 22:00:00 IST*
*Last Updated: 2026-08-10 20:20:00 UTC*

## Overview

Networked Intertemporal Optimization Simulator — An interactive web implementation of the Ramsey social-planner problem on graphs, with field theory analogies. Based on Anarkitty's notes.

## Active Tasks

### T13: Extract graph-core and graph-ui to standalone monorepo + Econ-sim refactor

**Status:** PAUSED — BLOCKED BY CDN ISSUE
**Priority:** HIGH
**Started:** 2026-08-10
**Blocked:** 2026-08-10 23:10 UTC

**Plan:**
1. ✅ Create GitHub repo `space-cadet/graph-tools` as a pnpm monorepo
2. ✅ Migrate `graph-core` and `graph-ui` from `spin-network-app/packages/`
3. ✅ Clean up dependencies (strip UI deps from core, fix cross-package imports)
4. ✅ Add spectral radius to graph-core
5. ✅ Publish v0.1.0–0.1.3 to npm
6. ⬜ Refactor econ-sim to use `@space-cadet/graph-core` — **BROKEN, see below**
7. ⬜ Port missing features from econ-sim into graph packages:
   - Flow animation system (from `NetworkVisualization`)
   - Interactive edge creation with ghost lines
   - D3.js renderer alongside Sigma/Three.js
8. ⬜ Set up automated publishing with Changesets

**Econ-sim Refactor Blocker:**
- `src/graph.js` adapter created and deployed
- CDN import of `@space-cadet/graph-core@0.1.3` fails in browser:
  - esm.sh serves incomplete build (missing `getOutgoingEdges`)
  - jsdelivr serves raw npm files with bare specifiers (browser can't resolve `import "mathjs"`)
  - esm.sh direct path to `/es2022/graph-core.mjs` also incomplete
- **Probable cause**: esm.sh builds packages lazily; freshly published package may not have finished building
- **Next attempt**: Build self-contained IIFE bundle and vendor it, or republish as v0.1.4

**Architecture:**
- `@space-cadet/graph-core`: Pure graph theory library (Graphology wrapper + types + generators + spectral methods)
- `@space-cadet/graph-ui`: Multi-renderer visualization (Sigma, Three.js, D3.js)
- Monorepo with pnpm workspaces + Turborepo

**Key Decisions:**
- Namespace: `@space-cadet/*` (confirmed user owns npm scope)
- Monorepo over separate repos (packages are tightly coupled)
- Clean in new repo, leave `spin-network-app` untouched as reference

**Dependencies:**
- `spin-network-app` cloned locally for source extraction
- `econ-sim` source code for feature porting

**Session Notes (2026-08-10 22:58–23:10 UTC):**
- Attempted to switch econ-sim graph.js from local graph-legacy to graph-core adapter
- Multiple CDN attempts all failed
- User decided to pause and fix later
- Workspace files updated; deployed to server (same broken state)

---

## Completed Tasks

| ID | Title | Status | Priority | Started | Completed | Dependencies | Details |
|----|-------|--------|----------|---------|-----------|--------------|---------|
| T1 | Project Bootstrap & Memory Bank | ✅ COMPLETED | HIGH | 2026-08-09 | 2026-08-09 | — | [Details](tasks/T1.md) |
| T2 | Core Simulation Engine | ✅ COMPLETED | HIGH | 2026-08-09 | 2026-08-09 | T1 | [Details](tasks/T2.md) |
| T3 | Interactive Network Graph Viz | ✅ COMPLETED | HIGH | 2026-08-09 | 2026-08-09 | T2 | [Details](tasks/T3.md) |
| T4 | Numerical Plots & UI | ✅ COMPLETED | HIGH | 2026-08-09 | 2026-08-09 | T2, T3 | [Details](tasks/T4.md) |
| T5 | Documentation Section | ✅ COMPLETED | MEDIUM | 2026-08-09 | 2026-08-09 | T2 | [Details](tasks/T5.md) |
| T6 | Deployment | ✅ COMPLETED | MEDIUM | 2026-08-09 | 2026-08-09 | T3, T4, T5 | [Details](tasks/T6.md) |
| T7 | Fix Numerical Solver Convergence | ✅ COMPLETED | CRITICAL | 2026-08-10 | 2026-08-10 | — | [Details](tasks/T7.md) |
| T8 | Fix Spectral Radius Calculation | ✅ COMPLETED | CRITICAL | 2026-08-10 | 2026-08-10 | — | [Details](tasks/T8.md) |
| T9 | Fix D3 Visualization & Interaction | ✅ COMPLETED | HIGH | 2026-08-10 | 2026-08-10 | T7, T8 | [Details](tasks/T9.md) |
| T10 | Redesign Color Scheme | ✅ COMPLETED | HIGH | 2026-08-10 | 2026-08-10 | — | [Details](tasks/T10.md) |
| T11 | Fix Plots & Data Display | ✅ COMPLETED | HIGH | 2026-08-10 | 2026-08-10 | T7, T8 | [Details](tasks/T11.md) |
| T12 | UX: Inline Plots + Simulation Feedback | ✅ COMPLETED | HIGH | 2026-08-10 | 2026-08-10 | T9, T11 | [Details](tasks/T12.md) |

## Bug-Fix Sprint (T7-T12) Summary

Post-deployment QA (2026-08-10) revealed critical issues in solver, visualization, and UX. All fixed in single session:

- **Solver**: Rewrote with feasible transfer-only optimization (converges in ~70 iters)
- **Spectral radius**: Fixed matrix indexing with contiguous ID mapping
- **Visualization**: Fixed D3 update pattern, visible labels, flow animation
- **Color scheme**: Teal/cyan on slate (professional, accessible)
- **Plots**: Canvas heatmap, per-period welfare, inline mini-charts
- **UX**: Quick Results panel, loading state, auto-tab-switch

## New Features (Beyond Original Scope)

- **Edge manipulation**: Visual edge creation with ghost line, edge selection & deletion
- **Auto-connect**: New nodes automatically connect to nearest existing nodes
- **4 new scenarios**: Scale-Free, Small-World, Grid, Complete Bipartite (9 total)

## Deployment Fix (2026-08-10 Afternoon Session)

- ✅ **Scenario dropdown caching FIXED** — Root cause: was editing `domains/` ghost copy instead of actual `public_html/` DocumentRoot
- ✅ **Cache-busting added** — `Cache-Control: no-cache` meta tags + JS version param bump (`?v=5` → `?v=6`)
- ✅ **Ghost copies deleted** — Removed stale `astro-learn`, `econ-sim`, `strings-sim` from `domains/` to prevent future confusion
- ✅ **Operations logged** — All file operations recorded in `~/workspace/logs/file-operations.log`

## Status Summary

- **Active**: 1 (T13)
- **Pending**: 0
- **Completed**: 12 (T1-T12)
- **Total**: 13

## Next Session

Remaining issues to address:
1. T13: Continue porting D3 renderer and flow animation to graph-tools
2. Mobile responsiveness testing
3. Performance on large networks (50+ nodes)
4. Flow animation particle visibility verification
5. Refactor econ-sim to use @space-cadet/graph-* packages
