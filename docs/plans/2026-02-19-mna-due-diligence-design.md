# M&A Due Diligence Feature Design

**Date:** 2026-02-19
**Status:** Approved

## Overview

Add a new "M&A Due Diligence" research type to ConsultR that leverages the full Valyu API — Search API financial datasets, SEC filings, patent search, insider activity, and the new "max" deep research mode (180 min, 25 steps). The goal is to produce investment committee-ready due diligence reports backed by hard financial data, not just narrative summaries.

## Problem

ConsultR currently uses only the Valyu DeepResearch API as a black box: it sends a text prompt and receives a report. It does not use:

- The Search API for targeted financial data pulls (SEC filings, balance sheets, insider trades, patents)
- Source configuration (`included_sources`, `search_type`, date filters)
- The "max" research mode (180 min, $15, Claude Sonnet 4.5, 25 steps)
- Any of the 30+ financial datasets Valyu exposes

This means due diligence reports lack hard financial numbers and rely entirely on what DeepResearch's agent finds on its own.

## Architecture: Sequential Multi-Phase Pipeline

### Phase 1 — Targeted Financial Data Gathering (~5-15 seconds)

When a user submits an M&A DD request, the backend fires parallel Search API calls for each selected data category:

| Search Call | Valyu Dataset(s) | Query Pattern |
|---|---|---|
| SEC Filings | `valyu/valyu-sec-filings` | "{company} 10-K risk factors MD&A business description" |
| Financial Statements | `valyu/valyu-income-statement-US`, `valyu/valyu-balance-sheet-US`, `valyu/valyu-cash-flow-US`, `valyu/valyu-earnings-US` | "{company} quarterly earnings revenue EBITDA margins debt levels" |
| Insider Activity | `valyu/valyu-insider-transactions-US`, `valyu/valyu-statistics-US` | "{company} insider transactions executive trades Form 4" |
| Patent / IP | Valyu patent dataset | "{company} patents filed recent IP portfolio" |
| Market Intelligence | `valyu/valyu-stocks`, `valyu/valyu-market-movers-US` | "{company} stock performance market cap valuation multiples" |

Each call uses `response_length: "large"` (100k chars). Results are structured into a `FinancialContext` object grouped by category.

### Phase 2 — Enriched Deep Research (5-180 minutes)

The backend constructs a DeepResearch task with:

- **query**: M&A-specific DD prompt embedding Phase 1 data as "AVAILABLE FINANCIAL DATA" sections
- **mode**: User-selected (fast/standard/heavy/max)
- **search config**: `{ search_type: "all", included_sources: ["finance", "academic", "patent", "web"] }`
- **output_formats**: `["markdown", "pdf"]`
- **deliverables**: M&A-specific (deal memo, financial matrix, DD presentation)

## Frontend Design

### New Research Type Card

A new "M&A Due Diligence" card in the research type grid, positioned first. Icon: Scale or Landmark.

### Form Fields

1. **Target Company** (text input, required) — company name or ticker
2. **Deal Context** (textarea, optional) — e.g., "Evaluating as acquisition target for $2B+ deal"
3. **Data Categories** (checkboxes, all checked by default):
   - SEC Filings (10-K, 10-Q, 8-K)
   - Financial Statements & Ratios
   - Insider Activity & Market Signals
   - Patent & IP Portfolio
   - Market & Competitive Intelligence
4. **Research Depth** (prominent selector, not in Advanced):
   - Fast (~5 min) — Quick preliminary check
   - Standard (10-20 min) — Balanced overview
   - Heavy (~90 min) — Thorough analysis
   - Max (~180 min) — Exhaustive due diligence (highlighted as recommended)
5. **Advanced Options** (collapsible):
   - Specific Questions to Answer
   - Research Focus areas

### Quick Examples

`["Nvidia", "UnitedHealth Group", "Stripe", "SpaceX"]`

### Progress UX

Two-stage progress indicator:
- **Stage 1**: "Gathering financial data..." with per-category completion checklist
- **Stage 2**: "Running deep analysis..." with existing step counter

## Backend Design

### Route Changes (`/api/consulting-research/route.ts`)

