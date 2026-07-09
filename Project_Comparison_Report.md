# Project Comparison Report: PEVcast vs SkyDiff2

Master project: `C:\Dev\Weather_app\PEVcast`  
Child project: `C:\Dev\Weather_app\SkyDiff2`  
Review date: 2026-07-04

## A. Executive Summary

PEVcast and SkyDiff2 are both browser-first weather applications, but they have different operational models.

PEVcast is a mostly static PWA hosted from repository files. It uses Chart.js and CDN chart plugins, has Playwright browser smoke tests, VS Code workflow tasks, a structured revision log, icon assets, a Git hook driven version/cache synchronization system, and a service worker designed around static app-shell caching plus update metadata.

SkyDiff2 is a richer multi-provider comparison tool with a Node.js local API server, shared ES module forecast normalization logic, vendored ECharts, provider-specific API handling, local secret/config files, and Node's built-in test runner for shared forecast logic. It is less ready for direct GitHub Pages publishing because most provider calls route through `server.js` and several providers require protected API keys.

The main standardization opportunity is not to copy PEVcast wholesale. SkyDiff2 should adapt PEVcast's project hygiene: VS Code tasks, browser smoke testing, stronger version/check hooks, documentation structure, GitHub Pages path handling, and PWA metadata discipline. SkyDiff2 should keep its own server/shared-module architecture unless it is intentionally refactored into a pure static app.

Important current-state note: PEVcast currently has `test-results/.last-run.json` staged. This is generated test output and should not be treated as part of either project standardization.

## B. Major Architectural Differences

### Application Shape

PEVcast:
- Main browser app in `C:\Dev\Weather_app\PEVcast\app.js`.
- Single primary page in `C:\Dev\Weather_app\PEVcast\index.html`.
- Optional chart-engine comparison page in `C:\Dev\Weather_app\PEVcast\chart-compare.html`.
- No local application server required for production.
- Live data comes directly from browser-accessible APIs such as Open-Meteo, BigDataCloud, and Nominatim.

SkyDiff2:
- Browser UI in `C:\Dev\Weather_app\SkyDiff2\app.js`.
- Local Node API and static server in `C:\Dev\Weather_app\SkyDiff2\server.js`.
- Shared domain logic in `C:\Dev\Weather_app\SkyDiff2\shared\forecast-core.js`, `shared\nowcast-core.js`, and `shared\provider-registry.js`.
- Many provider calls are proxied through `/api/...` endpoints, making pure static hosting incomplete without backend replacement.

### Charting

PEVcast:
- Uses Chart.js via CDN in `index.html`.
- Adds multiple custom Chart.js plugins in `app.js`.
- Includes `chart-compare.html` to compare Chart.js, ECharts, Highcharts, D3, Vega-Lite, Recharts, and Nivo.

SkyDiff2:
- Uses vendored ECharts in `C:\Dev\Weather_app\SkyDiff2\vendor\echarts.min.js`.
- Renders combined and per-provider comparison charts from normalized provider payloads.

### Testing

PEVcast:
- Browser smoke tests in `C:\Dev\Weather_app\PEVcast\tests\smoke.spec.js`.
- Playwright configuration in `C:\Dev\Weather_app\PEVcast\playwright.config.js`.
- NPM script `test:e2e` in `C:\Dev\Weather_app\PEVcast\package.json`.

SkyDiff2:
- Unit tests for shared normalization logic in `C:\Dev\Weather_app\SkyDiff2\tests\forecast-core.test.js`.
- NPM script `test` runs `node --test`.
- No Playwright/browser E2E configuration found.

### Versioning

PEVcast:
- Multi-file versioning managed by `C:\Dev\Weather_app\PEVcast\scripts\bump-version.ps1`.
- Tracks separate `html`, `css`, and `js` versions in `index.html`, `styles.css`, `app.js`, `sw.js`, and `version.json`.
- Updates `REVISION_LOG.md` with grouped notes.
- Pre-push validates version metadata.

