Short: Pinned Claude logins shown everywhere

When a project's env sets `CLAUDE_CONFIG_DIR`, its login now appears as "Project login (…/proj/.claude)" with that account's email: on the launch dialogs' account pill (including agent-requested launches), as its own row with its own 5h/7d usage in the header usage panel, and in Settings -> Accounts with the projects that pin it. Pinned sessions no longer feed their usage into the "System login (~/.claude)" row, and the pill no longer claims the pin while a dev3-managed Claude account overrides it.
