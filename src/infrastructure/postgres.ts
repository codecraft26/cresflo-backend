import { Pool, type QueryResultRow } from "pg";

import { env } from "../config/env.js";

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

pool.on("error", (error: Error) => {
  console.error("Unexpected Postgres client error", error);
});

const query = <T extends QueryResultRow>(text: string, params?: unknown[]) =>
  pool.query<T>(text, params);

export { pool, query };
