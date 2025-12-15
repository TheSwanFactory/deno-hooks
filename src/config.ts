/**
 * Configuration types and parsing for deno-hooks
 */

import { parse as parseYaml } from "@std/yaml";

/**
 * Complete configuration structure
 */
export interface Config {
  hooks: {
    [hookName: string]: string[];
  };
}

/**
 * Load configuration from deno-hooks.yml or deno.json
 *
 * Tries to load configuration in this order:
 * 1. deno-hooks.yml (YAML format)
 * 2. deno.json with "deno-hooks" key (JSON format)
 *
 * @param rootDir - The git repository root directory
 * @returns Parsed and validated configuration
 *
 * @throws {Error} If no configuration found
 * @throws {Error} If configuration is invalid or malformed
 *
 * @example
 * ```ts
 * import { loadConfig } from "@theswanfactory/deno-hooks/config";
 *
 * const config = await loadConfig("/path/to/repo");
 * console.log(config.hooks);
 * ```
 */
export async function loadConfig(rootDir: string): Promise<Config> {
  // Try deno-hooks.yml first
  const yamlPath = `${rootDir}/deno-hooks.yml`;
  try {
    const yamlContent = await Deno.readTextFile(yamlPath);
    const config = parseYaml(yamlContent) as Config;
    validateConfig(config);
    return config;
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse ${yamlPath}: ${message}`);
    }
  }

  // Try deno.json
  const jsonPath = `${rootDir}/deno.json`;
  try {
    const jsonContent = await Deno.readTextFile(jsonPath);
    const json = JSON.parse(jsonContent);
    if (json["deno-hooks"]) {
      const config = json["deno-hooks"] as Config;
      validateConfig(config);
      return config;
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse ${jsonPath}: ${message}`);
    }
  }

  throw new Error(
    "No configuration found. Create deno-hooks.yml or add deno-hooks config to deno.json",
  );
}

/**
 * Validate configuration structure
 */
function validateConfig(config: Config): void {
  if (!config.hooks || typeof config.hooks !== "object") {
    throw new Error("Configuration must have a 'hooks' object");
  }

  for (const [hookName, commands] of Object.entries(config.hooks)) {
    if (!Array.isArray(commands)) {
      throw new Error(`hooks.${hookName} must be an array of commands`);
    }

    for (const command of commands) {
      if (typeof command !== "string") {
        throw new Error(
          `Each command in hooks.${hookName} must be a string, got: ${typeof command}`,
        );
      }
      if (command.trim() === "") {
        throw new Error(
          `Empty command found in hooks.${hookName}`,
        );
      }
    }
  }
}

/**
 * Get commands for a specific git hook trigger
 *
 * @param config - The loaded configuration
 * @param hookName - The git hook trigger name (e.g., "pre-commit")
 * @returns Array of commands for this trigger (empty if none configured)
 *
 * @example
 * ```ts
 * import { getHooksForTrigger, loadConfig } from "@theswanfactory/deno-hooks/config";
 *
 * const config = await loadConfig(".");
 * const commands = getHooksForTrigger(config, "pre-commit");
 * console.log(`Found ${commands.length} pre-commit commands`);
 * ```
 */
export function getHooksForTrigger(config: Config, hookName: string): string[] {
  return config.hooks[hookName] || [];
}
