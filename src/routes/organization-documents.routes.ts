import { Router } from "express";

import {
  getOrganizationDocumentIngestionJobForAdmin,
  ingestOrganizationDocumentForAdmin,
  ingestOrganizationPdfDocumentForAdmin,
  listOrganizationDocumentIngestionJobsForAdmin,
  listOrganizationDocumentsForAdmin,
} from "../controllers/organization-documents.controller.js";
import { documentUpload } from "../middlewares/document-upload.js";
import { requireOrganizationAdmin } from "../middlewares/organization-admin-auth.js";
import { requireOrganizationAuth } from "../middlewares/organization-auth.js";

const organizationDocumentsRouter = Router();

organizationDocumentsRouter.use(requireOrganizationAuth, requireOrganizationAdmin);
organizationDocumentsRouter.get("/documents", listOrganizationDocumentsForAdmin);
organizationDocumentsRouter.get(
  "/documents/jobs",
  listOrganizationDocumentIngestionJobsForAdmin,
);
organizationDocumentsRouter.get(
  "/documents/jobs/:jobId",
  getOrganizationDocumentIngestionJobForAdmin,
);
organizationDocumentsRouter.post("/documents", ingestOrganizationDocumentForAdmin);
organizationDocumentsRouter.post(
  "/documents/pdf",
  documentUpload.single("file"),
  ingestOrganizationPdfDocumentForAdmin,
);

export { organizationDocumentsRouter };
