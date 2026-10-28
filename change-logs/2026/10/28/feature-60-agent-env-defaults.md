Short: Default env for agent sessions

Settings → Agents → Default agent environment sets env vars that every agent session gets when its project does not set the key itself, with `{projectPath}` and `{projectName}` expanded per project - for example `CLAUDE_CONFIG_DIR={projectPath}/.claude` gives each project its own Claude login without a `.dev3/config.local.json` in every repo. Project config always wins, and an empty setting changes nothing.

Contributed by @fallenfuzz
