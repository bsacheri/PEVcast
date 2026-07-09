# Git and Deployment Differences: PEVcast vs SkyDiff2

Master project: `C:\Dev\Weather_app\PEVcast`  
Child project: `C:\Dev\Weather_app\SkyDiff2`  
Review date: 2026-07-04

## Executive Summary

PEVcast is more publish-ready because its Git setup protects version metadata before code reaches GitHub, and its app is fundamentally static. Its release path is: stage source changes, run the pre-commit version sync, commit the synced app/cache/version metadata, run pre-push consistency validation, then push static files to GitHub.

SkyDiff2 has useful version hooks, but its Git/deployment setup is less mature. Its working tree is heavily modified, its `pre-push` hook is currently untracked, and the hook strategy mutates the repository during push by creating a version-bump commit and aborting the first push. More importantly, SkyDiff2 depends on `server.js` and `/api/...` routes, so a normal GitHub Pages deployment cannot fully run it without backend refactoring or a separate hosted API.

Neither project has a `.github` workflow folder locally. Publishing appears to be manual Git push plus GitHub repository Pages configuration rather than repo-defined CI/CD.

## Current Git State

### PEVcast

- Repository path: `C:\Dev\Weather_app\PEVcast`
- Current branch: `master`
- Tracking: `master` tracks `origin/master`
- Remote: `https://github.com/bsacheri/PEVcast.git`
- Additional local branches detected: `fetch`, `main-old`
- Remote HEAD: `origin/HEAD -> origin/main-old`
- Current local status at inspection:
  - `test-results/.last-run.json` staged
  - `Project_Comparison_Report.md` untracked

Assessment: PEVcast's active publishing branch is `master`, and `master` is synchronized with `origin/master` except for local staged/untracked files. The remote default branch indication points at `main-old`, which is unusual and should be reviewed in GitHub repository settings if Pages or default branch behavior ever seems odd.

### SkyDiff2

