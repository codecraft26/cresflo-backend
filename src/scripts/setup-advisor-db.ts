import { execFileSync } from "node:child_process";
import { randomUUID, scryptSync } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotEnv } from "dotenv";
import { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

loadDotEnv({
  path: path.resolve(projectRoot, ".env"),
});

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/cresflo_advisor";

const defaultSuperadminEmail = "superadmin@cresflo.local";
const defaultSuperadminPassword = "change-me";

const hashPassword = (password: string) => {
  const salt = randomUUID().replaceAll("-", "");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
};

const run = async () => {
  const extensionPool = new Pool({
    connectionString: databaseUrl,
  });

  try {
    await extensionPool.query("create extension if not exists vector");
  } finally {
    await extensionPool.end();
  }

  execFileSync(
    npxCommand,
    ["prisma", "db", "push"],
    {
      cwd: projectRoot,
      stdio: "inherit",
    },
  );

  const seededHash = hashPassword(defaultSuperadminPassword);

  const seedPool = new Pool({
    connectionString: databaseUrl,
  });

  try {
    await seedPool.query(
      `
        insert into superadmins (
          id,
          email,
          password_hash,
          role
        )
        values ($1, $2, $3, 'superadmin')
        on conflict (email)
        do update set
          password_hash = excluded.password_hash,
          role = excluded.role,
          updated_at = now()
      `,
      [randomUUID(), defaultSuperadminEmail, seededHash],
    );
  } finally {
    await seedPool.end();
  }

  console.log(
    `Advisor database schema is ready via Prisma. Seeded superadmin: ${defaultSuperadminEmail}`,
  );
};

run().catch((error) => {
  console.error("Failed to setup advisor database", error);
  process.exit(1);
});
