import { randomUUID } from "node:crypto";

import type { DocumentIngestionJob } from "@prisma/client";

import { prisma } from "../../infrastructure/prisma.js";
import type {
  DocumentIngestionJobRecord,
  DocumentIngestionJobStatus,
  DocumentType,
} from "../types.js";

const mapJob = (row: DocumentIngestionJob): DocumentIngestionJobRecord => ({
  id: row.id,
  tenantId: row.tenantId,
  title: row.title,
  type: row.type as DocumentType,
  sourceKind: row.sourceKind as "text" | "pdf",
  status: row.status as DocumentIngestionJobStatus,
  progressPercentage: row.progressPercentage,
  statusMessage: row.statusMessage,
  errorMessage: row.errorMessage,
  documentId: row.documentId,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

class DocumentIngestionJobRepository {
  async create(input: {
    tenantId: string;
    title: string;
    type: DocumentType;
    sourceKind: "text" | "pdf";
  }) {
    const result = await prisma.documentIngestionJob.create({
      data: {
        id: randomUUID(),
        tenantId: input.tenantId,
        title: input.title,
        type: input.type,
        sourceKind: input.sourceKind,
        status: "queued",
        progressPercentage: 5,
        statusMessage: "Queued for ingestion",
      },
    });

    return mapJob(result);
  }

  async update(
    jobId: string,
    input: {
      status: DocumentIngestionJobStatus;
      progressPercentage: number;
      statusMessage: string;
      errorMessage?: string | null;
      documentId?: string | null;
    },
  ) {
    const result = await prisma.documentIngestionJob.update({
      where: { id: jobId },
      data: {
        status: input.status,
        progressPercentage: input.progressPercentage,
        statusMessage: input.statusMessage,
        errorMessage: input.errorMessage ?? null,
        documentId: input.documentId ?? null,
        updatedAt: new Date(),
      },
    });

    return mapJob(result);
  }

  async findById(jobId: string) {
    const row = await prisma.documentIngestionJob.findUnique({
      where: { id: jobId },
    });
    return row ? mapJob(row) : null;
  }

  async listByTenant(tenantId: string) {
    const result = await prisma.documentIngestionJob.findMany({
      where: { tenantId },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    });

    return result.map(mapJob);
  }
}

export { DocumentIngestionJobRepository };