- Repository path: `C:\Dev\Weather_app\SkyDiff2`
- Current branch: `main`
- Tracking: `main` tracks `origin/main`
- Remote: `https://github.com/bsacheri/SkyDiff2.git`
- Current local status at inspection:
  - Many modified tracked files, including `ReadMe.md`, `app.js`, `config.example.js`, `index.html`, `package.json`, `server.js`, `shared\forecast-core.js`, `styles.css`, and `version.json`
  - Several untracked files, including `.githooks\pre-push`, `app-icon.svg`, `manifest.webmanifest`, `package-lock.json`, `shared\nowcast-core.js`, `sw.js`
  - `node_modules\` untracked in working tree output

Assessment: SkyDiff2 appears mid-development. Its local Git/deployment setup should not be considered stable until modified and untracked deployment files are intentionally committed or ignored.

## .gitignore Comparison

### PEVcast

File: `C:\Dev\Weather_app\PEVcast\.gitignore`

Current behavior:
- Ignores files containing `testdata` in the name.
- Ignores `node_modules/`.
- Does not ignore `test-results/`.

Why this helps publishing:
- Keeps local dependencies out of Git.
- Allows the app's static source and generated version metadata to be committed.

Gap:
- Playwright output such as `test-results/` can be accidentally staged. This already happened with `test-results/.last-run.json`.

Recommendation:
- Add `test-results/` and optionally `playwright-report/`.
- Path: `C:\Dev\Weather_app\PEVcast\.gitignore`
- Why: Prevent generated test artifacts from entering release commits.
- Confidence: High

### SkyDiff2

File: `C:\Dev\Weather_app\SkyDiff2\.gitignore`

Current behavior:
- Ignores `config.js`.
- Ignores `config.private.js`.
- Does not ignore `node_modules/`.
- Does not ignore test output or local build artifacts.

Why this matters:
- SkyDiff2 has local secret-bearing config files, so ignoring `config.js` and `config.private.js` is essential.
- Missing `node_modules/` ignore is a release hygiene issue; `node_modules/` is currently reported as untracked.

Recommendation:
- Add `node_modules/`, `test-results/`, `playwright-report/`, `.env`, and local logs.
- Path: `C:\Dev\Weather_app\SkyDiff2\.gitignore`
- Why: Prevent dependencies, generated test artifacts, and secret-bearing env files from being staged.
- Confidence: High

## .gitattributes Comparison

PEVcast:
- No `C:\Dev\Weather_app\PEVcast\.gitattributes` file found.

SkyDiff2:
- No `C:\Dev\Weather_app\SkyDiff2\.gitattributes` file found.

Impact:
- Neither repo explicitly standardizes line endings, binary handling, or diff behavior.
- PEVcast has shown line-ending warnings during commits, so this is a small but real maintenance issue.

Recommendation:
- Add `.gitattributes` to both repositories.
- Suggested path: `C:\Dev\Weather_app\PEVcast\.gitattributes`
- Suggested path: `C:\Dev\Weather_app\SkyDiff2\.gitattributes`
- Why: Stabilizes cross-platform line endings for JS/CSS/HTML/JSON/MD/PS1 files and avoids noisy diffs.
- Confidence: Medium

## .github Folder and CI/CD Workflows

PEVcast:
- No `C:\Dev\Weather_app\PEVcast\.github` folder found.
- No local GitHub Actions workflow found.

SkyDiff2:
- No `C:\Dev\Weather_app\SkyDiff2\.github` folder found.
- No local GitHub Actions workflow found.

Impact:
- CI/CD is not defined in the repo.
- Publishing is likely controlled through GitHub repository settings, such as GitHub Pages branch/source settings, plus manual `git push`.
- Automated test gates are local-only.

Recommendation for PEVcast:
- Consider adding a GitHub Actions workflow that runs `npm run test:e2e` and `scripts\bump-version.ps1 -CheckOnly`.
- Path to create: `C:\Dev\Weather_app\PEVcast\.github\workflows\ci.yml`
- Why: PEVcast currently relies on local hooks; CI would catch missed hooks or direct web edits.
- Confidence: Medium

Recommendation for SkyDiff2:
- Do not add Pages deployment until deployment model is decided.
- Path to create later: `C:\Dev\Weather_app\SkyDiff2\.github\workflows\ci.yml`
- Why: CI can run `npm test` now, but deployment needs backend/static strategy first.
- Confidence: High

## Git Hooks Comparison

### PEVcast Hooks

Files:
- `C:\Dev\Weather_app\PEVcast\.githooks\pre-commit`
- `C:\Dev\Weather_app\PEVcast\.githooks\pre-push`
- `C:\Dev\Weather_app\PEVcast\scripts\install-git-hooks.ps1`
- `C:\Dev\Weather_app\PEVcast\scripts\bump-version.ps1`

Behavior:
- `pre-commit` runs `scripts\bump-version.ps1 -StageUpdatedFiles`.
- `pre-push` runs `scripts\bump-version.ps1 -CheckOnly`.
- `install-git-hooks.ps1` copies hook files from `.githooks` into `.git\hooks`.

Why this enables successful publishing:
- Version metadata is updated before the commit is finalized.
- Generated version files are staged into the same commit as the source change.
- Push is blocked if `index.html`, `styles.css`, `app.js`, `sw.js`, and `version.json` are inconsistent.
- The push hook validates but does not mutate the repo, so push behavior is predictable.

Important nuance:
- PEVcast `.git\config` does not show `core.hooksPath = .githooks`; it uses the copy-into-`.git\hooks` install model.
- That means hooks only run if `scripts\install-git-hooks.ps1` has been run or hooks were otherwise installed.

Confidence: High

### SkyDiff2 Hooks

Files:
- `C:\Dev\Weather_app\SkyDiff2\.githooks\pre-commit`
- `C:\Dev\Weather_app\SkyDiff2\.githooks\pre-push`
- `C:\Dev\Weather_app\SkyDiff2\install-git-hooks.ps1`
- `C:\Dev\Weather_app\SkyDiff2\bump-version.ps1`

Behavior:
- Git config has `core.hooksPath = .githooks`.
- `pre-commit` bumps patch version and stages `package.json`, `shared\forecast-core.js`, and `version.json`.
- `pre-push` bumps patch version, stages those same files, creates a `chore: bump version for push` commit if needed, prints a message, exits 1, and requires the user to re-run push.
- `pre-push` is currently untracked in local Git status.

Why this is weaker than PEVcast:
- The push hook mutates repository state during push.
- The first push can intentionally fail after creating a commit, which is easy to misread as a broken push.
- Because `pre-push` is untracked, another clone may not have the same behavior.
- The version script lacks a check-only mode equivalent to PEVcast.

Recommendation:
- Change SkyDiff2's pre-push hook to validation-only.
- Add a check-only mode to `C:\Dev\Weather_app\SkyDiff2\bump-version.ps1`.
- Commit `C:\Dev\Weather_app\SkyDiff2\.githooks\pre-push` if it is intended to be shared.
- Why: PEVcast succeeds because push verifies release readiness without changing the commit graph.
- Confidence: High

## Branching Configuration

### PEVcast

File: `C:\Dev\Weather_app\PEVcast\.git\config`

Detected:
- `master` tracks `origin/master`.
- `main-old` tracks `origin/main-old`.
- VS Code merge base entries exist for `origin/main-old` and `origin/master`.
- Remote HEAD points to `origin/main-old`.

Interpretation:
- Actual publishing work is happening on `master`.
- Remote default may still be `main-old`, which could confuse PR targets, GitHub Pages branch selection, or GitHub UI defaults.

Recommendation:
- Verify GitHub repository default branch and Pages source in the GitHub web UI.
- Relevant repo: `https://github.com/bsacheri/PEVcast`
- Why: PEVcast can push successfully, but branch naming/default mismatch is a latent release-management risk.
- Confidence: Medium

