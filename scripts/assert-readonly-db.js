/**
 * Confirma que DATABASE_URL_READONLY só permite SELECT.
 * Usa o container Postgres (sem dependência npm extra).
 */
const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return env;
}

function psql(user, sql, password) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-e",
      `PGPASSWORD=${password}`,
      "taskflow-postgres",
      "psql",
      "-U",
      user,
      "-d",
      "taskflow",
      "-v",
      "ON_ERROR_STOP=1",
      "-tAc",
      sql,
    ],
    { encoding: "utf8" },
  ).trim();
}

function main() {
  const env = loadEnv(resolve(__dirname, "..", ".env"));
  const url = env.DATABASE_URL_READONLY || "";
  if (!url.includes("taskflow_readonly")) {
    console.error("DATABASE_URL_READONLY deve usar o usuário taskflow_readonly");
    process.exit(1);
  }

  const selectOk = psql("taskflow_readonly", "SELECT 1", "taskflow_readonly");
  if (selectOk !== "1") {
    console.error("Falha na consulta SELECT com taskflow_readonly");
    process.exit(1);
  }

  let writeBlocked = false;
  try {
    psql(
      "taskflow_readonly",
      "CREATE TABLE public.__readonly_probe(id int)",
      "taskflow_readonly",
    );
  } catch {
    writeBlocked = true;
  }

  if (!writeBlocked) {
    console.error("FALHA DE SEGURANÇA: taskflow_readonly conseguiu criar tabela");
    try {
      psql("taskflow", "DROP TABLE IF EXISTS public.__readonly_probe", "taskflow");
    } catch {
      /* ignore */
    }
    process.exit(1);
  }

  console.log("OK: taskflow_readonly consulta normalmente e escrita está bloqueada");
}

main();
