# Adobe Crap (Custom Repository of Adobe Plugins)

Monorepo for custom Adobe plugins.

Default workflow: develop on `dev` via PRs, merge to `main` for releases.

## Structure

- One folder per Adobe product (e.g. `InDesign/`)
- Each product contains one or more plugins (e.g. `InDesign/InDesign_PP/`)

## Available plugins

- InDesign
	- `InDesign/InDesign_PP` — **InDesign Page & Frame Tools** (v1.0.1)
		- InDesign 2024+ (minVersion 20.5.0)
		- InDesign plugin for frame sizing and intelligent distribution

## Notes

- Temporary/scratch files are ignored via the root `.gitignore`.
