import type { NextFunction, Request, Response } from "express";

const corsMiddleware = (request: Request, response: Response, next: NextFunction) => {
  const origin = request.header("origin");

  response.header("Access-Control-Allow-Origin", origin ?? "*");
  response.header("Vary", "Origin");

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
