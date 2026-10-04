Short: Agents in one folder stop overwriting

When several Claude tasks share a project folder with the git workflow off, an edit to a file another live task is editing is refused with that task's name and a ready `dev3 message` command, so the agents coordinate instead of overwriting each other. Each task's handoff, Conversation tab and archive now show only its own sessions, the `dev3 task move` approval prompts say the folder keeps every file, and dev3's hooks, permissions and mode reach Claude through `--settings` instead of being left in the folder's `.claude/settings.local.json`.
