/**
 * Tests for hook installation in a temporary repository and its worktrees
 *
 * Every git and installer process runs with the caller's repository variables
 * (GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE, ...) removed and with an isolated
 * global config (see scripts/isolated-git-env.ts). Otherwise a test run from
 * inside a git hook would act on the repository that ran the hook instead of
 * the temporary one.
 */
import { expect } from "@std/expect";
import { fromFileUrl, join } from "@std/path";
import { isolatedGitEnv } from "../scripts/isolated-git-env.ts";

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

/** Create a temporary repository with one commit and a deno-hooks.yml */
async function withRepo(fn: (fixture: Fixture) => Promise<void>) {
  // realPath: macOS temp dirs sit behind a symlink, git reports the real path
  const tempDir = await Deno.realPath(
    await Deno.makeTempDir({ prefix: "deno-hooks-test-" }),
  );
  try {
    const env = await isolatedGitEnv(tempDir);
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
    // Nothing was written under the worktree's own .git
    expect((await Deno.stat(join(worktree, ".git"))).isFile).toBe(true);
    // `.git` is a file, so a path under it is NotADirectory, not NotFound.
    await expect(Deno.stat(join(worktree, ".git/hooks"))).rejects.toThrow(
      Deno.errors.NotADirectory,
    );
  });
});

Deno.test("install - writes hooks to core.hooksPath when it is set", async () => {
  await withRepo(async ({ repo, env }) => {
    await run("git", ["config", "core.hooksPath", ".githooks"], repo, env);

    // From a subdirectory: git answers ../.githooks, relative to the cwd
    await installHooks(join(repo, "src"), env);

    const hook = await Deno.readTextFile(join(repo, ".githooks/pre-commit"));
    expect(hook).toContain("echo deno-hooks-test");
    await expect(Deno.stat(join(repo, ".git/hooks/pre-commit"))).rejects
      .toThrow(Deno.errors.NotFound);
  });
});

// --- pre-commit checks the staged content ---------------------------------

const FORMATTED = 'export const x = "a";\n';
const UNFORMATTED = "export   const x  =  'a'\n";

const FMT_CHECK = `'${Deno.execPath()}' fmt --check src/`;

/** Repo whose pre-commit hook runs the given YAML list items */
async function withHook(
  items: string,
  fn: (fixture: Fixture) => Promise<void>,
) {
  await withRepo(async (fixture) => {
    const { repo, env } = fixture;
    await Deno.writeTextFile(
      join(repo, "deno-hooks.yml"),
      `hooks:\n  pre-commit:\n${items}`,
    );
    await installHooks(repo, env);
    await fn(fixture);
  });
}

/** Repo whose pre-commit hook runs `deno fmt --check src/` */
function withFmtHook(fn: (fixture: Fixture) => Promise<void>) {
  return withHook(`    - "${FMT_CHECK}"\n`, fn);
}

async function commit(
  repo: string,
  env: Record<string, string>,
  ...extra: string[]
): Promise<boolean> {
  const { success } = await new Deno.Command("git", {
    args: ["commit", "--quiet", "-m", "change", ...extra],
    cwd: repo,
    env,
    clearEnv: true,
    stdout: "null",
    stderr: "null",
  }).output();
  return success;
}

Deno.test("pre-commit - passes when the staged file is formatted but the working copy is not", async () => {
  await withFmtHook(async ({ repo, env }) => {
    const file = join(repo, "src/a.ts");
    await Deno.writeTextFile(file, FORMATTED);
    await run("git", ["add", "src/a.ts"], repo, env);
    await Deno.writeTextFile(file, UNFORMATTED);

    expect(await commit(repo, env)).toBe(true);
    // The unstaged working copy is left alone
    expect(await Deno.readTextFile(file)).toBe(UNFORMATTED);
  });
});

