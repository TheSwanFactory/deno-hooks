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

function parseVersion(
  version: string,
): { major: number; minor: number; patch: number } {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3]),
  };
}

function bumpVersion(version: string, type: BumpType): string {
  const { major, minor, patch } = parseVersion(version);

  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
}

async function updateVersion(newVersion: string): Promise<void> {
  const { config, path } = await getConfig();
  config.version = newVersion;

  // Write back with pretty formatting
  const configText = JSON.stringify(config, null, 2) + "\n";
  await Deno.writeTextFile(path, configText);
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
}

async function bump(type: BumpType): Promise<void> {
  const currentVersion = await getCurrentVersion();
  const newVersion = bumpVersion(currentVersion, type);

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

function getNextDevVersion(currentVersion: string): string {
  // Check if already a dev version (e.g., "0.2.1-dev.2")
  const devMatch = currentVersion.match(/^(.+)-dev\.(\d+)$/);

  if (devMatch) {
    // Increment existing dev number
    const baseVersion = devMatch[1];
    const devNumber = parseInt(devMatch[2]);
    return `${baseVersion}-dev.${devNumber + 1}`;
  } else {
    // Start new dev sequence from stable version
    return `${currentVersion}-dev.1`;
  }
}

async function tagDev(): Promise<void> {
  const currentVersion = await getCurrentVersion();
  const devVersion = getNextDevVersion(currentVersion);
  const tagName = `v${devVersion}`;

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

  // Update version in deno.json
  console.log(`\n📝 Updating deno.json to version ${devVersion}...`);
  await updateVersion(devVersion);
  console.log("✅ Updated deno.json");

  // Commit the version change
  console.log(`\n💾 Committing version change...`);
  const commitResult = await runCommand([
    "git",
    "commit",
    "-am",
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
  const pushResult = await runCommand(["git", "push", "origin", "HEAD", tagName]);

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
  deno task version tag          Create and push git tag for current version
  deno task version dev          Create and push dev pre-release tag
  deno task version help         Show this help message

Examples:
  # Check current version
  deno task version

  # Bump patch version and commit
  deno task version patch
  git commit -am "Bump version to $(deno task version)"

  # Create release tag
  deno task version tag

  # Create dev pre-release (use 'deno task tag:dev' to run tests first)
  deno task version dev
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
