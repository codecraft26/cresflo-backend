import type { Request, Response } from "express";

import { HttpError } from "../advisor/errors.js";
import { documentIngestionService } from "../documents/service/document-ingestion-service.js";
import { sendResponse } from "../utils/api-response.js";

const readSingleRouteParam = (value: string | string[] | undefined, label: string) => {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  throw new HttpError(400, `${label} is required.`);
};

const getOrganizationId = (request: Request) => {
  const organizationId = request.organizationUser?.tenantId;

  if (!organizationId) {
    throw new HttpError(401, "Organization authentication is required.");
  }

  return organizationId;
};

const ingestOrganizationDocumentForAdmin = async (
  request: Request,
  response: Response,
) => {
  const organizationId = getOrganizationId(request);
  const body = request.body as {
    title?: string;
    type?: "loan_agreement" | "policy" | "servicing_procedure" | "general";
    content?: string;
    summary?: string;
    loanId?: string;
    sixMonthExtensionAllowed?: boolean;
  };

  if (!body.title || !body.type || !body.content) {
    throw new HttpError(400, "title, type, and content are required.");
  }

  const job = await documentIngestionService.enqueueDocumentIngestion({
    organizationId,
    title: body.title,
    type: body.type,
    content: body.content,
    summary: body.summary,
    loanId: body.loanId,
    sixMonthExtensionAllowed: body.sixMonthExtensionAllowed,
  });

  return sendResponse(response, {
    statusCode: 202,
    success: true,
    message: "Organization document ingestion queued",
    data: job,
  });
};

const ingestOrganizationPdfDocumentForAdmin = async (
  request: Request,
  response: Response,
) => {
  const organizationId = getOrganizationId(request);
  const file = request.file;
  const body = request.body as {
    title?: string;
    type?: "loan_agreement" | "policy" | "servicing_procedure" | "general";
    summary?: string;
    loanId?: string;
    sixMonthExtensionAllowed?: string;
  };

  if (!file) {
    throw new HttpError(400, "A PDF file is required.");
  }

  if (file.mimetype !== "application/pdf") {
    throw new HttpError(400, "Only PDF uploads are supported.");
  }

  if (!body.type) {
    throw new HttpError(400, "Document type is required.");
  }

  const job = await documentIngestionService.enqueuePdfDocumentIngestion({
    organizationId,
    fileName: file.originalname,
    buffer: file.buffer,
    title: body.title || file.originalname.replace(/\.pdf$/i, ""),
    type: body.type,
    summary: body.summary,
    loanId: body.loanId,
    sixMonthExtensionAllowed: body.sixMonthExtensionAllowed === "true",
  });

  return sendResponse(response, {
    statusCode: 202,
    success: true,
    message: "Organization PDF ingestion queued",
    data: job,
  });
};

const listOrganizationDocumentsForAdmin = async (
  request: Request,
  response: Response,
) => {
  const organizationId = getOrganizationId(request);
  const documents = await documentIngestionService.listOrganizationDocuments(
    organizationId,
  );

  return sendResponse(response, {
    statusCode: 200,
    success: true,
    message: "Organization documents fetched",
    data: documents,
  });
};

const listOrganizationDocumentIngestionJobsForAdmin = async (
  request: Request,
  response: Response,
) => {
  const organizationId = getOrganizationId(request);
  const jobs = await documentIngestionService.listIngestionJobs(organizationId);

  return sendResponse(response, {
    statusCode: 200,
    success: true,
    message: "Organization document ingestion jobs fetched",
    data: jobs,
  });
};

const getOrganizationDocumentIngestionJobForAdmin = async (
  request: Request,
  response: Response,
) => {
  const organizationId = getOrganizationId(request);
  const jobId = readSingleRouteParam(request.params.jobId, "Job ID");

  const job = await documentIngestionService.getIngestionJob(organizationId, jobId);

  return sendResponse(response, {
    statusCode: 200,
    success: true,
    message: "Organization document ingestion job fetched",
    data: job,
  });
};

export {
  getOrganizationDocumentIngestionJobForAdmin,
  ingestOrganizationDocumentForAdmin,
  ingestOrganizationPdfDocumentForAdmin,
  listOrganizationDocumentIngestionJobsForAdmin,
  listOrganizationDocumentsForAdmin,
};
