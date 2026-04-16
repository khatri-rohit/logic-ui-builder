# VS Code Agent Mapping For Gemini-Style Skill Instructions

This file preserves the behavior of Gemini-oriented instructions by translating them to VS Code agent tools.

| Skill references                | VS Code agent equivalent                 |
| ------------------------------- | ---------------------------------------- |
| `Read` (file reading)           | `read_file`                              |
| `Write` (file creation)         | `create_file`                            |
| `Edit` (file editing)           | `apply_patch`                            |
| `Bash` (run commands)           | `run_in_terminal`                        |
| `Grep` (search file content)    | `grep_search`                            |
| `Glob` (search files by name)   | `file_search`                            |
| `TodoWrite` (task tracking)     | `manage_todo_list`                       |
| `Skill` tool (invoke a skill)   | invoke by skill name in VS Code chat     |
| `WebSearch`                     | `fetch_webpage` using a search URL/query |
| `WebFetch`                      | `fetch_webpage`                          |
| `Task` tool (dispatch subagent) | `runSubagent`                            |

## Subagent behavior

When a skill expects no subagent support, execute in one session.
When independent deep research tasks can be parallelized safely, prefer `runSubagent` for each stream and merge results.

## Additional VS Code agent tools useful for Gemini-style workflows

| Tool                  | Purpose                                |
| --------------------- | -------------------------------------- |
| `list_dir`            | List files and subdirectories          |
| `memory`              | Persist session, repo, and user notes  |
| `vscode_askQuestions` | Request structured input from the user |
| `manage_todo_list`    | Rich task tracking and status updates  |
| `run_notebook_cell`   | Execute notebook code cells directly   |
