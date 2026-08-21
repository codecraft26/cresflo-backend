import type { Superadmin } from "@prisma/client";

import { prisma } from "../../infrastructure/prisma.js";

type SuperadminRecord = {
  id: string;
  email: string;
  passwordHash: string;
  role: "superadmin";
  createdAt: string;
  updatedAt: string;
};

const mapSuperadmin = (row: Superadmin): SuperadminRecord => ({
  id: row.id,
  email: row.email,
  passwordHash: row.passwordHash,
  role: row.role as "superadmin",
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

class SuperadminRepository {
  async findByEmail(email: string) {
    const row = await prisma.superadmin.findUnique({
      where: {
        email: email.trim().toLowerCase(),
      },
    });

    return row ? mapSuperadmin(row) : null;
  }
}

export { SuperadminRepository };
