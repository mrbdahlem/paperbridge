# Database Migrations

Add production schema changes as ordered `.sql` files in this directory.

Use filenames that sort in execution order, for example:

```text
202606020001_create_assignments.sql
```

Run migrations with:

```bash
npm run db:migrate
```

Ensure `DATABASE_MIGRATION_URL` is set for migration execution; do not run
migrations against the pooled runtime `DATABASE_URL`.

The runner records applied migration filenames and checksums in
`schema_migrations`. Do not edit a migration after it has run against a shared
or production database; add a new migration instead.
