# M&A Due Diligence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a new "M&A Due Diligence" research type that uses a multi-phase pipeline — parallel Valyu Search API pulls for financial data (Phase 1) fed into enriched DeepResearch (Phase 2) — producing investment committee-ready DD reports.

**Architecture:** Phase 1 fires parallel `valyu.search()` calls against financial datasets (SEC filings, balance sheets, insider trades, patents, market data). Results are structured into a `FinancialContext` object, then embedded into a DeepResearch prompt with source configuration and the new "max" mode support. The frontend adds an "M&A Due Diligence" research type with guided checkboxes for data categories, all 4 depth modes, two-stage progress, and a financial data panel in results.

**Tech Stack:** Next.js 15 (App Router), TypeScript, valyu-js SDK (search + deepresearch), Zustand, Tailwind CSS, Lucide icons.

**Design doc:** `docs/plans/2026-02-19-mna-due-diligence-design.md`

**Important SDK note:** `valyu-js@2.5.2`'s `DeepResearchMode` type is `"fast" | "standard" | "lite" | "heavy"` — no "max". The Valyu API supports "max" mode, but we'll need to cast the mode or use the raw API. The SDK's `search()` method fully supports `includedSources`, `searchType`, `responseLength`.

---

### Task 1: Create Valyu Search API Wrapper (`app/lib/valyu-search.ts`)

This is the foundation. No other file depends on it yet, so it can be built and verified independently.

**Files:**
- Create: `app/lib/valyu-search.ts`

**Step 1: Create the dataset constants and search wrapper**

```typescript
// app/lib/valyu-search.ts
import { Valyu } from "valyu-js";
import type { SearchResponse } from "valyu-js";

// Valyu financial dataset identifiers
export const VALYU_DATASETS = {
  SEC_FILINGS: "valyu/valyu-sec-filings",
  INCOME_STATEMENT: "valyu/valyu-income-statement-US",
  BALANCE_SHEET: "valyu/valyu-balance-sheet-US",
  CASH_FLOW: "valyu/valyu-cash-flow-US",
  EARNINGS: "valyu/valyu-earnings-US",
  STATISTICS: "valyu/valyu-statistics-US",
  INSIDER_TRANSACTIONS: "valyu/valyu-insider-transactions-US",
  STOCKS: "valyu/valyu-stocks",
  MARKET_MOVERS: "valyu/valyu-market-movers-US",
  DIVIDENDS: "valyu/valyu-dividends-US",
} as const;

// M&A data category definitions — maps checkbox IDs to search configurations
export const MNA_DATA_CATEGORIES = {
  sec_filings: {
    label: "SEC Filings (10-K, 10-Q, 8-K)",
    datasets: [VALYU_DATASETS.SEC_FILINGS],
    queryTemplate: (company: string) =>
      `${company} 10-K 10-Q 8-K annual report risk factors MD&A business description financial statements`,
  },
  financial_statements: {
    label: "Financial Statements & Ratios",
    datasets: [
      VALYU_DATASETS.INCOME_STATEMENT,
      VALYU_DATASETS.BALANCE_SHEET,
      VALYU_DATASETS.CASH_FLOW,
      VALYU_DATASETS.EARNINGS,
      VALYU_DATASETS.STATISTICS,
    ],
    queryTemplate: (company: string) =>
      `${company} revenue EBITDA net income earnings balance sheet debt equity cash flow margins financial ratios`,
  },
  insider_activity: {
    label: "Insider Activity & Market Signals",
    datasets: [
      VALYU_DATASETS.INSIDER_TRANSACTIONS,
      VALYU_DATASETS.STOCKS,
      VALYU_DATASETS.MARKET_MOVERS,
    ],
    queryTemplate: (company: string) =>
      `${company} insider transactions executive trades Form 4 stock performance market cap valuation`,
  },
  patents: {
    label: "Patent & IP Portfolio",
    datasets: [], // Uses search_type: "proprietary" with patent category
    queryTemplate: (company: string) =>
      `${company} patents intellectual property portfolio filed granted technology`,
  },
  market_intelligence: {
    label: "Market & Competitive Intelligence",
    datasets: [], // Uses search_type: "all" for broad web + proprietary
    queryTemplate: (company: string) =>
      `${company} competitive landscape market position competitors industry analysis recent news acquisitions partnerships`,
  },
} as const;

export type MnADataCategory = keyof typeof MNA_DATA_CATEGORIES;

export const ALL_MNA_CATEGORIES: MnADataCategory[] = Object.keys(
  MNA_DATA_CATEGORIES
) as MnADataCategory[];

export interface CategorySearchResult {
  category: MnADataCategory;
  label: string;
  success: boolean;
  resultCount: number;
  totalCharacters: number;
  content: string; // Concatenated search result content
  error?: string;
}

export interface FinancialContext {
  targetCompany: string;
  timestamp: string;
  categories: CategorySearchResult[];
  totalCharacters: number;
}

/**
 * Execute a single category search against Valyu Search API.
 * Non-throwing — returns a CategorySearchResult with success: false on error.
 */
async function searchCategory(
  valyu: Valyu,
  company: string,
  categoryId: MnADataCategory
): Promise<CategorySearchResult> {
  const category = MNA_DATA_CATEGORIES[categoryId];

  try {
    const query = category.queryTemplate(company);
    const datasets = category.datasets;

    let response: SearchResponse;

    if (datasets.length > 0) {
      // Targeted dataset search
      response = await valyu.search(query, {
        searchType: "proprietary",
        includedSources: [...datasets],
        responseLength: "large",
        maxNumResults: 10,
      });
    } else if (categoryId === "patents") {
      // Patent search — use proprietary search type
      response = await valyu.search(query, {
        searchType: "proprietary",
        responseLength: "large",
        maxNumResults: 10,
      });
    } else {
      // Broad search (market intelligence)
      response = await valyu.search(query, {
        searchType: "all",
        responseLength: "large",
        maxNumResults: 10,
      });
    }

    // Concatenate results into readable content
    const content = response.results
      .map((r, i) => {
        const source = r.source || r.url;
        const text =
          typeof r.content === "string"
            ? r.content
            : JSON.stringify(r.content, null, 2);
        return `### Source ${i + 1}: ${r.title}\n**Source:** ${source}\n${r.date ? `**Date:** ${r.date}\n` : ""}\n${text}`;
      })
      .join("\n\n---\n\n");

    return {
      category: categoryId,
      label: category.label,
      success: true,
      resultCount: response.results.length,
      totalCharacters: response.total_characters || content.length,
      content: content || "No results found for this category.",
    };
  } catch (error) {
    console.error(`[M&A Search] Error for category ${categoryId}:`, error);
    return {
      category: categoryId,
      label: category.label,
      success: false,
      resultCount: 0,
      totalCharacters: 0,
      content: "",
      error: error instanceof Error ? error.message : "Search failed",
    };
  }
}

