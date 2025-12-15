/**
 * Deno Hooks - A zero-dependency git hooks framework for Deno
 *
 * This module provides a simple way to configure and run git hooks
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
 * @example Configuration types
 * ```ts
 * import type { Config } from "@theswanfactory/deno-hooks";
 *
 * const config: Config = {
 *   hooks: {
 *     "pre-commit": [
 *       "deno task fmt",
 *       "deno task lint"
 *     ],
 *   },
 * };
 * ```
 *
 * @module
 */

export { install } from "./install.ts";
export type { Config } from "./config.ts";

// When run directly (e.g., deno run -A jsr:@theswanfactory/deno-hooks)
// automatically run the installer
if (import.meta.main) {
  const { install } = await import("./install.ts");
  try {
    await install();
  } catch (error) {
    console.error(
      "\nInstallation failed:",
      error instanceof Error ? error.message : String(error),
    );
    Deno.exit(1);
  }
}
