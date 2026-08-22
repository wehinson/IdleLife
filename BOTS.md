# AI Agent Git Workflow

This file is the standing instruction set for any AI code editor or coding agent working in this project.

The user, William, has final authority over what becomes part of the active app. Agents may inspect, propose, edit in the proper working area, create branches, commit branch work, run tests, and update the branch board. Agents may merge ready work into `Main` without separate approval.

## Core Model

This project uses three conceptual states:

| State | Meaning | Agent Permission |
| --- | --- | --- |
| `Main` | The trusted app state William actually uses. This should stay stable and release-worthy. | Read freely. Agents may merge ready work into it without separate approval. |
| `Review` | The branch review and release-candidate layer. Related branches are gathered here for testing before they become `Main`. | Agents may prepare and update review branches. Agents may merge ready work from `Review` into `Main` without separate approval. |
| `Active` | The live working area where Claude, Codex, or another agent makes changes before committing to a branch. | Agents do normal coding here. Dirty or unfinished work may stay here if it is not ready. |

Avoid using the word "staging" for the release-candidate layer. In Git, staging already means the index of files prepared for a commit. Use `Review` for branch review and release preparation.

`Main`, `Review`, and `Active` are workflow names. If a repository already uses lowercase branch names such as `main` or `review`, keep the existing casing and treat those branches as the corresponding workflow states. Do not rename branches just to match this document unless William asks.

## Preferred Folder Layout

Use Git worktrees when practical so William can keep the real app open while agents work elsewhere.

Recommended layout for each project:

| Folder | Branch | Purpose |
| --- | --- | --- |
| `<project>-main` | `Main` | Stable app William opens and uses. |
| `<project>-active` | Current agent branch | Live coding workspace. |
| `<project>-review` | `Review` | Combined testing area for candidate branches. |

If the repo does not yet use worktrees, the agent should suggest setting them up before major work. For small documentation-only changes, a normal single checkout is acceptable if the current branch is not `Main` or William explicitly approves.

## Branch Rules

All meaningful changes happen on branches. A single large brief may become multiple branches if the work naturally separates into different risk areas or review categories.

If William's brief does not already specify branch boundaries, the agent should propose a branch split before implementing substantial work. The agent may proceed without asking only when the task is small, obvious, and safely belongs in one branch.

Branch names should use a broad type plus a short concrete description:

| Prefix | Use For | Example |
| --- | --- | --- |
| `feature/` | New user-facing behavior or capabilities. | `feature/gmail-newsletter-sync` |
| `ui/` | Visual layout, interaction, styling, or design-system work. | `ui/sidebar-navigation-refresh` |
| `fix/` | Bug fixes and regressions. | `fix/meeting-capture-crash` |
| `docs/` | Documentation, briefs, instructions, and planning files. | `docs/agent-git-workflow` |
| `test/` | Test coverage, fixtures, and test infrastructure. | `test/article-ingestion-states` |
| `refactor/` | Internal restructuring without intended behavior change. | `refactor/rss-acquisition-boundaries` |
| `experiment/` | Risky, speculative, or disposable prototypes. | `experiment/local-model-routing` |
| `release/` | Final release preparation. | `release/0.1.7` |

Agents should not create vague branch names like `changes`, `updates`, `codex-work`, or `new-stuff`.

## Large Brief Splitting

When a brief contains several kinds of work, split by review risk and purpose. Common splits:

| Work Type | Usually Separate? | Reason |
| --- | --- | --- |
| UI-only work | Yes | Easy to review visually and revert independently. |
| Backend behavior | Yes | Higher chance of logic bugs or data issues. |
| Database or schema changes | Yes | Needs special review and rollback thinking. |
| External integrations | Yes | API keys, auth, rate limits, and sync behavior add risk. |
| Tests | Sometimes | May travel with the feature, but large test infrastructure can stand alone. |
| Refactors | Yes | Should not be hidden inside feature branches unless required. |
| Docs | Usually yes | Keeps planning and implementation history clean. |

If a branch depends on another branch, say so in `BRANCHES.md`.

## Commit Rules

Agents may commit completed work to their own branch after reasonable verification. Agents should not commit broken work unless William asks for a checkpoint or the commit is clearly marked as unfinished.

Unfinished work may remain in the `Active` working area. Do not force a commit just to make the tree clean if the work does not run or the approach is uncertain.

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
| `wip` | Explicit unfinished checkpoint, only when approved or necessary. |

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

## Review Branch

`Review` is the integration branch for work William might want in the next release. It answers the question: "What happens if these candidate branches are combined?"

Agents may help combine feature branches into `Review` for testing if William asks. Agents may resolve merge conflicts into `Main` when needed to complete ready work.

Rules:

- `Main` remains stable.
- `Review` may be temporarily broken while branches are being combined, but the goal is to make it testable.
- A feature branch should be tested on its own before it is added to `Review` when practical.
- When `Review` is ready, the agent reports what is included, what passed, what failed, and what still needs human judgment.
- Agents may merge `Review` or selected ready branches into `Main` without separate approval.

