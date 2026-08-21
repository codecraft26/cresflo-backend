import { Router } from "express";

import {
  createOrganization,
  createOrganizationUser,
  getSuperadminProfile,
  getOrganizationDocumentIngestionJob,
  ingestOrganizationDocument,
  ingestOrganizationPdfDocument,
  listOrganizationDocuments,
  listOrganizationDocumentIngestionJobs,
  listOrganizationUsers,
  listOrganizations,
  loginSuperadmin,
} from "../controllers/superadmin.controller.js";
import { documentUpload } from "../middlewares/document-upload.js";
import { requireSuperadminAuth } from "../middlewares/superadmin-auth.js";

const superadminRouter = Router();

superadminRouter.post("/login", loginSuperadmin);
superadminRouter.get("/me", requireSuperadminAuth, getSuperadminProfile);
superadminRouter.get("/organizations", requireSuperadminAuth, listOrganizations);
superadminRouter.post("/organizations", requireSuperadminAuth, createOrganization);
superadminRouter.get(
  "/organizations/:organizationId/users",
  requireSuperadminAuth,
  listOrganizationUsers,
);
superadminRouter.post(
  "/organizations/:organizationId/users",
  requireSuperadminAuth,
  createOrganizationUser,
);
superadminRouter.get(
  "/organizations/:organizationId/documents",
  requireSuperadminAuth,
  listOrganizationDocuments,
);
superadminRouter.get(
  "/organizations/:organizationId/documents/jobs",
  requireSuperadminAuth,
  listOrganizationDocumentIngestionJobs,
);
superadminRouter.get(
  "/organizations/:organizationId/documents/jobs/:jobId",
  requireSuperadminAuth,
  getOrganizationDocumentIngestionJob,
);
superadminRouter.post(
  "/organizations/:organizationId/documents",
  requireSuperadminAuth,
  ingestOrganizationDocument,
);
superadminRouter.post(
  "/organizations/:organizationId/documents/pdf",
  requireSuperadminAuth,
  documentUpload.single("file"),
  ingestOrganizationPdfDocument,
);

export { superadminRouter };
