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
			expect(detectProjectConfig(tmp)).toEqual({
				setupScript: "pnpm install",
				devScript: "pnpm run dev",
			});
		});

		it("falls back to start when there is no dev script", () => {
			write("package.json", JSON.stringify({ scripts: { start: "node server.js" } }));
			expect(detectProjectConfig(tmp)).toEqual({
				setupScript: "npm install",
				devScript: "npm run start",
			});
		});

		it("chains installs for every ecosystem it finds", () => {
			write("package.json", JSON.stringify({}));
			write("bun.lock");
			write("uv.lock");
			write("Cargo.lock");
			expect(detectProjectConfig(tmp)).toEqual({
				setupScript: "bun install && uv sync && cargo fetch",
			});
		});

		it("finds nothing in an empty folder", () => {
			expect(detectProjectConfig(tmp)).toEqual({});
		});
	});

	describe("autoConfigureProject", () => {
		it("writes config.local.json and gitignores it", async () => {
			write("package.json", JSON.stringify({ scripts: { dev: "vite" } }));
			write("bun.lock");

			const result = await autoConfigureProject(tmp);

			expect(result).toEqual({ written: ["setupScript", "devScript"] });
			expect(localConfig()).toEqual({ setupScript: "bun install", devScript: "bun run dev" });
			expect(readFileSync(join(tmp, ".gitignore"), "utf-8")).toContain(".dev3/config.local.json");
			expect(existsSync(join(tmp, ".dev3/config.json"))).toBe(false);
		});

		it("never touches a project that already has a .dev3 config", async () => {
			write("package.json", JSON.stringify({ scripts: { dev: "vite" } }));
			mkdirSync(join(tmp, ".dev3"));
			write(".dev3/config.json", JSON.stringify({ devScript: "make dev" }));

			const result = await autoConfigureProject(tmp);

			expect(result).toEqual({ written: [], existingConfig: true });
			expect(existsSync(join(tmp, ".dev3/config.local.json"))).toBe(false);
		});

		it("creates no .dev3 folder when nothing is detected", async () => {
			const result = await autoConfigureProject(tmp);

			expect(result).toEqual({ written: [] });
			expect(existsSync(join(tmp, ".dev3"))).toBe(false);
		});
	});
});