1. Add `"max"` to `ResearchMode` type: `"fast" | "standard" | "heavy" | "max"`
2. New `researchType: "mna"` case triggers multi-phase pipeline
3. New `dataCategories` parameter from form checkboxes
4. Updated `normalizeResearchMode()` to accept "max"

### New Function: `gatherFinancialData()`

```typescript
async function gatherFinancialData(
  targetCompany: string,
  dataCategories: string[],
  apiKey: string
): Promise<FinancialContext>
```

- Creates Valyu client
- Fires parallel `valyu.search()` calls per selected category
- Each targets specific `included_sources` datasets
- Returns structured data grouped by category

### New Function: `buildMnAQuery()`

Constructs an M&A-specific prompt with sections:
1. Executive Summary & Investment Thesis
2. Financial Analysis (embedding Phase 1 data)
3. SEC Filing Key Findings (risk factors, MD&A)
4. IP & Patent Portfolio Assessment
5. Insider Activity & Market Sentiment
6. Competitive Positioning
7. Risk Matrix (regulatory, operational, financial, legal)
8. Valuation Context
9. Go/No-Go Recommendation Framework

### M&A Deliverables

| Type | Description |
|---|---|
| CSV/XLSX | Financial comparison matrix (revenue, EBITDA, margins, debt, multiples) |
| DOCX | Investment Committee Deal Memo |
| PPTX | Executive Due Diligence Presentation |
| PDF | Full DD Report (from DeepResearch) |

### Search Configuration Passed to DeepResearch

```typescript
{
  search_type: "all",
  included_sources: ["finance", "academic", "patent", "web"],
  start_date: "<dynamic based on context>"
}
```

## Results Display

### Financial Data Panel (new)

Collapsible section above the narrative report showing Phase 1 structured data:
- Financial highlights table: Revenue, EBITDA, Net Income, Debt/Equity, key ratios
- Appears quickly from Phase 1 data while DeepResearch still runs

### Deal Summary Header (new)

- Target company name + ticker + sector
- Key metrics at a glance
- Research depth badge
- Data categories analyzed

### Narrative Report (enhanced)

Existing markdown report, now with richer content from Phase 1 context.

### Deliverable Downloads (M&A-specific)

PDF, PPTX, DOCX, XLSX with M&A-specific content as described above.

## Error Handling

### Phase 1 failures are non-blocking

If a Search API call fails (company not in SEC, no patents found):
- Category marked as "No data found" in progress UI
- Phase 2 proceeds — DeepResearch searches on its own
- Prompt notes which categories had pre-fetched data

### Private company handling

- Auto-detect if SEC search returns 0 results
- Adapt DeepResearch prompt to focus on available data
- Show note: "Limited public financial data available"

### Cost confirmation

Max mode ($15/task) triggers confirmation dialog before proceeding.

### Adaptive polling intervals

| Mode | Poll Interval |
|---|---|
| Fast | 5s |
| Standard | 10s |
| Heavy | 15s |
| Max | 30s |

## Files to Create/Modify

### Modified files:
- `app/api/consulting-research/route.ts` — Phase 1 pipeline, "max" mode, M&A query builder, search config
- `app/components/ConsultingResearchForm.tsx` — New M&A type, checkboxes, 4 depth modes, guided form
- `app/components/ResearchResults.tsx` — Financial data panel, deal header
- `app/components/ResearchActivityFeed.tsx` — Two-stage progress indicator

### New files:
- `app/lib/mna-pipeline.ts` — `gatherFinancialData()`, `buildMnAQuery()`, `FinancialContext` type
- `app/lib/valyu-search.ts` — Search API wrapper with dataset constants and query builders

## Valyu API Capabilities Used

| Capability | How Used |
|---|---|
| Search API (`/v1/search`) | Phase 1 targeted data pulls |
| `included_sources` | Target specific datasets per category |
| `response_length` | "large" for Phase 1 data |
| DeepResearch "max" mode | 180 min exhaustive DD |
| DeepResearch `search` config | Source filtering + date ranges |
| 30+ financial datasets | SEC, earnings, balance sheets, cash flow, insider trades, patents, market data |
