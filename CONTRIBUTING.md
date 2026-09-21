# Contributing: Pair Workflow

## Golden rule

**Never commit or push directly to `main`.** `main` is always demoable. All work happens on short-lived feature branches + PRs.

Protect `main` on GitHub (done): Settings → Branches → add rule for `main` → check "Require a pull request before merging."

## Setup (once, both devs)

```bash
git clone <your-repo-url>
cd betterblinds-fuzzy-simulator
git checkout main
git pull origin main
```

## Per-task loop

**1. Start fresh from `main`:**

```bash
git checkout main
git pull origin main
```

**2. Claim the task** in the tracking table (`IMPLEMENTATION_PLAN.md` §5.4) — mark it `in-progress` with your name. Only one person `in-progress` per row.

**3. Create your branch** — one branch per task:

```bash
git checkout -b <backend|frontend>/<what>-<taskID>-<yourname>
# e.g. git checkout -b backend/membership-P2-1-arth
# e.g. git checkout -b frontend/scene-P4-1-pairname
```

**4. Work in small commits:**

```bash
git add backend/fuzzy/membership.py
git commit -m "feat: add triangular/trapezoidal MFs + fuzzify_light"
```

Keep PRs under ~300 lines. One task = one branch = one PR.

**5. Rebase before pushing** (keeps conflicts tiny):

```bash
git pull --rebase origin main
git push -u origin <your-branch-name>
```

**6. Open a PR.** The template (`.github/pull_request_template.md`) auto-fills the checklist, and `CODEOWNERS` auto-tags both of us. The *other* person reviews and approves; the author merges (squash), then both run:

```bash
git checkout main
git pull origin main
```

## If GitHub reports conflicts

Don't fix code in the web editor. Locally:

```bash
git checkout <your-branch>
git pull --rebase origin main
# fix the <<<<<<< marked sections, then:
git add <fixed-files>
git rebase --continue
git push --force-with-lease
```

Then re-run checks: backend `pytest`, frontend `npm run build`.

## Contract rule (the one hard rule)

`backend/fuzzy/config.py` and `frontend/src/types.ts` are one contract. If you change one, update the other **in the same PR** and get your pair's approval before merging.

## Oops recovery

- Committed on `main` by accident? Don't push. Run `git checkout -b <new-branch-name>` immediately. The commit moves with you. Then `git checkout main && git reset --hard origin/main`.
- Pushed something bad to your *feature* branch? Fix it with a new commit and push again. Never rewrite `main`'s history.
