#!/usr/bin/env -S deno run -A
/**
 * Version Management Script
 *
 * This script provides comprehensive version management:
 * - Display current version
 * - Bump version (patch/minor/major)
 * - Create and push git tags (stable and dev pre-releases)
 *
 * Usage:
 *   deno task version              # Display current version
 *   deno task version patch        # Bump patch version (0.2.0 -> 0.2.1)
 *   deno task version minor        # Bump minor version (0.2.0 -> 0.3.0)
 *   deno task version major        # Bump major version (0.2.0 -> 1.0.0)
 *   deno task version tag          # Create and push git tag for current version
 *   deno task version dev          # Create and push dev pre-release tag
 */

import { join } from "@std/path";
import { format, increment, parse } from "@std/semver";

interface DenoConfig {
  version: string;
  [key: string]: unknown;
}

type BumpType = "patch" | "minor" | "major";

async function runCommand(
  cmd: string[],
  options?: { silent?: boolean },
): Promise<{ success: boolean; output: string }> {
  const command = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await command.output();
  const output = new TextDecoder().decode(stdout) +
    new TextDecoder().decode(stderr);

  if (!options?.silent) {
    console.log(output);
  }

  return { success: code === 0, output };
}

async function getConfig(): Promise<{ config: DenoConfig; path: string }> {
  const configPath = join(Deno.cwd(), "deno.json");
  const configText = await Deno.readTextFile(configPath);
  const config: DenoConfig = JSON.parse(configText);
  return { config, path: configPath };
}

async function getCurrentVersion(): Promise<string> {
  const { config } = await getConfig();
  return config.version;
}

function isDev(version: string): boolean {
  return /^.+-dev\.\d+$/.test(version);
}

function getStableBase(version: string): string {
  const devMatch = version.match(/^(.+)-dev\.(\d+)$/);
  return devMatch ? devMatch[1] : version;
}

function parseSemVerOrThrow(version: string) {
  try {
    return parse(version);
  } catch {
    throw new Error(`Invalid semver in deno.json: ${version}`);
  }
}

function bumpStableVersion(version: string, type: BumpType): string {
  // We intentionally disallow bumping while on a prerelease/dev version to avoid surprises.
  if (version.includes("-")) {
    throw new Error(
      `Cannot bump a prerelease/dev version (${version}). Reset to a stable version first (deno task version reset).`,
    );
  }

  const sem = parseSemVerOrThrow(version);
  const bumped = increment(sem, type);
  return format(bumped);
}

function getTimestampDevVersion(currentVersion: string): string {
  // Always generate a monotonic, merge-safe dev identifier.
  // Use seconds to keep it short and avoid leading zeros.
  const base = getStableBase(currentVersion);
  const epochSeconds = Math.floor(Date.now() / 1000);
  return `${base}-dev.${epochSeconds}`;
}

async function checkGitStatus(): Promise<boolean> {
  const result = await runCommand(["git", "status", "--porcelain"], {
    silent: true,
  });
  return result.output.trim() === "";
}

async function checkTagExists(tag: string): Promise<boolean> {
  const result = await runCommand(["git", "tag", "-l", tag], { silent: true });
  return result.output.trim() === tag;
}

async function displayVersion(): Promise<void> {
  const version = await getCurrentVersion();
  console.log(version);

  if (isDev(version)) {
    console.log("\n⚠️  Current version is a dev pre-release.");
    console.log("To reset to stable version, run: deno task version reset");
  }
}

async function bump(type: BumpType): Promise<void> {
  const currentVersion = await getCurrentVersion();
  const newVersion = bumpStableVersion(currentVersion, type);

  console.log(`📦 Version Bump (${type})\n`);
  console.log(`Current version: ${currentVersion}`);
  console.log(`New version:     ${newVersion}`);

  // Check if working directory is clean
  console.log("\n🔍 Checking git status...");
  const isClean = await checkGitStatus();

  if (!isClean) {
    console.error(
      "\n❌ Working directory is not clean. Please commit or stash your changes first.",
    );
    console.error("Run: git status");
    Deno.exit(1);
  }
  console.log("✅ Working directory is clean");

  // Update version in deno.json
  console.log(`\n📝 Updating deno.json...`);
  await updateVersion(newVersion);
  console.log("✅ Updated deno.json");

  console.log("\n✅ Version bumped successfully!");
  console.log("\nNext steps:");
  console.log("1. Update CHANGELOG.md");
  console.log(`2. Review changes: git diff deno.json`);
  console.log(`3. Commit: git commit -am "Bump version to ${newVersion}"`);
  console.log("4. Push: git push");
  console.log("5. Tag: deno task version tag");
}

