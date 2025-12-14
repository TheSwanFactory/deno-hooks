# Deno Hooks

A zero-dependency git hooks framework for Deno projects.

## Features

- 🦕 **Pure Deno/TypeScript** - No external dependencies
- ⚡ **Fast** - Parallel hook execution
- 🎯 **Simple** - Declarative YAML/JSON configuration
- 🔒 **Secure** - Local hooks only, Deno permission model
- 🛠️ **Built-in Hooks** - Common checks work out-of-the-box

## Quick Start

### 1. Create Configuration

Create `deno-hooks.yml` in your project root:

```yaml
hooks:
  pre-commit:
    - id: deno-fmt
      glob: "*.{ts,js,json,md}"
      pass_filenames: true

    - id: deno-lint
      glob: "*.{ts,js}"
      pass_filenames: true

  pre-push:
    - id: test
      run: "deno test -A"
```

### 2. Install Hooks

```bash
deno task setup
```

Or manually:

```bash
deno run -A src/install.ts
```

### 3. Commit

```bash
git commit -m "Your changes"
# Hooks run automatically
```

## Configuration

### Hook Definition

```yaml
hooks:
  <hook-name>: # e.g., pre-commit, pre-push
    - id: <hook-id> # Unique identifier
      name: <display-name> # Optional display name
      run: <command> # Command to run or built-in hook name
      glob: <pattern> # File pattern (e.g., "*.ts")
      pass_filenames: true # Pass matched files as arguments
      exclude: <pattern> # Exclude pattern
```

### Built-in Hooks

- `deno-fmt` - Format code with `deno fmt`
- `deno-lint` - Lint code with `deno lint`
- `deno-test` - Run tests with `deno test`

### Custom Hooks

```yaml
hooks:
  pre-commit:
    - id: custom-check
      run: "deno run -A scripts/my-check.ts"
      glob: "*.ts"
      pass_filenames: true
```

## Advanced Examples

### Multiple Hooks with Different Patterns

```yaml
hooks:
  pre-commit:
    # Format only specific file types
    - id: fmt-ts
      run: deno-fmt
      glob: "*.{ts,tsx}"
      pass_filenames: true

    # Lint with exclusions
    - id: lint-src
      run: deno-lint
      glob: "src/**/*.ts"
      exclude: "**/*.test.ts"
      pass_filenames: true

    # Custom script
    - id: check-todos
      name: "Check for TODO comments"
      run: "deno run -A scripts/check-todos.ts"
      glob: "*.ts"

  pre-push:
    # Run all tests before push
    - id: test
      name: "Run test suite"
      run: deno-test

    # Type check
    - id: type-check
      run: "deno check src/mod.ts"
```

### Using in deno.json

```json
{
  "name": "@yourorg/yourproject",
  "version": "1.0.0",
  "deno-hooks": {
    "hooks": {
      "pre-commit": [
        {
          "id": "deno-fmt",
          "glob": "*.{ts,js,json,md}",
          "pass_filenames": true
        }
      ]
    }
  },
  "tasks": {
    "setup": "deno run -A jsr:@theswanfactory/deno-hooks/install"
  }
}
```

### Programmatic Usage

```ts
import { install, run } from "@theswanfactory/deno-hooks";

// Install hooks programmatically
await install();

// Or run hooks manually
const exitCode = await run("pre-commit");
if (exitCode !== 0) {
  console.error("Hooks failed!");
  Deno.exit(exitCode);
}
```

## CI/CD Integration

This package is published to JSR with provenance enabled through GitHub Actions
OIDC:

- Automated publishing on version tags
- Built-in security with OIDC authentication
- Transparent supply chain with provenance attestation

See [.github/workflows/publish.yml](.github/workflows/publish.yml) for the
workflow configuration.

## Contributing

Contributions welcome! Please ensure:

- All tests pass: `deno test -A`
- Code is formatted: `deno fmt`
- Code is linted: `deno lint`

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

MIT
