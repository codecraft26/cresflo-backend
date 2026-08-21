import { toSql } from "pgvector";
import type { Document } from "@prisma/client";

import { pool } from "../../infrastructure/postgres.js";
import { prisma } from "../../infrastructure/prisma.js";
import type { AdvisorRequestContext, DocumentRecord } from "../types.js";

type DocumentChunkRow = {
  id: string;
  document_id: string;
  document_title: string;
  document_type: string;
  content: string;
  similarity: number;
};

const mapDocument = (row: Document): DocumentRecord => ({
  id: row.id,
  tenantId: row.tenantId,
  loanId: row.loanId,
  title: row.title,
  type: row.type as DocumentRecord["type"],
  summary: row.summary,
  sixMonthExtensionAllowed: row.sixMonthExtensionAllowed,
});

class DocumentRepository {
  async findLoanAgreement(context: AdvisorRequestContext, loanId: string) {
    const row = await prisma.document.findFirst({
      where: {
        tenantId: context.tenantId,
        loanId,
        type: "loan_agreement",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return row ? mapDocument(row) : null;
  }

  async findRelevantChunks(
    context: AdvisorRequestContext,
    loanId: string | undefined,
    embedding: number[],
    limit = 6,
  ) {
    if (!loanId) {
      const result = await pool.query<DocumentChunkRow>(
        `
          select
            dc.id,
            dc.document_id,
            d.title as document_title,
            d.type as document_type,
            dc.content,
            1 - (dc.embedding <=> $2::vector) as similarity
          from document_chunks dc
          inner join documents d on d.id = dc.document_id
          where d.tenant_id = $1
            and length(trim(dc.content)) >= 20
          order by dc.embedding <=> $2::vector asc
          limit $3
        `,
        [context.tenantId, toSql(embedding), limit],
      );

      return result.rows;
    }

    const result = await pool.query<DocumentChunkRow>(
      `
        select
          dc.id,
          dc.document_id,
          d.title as document_title,
          d.type as document_type,
          dc.content,
          1 - (dc.embedding <=> $3::vector) as similarity
        from document_chunks dc
        inner join documents d on d.id = dc.document_id
        where d.tenant_id = $1
          and d.loan_id = $2
          and length(trim(dc.content)) >= 20
        order by dc.embedding <=> $3::vector asc
        limit $4
      `,
      [context.tenantId, loanId, toSql(embedding), limit],
    );

    return result.rows;
  }

  async findDocumentPreviews(
    context: AdvisorRequestContext,
    documentIds: string[],
    maxCharacters = 2_000,
  ) {
    if (documentIds.length === 0) {
      return [];
    }

    const documents = await prisma.document.findMany({
      where: {
        tenantId: context.tenantId,
        id: { in: documentIds },
      },
      select: {
        id: true,
        title: true,
        sourceText: true,
      },
    });

    return documents.map((document) => ({
      documentId: document.id,
      title: document.title,
      content: document.sourceText.slice(0, maxCharacters),
    }));
  }
}

export { DocumentRepository };
