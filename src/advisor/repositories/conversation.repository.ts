import { randomUUID } from "node:crypto";

import type {
  AdvisorConversation,
  AdvisorMessage,
  AdvisorQuerySnapshot,
  Prisma,
} from "@prisma/client";

import { prisma } from "../../infrastructure/prisma.js";
import type {
  AdvisorRequestContext,
  ConversationMessageRole,
  ConversationState,
  QueryConstraint,
  QuerySnapshot,
} from "../types.js";

const mapConversation = (
  conversationRow: AdvisorConversation,
  messageRows: AdvisorMessage[],
  snapshotRows: AdvisorQuerySnapshot[],
): ConversationState => ({
  id: conversationRow.id,
  context: {
    tenantId: conversationRow.tenantId,
    userId: conversationRow.userId,
    lenderId: conversationRow.lenderId,
    role: conversationRow.role as AdvisorRequestContext["role"],
  },
  messages: messageRows.map((row) => ({
    role: row.role as ConversationMessageRole,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  })),
  queryHistory: snapshotRows.map((row) => ({
    label: row.snapshotLabel,
    constraints: row.constraints as unknown as QueryConstraint[],
    resultLoanIds: row.resultLoanIds,
  })),
  createdAt: conversationRow.createdAt.toISOString(),
  updatedAt: conversationRow.updatedAt.toISOString(),
});

class ConversationRepository {
  async create(context: AdvisorRequestContext) {
    const id = randomUUID();
    const result = await prisma.advisorConversation.create({
      data: {
        id,
        tenantId: context.tenantId,
        userId: context.userId,
        lenderId: context.lenderId,
        role: context.role,
      },
    });

    return mapConversation(result, [], []);
  }

  async findById(conversationId: string) {
    const conversationRow = await prisma.advisorConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
        snapshots: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversationRow) {
      return null;
    }

    return mapConversation(
      conversationRow,
      conversationRow.messages,
      conversationRow.snapshots,
    );
  }

  async listByContext(context: AdvisorRequestContext, limit = 30) {
    const conversationRows = await prisma.advisorConversation.findMany({
      where: {
        tenantId: context.tenantId,
        userId: context.userId,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
        snapshots: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    return conversationRows.map((conversationRow) =>
      mapConversation(
        conversationRow,
        conversationRow.messages,
        conversationRow.snapshots,
      ),
    );
  }

  async appendMessage(
    conversationId: string,
    role: ConversationMessageRole,
    content: string,
  ) {
    await prisma.$transaction([
      prisma.advisorMessage.create({
        data: {
          id: randomUUID(),
          conversationId,
          role,
          content,
        },
      }),
      prisma.advisorConversation.update({
        where: { id: conversationId },
        data: {
          updatedAt: new Date(),
        },
      }),
    ]);
  }

  async appendQuerySnapshot(conversationId: string, snapshot: QuerySnapshot) {
    await prisma.$transaction([
      prisma.advisorQuerySnapshot.create({
        data: {
          id: randomUUID(),
          conversationId,
          snapshotLabel: snapshot.label,
          constraints: snapshot.constraints as unknown as Prisma.InputJsonValue,
          resultLoanIds: snapshot.resultLoanIds,
        },
      }),
      prisma.advisorConversation.update({
        where: { id: conversationId },
        data: {
          updatedAt: new Date(),
        },
      }),
    ]);
  }
}

export { ConversationRepository };
