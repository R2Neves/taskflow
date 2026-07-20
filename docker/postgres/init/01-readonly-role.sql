-- Read-only role for Cursor agent / tooling.
-- Application continues to use the owner role (taskflow).

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'taskflow_readonly') THEN
    CREATE ROLE taskflow_readonly LOGIN PASSWORD 'taskflow_readonly';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE taskflow TO taskflow_readonly;
GRANT USAGE ON SCHEMA public TO taskflow_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO taskflow_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO taskflow_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO taskflow_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO taskflow_readonly;
