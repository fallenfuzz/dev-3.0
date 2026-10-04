# Opt-in project auto-configure on add

## Context

Adding a project never wrote a `.dev3/` config. Its settings lived in `projects.json`, and the setup and dev scripts stayed empty until someone filled them in through Project Settings, `dev3 config` or the `/dev3-project-config` agent skill. Some users want a project that works on the first task; others do not want dev3 to write any file into their repository.

## Decision

- The Add Project dialog has an `Auto-configure` switch on its Local and Clone panes. It is off by default, and its last position is kept in `GlobalSettings.autoConfigureNewProjects`.
- On, `addProject` and `cloneAndAddProject` call `autoConfigureProject` (`src/bun/project-autoconfig.ts`). It reads lockfiles and `package.json`, writes `setupScript` and `devScript` to `.dev3/config.local.json`, and returns the keys written. The dialog names them in a toast.
- It writes the local file, not `.dev3/config.json`, so nothing new shows up in the team's git status. The user can promote the values in Project Settings.
- It skips a project that already has either `.dev3` file, writes no `.gitignore` into a folder without git, and leaves out `setupScript` when the git workflow is off, because those tasks skip it.
- Detection is file reads only, with no agent and no command run. `clonePaths` keeps its existing always-on detection in `data.addProject`.

## Risks

- A wrong guess, such as `npm install` for a repo that uses a different installer, runs on the first task. The toast and the local file make it visible and easy to edit.
- Detection covers only the root folder. A monorepo with installs in subfolders gets the root command only.

## Alternatives considered

- **Always on:** writes files the user did not ask for. Some users treat that as a breach of trust.
- **A checklist step before the add:** the folder picker adds several folders at once, so a review step would turn the dialog into a wizard.
- **Spawn an agent task with `/dev3-project-config`:** handles any stack and checks the scripts by running them, but it spends tokens and needs an agent on every add. It stays the manual path for full configuration.
- **Pin `CLAUDE_CONFIG_DIR` to a project's `.claude/`:** many repos commit `.claude/` for project settings, so the pin would point the agent at an empty config dir and sign it out.
