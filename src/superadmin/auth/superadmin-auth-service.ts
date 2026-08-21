import { createHmac, timingSafeEqual } from "node:crypto";

import { HttpError } from "../../advisor/errors.js";
import { env } from "../../config/env.js";
import { verifyPassword } from "../../organization/auth/password.js";
import { SuperadminRepository } from "../repositories/superadmin.repository.js";
import type { SuperadminSessionPayload } from "../types.js";

const encodeBase64Url = (value: string) =>
  Buffer.from(value, "utf8").toString("base64url");

const decodeBase64Url = (value: string) =>
  Buffer.from(value, "base64url").toString("utf8");

const sign = (value: string) =>
  createHmac("sha256", env.SUPERADMIN_JWT_SECRET).update(value).digest("base64url");

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

class SuperadminAuthService {
  constructor(private readonly superadmins: SuperadminRepository) {}

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const superadmin = await this.superadmins.findByEmail(normalizedEmail);

    if (!superadmin || !verifyPassword(password, superadmin.passwordHash)) {
      throw new HttpError(401, "Invalid superadmin email or password.");
    }

    const payload: SuperadminSessionPayload = {
      sub: superadmin.id,
      email: superadmin.email,
      role: superadmin.role,
      exp:
        Math.floor(Date.now() / 1000) + env.SUPERADMIN_TOKEN_TTL_SECONDS,
    };

    const encodedPayload = encodeBase64Url(JSON.stringify(payload));
    const signature = sign(encodedPayload);

    return {
      accessToken: `${encodedPayload}.${signature}`,
      expiresInSeconds: env.SUPERADMIN_TOKEN_TTL_SECONDS,
      user: {
        email: payload.email,
        role: payload.role,
      },
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
    ) as SuperadminSessionPayload;

    if (payload.role !== "superadmin") {
      throw new HttpError(403, "Invalid session role.");
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new HttpError(401, "Authentication token has expired.");
    }

    return payload;
  }
}

const superadminAuthService = new SuperadminAuthService(new SuperadminRepository());

export { superadminAuthService, SuperadminAuthService };
