-- Checklist backlog (atividades a fazer → agendar diária/equipe)
-- IDs are TEXT to match the restored TaskFlow schema (Prisma uuid strings).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChecklistScope') THEN
    CREATE TYPE public."ChecklistScope" AS ENUM ('PERSONAL', 'TEAM');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public."ChecklistItem" (
  id text PRIMARY KEY,
  "ownerId" text NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  scope public."ChecklistScope" NOT NULL DEFAULT 'PERSONAL',
  "teamId" text REFERENCES public."Team"(id) ON DELETE SET NULL,
  done boolean NOT NULL DEFAULT false,
  "sortOrder" integer NOT NULL DEFAULT 0,
  "convertedTaskId" text UNIQUE REFERENCES public."Task"(id) ON DELETE SET NULL,
  "createdAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ChecklistItem_ownerId_done_idx"
  ON public."ChecklistItem" ("ownerId", done);

CREATE INDEX IF NOT EXISTS "ChecklistItem_teamId_idx"
  ON public."ChecklistItem" ("teamId");

GRANT SELECT ON public."ChecklistItem" TO taskflow_readonly;
