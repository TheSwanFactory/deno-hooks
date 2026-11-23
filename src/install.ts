#!/usr/bin/env -S deno run -A

/**
 * Git hooks installation entrypoint
 *
 * This module provides functionality to install git hooks from your configuration.
 * It can be used as a CLI script or imported programmatically.
 *
 * @example CLI usage
 * ```bash
 * # Install hooks
 * deno run -A jsr:@theswanfactory/deno-hooks
 *
 * # Install with automatic yes to prompts
 * deno run -A jsr:@theswanfactory/deno-hooks --yes
 *
 * # Install with verbose output
 * deno run -A jsr:@theswanfactory/deno-hooks --verbose
 * ```
 *
 * @example Programmatic usage
 * ```ts
 * import { install } from "@theswanfactory/deno-hooks";
 * await install();
 * ```
 *
 * @module
 */

import { ensureDir } from "@std/fs";
import { resolve } from "@std/path";
import { loadConfig } from "./config.ts";

/**
 * Options for installing hooks
 */
export interface InstallOptions {
  /** Skip interactive prompts and use defaults */
  yes?: boolean;
  /** Show detailed output during installation */
  verbose?: boolean;
}

/**
 * Get the git repository root directory
 */
async function getGitRoot(): Promise<string> {
  const command = new Deno.Command("git", {
    args: ["rev-parse", "--show-toplevel"],
    stdout: "piped",
    stderr: "piped",
  });

  const { success, stdout, stderr } = await command.output();

  if (!success) {
    const error = new TextDecoder().decode(stderr);
    throw new Error(`Failed to get git root: ${error}`);
  }

  return new TextDecoder().decode(stdout).trim();
}

/**
 * Get the directory git reads hooks from
 *
 * Asks git instead of building `<git root>/.git/hooks`: in a linked worktree
 * `.git` is a file, and `core.hooksPath` can point somewhere else.
 */
async function getHooksDir(): Promise<string> {
  const command = new Deno.Command("git", {
    args: ["rev-parse", "--git-path", "hooks"],
    stdout: "piped",
    stderr: "piped",
  });

  const { success, stdout, stderr } = await command.output();

  if (!success) {
    const error = new TextDecoder().decode(stderr);
    throw new Error(`Failed to get git hooks directory: ${error}`);
  }

  // git may answer with a path relative to the current directory. The git
  // command above and resolve() must share the process cwd: do not pass a
  // `cwd` to the command without resolving against that same directory.
  return resolve(new TextDecoder().decode(stdout).trim());
}

/**
 * Install git hooks based on the project configuration
 *
 * This function:
 * 1. Validates that configuration exists (deno-hooks.yml or deno.json)
 * 2. Creates the hooks directory git reports (`git rev-parse --git-path hooks`)
 *    if needed
 * 3. Generates self-contained shell scripts for each configured hook
 * 4. Makes scripts executable (Unix/Linux/macOS)
 *
 * @param options - Installation options
 * @throws {Error} If not in a git repository
 * @throws {Error} If no configuration found
 * @throws {Error} If configuration is invalid
 *
 * @example
 * ```ts
 * import { install } from "@theswanfactory/deno-hooks";
 *
 * await install();
 * ```
 */
export async function install(options: InstallOptions = {}): Promise<void> {
  const { yes = false, verbose = false } = options;

  if (verbose) {
    console.log("Installing Deno Hooks with verbose output...\n");
  } else {
    console.log("Installing Deno Hooks...\n");
  }

  // Get git root
  const gitRoot = await getGitRoot();
  console.log(`Git root: ${gitRoot}`);
  if (verbose) {
    console.log(`Current directory: ${Deno.cwd()}`);
  }

  // Check if config exists, offer to create default
  let config;
  try {
    config = await loadConfig(gitRoot);
    if (verbose) {
      console.log("Configuration loaded successfully");
    }
  } catch (error) {
    if (
      error instanceof Error && error.message.includes("No configuration found")
    ) {
      // Determine whether to create default config
      let shouldCreate = false;
      if (yes) {
        shouldCreate = true;
      } else {
        shouldCreate = promptCreateDefaultConfig();
      }

      if (shouldCreate) {
        if (verbose) {
          console.log("Creating default configuration file...");
        }
        await createDefaultConfig(gitRoot);
        config = await loadConfig(gitRoot);
        console.log("\nCreated deno-hooks.yml with default configuration");
      } else {
        throw new Error(
          "No configuration found. Create deno-hooks.yml or add deno.json config",
        );
      }
    } else {
      throw error;
    }
  }

  const hookNames = Object.keys(config.hooks);

  // Show what hooks will be installed
  console.log(`\nInstalling ${hookNames.length} hook(s):\n`);
  for (const hookName of hookNames) {
    const commands = config.hooks[hookName];
    console.log(`${hookName}:`);
    for (const command of commands) {
      console.log(`  - ${command}`);
    }
  }

  // Ensure the hooks directory exists
  const hooksDir = await getHooksDir();
  await ensureDir(hooksDir);
  if (verbose) {
    console.log(`\nHooks directory: ${hooksDir}`);
  }

  // Install each hook
  console.log();
  for (const hookName of hookNames) {
    await installHook(hooksDir, hookName, config.hooks[hookName], verbose);
  }

  console.log("\nInstallation complete!");
  console.log("\nHooks will run automatically on commit/push.");
  console.log("To customize, edit deno-hooks.yml in your project root.");
  if (verbose) {
    console.log(
      `\nTip: You can test hooks manually by running them directly from ${hooksDir}/`,
    );
  }
}

