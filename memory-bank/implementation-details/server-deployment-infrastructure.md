# Implementation Details: Server Deployment & Infrastructure

*Created: 2026-08-10*
*Updated: 2026-08-10 16:15:00 UTC*
*Related Tasks: Deployment fix, T6 follow-up*

## Overview

This document captures server infrastructure details, deployment procedures, and lessons learned from the econ-sim deployment fix session (2026-08-10 afternoon).

---

## Apache DocumentRoot Configuration

### The Problem

Apache's `DocumentRoot` for `quantumofgravity.com` is:
```
/home/quantumofgravity/public_html/
```

However, there exists a **duplicate directory structure** at:
```
/home/quantumofgravity/domains/quantumofgravity.com/public_html/
```

This `domains/` path is a Virtualmin/webmin management directory, NOT what Apache serves.

### How We Discovered It

1. Edited files in `domains/.../projects/econ-sim/` (added 9 scenario options, auto-connect checkbox)
2. User reported NOT seeing changes in browser
3. curl from internet showed only 5 old scenarios
4. Checked Apache config: `DocumentRoot /home/quantumofgravity/public_html`
5. Found live files were in `public_html/`, not `domains/`
6. **Last-modified header was 3 hours older than file modification time** — definitive proof Apache serves from different path

### The Fix

Copied corrected files from ghost copy to actual DocumentRoot:
```bash
sudo cp /home/quantumofgravity/domains/quantumofgravity.com/public_html/projects/econ-sim/index.html \
        /home/quantumofgravity/public_html/projects/econ-sim/index.html
sudo cp /home/quantumofgravity/domains/quantumofgravity.com/public_html/projects/econ-sim/src/*.js \
        /home/quantumofgravity/public_html/projects/econ-sim/src/
```

### Verification

| Check | Command | Expected Result |
|-------|---------|-----------------|
| Local file | `cat public_html/projects/econ-sim/index.html` | 9 scenarios visible |
| Remote via curl | `curl -s https://quantumofgravity.com/projects/econ-sim/` | 9 scenarios visible |
| HTTP last-modified | `curl -sI` | Matches file mtime |

---

## Stale Ghost Copies in domains/

### What Were They

The `domains/quantumofgravity.com/public_html/projects/` directory contained stale partial copies:

| Project | In domains/ (stale) | In public_html/ (live) |
|---------|--------------------|------------------------|
| `astro-learn` | Tiny — just index.html + assets/ (Jul 27) | Full site (Aug 9) |
| `econ-sim` | Full copy (Aug 10) | Full copy (Aug 10) |
| `strings-sim` | Small — index.html + assets/ (Jul 30) | Full site (Aug 9) |

### Why They Existed

- Virtualmin creates `domains/` structure for domain management
- Manual copies or deployment scripts may have placed files there
- They were never cleaned up after the actual deployment to `public_html/`

### Cleanup

Deleted all three stale copies:
```bash
sudo rm -rf /home/quantumofgravity/domains/quantumofgravity.com/public_html/projects/astro-learn
sudo rm -rf /home/quantumofgravity/domains/quantumofgravity.com/public_html/projects/econ-sim
sudo rm -rf /home/quantumofgravity/domains/quantumofgravity.com/public_html/projects/strings-sim
```

**Result**: `domains/.../projects/` is now empty. No more footgun.

---

## Cache-Busting Strategy

### Browser Caching Issue

Even after deploying to correct path, browsers may cache:
- `index.html` (especially if no cache headers)
- JS module imports (even with `?v=` query params, browsers may cache aggressively)

### Solution Implemented

**1. Meta tags in HTML head:**
```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
```

**2. Versioned module imports:**
```javascript
// In index.html
import { App } from './src/ui.js?v=8';

// In src/ui.js
import { EconomicGraph } from './graph.js?v=6';
import { Simulator } from './simulation.js?v=6';
// ... etc
```

**Version bump protocol**: Increment version numbers on every deployment to force fresh load.

---

## File Operations Logging

### Log Location
```
~/workspace/logs/file-operations.log
```

### Helper Script
```
~/workspace/scripts/file-ops-log.sh
```

### Operations Logged This Session

```
[2026-08-10 11:16 UTC] DEPLOY — cache-busting meta tags + JS version bump
[2026-08-10 11:20 UTC] COPY — corrected deployment from domains/ ghost copy to actual DocumentRoot
[2026-08-10 15:55 UTC] DISCOVER — found stale ghost copies in domains/
[2026-08-10 16:02 UTC] DELETE — stale ghost copies removed
[2026-08-10 16:02 UTC] DELETE_COMPLETE — live copies verified intact
```

### Lesson

Always log server file operations. The log serves as an audit trail and prevents "what did I change?" confusion.

---

## Deployment Checklist (For Future)

Before any server file edit:
- [ ] Verify Apache DocumentRoot: `grep DocumentRoot /etc/apache2/sites-available/quantumofgravity.com.conf`
- [ ] Confirm target path is under `public_html/`, NOT `domains/`
- [ ] Bump JS version params (`?v=N`) on every deploy
- [ ] Log operation in `file-operations.log`
- [ ] Verify with curl from internet (not just local file check)
- [ ] Check HTTP `last-modified` matches file mtime

---

## Server Paths Reference

| Purpose | Path |
|---------|------|
| Apache DocumentRoot (live site) | `/home/quantumofgravity/public_html/` |
| Virtualmin management (NOT served) | `/home/quantumofgravity/domains/quantumofgravity.com/public_html/` |
| Econ-sim live | `/home/quantumofgravity/public_html/projects/econ-sim/` |
| Econ-sim repo | `/home/cloudy/.openclaw/workspace/code/econ-sim/` |
| Apache config | `/etc/apache2/sites-available/quantumofgravity.com.conf` |
| File operations log | `~/workspace/logs/file-operations.log` |

---

## Key Lessons

1. **Always verify the served path** — Don't assume the directory you're looking at is what Apache serves
2. **curl is the source of truth** — Local file contents mean nothing if the server serves from elsewhere
3. **Check last-modified headers** — If HTTP mtime ≠ file mtime, you're editing the wrong file
4. **Clean up ghost copies** — Stale duplicates cause confusion and wasted time
5. **Log everything** — Audit trails save debugging time
