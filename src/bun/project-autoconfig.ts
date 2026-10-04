import { existsSync } from "node:fs";
import { join } from "node:path";
import type { AutoConfigureResult, Dev3RepoConfig } from "../shared/types";
import { parsePackageScripts, resolveRunnerCommand } from "./package-scripts";
import * as repoConfig from "./repo-config";
import { createLogger } from "./logger";

const log = createLogger("project-autoconfig");

/** Lockfile → install command, for the ecosystems besides JS (JS goes through `detectRunner`). */
const INSTALL_RULES: { file: string; command: string }[] = [
	{ file: "uv.lock", command: "uv sync" },
	{ file: "poetry.lock", command: "poetry install" },
	{ file: "Pipfile.lock", command: "pipenv install" },
	{ file: "Gemfile.lock", command: "bundle install" },
	{ file: "composer.lock", command: "composer install" },
	{ file: "go.sum", command: "go mod download" },
	{ file: "Cargo.lock", command: "cargo fetch" },
];

/** Dev-server script names, most specific first. */
const DEV_SCRIPT_NAMES = ["dev", "start", "serve"];

/**
 * Read what a project folder already says about itself: the install command its
 * lockfiles imply, and the dev server its package.json declares. Pure file reads,
 * nothing is run. `withSetup: false` leaves the setup script out.
 */
export function detectProjectConfig(projectPath: string, opts: { withSetup: boolean }): Dev3RepoConfig {
	const config: Dev3RepoConfig = {};
	const pkg = parsePackageScripts(projectPath);

	if (opts.withSetup) {
		const installs: string[] = [];
		if (pkg.exists) installs.push(`${pkg.runner} install`);
		for (const rule of INSTALL_RULES) {
			if (existsSync(join(projectPath, rule.file))) installs.push(rule.command);
		}
		if (installs.length > 0) config.setupScript = installs.join(" && ");
	}

	const devName = DEV_SCRIPT_NAMES.find((name) => pkg.scripts.some((s) => s.name === name));
	if (devName) config.devScript = resolveRunnerCommand(pkg.runner, devName);

	return config;
}

/**
 * Write the detected settings into `.dev3/config.local.json` of a freshly added
 * project. Never touches a project that already has a `.dev3` config - that one
 * was written by a person, and says so in the result.
 */
export async function autoConfigureProject(
	projectPath: string,
	opts: { isGitRepo: boolean; gitWorkflow: boolean },
): Promise<AutoConfigureResult> {
	if (repoConfig.hasRepoConfig(projectPath) || repoConfig.hasLocalConfig(projectPath)) {
		log.info("Skipping auto-configure, .dev3 config already exists", { path: projectPath });
		return { written: [], existingConfig: true };
	}
	// A task with the git workflow off skips the setup script, so writing one would be noise.
	const config = detectProjectConfig(projectPath, { withSetup: opts.gitWorkflow });
	const keys = Object.keys(config);
	if (keys.length === 0) return { written: [] };
	await repoConfig.saveRepoLocalConfig(projectPath, config, { gitignore: opts.isGitRepo });
	log.info("Auto-configured project", { path: projectPath, fields: keys });
	return { written: keys };
}
