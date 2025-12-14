# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
