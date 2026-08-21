import { HttpError } from "../../advisor/errors.js";
import type { CreateOrganizationInput, CreateOrganizationUserInput } from "../types.js";
import { OrganizationRepository } from "../repositories/organization.repository.js";
import { OrganizationUserRepository } from "../repositories/organization-user.repository.js";

class OrganizationService {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly users: OrganizationUserRepository,
  ) {}

  async createOrganization(input: CreateOrganizationInput) {
    if (input.name.trim().length < 2) {
      throw new HttpError(400, "Organization name must be at least 2 characters.");
    }

    if (input.lenderId.trim().length < 2) {
      throw new HttpError(400, "Lender ID is required.");
    }

    if (input.overdueDaysThreshold <= 0 || input.highRiskScoreThreshold <= 0) {
      throw new HttpError(
        400,
        "Threshold values must be positive numbers.",
      );
    }

    return this.organizations.create({
      ...input,
      name: input.name.trim(),
      slug: input.slug?.trim(),
      lenderId: input.lenderId.trim(),
    });
  }

  async listOrganizations() {
    return this.organizations.list();
  }

  async createOrganizationUser(input: CreateOrganizationUserInput) {
    const organization = await this.organizations.findById(input.organizationId);

    if (!organization) {
      throw new HttpError(404, "Organization not found.");
    }

    if (input.fullName.trim().length < 2) {
      throw new HttpError(400, "Full name must be at least 2 characters.");
    }

    if (input.password.length < 8) {
      throw new HttpError(400, "Password must be at least 8 characters.");
    }

    return this.users.create({
      ...input,
      email: input.email.trim().toLowerCase(),
      fullName: input.fullName.trim(),
    });
  }

  async listOrganizationUsers(organizationId: string) {
    const organization = await this.organizations.findById(organizationId);

    if (!organization) {
      throw new HttpError(404, "Organization not found.");
    }

    return this.users.listByOrganizationId(organizationId);
  }
}

const organizationService = new OrganizationService(
  new OrganizationRepository(),
  new OrganizationUserRepository(),
);

export { organizationService, OrganizationService };