### SkyDiff2

File: `C:\Dev\Weather_app\SkyDiff2\.git\config`

Detected:
- `main` tracks `origin/main`.
- `core.hooksPath = .githooks`.
- No extra branches detected locally.

Interpretation:
- Branching is simpler and more conventional than PEVcast.
- The problem is not branch tracking; it is the incomplete deployment model and unsettled worktree.

Recommendation:
- Keep `main` as the release branch unless GitHub Pages/static deployment requires a separate publishing branch.
- Why: Branch simplicity is a strength; avoid introducing `master`/`main-old` style ambiguity.
- Confidence: High

## Release and Versioning Strategy

### What PEVcast Does Well

Responsible files:
- `C:\Dev\Weather_app\PEVcast\scripts\bump-version.ps1`
- `C:\Dev\Weather_app\PEVcast\.githooks\pre-commit`
- `C:\Dev\Weather_app\PEVcast\.githooks\pre-push`
- `C:\Dev\Weather_app\PEVcast\index.html`
- `C:\Dev\Weather_app\PEVcast\styles.css`
- `C:\Dev\Weather_app\PEVcast\app.js`
- `C:\Dev\Weather_app\PEVcast\sw.js`
- `C:\Dev\Weather_app\PEVcast\version.json`
- `C:\Dev\Weather_app\PEVcast\REVISION_LOG.md`

PEVcast tracks separate versions for:
- HTML shell
- CSS
- JS/app behavior
- Service-worker cache version
- Published `version.json`
- Visible UI footer/version chip metadata
- Revision log entries

Why this supports release and publishing:
- Browser and PWA cache invalidation is tied to source changes through `sw.js` `CACHE_VERSION`.
- `version.json` gives the app a published update-check target.
- `REVISION_LOG.md` records release notes that can be displayed in-app.
- Push validation prevents partially bumped versions from reaching GitHub.

Confidence: High

### What SkyDiff2 Does Differently

Responsible files:
- `C:\Dev\Weather_app\SkyDiff2\bump-version.ps1`
- `C:\Dev\Weather_app\SkyDiff2\.githooks\pre-commit`
- `C:\Dev\Weather_app\SkyDiff2\.githooks\pre-push`
- `C:\Dev\Weather_app\SkyDiff2\package.json`
- `C:\Dev\Weather_app\SkyDiff2\shared\forecast-core.js`
- `C:\Dev\Weather_app\SkyDiff2\version.json`
- `C:\Dev\Weather_app\SkyDiff2\sw.js`

SkyDiff2 tracks:
- Package SemVer
- `APP_VERSION` in `shared\forecast-core.js`
- `version.json` timestamp metadata
- Service-worker cache names derived from `APP_VERSION`

Weaknesses:
- `shared\forecast-core.js` currently showed `APP_VERSION = "1.1.0"` while `package.json` and `version.json` showed `1.2.0` during inspection, indicating version drift in the local working tree.
- The pre-push hook tries to fix drift by creating commits during push rather than blocking with a clear validation error.
- There is no revision log equivalent.

Recommendation:
- Preserve SkyDiff2's SemVer model, but add PEVcast-style consistency validation.
- Why: SkyDiff2 does not need PEVcast's HTML/CSS/JS split, but it does need reliable sync between package, app runtime, version metadata, and service-worker cache names.
- Confidence: High

## Deployment and Publishing Configuration

