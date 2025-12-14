<!-- markdownlint-disable MD024 -->
# Changelog

> **Policy**: Concise entries for user-visible changes since last tag. One-line
> per change. Ignore internal cleanup, specs, and test-only changes.

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
