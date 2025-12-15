/**
 * Tests for deno-hooks
 */

import { expect } from "@std/expect";
import { loadConfig } from "./config.ts";

Deno.test("loadConfig - parses YAML configuration", async () => {
  // Use parent directory where deno-hooks.yml is located
  const rootDir = new URL("..", import.meta.url).pathname;
  const config = await loadConfig(rootDir);
  expect(config).toBeDefined();
  expect(config.hooks).toBeDefined();
  expect(config.hooks["pre-commit"]).toBeDefined();
  expect(Array.isArray(config.hooks["pre-commit"])).toBe(true);
});

Deno.test("loadConfig - validates commands are strings", async () => {
  const rootDir = new URL("..", import.meta.url).pathname;
  const config = await loadConfig(rootDir);

  for (const commands of Object.values(config.hooks)) {
    expect(Array.isArray(commands)).toBe(true);
    for (const command of commands) {
      expect(typeof command).toBe("string");
      expect(command.trim().length).toBeGreaterThan(0);
    }
  }
});