Deno.test("pre-commit - fails when the staged file is unformatted but the working copy was fixed", async () => {
  await withFmtHook(async ({ repo, env }) => {
    const file = join(repo, "src/a.ts");
    await Deno.writeTextFile(file, UNFORMATTED);
    await run("git", ["add", "src/a.ts"], repo, env);
    await Deno.writeTextFile(file, FORMATTED);

    expect(await commit(repo, env)).toBe(false);
    // Nothing was committed, and the working copy and the index are intact
    expect(await Deno.readTextFile(file)).toBe(FORMATTED);
    const staged = await run("git", ["show", ":src/a.ts"], repo, env);
    expect(staged).toBe(UNFORMATTED);
    const log = await run("git", ["rev-list", "--count", "HEAD"], repo, env);
    expect(log.trim()).toBe("1");
  });
});

Deno.test("pre-commit - an unrelated unstaged or untracked bad file does not block the commit", async () => {
  await withFmtHook(async ({ repo, env }) => {
    // A tracked file that is modified, but not staged, in a bad way
    await Deno.writeTextFile(join(repo, "src/other.ts"), FORMATTED);
    await run("git", ["add", "src/other.ts"], repo, env);
    await run("git", ["commit", "--quiet", "-m", "other"], repo, env);
    await Deno.writeTextFile(join(repo, "src/other.ts"), UNFORMATTED);
    // An untracked bad file
    await Deno.writeTextFile(join(repo, "src/untracked.ts"), UNFORMATTED);
    // The staged change
    await Deno.writeTextFile(join(repo, "src/a.ts"), FORMATTED);
    await run("git", ["add", "src/a.ts"], repo, env);

    expect(await commit(repo, env)).toBe(true);
    expect(await Deno.readTextFile(join(repo, "src/other.ts"))).toBe(
      UNFORMATTED,
    );
    expect(await Deno.readTextFile(join(repo, "src/untracked.ts"))).toBe(
      UNFORMATTED,
    );
  });
});

Deno.test("pre-commit - checks the staged part of a partially staged file", async () => {
  await withFmtHook(async ({ repo, env }) => {
    const file = join(repo, "src/a.ts");
    await Deno.writeTextFile(file, FORMATTED);
    await run("git", ["add", "src/a.ts"], repo, env);
    // Unstaged edit on top of the staged content
    await Deno.writeTextFile(file, FORMATTED + UNFORMATTED.replace("x", "y"));

    expect(await commit(repo, env)).toBe(true);
    const committed = await run("git", ["show", "HEAD:src/a.ts"], repo, env);
    expect(committed).toBe(FORMATTED);
    expect(await Deno.readTextFile(file)).toContain("'a'");
  });
});

Deno.test("pre-commit - cleans up its temporary copy", async () => {
  await withFmtHook(async ({ tempDir, repo, env }) => {
    const tmp = join(tempDir, "tmp");
    await Deno.mkdir(tmp);
    const isolated = { ...env, TMPDIR: tmp };
    await Deno.writeTextFile(join(repo, "src/a.ts"), UNFORMATTED);
    await run("git", ["add", "src/a.ts"], repo, env);
    expect(await commit(repo, isolated)).toBe(false);
    await Deno.writeTextFile(join(repo, "src/a.ts"), FORMATTED);
    await run("git", ["add", "src/a.ts"], repo, env);
    expect(await commit(repo, isolated)).toBe(true);

    const left = [...Deno.readDirSync(tmp)];
    expect(left).toEqual([]);
  });
});

Deno.test("pre-commit - `git commit -a` checks what it will commit", async () => {
  await withFmtHook(async ({ repo, env }) => {
    const file = join(repo, "src/a.ts");
    await Deno.writeTextFile(file, FORMATTED);
    await run("git", ["add", "src/a.ts"], repo, env);
    await run("git", ["commit", "--quiet", "-m", "a"], repo, env);
    await Deno.writeTextFile(file, UNFORMATTED);

    expect(await commit(repo, env, "-a")).toBe(false);
  });
});

