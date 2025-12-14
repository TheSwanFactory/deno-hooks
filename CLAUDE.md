# Deno Hooks - Project Guide

## Overview

Deno Hooks is a zero-dependency git hooks framework built in pure TypeScript for
Deno projects. It provides a declarative way to configure and run git hooks
without requiring Python (pre-commit) or Node.js (Husky) dependencies.

## Quick Start

### Installation

```bash
deno task setup
```

### Configuration

Create `deno-hooks.yml`:

```yaml
hooks:
  pre-commit:
    - id: deno-fmt
      run: deno-fmt
      glob: "*.{ts,js,json,md}"
      pass_filenames: true

    - id: deno-lint
      run: deno-lint
      glob: "*.{ts,js}"
      pass_filenames: true
```

Or add to `deno.json`:

```json
{
  "deno-hooks": {
    "hooks": {
      "pre-commit": [
        {
          "id": "deno-fmt",
          "run": "deno-fmt",
          "glob": "*.{ts,js,json,md}",
          "pass_filenames": true
        }
      ]
    }
  }
}
```

## Built-in Hooks

- **deno-fmt**: Auto-format code with `deno fmt`
- **deno-lint**: Lint code with `deno lint`
- **deno-test**: Run tests with `deno test -A`

## Custom Hooks

Run any command:

```yaml
- id: custom-check
  run: "deno run -A scripts/my-check.ts"
  glob: "*.ts"
  pass_filenames: true
```

## Hook Options

- `id` (required): Unique identifier
- `name` (optional): Display name
- `run` (required): Built-in hook or command
- `glob` (optional): File pattern (e.g., `*.ts`)
- `pass_filenames` (optional): Pass matched files as arguments

## Project Structure

```
deno-hooks/
├── src/               # Source code
│   ├── mod.ts        # Main exports
│   ├── config.ts     # Configuration parsing
│   ├── install.ts    # Git hooks installer
│   ├── run.ts        # Hook runner
│   ├── executor.ts   # Hook execution logic
│   ├── files.ts      # File utilities
│   └── hook.ts       # Type definitions
├── examples/         # Example configurations
└── deno-hooks.yml    # Hook configuration
```

## Development

See [src/CLAUDE.md](src/CLAUDE.md) for detailed developer documentation
including:

- Architecture and how it works
- Adding built-in hooks
- Testing and debugging
- Current limitations and roadmap
- Migration guides

## Resources

- **Spec**:
  [doc/spec/2-deno-hooks/README.md](../doc/spec/2-deno-hooks/README.md)
- **Git Hooks**: [git-scm.com/docs/githooks](https://git-scm.com/docs/githooks)
- **Pre-commit** (inspiration): [pre-commit.com](https://pre-commit.com/)
