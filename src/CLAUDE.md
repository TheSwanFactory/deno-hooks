# Deno Hooks - Developer Guide

## Architecture

### How It Works

1. **Installation** ([install.ts](install.ts))
   - Reads configuration from `deno-hooks.yml` or `deno.json`
   - Creates shell wrapper scripts in `.git/hooks/`
   - Makes scripts executable

2. **Git Hook Trigger**
   - Git calls the shell wrapper (e.g., `.git/hooks/pre-commit`)
   - Wrapper executes `deno run -A src/run.ts pre-commit`

3. **Hook Execution** ([run.ts](run.ts))
   - Loads configuration
   - Gets relevant files (staged for pre-commit)
   - Filters files by glob patterns
   - Executes each configured hook
   - Reports results

4. **Built-in Hooks** ([executor.ts](executor.ts))
   - `deno-fmt`: Format with `deno fmt`
   - `deno-lint`: Lint with `deno lint`
   - `deno-test`: Run `deno test -A`

## File Filtering

### Glob Patterns

Supports glob patterns with brace expansion:

- `*.ts` - All TypeScript files
- `*.{ts,js}` - TypeScript and JavaScript files
- `**/*.test.ts` - Test files (not yet supported, needs implementation)

### Staged Files

For `pre-commit` hooks, only staged files are processed:

```bash
git diff --cached --name-only --diff-filter=ACM
```

Files are then filtered by the glob pattern specified in each hook.

## Development

### Running Tests

```bash
deno test -A
```

### Manual Testing

```bash
# Install hooks
deno run -A src/install.ts

# Run hooks manually
deno run -A src/run.ts pre-commit

# Check installed hooks
cat .git/hooks/pre-commit
```

### Adding a Built-in Hook

1. Add function to [executor.ts](executor.ts):
   ```typescript
   async function myHook(ctx: HookContext): Promise<HookResult> {
     // Implementation
   }
   ```

2. Register in `getBuiltInHook()`:
   ```typescript
   const builtIns = {
     "my-hook": myHook,
     // ...
   };
   ```

3. Use in configuration:
   ```yaml
   - id: my-check
     run: my-hook
   ```

## Current Limitations (MVP)

1. **Sequential Execution**: Hooks run one at a time (parallel execution planned for Phase 2)
2. **Limited Built-ins**: Only fmt, lint, test (more planned)
3. **Simple Glob Matching**: No `**` or complex patterns yet
4. **No Hook Dependencies**: Can't specify hook execution order
5. **Auto-fix Staging**: Formatted files not automatically re-staged

## Future Enhancements

### Phase 2 (Planned)

- Parallel hook execution
- More built-in hooks (check-yaml, trailing-whitespace, etc.)
- Better glob pattern support (`**/*.ts`)
- Hook dependencies and ordering
- Auto-restaging for auto-fix hooks
- Skip hooks via environment variable

### Phase 3 (Future)

- Publish to JSR as `@theswanfactory/deno-hooks`
- Extract to separate repository
- CI/CD integration guides
- Migration tool from pre-commit
- Community hook sharing

## Migration from pre-commit

### Before (pre-commit)

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: lint
        name: lint
        entry: bash -c "deno fmt && deno lint --fix"
        language: system
        pass_filenames: false
```

### After (deno-hooks)

```yaml
# deno-hooks.yml
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

### Benefits

- No Python dependency
- Faster startup (~100ms vs ~500ms)
- Native Deno integration
- Type-safe configuration
- Simpler installation

## Troubleshooting

### Hooks Not Running

Check that hooks are installed:

```bash
ls -la .git/hooks/pre-commit
cat .git/hooks/pre-commit
```

Reinstall if needed:

```bash
deno task setup
```

### Configuration Errors

Validate configuration:

```bash
deno run -A src/run.ts pre-commit
```

Check YAML syntax:

```bash
deno eval "import { parse } from '@std/yaml'; console.log(parse(await Deno.readTextFile('deno-hooks.yml')))"
```

### Hooks Passing When They Shouldn't

Check that files match glob patterns:

```bash
# Get staged files
git diff --cached --name-only

# Test pattern matching
deno eval "import { filterFiles } from './src/files.ts'; console.log(filterFiles(['foo.ts', 'bar.js'], '*.ts'))"
```

## Resources

- **Spec**: [doc/spec/2-deno-hooks/README.md](../../doc/spec/2-deno-hooks/README.md)
- **Git Hooks**: [git-scm.com/docs/githooks](https://git-scm.com/docs/githooks)
- **Pre-commit** (inspiration): [pre-commit.com](https://pre-commit.com/)
