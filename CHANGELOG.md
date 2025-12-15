<!-- markdownlint-disable MD024 -->

# Changelog

> **Policy**: Concise entries for user-visible changes since last tag. One-line
> per change. Ignore internal cleanup, specs, and test-only changes.

## [Unreleased]

## [0.3.0] - 2024-12-14

### Changed

- **BREAKING**: Major architectural simplification - hooks are now simple
  command arrays instead of complex objects with glob patterns
- **BREAKING**: Removed built-in hooks (`deno-fmt`, `deno-lint`, `deno-test`) -
  use `deno task fmt`, `deno task lint`, `deno task test` instead
- **BREAKING**: Configuration format simplified - hooks are now just arrays of
  shell commands
- Generated hook scripts are now self-contained with no dependencies on
  deno-hooks runtime
- Hook scripts use `set -e` for fail-fast behavior

### Removed

- File glob pattern matching and `pass_filenames` logic (file filtering is now
  git's job)
- Built-in hook executors (deno-fmt, deno-lint, deno-test)
- Runtime execution system (src/run.ts, src/executor.ts, src/files.ts)
- Complex hook type definitions

### Added

- Self-contained hook scripts that work without deno-hooks installed
- Support for any shell command in hooks (not just deno commands)
- Success message "✓ All hooks passed" after successful hook execution
- New examples: advanced.yml and deno-json-config.json

## [0.2.1] - 2024-12-14

### Added

- Dev pre-release tagging workflow with `deno task tag-dev` for testing JSR
  installations before stable releases
- `deno task tag` command for creating stable releases with automated testing
- `deno task test-all` combining unit and integration tests
- GitHub Actions support for publishing dev pre-releases (e.g.,
  `0.2.1-dev.1734197345`)

- Version management script with `deno task version` command for displaying,
  bumping (patch/minor/major), and tagging releases

### Fixed

- Critical bug: JSR installations now generate valid hook paths with `jsr:`
  protocol instead of invalid filesystem paths (fixes #9)
- Integration tests now properly validate hook path formats to catch path
  generation bugs

## [0.2.0] - 2024-12-14

### Changed

- **BREAKING**: Simplified installation command from
  `deno run -A jsr:@theswanfactory/deno-hooks/install` to
  `deno run -A jsr:@theswanfactory/deno-hooks`
- Installation now shows individual hook names (e.g., "deno fmt", "unit tests")
  instead of just git hook types
- Interactive setup automatically offers to create default config if none exists

### Fixed

- Critical bug: Hooks now reference correct package path instead of user's repo
  path (would have prevented silent failures in PR #1)

### Added

- Comprehensive integration tests that simulate real user repositories
- Integration tests run automatically on pre-push
- Default configuration template with sensible defaults (fmt, lint, test)

## [0.1.4] - 2024-12-14

### Added

- Documentation coverage task (deno task doc-coverage)
- Code coverage task (deno task coverage)

## [0.1.3] - 2024-12-14

### Fixed

- Added @module documentation to install and run entrypoints for JSR compliance

## [0.1.2] - 2024-12-14

### Added

- Comprehensive JSDoc documentation with usage examples in all public APIs
- Advanced examples section in README (multiple patterns, exclusions, pre-push)
- Programmatic usage examples in README
- CI/CD integration documentation

## [0.1.1] - 2024-12-14

### Added

- GitHub Actions workflow for automatic JSR publishing with provenance

### Changed

- Reorganized project structure

## [0.1.0] - 2024-12-14

### Added

- Initial MVP release
- Zero-dependency git hooks framework for Deno
- YAML and JSON configuration support (deno-hooks.yml or deno.json)
- Built-in hooks: deno-fmt, deno-lint, deno-test
- Custom command execution support
- File glob pattern matching and exclusions
- Pre-commit hook with staged file filtering
