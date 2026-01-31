# Contributing to Oore

Thank you for your interest in contributing to Oore! This document provides guidelines and instructions for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Set up the development environment:
   ```bash
   make setup
   ```
4. Start the development server:
   ```bash
   make dev
   ```

## Development Workflow

### Before You Code

1. **Check existing issues** - Look for related issues or discussions
2. **Open an issue first** - For significant changes, discuss before implementing
3. **Read CLAUDE.md** - Understand the project conventions and rules

### Making Changes

1. Create a feature branch from `master`
2. Make your changes following the coding standards
3. Write tests (see Testing Requirements below)
4. Run the test suite:
   ```bash
   cargo test
   ```
5. Update documentation if needed
6. Commit with clear messages

### Pull Request Process

1. Ensure all tests pass
2. Update relevant documentation
3. Fill out the PR template
4. Request review from maintainers

## Testing Requirements

**Every new feature must include tests.** This is a strict requirement.

### Required for All Features

| Artifact | Location | Purpose |
|----------|----------|---------|
| User Journey | `documentation/user-journeys.md` | Document all scenarios |
| API Tests | `crates/oore-server/tests/api_tests.rs` | Verify endpoints |
| QA Checklist | `documentation/qa-checklist.md` | Manual test items |

### Required for Complex Features

| Artifact | Location | Purpose |
|----------|----------|---------|
| BDD Spec | `tests/specs/*.feature` | Behavior specification |

### Testing Workflow

1. **Document first** - Add user journey to `documentation/user-journeys.md`
2. **Write API tests** - Add tests to `api_tests.rs`
3. **Update QA checklist** - Add manual test items
4. **Run all tests** - Ensure everything passes

See `documentation/TESTING.md` for the complete testing guide.

## Code Standards

### Rust

- Follow `cargo clippy` suggestions
- Use `cargo fmt` for formatting
- Add doc comments for public APIs
- Handle errors explicitly (no `.unwrap()` in production code)

### TypeScript (Web)

- Use `bun` for package management (not npm/yarn/pnpm)
- Use shadcn/ui components with @base-ui (not Radix)
- Use hugeicons for icons
- Follow existing patterns in the codebase

### Commit Messages

Use conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`

Examples:
```
feat(api): add repository deletion endpoint
fix(web): handle connection timeout gracefully
docs(testing): add BDD specification guide
test(api): add webhook verification tests
```

## Project Structure

```
oore.build/
├── crates/              # Rust crates (core, server)
├── web/                 # Next.js frontend
├── site/                # Public documentation (Astro/Starlight)
├── documentation/       # Internal development docs
└── tests/               # Cross-crate tests
```

## Getting Help

- Read `CLAUDE.md` for project conventions
- Check `documentation/TESTING.md` for testing help
- Open an issue for questions
- Join discussions in existing issues

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
