#!/usr/bin/env -S deno run -A
/**
 * Integration test that simulates a real user repository
 *
 * This script:
 * 1. Creates a temporary git repository
 * 2. Installs deno-hooks from the local source
 * 3. Tests that hooks catch formatting/linting errors
 * 4. Tests that hooks allow good commits
 * 5. Cleans up the temporary directory
 */

import { join } from "@std/path";

const TEMP_DIR = "/tmp/deno-hooks-integration-test";
const DENO_HOOKS_SRC = Deno.cwd();

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function run(
  cmd: string[],
  options?: { cwd?: string; expectFailure?: boolean },
): Promise<{ success: boolean; output: string }> {
  const command = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    cwd: options?.cwd || TEMP_DIR,
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await command.output();
  const output = new TextDecoder().decode(stdout) +
    new TextDecoder().decode(stderr);

  const success = options?.expectFailure ? code !== 0 : code === 0;
  return { success, output };
}

async function cleanup() {
  try {
    await Deno.remove(TEMP_DIR, { recursive: true });
  } catch {
    // Ignore if doesn't exist
  }
}

async function setup() {
  console.log("Setting up test repository...");

  // Clean up any existing test dir
  await cleanup();

  // Create temp directory
  await Deno.mkdir(TEMP_DIR, { recursive: true });

  // Initialize git repo
  await run(["git", "init"]);
  await run(["git", "config", "user.email", "test@example.com"]);
  await run(["git", "config", "user.name", "Test User"]);

  // Create deno.json with tasks
  const denoJson = {
    tasks: {
      fmt: "deno fmt --check",
      lint: "deno lint",
    },
  };
  // Write with trailing newline so deno fmt is happy
  await Deno.writeTextFile(
    join(TEMP_DIR, "deno.json"),
    JSON.stringify(denoJson, null, 2) + "\n",
  );

  // Create deno-hooks.yml configuration
  const config = `hooks:
  pre-commit:
    - deno task fmt
    - deno task lint
`;
  await Deno.writeTextFile(join(TEMP_DIR, "deno-hooks.yml"), config);

  // Install hooks from local source for integration testing
  // This tests the actual code changes before publishing
  // Use --yes to skip prompts
  const installResult = await run([
    "deno",
    "run",
    "-A",
    join(DENO_HOOKS_SRC, "src/install.ts"),
    "--yes",
  ]);

  if (!installResult.success) {
    throw new Error(
      `Failed to install hooks: ${installResult.output}`,
    );
  }

  console.log("Test repository ready\n");
}

async function testHookScriptIsStandalone() {
  console.log("Test: Hook script is self-contained...");

  // Read the installed pre-commit hook
  const hookPath = join(TEMP_DIR, ".git/hooks/pre-commit");
  const hookContent = await Deno.readTextFile(hookPath);

  console.log("  Hook script content:");
  console.log("  " + hookContent.split("\n").join("\n  "));

  // Verify script structure
  const hasShebang = hookContent.startsWith("#!/bin/sh");
  const hasSetE = hookContent.includes("set -e");
  const hasCommands = hookContent.includes("deno task fmt") &&
    hookContent.includes("deno task lint");
  const hasSuccessMessage = hookContent.includes("All hooks passed");
  const hasNoDenoHooksReference = !hookContent.includes("src/run.ts") &&
    !hookContent.includes("jsr:@theswanfactory/deno-hooks");

  if (
    hasShebang && hasSetE && hasCommands && hasSuccessMessage &&
    hasNoDenoHooksReference
  ) {
    results.push({
      name: "Hook script is self-contained",
      passed: true,
    });
    console.log("  PASS: Hook script is self-contained and standalone\n");
  } else {
    results.push({
      name: "Hook script is self-contained",
      passed: false,
      error:
        `Missing required elements: shebang=${hasShebang}, set -e=${hasSetE}, commands=${hasCommands}, success=${hasSuccessMessage}, standalone=${hasNoDenoHooksReference}`,
    });
    console.log("  FAIL: Hook script is not properly self-contained\n");
  }
}