/**
 * Phase 1: Gather financial data for M&A due diligence.
 * Fires parallel Search API calls for each selected data category.
 * Non-blocking — individual category failures don't stop the pipeline.
 */
export async function gatherFinancialData(
  targetCompany: string,
  dataCategories: MnADataCategory[],
  apiKey: string
): Promise<FinancialContext> {
  const valyu = new Valyu(apiKey);

  // Fire all searches in parallel
  const results = await Promise.all(
    dataCategories.map((cat) => searchCategory(valyu, targetCompany, cat))
  );

  const totalChars = results.reduce((sum, r) => sum + r.totalCharacters, 0);

  return {
    targetCompany,
    timestamp: new Date().toISOString(),
    categories: results,
    totalCharacters: totalChars,
  };
}
```

**Step 2: Verify the file compiles**

Run: `cd /c/Users/Mohi/Projects/consultr && npx tsc --noEmit app/lib/valyu-search.ts 2>&1 | head -20`

If there are import issues with the `SearchResponse` type, adjust to use the full import from the SDK index.

**Step 3: Commit**

```bash
git add app/lib/valyu-search.ts
git commit -m "Add Valyu Search API wrapper with M&A dataset constants"
```

---

### Task 2: Create M&A Pipeline Module (`app/lib/mna-pipeline.ts`)

This module builds the enriched DeepResearch query from Phase 1 data. It also exports the M&A deliverable definitions.

**Files:**
- Create: `app/lib/mna-pipeline.ts`
- Reference: `app/lib/valyu-search.ts` (from Task 1)

**Step 1: Create the pipeline module**

```typescript
// app/lib/mna-pipeline.ts
import type { FinancialContext, MnADataCategory } from "./valyu-search";

/**
 * Build the M&A Due Diligence query for DeepResearch Phase 2.
 * Embeds Phase 1 financial data as context sections.
 */
