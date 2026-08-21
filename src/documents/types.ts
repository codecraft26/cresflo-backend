type DocumentType = "loan_agreement" | "policy" | "servicing_procedure" | "general";

type DocumentIngestionJobStatus =
  | "queued"
  | "extracting"
  | "chunking"
  | "embedding"
  | "indexing"
  | "completed"
  | "failed";

type IngestDocumentInput = {
  organizationId: string;
  title: string;
  type: DocumentType;
  content: string;
  summary?: string;
  loanId?: string;
  sixMonthExtensionAllowed?: boolean;
};

type IngestPdfDocumentInput = Omit<IngestDocumentInput, "content"> & {
  fileName: string;
  buffer: Buffer;
};

type DocumentIngestionJobRecord = {
  id: string;
  tenantId: string;
  title: string;
  type: DocumentType;
  sourceKind: "text" | "pdf";
  status: DocumentIngestionJobStatus;
  progressPercentage: number;
  statusMessage: string;
  errorMessage?: string | null;
  documentId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type {
  DocumentIngestionJobRecord,
  DocumentIngestionJobStatus,
  DocumentType,
  IngestDocumentInput,
  IngestPdfDocumentInput,
};