SkyDiff2:
- SemVer-style version in `C:\Dev\Weather_app\SkyDiff2\package.json`, `shared\forecast-core.js`, and `version.json`.
- Managed by `C:\Dev\Weather_app\SkyDiff2\bump-version.ps1`.
- Pre-commit bumps patch version and stages updated files.
- Pre-push may create an extra `chore: bump version for push` commit and abort the first push.

### Deployment and Publishing

PEVcast:
- PWA manifest uses GitHub Pages subpath assumptions: `C:\Dev\Weather_app\PEVcast\manifest.json` has `start_url` and `scope` set to `/PEVcast/`.
- Static service worker in `C:\Dev\Weather_app\PEVcast\sw.js`.
- Repository remote is `https://github.com/bsacheri/PEVcast.git`.
- No `.github\workflows` folder was found locally.

SkyDiff2:
- PWA manifest `C:\Dev\Weather_app\SkyDiff2\manifest.webmanifest` uses relative `./` paths.
- Service worker is module-based and imports `APP_VERSION` from `shared\forecast-core.js`.
- Repository remote is `https://github.com/bsacheri/SkyDiff2.git`.
- No `.github\workflows` folder was found locally.
- README explicitly says GitHub Pages support still needs investigation because of the local Node API layer.

## C. Missing Features in SkyDiff2

1. Browser-level smoke/E2E tests
- PEVcast file: `C:\Dev\Weather_app\PEVcast\playwright.config.js`
- PEVcast file: `C:\Dev\Weather_app\PEVcast\tests\smoke.spec.js`
- SkyDiff2 has only Node unit tests.
- Why it matters: SkyDiff2 has substantial browser UI state, provider toggles, charts, service-worker registration, and modal behavior that Node tests do not exercise.
- Confidence: High

2. VS Code project workflow
- PEVcast file: `C:\Dev\Weather_app\PEVcast\.vscode\tasks.json`
- PEVcast file: `C:\Dev\Weather_app\PEVcast\.vscode\launch.json`
- PEVcast file: `C:\Dev\Weather_app\PEVcast\.vscode\settings.json`
- SkyDiff2 has no `.vscode` directory.
- Why it matters: PEVcast gives developers one-click version checks, hook installation, and browser launch profiles.
- Confidence: High

3. Structured revision log
- PEVcast file: `C:\Dev\Weather_app\PEVcast\REVISION_LOG.md`
- SkyDiff2 has `ReadMe.md` notes but no comparable release-history artifact.
- Why it matters: SkyDiff2's provider behavior and deployment constraints need a clear change history.
- Confidence: High

4. GitHub Pages subpath-ready manifest convention
- PEVcast file: `C:\Dev\Weather_app\PEVcast\manifest.json`
- SkyDiff2 file to adapt: `C:\Dev\Weather_app\SkyDiff2\manifest.webmanifest`
- Why it matters: PEVcast is configured for `/PEVcast/`; SkyDiff2 currently uses `./`, which is portable but should be verified under `/SkyDiff2/`.
- Confidence: Medium

5. Version consistency check mode
- PEVcast file: `C:\Dev\Weather_app\PEVcast\scripts\bump-version.ps1`
- SkyDiff2 file to adapt: `C:\Dev\Weather_app\SkyDiff2\bump-version.ps1`
- Why it matters: PEVcast can run a check-only pre-push validation. SkyDiff2's pre-push mutates files and creates commits, which is surprising during publishing.
- Confidence: High

6. Icon size variants and screenshots metadata
- PEVcast files: `C:\Dev\Weather_app\PEVcast\icons\icon-192.svg`, `icons\icon-512.svg`
- SkyDiff2 file: `C:\Dev\Weather_app\SkyDiff2\app-icon.svg`
- Why it matters: PWA install surfaces often behave better with explicit 192/512 icons and screenshot metadata.
- Confidence: Medium

7. Static-only deployment compatibility
- PEVcast files: `C:\Dev\Weather_app\PEVcast\index.html`, `app.js`, `sw.js`, `manifest.json`
- SkyDiff2 blocker: `C:\Dev\Weather_app\SkyDiff2\server.js`
- Why it matters: GitHub Pages cannot run `server.js`; SkyDiff2 either needs backend hosting or browser-safe direct provider calls.
- Confidence: High

