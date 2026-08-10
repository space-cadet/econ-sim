# Active Context

*Last Updated: 2026-08-10 16:04:00 UTC*

## Current Focus

**Caching/Deployment issue FIXED.**

v1.1 is fully deployed and functional. All 9 scenarios visible, auto-connect checkbox present.

## System Status

- **Project**: econ-sim at `code/econ-sim/`
- **Deployed**: `quantumofgravity.com/projects/econ-sim/`
- **Version**: v1.1 (T7-T12 fixes + edge manipulation + new scenarios + deployment fix)
- **Status**: LIVE and functional

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

1. ~~Scenario dropdown caching~~ ✅ FIXED
2. **Mobile responsiveness** — Layout may break on narrow screens
3. **Performance** — 50+ node networks may be slow
4. **Flow particle visibility** — May need brighter colors

## Architecture Decisions (Current)

1. Transfer-only optimization is correct approach for this problem structure
2. HTML5 Canvas preferred for adjacency matrix (performance)
3. CSS custom properties enable easy theming
4. Quick Results panel provides immediate feedback without tab switching
5. Auto-connect reduces friction for network building
6. **Always verify Apache DocumentRoot before editing server files**