### PEVcast

Files:
- `C:\Dev\Weather_app\PEVcast\manifest.json`
- `C:\Dev\Weather_app\PEVcast\sw.js`
- `C:\Dev\Weather_app\PEVcast\index.html`
- `C:\Dev\Weather_app\PEVcast\version.json`
- `C:\Dev\Weather_app\PEVcast\start_server.bat`

Why PEVcast can publish successfully:
- It is static: no Node backend is needed.
- `manifest.json` uses GitHub Pages-style subpath values: `start_url` and `scope` are `/PEVcast/`.
- `sw.js` caches a static app shell.
- Version metadata and cache names are synchronized by hook/script.
- `version.json` supports app-level update detection.
- External data providers used by the browser are accessible without private server-side secrets for the core app.

Limitations:
- No repo-defined GitHub Actions deployment workflow was found.
- Service worker registration in `app.js` should be periodically reviewed against GitHub Pages subpath scope, because root-scoped service workers and repo-subpath Pages can be tricky.
- `.gitignore` should ignore Playwright output.

Confidence: High

### SkyDiff2

Files:
- `C:\Dev\Weather_app\SkyDiff2\server.js`
- `C:\Dev\Weather_app\SkyDiff2\app.js`
- `C:\Dev\Weather_app\SkyDiff2\manifest.webmanifest`
- `C:\Dev\Weather_app\SkyDiff2\sw.js`
- `C:\Dev\Weather_app\SkyDiff2\config.example.js`
- `C:\Dev\Weather_app\SkyDiff2\.env.example`
- `C:\Dev\Weather_app\SkyDiff2\ReadMe.md`

Current blockers for GitHub Pages:
- `app.js` calls `/api/...` routes.
- `/api/...` routes are implemented in `server.js`.
- GitHub Pages cannot run `server.js`.
- Several providers require API keys that should not be exposed in browser-side static files.
- README already notes the TODO to investigate GitHub Pages support by refactoring away from the local Node API layer.

What does work:
- Static app shell assets exist.
- `manifest.webmanifest` uses relative paths.
- `sw.js` is module-based and caches static shell files.
- Some Open-Meteo calls appear browser-direct-capable.

Recommendation:
- Decide between two deployment models:
  1. Static GitHub Pages subset with only browser-safe providers.
  2. Hosted Node/API backend plus static frontend.
- Why: Without this decision, copying PEVcast publishing setup will create a site that loads but cannot fetch all provider data.
- Confidence: High

## What Specifically Allows PEVcast to be Versioned, Released, and Published Successfully

1. Static architecture
- File: `C:\Dev\Weather_app\PEVcast\index.html`
- File: `C:\Dev\Weather_app\PEVcast\app.js`
- File: `C:\Dev\Weather_app\PEVcast\styles.css`
- Why: GitHub Pages can serve the application directly without a backend.
- Confidence: High

2. PWA manifest aligned to repository subpath
- File: `C:\Dev\Weather_app\PEVcast\manifest.json`
- Why: `start_url` and `scope` target `/PEVcast/`, matching the expected GitHub Pages project path.
- Confidence: High

3. Service-worker cache version tied to source versions
- File: `C:\Dev\Weather_app\PEVcast\sw.js`
- File: `C:\Dev\Weather_app\PEVcast\scripts\bump-version.ps1`
- Why: Cache invalidation is deterministic when HTML/CSS/JS versions change.
- Confidence: High

4. Published version metadata
- File: `C:\Dev\Weather_app\PEVcast\version.json`
- File: `C:\Dev\Weather_app\PEVcast\app.js`
- Why: The app can detect whether a newer deployed version exists.
- Confidence: High

5. Visible and machine-readable app versions
- File: `C:\Dev\Weather_app\PEVcast\index.html`
- File: `C:\Dev\Weather_app\PEVcast\app.js`
- File: `C:\Dev\Weather_app\PEVcast\styles.css`
- Why: Version information is displayed and validated in multiple places.
- Confidence: High

6. Commit-time version synchronization
- File: `C:\Dev\Weather_app\PEVcast\.githooks\pre-commit`
- File: `C:\Dev\Weather_app\PEVcast\scripts\bump-version.ps1`
- Why: Release metadata is committed with the code change that caused it.
- Confidence: High

7. Push-time version validation
- File: `C:\Dev\Weather_app\PEVcast\.githooks\pre-push`
- Why: Bad version/cache metadata is blocked before reaching GitHub.
- Confidence: High