## Capabilities in SkyDiff2 Not Present in PEVcast

1. Multi-provider forecast comparison
- SkyDiff2 file: `C:\Dev\Weather_app\SkyDiff2\shared\forecast-core.js`
- SkyDiff2 file: `C:\Dev\Weather_app\SkyDiff2\server.js`
- PEVcast mainly consumes one Open-Meteo forecast model in its primary app.
- Confidence: High

2. Local API proxy and provider key isolation
- SkyDiff2 file: `C:\Dev\Weather_app\SkyDiff2\server.js`
- SkyDiff2 files: `C:\Dev\Weather_app\SkyDiff2\config.example.js`, `.env.example`
- PEVcast avoids a backend and therefore cannot safely call key-requiring providers unless keys are public or proxied elsewhere.
- Confidence: High

3. Shared forecast normalization module
- SkyDiff2 file: `C:\Dev\Weather_app\SkyDiff2\shared\forecast-core.js`
- PEVcast keeps most logic in `app.js`.
- Confidence: High

4. Node unit tests for weather normalization
- SkyDiff2 file: `C:\Dev\Weather_app\SkyDiff2\tests\forecast-core.test.js`
- PEVcast has browser smoke tests but no equivalent unit-test suite for transformation logic.
- Confidence: High

5. Vendored chart dependency
- SkyDiff2 file: `C:\Dev\Weather_app\SkyDiff2\vendor\echarts.min.js`
- PEVcast depends largely on CDN chart scripts.
- Confidence: High

6. Nowcast/radar source handling
- SkyDiff2 file: `C:\Dev\Weather_app\SkyDiff2\shared\nowcast-core.js`
- SkyDiff2 file: `C:\Dev\Weather_app\SkyDiff2\server.js`
- PEVcast has precipitation forecast visualization but not the same RainViewer/Rainbow nowcast pipeline.
- Confidence: High

## Responsible Files by Concern

### GitHub Publishing

PEVcast:
- `C:\Dev\Weather_app\PEVcast\.git\config`: GitHub remote and branch tracking.
- `C:\Dev\Weather_app\PEVcast\manifest.json`: GitHub Pages subpath PWA settings.
- `C:\Dev\Weather_app\PEVcast\sw.js`: static app cache behavior.
- No `C:\Dev\Weather_app\PEVcast\.github\workflows` found.

SkyDiff2:
- `C:\Dev\Weather_app\SkyDiff2\.git\config`: GitHub remote and branch tracking.
- `C:\Dev\Weather_app\SkyDiff2\manifest.webmanifest`: current PWA path settings.
- `C:\Dev\Weather_app\SkyDiff2\sw.js`: service-worker caching.
- `C:\Dev\Weather_app\SkyDiff2\server.js`: blocker for pure GitHub Pages deployment.
- No `C:\Dev\Weather_app\SkyDiff2\.github\workflows` found.

### Release and Version Management

PEVcast:
- `C:\Dev\Weather_app\PEVcast\scripts\bump-version.ps1`
- `C:\Dev\Weather_app\PEVcast\scripts\install-git-hooks.ps1`
- `C:\Dev\Weather_app\PEVcast\.githooks\pre-commit`
- `C:\Dev\Weather_app\PEVcast\.githooks\pre-push`
- `C:\Dev\Weather_app\PEVcast\version.json`
- `C:\Dev\Weather_app\PEVcast\REVISION_LOG.md`

SkyDiff2:
- `C:\Dev\Weather_app\SkyDiff2\bump-version.ps1`
- `C:\Dev\Weather_app\SkyDiff2\install-git-hooks.ps1`
- `C:\Dev\Weather_app\SkyDiff2\.githooks\pre-commit`
- `C:\Dev\Weather_app\SkyDiff2\.githooks\pre-push`
- `C:\Dev\Weather_app\SkyDiff2\version.json`
- `C:\Dev\Weather_app\SkyDiff2\shared\forecast-core.js`
- `C:\Dev\Weather_app\SkyDiff2\package.json`

