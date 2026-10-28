/** Placeholders a value in Settings -> Agents -> Default agent environment may use. */
export const AGENT_ENV_DEFAULT_PLACEHOLDERS = ["{projectPath}", "{projectName}"] as const;

export function expandAgentEnvDefault(value: string, project: { path: string; name: string }): string {
	return value.replaceAll("{projectPath}", project.path).replaceAll("{projectName}", project.name);
}

/**
 * Fill the keys a project's own env leaves unset from the global defaults.
 * A key the project sets - even to an empty string - always keeps its value.
 */
export function applyAgentEnvDefaults(
	projectEnv: Record<string, string>,
	defaults: Record<string, string> | undefined,
	project: { path: string; name: string },
): Record<string, string> {
	if (!defaults) return projectEnv;
	const filled: Record<string, string> = {};
	for (const [key, value] of Object.entries(defaults)) {
		if (!(key in projectEnv)) filled[key] = expandAgentEnvDefault(value, project);
	}
	return Object.keys(filled).length > 0 ? { ...filled, ...projectEnv } : projectEnv;
}