export function buildMnAQuery(
  targetCompany: string,
  financialContext: FinancialContext,
  dealContext?: string,
  researchFocus?: string,
  specificQuestions?: string
): string {
  // Build the financial data context sections
  const dataContextSections = financialContext.categories
    .filter((cat) => cat.success && cat.resultCount > 0)
    .map(
      (cat) =>
        `## PRE-FETCHED DATA: ${cat.label}\n_${cat.resultCount} sources, ${cat.totalCharacters.toLocaleString()} characters_\n\n${cat.content}`
    )
    .join("\n\n---\n\n");

  const failedCategories = financialContext.categories
    .filter((cat) => !cat.success || cat.resultCount === 0)
    .map((cat) => cat.label);

  const failedNote =
    failedCategories.length > 0
      ? `\n\n**NOTE:** The following data categories returned no pre-fetched results. Please search for this information during your research: ${failedCategories.join(", ")}.\n`
      : "";

  let query = `
Conduct comprehensive M&A due diligence research on **${targetCompany}** for an acquisition evaluation.

You have access to pre-fetched financial data below. Use this data as your primary source for financial figures, SEC filing excerpts, and market data. Verify and supplement with your own research.
${failedNote}
---
# PRE-FETCHED FINANCIAL DATA FOR ${targetCompany.toUpperCase()}
${dataContextSections || "No pre-fetched data available. Conduct thorough independent research."}
---

# REQUIRED DUE DILIGENCE REPORT STRUCTURE

Produce a comprehensive due diligence report covering ALL of the following sections:

## 1. Executive Summary & Investment Thesis
- One-page overview of the target
- Preliminary investment thesis (buy/pass/conditional)
- Key value drivers and critical risks
- Deal attractiveness score (1-10) with justification

## 2. Company Overview
- Business model, products/services, and revenue streams
- Corporate structure and subsidiaries
- History, founding, and key milestones
- Headquarters, employee count, and global footprint

## 3. Financial Analysis
- Revenue trends (3-5 year), growth rates, and segment breakdown
- Profitability: gross margin, EBITDA margin, net income margin
- Balance sheet: total assets, total debt, cash position, debt/equity ratio
- Cash flow: operating, investing, financing cash flows
- Key financial ratios: current ratio, quick ratio, ROE, ROA
- Working capital analysis
- **Present key metrics in a data table format**

## 4. SEC Filing Key Findings
- 10-K highlights: risk factors, MD&A key themes, material commitments
- Recent 8-K material events (last 12 months)
- Quarterly trend analysis from 10-Q filings
- Any restatements, auditor changes, or going concern notes

## 5. IP & Patent Portfolio Assessment
- Patent count, key patent families, and technology areas
- Patent filing trends (increasing/decreasing)
- Key patent expiration dates
- IP competitive moat assessment
- Any ongoing patent litigation

## 6. Insider Activity & Market Sentiment
- Recent insider transactions (Form 4): buys vs. sells, notable amounts
- Institutional ownership changes
- Stock price performance (1Y, 3Y) and key technical levels
- Analyst consensus and price targets
- Short interest data

## 7. Competitive Positioning
- Top 3-5 direct competitors with market share estimates
- Competitive advantages and moats
- Areas of competitive vulnerability
- Market positioning relative to peers

## 8. Risk Matrix
Create a structured risk assessment with severity (High/Medium/Low) and likelihood:
- **Financial risks**: leverage, liquidity, revenue concentration
- **Operational risks**: key person dependency, supply chain, technology
- **Regulatory risks**: pending legislation, compliance issues, investigations
- **Legal risks**: active litigation, IP disputes, environmental liability
- **Market risks**: cyclicality, disruption threats, customer concentration

## 9. Valuation Context
- Current market cap and enterprise value
- Key valuation multiples: EV/Revenue, EV/EBITDA, P/E
- Peer comparison of valuation multiples
- Historical valuation range
- Precedent M&A transactions in the sector (if available)

## 10. Go/No-Go Recommendation Framework
- Strengths supporting acquisition
- Weaknesses and concerns
- Key due diligence items requiring further investigation
- Preliminary recommendation with conditions
- Suggested deal structure considerations
`;

  if (dealContext) {
    query += `\n\n**DEAL CONTEXT:**\n${dealContext}\n\nTailor the analysis and recommendations to this specific deal context.\n`;
  }

  if (researchFocus) {
    query += `\n\n**SPECIFIC FOCUS AREAS:**\n${researchFocus}\n\nEnsure these areas receive detailed attention.\n`;
  }

  if (specificQuestions) {
    query += `\n\n**SPECIFIC QUESTIONS TO ADDRESS:**\n${specificQuestions}\n\nDirectly answer these questions in the report.\n`;
  }

  query += `
**FORMATTING REQUIREMENTS:**
- Use clear headings and subheadings matching the structure above
- Present financial data in tables wherever possible
- Cite sources for all statistics and claims (include [Source: ...] inline)
- Flag any data points that could not be verified
- Maintain investment banking / consulting report quality
- Use professional, concise language appropriate for an investment committee
`;

  return query;
}

/**
 * Build M&A-specific deliverables for DeepResearch.
 */
export function buildMnADeliverables(targetCompany: string) {
  const subjectClean = targetCompany.replace(/[^a-zA-Z0-9\s]/g, "").trim();

  return [
    {
      type: "xlsx" as const,
      description: `${subjectClean} - Financial Analysis Matrix with revenue, EBITDA, margins, debt ratios, valuation multiples, and peer comparison data`,
    },
    {
      type: "docx" as const,
      description: `${subjectClean} - Investment Committee Deal Memo with executive summary, investment thesis, key risks, financial highlights, and go/no-go recommendation`,
    },
    {
      type: "pptx" as const,
      description: `${subjectClean} - Executive Due Diligence Presentation with company overview, financial analysis, competitive positioning, risk matrix, and deal recommendation`,
    },
  ];
}

/**
 * Build the DeepResearch search configuration for M&A.
 * Tells DeepResearch's agent to prioritize financial and proprietary sources.
 */
