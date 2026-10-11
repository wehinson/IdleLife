# AI Agent Workflow

This file is the standing instruction set for any AI code editor or coding agent working in this project.

The user, William, has final authority over what becomes part of the shipped app. Agents may inspect, propose, implement in an isolated T3 task checkout on Jimothy, commit, back up the task branch, run appropriate checks, and update the work log. Permission to implement does not authorize merging or shipping.

## Git Rules Come From RULES.md

The git rules for backup, branches, and shipping are in `C:/Code/The-Librarian/RULES.md`. They apply to every agent in every project. Authority order is William's direct instructions in the current session, then `RULES.md`, then shared and repo-specific `BOTS.md`. Dewey (`C:/Code/The-Librarian/dewey/AGENTS.md`) enforces the standing rules.

When the shared Librarian checkout is on an older branch, read the approved integration version with `git -C C:/Code/The-Librarian show working:RULES.md`, or `git -C C:/Code/The-Librarian show origin/working:RULES.md` after fetching. Do not switch another owner's checkout to read the rules. Older checked-out copies must not override the rules approved on active `working`.

Shared locations are `C:/Code/The-Librarian` for standing rules, `C:/Code/BOTS-BRIEFS` for shared instructions and briefs, and `C:/Code/Agents` for agent instructions, including `AGENT_BASE.md`. Older branch or ship text in those locations does not supersede William's instructions or the approved `working` rules.

Summary (read `RULES.md` for the full rules and terms):

| Branch | Meaning |
| --- | --- |
| `main` | Always equal to the shipped version (the live app, or the last shipped release). |
| `working` | The active integration branch containing task work that William approved. Never an implementation branch. |
| Task branch | A descriptive branch based on active `working`, used for implementation and William's testing in an isolated T3 checkout on Jimothy. |

1. Small, related tasks may join an open task branch when scope and ownership permit. Separate work gets its own descriptive task branch. Never implement directly on `working` or `main`.
2. Branch from the project's active `working`, including its committed work, rather than `main`. Use an isolated checkout managed through T3 on Jimothy. Confirm the branch, base, checkout, and agent claim before editing. Preserve unrelated uncommitted work.
3. Use GPT 6.1 Sol (`gpt-6.1-sol`). William chooses the reasoning effort; do not choose it for him or change your own running session's effort. Apply his selected effort only when creating other T3 threads. Implement and run checks appropriate to the changed files.
4. Commit and push the task branch to GitHub at least every 15 minutes while working and at the end of the session. Unfinished work is permitted in a backup; use commit type `wip`. Stage only the task's files. Refresh the agent claim at each backup.
5. For runnable app changes, serve the exact task checkout at a stable URL such as `/test1`, sharing one server port across previews. Confirm that assets, API routes, and runtime correspond to that checkout; a URL prefix alone does not isolate a branch. Keep the URL stable while William tests and record the branch-to-checkout-to-URL mapping. For documentation-only work, provide review artifacts; an app preview does not apply.
6. Give William the preview URL or review artifacts, exact task branch and commit, check results, and limitations. Requested adjustments stay on that branch. Starting the requested preview server is authorized; browser automation still requires permission under the gate below.
7. Only William's explicit approval of the tested result authorizes merging that task branch into `working`. Testing, passing checks, and permission to implement or edit instructions are not merge approval. After approval, merge, resolve conflicts, verify the combined result, and commit and push `working` for backup.
8. Shipping is a separate action: merge approved `working` into `main` only after a separate instruction to ship. William's "ship it", "push everything", or "publish" means ship; "push" alone means backup. Verify that local `main`, GitHub `main`, and the deployed version agree when there is a live app. Do not automatically include unapproved task branches, delete active or unmerged work, or reset `working` at ship. Preserve unrelated work. Clean up only merged branches and worktrees with no uncommitted work or active owner; retain `working` for future integration.
9. Do not rebase or rewrite history on `main`, `working`, or shared task branches. Use merge commits.

Before work, check and write `AGENT_CLAIM` in the git directory shown by `git rev-parse --git-dir` (`RULES.md` G2.5), not in tracked project files. Use one line: `agent=codex branch=<branch> updated=<ISO time>` (or the appropriate agent name). A different agent's claim updated within 30 minutes means the folder is active; do not take it over. A claim older than 30 minutes may be replaced. Update its time at each backup and remove your claim at session end. Git must never commit this file.

## Splitting Large Briefs

