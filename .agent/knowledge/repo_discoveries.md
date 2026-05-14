# Repository Discoveries

Durable notes about repository structure and migration decisions.

## 2026-05-13 PaperBridge Migration Scope

- PaperBridge is the primary project identity for repository workflow, CI, issue templates, security notes, and maintainer-facing docs.
- BentoPDF references remain valid when they describe the bundled PDF tools surface, tool-specific docs, upstream package names, or runtime components used by those tools.
- Legacy BentoPDF deployment artifacts were removed from the active repository surface: Docker/Helm release workflows, Helm chart files, Docker Compose/Unraid descriptors, container entrypoint/nginx files, and the air-gapped deployment script.

## 2026-05-14 Google Docs Authoring Copies

- Google Docs assignment markers can be copied with the document, so the marker `assignmentId` can point to an assignment whose registered Google document ID differs from the currently opened Doc.
- The add-on should treat this mismatch as a copied or shared derivative and ask the signed-in instructor whether to create a new PaperBridge assignment from the current Doc before changing assignment linkage.
- PaperBridge must not silently attach a copied Google document ID to an assignment owned by another instructor.
- Student Google Doc copies can be registered as document copies or packets, but copied Doc markers cannot carry reliable per page identity. Page numbers should be added only when PaperBridge exports the Doc to PDF and replaces each repeated placeholder QR.
