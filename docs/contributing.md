# Project Workflow

This docs page covers the repository workflow for ScribbledPage.

## Setup

```bash
git clone https://github.com/mrbdahlem/scribbledpage.git
cd scribbledpage
npm install
npm run dev
```

## Validation

- `npm run ci:scribbledpage` for ScribbledPage-specific changes
- `npm run ci:tools` for the bundled BentoPDF tools surface
- `npm run ci -w @scribbledpage/app` or `npm run ci -w @scribbledpage/tools` for direct workspace checks
- `npm test -- --run` for the full repository suite

## Project Areas

- `apps/scribbledpage/` for the ScribbledPage npm workspace package
- `apps/tools/` for the forked BentoPDF tools npm workspace package
- `src/js/scribbledpage/` for ScribbledPage workflows
- `src/js/logic/` and `src/pages/` for the BentoPDF tools surface
- `src/tests/` for tests
- `docs/` for repository documentation

## More Detail

Use the root [CONTRIBUTING.md](https://github.com/mrbdahlem/scribbledpage/blob/main/CONTRIBUTING.md) for the full workflow.
Use [ARCHITECTURE.md](https://github.com/mrbdahlem/scribbledpage/blob/main/ARCHITECTURE.md) for source boundaries and workspace migration direction.
Use [apps/tools/UPSTREAM.md](https://github.com/mrbdahlem/scribbledpage/blob/main/apps/tools/UPSTREAM.md) for BentoPDF fork tracking notes.
