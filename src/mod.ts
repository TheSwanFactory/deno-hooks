/**
 * Deno Hooks - A zero-dependency git hooks framework for Deno
 *
 * This module provides a declarative way to configure and run git hooks
 * using pure TypeScript without requiring Python (pre-commit) or Node.js (Husky).
 *
 * @example Basic usage
 * ```ts
 * import { install } from "@theswanfactory/deno-hooks";
 *
 * // Install git hooks based on deno-hooks.yml configuration
 * await install();
 * ```
 *
 * @example Programmatic hook execution
 * ```ts
 * import { run } from "@theswanfactory/deno-hooks";
 *
 * // Run pre-commit hooks
 * const exitCode = await run("pre-commit");
 * Deno.exit(exitCode);
 * ```
 *
 * @example Configuration types
 * ```ts
 * import type { Config, Hook } from "@theswanfactory/deno-hooks";
 *
 * const config: Config = {
 *   hooks: {
 *     "pre-commit": [
 *       {
 *         id: "deno-fmt",
 *         run: "deno-fmt",
 *         glob: "*.{ts,js,json,md}",
 *         pass_filenames: true,
 *       },
 *     ],
 *   },
 * };
 * ```
 *
 * @module
 */

export { install } from "./install.ts";
export { run } from "./run.ts";
export type { Config, Hook } from "./config.ts";
export type { HookContext, HookResult } from "./hook.ts";

// When run directly (e.g., deno run -A jsr:@theswanfactory/deno-hooks)
// automatically run the installer
if (import.meta.main) {
  const { install } = await import("./install.ts");
  try {
    await install();
  } catch (error) {
    console.error(
      "\n❌ Installation failed:",
      error instanceof Error ? error.message : String(error),
    );
    Deno.exit(1);
  }
}
