# BentoPDF Fork Notes

`@scribbledpage/tools` is a forked BentoPDF tools surface kept in this repository as an optional hosted convenience UI.

ScribbledPage is the primary product. The tools workspace is not the main application boundary and should not become a source of ScribbledPage-specific workflow logic.

## Upstream

- Upstream repository: <https://github.com/alam00000/bentopdf>
- Local fork divergence marker: `048049fbe9681d6164795a28014b214a1b52094f` (`chore: rebrand to ScribbledPage`, 2026-05-15)
- Exact upstream commit at the time the relationship was broken: not recorded in this repository yet

If an upstream remote is restored later, record the matching upstream commit here before doing any sync or cherry-pick work.

## Maintenance Policy

- Keep BentoPDF branding for user-facing PDF utility pages and shared tool chrome.
- Keep ScribbledPage branding for repository workflow, deployment, and the primary app.
- Treat `@scribbledpage/tools` as forked app/UI code.
- Do not import tool page controllers from ScribbledPage application code.
- Prefer a shared adapter/package for reusable PDF behavior that ScribbledPage needs.
- Prefer upstream `@bentopdf/*` engine/runtime packages where they expose stable APIs or assets.

## Future Direction

The intended dependency direction is:

```text
@scribbledpage/app
  -> local shared PDF adapter/package
      -> upstream @bentopdf/* engine packages where practical

@scribbledpage/tools
  -> forked BentoPDF UI and tool pages
  -> local shared PDF adapter/package where practical
```

This keeps the fork contained while allowing ScribbledPage to depend on stable PDF capabilities instead of page-specific BentoPDF UI code.
