import { describe, it, expect, vi, beforeEach } from "vitest";

// Linux backend: `caffeinate` is missing, `systemd-inhibit` is found.
// Each test re-imports the module so the cached backend detection and the
// failure counter start from scratch.

vi.mock("../spawn", () => ({
	spawn: vi.fn(),
	spawnSync: vi.fn((cmd: string[]) =>
		cmd[1] === "systemd-inhibit"
			? { exitCode: 0, stdout: Buffer.from("/usr/bin/systemd-inhibit\n") }
			: { exitCode: 1, stdout: Buffer.from("") },
	),
}));

vi.mock("../settings", () => ({
	loadSettingsSync: vi.fn(() => ({ preventSleepWhileRunning: true })),
}));

vi.mock("../logger", () => ({
	createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

function fakeProc(exitCode: number) {
	return { pid: 4242, kill: vi.fn(), exited: Promise.resolve(exitCode) };
}

async function load() {
	vi.resetModules();
	const caffeinate = await import("../caffeinate");
	const { spawn } = await import("../spawn");
	return { ...caffeinate, spawn: spawn as unknown as ReturnType<typeof vi.fn> };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("caffeinate (systemd-inhibit backend)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("passes --why, the flag systemd-inhibit accepts, not --reason", async () => {
		const { updateCaffeinateState, spawn } = await load();
		spawn.mockReturnValue(fakeProc(0));

		updateCaffeinateState(false);

		const cmd = spawn.mock.calls[0][0] as string[];
		expect(cmd[0]).toBe("/usr/bin/systemd-inhibit");
		expect(cmd).toContain("--why=Agents running");
		expect(cmd.some((arg) => arg.startsWith("--reason"))).toBe(false);
	});

	it("stops retrying after repeated immediate non-zero exits", async () => {
		const { updateCaffeinateState, isCaffeinateAvailable, spawn } = await load();
		spawn.mockImplementation(() => fakeProc(1));

		for (let i = 0; i < 5; i++) {
			updateCaffeinateState(false);
			await flush();
		}

		expect(spawn).toHaveBeenCalledTimes(3);
		expect(isCaffeinateAvailable()).toBe(false);
	});

	it("does not count a deliberate stop as a failure", async () => {
		const { updateCaffeinateState, shutdownCaffeinate, isCaffeinateAvailable, spawn } = await load();
		spawn.mockImplementation(() => fakeProc(143));

		for (let i = 0; i < 5; i++) {
			updateCaffeinateState(false);
			shutdownCaffeinate();
			await flush();
		}

		expect(spawn).toHaveBeenCalledTimes(5);
		expect(isCaffeinateAvailable()).toBe(true);
	});
});
