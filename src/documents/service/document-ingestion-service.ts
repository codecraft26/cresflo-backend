import { HttpError } from "../../advisor/errors.js";
import { env } from "../../config/env.js";
import { DeterministicEmbeddingProvider } from "../../advisor/providers/embedding-provider.js";
import { OpenAiEmbeddingProvider } from "../../advisor/providers/openai-embedding-provider.js";
import { OrganizationRepository } from "../../organization/repositories/organization.repository.js";
import { PortfolioRepository } from "../../advisor/repositories/portfolio.repository.js";
import { DocumentIngestionRepository } from "../repositories/document-ingestion.repository.js";
import { DocumentIngestionJobRepository } from "../repositories/document-ingestion-job.repository.js";
import type {
  DocumentIngestionJobRecord,
  IngestDocumentInput,
  IngestPdfDocumentInput,
} from "../types.js";
import { chunkText } from "../utils/chunk-text.js";
import { extractPdfText } from "../utils/extract-pdf-text.js";

class DocumentIngestionService {
  constructor(
    private readonly documents: DocumentIngestionRepository,
    private readonly jobs: DocumentIngestionJobRepository,
    private readonly organizations: OrganizationRepository,
    private readonly portfolios: PortfolioRepository,
  ) {}

  async enqueueDocumentIngestion(input: IngestDocumentInput) {
    const organization = await this.organizations.findById(input.organizationId);

    if (!organization) {
      throw new HttpError(404, "Organization not found.");
    }

    const job = await this.jobs.create({
      tenantId: organization.id,
      title: input.title.trim(),
      type: input.type,
      sourceKind: "text",
    });

    void this.processTextJob(job.id, input);

    return job;
  }

  async enqueuePdfDocumentIngestion(input: IngestPdfDocumentInput) {
    const organization = await this.organizations.findById(input.organizationId);

    if (!organization) {
      throw new HttpError(404, "Organization not found.");
    }

    const job = await this.jobs.create({
      tenantId: organization.id,
      title: (input.title || input.fileName.replace(/\.pdf$/i, "")).trim(),
      type: input.type,
      sourceKind: "pdf",
    });

    void this.processPdfJob(job.id, input);

    return job;
  }

  async listOrganizationDocuments(organizationId: string) {
    const organization = await this.organizations.findById(organizationId);

    if (!organization) {
      throw new HttpError(404, "Organization not found.");
    }

    return this.documents.listDocumentsByTenant(organization.id);
  }

  async getIngestionJob(organizationId: string, jobId: string) {
    const organization = await this.organizations.findById(organizationId);

    if (!organization) {
      throw new HttpError(404, "Organization not found.");
    }

    const job = await this.jobs.findById(jobId);

    if (!job || job.tenantId !== organization.id) {
      throw new HttpError(404, "Document ingestion job not found.");
    }

    return job;
  }

  async listIngestionJobs(organizationId: string) {
    const organization = await this.organizations.findById(organizationId);

    if (!organization) {
      throw new HttpError(404, "Organization not found.");
    }

    return this.jobs.listByTenant(organization.id);
  }

  private async processTextJob(jobId: string, input: IngestDocumentInput) {
    try {
      await this.ingestNormalizedDocument(jobId, input);
    } catch (error) {
      await this.failJob(jobId, error);
    }
  }

  private async processPdfJob(jobId: string, input: IngestPdfDocumentInput) {
    try {
      await this.jobs.update(jobId, {
        status: "extracting",
        progressPercentage: 20,
        statusMessage: "Extracting text from PDF",
      });

      const extractedText = await extractPdfText(input.buffer);

      await this.ingestNormalizedDocument(jobId, {
        organizationId: input.organizationId,
        title: input.title || input.fileName.replace(/\.pdf$/i, ""),
        type: input.type,
        content: extractedText,
        summary: input.summary,
        loanId: input.loanId,
        sixMonthExtensionAllowed: input.sixMonthExtensionAllowed,
      });
    } catch (error) {
      await this.failJob(jobId, error);
    }
  }

  private async ingestNormalizedDocument(jobId: string, input: IngestDocumentInput) {
    const organization = await this.organizations.findById(input.organizationId);

    if (!organization) {
      throw new HttpError(404, "Organization not found.");
    }

    if (input.title.trim().length < 2) {
      throw new HttpError(400, "Document title must be at least 2 characters.");
    }

    if (input.content.trim().length < 30) {
      throw new HttpError(400, "Document content must be at least 30 characters.");
    }

    if (input.loanId) {
      const [loan] = await this.portfolios.findLoansByIds(
        {
          tenantId: organization.id,
          userId: "system",
          lenderId: organization.lenderId,
          role: "admin",
        },
        [input.loanId],
      );

      if (!loan) {
        throw new HttpError(404, "Referenced loan was not found for this organization.");
      }
    }

    await this.jobs.update(jobId, {
      status: "chunking",
      progressPercentage: 40,
      statusMessage: "Chunking document text",
    });

    const chunks = chunkText(input.content);

    if (chunks.length === 0) {
      throw new HttpError(400, "Document content could not be chunked.");
    }

    const embeddingProvider =
      env.ADVISOR_LLM_PROVIDER === "openai"
        ? new OpenAiEmbeddingProvider()
        : new DeterministicEmbeddingProvider();

    await this.jobs.update(jobId, {
      status: "embedding",
      progressPercentage: 70,
      statusMessage: "Generating embeddings",
    });

    const chunkEmbeddings = await Promise.all(
      chunks.map(async (chunk) => ({
        content: chunk,
        embedding: await embeddingProvider.embed(chunk),
      })),
    );

    await this.jobs.update(jobId, {
      status: "indexing",
      progressPercentage: 90,
      statusMessage: "Indexing document into vector store",
    });

    const document = await this.documents.createDocumentWithChunks({
      tenantId: organization.id,
      loanId: input.loanId,
      title: input.title.trim(),
      type: input.type,
      summary: input.summary?.trim() || chunks[0]!.slice(0, 220),
      content: input.content.trim(),
      sixMonthExtensionAllowed: input.sixMonthExtensionAllowed ?? false,
      chunks: chunkEmbeddings,
    });

    await this.jobs.update(jobId, {
      status: "completed",
      progressPercentage: 100,
      statusMessage: "Document ingestion complete",
      documentId: document.id,
    });
  }

  private async failJob(jobId: string, error: unknown) {
    const message = error instanceof Error ? error.message : "Document ingestion failed.";

    await this.jobs.update(jobId, {
      status: "failed",
      progressPercentage: 100,
      statusMessage: "Document ingestion failed",
      errorMessage: message,
    });
  }
}

const documentIngestionService = new DocumentIngestionService(
  new DocumentIngestionRepository(),
  new DocumentIngestionJobRepository(),
  new OrganizationRepository(),
  new PortfolioRepository(),
);

export { documentIngestionService, DocumentIngestionService };
