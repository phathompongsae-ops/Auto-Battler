# GitHub Pages Per-PR Preview

Two workflows share one `gh-pages` branch:

- `.github/workflows/pages.yml` — production, triggered on push to `main`. Publishes the built
  site to the **root** of `gh-pages` (`keep_files: true`, so it never touches any `pr-preview/**`
  directory already committed there).
- `.github/workflows/pages-preview.yml` — PR previews, triggered on `pull_request`
  (opened/reopened/synchronize/closed). Publishes/updates the PR's build under
  `pr-preview/pr-<number>/` on the same `gh-pages` branch, and removes exactly that directory
  when the PR closes.

Both workflows use the `gh-pages-deploy` concurrency group so a production push and a preview
update can never race on the same branch.

## URL format

- Production: `https://phathompongsae-ops.github.io/Auto-Battler/`
- Preview: `https://phathompongsae-ops.github.io/Auto-Battler/pr-preview/pr-<number>/`

## Restriction: same-repository PRs only

The preview job only runs when `github.event.pull_request.head.repo.full_name` matches this
repository. A pull request from a fork is skipped entirely — it gets no preview. This is a
deliberate, documented restriction: previews need a write-capable `GITHUB_TOKEN` (to push
`gh-pages` and post the preview-URL comment), and granting that to arbitrary fork code would be
unsafe. Same-repository branch PRs (the only kind this repository currently uses) are
unaffected.

## Required one-time manual step

This repository's Pages source must be switched, once, from **"GitHub Actions"** to **"Deploy
from a branch"** (branch `gh-pages`, folder `/ (root)`) under Settings → Pages. The previous
mechanism (`actions/upload-pages-artifact` + `actions/deploy-pages`) atomically replaces the
entire live deployment on every run, so it cannot coexist with an isolated, independently
updated preview subpath — only a persistent branch can be added to/removed from incrementally.

Until that switch is made:

- Production continues being served exactly as before (this change alone does not break or
  replace the current live site).
- `pages.yml` safely pushes to `gh-pages`, but the live Pages site keeps serving the old
  Actions-based deployment until the source switch happens.
- No PR preview URL will be reachable.

After the switch:

- The next push to `main` (or manual `workflow_dispatch` of `pages.yml`) publishes production
  from `gh-pages` root.
- The next `pull_request` event on an eligible PR publishes/updates its preview.
