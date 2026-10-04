Short: Safer gitless project folders

Tasks in a project with its git workflow off no longer leave dev3's Claude hooks, Bash permissions or permission mode in the folder's `.claude/settings.local.json`: they are passed to Claude with `--settings`, so a `claude` session you start there yourself sees none of them, on every platform.
