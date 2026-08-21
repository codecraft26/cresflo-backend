import type { NextFunction, Request, Response } from "express";

import { HttpError } from "../advisor/errors.js";
import { organizationAuthService } from "../organization/auth/organization-auth-service.js";

const requireOrganizationAuth = (
  request: Request,
  _response: Response,
  next: NextFunction,
) => {
  const authorization = request.header("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing Bearer token.");
  }

  const token = authorization.slice("Bearer ".length).trim();
  const session = organizationAuthService.verifyToken(token);

  request.organizationUser = session;

  next();
};

export { requireOrganizationAuth };
