import { createHmac, timingSafeEqual } from "node:crypto";

import { HttpError } from "../../advisor/errors.js";
import { env } from "../../config/env.js";
import { OrganizationRepository } from "../repositories/organization.repository.js";
import { OrganizationUserRepository } from "../repositories/organization-user.repository.js";
import type { OrganizationUserSessionPayload } from "../types.js";
import { verifyPassword } from "./password.js";

const encodeBase64Url = (value: string) =>
  Buffer.from(value, "utf8").toString("base64url");

const decodeBase64Url = (value: string) =>
  Buffer.from(value, "base64url").toString("utf8");

const sign = (value: string) =>
  createHmac("sha256", env.ORGANIZATION_JWT_SECRET).update(value).digest("base64url");

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

class OrganizationAuthService {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly users: OrganizationUserRepository,
  ) {}

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.users.findByEmail(normalizedEmail);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new HttpError(401, "Invalid organization email or password.");
    }

    if (user.status !== "active") {
      throw new HttpError(403, "This organization user is inactive.");
    }

    const organization = await this.organizations.findById(user.organizationId);

    if (!organization || organization.status !== "active") {
      throw new HttpError(403, "The organization is not active.");
    }

    const payload: OrganizationUserSessionPayload = {
      sub: user.id,
      tenantId: organization.id,
      lenderId: organization.lenderId,
      email: user.email,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + env.ORGANIZATION_TOKEN_TTL_SECONDS,
    };

    const encodedPayload = encodeBase64Url(JSON.stringify(payload));
    const signature = sign(encodedPayload);

    return {
      accessToken: `${encodedPayload}.${signature}`,
      expiresInSeconds: env.ORGANIZATION_TOKEN_TTL_SECONDS,
      user: {
        id: user.id,
        organizationId: organization.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      organization,
    };
  }

  verifyToken(token: string) {
    const [encodedPayload, signature] = token.split(".");

    if (!encodedPayload || !signature) {
      throw new HttpError(401, "Invalid authentication token format.");
    }

    const expectedSignature = sign(encodedPayload);

    if (!safeEqual(signature, expectedSignature)) {
      throw new HttpError(401, "Invalid authentication token signature.");
    }

    const payload = JSON.parse(
      decodeBase64Url(encodedPayload),
    ) as OrganizationUserSessionPayload;

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new HttpError(401, "Authentication token has expired.");
    }

    return payload;
  }
}

const organizationAuthService = new OrganizationAuthService(
  new OrganizationRepository(),
  new OrganizationUserRepository(),
);

export { organizationAuthService, OrganizationAuthService };
