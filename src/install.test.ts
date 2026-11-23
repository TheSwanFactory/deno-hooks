/**
 * Tests for hook installation in a temporary repository and its worktrees
 *
 * Every git and installer process runs with the caller's repository variables
 * (GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE, ...) removed and with an isolated
 * global config. Otherwise a test run from inside a git hook would act on the
 * repository that ran the hook instead of the temporary one.
 */
import { expect } from "@std/expect";
import { fromFileUrl, join } from "@std/path";

const INSTALL_SCRIPT = fromFileUrl(new URL("./install.ts", import.meta.url));
const DENO_CONFIG = fromFileUrl(new URL("../deno.json", import.meta.url));

const HOOKS_CONFIG = `hooks:
  pre-commit:
    - echo deno-hooks-test
`;

interface Fixture {
  tempDir: string;
  repo: string;
  env: Record<string, string>;
}

async function run(
  cmd: string,
  args: string[],
  cwd: string,
  env: Record<string, string>,
): Promise<string> {
  const { success, stdout, stderr } = await new Deno.Command(cmd, {
    args,
    cwd,
    env,
    clearEnv: true,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const decoder = new TextDecoder();
  if (!success) {
    throw new Error(
      `${cmd} ${args.join(" ")} failed:\n${decoder.decode(stdout)}${
        decoder.decode(stderr)
      }`,
    );
  }
  return decoder.decode(stdout);
}

/**
 * Environment for child processes without the variables git lists in
 * `git rev-parse --local-env-vars`, and with a global config of our own
 */
async function isolatedEnv(tempDir: string): Promise<Record<string, string>> {
  const { stdout } = await new Deno.Command("git", {
    args: ["rev-parse", "--local-env-vars"],
    cwd: tempDir,
    stdout: "piped",
    stderr: "null",
  }).output();
  const localVars = new TextDecoder().decode(stdout).split("\n").filter(
    Boolean,
  );
  expect(localVars).toContain("GIT_DIR");

  const env = Deno.env.toObject();
  for (const name of localVars) {
    delete env[name];
  }

  const globalConfig = join(tempDir, "gitconfig");
  await Deno.writeTextFile(
    globalConfig,
    "[user]\n\tname = Test User\n\temail = test@example.com\n" +
      "[init]\n\tdefaultBranch = main\n",
  );
  env.GIT_CONFIG_GLOBAL = globalConfig;
  env.GIT_CONFIG_NOSYSTEM = "1";
  return env;
}

/** Create a temporary repository with one commit and a deno-hooks.yml */
async function withRepo(fn: (fixture: Fixture) => Promise<void>) {
  // realPath: macOS temp dirs sit behind a symlink, git reports the real path
  const tempDir = await Deno.realPath(
    await Deno.makeTempDir({ prefix: "deno-hooks-test-" }),
  );
  try {
    const env = await isolatedEnv(tempDir);
    const repo = join(tempDir, "repo");
    await Deno.mkdir(join(repo, "src"), { recursive: true });
    await run("git", ["init", "--quiet"], repo, env);
    await Deno.writeTextFile(join(repo, "deno-hooks.yml"), HOOKS_CONFIG);
    await run("git", ["add", "deno-hooks.yml"], repo, env);
    await run("git", ["commit", "--quiet", "-m", "init"], repo, env);
    await fn({ tempDir, repo, env });
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
}

function installHooks(cwd: string, env: Record<string, string>) {
  return run(
    Deno.execPath(),
    ["run", "-A", "--config", DENO_CONFIG, INSTALL_SCRIPT, "--yes"],
    cwd,
    env,
  );
}

Deno.test("install - writes hooks to .git/hooks in a main checkout", async () => {
  await withRepo(async ({ repo, env }) => {
    // From a subdirectory: git answers the hooks path relative to the cwd
    await installHooks(join(repo, "src"), env);

    const hook = await Deno.readTextFile(join(repo, ".git/hooks/pre-commit"));
    expect(hook).toContain("echo deno-hooks-test");
  });
});

Deno.test("install - writes hooks to the common hooks directory from a linked worktree", async () => {
  await withRepo(async ({ tempDir, repo, env }) => {
    const worktree = join(tempDir, "worktree");
    await run("git", ["worktree", "add", "--quiet", worktree], repo, env);
    expect((await Deno.stat(join(worktree, ".git"))).isFile).toBe(true);

    await installHooks(worktree, env);

    const hook = await Deno.readTextFile(join(repo, ".git/hooks/pre-commit"));
    expect(hook).toContain("echo deno-hooks-test");
  });
});