### CI/CD Automation

Neither project has a local `.github\workflows` directory. Automation currently appears to be local Git hooks plus manual `git push`.

### Build Automation

PEVcast:
- No build process.
- `C:\Dev\Weather_app\PEVcast\start_server.bat` starts a static Python server.
- `C:\Dev\Weather_app\PEVcast\playwright.config.js` starts Python server for E2E tests.

SkyDiff2:
- No bundler build.
- `C:\Dev\Weather_app\SkyDiff2\server.js` serves app and APIs.
- `C:\Dev\Weather_app\SkyDiff2\start_server.bat` starts Node server and opens Chrome.
- `C:\Dev\Weather_app\SkyDiff2\package.json` script `start` runs `node server.js`.

### Testing

PEVcast:
- `C:\Dev\Weather_app\PEVcast\package.json`
- `C:\Dev\Weather_app\PEVcast\playwright.config.js`
- `C:\Dev\Weather_app\PEVcast\tests\smoke.spec.js`

SkyDiff2:
- `C:\Dev\Weather_app\SkyDiff2\package.json`
- `C:\Dev\Weather_app\SkyDiff2\tests\forecast-core.test.js`

### Code Quality Checks

No ESLint, Prettier, EditorConfig, TypeScript config, or formatting configuration was found in either project. PEVcast has version consistency checks; SkyDiff2 has version-bump hooks and Node tests.

## D. Recommended Files to Copy or Adapt

1. Adapt PEVcast Playwright setup into SkyDiff2
- Source: `C:\Dev\Weather_app\PEVcast\playwright.config.js`
- Source: `C:\Dev\Weather_app\PEVcast\tests\smoke.spec.js`
- Target: `C:\Dev\Weather_app\SkyDiff2\playwright.config.js`
- Target: `C:\Dev\Weather_app\SkyDiff2\tests\smoke.spec.js`
- Why: SkyDiff2 needs browser coverage for chart rendering, provider toggles, location search, modals, and service-worker registration.
- Confidence: High

2. Adapt VS Code tasks
- Source: `C:\Dev\Weather_app\PEVcast\.vscode\tasks.json`
- Target: `C:\Dev\Weather_app\SkyDiff2\.vscode\tasks.json`
- Why: SkyDiff2 already has `npm run test`, `npm run version:bump`, and hook install scripts; tasks would standardize developer workflow.
- Confidence: High

3. Adapt VS Code launch profiles
- Source: `C:\Dev\Weather_app\PEVcast\.vscode\launch.json`
- Target: `C:\Dev\Weather_app\SkyDiff2\.vscode\launch.json`
- Why: SkyDiff2 should launch against `http://localhost:3000`, not a static file, because of `server.js`.
- Confidence: High

4. Adapt PEVcast pre-push validation behavior
- Source: `C:\Dev\Weather_app\PEVcast\.githooks\pre-push`
- Target: `C:\Dev\Weather_app\SkyDiff2\.githooks\pre-push`
- Why: A pre-push hook that creates a commit and aborts is surprising. A check-only hook is safer for publishing.
- Confidence: Medium

5. Adapt PEVcast revision log convention
- Source: `C:\Dev\Weather_app\PEVcast\REVISION_LOG.md`
- Target: `C:\Dev\Weather_app\SkyDiff2\REVISION_LOG.md`
- Why: SkyDiff2 needs a place to record provider additions, API constraints, deployment changes, and version changes.
- Confidence: High

6. Adapt PEVcast README structure, not content
- Source: `C:\Dev\Weather_app\PEVcast\README.md`
- Target: `C:\Dev\Weather_app\SkyDiff2\ReadMe.md`
- Why: PEVcast documents structure, version automation, VS Code workflow, and version history more completely.
- Confidence: High

