import type { NextFunction, Request, Response } from "express";

import { HttpError } from "../advisor/errors.js";
import { superadminAuthService } from "../superadmin/auth/superadmin-auth-service.js";

const requireSuperadminAuth = (
  request: Request,
  _response: Response,
  next: NextFunction,
) => {
  const authorization = request.header("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing Bearer token.");
  }

  const token = authorization.slice("Bearer ".length).trim();
  const session = superadminAuthService.verifyToken(token);

  request.superadmin = session;

  next();
};

export { requireSuperadminAuth };
