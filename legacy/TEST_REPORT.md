# Realmfront Test Report

Current milestone: Pixel Web Alpha complete.

## Automated Logic Coverage

The test suite covers:
- initial playable/serializable state
- building cost scaling and upgrades
- recruitment and population cap
- expedition victory progression
- expedition defeat recovery
- Season War timing gate
- territory capture
- recoverable Season War defeat
- capital unlock requirements
- three-territory capital lock
- version-2 save migration
- both-capital Campaign Victory
- Town Hall region progression
- deterministic balanced 8-war route to Victory
- calendar blocking while a Season War is pending

## Browser / Visual QA

GitHub Actions captures:
- settlement desktop
- settlement mobile
- battle desktop
- battle mobile
- expedition desktop
- expedition mobile
- Season War desktop
- Season War mobile
- Army mobile

Checks include JavaScript syntax, game logic tests, page rendering, responsive layout, asset loading, and deploy success.

## Acceptance State

- Pixel visual direction is consistent across settlement, Army, Battle, Expedition, and War screens.
- Human / Arcane / Demon remain visually distinct.
- No new complex combat systems were introduced.
- Campaign progression remains recoverable after losses.
- A deliberate progression route reaches Victory in 8 Season Wars without softlock.
