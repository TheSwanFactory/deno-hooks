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
  console.log("🔧 Setting up test repository...");

  // Clean up any existing test dir
  await cleanup();

  // Create temp directory
  await Deno.mkdir(TEMP_DIR, { recursive: true });

  // Initialize git repo
  await run(["git", "init"]);
  await run(["git", "config", "user.email", "test@example.com"]);
  await run(["git", "config", "user.name", "Test User"]);

  // Create deno-hooks.yml configuration
  const config = `hooks:
  pre-commit:
    - id: deno-fmt
      run: deno-fmt
      glob: "*.{ts,js,json,md}"
      pass_filenames: true

    - id: deno-lint
      run: deno-lint
      glob: "*.{ts,js}"
      pass_filenames: true
`;
  await Deno.writeTextFile(join(TEMP_DIR, "deno-hooks.yml"), config);

  // Install hooks from local source
  const installResult = await run([
    "deno",
    "run",
    "-A",
    join(DENO_HOOKS_SRC, "src/install.ts"),
  ]);

  if (!installResult.success) {
    throw new Error(
      `Failed to install hooks: ${installResult.output}`,
    );
  }

  console.log("✅ Test repository ready\n");
}

async function testHookCatchesBadFormatting() {
  console.log("📝 Test: Hooks catch bad formatting...");

  // Create a badly formatted markdown file
  const badMd = `<!-- comment -->
# Header`;
  await Deno.writeTextFile(join(TEMP_DIR, "bad.md"), badMd);

  // Try to commit - should fail
  await run(["git", "add", "bad.md"]);
  const result = await run(
    ["git", "commit", "-m", "Test bad formatting"],
    { expectFailure: true },
  );

  if (result.success && result.output.includes("deno-fmt")) {
    results.push({
      name: "Hooks catch bad formatting",
      passed: true,
    });
    console.log("  ✅ PASS: Hook rejected bad formatting\n");
  } else {
    results.push({
      name: "Hooks catch bad formatting",
      passed: false,
      error: "Hook did not catch formatting error",
    });
    console.log("  ❌ FAIL: Hook did not catch formatting error\n");
  }

  // Clean up
  await run(["git", "reset", "HEAD", "bad.md"]);
  await Deno.remove(join(TEMP_DIR, "bad.md"));
}

async function testHookCatchesLintErrors() {
  console.log("📝 Test: Hooks catch lint errors...");

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

  if (result.success && result.output.includes("deno-lint")) {
    results.push({
      name: "Hooks catch lint errors",
      passed: true,
    });
    console.log("  ✅ PASS: Hook rejected lint errors\n");
  } else {
    results.push({
      name: "Hooks catch lint errors",
      passed: false,
      error: "Hook did not catch lint error",
    });
    console.log("  ❌ FAIL: Hook did not catch lint error\n");
  }

  // Clean up
  await run(["git", "reset", "HEAD", "bad.ts"]);
  await Deno.remove(join(TEMP_DIR, "bad.ts"));
}

async function testHookAllowsGoodCommit() {
  console.log("📝 Test: Hooks allow good commits...");

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
    console.log("  ✅ PASS: Hook allowed good commit\n");
  } else {
    results.push({
      name: "Hooks allow good commits",
      passed: false,
      error: "Hook rejected valid code",
    });
    console.log("  ❌ FAIL: Hook rejected valid code\n");
  }
}

async function testHookPathIsCorrect() {
  console.log("📝 Test: Hook script references correct path...");

  // Read the installed pre-commit hook
  const hookPath = join(TEMP_DIR, ".git/hooks/pre-commit");
  const hookContent = await Deno.readTextFile(hookPath);

  // Check that it references the deno-hooks package, not the test repo
  const hasCorrectPath = hookContent.includes("src/run.ts") &&
    !hookContent.includes(`"${TEMP_DIR}/src/run.ts"`);

  if (hasCorrectPath) {
    results.push({
      name: "Hook script references correct path",
      passed: true,
    });
    console.log("  ✅ PASS: Hook references package path\n");
  } else {
    results.push({
      name: "Hook script references correct path",
      passed: false,
      error: `Hook references wrong path: ${hookContent}`,
    });
    console.log("  ❌ FAIL: Hook references wrong path\n");
  }
}

function printResults() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 INTEGRATION TEST RESULTS");
  console.log("=".repeat(60) + "\n");

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    if (result.passed) {
      console.log(`✅ ${result.name}`);
      passed++;
    } else {
      console.log(`❌ ${result.name}`);
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
  console.log("🧪 Running integration tests for deno-hooks\n");

  await setup();
  await testHookPathIsCorrect();
  await testHookCatchesBadFormatting();
  await testHookCatchesLintErrors();
  await testHookAllowsGoodCommit();

  const success = printResults();

  await cleanup();

  if (!success) {
    Deno.exit(1);
  }
} catch (error) {
  console.error("\n❌ Integration test failed:", error);
  await cleanup();
  Deno.exit(1);
}
