# Merge Hold

Do not merge this documentation branch while CC is still actively editing an uncommitted loader fix.

Safe sequence:
1. CC reports branch, HEAD, and working-tree status.
2. CC finishes and commits the loader task.
3. Review this documentation-only PR for file scope.
4. Merge the documentation PR.
5. CC syncs the latest `main` before accepting the next task.

This hold protects against stale-base confusion; the documentation files themselves do not overlap `src/game.js`.
