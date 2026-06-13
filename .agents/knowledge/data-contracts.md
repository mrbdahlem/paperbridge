# Data Contracts

Durable API, token, and payload contracts for ScribbledPage workflows.

## 2026-05-14 QR Code Tokens

- ScribbledPage generated assignment and packet codes use 8 characters from the QR-safe alphabet `23456789BCDFGHJKLMNPQRSTVWXYZ`.
- The alphabet excludes vowels and ambiguous `0` and `1` characters to reduce accidental objectionable words and transcription errors.
- Generated page tokens append the page number as `-P<number>`, for example `9X7K2VBM-P2`.
- The QR code stores a URL containing the opaque token; assignment, packet, and page metadata is resolved through ScribbledPage storage.

## 2026-05-16 Google OAuth User Identity Direction

- First-party user accounts should be created server-side after Google OAuth validates the Google identity.
- Store the internal ScribbledPage user id separately from the Google provider subject. Treat Google's `sub` claim as stable provider identity, not as the primary application id.
- Keep OAuth client secrets, session secrets, provider tokens, and database credentials out of browser-exposed `VITE_*` variables.

## 2026-06-12 Assignment QR Persistence

- MVP 0 server persistence starts with `assignments`, `packets`, and `qr_tokens`.
- `qr_tokens.token` remains the opaque printed/scanned lookup key, while `assignment_id`, `packet_id`, `template_version`, and `page_number` remain server-resolved metadata.
- `GET /api/qr-tokens/:token` returns the resolved QR token metadata or `404` when the token is unknown.
- Assignment APIs return `503` when `DATABASE_URL` is not configured so local static-only workflows can remain available without pretending data is durable.
- Browser assignment persistence calls the Fastify APIs first and falls back to localStorage only when the API is unavailable, such as static Vite development, network failure, or server `503`.
