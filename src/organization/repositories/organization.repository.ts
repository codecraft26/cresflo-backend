import { randomUUID } from "node:crypto";

import { prisma } from "../../infrastructure/prisma.js";
import type {
  CreateOrganizationInput,
  OrganizationRecord,
} from "../types.js";
import type { Organization } from "@prisma/client";

const mapOrganization = (row: Organization): OrganizationRecord => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  lenderId: row.lenderId,
  status: row.status as OrganizationRecord["status"],
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

class OrganizationRepository {
  async create(input: CreateOrganizationInput) {
    const id = randomUUID();
    const slug = input.slug ?? input.name.toLowerCase().trim().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "");

    const organization = await prisma.$transaction(async (tx) => {
      const createdOrganization = await tx.organization.create({
        data: {
          id,
          name: input.name,
          slug,
          lenderId: input.lenderId,
          status: "active",
        },
      });

      await tx.lenderDefinition.create({
        data: {
          tenantId: id,
          lenderId: input.lenderId,
          overdueDaysThreshold: input.overdueDaysThreshold,
          highRiskScoreThreshold: input.highRiskScoreThreshold,
        },
      });

      return createdOrganization;
    });

    return mapOrganization(organization);
  }

  async list() {
    const result = await prisma.organization.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return result.map(mapOrganization);
  }

  async findById(id: string) {
    const row = await prisma.organization.findUnique({
      where: { id },
    });

    return row ? mapOrganization(row) : null;
  }
}

export { OrganizationRepository };
