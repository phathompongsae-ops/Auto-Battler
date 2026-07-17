# Implementation Order

## Active task
1. CC completes Asset Loader Failure Handling.

## Next blockers
2. Fix melee units crossing, swapping, or oscillating instead of engaging.
3. Lock camera and stage framing.
4. Lock board edge depth and stage silhouette.
5. Lock bench platform, divider, lower HUD spacing, and responsive hit areas.

## Production proof
6. Validate the asset and animation pipeline with three real assets:
   - One Class 1 hero
   - One normal monster
   - One stage-5 boss

## Expansion
7. Expand character and monster production only after the layout and three-asset proof are stable.
8. Build the remaining main-map content through all three maps and 45 stages.

## Deferred until late phase
9. Survival Mode.
10. Three-star hero system.

This order is a planning lock, not permission for multiple agents to implement adjacent core systems concurrently. Follow `AGENT_HANDOFF.md` for ownership and integration.
