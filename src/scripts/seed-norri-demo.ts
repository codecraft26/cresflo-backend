import { toSql } from "pgvector";

import { env } from "../config/env.js";
import { prisma } from "../infrastructure/prisma.js";
import { pool } from "../infrastructure/postgres.js";
import { DeterministicEmbeddingProvider } from "../advisor/providers/embedding-provider.js";
import { OpenAiEmbeddingProvider } from "../advisor/providers/openai-embedding-provider.js";
import type { EmbeddingProvider } from "../advisor/providers/embedding-provider.js";
import { chunkText } from "../documents/utils/chunk-text.js";

const tenantId = "83d8fa18-183c-4933-8248-eaa4032381b2";
const userId = "4d6115f9-8b4a-447f-8f4f-0c081088c79c";
const lenderId = "234";

const loans = [
  {
    id: "NORRI-LOAN-001",
    borrowerName: "Maple Ridge Developments",
    province: "Ontario",
    principalOutstanding: 125_000,
    status: "defaulted",
    riskScore: 91,
    daysPastDue: 96,
    interestCollectedLastQuarter: 2_100,
    interestCollectedPreviousQuarter: 4_800,
    propertyValue: 240_000,
    extensionEligible: true,
  },
  {
    id: "NORRI-LOAN-002",
    borrowerName: "Fleuve Capital Holdings",
    province: "Quebec",
    principalOutstanding: 87_500,
    status: "defaulted",
    riskScore: 86,
    daysPastDue: 74,
    interestCollectedLastQuarter: 1_450,
    interestCollectedPreviousQuarter: 3_100,
    propertyValue: 175_000,
    extensionEligible: false,
  },
  {
    id: "NORRI-LOAN-003",
    borrowerName: "Ottawa Urban Homes",
    province: "Ontario",
    principalOutstanding: 45_000,
    status: "defaulted",
    riskScore: 79,
    daysPastDue: 61,
    interestCollectedLastQuarter: 900,
    interestCollectedPreviousQuarter: 1_700,
    propertyValue: 130_000,
    extensionEligible: false,
  },
  {
    id: "NORRI-LOAN-004",
    borrowerName: "Prairie Sky Logistics",
    province: "Alberta",
    principalOutstanding: 210_000,
    status: "current",
    riskScore: 42,
    daysPastDue: 0,
    interestCollectedLastQuarter: 7_800,
    interestCollectedPreviousQuarter: 7_500,
    propertyValue: 390_000,
    extensionEligible: true,
  },
  {
    id: "NORRI-LOAN-005",
    borrowerName: "Pacific Cedar Rentals",
    province: "British Columbia",
    principalOutstanding: 68_000,
    status: "overdue",
    riskScore: 77,
    daysPastDue: 45,
    interestCollectedLastQuarter: 1_800,
    interestCollectedPreviousQuarter: 2_600,
    propertyValue: 205_000,
    extensionEligible: true,
  },
  {
    id: "NORRI-LOAN-006",
    borrowerName: "Kingston Family Foods",
    province: "Ontario",
    principalOutstanding: 32_000,
    status: "overdue",
    riskScore: 68,
    daysPastDue: 35,
    interestCollectedLastQuarter: 650,
    interestCollectedPreviousQuarter: 1_100,
    propertyValue: 105_000,
    extensionEligible: false,
  },
  {
    id: "NORRI-LOAN-007",
    borrowerName: "Quebec Atelier Group",
    province: "Quebec",
    principalOutstanding: 52_000,
    status: "current",
    riskScore: 35,
    daysPastDue: 0,
    interestCollectedLastQuarter: 2_200,
    interestCollectedPreviousQuarter: 2_050,
    propertyValue: 160_000,
    extensionEligible: true,
  },
  {
    id: "NORRI-LOAN-008",
    borrowerName: "Coastal Peak Hospitality",
    province: "British Columbia",
    principalOutstanding: 155_000,
    status: "defaulted",
    riskScore: 94,
    daysPastDue: 121,
    interestCollectedLastQuarter: 1_200,
    interestCollectedPreviousQuarter: 5_400,
    propertyValue: 280_000,
    extensionEligible: false,
  },
] as const;