async function updateVersion(newVersion: string): Promise<void> {
  const { config, path } = await getConfig();
  config.version = newVersion;

  // Write back with pretty formatting
  const configText = JSON.stringify(config, null, 2) + "\n";
  await Deno.writeTextFile(path, configText);
}

async function resetFromDev(): Promise<void> {
  const currentVersion = await getCurrentVersion();

  if (!isDev(currentVersion)) {
    console.log("✅ Current version is already stable:", currentVersion);
    return;
  }

  const stableVersion = getStableBase(currentVersion);
  console.log("🔄 Resetting from Dev to Stable Version\n");
  console.log(`📦 Current Version: ${currentVersion}`);
  console.log(`📦 Stable Version:  ${stableVersion}`);

  // Check if working directory is clean
  console.log("\n🔍 Checking git status...");
  const isClean = await checkGitStatus();

  if (!isClean) {
    console.error(
      "\n❌ Working directory is not clean. Please commit or stash your changes first.",
    );
    console.error("Run: git status");
    Deno.exit(1);
  }
  console.log("✅ Working directory is clean");

  // Update version in deno.json
  console.log(`\n📝 Updating deno.json to version ${stableVersion}...`);
  await updateVersion(stableVersion);
  console.log("✅ Updated deno.json");

  // Stage and commit only deno.json
  console.log(`\n💾 Committing version change...`);
  await runCommand(["git", "add", "deno.json"]);
  const commitResult = await runCommand([
    "git",
    "commit",
    "-m",
    `Reset version to ${stableVersion} after dev testing`,
  ]);

  if (!commitResult.success) {
    console.error(`\n❌ Failed to commit version change`);
    Deno.exit(1);
  }
  console.log("✅ Committed version change");

  // Push commit
  console.log(`\n📤 Pushing commit to remote...`);
  const pushResult = await runCommand(["git", "push"]);

  if (!pushResult.success) {
    console.error(`\n❌ Failed to push commit`);
    Deno.exit(1);
  }
  console.log(`✅ Pushed commit to remote`);

  console.log("\n✅ Version reset to stable successfully!");
  console.log("\nNext steps:");
  console.log("1. Create release tag: deno task version tag");
}

async function tagDev(): Promise<void> {
  const currentVersion = await getCurrentVersion();
  const devVersion = getTimestampDevVersion(currentVersion);
  const tagName = `v${devVersion}`;

  // Check if tag already exists (very unlikely with timestamp-based dev versions, but still safe)
  console.log(`\n🔍 Checking if tag ${tagName} exists...`);
  const tagExists = await checkTagExists(tagName);
  if (tagExists) {
    console.error(
      `\n❌ Tag ${tagName} already exists. Re-run to generate a new timestamped dev version.`,
    );
    Deno.exit(1);
  }
  console.log(`✅ Tag ${tagName} does not exist yet`);

  console.log("🏷️  Creating Dev Pre-release Tag\n");
  console.log(`📦 Current Version: ${currentVersion}`);
  console.log(`📦 New Dev Version: ${devVersion}`);

  // Check if working directory is clean
  console.log("\n🔍 Checking git status...");
  const isClean = await checkGitStatus();

  if (!isClean) {
    console.error(
      "\n❌ Working directory is not clean. Please commit or stash your changes first.",
    );
    console.error("Run: git status");
    Deno.exit(1);
  }
  console.log("✅ Working directory is clean");

  // Update version in deno.json
  console.log(`\n📝 Updating deno.json to version ${devVersion}...`);
  await updateVersion(devVersion);
  console.log("✅ Updated deno.json");

  // Stage and commit only deno.json
  console.log(`\n💾 Committing version change...`);
  await runCommand(["git", "add", "deno.json"]);
  const commitResult = await runCommand([
    "git",
    "commit",
    "-m",
    `Bump version to ${devVersion} for JSR dev release`,
  ]);

  if (!commitResult.success) {
    console.error(`\n❌ Failed to commit version change`);
    Deno.exit(1);
  }
  console.log("✅ Committed version change");

  // Create tag
  console.log(`\n🏷️  Creating tag ${tagName}...`);
  const createResult = await runCommand([
    "git",
    "tag",
    "-a",
    tagName,
    "-m",
    `Dev pre-release ${devVersion}`,
  ]);

  if (!createResult.success) {
    console.error(`\n❌ Failed to create tag ${tagName}`);
    Deno.exit(1);
  }
  console.log(`✅ Created tag ${tagName}`);

  // Push commit and tag
  console.log(`\n📤 Pushing commit and tag to remote...`);
  const pushResult = await runCommand([
    "git",
    "push",
    "origin",
    "HEAD",
    tagName,
  ]);

  if (!pushResult.success) {
    console.error(`\n❌ Failed to push commit and tag`);
    console.error("Cleaning up local tag...");
    await runCommand(["git", "tag", "-d", tagName]);
    Deno.exit(1);
  }
  console.log(`✅ Pushed commit and tag to remote`);

  console.log("\n✅ Dev pre-release tag created successfully!");
  console.log(
    `\n🚀 GitHub Actions will now publish version ${devVersion} to JSR.`,
  );
  console.log(
    "   Check the progress at: https://github.com/TheSwanFactory/deno-hooks/actions",
  );
  console.log(`\n📦 Test without modifying your config:`);
  console.log(`   deno run -A jsr:@theswanfactory/deno-hooks@${devVersion}`);
}

