# VS Code Agent Tool Mapping

Upstream superpowers skills may use Claude-style tool names. In VS Code agents, translate them as follows:

| Skill references                 | VS Code agent equivalent                                  |
| -------------------------------- | --------------------------------------------------------- |
| `Read` (file reading)            | `read_file`                                               |
| `Write` (file creation)          | `create_file`                                             |
| `Edit` (file editing)            | `apply_patch`                                             |
| `Bash` (run commands)            | `run_in_terminal`                                         |
| `Grep` (search file content)     | `grep_search`                                             |
| `Glob` (search files by name)    | `file_search`                                             |
| `WebFetch`                       | `fetch_webpage`                                           |
| `Task` tool (dispatch subagent)  | `runSubagent`                                             |
| Multiple `Task` calls (parallel) | `multi_tool_use.parallel` when operations are independent |
| Task status/output               | subagent output is returned by `runSubagent`              |
| `TodoWrite` (task tracking)      | `manage_todo_list`                                        |
| `WebSearch`                      | `fetch_webpage` using a search URL/query                  |
| `Skill` tool (invoke a skill)    | invoke via chat command (for example `/<skill-name>`)     |
| `EnterPlanMode` / `ExitPlanMode` | no direct mode switch; keep progress in chat updates      |

## Subagent translation

When a skill says to dispatch an agent:

1. Use `runSubagent` with a detailed task prompt.
2. If a specific agent is requested, pass `agentName` when available.
3. Summarize the returned result in the main chat before continuing.

## Async shell translation

Use background terminals in VS Code agents for long-running commands:

| Need                       | VS Code agent tool                          |
| -------------------------- | ------------------------------------------- |
| Start long-running process | `run_in_terminal` with `isBackground: true` |
| Read process output        | `get_terminal_output`                       |
| Wait for completion        | `await_terminal`                            |
| Stop process               | `kill_terminal`                             |

## Notes

- Keep skill intent unchanged: only translate tool invocation mechanics.
- Prefer deterministic, non-interactive commands when a skill can branch into prompts.
