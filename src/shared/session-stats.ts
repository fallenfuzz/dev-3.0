/**
 * Per-task Claude session stats - pure parsing shared by the CLI (`dev3 statusline`
 * writes the raw payload per task), the bun monitor (parses and attaches task
 * identity) and the renderer (the usage panel's Sessions block).
 */

export interface ClaudeSessionCacheStats {
	warm: boolean;
	/** Cache TTL as reported by Claude Code, e.g. "5m" or "1h". */
	ttl: string | null;
	/** When a warm cache expires (epoch ms). */
	expiresAt: number | null;
	/** Share of requests served from cache, 0-1. */
	hitRatio: number | null;
	misses: number | null;
}

export interface ClaudeSessionStats {
	taskId: string;
	/** Filled in by the bun monitor from the board; null when the task is unknown. */
	taskTitle: string | null;
	taskSeq: number | null;
	projectName: string | null;
	capturedAt: number;
	model: string | null;
	effort: string | null;
	/** Claude Code's session name (`/rename`), when set. */
	sessionName: string | null;
	thinking: boolean | null;
	contextPercent: number | null;
	contextWindowSize: number | null;
	/** Current context size: input plus output tokens. */
	totalTokens: number | null;
	/** Last request's tokens read from / written to the prompt cache. */
	cacheReadTokens: number | null;
	cacheWriteTokens: number | null;
	/** Fresh (uncached) input and output tokens of the last request. */
	turnInputTokens: number | null;
	turnOutputTokens: number | null;
	cache: ClaudeSessionCacheStats | null;
	costUsd: number | null;
	durationMs: number | null;
	apiDurationMs: number | null;
	linesAdded: number | null;
	linesRemoved: number | null;
}

/** Fields the user can toggle in Settings for the usage panel's Sessions block. */
export const SESSION_STAT_FIELDS = [
	"model",
	"sessionName",
	"contextBar",
	"context",
	"tokens",
	"turn",
	"cacheStatus",
	"cacheTokens",
	"cacheHitRatio",
	"cost",
	"duration",
	"lines",
	"effort",
	"thinking",
] as const;

export type SessionStatField = (typeof SESSION_STAT_FIELDS)[number];

export const DEFAULT_SESSION_STAT_FIELDS: readonly SessionStatField[] = ["context", "cacheStatus", "cacheTokens", "cost"];

/** Sessions older than this drop out of the panel - a prompt cache lives at most an hour. */
export const SESSION_STATS_RECENT_MS = 6 * 60 * 60 * 1000;
/** The panel is a glance, not a list view. */
export const MAX_SESSION_STATS = 6;

/** Unknown or duplicate ids are dropped, so a hand-edited settings file cannot break the panel. */
export function normalizeSessionStatFields(value: unknown): SessionStatField[] | undefined {
	if (!Array.isArray(value)) return undefined;
	return SESSION_STAT_FIELDS.filter((field) => value.includes(field));
}

function asRecord(v: unknown): Record<string, unknown> | null {
	return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function num(v: unknown): number | null {
	return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
	return typeof v === "string" && v.trim() ? v : null;
}

/** Parse a Claude Code statusLine payload into session stats. Null when it carries
 *  nothing session-shaped (no model and no context window). */
export function parseClaudeSessionStats(payload: unknown, taskId: string, capturedAt: number): ClaudeSessionStats | null {
	const root = asRecord(payload);
	if (!root) return null;
	const model = asRecord(root.model);
	const ctx = asRecord(root.context_window);
	if (!model && !ctx) return null;
	const usage = asRecord(ctx?.current_usage);
	const cost = asRecord(root.cost);
	const pc = asRecord(root.prompt_cache);
	const inTok = num(ctx?.total_input_tokens);
	const outTok = num(ctx?.total_output_tokens);
	const expiresSec = num(pc?.expires_at);
	const thinkingEnabled = asRecord(root.thinking)?.enabled;
	return {
		taskId,
		taskTitle: null,
		taskSeq: null,
		projectName: null,
		capturedAt,
		model: str(model?.display_name) ?? str(model?.id),
		effort: str(asRecord(root.effort)?.level),
		sessionName: str(root.session_name),
		thinking: typeof thinkingEnabled === "boolean" ? thinkingEnabled : null,
		contextPercent: num(ctx?.used_percentage),
		contextWindowSize: num(ctx?.context_window_size),
		totalTokens: inTok == null && outTok == null ? null : (inTok ?? 0) + (outTok ?? 0),
		cacheReadTokens: num(usage?.cache_read_input_tokens),
		cacheWriteTokens: num(usage?.cache_creation_input_tokens),
		turnInputTokens: num(usage?.input_tokens),
		turnOutputTokens: num(usage?.output_tokens),
		cache:
			pc && typeof pc.warm === "boolean"
				? {
						warm: pc.warm,
						ttl: str(pc.ttl),
						expiresAt: expiresSec != null ? expiresSec * 1000 : null,
						hitRatio: num(pc.hit_ratio),
						misses: num(pc.misses),
					}
				: null,
		costUsd: num(cost?.total_cost_usd),
		durationMs: num(cost?.total_duration_ms),
		apiDurationMs: num(cost?.total_api_duration_ms),
		linesAdded: num(cost?.total_lines_added),
		linesRemoved: num(cost?.total_lines_removed),
	};
}

/** A warm cache whose expiry has passed is cold, whatever the last refresh said. */
export function isSessionCacheWarm(cache: ClaudeSessionCacheStats, nowMs: number): boolean {
	return cache.warm && (cache.expiresAt == null || cache.expiresAt > nowMs);
}

/** Compact token count: 950, 12.3k, 1.2M. */
export function formatTokenCount(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return String(Math.round(n));
}

/** Session cost like the statusline: more decimals while it is still small. */
export function formatCostUsd(usd: number): string {
	if (usd < 0.01) return `$${usd.toFixed(4)}`;
	if (usd < 1) return `$${usd.toFixed(3)}`;
	return `$${usd.toFixed(2)}`;
}

/** Compact duration: 45s, 12m, 2h5m. */
export function formatDurationMs(ms: number): string {
	const s = Math.round(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m`;
	const h = Math.floor(m / 60);
	const rm = m % 60;
	return rm > 0 ? `${h}h${rm}m` : `${h}h`;
}
