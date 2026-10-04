import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { autoConfigureProject, detectProjectConfig } from "../project-autoconfig";

describe("project-autoconfig", () => {
	let tmp: string;

	beforeEach(() => {
		tmp = mkdtempSync(join(tmpdir(), "dev3-autoconfig-"));
	});

	afterEach(() => {
		rmSync(tmp, { recursive: true, force: true });
	});

	const write = (name: string, content = "") => writeFileSync(join(tmp, name), content);
	const localConfig = () => JSON.parse(readFileSync(join(tmp, ".dev3/config.local.json"), "utf-8"));

	describe("detectProjectConfig", () => {
		it("derives install and dev commands from the lockfile runner", () => {
			write("package.json", JSON.stringify({ scripts: { dev: "vite", build: "vite build" } }));
			write("pnpm-lock.yaml");
			expect(detectProjectConfig(tmp, { withSetup: true })).toEqual({
				setupScript: "pnpm install",
				devScript: "pnpm run dev",
			});
		});

		it("falls back to start when there is no dev script", () => {
			write("package.json", JSON.stringify({ scripts: { start: "node server.js" } }));
			expect(detectProjectConfig(tmp, { withSetup: true })).toEqual({
				setupScript: "npm install",
				devScript: "npm run start",
			});
		});

		it("chains installs for every ecosystem it finds", () => {
			write("package.json", JSON.stringify({}));
			write("bun.lock");
			write("uv.lock");
			write("Cargo.lock");
			expect(detectProjectConfig(tmp, { withSetup: true })).toEqual({
				setupScript: "bun install && uv sync && cargo fetch",
			});
		});

		it("leaves the setup script out when asked to", () => {
			write("package.json", JSON.stringify({ scripts: { dev: "vite" } }));
			expect(detectProjectConfig(tmp, { withSetup: false })).toEqual({ devScript: "npm run dev" });
		});

		it("finds nothing in an empty folder", () => {
			expect(detectProjectConfig(tmp, { withSetup: true })).toEqual({});
		});
	});

	describe("autoConfigureProject", () => {
		it("writes config.local.json and gitignores it in a git repository", async () => {
			write("package.json", JSON.stringify({ scripts: { dev: "vite" } }));
			write("bun.lock");

			const keys = await autoConfigureProject(tmp, { isGitRepo: true, gitWorkflow: true });

			expect(keys).toEqual(["setupScript", "devScript"]);
			expect(localConfig()).toEqual({ setupScript: "bun install", devScript: "bun run dev" });
			expect(readFileSync(join(tmp, ".gitignore"), "utf-8")).toContain(".dev3/config.local.json");
			expect(existsSync(join(tmp, ".dev3/config.json"))).toBe(false);
		});

		it("writes no .gitignore and no setup script into a folder without git", async () => {
			write("package.json", JSON.stringify({ scripts: { dev: "vite" } }));

			const keys = await autoConfigureProject(tmp, { isGitRepo: false, gitWorkflow: false });

			expect(keys).toEqual(["devScript"]);
			expect(localConfig()).toEqual({ devScript: "npm run dev" });
			expect(existsSync(join(tmp, ".gitignore"))).toBe(false);
		});

		it("never touches a project that already has a .dev3 config", async () => {
			write("package.json", JSON.stringify({ scripts: { dev: "vite" } }));
			mkdirSync(join(tmp, ".dev3"));
			write(".dev3/config.json", JSON.stringify({ devScript: "make dev" }));

			const keys = await autoConfigureProject(tmp, { isGitRepo: true, gitWorkflow: true });

			expect(keys).toEqual([]);
			expect(existsSync(join(tmp, ".dev3/config.local.json"))).toBe(false);
		});

		it("creates no .dev3 folder when nothing is detected", async () => {
			const keys = await autoConfigureProject(tmp, { isGitRepo: true, gitWorkflow: true });

			expect(keys).toEqual([]);
			expect(existsSync(join(tmp, ".dev3"))).toBe(false);
		});
	});
});
