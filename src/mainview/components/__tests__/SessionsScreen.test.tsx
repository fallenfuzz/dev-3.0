import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRateLimitsReport } from "../../../shared/rate-limits";
import type { ClaudeSessionStats } from "../../../shared/session-stats";
import { I18nProvider } from "../../i18n";
import { setSensitiveProjectIds } from "../../sensitive-projects";
import { setStreamerMode } from "../../streamer-mode";
import SessionsScreen from "../SessionsScreen";
import { NOW, session, warmFor } from "./session-test-fixtures";

vi.mock("../../rpc", () => ({
	api: { request: { getAgentRateLimits: vi.fn() } },
}));
vi.mock("../../hooks/useNarrowViewport", () => ({ useNarrowViewport: () => false }));

import { api } from "../../rpc";
const mockGet = api.request.getAgentRateLimits as unknown as ReturnType<typeof vi.fn>;

const SESSIONS: ClaudeSessionStats[] = [
	session("a", { taskTitle: "Alpha", taskSeq: 11, costUsd: 1.2, contextPercent: 30 }),
	session("b", { taskTitle: "Beta", taskSeq: 22, costUsd: 4.5, contextPercent: 91 }),
	session("c", { taskTitle: "Gamma", taskSeq: 33, costUsd: 0.3, awaitingUser: true, cache: warmFor(60_000) }),
	session("d", { taskTitle: "Delta", taskSeq: 44, costUsd: 9, projectId: "p2", projectName: "other" }),
];

async function renderScreen(props: Partial<Parameters<typeof SessionsScreen>[0]> = {}) {
	mockGet.mockResolvedValue({ snapshots: [], sessions: SESSIONS, generatedAt: NOW } satisfies AgentRateLimitsReport);
	const onOpenTask = vi.fn();
	render(
		<I18nProvider>
			<SessionsScreen projectId="p1" projectName="dev-3.0" onOpenTask={onOpenTask} {...props} />
		</I18nProvider>,
	);
	await act(async () => {});
	return { onOpenTask };
}

const titles = () =>
	within(screen.getByRole("table"))
		.getAllByRole("row")
		.slice(1)
		.map((row) => row.querySelector("td button")?.textContent ?? "")
		.filter(Boolean);

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
});

afterEach(() => {
	vi.useRealTimers();
	setStreamerMode(false);
	setSensitiveProjectIds([]);
});

describe("SessionsScreen", () => {
	it("starts on the project it was opened from, attention first", async () => {
		await renderScreen();
		expect(titles()).toEqual(["#33Gamma", "#22Beta", "#11Alpha"]);
		expect(screen.queryByRole("columnheader", { name: "Project" })).toBeNull();
	});

	it("sorts by a column and flips direction on a second click", async () => {
		await renderScreen();
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		await user.click(screen.getByRole("button", { name: "Cost" }));
		expect(titles()).toEqual(["#22Beta", "#11Alpha", "#33Gamma"]);
		await user.click(screen.getByRole("button", { name: /Cost/ }));
		expect(titles()).toEqual(["#33Gamma", "#11Alpha", "#22Beta"]);
		expect(screen.getByRole("columnheader", { name: /Cost/ }).getAttribute("aria-sort")).toBe("ascending");
	});

	it("lists every project, with a Project column, when opened outside one", async () => {
		await renderScreen({ projectId: null, projectName: null });
		expect(titles()).toHaveLength(4);
		expect(screen.getByRole("columnheader", { name: "Project" })).toBeTruthy();
	});

	it("searches by title and by #number", async () => {
		await renderScreen();
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		const search = screen.getByRole("searchbox");
		await user.type(search, "alp");
		expect(titles()).toEqual(["#11Alpha"]);
		await user.clear(search);
		await user.type(search, "#22");
		expect(titles()).toEqual(["#22Beta"]);
		await user.clear(search);
		await user.type(search, "nothing");
		expect(screen.getByText("No sessions match this search.")).toBeTruthy();
	});

	it("opens the task from its row and reveals the statusline details on demand", async () => {
		const { onOpenTask } = await renderScreen();
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		await user.click(screen.getByRole("button", { name: "#11 Alpha" }));
		expect(onOpenTask).toHaveBeenCalledWith("a", "p1");
		expect(screen.queryByText(/turn 2 in/)).toBeNull();
		await user.click(screen.getByRole("button", { name: "Details: Alpha" }));
		expect(screen.getByText(/turn 2 in/)).toBeTruthy();
	});

	it("explains how sessions get here when there are none", async () => {
		mockGet.mockResolvedValue({ snapshots: [], generatedAt: NOW });
		render(
			<I18nProvider>
				<SessionsScreen projectId={null} projectName={null} onOpenTask={() => {}} />
			</I18nProvider>,
		);
		await act(async () => {});
		expect(screen.getByText("No Claude task sessions in the last 6 hours.")).toBeTruthy();
	});

	it("masks a sensitive project's titles and name in streamer mode", async () => {
		setStreamerMode(true);
		setSensitiveProjectIds(["p2"]);
		await renderScreen({ projectId: null, projectName: null });
		const secret = screen.getByText("Delta");
		expect(secret.className).toContain("streamer-private");
		expect(secret.closest("button")?.getAttribute("title")).toBeNull();
		const projectCell = screen.getByText("other");
		expect(projectCell.className).toContain("streamer-private");
		expect(projectCell.getAttribute("title")).toBeNull();
		expect(screen.getByText("Alpha").className).not.toContain("streamer-private");
		expect(screen.getAllByText("dev-3.0")[0].className).not.toContain("streamer-private");
	});

	it("offers all projects when the scoped project has no sessions but others do", async () => {
		await renderScreen({ projectId: "p3", projectName: "quiet" });
		expect(screen.getByText("No sessions in this project in the last 6 hours.")).toBeTruthy();
		expect(screen.queryByText("No Claude task sessions in the last 6 hours.")).toBeNull();
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		await user.click(screen.getByRole("button", { name: "Show all projects" }));
		expect(titles()).toHaveLength(4);
	});
});
