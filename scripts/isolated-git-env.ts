/**
 * Environment isolation for tests that spawn git
 *
 * Shared by `src/install.test.ts` and `scripts/test-fake-repo.ts`, and
 * excluded from the published package (see `publish.exclude` in deno.json).
 *
 * @module
 */

import { join } from "@std/path";

/**
 * Environment for child processes: the caller's environment without the
 * variables git lists in `git rev-parse --local-env-vars` (GIT_DIR,
 * GIT_WORK_TREE, GIT_INDEX_FILE, ...), and with a global config of our own
 * that sets `user.*` and `init.defaultBranch=main`.
 *
 * Tests run from git hooks, where git exports GIT_DIR in a linked worktree;
 * without this, git and the installer would act on that repository instead of
 * the temporary one.
 *
 * Pass the result as `env` together with `clearEnv: true`.
 *
 * @param configDir Directory to write the global `gitconfig` into
 */
export async function isolatedGitEnv(
  configDir: string,
): Promise<Record<string, string>> {
  const { stdout } = await new Deno.Command("git", {
    args: ["rev-parse", "--local-env-vars"],
    cwd: configDir,
    stdout: "piped",
    stderr: "null",
  }).output();
  const localVars = new TextDecoder().decode(stdout).split("\n").filter(
    Boolean,
  );
  if (!localVars.includes("GIT_DIR")) {
    throw new Error("git rev-parse --local-env-vars did not list GIT_DIR");
  }

  const env = Deno.env.toObject();
  for (const name of localVars) {
    delete env[name];
  }

  const globalConfig = join(configDir, "gitconfig");
  await Deno.writeTextFile(
    globalConfig,
    "[user]\n\tname = Test User\n\temail = test@example.com\n" +
      "[init]\n\tdefaultBranch = main\n",
  );
  env.GIT_CONFIG_GLOBAL = globalConfig;
  env.GIT_CONFIG_NOSYSTEM = "1";
  return env;
}
