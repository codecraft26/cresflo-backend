import type { NextFunction, Request, Response } from "express";

import { HttpError } from "../advisor/errors.js";

const requireOrganizationAdmin = (
  request: Request,
  _response: Response,
  next: NextFunction,
) => {
  if (!request.organizationUser) {
    throw new HttpError(401, "Organization authentication is required.");
  }

  if (request.organizationUser.role !== "admin") {
    throw new HttpError(403, "Organization admin access is required.");
  }

  next();
};

export { requireOrganizationAdmin };
