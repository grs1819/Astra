# Stillwater release workflow

- Live: https://grs1819.github.io/Stillwater/
- Beta: https://grs1819.github.io/Stillwater/beta/
- The user requires beta-first publication. "Publish" means publish to beta unless they explicitly approve promotion to live.
- Root game files on main are the approved live release. Never change them while publishing a beta.
- Develop game changes on the beta branch (use a separate worktree if needed). Root files on that branch are the editable game source. Do not edit generated beta/ files manually.
- After checking changes, commit and push the beta branch. In a clean main checkout, run `node scripts/stage-beta.mjs <beta-source-commit>` and commit only beta/ plus any intentionally updated release tooling/docs. Push main to publish the /beta/ snapshot, leaving live files byte-identical.
- Save isolation is applied by the staging script. The beta site must never read or write live mosswood-v1/v2 storage keys.
- Only after explicit user approval, promote the exact sourceCommit recorded in beta/release.json into the root live game files. Do not promote untested later changes. Preserve beta/ and release tooling. Validate and push main.
- Keep release.json accurate so reports can identify the tested source. Do not add game behavior differences between beta and live except isolated storage.
