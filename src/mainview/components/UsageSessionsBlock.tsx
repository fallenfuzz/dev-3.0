import { useEffect, useState, type ReactNode } from "react";
import type { GlobalSettings } from "../../shared/types";
import {
	DEFAULT_SESSION_STAT_FIELDS,
	formatCostUsd,
	formatDurationMs,
	formatTokenCount,
	isSessionCacheWarm,
	type ClaudeSessionStats,
	type SessionStatField,
} from "../../shared/session-stats";
import { api } from "../rpc";
import { useLocale, useT } from "../i18n";
import { CapturedAgeSuffix } from "./rate-limit-ui";

/** The user's pick from Settings -> Agents, read here because only this block cares. */
export function useSessionStatFields(): readonly SessionStatField[] {
	const [fields, setFields] = useState<readonly SessionStatField[]>(DEFAULT_SESSION_STAT_FIELDS);
	useEffect(() => {
		let cancelled = false;
		function apply(settings: GlobalSettings) {
			if (!cancelled) setFields(settings.usagePanelSessionFields ?? DEFAULT_SESSION_STAT_FIELDS);
		}
		function onUpdate(event: Event) {
			apply((event as CustomEvent<GlobalSettings>).detail);
		}
		window.addEventListener("rpc:globalSettingsUpdated", onUpdate);
		void api.request.getGlobalSettings().then(apply).catch(() => {});
		return () => {
			cancelled = true;
			window.removeEventListener("rpc:globalSettingsUpdated", onUpdate);
		};
	}, []);
	return fields;
}

function contextTone(percent: number): string {
	if (percent >= 85) return "text-danger";
	if (percent >= 60) return "text-warning-strong";
	return "text-fg-2";
}

function SessionRow({ session, fields, now }: { session: ClaudeSessionStats; fields: Set<SessionStatField>; now: number }) {
	const t = useT();
	const [locale] = useLocale();
	const clock = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
	const items: ReactNode[] = [];
	const push = (key: string, node: ReactNode) => items.push(<span key={key}>{node}</span>);

	if (fields.has("model") && session.model) push("model", <span className="text-fg-2">{session.model}</span>);
	if (fields.has("effort") && session.effort) push("effort", t("rateLimits.sessionEffort", { level: session.effort }));
	if (fields.has("context") && session.contextPercent != null) {
		const percent = Math.round(session.contextPercent);
		push("context", <span className={contextTone(percent)}>{t("rateLimits.sessionContext", { percent })}</span>);
	}
	if (fields.has("tokens") && session.totalTokens != null) {
		push("tokens", t("rateLimits.sessionTokens", { tokens: formatTokenCount(session.totalTokens) }));
	}
	if (fields.has("cacheStatus") && session.cache) {
		const warm = isSessionCacheWarm(session.cache, now);
		const label = !warm
			? t("rateLimits.sessionCacheCold")
			: session.cache.expiresAt != null
				? t("rateLimits.sessionCacheWarmUntil", { time: clock.format(session.cache.expiresAt) })
				: t("rateLimits.sessionCacheWarm");
		push("cache", <span className={warm ? "text-accent" : "text-fg-muted"}>{label}</span>);
	}
	if (fields.has("cacheHitRatio") && session.cache?.hitRatio != null) {
		push("hit", t("rateLimits.sessionCacheHit", { percent: Math.round(session.cache.hitRatio * 100) }));
	}
	if (fields.has("cacheTokens") && (session.cacheReadTokens != null || session.cacheWriteTokens != null)) {
		push(
			"cacheTokens",
			t("rateLimits.sessionCacheTokens", {
				read: formatTokenCount(session.cacheReadTokens ?? 0),
				write: formatTokenCount(session.cacheWriteTokens ?? 0),
			}),
		);
	}
	if (fields.has("duration") && session.durationMs) {
		push(
			"duration",
			t("rateLimits.sessionDuration", {
				time: formatDurationMs(session.durationMs),
				api: formatDurationMs(session.apiDurationMs ?? 0),
			}),
		);
	}
	if (fields.has("lines") && (session.linesAdded || session.linesRemoved)) {
		push("lines", t("rateLimits.sessionLines", { added: session.linesAdded ?? 0, removed: session.linesRemoved ?? 0 }));
	}

	const showCost = fields.has("cost") && session.costUsd != null;
	return (
		<li className="flex flex-col gap-0.5 rounded-md px-2 py-1 bg-raised/65">
			<div className="flex items-baseline gap-1.5">
				{session.taskSeq != null && <span className="shrink-0 tabular-nums text-fg-muted">#{session.taskSeq}</span>}
				<span className="min-w-0 flex-1 truncate text-fg-2 streamer-private" title={session.taskTitle ?? undefined}>
					{session.taskTitle}
				</span>
				<span className="shrink-0 whitespace-nowrap tabular-nums">
					{showCost && <span className="font-semibold text-fg-2">{formatCostUsd(session.costUsd!)}</span>}
					<CapturedAgeSuffix capturedAt={session.capturedAt} now={now} />
				</span>
			</div>
			{items.length > 0 && (
				<div className="flex flex-wrap gap-x-2 gap-y-0.5 tabular-nums text-fg-3">{items}</div>
			)}
		</li>
	);
}

/**
 * Read-only Sessions block under the account cards: recent Claude task sessions
 * with the fields chosen in Settings. Absent, not empty, when there is nothing
 * to show - the panel carries no reassuring empty state.
 */
export default function UsageSessionsBlock({ sessions, now }: { sessions: ClaudeSessionStats[] | undefined; now: number }) {
	const t = useT();
	const fields = useSessionStatFields();
	if (!sessions || sessions.length === 0 || fields.length === 0) return null;
	const fieldSet = new Set(fields);
	return (
		<section aria-labelledby="usage-sessions-title" className="space-y-1">
			<h3 id="usage-sessions-title" className="px-2 text-fg-muted text-micro font-semibold uppercase tracking-wider">
				{t("rateLimits.sessionsTitle")}
			</h3>
			<ul className="space-y-1">
				{sessions.map((session) => (
					<SessionRow key={session.taskId} session={session} fields={fieldSet} now={now} />
				))}
			</ul>
		</section>
	);
}
