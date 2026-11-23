/**
 * Tests for deno-hooks
 */

import { expect } from "@std/expect";
import { loadConfig, normalizeCommand } from "./config.ts";

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
      const { run } = normalizeCommand(command);
      expect(typeof run).toBe("string");
      expect(run.trim().length).toBeGreaterThan(0);
    }
  }
});

Deno.test("normalizeCommand - run_in defaults to staged", () => {
  expect(normalizeCommand("deno task fmt")).toEqual({
    run: "deno task fmt",
    run_in: "staged",
  });
  expect(normalizeCommand({ run: "deno fmt" })).toEqual({
    run: "deno fmt",
    run_in: "staged",
  });
  expect(normalizeCommand({ run: "deno fmt", run_in: "working" })).toEqual({
    run: "deno fmt",
    run_in: "working",
  });
});

Deno.test("loadConfig - rejects an invalid run_in", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(
      `${dir}/deno-hooks.yml`,
      "hooks:\n  pre-commit:\n    - run: deno fmt\n      run_in: index\n",
    );
    await expect(loadConfig(dir)).rejects.toThrow("run_in");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});
