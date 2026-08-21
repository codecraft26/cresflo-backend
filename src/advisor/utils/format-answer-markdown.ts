import type { AdvisorAnswer } from "../types.js";

type DataRow = Record<string, unknown>;

const columnLabels: Record<string, string> = {
  borrowerName: "Borrower",
  daysPastDue: "Days past due",
  extensionEligible: "Extension eligible",
  id: "Loan ID",
  principalOutstanding: "Principal outstanding",
  province: "Province",
  propertyValue: "Property value",
  riskScore: "Risk score",
  status: "Status",
  interestCollectedLastQuarter: "Interest (last quarter)",
  interestCollectedPreviousQuarter: "Interest (previous quarter)",
};

const preferredLoanColumns = [
  "id",
  "borrowerName",
  "province",
  "principalOutstanding",
  "status",
  "riskScore",
  "daysPastDue",
  "propertyValue",
  "extensionEligible",
  "interestCollectedLastQuarter",
  "interestCollectedPreviousQuarter",
];

const escapeMarkdownCell = (value: string) =>
  value.replaceAll("|", "\\|").replaceAll(/\r?\n/g, " ").trim();

const formatValue = (key: string, value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (
    [
      "principalOutstanding",
      "propertyValue",
      "interestCollectedLastQuarter",
      "interestCollectedPreviousQuarter",
    ].includes(key) &&
    typeof value === "number"
  ) {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return escapeMarkdownCell(String(value));
};

const formatTable = (rows: DataRow[]) => {
  if (rows.length === 0) {
    return "";
  }

  const availableKeys = new Set(rows.flatMap((row) => Object.keys(row)));
  const columns = preferredLoanColumns.filter((column) => availableKeys.has(column));

  if (columns.length === 0) {
    return "";
  }

  const header = `| ${columns.map((column) => columnLabels[column] ?? column).join(" | ")} |`;
  const separator = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map(
    (row) => `| ${columns.map((column) => formatValue(column, row[column])).join(" | ")} |`,
  );

  return [header, separator, ...body].join("\n");
};

const isDataRow = (value: unknown): value is DataRow =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const formatAdvisorAnswerAsMarkdown = (answer: AdvisorAnswer) => {
  const sections = [answer.summary.trim()];
  const loans = Array.isArray(answer.data?.loans)
    ? answer.data.loans.filter(isDataRow)
    : [];
  const loanTable = formatTable(loans);

  if (loanTable) {
    sections.push(`### Loan details\n\n${loanTable}`);
  }

  if (isDataRow(answer.data?.counts)) {
    const countRows = Object.entries(answer.data.counts).map(([province, count]) => ({
      province,
      count,
    }));
    const countTable = [
      "| Province | Loans |",
      "| --- | ---: |",
      ...countRows.map((row) => `| ${escapeMarkdownCell(row.province)} | ${formatValue("count", row.count)} |`),
    ].join("\n");
    sections.push(`### Province breakdown\n\n${countTable}`);
  }

  if (answer.evidence.length > 0) {
    sections.push(
      `### Evidence\n\n${answer.evidence
        .map(
          (item) =>
            `- **${escapeMarkdownCell(item.label)}:** ${escapeMarkdownCell(item.detail)}`,
        )
        .join("\n")}`,
    );
  }

  if (answer.warnings.length > 0) {
    sections.push(
      answer.warnings
        .map((warning) => `> **Note:** ${warning.replaceAll(/\r?\n/g, " ").trim()}`)
        .join("\n\n"),
    );
  }

  return sections.filter(Boolean).join("\n\n");
};

export { formatAdvisorAnswerAsMarkdown };
