# Boss Encounter Policy

Status: approved design decision for the current 3-map campaign.

## Per-map structure

Each map contains three boss checkpoints:

- Stage 5: miniboss encounter
- Stage 10: miniboss encounter
- Stage 15: fixed map boss

## Miniboss selection

Each map defines exactly two miniboss candidates.

At the start of a run, the runtime must produce a non-repeating order for those two candidates:

- Stage 5 receives one randomly selected candidate.
- Stage 10 receives the remaining candidate.
- The same miniboss must not appear at both stage 5 and stage 10 in the same run.

Equivalent implementation rule:

1. Copy the map's two-item miniboss pool.
2. Shuffle once per run using the run's authoritative random source.
3. Assign index 0 to stage 5 and index 1 to stage 10.
4. Persist the resolved order in run state so retry/load does not reroll it unexpectedly.

## Final boss

Stage 15 uses one fixed boss assigned to that map. It is not selected from the miniboss pool and is never randomized.

## Campaign totals

Across three maps, the intended content count is:

- 6 miniboss definitions: 2 per map
- 3 fixed final-boss definitions: 1 per map
- 9 boss-type definitions total

## Data-contract requirement

A complete map must eventually provide:

- `minibossPool`: exactly two unique monster IDs with `kind: "miniboss"`
- `finalBossId`: exactly one monster ID with `kind: "boss"`
- `minibossSelectionPolicy`: `"shuffle_without_replacement"`

The current PR remains documentation-first. Runtime integration belongs in a separate small CC task and must not be mixed with combat balance changes.
