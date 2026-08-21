import { randomUUID } from "node:crypto";

import { toSql } from "pgvector";
import type { Document } from "@prisma/client";

import { pool } from "../../infrastructure/postgres.js";
import { prisma } from "../../infrastructure/prisma.js";
import type { DocumentRecord } from "../../advisor/types.js";
import type { DocumentType } from "../types.js";

const mapDocument = (row: Document): DocumentRecord => ({
  id: row.id,
  tenantId: row.tenantId,
  loanId: row.loanId,
  title: row.title,
  type: row.type as DocumentType,
  summary: row.summary,
  sixMonthExtensionAllowed: row.sixMonthExtensionAllowed,
});

class DocumentIngestionRepository {
  async createDocumentWithChunks(input: {
    tenantId: string;
    loanId?: string;
    title: string;
    type: DocumentType;
    summary: string;
    content: string;
    sixMonthExtensionAllowed: boolean;
    chunks: {
      content: string;
      embedding: number[];
    }[];
  }): Promise<DocumentRecord> {
    const documentId = randomUUID();
    const document = await prisma.$transaction(async (tx) => {
      const createdDocument = await tx.document.create({
        data: {
          id: documentId,
          tenantId: input.tenantId,
          loanId: input.loanId ?? null,
          title: input.title,
          type: input.type,
          summary: input.summary,
          sourceText: input.content,
          sixMonthExtensionAllowed: input.sixMonthExtensionAllowed,
        },
      });

      for (const chunk of input.chunks) {
        await tx.$executeRawUnsafe(
          `
            insert into document_chunks (id, document_id, content, embedding)
            values ($1, $2, $3, $4::vector)
          `,
          randomUUID(),
          documentId,
          chunk.content,
          toSql(chunk.embedding),
        );
      }

      return createdDocument;
    });

    return mapDocument(document);
  }

  async listDocumentsByTenant(tenantId: string) {
    const result = await prisma.document.findMany({
      where: { tenantId },
      orderBy: {
        createdAt: "desc",
      },
    });

    return result.map(mapDocument);
  }
}

export { DocumentIngestionRepository };
