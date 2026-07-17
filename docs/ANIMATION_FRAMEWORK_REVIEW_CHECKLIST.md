# Animation Framework Review Checklist

## Standalone review

- [ ] `src/animation-controller.js` is not imported by live runtime files.
- [ ] No change exists in `src/game.js`.
- [ ] No change exists in `autochess.html`.
- [ ] No Shop Drawer selector or function is touched.
- [ ] Every definition requires `idle`.
- [ ] Duplicate definition IDs throw clearly.
- [ ] Empty/negative frame indices are rejected.
- [ ] Zero/negative FPS and time scale are rejected.
- [ ] One-shot clips stop on the final frame.
- [ ] Locked clips reject interruption unless forced.
- [ ] `next` transitions are explicit and deterministic.
- [ ] Facing output does not mutate Three.js objects directly.

## Runtime integration gate

Do not begin until the active CC runtime task is complete and latest `main` is synced.

- [ ] Integrate only one hero, one normal monster, and one stage-5 boss first.
- [ ] Keep combat outcome authoritative.
- [ ] Do not calculate damage inside animation callbacks.
- [ ] Confirm attack/cast events fire once per playback.
- [ ] Confirm repeated `play()` calls do not restart the same clip accidentally.
- [ ] Confirm death cannot transition back to idle.
- [ ] Confirm missing optional clips fall back safely.
- [ ] Confirm controller references are removed with disposed unit visuals.
- [ ] Run 3–5 targeted combat waves at speed x4.
- [ ] Record files/modules used and test evidence.
- [ ] Run `git diff --check` before commit.
