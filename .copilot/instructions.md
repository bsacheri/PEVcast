# Copilot Instructions for This Project

## Code Generation Rule
- Do NOT generate code or code suggestions
- Only discuss problems, ask clarifying questions, and provide analysis
- Wait for the explicit trigger: **"go;"** before generating any code

## When "go;" is used:
- Generate ALL discussed changes as complete code
- Provide full file implementations
- Include all modifications we've discussed

## Version Management - CRITICAL

**Whenever making changes to be committed and pushed to git, ALWAYS update version information across all files:**

### Files to Update:
1. **app.js** (line ~14): `window.APP_VERSION = 'X.X.XX'` — increment the patch version
2. **app.js** (line ~16): `const CODE_UPDATED = 'MM/DD/YYYY H:MM AM/PM'` — set to the actual date and time of the git push
3. **version.json**: Update `"version"`, `"js"`, and `"timestamp"` fields
4. **index.html** (line ~34): Update `FILE_VERSIONS` object with `html`, `css`, `js` versions

### Important: CODE_UPDATED is a hardcoded date and time
- `CODE_UPDATED` must be set to the **actual date and time of the git push** (e.g., `'03/27/2026 1:43 PM'`)
- It is NOT dynamically generated at runtime — it is a static string you set manually
- Run `Get-Date -Format "MM/dd/yyyy h:mm tt"` in the terminal to get the current time just before pushing
- Update it on every commit, just like the version number
- The footer span `#lastUpdated` and the About dialog both display this value

### Version Numbering Scheme:
- Format: `X.X.XX` (e.g., 7.12.30)
- Patch version (last two digits) increments for bug fixes and small improvements
- Minor version (middle digit) increments for feature additions
- Major version (first digit) increments for significant changes

### Example Commit Flow:
1. Make code changes to app.js, styles.css, index.html, etc.
2. Update `window.APP_VERSION` in app.js to new patch version
3. Run `Get-Date -Format "MM/dd/yyyy h:mm tt"` to get current time
4. Update `CODE_UPDATED` in app.js to that exact date and time
5. Update the fallback text of `#lastUpdated` span in index.html to match
6. Update `version.json` with matching version and today's date/time
7. Update `FILE_VERSIONS` in index.html with component versions
8. Commit with message describing changes
9. Push to origin/master

### Verification:
After commit, both of these will show the same hardcoded publish date/time:
- Footer `#lastUpdated` span (populated by app.js on load from `CODE_UPDATED`)
- About dialog "Code Updated" line (uses `CODE_UPDATED` directly)