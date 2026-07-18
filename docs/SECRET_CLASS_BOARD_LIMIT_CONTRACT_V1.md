# Secret Class Board Limit Contract v1

## Decision

A player team may deploy **at most one Secret Class unit on the board at a time**, counted across every Secret Class.

This is a shared category limit, not a Ninja-only rule.

Examples:

- Ninja + Ninja on the board: blocked.
- Ninja + Black Dragon Knight on the board: blocked.
- Ninja + Sword Saint on the board: blocked.
- One Secret Class on the board plus any number of normal heroes: allowed, subject to the normal team-size limit.

## Bench, purchase, and fusion

Reaching the board limit does not prevent the player from:

- purchasing another Secret Class;
- keeping Secret Class copies on the Bench;
- purchasing duplicate copies for fusion;
- combining three eligible copies into one 2-star unit under the existing Demo 1 fusion rules.

Demo 1 does not add a 3-star Secret Class system.

## Placement rejection

When a player attempts to move an additional Secret Class onto the board while one is already deployed, Runtime must:

1. Reject the placement before mutating board state.
2. Leave the attempted unit in its original Bench or board position.
3. Leave gold, inventory, stars, HP, mana, and equipment unchanged.
4. Display a localized warning.
5. Permit placement after the currently deployed Secret Class has left the board.

Enemy units, monsters, minibosses, and bosses never count against this player-team limit.

## Message contract

Generic category conflict:

- Key: `ui.secret_class.board_limit.generic`
- Thai: `ลงสนามได้เพียง 1 Secret Class ต่อทีม` / `นำตัวลับที่อยู่บนสนามออกก่อน จึงจะวางตัวนี้ได้`
- English: `Only 1 Secret Class can be deployed per team.` / `Remove the deployed Secret Class before placing this unit.`

Duplicate Secret Class conflict:

- Key: `ui.secret_class.board_limit.duplicate`
- Thai: `มี Secret Class ประเภทนี้อยู่บนสนามแล้ว` / `เก็บตัวนี้ไว้บน Bench เพื่อรวมดาวได้`
- English: `This Secret Class is already deployed.` / `Keep this copy on the Bench for fusion.`

Runtime may use the generic message for every conflict in v1. The duplicate-specific message is optional presentation refinement and must not create separate gameplay rules.

## Runtime ownership

CC owns the implementation in placement Runtime, including the `moveUnitTo` path and user feedback wiring.

Coco-owned files in this contract contain policy, localization, and acceptance criteria only. They must not be treated as a second placement implementation.

The Runtime check must identify Secret Classes using canonical metadata or a shared helper. It must not hard-code only the string `ninja`, because Black Dragon Knight, Sword Saint, and future Secret Classes share the same limit.

## Acceptance criteria for CC

1. The first player Secret Class can move from Bench to a valid board tile.
2. A second copy of the same Secret Class is rejected.
3. A different Secret Class is rejected while the first remains deployed.
4. Rejected placement preserves the attempted unit's original location and all state.
5. Normal heroes can still be deployed normally.
6. Buying Secret Classes while the board limit is reached remains allowed.
7. Bench copies can still combine into a 2-star Secret Class.
8. A 2-star Secret Class counts as one deployed unit.
9. Moving the deployed Secret Class back to Bench permits another Secret Class to be deployed.
10. Enemy Secret Classes or bosses do not count toward the player limit.
11. The warning blocks underlying board/shop interaction only for the existing notification duration or modal behavior.
12. No NaN, duplicate unit, lost unit, gold mutation, or placement-state corruption occurs.
13. The implementation remains generic for future Secret Classes.

## Focused test set

Use the smallest viable Runtime test set:

- Deploy first Ninja: success.
- Attempt second Ninja: reject and preserve Bench state.
- Remove first Ninja, then deploy second: success.
- Simulate a second canonical Secret Class identity: reject while Ninja is deployed.
- Buy and fuse three Ninja copies while one Secret Class is already deployed: purchase and fusion remain valid.
- Confirm normal hero placement remains unchanged.

Combat testing is only necessary if placement changes touch battle preparation state. When combat regression testing is required, run the directly relevant scenario at speed x4.

## Out of scope

- Secret Class balance changes.
- Ninja stat changes.
- Shop probability changes.
- Permanent unlock changes.
- New fusion tiers.
- Runtime implementation in this Coco branch.
- Camera, board, Bench, HUD, or shop redesign.