async function tag(): Promise<void> {
  const version = await getCurrentVersion();

  if (isDev(version)) {
    const stableBase = getStableBase(version);
    console.error(
      "❌ Cannot create stable release tag for dev version:",
      version,
    );
    console.error("\nYou must reset to a stable version first.");
    console.error("Run: deno task version reset");
    console.error(`\nThis will reset from ${version} to ${stableBase}`);
    Deno.exit(1);
  }

  const tagName = `v${version}`;

  console.log("🏷️  Creating Git Tag for Release\n");
  console.log(`📦 Version: ${version}`);

  // Check if working directory is clean
  console.log("\n🔍 Checking git status...");
  const isClean = await checkGitStatus();

  if (!isClean) {
    console.error(
      "\n❌ Working directory is not clean. Please commit or stash your changes first.",
    );
    console.error("Run: git status");
    Deno.exit(1);
  }
  console.log("✅ Working directory is clean");

  // Check if tag already exists
  console.log(`\n🔍 Checking if tag ${tagName} exists...`);
  const tagExists = await checkTagExists(tagName);

  if (tagExists) {
    console.error(`\n❌ Tag ${tagName} already exists.`);
    console.error(
      `If you want to update the tag, delete it first with: git tag -d ${tagName} && git push origin :refs/tags/${tagName}`,
    );
    Deno.exit(1);
  }
  console.log(`✅ Tag ${tagName} does not exist yet`);

  // Create tag
  console.log(`\n🏷️  Creating tag ${tagName}...`);
  const createResult = await runCommand([
    "git",
    "tag",
    "-a",
    tagName,
    "-m",
    `Release ${version}`,
  ]);

  if (!createResult.success) {
    console.error(`\n❌ Failed to create tag ${tagName}`);
    Deno.exit(1);
  }
  console.log(`✅ Created tag ${tagName}`);

  // Push tag
  console.log(`\n📤 Pushing tag ${tagName} to remote...`);
  const pushResult = await runCommand(["git", "push", "origin", tagName]);

  if (!pushResult.success) {
    console.error(`\n❌ Failed to push tag ${tagName}`);
    console.error("Cleaning up local tag...");
    await runCommand(["git", "tag", "-d", tagName]);
    Deno.exit(1);
  }
  console.log(`✅ Pushed tag ${tagName} to remote`);

  console.log("\n✅ Release tag created successfully!");
  console.log(
    `\n🚀 GitHub Actions will now publish version ${version} to JSR.`,
  );
  console.log(
    "   Check the progress at: https://github.com/TheSwanFactory/deno-hooks/actions",
  );
}

function showHelp(): void {
  console.log(`Version Management Tool

Usage:
  deno task version              Display current version
  deno task version patch        Bump patch version (0.2.0 -> 0.2.1)
  deno task version minor        Bump minor version (0.2.0 -> 0.3.0)
  deno task version major        Bump major version (0.2.0 -> 1.0.0)
  deno task version reset        Reset from dev version to stable (0.2.1-dev.<epoch> -> 0.2.1)
  deno task version tag          Create and push git tag for current version
  deno task version dev          Create and push dev pre-release tag
  deno task version help         Show this help message

Examples:
  # Check current version
  deno task version

  # Bump patch version and commit
  deno task version patch
  git commit -am "Bump version to $(deno task version)"

  # Create dev pre-release for testing (timestamp-based, merge-safe)
  deno task version dev

  # Reset to stable version after dev testing
  deno task version reset

  # Create stable release tag
  deno task version tag
`);
}

// Main execution
try {
  const args = Deno.args;
  const command = args[0];

  switch (command) {
    case undefined:
      await displayVersion();
      break;
    case "patch":
    case "minor":
    case "major":
      await bump(command);
      break;
    case "reset":
      await resetFromDev();
      break;
    case "tag":
      await tag();
      break;
    case "dev":
      await tagDev();
      break;
    case "help":
    case "--help":
    case "-h":
      showHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error("Run 'deno task version help' for usage information");
      Deno.exit(1);
  }
} catch (error) {
  console.error(
    "\n❌ Version operation failed:",
    error instanceof Error ? error.message : String(error),
  );
  Deno.exit(1);
}
