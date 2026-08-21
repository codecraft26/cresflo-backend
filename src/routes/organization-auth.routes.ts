import { Router } from "express";

import {
  getOrganizationProfile,
  loginOrganizationUser,
} from "../controllers/organization-auth.controller.js";
import { requireOrganizationAuth } from "../middlewares/organization-auth.js";

const organizationAuthRouter = Router();

organizationAuthRouter.post("/login", loginOrganizationUser);
organizationAuthRouter.get("/me", requireOrganizationAuth, getOrganizationProfile);

export { organizationAuthRouter };
