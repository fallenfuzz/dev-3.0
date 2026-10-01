import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import UsageSessionsBlock from "../UsageSessionsBlock";
import type { ClaudeSessionStats } from "../../../shared/session-stats";

vi.mock("../../rpc", () => ({
	api: { request: { getGlobalSettings: vi.fn() } },
}));

import { api } from "../../rpc";

const getSettings = api.request.getGlobalSettings as ReturnType<typeof vi.fn>;
const NOW = 1_790_866_000_000;

function session(overrides: Partial<ClaudeSessionStats> = {}): ClaudeSessionStats {
	return {
		taskId: "t1",
		taskTitle: "Fix auth race",
		taskSeq: 12,
		projectName: "dev-3.0",
		capturedAt: NOW - 30_000,
		model: "Opus 5.5",
		effort: "high",
		contextPercent: 8,
		contextWindowSize: 1_000_000,
		totalTokens: 82_774,
		cacheReadTokens: 79_694,
		cacheWriteTokens: 3070,
		cache: { warm: true, ttl: "1h", expiresAt: NOW + 600_000, hitRatio: 0.88, misses: 0 },
		costUsd: 0.657,
		durationMs: 62_816,
		apiDurationMs: 40_044,
		linesAdded: 3,
		linesRemoved: 1,
		...overrides,
	};
}

async function renderBlock(sessions: ClaudeSessionStats[]) {
	const view = render(
		<I18nProvider>
			<UsageSessionsBlock sessions={sessions} now={NOW} />
		</I18nProvider>,
	);
	await act(async () => {});
	return view;
}

beforeEach(() => {
	getSettings.mockReset();
});

describe("UsageSessionsBlock", () => {
	it("shows the default fields: context, cache state, cache tokens, cost", async () => {
		getSettings.mockResolvedValue({});
		await renderBlock([session()]);
		expect(screen.getByRole("heading", { name: "Sessions" })).toBeTruthy();
		expect(screen.getByText("Fix auth race")).toBeTruthy();
		expect(screen.getByText("ctx 8%")).toBeTruthy();
		expect(screen.getByText(/^cache warm until/)).toBeTruthy();
		expect(screen.getByText("read 79.7k · write 3.1k")).toBeTruthy();
		expect(screen.getByText("$0.657")).toBeTruthy();
		expect(screen.queryByText("Opus 5.5")).toBeNull();
		expect(screen.queryByText("hit 88%")).toBeNull();
	});

	it("follows the fields picked in Settings", async () => {
		getSettings.mockResolvedValue({ usagePanelSessionFields: ["model", "cacheHitRatio", "lines"] });
		await renderBlock([session()]);
		expect(screen.getByText("Opus 5.5")).toBeTruthy();
		expect(screen.getByText("hit 88%")).toBeTruthy();
		expect(screen.getByText("+3/-1")).toBeTruthy();
		expect(screen.queryByText("ctx 8%")).toBeNull();
		expect(screen.queryByText("$0.657")).toBeNull();
	});

	it("reports a warm cache past its expiry as cold", async () => {
		getSettings.mockResolvedValue({});
		await renderBlock([session({ cache: { warm: true, ttl: "5m", expiresAt: NOW - 1, hitRatio: null, misses: null } })]);
		expect(screen.getByText("cache cold")).toBeTruthy();
	});

	it("renders nothing when every field is turned off", async () => {
		getSettings.mockResolvedValue({ usagePanelSessionFields: [] });
		const { container } = await renderBlock([session()]);
		expect(container.textContent).toBe("");
	});

	it("reacts to a settings push without reopening", async () => {
		getSettings.mockResolvedValue({});
		await renderBlock([session()]);
		await act(async () => {
			window.dispatchEvent(new CustomEvent("rpc:globalSettingsUpdated", { detail: { usagePanelSessionFields: ["effort"] } }));
		});
		expect(screen.getByText("effort high")).toBeTruthy();
		expect(screen.queryByText("ctx 8%")).toBeNull();
	});
});
