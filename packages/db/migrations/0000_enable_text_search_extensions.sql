-- AtlasHQ PostgreSQL baseline extensions for fuzzy and accent-insensitive text search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Audit tables are append-only. Future migrations must not add mutable audit workflows.