const documents = [
  {
    id: "norri-demo-loan-agreement-001",
    loanId: "NORRI-LOAN-001",
    title: "Maple Ridge Loan Agreement",
    type: "loan_agreement",
    summary:
      "Maple Ridge may request one six-month maturity extension, subject to written lender approval and payment of all accrued interest.",
    content:
      "Loan agreement for Maple Ridge Developments, loan NORRI-LOAN-001. Extension clause: the borrower may request one extension of the maturity date for a period of six months. The extension is not automatic. It requires written approval from Norri, payment of all accrued interest and fees, delivery of updated property insurance, and no uncured covenant breach other than the payment default being addressed by the extension. The lender may decline the request after credit review.",
    sixMonthExtensionAllowed: true,
  },
  {
    id: "norri-demo-servicing-policy",
    loanId: null,
    title: "Norri Servicing and Risk Policy",
    type: "policy",
    summary:
      "Norri treats loans over 30 days past due as overdue and risk scores of 75 or more as high risk.",
    content:
      "Norri servicing policy. A loan is overdue when it is more than 30 calendar days past its contractual payment due date. A loan is classified as high risk when its approved portfolio risk score is 75 or greater. Loans above either threshold require weekly servicing review. Defaulted loans with principal outstanding above 50000 dollars must be escalated to the credit committee. Organization administrators may review portfolio and document evidence but must not treat advisor output as final legal advice.",
    sixMonthExtensionAllowed: false,
  },
] as const;

const getEmbeddingProvider = (): EmbeddingProvider =>
  env.ADVISOR_LLM_PROVIDER === "openai"
    ? new OpenAiEmbeddingProvider()
    : new DeterministicEmbeddingProvider();

const verifyTenant = async () => {
  const [organization, user] = await Promise.all([
    prisma.organization.findUnique({ where: { id: tenantId } }),
    prisma.organizationUser.findUnique({ where: { id: userId } }),
  ]);

  if (!organization || organization.lenderId !== lenderId) {
    throw new Error(`Expected Norri organization ${tenantId} with lender ${lenderId}.`);
  }

  if (!user || user.organizationId !== tenantId || user.email !== "testadmin@test.com") {
    throw new Error(`Expected testadmin@test.com (${userId}) in the Norri organization.`);
  }
};

const seedLoansAndDefinition = async () => {
  await prisma.lenderDefinition.upsert({
    where: { tenantId_lenderId: { tenantId, lenderId } },
    create: {
      tenantId,
      lenderId,
      overdueDaysThreshold: 30,
      highRiskScoreThreshold: 75,
    },
    update: {
      overdueDaysThreshold: 30,
      highRiskScoreThreshold: 75,
    },
  });

  for (const loan of loans) {
    await prisma.loan.upsert({
      where: { id: loan.id },
      create: { tenantId, ...loan },
      update: { tenantId, ...loan },
    });
  }
};

const seedDocuments = async () => {
  const embeddingProvider = getEmbeddingProvider();

  for (const document of documents) {
    const chunks = chunkText(document.content);
    const embeddedChunks = await Promise.all(
      chunks.map(async (content) => ({
        content,
        embedding: await embeddingProvider.embed(content),
      })),
    );

    await prisma.$transaction(async (transaction) => {
      await transaction.document.upsert({
        where: { id: document.id },
        create: {
          id: document.id,
          tenantId,
          loanId: document.loanId,
          title: document.title,
          type: document.type,
          summary: document.summary,
          sourceText: document.content,
          sixMonthExtensionAllowed: document.sixMonthExtensionAllowed,
        },
        update: {
          tenantId,
          loanId: document.loanId,
          title: document.title,
          type: document.type,
          summary: document.summary,
          sourceText: document.content,
          sixMonthExtensionAllowed: document.sixMonthExtensionAllowed,
        },
      });

      await transaction.documentChunk.deleteMany({
        where: { documentId: document.id },
      });

      for (const [index, chunk] of embeddedChunks.entries()) {
        await transaction.$executeRawUnsafe(
          `
            insert into document_chunks (id, document_id, content, embedding)
            values ($1, $2, $3, $4::vector)
          `,
          `${document.id}-chunk-${index + 1}`,
          document.id,
          chunk.content,
          toSql(chunk.embedding),
        );
      }
    });
  }
};

const run = async () => {
  try {
    await verifyTenant();
    await seedLoansAndDefinition();
    await seedDocuments();

    console.log(`Seeded ${loans.length} loans and ${documents.length} documents for Norri.`);
    console.log("Login remains testadmin@test.com with its existing password.");
    console.log("Try: Show me all defaulted loans with principal above $50,000.");
    console.log("Try: Of these, how many are in Ontario versus Quebec?");
    console.log("Try: How many loans are overdue?");
    console.log("Try: Does NORRI-LOAN-001 allow a six-month extension?");
    console.log("Try: What happens to the portfolio if property values fall by 10%?");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
};

run().catch((error) => {
  console.error("Failed to seed Norri demo data", error);
  process.exitCode = 1;
});
