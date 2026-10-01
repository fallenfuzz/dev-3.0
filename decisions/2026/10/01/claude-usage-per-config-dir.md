# Claude usage is recorded per pinned CLAUDE_CONFIG_DIR

## Context

A project can pin a Claude login by setting `CLAUDE_CONFIG_DIR` in its env (`.dev3/config*.json`). `dev3 statusline` wrote every session without a managed account id to the one shared `rate-limits/claude.json`. So the "System login (~/.claude)" usage row showed whichever pinned or real `~/.claude` session refreshed last, under the wrong account name. The global surfaces (header usage panel, Settings -> Accounts) have no project in scope, so they cannot pick "the" project's login.

## Investigation

The statusline subprocess inherits the session env, so `CLAUDE_CONFIG_DIR` is visible there. Launch env order in `tmux-pty.ts` is project env, then lifecycle vars, then agent `extraEnv`. Once any managed Claude account exists, `getActiveClaudeSessionEnv` puts `CLAUDE_CONFIG_DIR` (the account dir, or `ENV_UNSET` for the system login) into `extraEnv`, which overrides the project pin.

## Decision

- **Statusline dumps.** `dev3 statusline` (`claudeDumpFilePaths`, `dumpPayload`) writes a pinned session's dump to `rate-limits/claude-config-dirs/<sha256(dir)[:16]>.json` and stores the dir inside it. A managed account id still wins, and `~/.claude` alone keeps `claude.json`.
- **Monitor.** `rate-limit-monitor.ts` reads that directory and tags each snapshot with `configDir`. `findRateLimitSnapshot` / `rateLimitLoginKey` in `src/shared/rate-limits.ts` keep pinned readings off the system row.
- **Listing pinned logins.** `listPinnedClaudeLogins` groups every project's normalized pin (`normalizeClaudeConfigDir`). The usage panel and Settings list each pin as an informational row. A pin cannot be made the default, because the project's config chooses it.
- **Pill honesty.** The launch pill uses the pin only when no managed Claude account exists, because a managed account overrides it. Settings says so when both are present.

## Risks

- **Old dumps.** Readings written before this change stay in `claude.json` until they age out of the 7-day window.
- **No migration.** The new directory is additive, so an older app simply ignores it.
- **Two dirs, one account.** Two dirs logged into the same account show as two rows with the same numbers.

## Alternatives considered

- **Show only the current project's login.** Rejected: the global surfaces would still hide the other pins, and the numbers would stay mixed.
- **Relabel the system row only.** Rejected: the 5h/7d under it would stay contaminated.
- **Make a project pin beat managed-account injection.** That is a behaviour change to the account switcher, so it is left to the user.
