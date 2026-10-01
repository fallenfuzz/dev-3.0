# Per-task Claude session stats in the usage panel

## Context

The header usage panel showed only account-wide limit windows (5h, 7d). Users wanted the session details a custom Claude Code statusLine shows: context use, prompt cache warm/cold and expiry, cache reads and writes, cost. Claude Code already sends all of it in the statusLine payload that `dev3 statusline` receives on every refresh.

## Investigation

The existing dumps (`rate-limits/claude.json`, `rate-limits/claude/<accountId>.json`) are keyed by account and overwritten by whichever session refreshed last. Rate-limit windows are account-wide, so that is correct for them, but per-session values from that file would belong to an arbitrary task. Every dev3-launched agent has `DEV3_TASK_ID` in its environment.

## Decision

`dev3 statusline` also writes the same `{capturedAt, accountId, payload}` envelope to `rate-limits/sessions/<taskId>.json` when `DEV3_TASK_ID` is set (`sessionDumpFilePath` in `src/cli/commands/statusline.ts`). The monitor (`readClaudeSessionDumps` + `attachTaskIdentity` in `src/bun/rate-limit-monitor.ts`) reads dumps captured within `SESSION_STATS_RECENT_MS`, drops tasks that are gone or completed/cancelled, caps the list at `MAX_SESSION_STATS` and adds it to `AgentRateLimitsReport.sessions`. Parsing lives in `src/shared/session-stats.ts`; the raw payload is stored so new fields need no format change. Which fields render is the global setting `usagePanelSessionFields`, chosen in Settings -> Agents, never in the panel itself.

## Risks

The `sessions/` directory gains one small file per task that ran Claude and is never pruned; stale files are ignored by mtime rather than deleted, per the no-destructive-cleanup rule for `~/.dev3.0/`. Several Claude panes in one task share a file, so the row shows whichever refreshed last. Older dev3 builds ignore the directory and the optional `sessions` report field.

## Alternatives considered

Reading per-session values from the account dumps: wrong task attribution as soon as two sessions run. Parsing Claude transcripts: heavier, and the prompt-cache state is not in them. A field picker inside the panel: rejected by the surface spec, since a readout that accumulates settings is toolbar creep.
