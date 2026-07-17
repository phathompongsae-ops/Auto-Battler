# Effect / Projectile Review Checklist

## Scope

- [ ] Only presentation-layer modules and docs changed
- [ ] No `src/game.js` or `autochess.html` modifications
- [ ] No Shop Drawer, combat, targeting, movement, camera, balance, or game-loop changes

## EffectManager

- [ ] Duplicate IDs rejected
- [ ] Unknown IDs fail clearly
- [ ] One-shot effects expire
- [ ] Looping effects require explicit stop
- [ ] Owner cleanup works
- [ ] Pool sizes respect `maxPool`
- [ ] `dispose()` destroys pooled views
- [ ] Active count returns to zero after wave cleanup

## ProjectilePresenter

- [ ] Requires start/end positions
- [ ] Straight and arcing paths update deterministically from delta time
- [ ] Homing target provider is presentation-only
- [ ] Lifetime prevents stuck projectiles
- [ ] Owner cleanup works
- [ ] Arrival never applies damage or status
- [ ] Pool sizes stay bounded

## Integration gate

- [ ] Start with one Class 1 hero, one normal monster, one stage-5 boss
- [ ] Use the smallest adapter possible
- [ ] Record modules/files used
- [ ] Test 3–5 targeted combat waves at x4
- [ ] Confirm no duplicate hit/damage from animation or projectile events
- [ ] Compare snapshots before combat, after combat, and after cleanup
- [ ] Verify real Android separately from headless SwiftShader
