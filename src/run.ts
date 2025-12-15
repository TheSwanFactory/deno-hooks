#!/usr/bin/env -S deno run -A

/**
 * Git hooks execution entrypoint
 *
 * This module runs configured git hooks for a specific trigger.
 * Typically called by git hook wrapper scripts, but can also be used programmatically.
 *
 * @example CLI usage
 * ```bash
 * deno run -A jsr:@theswanfactory/deno-hooks/run pre-commit
 * ```
 *
 * @example Programmatic usage
 * ```ts
 * import { run } from "@theswanfactory/deno-hooks/run";
 * const exitCode = await run("pre-commit");
 * ```
 *
 * @module
 */

import { getHooksForTrigger, loadConfig } from "./config.ts";
import {
  filterFiles,
  getGitRoot,
  getStagedFiles,
  isExcluded,
} from "./files.ts";
import { executeHook } from "./executor.ts";
import type { HookResult } from "./hook.ts";

/**
 * Run hooks for a specific git trigger
 *
 * This function:
 * 1. Loads the project configuration
 * 2. Gets hooks configured for the specified trigger
 * 3. For pre-commit, filters to staged files only
 * 4. Executes each hook sequentially
 * 5. Reports results and returns exit code
 *
 * @param hookName - The git hook trigger name (e.g., "pre-commit", "pre-push")
 * @returns Exit code (0 = success, 1 = failure)
 *
 * @throws {Error} If not in a git repository
 * @throws {Error} If configuration is invalid
 *
 * @example
 * ```ts
 * import { run } from "@theswanfactory/deno-hooks";
 *
 * const exitCode = await run("pre-commit");
 * if (exitCode !== 0) {
 *   Deno.exit(exitCode);
 * }
 * ```
 */
export async function run(hookName: string): Promise<number> {
  try {
    // Get git root
    const gitRoot = await getGitRoot();

    // Load configuration
    const config = await loadConfig(gitRoot);

    // Get hooks for this trigger
    const hooks = getHooksForTrigger(config, hookName);

    if (hooks.length === 0) {
      console.log(`No hooks configured for ${hookName}`);
      return 0;
    }

    console.log(`\n🔍 Running ${hookName} hooks...\n`);

    // Get relevant files based on hook type
    let files: string[];
    if (hookName === "pre-commit") {
      files = await getStagedFiles();
      if (files.length === 0) {
        console.log("No staged files to check");
        return 0;
      }
    } else {
      // For other hooks (pre-push, etc.), we don't filter by files
      files = [];
    }

    // Execute hooks sequentially (parallel execution in phase 2)
    const results: Array<{ id: string; result: HookResult }> = [];

    for (const hook of hooks) {
      // Filter files by glob pattern if specified
      let matchedFiles = files;
      if (hook.glob && files.length > 0) {
        matchedFiles = filterFiles(files, hook.glob);

        // Apply exclude pattern if specified
        if (hook.exclude) {
          matchedFiles = matchedFiles.filter((f) =>
            !isExcluded(f, [hook.exclude!])
          );
        }

        // Skip if no files match
        if (matchedFiles.length === 0 && hook.pass_filenames) {
          console.log(`  ⊘ ${hook.name || hook.id} (no matching files)`);
          continue;
        }
      }

      // Execute hook
      const result = await executeHook({
        files: matchedFiles,
        hookName,
        config: hook,
        rootDir: gitRoot,
      });

      results.push({ id: hook.name || hook.id, result });

      // Display result
      if (result.success) {
        const msg = result.message ? ` (${result.message})` : "";
        console.log(`  ✓ ${hook.name || hook.id}${msg}`);
      } else {
        const msg = result.message ? `\n    ${result.message}` : "";
        console.error(`  ✗ ${hook.name || hook.id}${msg}`);
      }
    }

    // Summary
    console.log();
    const failed = results.filter((r) => !r.result.success);

    if (failed.length === 0) {
      console.log("All hooks passed! ✨");
      return 0;
    } else {
      console.error(`Hooks failed! ❌\n`);
      console.error(`${failed.length} hook(s) failed:`);
      for (const { id } of failed) {
        console.error(`  - ${id}`);
      }
      console.error("\nFix the issues above and try again.");
      return 1;
    }
  } catch (error) {
    console.error(
      "\n❌ Error:",
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

// Run if called directly
if (import.meta.main) {
  const hookName = Deno.args[0];

  if (!hookName) {
    console.error("Usage: deno run -A run.ts <hook-name>");
    Deno.exit(1);
  }

  const exitCode = await run(hookName);
  Deno.exit(exitCode);
}
