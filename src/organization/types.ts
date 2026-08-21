import type { UserRole } from "../advisor/types.js";

type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  lenderId: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};

type CreateOrganizationInput = {
  name: string;
  slug?: string;
  lenderId: string;
  overdueDaysThreshold: number;
  highRiskScoreThreshold: number;
};

type OrganizationUserRecord = {
  id: string;
  organizationId: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};

type CreateOrganizationUserInput = {
  organizationId: string;
  email: string;
  fullName: string;
  password: string;
  role: UserRole;
};

type OrganizationUserSessionPayload = {
  sub: string;
  tenantId: string;
  lenderId: string;
  email: string;
  role: UserRole;
  exp: number;
};

export type {
  CreateOrganizationInput,
  CreateOrganizationUserInput,
  OrganizationRecord,
  OrganizationUserRecord,
  OrganizationUserSessionPayload,
};
