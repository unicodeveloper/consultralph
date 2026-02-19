import { Valyu, type SearchResult } from "valyu-js";

// ---------------------------------------------------------------------------
// Valyu financial dataset identifiers
// ---------------------------------------------------------------------------

const SEC_FILINGS = "valyu/valyu-sec-filings";
const INCOME_STATEMENT = "valyu/valyu-income-statement-US";
const BALANCE_SHEET = "valyu/valyu-balance-sheet-US";
const CASH_FLOW = "valyu/valyu-cash-flow-US";
const EARNINGS = "valyu/valyu-earnings-US";
const INSIDER_TRANSACTIONS = "valyu/valyu-insider-transactions-US";
const STATISTICS = "valyu/valyu-statistics-US";
const STOCKS = "valyu/valyu-stocks";
const MARKET_MOVERS = "valyu/valyu-market-movers-US";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MnADataCategory =
  | "sec_filings"
  | "financial_statements"
  | "insider_activity"
  | "patents"
  | "market_intelligence";

export const ALL_MNA_CATEGORIES: MnADataCategory[] = [
  "sec_filings",
  "financial_statements",
  "insider_activity",
  "patents",
  "market_intelligence",
];

export interface CategorySearchResult {
  category: MnADataCategory;
  label: string;
  success: boolean;
  results: SearchResult[];
  totalCharacters: number;
  error?: string;
}

export interface FinancialContext {
  results: CategorySearchResult[];
  totalCharacters: number;
  categoriesSearched: number;
  categoriesSucceeded: number;
}

// ---------------------------------------------------------------------------
// Category search configuration
// ---------------------------------------------------------------------------

interface CategoryConfig {
  label: string;
  datasets: string[];
  searchType: "proprietary" | "all";
  buildQuery: (companyName: string) => string;
}

const MNA_DATA_CATEGORIES: Record<MnADataCategory, CategoryConfig> = {
  sec_filings: {
    label: "SEC Filings (10-K, 10-Q, 8-K)",
    datasets: [SEC_FILINGS],
    searchType: "proprietary",
    buildQuery: (company: string) =>
      `${company} SEC filings 10-K 10-Q 8-K risk factors MD&A business description financial statements`,
  },
  financial_statements: {
    label: "Financial Statements & Ratios",
    datasets: [INCOME_STATEMENT, BALANCE_SHEET, CASH_FLOW, EARNINGS, STATISTICS],
    searchType: "proprietary",
    buildQuery: (company: string) =>
      `${company} revenue EBITDA net income earnings balance sheet debt equity cash flow margins financial ratios`,
  },
  insider_activity: {
    label: "Insider Activity & Market Signals",
    datasets: [INSIDER_TRANSACTIONS, STOCKS, MARKET_MOVERS],
    searchType: "proprietary",
    buildQuery: (company: string) =>
      `${company} insider transactions executive trades Form 4 stock performance market cap valuation`,
  },
  patents: {
    label: "Patent & IP Portfolio",
    datasets: [],
    searchType: "proprietary",
    buildQuery: (company: string) =>
      `${company} patents intellectual property IP portfolio technology filings`,
  },
  market_intelligence: {
    label: "Market & Competitive Intelligence",
    datasets: [],
    searchType: "all",
    buildQuery: (company: string) =>
      `${company} competitive landscape market position industry analysis competitors recent news acquisitions`,
  },
};

// ---------------------------------------------------------------------------
// Search functions
// ---------------------------------------------------------------------------

/**
 * Execute a single category search against the Valyu Search API.
 * Non-throwing: returns `{ success: false }` on error instead of raising.
 */
export async function searchCategory(
  valyu: Valyu,
  category: MnADataCategory,
  companyName: string
): Promise<CategorySearchResult> {
  const config = MNA_DATA_CATEGORIES[category];
  const query = config.buildQuery(companyName);

  try {
    const response = await valyu.search(query, {
      searchType: config.searchType,
      ...(config.datasets.length > 0 && {
        includedSources: config.datasets,
      }),
      maxNumResults: 10,
      responseLength: "large",
    });

    const results = response.results ?? [];
    const totalCharacters = response.total_characters ?? 0;

    return {
      category,
      label: config.label,
      success: true,
      results,
      totalCharacters,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown search error";
    console.error(`[valyu-search] ${category} search failed:`, message);
    return {
      category,
      label: config.label,
      success: false,
      results: [],
      totalCharacters: 0,
      error: message,
    };
  }
}

/**
 * Fire all M&A category searches in parallel and return aggregated results.
 */
export async function gatherFinancialData(
  valyu: Valyu,
  companyName: string,
  categories: MnADataCategory[] = ALL_MNA_CATEGORIES
): Promise<FinancialContext> {
  const categoryResults = await Promise.all(
    categories.map((cat) => searchCategory(valyu, cat, companyName))
  );

  const totalCharacters = categoryResults.reduce(
    (sum, r) => sum + r.totalCharacters,
    0
  );
  const categoriesSucceeded = categoryResults.filter((r) => r.success).length;

  return {
    results: categoryResults,
    totalCharacters,
    categoriesSearched: categoryResults.length,
    categoriesSucceeded,
  };
}

// ---------------------------------------------------------------------------
// Utility: flatten search results into a single text block for LLM context
// ---------------------------------------------------------------------------

/**
 * Concatenate all successful search results into a single string suitable for
 * injecting into an LLM prompt as financial context.
 */
export function flattenFinancialContext(ctx: FinancialContext): string {
  const sections: string[] = [];

  for (const catResult of ctx.results) {
    if (!catResult.success || catResult.results.length === 0) continue;

    const heading = catResult.label;
    const items = catResult.results.map((r) => {
      const content =
        typeof r.content === "string"
          ? r.content
          : JSON.stringify(r.content);
      const title = r.title ? `[${r.title}]` : "";
      const source = r.source ? ` (${r.source})` : "";
      return `${title}${source}\n${content}`;
    });

    sections.push(`--- ${heading} ---\n${items.join("\n\n")}`);
  }

  return sections.join("\n\n");
}
