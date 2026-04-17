# Contributing to codepane

Thanks for your interest in contributing to codepane! This guide will help you get set up and familiar with the development workflow.

## Prerequisites

- **Bun** >= 1.0 ([install](https://bun.sh))

## Getting Started

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/giovacalle/codepane.git
   cd codepane
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Start the development server:

   ```bash
   bun run dev
   ```

## Development Workflow

Run tests in watch mode while developing:

```bash
bun run test:watch
```

Run the type checker to catch type errors early:

```bash
bun run typecheck
```

## Changeset Workflow

codepane uses [changesets](https://github.com/changesets/changesets) to manage versioning and changelogs. Every PR that changes library behavior should include a changeset.

1. After making your changes, generate a changeset:

   ```bash
   bunx changeset
   ```

2. Follow the prompts to select the semver bump type (patch, minor, or major) and write a short summary of the change.

3. Commit the generated changeset file (found in the `.changeset/` directory) along with the rest of your changes.

## Code Style

This project uses [Prettier](https://prettier.io/) for formatting. Before submitting a PR, make sure your code is formatted:

```bash
bun run format
```

## Pull Request Guidelines

- Use a descriptive title that summarizes the change.
- Include a changeset (see above) for any user-facing changes.
- Add or update tests for new features and bug fixes.
- Make sure all checks pass (`bun run test`, `bun run typecheck`) before requesting a review.

## Questions?

If you have questions or run into issues, feel free to open a [GitHub Issue](https://github.com/giovacalle/codepane/issues).