8. Revision log automation
- File: `C:\Dev\Weather_app\PEVcast\REVISION_LOG.md`
- File: `C:\Dev\Weather_app\PEVcast\scripts\bump-version.ps1`
- Why: Release notes are generated/maintained alongside version bumps.
- Confidence: High

9. GitHub remote and tracked release branch
- File: `C:\Dev\Weather_app\PEVcast\.git\config`
- Why: `master` tracks `origin/master`, allowing simple `git push` publishing.
- Confidence: High

## Recommended Changes for SkyDiff2 to Match PEVcast's Release Reliability

1. Fix `.gitignore`
- File: `C:\Dev\Weather_app\SkyDiff2\.gitignore`
- Add: `node_modules/`, `.env`, `test-results/`, `playwright-report/`, logs.
- Why: Prevent accidental publishing of dependencies, generated artifacts, and secrets.
- Confidence: High

2. Commit or remove untracked deployment files intentionally
- Files include: `C:\Dev\Weather_app\SkyDiff2\manifest.webmanifest`, `sw.js`, `app-icon.svg`, `.githooks\pre-push`, `package-lock.json`
- Why: Deployment behavior cannot be standardized while key PWA/hook files are untracked.
- Confidence: High

3. Replace mutating pre-push with check-only pre-push
- File: `C:\Dev\Weather_app\SkyDiff2\.githooks\pre-push`
- File: `C:\Dev\Weather_app\SkyDiff2\bump-version.ps1`
- Why: PEVcast succeeds because push validates release integrity without creating surprise commits.
- Confidence: High

4. Add version consistency checks
- File: `C:\Dev\Weather_app\SkyDiff2\bump-version.ps1`
- Check: `package.json` version equals `shared\forecast-core.js` `APP_VERSION` equals `version.json` version.
- Check: `sw.js` cache names derive from the same `APP_VERSION`.
- Why: Current local files show likely version drift.
- Confidence: High

5. Add a revision log
- File to create: `C:\Dev\Weather_app\SkyDiff2\REVISION_LOG.md`
- Why: PEVcast has a release history surface; SkyDiff2 currently uses README notes and TODOs.
- Confidence: Medium

6. Decide Pages vs backend deployment
- Files: `C:\Dev\Weather_app\SkyDiff2\server.js`, `app.js`, `manifest.webmanifest`, `sw.js`
- Why: GitHub Pages cannot host the current API layer.
- Confidence: High

7. Add GitHub Actions CI after the deployment decision
- File to create: `C:\Dev\Weather_app\SkyDiff2\.github\workflows\ci.yml`
- Why: Run `npm test` and version checks consistently outside local hooks.
- Confidence: Medium

## Recommended Changes for PEVcast

1. Ignore generated test output
- File: `C:\Dev\Weather_app\PEVcast\.gitignore`
- Add: `test-results/`, `playwright-report/`
- Why: `test-results/.last-run.json` is currently staged and should not be release content.
- Confidence: High

2. Verify GitHub default branch and Pages source
- Location: GitHub repository settings for `https://github.com/bsacheri/PEVcast`
- Why: Local remote HEAD points to `origin/main-old` while active work publishes from `master`.
- Confidence: Medium

3. Consider switching hook installation to `core.hooksPath`
- File: `C:\Dev\Weather_app\PEVcast\scripts\install-git-hooks.ps1`
- Why: SkyDiff2's `core.hooksPath = .githooks` is easier to inspect than copied hooks in `.git\hooks`.
- Confidence: Low

4. Add CI workflow
- File to create: `C:\Dev\Weather_app\PEVcast\.github\workflows\ci.yml`
- Why: Local hooks are good, but GitHub-side checks would protect releases from machines without installed hooks.
- Confidence: Medium

## Bottom Line

PEVcast publishes successfully because it is static, has a GitHub Pages-compatible PWA shape, and treats version/cache metadata as a first-class release artifact. The most important mechanism is the pair of hooks around `scripts\bump-version.ps1`: pre-commit updates and stages versioned files, and pre-push validates that the pushed commit is internally consistent.

SkyDiff2 should copy the discipline, not the exact implementation. Its release strategy should keep SemVer and shared-module versioning, add PEVcast-style check-only validation, clean up ignore rules, commit intended PWA/hook files, and resolve the Node API vs GitHub Pages deployment decision before attempting to match PEVcast's publishing model.
