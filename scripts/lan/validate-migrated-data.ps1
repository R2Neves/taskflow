$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$envPath = Join-Path $projectRoot ".env"
$line = Get-Content $envPath |
  Where-Object { $_ -match "^DATABASE_URL_READONLY=" } |
  Select-Object -First 1

if (-not $line) {
  throw "DATABASE_URL_READONLY ausente no .env."
}

$value = $line.Substring($line.IndexOf("=") + 1).Trim('"', "'")
$uri = [Uri]$value
$credentials = $uri.UserInfo.Split(":", 2)
$user = [Uri]::UnescapeDataString($credentials[0])
$password = [Uri]::UnescapeDataString($credentials[1])
$database = $uri.AbsolutePath.TrimStart("/")

if ($user -ne "taskflow_readonly") {
  throw "A validação exige DATABASE_URL_READONLY com taskflow_readonly."
}

$sql = @'
\echo === Conta do Felipe ===
SELECT "fullName", "email", "systemRole", "createdAt"
FROM "User"
WHERE lower(trim("email")) = 'flima@beautyservices.com.br';

\echo === Totais ===
SELECT
  (SELECT count(*) FROM "User") AS users,
  (SELECT count(*) FROM "Team") AS teams,
  (SELECT count(*) FROM "TeamMember") AS memberships,
  (SELECT count(*) FROM "Task") AS tasks,
  (SELECT count(*) FROM "RecurringActivity") AS recurring_activities;

\echo === Relacionamentos órfãos; todos devem ser zero ===
SELECT
  (SELECT count(*) FROM "TeamMember" tm LEFT JOIN "User" u ON u.id = tm."userId" WHERE u.id IS NULL) AS member_without_user,
  (SELECT count(*) FROM "TeamMember" tm LEFT JOIN "Team" t ON t.id = tm."teamId" WHERE t.id IS NULL) AS member_without_team,
  (SELECT count(*) FROM "Task" x LEFT JOIN "User" u ON u.id = x."ownerId" WHERE u.id IS NULL) AS task_without_owner,
  (SELECT count(*) FROM "Task" x LEFT JOIN "User" u ON u.id = x."assigneeId" WHERE u.id IS NULL) AS task_without_assignee;
'@

$sql | docker exec -i `
  -e "PGPASSWORD=$password" `
  taskflow-postgres `
  psql -U $user -d $database -v ON_ERROR_STOP=1 -P pager=off
