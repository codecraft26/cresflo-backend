import type { SuperadminSessionPayload } from "../superadmin/types.js";
import type { OrganizationUserSessionPayload } from "../organization/types.js";
import type { Multer } from "multer";

declare global {
  namespace Express {
    interface Request {
      file?: Multer.File;
      organizationUser?: OrganizationUserSessionPayload;
      superadmin?: SuperadminSessionPayload;
    }
  }
}

export {};
