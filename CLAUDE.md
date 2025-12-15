# Deno Hooks - Developer Guide

## For Contributors

This guide is for developers working on deno-hooks itself. If you're a user
wanting to use deno-hooks in your project, see [README.md](README.md).

## Development Setup

```bash
# Clone the repository
git clone https://github.com/TheSwanFactory/deno-hooks.git
cd deno-hooks

# Install git hooks for this repo
deno task setup

# Run tests
deno test -A

# Run integration tests
deno task test-integration
```

## Architecture Overview

Deno Hooks has a simple architecture:

1. **Configuration** ([src/config.ts](src/config.ts)) - Loads from
   `deno-hooks.yml` or `deno.json`
2. **Installation** ([src/install.ts](src/install.ts)) - Generates shell scripts
   in `.git/hooks/`
3. **Execution** ([src/run.ts](src/run.ts)) - Runs when git triggers the hook
4. **Built-in Hooks** ([src/executor.ts](src/executor.ts)) - Implements
   deno-fmt, deno-lint, deno-test

## How It Works

When you run `deno task setup`:

1. Reads configuration from `deno-hooks.yml` or `deno.json`
2. Creates shell wrapper scripts in `.git/hooks/` (e.g., `pre-commit`)
3. Each script calls `deno run -A src/run.ts <hook-name>`

When git triggers a hook (e.g., on commit):

1. Git executes `.git/hooks/pre-commit`
2. The shell script calls `src/run.ts`
3. `run.ts` loads config, filters files, and executes each hook
4. If any hook fails (exit code ≠ 0), the git operation is blocked

## Project Structure

```
deno-hooks/
├── src/
│   ├── mod.ts          # Main exports
│   ├── config.ts       # Configuration loading
│   ├── install.ts      # Hook installation
│   ├── run.ts          # Hook execution
│   ├── executor.ts     # Built-in hook implementations
│   ├── files.ts        # File utilities
│   ├── hook.ts         # Type definitions
│   └── test-hook.test.ts # Unit tests
├── scripts/
│   ├── doc-coverage.ts    # Documentation coverage checker
│   └── test-fake-repo.ts  # Integration tests
├── deno-hooks.yml      # This repo's hook config
├── deno.json           # Package configuration
└── README.md           # User documentation
```

## Testing

### Unit Tests

```bash
deno test -A
```

Tests in [src/test-hook.test.ts](src/test-hook.test.ts):

- Configuration parsing
- File pattern matching
- Staged file detection

### Integration Tests

```bash
deno task test-integration
```

The integration test ([scripts/test-fake-repo.ts](scripts/test-fake-repo.ts)):

- Creates a temporary git repository
- Installs hooks from local source
- Tests that hooks catch formatting/lint errors
- Tests that hooks allow valid commits
- Verifies hook script paths are correct

**This is critical** - it would have caught the bug in PR #1 where hooks
referenced the wrong path!

### Pre-Push Hooks

This repo uses its own hooks:

- **pre-commit**: Runs `deno fmt` and `deno lint`
- **pre-push**: Runs unit tests AND integration tests

## Adding Built-in Hooks

Built-in hooks are defined in [src/executor.ts](src/executor.ts). To add a new
one:

1. Add the hook to the `BUILTIN_HOOKS` object
2. Implement the execution logic
3. Add tests
4. Update documentation

Example:

```typescript
export const BUILTIN_HOOKS = {
  "deno-fmt": async (files: string[]) => {
    const cmd = ["deno", "fmt", "--check", ...files];
    // ... execution logic
  },
  "your-hook": async (files: string[]) => {
    // Your implementation
  },
};
```

## Publishing

Publishing to JSR is automated via GitHub Actions:

1. Update version in `deno.json`
2. Update `CHANGELOG.md`
3. Commit: `git commit -m "Bump version to X.Y.Z"`
4. Tag: `git tag vX.Y.Z`
5. Push: `git push && git push --tags`
6. GitHub Actions publishes to JSR automatically

See [.github/workflows/publish.yml](.github/workflows/publish.yml).

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `deno fmt` and `deno lint`
5. Run `deno test -A` and `deno task test-integration`
6. Submit a PR

## Resources

- **Git Hooks**: [git-scm.com/docs/githooks](https://git-scm.com/docs/githooks)
- **JSR**: [jsr.io](https://jsr.io)
- **Deno**: [deno.land](https://deno.land)
- **Pre-commit** (inspiration): [pre-commit.com](https://pre-commit.com/)
