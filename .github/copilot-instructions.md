# PEVcast Copilot Instructions

## Revision Log (`REVISION_LOG.md`)

- Entries are in reverse-chronological order (newest first), each starting with `## <version> - <date>`.
- **Do not overwrite or remove manually written entries.** The bump-version script no longer auto-generates content.
- **Version-sync commits** (no user-facing changes, only metadata/version bumps) must be recorded with a single entry:
  ```
  ## <version> - <date>

  ### Versioning
  - Version-sync commit only. No user-facing changes. Bumped app, JS, HTML, CSS, and service-worker cache metadata.
  ```
- Feature/fix entries should use concise, plain-language bullet points grouped under relevant `###` headings (e.g. `Chart`, `Menu and Dialogs`, `Versioning`).
- Do **not** add boilerplate placeholder text (e.g. "Updated application behavior in app.js"). Only include real, specific changes.
