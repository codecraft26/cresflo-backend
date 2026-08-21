import { randomUUID } from "node:crypto";

import type { OrganizationUser } from "@prisma/client";

import { prisma } from "../../infrastructure/prisma.js";
import type {
  CreateOrganizationUserInput,
  OrganizationUserRecord,
} from "../types.js";
import { hashPassword } from "../auth/password.js";

const mapUser = (row: OrganizationUser): OrganizationUserRecord => ({
  id: row.id,
  organizationId: row.organizationId,
  email: row.email,
  fullName: row.fullName,
  role: row.role as OrganizationUserRecord["role"],
  status: row.status as OrganizationUserRecord["status"],
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

class OrganizationUserRepository {
  async create(input: CreateOrganizationUserInput) {
    const user = await prisma.organizationUser.create({
      data: {
        id: randomUUID(),
        organizationId: input.organizationId,
        email: input.email.trim().toLowerCase(),
        fullName: input.fullName.trim(),
        passwordHash: hashPassword(input.password),
        role: input.role,
        status: "active",
      },
    });

    return mapUser(user);
  }

  async findByEmail(email: string) {
    const row = await prisma.organizationUser.findUnique({
      where: {
        email,
      },
    });

    return row
      ? {
          ...mapUser(row),
          passwordHash: row.passwordHash,
        }
      : null;
  }

  async listByOrganizationId(organizationId: string) {
    const result = await prisma.organizationUser.findMany({
      where: { organizationId },
      orderBy: {
        createdAt: "desc",
      },
    });

    return result.map(mapUser);
  }
}

export { OrganizationUserRepository };