Deno.test("pre-commit - `git commit <paths>` checks only the paths it commits", async () => {
  await withFmtHook(async ({ repo, env }) => {
    const a = join(repo, "src/a.ts");
    await Deno.writeTextFile(a, FORMATTED);
    await run("git", ["add", "src/a.ts"], repo, env);
    await run("git", ["commit", "--quiet", "-m", "a"], repo, env);
    await Deno.writeTextFile(a, FORMATTED + "export const z = 1;\n");
    // Staged and unformatted, but not part of this commit
    await Deno.writeTextFile(join(repo, "src/b.ts"), UNFORMATTED);
    await run("git", ["add", "src/b.ts"], repo, env);

    expect(await commit(repo, env, "src/a.ts")).toBe(true);
    const committed = await run(
      "git",
      ["show", "--name-only", "--format=", "HEAD"],
      repo,
      env,
    );
    expect(committed.trim()).toBe("src/a.ts");

    // Committing the unformatted file by path fails
    expect(await commit(repo, env, "src/b.ts")).toBe(false);
  });
});

Deno.test("pre-commit - commands can run git inside the staged copy", async () => {
  // `git diff --cached` lists the files being committed; a file that is not
  // listed makes the hook fail, so a git that cannot find the repository does
  // too.
  const cmd = `git diff --cached --name-only | grep -qx src/a.ts`;
  await withHook(`    - "${cmd}"\n`, async ({ repo, env }) => {
    await Deno.writeTextFile(join(repo, "src/a.ts"), FORMATTED);
    await run("git", ["add", "src/a.ts"], repo, env);
    expect(await commit(repo, env)).toBe(true);

    // Also with a relative GIT_DIR and from `git commit -a` (temporary index)
    await Deno.writeTextFile(join(repo, "src/a.ts"), FORMATTED + "//\n");
    expect(await commit(repo, { ...env, GIT_DIR: ".git" }, "-a")).toBe(true);
  });
});

const FMT_FIX = `'${Deno.execPath()}' fmt src/`;

Deno.test("pre-commit - run_in: working runs in the real repository", async () => {
  const items = `    - run: "${FMT_FIX}"\n      run_in: working\n`;
  await withHook(items, async ({ repo, env }) => {
    const file = join(repo, "src/a.ts");
    await Deno.writeTextFile(file, UNFORMATTED);
    await run("git", ["add", "src/a.ts"], repo, env);

    // The fixer passes and fixes the working copy, as before
    expect(await commit(repo, env)).toBe(true);
    expect(await Deno.readTextFile(file)).toBe(FORMATTED);
    // No temporary copy is made when no command needs one
    const hook = await Deno.readTextFile(join(repo, ".git/hooks/pre-commit"));
    expect(hook).not.toContain("checkout-index");
  });
});

Deno.test("pre-commit - run_in: working sees untracked files; staged does not", async () => {
  const check = `test -f .env`;
  await withHook(
    `    - run: "${check}"\n      run_in: working\n`,
    async ({ repo, env }) => {
      await Deno.writeTextFile(join(repo, ".env"), "X=1\n");
      await Deno.writeTextFile(join(repo, "src/a.ts"), FORMATTED);
      await run("git", ["add", "src/a.ts"], repo, env);
      expect(await commit(repo, env)).toBe(true);
    },
  );
  await withHook(`    - "${check}"\n`, async ({ repo, env }) => {
    await Deno.writeTextFile(join(repo, ".env"), "X=1\n");
    await Deno.writeTextFile(join(repo, "src/a.ts"), FORMATTED);
    await run("git", ["add", "src/a.ts"], repo, env);
    expect(await commit(repo, env)).toBe(false);
  });
});

Deno.test("pre-commit - a mixed config runs each command where it asks", async () => {
  const items = `    - "${FMT_CHECK}"\n` +
    `    - run: "test -f .env"\n      run_in: working\n` +
    `    - run: "test ! -f .env"\n      run_in: staged\n`;
  await withHook(items, async ({ repo, env }) => {
    await Deno.writeTextFile(join(repo, ".env"), "X=1\n");
    const file = join(repo, "src/a.ts");
    await Deno.writeTextFile(file, FORMATTED);
    await run("git", ["add", "src/a.ts"], repo, env);
    await Deno.writeTextFile(file, UNFORMATTED);

    // staged check passes on the staged copy; working and staged .env checks
    // each see their own tree
    expect(await commit(repo, env)).toBe(true);

    // The staged command still gates: an unformatted staged file fails
    await Deno.writeTextFile(file, UNFORMATTED);
    await run("git", ["add", "src/a.ts"], repo, env);
    expect(await commit(repo, env)).toBe(false);
  });
});
