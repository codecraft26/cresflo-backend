import type { Request, Response } from "express";

import { HttpError } from "../advisor/errors.js";
import { organizationAuthService } from "../organization/auth/organization-auth-service.js";
import { sendResponse } from "../utils/api-response.js";

const loginOrganizationUser = async (request: Request, response: Response) => {
  const body = request.body as {
    email?: string;
    password?: string;
  };

  if (!body.email || !body.password) {
    throw new HttpError(400, "email and password are required.");
  }

  const session = await organizationAuthService.login(body.email, body.password);

  return sendResponse(response, {
    statusCode: 200,
    success: true,
    message: "Organization user login successful",
    data: session,
  });
};

const getOrganizationProfile = async (request: Request, response: Response) => {
  return sendResponse(response, {
    statusCode: 200,
    success: true,
    message: "Organization profile fetched",
    data: {
      userId: request.organizationUser?.sub ?? null,
      tenantId: request.organizationUser?.tenantId ?? null,
      lenderId: request.organizationUser?.lenderId ?? null,
      email: request.organizationUser?.email ?? null,
      role: request.organizationUser?.role ?? null,
    },
  });
};

export { getOrganizationProfile, loginOrganizationUser };
