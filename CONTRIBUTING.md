# Contributing

Thanks for contributing to **Adobe Crap (Custom Repository of Adobe Plugins)**.

## Repo layout

- One folder per Adobe product (e.g. `InDesign/`, `Photoshop/`, ...)
- Each product contains one or more plugins (e.g. `InDesign/InDesign_PP/`)
- Some plugins may have their own contribution notes (example: `InDesign/InDesign_PP/CONTRIBUTING.md`).

## Branching model

- `main`: stable, releasable state
- `dev`: integration branch for day-to-day work
- Feature branches: branch off `dev` (e.g. `feature/indesign-export-fix`)

Workflow:
1. Create a feature branch from `dev`
2. Make focused commits (clear messages)
3. Open a PR into `dev`
4. Periodically merge `dev` → `main` for releases

## Pull requests

Please include:
- What changed and why
- Which Adobe product + plugin it affects
- How to test (steps / files)
- Screenshots or screen recordings when UI changes are involved

## Quality bar

- Keep changes minimal and scoped
- Prefer backward-compatible changes
- Run/build the plugin(s) you touched before opening a PR

## Community

This project follows the code of conduct in `CODE_OF_CONDUCT.md`.