export function buildMnASearchConfig(categories: MnADataCategory[]) {
  const includedSources: string[] = ["web"];

  if (
    categories.includes("sec_filings") ||
    categories.includes("financial_statements") ||
    categories.includes("insider_activity")
  ) {
    includedSources.push("finance");
  }

  if (categories.includes("patents")) {
    includedSources.push("patent");
  }

  // Always include academic for research papers and industry reports
  includedSources.push("academic");

  return {
    searchType: "all" as const,
    includedSources,
  };
}
```

**Step 2: Verify compilation**

Run: `cd /c/Users/Mohi/Projects/consultr && npx tsc --noEmit 2>&1 | head -30`

**Step 3: Commit**

```bash
git add app/lib/mna-pipeline.ts
git commit -m "Add M&A pipeline module with DD query builder and deliverables"
```

---

### Task 3: Update Backend API Route — Add "max" Mode and M&A Pipeline

**Files:**
- Modify: `app/api/consulting-research/route.ts`
- Reference: `app/lib/valyu-search.ts`, `app/lib/mna-pipeline.ts`

**Step 1: Update the ResearchMode type and normalizer to support "max"**

In `app/api/consulting-research/route.ts`, change line 16:

```typescript
// Old:
type ResearchMode = "fast" | "standard" | "heavy";

// New:
type ResearchMode = "fast" | "standard" | "heavy" | "max";
```

Update `normalizeResearchMode` (line 202):

```typescript
// Old:
function normalizeResearchMode(mode: unknown): ResearchMode {
  if (mode === "fast" || mode === "standard" || mode === "heavy") {
    return mode;
  }
  return "fast";
}

// New:
function normalizeResearchMode(mode: unknown): ResearchMode {
  if (mode === "fast" || mode === "standard" || mode === "heavy" || mode === "max") {
    return mode;
  }
  return "fast";
}
```

**Step 2: Add imports and M&A-specific creation functions**

Add at the top of the file (after existing imports):

```typescript
import {
  gatherFinancialData,
  type MnADataCategory,
  ALL_MNA_CATEGORIES,
} from "@/app/lib/valyu-search";
import {
  buildMnAQuery,
  buildMnADeliverables,
  buildMnASearchConfig,
} from "@/app/lib/mna-pipeline";
```

**Step 3: Add M&A research creation function (self-hosted mode)**

Add after the existing `createResearchWithApiKey` function (after line 110):

```typescript
/**
 * Create M&A due diligence research using the multi-phase pipeline.
 * Phase 1: Parallel Search API calls for financial data.
 * Phase 2: Enriched DeepResearch with financial context.
 */
async function createMnAResearchWithApiKey(
  targetCompany: string,
  mode: ResearchMode,
  dataCategories: MnADataCategory[],
  dealContext?: string,
  researchFocus?: string,
  specificQuestions?: string
) {
  const apiKey = getValyuApiKey();

  // Phase 1: Gather financial data via parallel Search API calls
  console.log("[M&A Phase 1] Gathering financial data for:", targetCompany);
  const financialContext = await gatherFinancialData(
    targetCompany,
    dataCategories,
    apiKey
  );

  const successCount = financialContext.categories.filter((c) => c.success).length;
  console.log(
    `[M&A Phase 1] Complete: ${successCount}/${dataCategories.length} categories, ${financialContext.totalCharacters.toLocaleString()} chars`
  );

  // Phase 2: Build enriched DeepResearch query
  const query = buildMnAQuery(
    targetCompany,
    financialContext,
    dealContext,
    researchFocus,
    specificQuestions
  );
  const deliverables = buildMnADeliverables(targetCompany);
  const searchConfig = buildMnASearchConfig(dataCategories);

  console.log("[M&A Phase 2] Creating DeepResearch task, mode:", mode);

  const valyu = new Valyu(apiKey);

  // Note: "max" mode may not be in the SDK type yet, cast as needed
  return valyu.deepresearch.create({
    query,
    deliverables,
    mode: mode as "fast" | "standard" | "heavy",
    outputFormats: ["markdown", "pdf"],
    search: searchConfig,
  });
}

/**
 * Create M&A research via OAuth proxy (Valyu mode — user's credits).
 */
async function createMnAResearchWithOAuth(
  accessToken: string,
  targetCompany: string,
  mode: ResearchMode,
  dataCategories: MnADataCategory[],
  dealContext?: string,
  researchFocus?: string,
  specificQuestions?: string
) {
  // Phase 1: Use server API key for search (search costs are minimal)
  const apiKey = process.env.VALYU_API_KEY;
  let financialContext;

  if (apiKey) {
    console.log("[M&A Phase 1 OAuth] Gathering financial data for:", targetCompany);
    financialContext = await gatherFinancialData(
      targetCompany,
      dataCategories,
      apiKey
    );
  } else {
    // No server key — skip Phase 1, let DeepResearch do everything
    console.log("[M&A Phase 1 OAuth] No server API key, skipping Phase 1");
    financialContext = {
      targetCompany,
      timestamp: new Date().toISOString(),
      categories: [],
      totalCharacters: 0,
    };
  }

  // Phase 2: Build enriched query and send via OAuth proxy
  const query = buildMnAQuery(
    targetCompany,
    financialContext,
    dealContext,
    researchFocus,
    specificQuestions
  );
  const deliverables = buildMnADeliverables(targetCompany);
  const searchConfig = buildMnASearchConfig(dataCategories);

  const proxyUrl = `${VALYU_APP_URL}/api/oauth/proxy`;
  const requestBody = {
    path: "/v1/deepresearch/tasks",
    method: "POST",
    body: {
      query,
      deliverables,
      mode,
      output_formats: ["markdown", "pdf"],
      search: {
        search_type: searchConfig.searchType,
        included_sources: searchConfig.includedSources,
      },
    },
  };

  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }
    if (response.status === 402) {
      throw new Error("Insufficient credits. Please top up your Valyu account.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Session expired. Please sign in again. (${response.status}: ${errorData.message || errorData.error || "Unknown error"})`
      );
    }
    throw new Error(errorData.message || errorData.error || "Failed to create research");
  }

  return response.json();
}
```

**Step 4: Update the POST handler to route M&A requests**

Replace the body of the `POST` function (lines 112-199). The key change is adding the `dataCategories` and `dealContext` params, and routing `researchType === "mna"` to the new pipeline:

In the request body destructuring, add `dataCategories` and `dealContext`:

```typescript
const {
  researchType,
  researchSubject,
  researchFocus,
  clientContext,
  specificQuestions,
  researchMode,
  dataCategories,  // NEW: string[] of MnADataCategory IDs
  dealContext,      // NEW: M&A deal context string
} = await request.json();
```

Then, before the existing routing logic (around line 160), add the M&A branch:

```typescript
let response;