7. Adapt icon structure
- Source: `C:\Dev\Weather_app\PEVcast\icons\icon-192.svg`
- Source: `C:\Dev\Weather_app\PEVcast\icons\icon-512.svg`
- Target: `C:\Dev\Weather_app\SkyDiff2\icons\icon-192.svg`
- Target: `C:\Dev\Weather_app\SkyDiff2\icons\icon-512.svg`
- Why: SkyDiff2 has one scalable SVG, but explicit icon paths make PWA manifest testing and platform behavior easier.
- Confidence: Medium

## E. Recommended Configuration Changes

1. Add Playwright to SkyDiff2
- File: `C:\Dev\Weather_app\SkyDiff2\package.json`
- Change: Add `@playwright/test` as a dev dependency and add a script such as `"test:e2e": "playwright test"`.
- Why: This closes the current browser-test gap.
- Confidence: High

2. Keep Node unit tests and add combined test scripts
- File: `C:\Dev\Weather_app\SkyDiff2\package.json`
- Change: Keep `"test": "node --test"` and add `"test:unit": "node --test"`, `"test:e2e": "playwright test"`.
- Why: SkyDiff2 should preserve its stronger domain tests while adding browser coverage.
- Confidence: High

3. Create `.vscode` workflow files for SkyDiff2
- File to create: `C:\Dev\Weather_app\SkyDiff2\.vscode\tasks.json`
- File to create: `C:\Dev\Weather_app\SkyDiff2\.vscode\launch.json`
- File to create: `C:\Dev\Weather_app\SkyDiff2\.vscode\settings.json`
- Why: SkyDiff2 lacks local IDE standardization.
- Confidence: High

4. Change SkyDiff2 pre-push to validate, not mutate
- File: `C:\Dev\Weather_app\SkyDiff2\.githooks\pre-push`
- Why: Publishing should not unexpectedly create commits during push.
- Confidence: Medium

5. Add a version check mode to SkyDiff2 bump script
- File: `C:\Dev\Weather_app\SkyDiff2\bump-version.ps1`
- Why: PEVcast can detect out-of-sync versions without changing files; SkyDiff2 should get the same safety.
- Confidence: High

6. Decide SkyDiff2 deployment target before changing manifest paths
- File: `C:\Dev\Weather_app\SkyDiff2\manifest.webmanifest`
- File: `C:\Dev\Weather_app\SkyDiff2\sw.js`
- File: `C:\Dev\Weather_app\SkyDiff2\app.js`
- Why: GitHub Pages requires static-compatible code, but SkyDiff2 currently depends on `/api/...`.
- Confidence: High

7. Treat local config files as sensitive and review `.gitignore`
- File: `C:\Dev\Weather_app\SkyDiff2\.gitignore`
- File: `C:\Dev\Weather_app\SkyDiff2\config.example.js`
- File: `C:\Dev\Weather_app\SkyDiff2\.env.example`
- Why: Local `config.js` and `config.private.js` contain provider credentials locally. The report intentionally does not reproduce them.
- Confidence: High

8. Add code quality tooling deliberately
- File to create: `C:\Dev\Weather_app\SkyDiff2\.editorconfig`
- File to create: `C:\Dev\Weather_app\SkyDiff2\eslint.config.js` or equivalent
- Why: Neither project has lint/format config; SkyDiff2's module structure would benefit from automated import and syntax checks.
- Confidence: Medium

## F. Potential Risks of Copying Directly

1. PEVcast static-hosting assumptions do not fit SkyDiff2's server-backed architecture
- Risk paths: `C:\Dev\Weather_app\PEVcast\manifest.json`, `C:\Dev\Weather_app\PEVcast\sw.js`
- SkyDiff2 paths: `C:\Dev\Weather_app\SkyDiff2\server.js`, `C:\Dev\Weather_app\SkyDiff2\app.js`
- Why: SkyDiff2 calls `/api/...`; GitHub Pages cannot serve those endpoints.
- Confidence: High

2. Versioning models are incompatible
- PEVcast path: `C:\Dev\Weather_app\PEVcast\scripts\bump-version.ps1`
- SkyDiff2 path: `C:\Dev\Weather_app\SkyDiff2\bump-version.ps1`
- Why: PEVcast uses separate HTML/CSS/JS version buckets; SkyDiff2 uses package/app SemVer.
- Confidence: High

