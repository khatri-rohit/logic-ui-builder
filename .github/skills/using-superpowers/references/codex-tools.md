# VS Code Agent Mapping For Codex-Style Skill Instructions

This file preserves the meaning of Codex-oriented skill guidance by translating execution steps to VS Code agent tools.

| Skill references                 | VS Code agent equivalent                        |
| -------------------------------- | ----------------------------------------------- |
| `Task` tool (dispatch subagent)  | `runSubagent`                                   |
| Multiple `Task` calls (parallel) | `multi_tool_use.parallel` for independent calls |
| Task returns result              | result is returned directly from `runSubagent`  |
| Task completes automatically     | no explicit close step required                 |
| `TodoWrite` (task tracking)      | `manage_todo_list`                              |
| `Skill` tool (invoke a skill)    | invoke by skill name in VS Code chat            |
| `Read`, `Write`, `Edit` (files)  | `read_file`, `create_file`, `apply_patch`       |
| `Bash` (run commands)            | `run_in_terminal`                               |

## Named agent dispatch

When a skill requests a named agent behavior (for example `superpowers:code-reviewer`):

1. Use `runSubagent` with the closest available `agentName`.
2. If no matching agent exists, include the requested behavior directly in the subagent prompt.
3. Return and summarize the result in the main agent response before proceeding.

## Prompt framing for delegated tasks

Keep the delegated prompt explicit:

- State the task objective clearly.
- Include required output format.
- Include constraints and stop conditions.

## Environment detection for git workflows

For skills that manage branches/worktrees, use read-only git checks before mutation:

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
```

- `GIT_DIR != GIT_COMMON` means already inside a linked worktree.
- Empty `BRANCH` indicates detached HEAD and limited branch/PR actions.

## Completion behavior in VS Code agents

When branch/push is blocked by environment constraints:

1. Complete code changes and local verification.
2. Report exact next steps for branch creation and push from the user environment.
3. Provide suggested branch name, commit message, and PR summary text.
