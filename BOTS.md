# AI Agent Workflow

This file is the standing instruction set for any AI code editor or coding agent working in this project.

The user, William, has final authority over what becomes part of the shipped app. Agents may inspect, propose, edit on the working branch, commit, back up, run tests, and update the work log.

## Git Rules Come From RULES.md

The git rules for backup, branches, and shipping are in `C:\Code\The Librarian\RULES.md`. They apply to every agent in every project. When this file or a repo-specific file conflicts with `RULES.md`, `RULES.md` wins. Dewey (`C:\Code\The Librarian\dewey\AGENTS.md`) enforces them.

Summary (read `RULES.md` for the full rules and terms):

| Branch | Meaning |
| --- | --- |
| `main` | Always equal to the shipped version (the live app, or the last shipped release). |
| `working` | The one branch where all changes are made. |
| `working-<agent>` | Only when a second agent works in the same project at the same time, in its own folder `<project>-<agent>`. |

- Make all changes on `working`. Never make changes directly on `main`.
- Do not open other branches unless William tells you to. Do not use prefixes such as `feature/` or `fix/`, a `Review` branch, or `-active` / `-review` folders.
- Back up (commit and push `working` to GitHub) at least every 15 minutes while you work, and at the end of the session. Unfinished work is permitted in a backup; use commit type `wip`.
- Changes go into `main` only when William says "ship it", "push everything", or "publish".
- Before you work in a project, check and write the agent claim (`RULES.md` G2.5).
- Do not rebase or rewrite history on `main` or `working`. Use merge commits.

## Splitting Large Briefs

When a brief contains several kinds of work, keep them on `working`, but split them into separate commits by purpose and risk. This keeps each change easy to review and to revert. Common splits:

| Work Type | Separate Commit? | Reason |
| --- | --- | --- |
| UI-only work | Yes | Easy to review visually and revert independently. |
| Backend behavior | Yes | Higher chance of logic bugs or data issues. |
| Database or schema changes | Yes | Needs special review and rollback thinking. |
| External integrations | Yes | API keys, auth, rate limits, and sync behavior add risk. |
| Tests | Sometimes | May travel with the feature, but large test infrastructure can stand alone. |
| Refactors | Yes | Should not be hidden inside feature commits unless required. |
| Docs | Usually yes | Keeps planning and implementation history clean. |

## Commit Rules

Commit completed work after reasonable verification. Commit unfinished work as `wip` when the 15-minute backup rule requires it. Say clearly in the message what is unfinished.

Commit messages should be detailed enough that William can understand the purpose from history without reading every diff.

Use this format:

```text
<type>(<area>): <specific summary>

Why:
- <reason this change exists>

What changed:
- <concrete change 1>
- <concrete change 2>

Verification:
- <command or manual check>
- <known gap if not fully verified>
```

Valid commit types:

| Type | Meaning |
| --- | --- |
| `feat` | Adds behavior or capability. |
| `fix` | Fixes a bug. |
| `ui` | Changes interface or visual behavior. |
| `docs` | Changes documentation or planning artifacts. |
| `test` | Adds or repairs tests. |
| `refactor` | Restructures code without intended behavior change. |
| `chore` | Tooling, config, dependency, or maintenance work. |
| `wip` | Unfinished checkpoint, for example a 15-minute backup. |
| `release` | The merge of `working` into `main` when William ships. |

Example:

```text
feat(sync): add Gmail newsletter ingestion scaffold

Why:
- MANIFEST needs newsletters to enter the same queue as RSS articles.

What changed:
- Added OAuth-backed Gmail sync service shell.
- Normalized newsletter messages into the shared article model.
- Added source metadata for Gmail labels and message IDs.

Verification:
- npm test
- Manual OAuth flow not verified yet because credentials are not configured.
```

## Versioning Rules

This project uses numeric release versions such as `0.1.0`, `0.1.12`, or `1.5.12`.

Default rule:

- Every ship (merge of `working` into `main`) bumps the last digit by one.
- Example: `0.1.0` becomes `0.1.1`.
- Multi-digit numbers are normal. `0.1.9` becomes `0.1.10`.

William may override the default and instruct a larger bump:

