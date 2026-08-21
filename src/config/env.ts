import { config as loadDotEnv } from "dotenv";
import { z } from "zod";

loadDotEnv();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://postgres:postgres@127.0.0.1:5432/cresflo_advisor"),
  REDIS_URL: z.string().min(1).default("redis://127.0.0.1:6379"),
  REDIS_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  ADVISOR_LLM_PROVIDER: z.enum(["mock", "openai"]).default("mock"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_LLM_MODEL: z.string().min(1).default("gpt-5"),
  OPENAI_EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
  ORGANIZATION_JWT_SECRET: z.string().min(16).default("organization-secret-change-me"),
  ORGANIZATION_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(28800),
  SUPERADMIN_JWT_SECRET: z.string().min(16).default("superadmin-secret-change-me"),
  SUPERADMIN_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(28800),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://localhost:3004")
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ADVISOR_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  ADVISOR_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(8),
});

const env = envSchema.parse(process.env);

export { env };
