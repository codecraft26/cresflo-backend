import type { Request, Response } from "express";

import { HttpError } from "../advisor/errors.js";
import { documentIngestionService } from "../documents/service/document-ingestion-service.js";
import { organizationService } from "../organization/service/organization-service.js";
import { superadminAuthService } from "../superadmin/auth/superadmin-auth-service.js";
import { sendResponse } from "../utils/api-response.js";

const readSingleRouteParam = (value: string | string[] | undefined, label: string) => {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  throw new HttpError(400, `${label} is required.`);
};

const loginSuperadmin = async (request: Request, response: Response) => {
  const body = request.body as {
    email?: string;
    password?: string;
  };

  if (!body.email || !body.password) {
    throw new HttpError(400, "email and password are required.");
  }

  const session = await superadminAuthService.login(body.email, body.password);

  return sendResponse(response, {
    statusCode: 200,
    success: true,
    message: "Superadmin login successful",
    data: session,
  });
};

const createOrganization = async (request: Request, response: Response) => {
  const body = request.body as {
    name?: string;
    slug?: string;
    lenderId?: string;
    overdueDaysThreshold?: number;
    highRiskScoreThreshold?: number;
  };

  if (
    !body.name ||
    !body.lenderId ||
    body.overdueDaysThreshold === undefined ||
    body.highRiskScoreThreshold === undefined
  ) {
    throw new HttpError(
      400,
      "name, lenderId, overdueDaysThreshold, and highRiskScoreThreshold are required.",
    );
  }

  const organization = await organizationService.createOrganization({
    name: body.name,
    slug: body.slug,
    lenderId: body.lenderId,
    overdueDaysThreshold: Number(body.overdueDaysThreshold),
    highRiskScoreThreshold: Number(body.highRiskScoreThreshold),
  });

  return sendResponse(response, {
    statusCode: 201,
    success: true,
    message: "Organization created",
    data: organization,
  });
};

const listOrganizations = async (request: Request, response: Response) => {
  const organizations = await organizationService.listOrganizations();

  return sendResponse(response, {
    statusCode: 200,
    success: true,
    message: "Organizations fetched",
    data: organizations,
  });
};

const createOrganizationUser = async (request: Request, response: Response) => {
  const organizationId = readSingleRouteParam(
    request.params.organizationId,
    "Organization ID",
  );
  const body = request.body as {
    email?: string;
    fullName?: string;
    password?: string;
    role?: "admin" | "analyst" | "servicer";
  };
  if (!body.email || !body.fullName || !body.password || !body.role) {
    throw new HttpError(
      400,
      "email, fullName, password, and role are required.",
    );
  }

  const user = await organizationService.createOrganizationUser({
    organizationId,
    email: body.email,
    fullName: body.fullName,
    password: body.password,
    role: body.role,
  });

  return sendResponse(response, {
    statusCode: 201,
    success: true,
    message: "Organization user created",
    data: user,
  });
};

const listOrganizationUsers = async (request: Request, response: Response) => {
  const organizationId = readSingleRouteParam(
    request.params.organizationId,
    "Organization ID",
  );

  const users = await organizationService.listOrganizationUsers(organizationId);

  return sendResponse(response, {
    statusCode: 200,
    success: true,
    message: "Organization users fetched",
    data: users,
  });
};

const getSuperadminProfile = async (request: Request, response: Response) => {
  return sendResponse(response, {
    statusCode: 200,
    success: true,
    message: "Superadmin profile fetched",
    data: {
      email: request.superadmin?.email ?? null,
      role: request.superadmin?.role ?? null,
    },
  });
};

const ingestOrganizationDocument = async (request: Request, response: Response) => {
  const organizationId = readSingleRouteParam(
    request.params.organizationId,
    "Organization ID",
  );
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

const ingestOrganizationPdfDocument = async (
  request: Request,
  response: Response,
) => {
  const organizationId = readSingleRouteParam(
    request.params.organizationId,
    "Organization ID",
  );
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

const listOrganizationDocuments = async (request: Request, response: Response) => {
  const organizationId = readSingleRouteParam(
    request.params.organizationId,
    "Organization ID",
  );

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

const listOrganizationDocumentIngestionJobs = async (
  request: Request,
  response: Response,
) => {
  const organizationId = readSingleRouteParam(
    request.params.organizationId,
    "Organization ID",
  );

  const jobs = await documentIngestionService.listIngestionJobs(organizationId);

  return sendResponse(response, {
    statusCode: 200,
    success: true,
    message: "Organization document ingestion jobs fetched",
    data: jobs,
  });
};

const getOrganizationDocumentIngestionJob = async (
  request: Request,
  response: Response,
) => {
  const organizationId = readSingleRouteParam(
    request.params.organizationId,
    "Organization ID",
  );
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
  createOrganization,
  ingestOrganizationDocument,
  ingestOrganizationPdfDocument,
  createOrganizationUser,
  getSuperadminProfile,
  getOrganizationDocumentIngestionJob,
  listOrganizationDocuments,
  listOrganizationDocumentIngestionJobs,
  listOrganizationUsers,
  listOrganizations,
  loginSuperadmin,
};