if (researchType === "mna") {
  // M&A Due Diligence — multi-phase pipeline
  const categories: MnADataCategory[] =
    dataCategories && Array.isArray(dataCategories) && dataCategories.length > 0
      ? dataCategories
      : ALL_MNA_CATEGORIES;

  if (!selfHosted && accessToken) {
    response = await createMnAResearchWithOAuth(
      accessToken,
      researchSubject,
      mode,
      categories,
      dealContext || clientContext,
      researchFocus,
      specificQuestions
    );
  } else {
    response = await createMnAResearchWithApiKey(
      researchSubject,
      mode,
      categories,
      dealContext || clientContext,
      researchFocus,
      specificQuestions
    );
  }
} else if (!selfHosted && accessToken) {
  // Existing Valyu mode path
  response = await createResearchWithOAuth(accessToken, query, deliverables, mode);
} else {
  // Existing self-hosted path
  response = await createResearchWithApiKey(query, deliverables, mode);
}
```

Note: The M&A branch builds its own query and deliverables internally, so move the `query`/`deliverables` construction inside the else branches or guard it with `if (researchType !== "mna")`.

**Step 5: Verify compilation**

Run: `cd /c/Users/Mohi/Projects/consultr && npx tsc --noEmit 2>&1 | head -30`

**Step 6: Verify dev server starts**

Run: `cd /c/Users/Mohi/Projects/consultr && npm run dev` — ensure no build errors on the API route.

**Step 7: Commit**

```bash
git add app/api/consulting-research/route.ts
git commit -m "Add M&A multi-phase pipeline and max mode to research API"
```

---

### Task 4: Update Frontend Form — Add M&A Due Diligence Type

**Files:**
- Modify: `app/components/ConsultingResearchForm.tsx`
- Reference: `app/lib/valyu-search.ts` (for category IDs/labels — but use string literals in frontend to avoid importing server code)

**Step 1: Add "mna" to the ResearchType union and research types array**

At line 23, add `"mna"` to the union:

```typescript
type ResearchType =
  | "mna"
  | "company"
  | "market"
  | "competitive"
  | "industry"
  | "custom";
