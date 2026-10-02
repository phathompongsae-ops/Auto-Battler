# Auto-Battler RPG

A 2D web RPG built with **Phaser 4 + TypeScript + Vite**.

> Rebuild in progress (branch `phaser-rebuild`). The previous Auto-Battler / Realmfront
> project lives in [`legacy/`](legacy/) and is preserved at the git tag
> `auto-battler-legacy-final`.

## Requirements

- Node.js 20.19+ or 22.12+ (developed on Node 24)
- npm

## Scripts

```bash
npm install       # install dependencies
npm run dev       # start dev server at http://localhost:5173/
npm run build     # type-check and build to dist/
npm run preview   # serve the production build locally
npm run typecheck # type-check only
```

## Structure

```
index.html            Vite entry HTML
src/main.ts           Phaser game config
src/scenes/           Phaser scenes
public/               Static files copied as-is into the build
legacy/               Previous Auto-Battler project (reference only)
```

## Deployment

`vite.config.ts` uses a relative `base` (`./`), so `dist/` can be served from
the GitHub Pages project path. The Pages workflows in `.github/workflows/`
still target the legacy site and will be updated in a later step.