3. Hook behavior could disrupt publishing
- PEVcast path: `C:\Dev\Weather_app\PEVcast\.githooks\pre-push`
- SkyDiff2 path: `C:\Dev\Weather_app\SkyDiff2\.githooks\pre-push`
- Why: Directly swapping hooks without adapting script arguments would break or change version behavior.
- Confidence: High

4. Service worker scope/path mistakes could brick cached app versions
- PEVcast path: `C:\Dev\Weather_app\PEVcast\sw.js`
- SkyDiff2 path: `C:\Dev\Weather_app\SkyDiff2\sw.js`
- Why: Cache names, import mode, relative paths, and `/api/` handling differ.
- Confidence: High

5. API keys must not be copied or exposed
- SkyDiff2 path: `C:\Dev\Weather_app\SkyDiff2\config.js`
- SkyDiff2 path: `C:\Dev\Weather_app\SkyDiff2\config.private.js`
- Why: These are local ignored files and include sensitive provider configuration.
- Confidence: High

6. Test infrastructure targets different runtimes
- PEVcast path: `C:\Dev\Weather_app\PEVcast\playwright.config.js`
- SkyDiff2 path: `C:\Dev\Weather_app\SkyDiff2\server.js`
- Why: SkyDiff2 Playwright should start `npm run start` on port 3000, not Python static hosting.
- Confidence: High

## G. Suggested Migration Plan

1. Clean local generated artifacts
- Path: `C:\Dev\Weather_app\PEVcast\test-results\.last-run.json`
- Why: It is currently staged in PEVcast and should not be part of the architecture migration.
- Confidence: High

2. Decide SkyDiff2 deployment model
- Paths: `C:\Dev\Weather_app\SkyDiff2\server.js`, `app.js`, `manifest.webmanifest`, `sw.js`
- Options: backend-hosted app, static GitHub Pages app with provider limitations, or hybrid app plus external API proxy.
- Why: This decision drives all publishing, manifest, and service worker changes.
- Confidence: High

3. Add SkyDiff2 browser smoke tests
- Paths to create: `C:\Dev\Weather_app\SkyDiff2\playwright.config.js`, `tests\smoke.spec.js`
- Why: Browser behavior is currently untested.
- Confidence: High

4. Add VS Code workflow files
- Paths to create: `C:\Dev\Weather_app\SkyDiff2\.vscode\tasks.json`, `launch.json`, `settings.json`
- Why: Standardizes local development and makes testing/versioning discoverable.
- Confidence: High

5. Refactor SkyDiff2 version hooks to check before push
- Paths: `C:\Dev\Weather_app\SkyDiff2\.githooks\pre-push`, `bump-version.ps1`
- Why: Avoids surprise commits during publishing.
- Confidence: Medium

6. Add structured release notes
- Path to create: `C:\Dev\Weather_app\SkyDiff2\REVISION_LOG.md`
- Why: Gives provider/deployment changes an auditable home.
- Confidence: High

7. Add code quality tooling
- Paths to create: `C:\Dev\Weather_app\SkyDiff2\.editorconfig`, optional `eslint.config.js`
- Why: ES modules and provider adapters need automated hygiene.
- Confidence: Medium

8. Review secrets
- Paths: `C:\Dev\Weather_app\SkyDiff2\.gitignore`, `.env.example`, `config.example.js`, `config.js`, `config.private.js`
- Why: Ensure real keys stay ignored and examples stay sanitized.
- Confidence: High

## How to Make SkyDiff2 Match PEVcast

1. Do not copy PEVcast app code into SkyDiff2.
- Modify: none initially.
- Why: SkyDiff2's provider-comparison architecture is materially different and valuable.
- Confidence: High