When a brief contains several kinds of work, keep related work on its task branch and split commits by purpose and risk. Separate work gets its own descriptive task branch and isolated T3 checkout. This keeps each change easy to review and to revert. Common splits:

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

Agents should choose verification appropriate to the changed files and the repo. If the project lacks formal tests, say that directly and perform practical checks instead. For documentation-only work, run `git diff --check`, read the full diff, check instruction consistency, and provide the changed documents or commit diff as review artifacts. Do not run unrelated app tests or invent an app preview.

Keep application processing and workflow logic in the engine whenever practical, with UI code focused on display, input, and calls to the engine. Apply this to new or changed code without starting an unrelated rewrite. Prefer repeatable engine unit/integration tests, command-line checks, and direct API/HTTP checks. State which layout, accessibility, or UI behavior those checks cannot prove.

Get explicit permission from William before browser automation or computer use, including opening, connecting to, inspecting, or controlling his browser, or launching an isolated/headless browser for verification (`RULES.md` G4). A request to build, fix, test, verify, or ship does not itself grant permission. Permission already given for this task and scope remains valid; do not ask again for the same action. If UI verification is needed, explain the gap and request the specific check while continuing independent work. If permission is absent, report the unverified UI behavior. Web search and direct API/HTTP checks that do not control a browser do not require that permission. Do not add hard hooks or enforcement systems unless William asks.

Default verification ladder:

| Level | Check | Use When |
| --- | --- | --- |
| 1 | `git status --short --branch` | Always before and after work. |
| 2 | Formatting or lint command | When applicable to the changed files and available in the repo. |
| 3 | Engine unit/integration tests | When relevant to the change and available. |
| 4 | Build or typecheck | For relevant app, package, or typed-code changes. |
| 5 | Engine/API smoke test; UI check with permission | When needed to verify changed behavior. |
| 6 | Summary and URL/artifacts for William | Before task review, integration approval, and shipping. |

Agents should inspect the repo to identify the real commands instead of inventing commands. Common examples include `npm test`, `npm run lint`, `npm run build`, `pytest`, `ruff check`, `cargo test`, `go test ./...`, or project-specific scripts.

Before William reviews the task, report:

- Summary of changes on the task branch.
- Exact branch, commit, and backup status.
- Preview URL and checkout mapping, or documentation review artifacts.
- Files changed.
- Commands run.
- Test results.
- Known limitations.
- Whether it is ready for his review and what remains unverified. Record his merge approval separately; shipping approved `working` requires a separate ship instruction.

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
- If you find uncommitted changes without an active claim, preserve them and back them up on a suitable task branch without mixing unrelated work into the current task, and tell William (`RULES.md` G2.9). Do not edit or back up task changes directly on `working`.

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

`BRANCHES.md` is the work log for the project. Update it when task work starts, changes materially, is tested, awaits William's review or approval, is blocked, is integrated into `working`, or ships. Preserve historical logs as records of their time; they do not authorize the current workflow.

At minimum, track:

- Task branch, base commit, checkout, scope, and latest commit/backup reference.
- Preview URL and checkout mapping, or review artifacts when a preview does not apply.
- William's review and explicit merge-approval status.
- Approved work integrated into `working` and waiting for a separate ship instruction.
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
| `Ready for William Review` | Task checks are complete and the URL or artifacts are available for William's testing. No merge approval implied. |
| `Awaiting Merge Approval` | William's explicit approval of the tested task result is still required. |
| `Approved for Integration` | William explicitly approved merging the tested task into `working`. |
| `Integrated` | Approved task merged into `working`; combined result verified and backed up. |
| `Ready to Ship` | Approved integration work appears verified; a separate ship instruction is still required. |
| `Ready With Caveat` | Work is mostly ready, but has a clearly disclosed verification gap or limitation. |
| `Shipped` | William shipped it and it is now part of `main`. |
| `Abandoned` | Work is intentionally set aside. Save it as an `archive/<name>` tag first; do not delete active or unmerged work. |

## Repo-Specific Instructions

This file is the default rulebook. A repo may also include a local file such as `BOTS.local.md`, `AGENTS.md`, or another clearly named instruction file.

Repo-specific instructions may add details such as:

- Test commands.
- App launch commands.
- Version file location.
- Protected files.
- Release checklist.
- Deployment checklist.

Git branch, backup, and ship rules follow William's current instructions and the approved `RULES.md` authority above. Preserve additional project-specific safeguards. If an unresolved local safety conflict remains, follow the stricter rule and ask William before risky action; superseded workflow text does not override the migration he explicitly authorized.
