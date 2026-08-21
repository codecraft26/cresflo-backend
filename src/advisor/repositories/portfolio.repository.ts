import { Prisma } from "@prisma/client";

import { prisma } from "../../infrastructure/prisma.js";
import type {
  AdvisorRequestContext,
  LenderDefinition,
  LoanRecord,
  QueryConstraint,
} from "../types.js";

const mapLoan = (row: {
  id: string;
  tenantId: string;
  borrowerName: string;
  province: string;
  principalOutstanding: Prisma.Decimal;
  status: string;
  riskScore: number;
  daysPastDue: number;
  interestCollectedLastQuarter: Prisma.Decimal;
  interestCollectedPreviousQuarter: Prisma.Decimal;
  propertyValue: Prisma.Decimal;
  extensionEligible: boolean;
}): LoanRecord => ({
  id: row.id,
  tenantId: row.tenantId,
  borrowerName: row.borrowerName,
  province: row.province as LoanRecord["province"],
  principalOutstanding: Number(row.principalOutstanding),
  status: row.status as LoanRecord["status"],
  riskScore: row.riskScore,
  daysPastDue: row.daysPastDue,
  interestCollectedLastQuarter: Number(row.interestCollectedLastQuarter),
  interestCollectedPreviousQuarter: Number(row.interestCollectedPreviousQuarter),
  propertyValue: Number(row.propertyValue),
  extensionEligible: row.extensionEligible,
});

class PortfolioRepository {
  async searchLoans(context: AdvisorRequestContext, filters: QueryConstraint[]) {
    const where: Prisma.LoanWhereInput = {
      tenantId: context.tenantId,
    };

    for (const filter of filters) {
      switch (filter.field) {
        case "status":
          where.status = filter.value as string;
          break;
        case "principalOutstanding":
          where.principalOutstanding = {
            gt: new Prisma.Decimal(filter.value as number),
          };
          break;
        case "province":
          where.province = {
            in: filter.value as string[],
          };
          break;
      }
    }

    const result = await prisma.loan.findMany({
      where,
      orderBy: [{ principalOutstanding: "desc" }, { borrowerName: "asc" }],
    });

    return result.map(mapLoan);
  }

  async findLoansByIds(context: AdvisorRequestContext, loanIds: string[]) {
    if (loanIds.length === 0) {
      return [];
    }

    const result = await prisma.loan.findMany({
      where: {
        tenantId: context.tenantId,
        id: {
          in: loanIds,
        },
      },
    });

    return result.map(mapLoan);
  }

  async getLenderDefinition(context: AdvisorRequestContext): Promise<LenderDefinition | null> {
    const row = await prisma.lenderDefinition.findUnique({
      where: {
        tenantId_lenderId: {
          tenantId: context.tenantId,
          lenderId: context.lenderId,
        },
      },
    });

    return row
      ? {
          overdueDaysThreshold: row.overdueDaysThreshold,
          highRiskScoreThreshold: row.highRiskScoreThreshold,
        }
      : null;
  }
}

export { PortfolioRepository };