```

Add `"max"` to ResearchMode at line 30:

```typescript
type ResearchMode = "fast" | "standard" | "heavy" | "max";
```

**Step 2: Add the M&A research type card at the start of the array**

Import the `Scale` icon from lucide-react (add to the import at line 5):

```typescript
import {
  Search,
  Building2,
  TrendingUp,
  Users,
  FileText,
  Scale,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
```

Add as the FIRST item in `researchTypes` array (before "company"):

```typescript
{
  id: "mna" as ResearchType,
  label: "M&A Due Diligence",
  icon: Scale,
  placeholder: "e.g., Nvidia, UnitedHealth Group, Stripe",
  description: "Deep financial due diligence with SEC filings, financials, patents & insider data",
},
```

**Step 3: Add quick examples for M&A**

In the `quickExamples` object, add:

```typescript
mna: ["Nvidia", "UnitedHealth Group", "Stripe", "SpaceX"],
```

**Step 4: Update researchModeDurations to include "max"**

```typescript
const researchModeDurations: Record<ResearchMode, string> = {
  fast: "5-10 minutes",
  standard: "10-20 minutes",
  heavy: "up to 90 minutes",
  max: "up to 180 minutes",
};
```

**Step 5: Add M&A-specific state variables**

After the existing state declarations (around line 94), add:

```typescript
const [dataCategories, setDataCategories] = useState<string[]>([
  "sec_filings",
  "financial_statements",
  "insider_activity",
  "patents",
  "market_intelligence",
]);
const [dealContext, setDealContext] = useState("");
```

**Step 6: Add the M&A data categories checkbox UI**

After the Research Focus textarea section (after line 306), add a conditional block that only shows when `researchType === "mna"`:

```tsx
{/* M&A Data Categories */}
{researchType === "mna" && (
  <div>
    <label className="block text-sm sm:text-base font-medium mb-3">
      Data Sources
    </label>
    <div className="space-y-2">
      {[
        { id: "sec_filings", label: "SEC Filings (10-K, 10-Q, 8-K)" },
        { id: "financial_statements", label: "Financial Statements & Ratios" },
        { id: "insider_activity", label: "Insider Activity & Market Signals" },
        { id: "patents", label: "Patent & IP Portfolio" },
        { id: "market_intelligence", label: "Market & Competitive Intelligence" },
      ].map((cat) => (
        <label
          key={cat.id}
          className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-surface cursor-pointer transition-colors"
        >
          <input
            type="checkbox"
            checked={dataCategories.includes(cat.id)}
            onChange={(e) => {
              if (e.target.checked) {
                setDataCategories((prev) => [...prev, cat.id]);
              } else {
                setDataCategories((prev) => prev.filter((c) => c !== cat.id));
              }
            }}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            disabled={isSubmitting || isResearching}
          />
          <span className="text-sm">{cat.label}</span>
        </label>
      ))}
    </div>
    <p className="text-xs text-text-muted mt-2">
      Select which financial data sources to analyze. All are searched in parallel.
    </p>
  </div>
)}
```

**Step 7: Show Research Depth prominently for M&A (outside Advanced)**

After the data categories section, add the research depth selector that shows when `researchType === "mna"`:

```tsx
{/* M&A Research Depth - shown prominently, not inside Advanced */}
{researchType === "mna" && (
  <div>
    <label className="block text-sm sm:text-base font-medium mb-2">
      Research Depth
    </label>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {([
        { mode: "fast" as ResearchMode, label: "Fast", duration: "~5 min", cost: "$0.10" },
        { mode: "standard" as ResearchMode, label: "Standard", duration: "10-20 min", cost: "$0.50" },
        { mode: "heavy" as ResearchMode, label: "Heavy", duration: "~90 min", cost: "$2.50" },
        { mode: "max" as ResearchMode, label: "Max", duration: "~180 min", cost: "$15" },
      ]).map((option) => (
        <button
          key={option.mode}
          type="button"
          onClick={() => setResearchMode(option.mode)}
          className={`p-3 rounded-lg border text-left transition-all ${
            researchMode === option.mode
              ? "border-primary bg-primary/5 text-primary"
              : "border-border hover:border-primary/50 hover:bg-surface"
          } ${option.mode === "max" ? "ring-1 ring-primary/30" : ""}`}
          disabled={isSubmitting || isResearching}
        >
          <span className="text-sm font-medium block">{option.label}</span>
          <span className="text-xs text-text-muted block">{option.duration}</span>
          <span className="text-xs text-text-muted block">{option.cost}</span>
        </button>
      ))}
    </div>
    {researchMode === "max" && (
      <p className="text-xs text-primary mt-2">
        Exhaustive due diligence — 25 research steps with Claude Sonnet 4.5. Best for deal-critical analysis.
      </p>
    )}
  </div>
)}
```

**Step 8: Add Deal Context textarea for M&A**

After the Research Focus section but before Advanced Options, add:

```tsx
{/* Deal Context - M&A only */}
{researchType === "mna" && (
  <div>
    <label htmlFor="dealContext" className="block text-sm sm:text-base font-medium mb-2">
      Deal Context{" "}
      <span className="text-text-muted font-normal">(Optional)</span>
    </label>
    <textarea
      id="dealContext"
      value={dealContext}
      onChange={(e) => setDealContext(e.target.value)}
      placeholder="e.g., 'Evaluating as acquisition target for $2B+ deal, buyer is a mid-market PE firm focused on enterprise SaaS'"
      className="input-field resize-none h-20 sm:h-24 text-base"
      disabled={isSubmitting || isResearching}
    />
  </div>
)}
```

**Step 9: Update form submission to include M&A fields**

In the `handleSubmit` function, update the request body to include the new fields. In the `JSON.stringify` call (around line 170):

```typescript
body: JSON.stringify({
  researchType,
  researchSubject: researchSubject.trim(),
  researchFocus: researchFocus.trim(),
  clientContext: clientContext.trim(),
  specificQuestions: specificQuestions.trim(),
  researchMode,
  // M&A-specific fields
  ...(researchType === "mna" && {
    dataCategories,
    dealContext: dealContext.trim(),
  }),
}),
```

Also update the form data saved to localStorage (line 141) similarly.

**Step 10: Update the subject label for M&A**

In the label for the subject input (line 253), add the M&A case:

```typescript
{researchType === "mna"
  ? "Target Company"
  : researchType === "company"
  ? "Company Name"
  : researchType === "market"
  ? "Market / Segment"
  : researchType === "competitive"
  ? "Industry / Category"
  : researchType === "industry"
  ? "Industry"
  : "Research Topic"}
```

**Step 11: Update the info text to reflect M&A duration**

The footer text (line 409) says "Takes <strong>{selectedModeDuration}</strong>". This already uses the dynamic value, so it will work for "max" mode once we update `researchModeDurations`.

**Step 12: Verify it renders**

Run: `cd /c/Users/Mohi/Projects/consultr && npm run dev` — navigate to localhost:3000 and verify the M&A Due Diligence card appears, the checkboxes render, and the depth selector shows all 4 modes.

**Step 13: Commit**

```bash
git add app/components/ConsultingResearchForm.tsx
git commit -m "Add M&A Due Diligence research type with guided form"
```

---

### Task 5: Update Polling to Use Adaptive Intervals

**Files:**
- Modify: `app/page.tsx:146-148,176-178`

**Step 1: Add polling interval helper**

After the `setResearchParam` function (after line 49), add:

```typescript
function getPollingInterval(mode?: string): number {
  switch (mode) {
    case "max": return 30000;
    case "heavy": return 15000;
    case "standard": return 10000;
    default: return 5000; // fast
  }
}
```

**Step 2: Track research mode in state**

Add after `currentResearchTitle` state (line 58):

```typescript
const [currentResearchMode, setCurrentResearchMode] = useState<string>("fast");
```

**Step 3: Update `handleTaskCreated` to accept and store mode**

The `handleTaskCreated` callback (line 151) needs the mode. Update the interface:

```typescript
const handleTaskCreated = useCallback(
  (taskId: string, title: string, researchType: string, mode?: string) => {
    clearPolling();
    activeTaskRef.current = taskId;
    setCurrentTaskId(taskId);
    setCurrentResearchTitle(title);
    setCurrentResearchMode(mode || "fast");
    setIsResearching(true);
    // ... rest stays the same

    const pollInterval = getPollingInterval(mode);
    pollStatus(taskId);
    pollIntervalRef.current = setInterval(() => {
      pollStatus(taskId);
    }, pollInterval);
  },
  [clearPolling, pollStatus]
);
```

**Step 4: Update ConsultingResearchForm to pass mode to onTaskCreated**

In `ConsultingResearchForm.tsx`, the `onTaskCreated` call (line 203):

```typescript
// Old:
onTaskCreated(data.deepresearch_id, researchSubject.trim(), researchType);

// New:
onTaskCreated(data.deepresearch_id, researchSubject.trim(), researchType, researchMode);
```

Update the `ConsultingResearchFormProps` interface:

```typescript
interface ConsultingResearchFormProps {
  onTaskCreated: (taskId: string, title: string, researchType: string, mode?: string) => void;
  isResearching: boolean;
}
```

**Step 5: Verify and commit**

Run: `cd /c/Users/Mohi/Projects/consultr && npm run dev` — start a research and verify polling uses correct intervals in the Network tab.

```bash
git add app/page.tsx app/components/ConsultingResearchForm.tsx
git commit -m "Add adaptive polling intervals based on research mode"
```

---

### Task 6: Add Financial Data Panel to Results Display

**Files:**
- Modify: `app/components/ResearchResults.tsx`
- Modify: `app/page.tsx` (pass financial context to results)

**Step 1: Extend the result interface to include Phase 1 data**

In `ResearchResults.tsx`, update the `ResearchResultsProps` result interface to include an optional `financialContext`:

```typescript
interface ResearchResultsProps {
  result: {
    status: string;
    task_id: string;
    output?: string;
    sources?: Array<{ title: string; url: string }>;
    pdf_url?: string;
    deliverables?: Array<{ type: string; title: string; url: string }>;
    progress?: { current_step: number; total_steps: number };
    messages?: Array<{ role: string; content: string | Array<Record<string, unknown>> }>;
    error?: string;
    // M&A-specific
    researchType?: string;
    researchMode?: string;
    financialSummary?: {
      categories: Array<{
        label: string;
        success: boolean;
        resultCount: number;
      }>;
    };
  } | null;
  onCancel: () => void;
  onReset: () => void;
}
```

**Step 2: Add deal summary header and research mode badge**

After the progress bar section (after line 191), add a conditional block for M&A:

```tsx
{/* M&A Deal Summary Header */}
{result.researchType === "mna" && (isInProgress || isComplete) && (
  <div className="flex items-center gap-3 flex-wrap">
    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
      M&A Due Diligence
    </span>
    {result.researchMode && (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
        result.researchMode === "max"
          ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
          : "bg-surface text-text-muted border-border"
      }`}>
        {result.researchMode.charAt(0).toUpperCase() + result.researchMode.slice(1)} Mode
      </span>
    )}
    {result.financialSummary && (
      <span className="text-xs text-text-muted">
        {result.financialSummary.categories.filter((c) => c.success).length} data sources analyzed
      </span>
    )}
  </div>
)}
```

**Step 3: Add Phase 1 data categories status (visible during research)**

After the M&A header, show the Phase 1 data gathering status:

```tsx
{/* M&A Phase 1 Data Status */}
{result.researchType === "mna" && result.financialSummary && (
  <div className="rounded-lg border border-border bg-surface p-4">
    <h4 className="text-sm font-medium mb-2">Financial Data Sources</h4>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {result.financialSummary.categories.map((cat, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          {cat.success ? (
            <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
          ) : (
            <XCircle className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
          )}
          <span className={cat.success ? "text-foreground" : "text-text-muted"}>
            {cat.label}
          </span>
          {cat.success && (
            <span className="text-xs text-text-muted">
              ({cat.resultCount} sources)
            </span>
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

**Step 4: Pass M&A metadata through page.tsx**

In `app/page.tsx`, update `ResearchResult` interface (line 15) to include the new fields:

```typescript
interface ResearchResult {
  status: string;
  task_id: string;
  output?: string;
  sources?: Array<{ title: string; url: string }>;
  pdf_url?: string;
  deliverables?: Array<{ type: string; title: string; url: string }>;
  progress?: { current_step: number; total_steps: number };
  messages?: Array<{ role: string; content: string | Array<Record<string, unknown>> }>;
  error?: string;
  researchType?: string;
  researchMode?: string;
  financialSummary?: {
    categories: Array<{
      label: string;
      success: boolean;
      resultCount: number;
    }>;
  };
}
```

In `handleTaskCreated`, set the research type and mode on the initial result:

```typescript
setResearchResult({
  status: "queued",
  task_id: taskId,
  researchType,
  researchMode: mode,
});
```

**Step 5: Verify and commit**

Run: `cd /c/Users/Mohi/Projects/consultr && npm run dev` — start an M&A research and verify the deal header and data source badges appear.

```bash
git add app/components/ResearchResults.tsx app/page.tsx
git commit -m "Add M&A deal header and financial data panel to results"
```

---

### Task 7: Add Cost Confirmation for Max Mode

**Files:**
- Modify: `app/components/ConsultingResearchForm.tsx`

**Step 1: Add confirmation state and dialog**

Add state for cost confirmation:

```typescript
const [showCostConfirm, setShowCostConfirm] = useState(false);
```

**Step 2: Intercept form submission for max mode**

At the start of `handleSubmit`, after the empty subject check, add:

```typescript
// Cost confirmation for max mode
if (researchMode === "max" && !showCostConfirm) {
  setShowCostConfirm(true);
  return;
}
setShowCostConfirm(false);
```

**Step 3: Add the confirmation dialog UI**

Before the submit button, add:

```tsx
{/* Max Mode Cost Confirmation */}
{showCostConfirm && (
  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-3">
    <p className="text-sm font-medium text-amber-500">
      Max Mode Confirmation
    </p>
    <p className="text-sm text-text-muted">
      Max mode runs exhaustive research for up to 180 minutes. Estimated cost: ~$15 per task (plus Search API data costs). Continue?
    </p>
    <div className="flex gap-2">
      <button
        type="submit"
        className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
      >
        Confirm & Start
      </button>
      <button
        type="button"
        onClick={() => setShowCostConfirm(false)}
        className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-surface-hover transition-colors"
      >
        Cancel
      </button>
    </div>
  </div>
)}
```

**Step 4: Verify and commit**

Run: `cd /c/Users/Mohi/Projects/consultr && npm run dev` — select Max mode and verify the confirmation dialog appears.

```bash
git add app/components/ConsultingResearchForm.tsx
git commit -m "Add cost confirmation dialog for max mode research"
```

---

### Task 8: End-to-End Manual Test

**Files:** None (testing only)

**Step 1: Start the dev server**

Run: `cd /c/Users/Mohi/Projects/consultr && npm run dev`

**Step 2: Test the M&A form**

1. Navigate to `http://localhost:3000`
2. Click "M&A Due Diligence" — verify it's the first card
3. Enter "Nvidia" as the target company
4. Verify all 5 data category checkboxes are checked by default
5. Verify the 4 depth mode cards appear (Fast/Standard/Heavy/Max)
6. Uncheck "Patents" — verify it unchecks
7. Enter deal context text
8. Select "Fast" mode (cheapest for testing)
9. Click "Start Deep Research"
10. Verify the M&A header badges appear in results
11. Verify research starts and polling works

**Step 3: Test max mode confirmation**

1. Select "Max" mode
2. Click submit — verify cost confirmation dialog appears
3. Click "Cancel" — verify dialog dismisses
4. Click submit again, then "Confirm & Start"

**Step 4: Test existing research types still work**

1. Switch to "Company Due Diligence" and run a fast research
2. Verify nothing is broken in the existing flow

**Step 5: Check console for Phase 1 logs**

Open browser DevTools → Network tab. When M&A research starts, check the server logs for:
- `[M&A Phase 1] Gathering financial data for: Nvidia`
- `[M&A Phase 1] Complete: 5/5 categories, XXX chars`
- `[M&A Phase 2] Creating DeepResearch task, mode: fast`

**Step 6: Run lint**

Run: `cd /c/Users/Mohi/Projects/consultr && npm run lint`

Fix any lint errors found.

**Step 7: Final commit**

```bash
git add -A
git commit -m "Fix lint issues from M&A Due Diligence implementation"
```

---

### Task 9: Build Verification

**Files:** None

**Step 1: Run production build**

Run: `cd /c/Users/Mohi/Projects/consultr && npm run build`

Verify no build errors. Fix any TypeScript or import issues.

**Step 2: Start production server and smoke test**

Run: `cd /c/Users/Mohi/Projects/consultr && npm run start`

Navigate to `http://localhost:3000` and verify the M&A form renders and submits.

**Step 3: Final commit if any fixes**

```bash
git add -A
git commit -m "Fix build issues from M&A Due Diligence feature"
```