| Bump | When William May Choose It | Example |
| --- | --- | --- |
| Patch / last digit | Normal ship. | `0.1.7` -> `0.1.8` |
| Minor / middle digit | Meaningful feature set, workflow change, or release milestone. | `0.1.7` -> `0.2.0` |
| Major / first digit | Major architecture change, public release, or breaking shift. | `0.9.4` -> `1.0.0` |

Agents should default to patch bumps. If a set of changes looks larger than a patch, the agent should recommend a minor or major bump, but William decides.

When version files exist, update them as part of the ship. If no version file exists, add the version note to release notes or `BRANCHES.md` until William chooses a canonical version location.

## Test And Verification Gate

Agents should choose the best available verification for the repo. If the project lacks formal tests, agents should say that directly and perform practical checks instead.

Default verification ladder:

| Level | Check | Use When |
| --- | --- | --- |
| 1 | `git status --short --branch` | Always before and after work. |
| 2 | Formatting or lint command | When the repo has one. |
| 3 | Unit tests | When the repo has tests. |
| 4 | Build or typecheck | For apps, packages, and typed projects. |
| 5 | Smoke test | When the app can be launched or a key flow can be manually checked. |
| 6 | Summary for William | Always before William ships. |

Agents should inspect the repo to identify the real commands instead of inventing commands. Common examples include `npm test`, `npm run lint`, `npm run build`, `pytest`, `ruff check`, `cargo test`, `go test ./...`, or project-specific scripts.

Before work is considered ready to ship, report:

- Summary of changes on `working`.
- Files changed.
- Commands run.
- Test results.
- Known limitations.
- Whether you recommend shipping it.

## When Tests Fail

If tests fail, the agent should keep working while the failure appears understandable and fixable. The agent should stop and report when:

- The same class of fix has failed repeatedly.
- The failure appears unrelated to the change.
- A required secret, service, account, or local dependency is missing.
- Continuing would risk overwriting William's work.
- The agent cannot identify the cause with reasonable confidence.

Do not say that work is ready to ship if verification failed. Record it in `BRANCHES.md` as `Blocked`, `Needs Attention`, or `Ready With Caveat`.

## Handling William's Changes

William is the authority. If the working tree contains changes the agent did not make, the agent must preserve them.

Rules:

- Check the working tree and the agent claim before editing.
- Do not overwrite user changes.
- Do not revert user changes unless William explicitly asks.
- If user changes affect the same files, inspect carefully and work with them.
- If user changes make the task impossible to complete safely, stop and ask.
- If you find changes that are not committed and no agent claims the folder, back them up on `working` and tell William (`RULES.md` G2.6).

## Files And Safety

Agents may read project files as needed.

Never commit secrets or local credentials. Be especially careful with:

- `.env`
- `.env.*`
- API keys
- OAuth credentials
- tokens
- private certificates
- local databases containing user data
- personal data such as bank transactions (keep it in an ignored `local-only/` folder)
- generated release builds unless the repo explicitly tracks them

Add such files to `.gitignore` before the next backup. If a task requires editing sensitive files, ask William first and explain why.

## Work Log

`BRANCHES.md` is the work log for the project. Update it when work on `working` starts, changes materially, is tested, is blocked, or ships.

At minimum, track:

- What is on `working` and waiting to ship.
- Agent.
- Status.
- Test results.
- Version impact.
- Last update.
- Notes for William.

Suggested statuses:

| Status | Meaning |
| --- | --- |
| `Active` | Work is currently happening. |
| `Blocked` | Work cannot continue without a decision, dependency, or fix. |
| `Needs Attention` | Agent is uncertain or tests failed in a way that needs review. |
| `Ready to Ship` | Work appears complete and tested enough for William to ship. |
| `Ready With Caveat` | Work is mostly ready, but has a clearly disclosed verification gap or limitation. |
| `Shipped` | William shipped it and it is now part of `main`. |
| `Abandoned` | Work is intentionally set aside. Save it as an `archive/<name>` tag first. |

## Repo-Specific Instructions

This file is the default rulebook. A repo may also include a local file such as `BOTS.local.md`, `AGENTS.md`, or another clearly named instruction file.

Repo-specific instructions may add details such as:

- Test commands.
- App launch commands.
- Version file location.
- Protected files.
- Release checklist.
- Deployment checklist.

If repo-specific instructions conflict with this file, the agent should follow the stricter rule and ask William before taking risky action. Git branch, backup, and ship rules always come from `RULES.md`.