/**
 * Install a single git hook
 */
async function installHook(
  hooksDir: string,
  hookName: string,
  commands: string[],
  verbose = false,
): Promise<void> {
  const hookPath = `${hooksDir}/${hookName}`;

  if (verbose) {
    console.log(`  Installing ${hookName}...`);
  }

  // Generate shell script
  const script = generateHookScript(hookName, commands);

  if (verbose) {
    console.log(`    Writing to: ${hookPath}`);
  }

  // Write script
  await Deno.writeTextFile(hookPath, script);

  // Make executable (Unix only - Windows uses git's shell)
  if (Deno.build.os !== "windows") {
    await Deno.chmod(hookPath, 0o755);
    if (verbose) {
      console.log(`    Set executable permissions (0755)`);
    }
  }

  console.log(`  Installed ${hookName}`);
}

/**
 * Generate self-contained shell script for a hook
 *
 * `pre-commit` scripts run their commands inside a temporary copy of the
 * index (see `git checkout-index`), so they check exactly what will be
 * committed: an unrelated unstaged file cannot block the commit, and a
 * working-tree fix cannot hide an unformatted staged file. The working tree and
 * the index are never touched, so there is nothing to restore.
 */
function generateHookScript(
  hookName: string,
  commands: string[],
): string {
  const commandLines = commands.map((cmd) => cmd).join("\n");

  if (hookName !== "pre-commit") {
    return `#!/bin/sh
# Generated by deno-hooks - DO NOT EDIT
# To update, run: deno task hooks

set -e

${commandLines}

echo "✓ All hooks passed"
`;
  }

  return `#!/bin/sh
# Generated by deno-hooks - DO NOT EDIT
# To update, run: deno task hooks

set -e

# Run the commands against the staged content, not the working tree.
# checkout-index honors GIT_INDEX_FILE, so \`git commit -a\` and
# \`git commit <paths>\` check what they are about to commit.
DENO_HOOKS_TMP=$(mktemp -d "\${TMPDIR:-/tmp}/deno-hooks.XXXXXX")
trap 'rm -rf "$DENO_HOOKS_TMP"' EXIT
trap 'exit 1' HUP INT TERM
git checkout-index --all --force --prefix="$DENO_HOOKS_TMP/"
cd "$DENO_HOOKS_TMP"

${commandLines}

echo "✓ All hooks passed"
`;
}

/**
 * Prompt user to create default configuration
 */
function promptCreateDefaultConfig(): boolean {
  console.log("\nNo configuration file found");
  console.log(
    "\nWould you like to create a default deno-hooks.yml with basic hooks?",
  );
  console.log("  - pre-commit: deno task fmt, deno task lint");
  console.log("  - pre-push: deno task test");

  const response = prompt("\nCreate default configuration? [Y/n]");
  return !response || response.toLowerCase() === "y" ||
    response.toLowerCase() === "yes";
}

/**
 * Create default configuration file
 */
async function createDefaultConfig(gitRoot: string): Promise<void> {
  const defaultConfig = `# Deno Hooks Configuration
# Learn more: https://jsr.io/@theswanfactory/deno-hooks

hooks:
  pre-commit:
    - deno task fmt
    - deno task lint

  pre-push:
    - deno task test
`;

  const configPath = `${gitRoot}/deno-hooks.yml`;
  await Deno.writeTextFile(configPath, defaultConfig);
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): InstallOptions {
  const options: InstallOptions = {};

  for (const arg of args) {
    if (arg === "--yes" || arg === "-y") {
      options.yes = true;
    } else if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      Deno.exit(0);
    }
  }

  return options;
}

/**
 * Print CLI help message
 */
function printHelp(): void {
  console.log(`
Deno Hooks - Git hooks for Deno projects

USAGE:
  deno run -A deno-hooks [OPTIONS]

OPTIONS:
  --yes, -y       Skip interactive prompts (use defaults)
  --verbose, -v   Show detailed output during installation
  --help, -h      Show this help message

EXAMPLES:
  # Install hooks (interactive)
  deno run -A jsr:@theswanfactory/deno-hooks

  # Install with automatic yes
  deno run -A jsr:@theswanfactory/deno-hooks --yes

  # Install with verbose output
  deno run -A jsr:@theswanfactory/deno-hooks --verbose

LEARN MORE:
  https://jsr.io/@theswanfactory/deno-hooks
`);
}

// Run if called directly
if (import.meta.main) {
  try {
    const options = parseArgs(Deno.args);
    await install(options);
  } catch (error) {
    console.error(
      "\nInstallation failed:",
      error instanceof Error ? error.message : String(error),
    );
    Deno.exit(1);
  }
}