async function testHookCatchesBadFormatting() {
  console.log("Test: Hooks catch bad formatting...");

  // Create a badly formatted TypeScript file
  const badTs = `const x=1;const y=2;console.log(x,y);`;
  await Deno.writeTextFile(join(TEMP_DIR, "bad.ts"), badTs);

  // Try to commit - should fail
  await run(["git", "add", "bad.ts"]);
  const result = await run(
    ["git", "commit", "-m", "Test bad formatting"],
    { expectFailure: true },
  );

  if (result.success) {
    results.push({
      name: "Hooks catch bad formatting",
      passed: true,
    });
    console.log("  PASS: Hook rejected bad formatting\n");
  } else {
    results.push({
      name: "Hooks catch bad formatting",
      passed: false,
      error: "Hook did not catch formatting error",
    });
    console.log("  FAIL: Hook did not catch formatting error\n");
  }

  // Clean up
  await run(["git", "reset", "HEAD", "bad.ts"]);
  await Deno.remove(join(TEMP_DIR, "bad.ts"));
}

async function testHookCatchesLintErrors() {
  console.log("Test: Hooks catch lint errors...");

  // Create a file with lint errors
  const badTs = `const unused_var = 123;
console.log("hello");
`;
  await Deno.writeTextFile(join(TEMP_DIR, "bad.ts"), badTs);

  // Try to commit - should fail
  await run(["git", "add", "bad.ts"]);
  const result = await run(
    ["git", "commit", "-m", "Test bad linting"],
    { expectFailure: true },
  );

  if (result.success) {
    results.push({
      name: "Hooks catch lint errors",
      passed: true,
    });
    console.log("  PASS: Hook rejected lint errors\n");
  } else {
    results.push({
      name: "Hooks catch lint errors",
      passed: false,
      error: "Hook did not catch lint error",
    });
    console.log("  FAIL: Hook did not catch lint error\n");
  }

  // Clean up
  await run(["git", "reset", "HEAD", "bad.ts"]);
  await Deno.remove(join(TEMP_DIR, "bad.ts"));
}

async function testHookAllowsGoodCommit() {
  console.log("Test: Hooks allow good commits...");

  // Create a properly formatted file
  const goodTs = `const message = "hello world";
console.log(message);
`;
  await Deno.writeTextFile(join(TEMP_DIR, "good.ts"), goodTs);

  // Try to commit - should succeed
  await run(["git", "add", "good.ts"]);
  const result = await run(["git", "commit", "-m", "Test good commit"]);

  if (result.success && result.output.includes("All hooks passed")) {
    results.push({
      name: "Hooks allow good commits",
      passed: true,
    });
    console.log("  PASS: Hook allowed good commit\n");
  } else {
    results.push({
      name: "Hooks allow good commits",
      passed: false,
      error: "Hook rejected valid code",
    });
    console.log("  FAIL: Hook rejected valid code\n");
  }
}

function printResults() {
  console.log("\n" + "=".repeat(60));
  console.log("INTEGRATION TEST RESULTS");
  console.log("=".repeat(60) + "\n");

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    if (result.passed) {
      console.log(`PASS: ${result.name}`);
      passed++;
    } else {
      console.log(`FAIL: ${result.name}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);

  return failed === 0;
}

// Main execution
try {
  console.log("Running integration tests for deno-hooks\n");

  await setup();
  await testHookScriptIsStandalone();
  await testHookCatchesBadFormatting();
  await testHookCatchesLintErrors();
  await testHookAllowsGoodCommit();

  const success = printResults();

  await cleanup();

  if (!success) {
    Deno.exit(1);
  }
} catch (error) {
  console.error("\nIntegration test failed:", error);
  await cleanup();
  Deno.exit(1);
}
