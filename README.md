# Deno Hooks

Zero-dependency git hooks for Deno projects. Automatically format, lint, and
test your code before commits and pushes.

## Why Deno Hooks?

- 🦕 **Pure Deno** - No Python (pre-commit) or Node.js (Husky) required
- ⚡ **Fast** - Runs in milliseconds with parallel execution
- 🎯 **Simple** - One YAML file, no complex setup
- 🔒 **Secure** - Uses Deno's permission model

## Quick Start

### 1. Add to Your Project

Create `deno-hooks.yml`:

```yaml
hooks:
  pre-commit:
    - id: deno-fmt
      glob: "*.{ts,js,json,md}"
      pass_filenames: true

    - id: deno-lint
      glob: "*.{ts,js}"
      pass_filenames: true
```

### 2. Install Hooks

Add to your `deno.json`:

```json
{
  "tasks": {
    "setup": "deno run -A jsr:@theswanfactory/deno-hooks/install"
  }
}
```

Then run:

```bash
deno task setup
```

### 3. That's It!

Hooks run automatically:

```bash
git commit -m "fix: typo"
# 🔍 Running pre-commit hooks...
#   ✓ deno fmt (2 files formatted)
#   ✓ deno lint
# All hooks passed! ✨
```

## Common Configurations

### Format and Lint

```yaml
hooks:
  pre-commit:
    - id: deno-fmt
      glob: "*.{ts,js,json,md}"
      pass_filenames: true

    - id: deno-lint
      glob: "*.{ts,js}"
      pass_filenames: true
```

### Run Tests Before Push

```yaml
hooks:
  pre-push:
    - id: test
      run: "deno test -A"
```

### Custom Scripts

```yaml
hooks:
  pre-commit:
    - id: check-todos
      run: "deno run -A scripts/check-todos.ts"
      glob: "*.ts"
```

## Built-in Hooks

Use these by setting `run:` to the hook name:

- **deno-fmt** - Automatically format code
- **deno-lint** - Catch common errors
- **deno-test** - Run your test suite

## Configuration Options

Each hook can have these options:

```yaml
- id: unique-id # Required: identifies the hook
  name: Display Name # Optional: shown during execution
  run: deno-fmt # Required: built-in hook or command
  glob: "*.ts" # Optional: only run on matching files
  exclude: "**/*.test.ts" # Optional: skip matching files
  pass_filenames: true # Optional: pass files as arguments
```

### File Patterns

Target specific files:

```yaml
# TypeScript and JavaScript
glob: "*.{ts,js}"

# Source directory only
glob: "src/**/*.ts"

# Exclude test files
glob: "*.ts"
exclude: "**/*.test.ts"
```

### Configuration Location

Choose either:

**Option 1: `deno-hooks.yml`** (recommended)

```yaml
hooks:
  pre-commit:
    - id: deno-fmt
      # ...
```

**Option 2: `deno.json`**

```json
{
  "deno-hooks": {
    "hooks": {
      "pre-commit": [
        { "id": "deno-fmt" }
      ]
    }
  }
}
```

## Available Git Hooks

You can configure any standard git hook:

- **pre-commit** - Before commits (most common)
- **pre-push** - Before pushing to remote
- **commit-msg** - Validate commit messages
- **pre-rebase** - Before rebasing
- And more - see [git hooks documentation](https://git-scm.com/docs/githooks)

## Troubleshooting

**Hooks not running?**

```bash
# Reinstall hooks
deno task setup
```

**Permission errors?**

```bash
# Hooks need -A flag for full permissions
deno run -A jsr:@theswanfactory/deno-hooks/install
```

**Want to skip hooks temporarily?**

```bash
# Use --no-verify flag
git commit --no-verify -m "emergency fix"
```

## Learn More

- [Contributing Guide](CLAUDE.md) - Developer documentation
- [Changelog](CHANGELOG.md) - Version history
- [JSR Package](https://jsr.io/@theswanfactory/deno-hooks) - Published package

## License

MIT
