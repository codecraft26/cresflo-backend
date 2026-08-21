import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env.js";

const allowedOrigins = new Set(env.CORS_ALLOWED_ORIGINS);

const corsMiddleware = (request: Request, response: Response, next: NextFunction) => {
  const origin = request.header("origin");

  if (origin && allowedOrigins.has(origin)) {
    response.header("Access-Control-Allow-Origin", origin);
    response.header("Vary", "Origin");
  }

  response.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  response.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  next();
};

export { corsMiddleware };