2. Create browser test infrastructure in SkyDiff2.
- Copy/adapt from: `C:\Dev\Weather_app\PEVcast\playwright.config.js`
- Create: `C:\Dev\Weather_app\SkyDiff2\playwright.config.js`
- Modify: `C:\Dev\Weather_app\SkyDiff2\package.json`
- Manual review: Use `npm run start` / `node server.js` on port 3000, not Python static server.
- Confidence: High

3. Create SkyDiff2 browser smoke tests.
- Copy/adapt from: `C:\Dev\Weather_app\PEVcast\tests\smoke.spec.js`
- Create: `C:\Dev\Weather_app\SkyDiff2\tests\smoke.spec.js`
- Manual review: Replace PEVcast selectors with SkyDiff2 selectors such as `#provider-toggles`, `#combined-chart`, `#version-label`, nowcast charts, and provider cards.
- Confidence: High

4. Add VS Code workflow files.
- Copy/adapt from: `C:\Dev\Weather_app\PEVcast\.vscode\tasks.json`
- Copy/adapt from: `C:\Dev\Weather_app\PEVcast\.vscode\launch.json`
- Create: `C:\Dev\Weather_app\SkyDiff2\.vscode\tasks.json`
- Create: `C:\Dev\Weather_app\SkyDiff2\.vscode\launch.json`
- Create: `C:\Dev\Weather_app\SkyDiff2\.vscode\settings.json`
- Manual review: Task labels should say `SkyDiff2`; launch URL should be `http://localhost:3000`.
- Confidence: High

5. Add release log.
- Copy/adapt from: `C:\Dev\Weather_app\PEVcast\REVISION_LOG.md`
- Create: `C:\Dev\Weather_app\SkyDiff2\REVISION_LOG.md`
- Manual review: Start with SkyDiff2's existing history from `ReadMe.md`; do not import PEVcast release entries.
- Confidence: High

6. Improve SkyDiff2 version validation.
- Adapt from: `C:\Dev\Weather_app\PEVcast\scripts\bump-version.ps1`
- Modify: `C:\Dev\Weather_app\SkyDiff2\bump-version.ps1`
- Modify: `C:\Dev\Weather_app\SkyDiff2\.githooks\pre-push`
- Manual review: Preserve SemVer in `package.json`, `shared\forecast-core.js`, and `version.json`; add check-only mode rather than PEVcast's separate HTML/CSS/JS buckets.
- Confidence: Medium

7. Improve PWA icon/manifest hygiene.
- Copy/adapt from: `C:\Dev\Weather_app\PEVcast\icons\icon-192.svg`
- Copy/adapt from: `C:\Dev\Weather_app\PEVcast\icons\icon-512.svg`
- Create: `C:\Dev\Weather_app\SkyDiff2\icons\icon-192.svg`
- Create: `C:\Dev\Weather_app\SkyDiff2\icons\icon-512.svg`
- Modify: `C:\Dev\Weather_app\SkyDiff2\manifest.webmanifest`
- Manual review: Preserve SkyDiff2 branding; verify `/SkyDiff2/` path behavior if using GitHub Pages.
- Confidence: Medium

8. Decide and implement GitHub Pages strategy.
- Modify if static: `C:\Dev\Weather_app\SkyDiff2\app.js`, `sw.js`, `manifest.webmanifest`, possibly `server.js`
- Create if automated: `C:\Dev\Weather_app\SkyDiff2\.github\workflows\pages.yml`
- Manual review: Any provider requiring secret keys must not be called directly from browser code with private credentials.
- Confidence: High

9. Add code quality configuration.
- Create: `C:\Dev\Weather_app\SkyDiff2\.editorconfig`
- Create optional: `C:\Dev\Weather_app\SkyDiff2\eslint.config.js`
- Modify: `C:\Dev\Weather_app\SkyDiff2\package.json`
- Manual review: Pick rules that match existing style instead of forcing a broad rewrite.
- Confidence: Medium

10. Run validation.
- PEVcast command: `npm run test:e2e`
- SkyDiff2 current command: `npm test`
- SkyDiff2 future command: `npm run test:e2e`
- Manual review: Confirm service worker, manifest installability, and provider behavior in a browser with a clean cache.
- Confidence: High
