# Project Status: Auto-Battler (Three.js 2.5D)
**Last Updated:** 2026-07-15

## Roadmap & Priorities
1. **Stabilize 15-stage run:** Full test flow (1-15), error checking, and regression testing. — ✅ done
   (see `Gemini.md`: weapon-atlas 404 + favicon 404 fixed, clean Playwright run through wave 15)
   - Sub-task: boss-ID pick scaffold for stage 5/10/15 — ✅ done (placeholder only, no stats/sprite yet;
     see `Gemini.md`)
2. **Remove runtime regex patch:** Convert Combat Next into a modular system.
3. **Hero Merge / Star Upgrade:** Implement unique ID, star levels, and 3-copy merge logic.
4. **Equipment Core:** Implement inventory, 2 slots per hero, and stat modifier pipeline.
5. **Equipment Merge and Shop:** Implement popup shop (3 items), merge logic, and drop-rate tables.
6. **Skill / Mana / Status Effects:** Implement combat mechanics (Mana gain, targeting, status effects).
7. **Modularization:** Move data/configs to external files (JSON/.js) to improve performance and code maintainability.
