import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Both entries boot the whole app, so they cannot be imported in a test; their
// source is the cheapest evidence. `dev3 remote` runs headless-entry, not index.ts.
const source = (file: string) => readFileSync(join(import.meta.dirname, "..", file), "utf8");

const JOBS = [
	"startScheduledLaunchScheduler",
	"startAutomationsScheduler",
	"startScheduledMessageScheduler",
	"startTaskKeepAliveScheduler",
	"startWorktreeCleanupScheduler",
	"startFocusTracker",
];

describe("background job wiring", () => {
	it.each(JOBS.flatMap((job) => ["index.ts", "headless-entry.ts"].map((file) => [file, job])))("%s calls %s()", (file, job) => {
		expect(source(file)).toMatch(new RegExp(`^${job}\\(\\);$`, "m"));
	});

	it("headless-entry stops the launch scheduler and flushes the focus tracker on shutdown", () => {
		const headless = source("headless-entry.ts");
		expect(headless).toMatch(/^\tstopScheduledLaunchScheduler\(\);$/m);
		expect(headless).toMatch(/^\tstopFocusTracker\(\);/m);
	});
});
