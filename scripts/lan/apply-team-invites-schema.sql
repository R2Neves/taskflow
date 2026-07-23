-- Team invites + notifications grants for TaskFlow (text IDs)
DO $$ BEGIN
  CREATE TYPE "TeamInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "TeamInvite" (
  "id" TEXT PRIMARY KEY,
  "teamId" TEXT NOT NULL REFERENCES "Team"("id") ON DELETE CASCADE,
  "email" TEXT NOT NULL,
  "invitedUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "invitedById" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "status" "TeamInviteStatus" NOT NULL DEFAULT 'PENDING',
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "TeamInvite_email_status_idx" ON "TeamInvite"("email", "status");
CREATE INDEX IF NOT EXISTS "TeamInvite_invitedUserId_status_idx" ON "TeamInvite"("invitedUserId", "status");
CREATE INDEX IF NOT EXISTS "TeamInvite_teamId_status_idx" ON "TeamInvite"("teamId", "status");

GRANT SELECT ON public."TeamInvite" TO taskflow_readonly;
