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
- `npm test -- --run` for the full repository suite

## Project Areas

- `src/js/scribbledpage/` for ScribbledPage workflows
- `src/js/logic/` and `src/pages/` for the BentoPDF tools surface
- `src/tests/` for tests
- `docs/` for repository documentation

## More Detail

Use the root [CONTRIBUTING.md](https://github.com/mrbdahlem/scribbledpage/blob/main/CONTRIBUTING.md) for the full workflow.
Use [ARCHITECTURE.md](https://github.com/mrbdahlem/scribbledpage/blob/main/ARCHITECTURE.md) for source boundaries and workspace migration direction.