## Merging Rules

Agents may merge ready branches into `Main` without separate approval.

Agents may:

- Create branches.
- Commit to agent branches.
- Merge `Main` into an agent branch when needed to catch up, if there are no risky conflicts.
- Merge agent branches into `Review` when William requests a review build.
- Resolve conflicts on agent branches or `Review`.
- Explain conflicts and recommend what to keep.

Agents must not:

- Directly edit files while checked out on `Main`.
- Rebase shared branches.
- Rewrite branch history unless William explicitly asks.
- Delete branches without approval.
- Use destructive Git commands such as `git reset --hard` or forced checkout to discard work unless William explicitly approves.

For now, do not use rebasing. Prefer normal merge commits.

## Versioning Rules

This project uses numeric release versions such as `0.1.0`, `0.1.12`, or `1.5.12`.

Default rule:

- Every approved merge from `Review` or from selected branches into `Main` bumps the last digit by one.
- Example: `0.1.0` becomes `0.1.1`.
- Multi-digit numbers are normal. `0.1.9` becomes `0.1.10`.

William may override the default and instruct a larger bump:

| Bump | When William May Choose It | Example |
| --- | --- | --- |
| Patch / last digit | Normal branch or release merge. | `0.1.7` -> `0.1.8` |
| Minor / middle digit | Meaningful feature set, workflow change, or release milestone. | `0.1.7` -> `0.2.0` |
| Major / first digit | Major architecture change, public release, or breaking shift. | `0.9.4` -> `1.0.0` |

Agents should default to patch bumps. If a set of changes looks larger than a patch, the agent should recommend a minor or major bump, but William decides.

When version files exist, update them as part of the approved merge to `Main`. If no version file exists, add the version note to release notes or `BRANCHES.md` until William chooses a canonical version location.

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
| 6 | Review summary | Always before asking William to merge. |

Agents should inspect the repo to identify the real commands instead of inventing commands. Common examples include `npm test`, `npm run lint`, `npm run build`, `pytest`, `ruff check`, `cargo test`, `go test ./...`, or project-specific scripts.

Before work is considered ready for `Review`, report:

- Branch name.
- Summary of changes.
- Files changed.
- Commands run.
- Test results.
- Known limitations.
- Whether the branch is recommended for `Review`.

## When Tests Fail

If tests fail, the agent should keep working while the failure appears understandable and fixable. The agent should stop and report when:

- The same class of fix has failed repeatedly.
- The failure appears unrelated to the branch.
- A required secret, service, account, or local dependency is missing.
- Continuing would risk overwriting William's work.
- The agent cannot identify the cause with reasonable confidence.

Do not claim a branch is ready if verification failed. Use `BRANCHES.md` to mark it as `Blocked`, `Needs Attention`, or `Ready With Caveat`.

## Handling William's Changes

William is the authority. If the working tree contains changes the agent did not make, the agent must preserve them.

Rules:

- Check the working tree before editing.
- Do not overwrite user changes.
- Do not revert user changes unless William explicitly asks.
- If user changes affect the same files, inspect carefully and work with them.
- If user changes make the task impossible to complete safely, stop and ask.

## Files And Safety

Agents may read project files as needed. Agents may merge ready work into `Main` without separate approval.

Never commit secrets or local credentials. Be especially careful with:

- `.env`
- `.env.*`
- API keys
- OAuth credentials
- tokens
- private certificates
- local databases containing user data
- generated release builds unless the repo explicitly tracks them

If a task requires editing sensitive files, ask William first and explain why.

## Branch Board

Maintain `BRANCHES.md` as the current branch status board. Update it whenever a branch is created, materially changed, tested, added to `Review`, blocked, abandoned, or merged.

At minimum, track:

- Branch name.
- Category.
- Purpose.
- Agent.
- Base branch.
- Status.
- Dependencies.
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
| `Ready for Review` | Branch appears complete and tested enough for William to inspect. |
| `Ready With Caveat` | Branch is mostly ready, but has a clearly disclosed verification gap or limitation. |
| `In Review` | Branch has been added to `Review` or is being tested there. |
| `Approved for Main` | William approved it for `Main`, but it has not been merged yet. |
| `Merged to Main` | William approved and the branch is now part of `Main`. |
| `Abandoned` | Branch is intentionally set aside. |

## Repo-Specific Instructions

This file is the default rulebook. A repo may also include a local file such as `BOTS.local.md`, `AGENTS.md`, or another clearly named instruction file.

Repo-specific instructions may add details such as:

- Test commands.
- App launch commands.
- Version file location.
- Protected files.
- Release checklist.
- Deployment checklist.
- Project-specific branch prefixes.

If repo-specific instructions conflict with this file, the agent should follow the stricter rule and ask William before taking risky action.
