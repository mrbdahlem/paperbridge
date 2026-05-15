# Data Contracts

Durable API, token, and payload contracts for ScribbledPage workflows.

## 2026-05-14 QR Code Tokens

- ScribbledPage generated assignment and packet codes use 8 characters from the QR-safe alphabet `23456789BCDFGHJKLMNPQRSTVWXYZ`.
- The alphabet excludes vowels and ambiguous `0` and `1` characters to reduce accidental objectionable words and transcription errors.
- Generated page tokens append the page number as `-P<number>`, for example `9X7K2VBM-P2`.
- The QR code stores a URL containing the opaque token; assignment, packet, and page metadata is resolved through ScribbledPage storage.
