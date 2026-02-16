import { NextRequest, NextResponse } from "next/server";
import { Valyu } from "valyu-js";
import { isSelfHostedMode } from "@/app/lib/app-mode";

/** Allow larger request bodies for file uploads (base64-encoded, up to ~200MB) */
export const maxDuration = 60;

const VALYU_APP_URL = process.env.VALYU_APP_URL || "https://platform.valyu.ai";

const getValyuApiKey = () => {
  const apiKey = process.env.VALYU_API_KEY;
  if (!apiKey) {
    throw new Error("VALYU_API_KEY environment variable is required");
  }
  return apiKey;
};

type DeliverableType = "csv" | "xlsx" | "pptx" | "docx" | "pdf";

interface Deliverable {
  type: DeliverableType;
  description: string;
}

interface FileAttachment {
  data: string;
  filename: string;
  mediaType: string;
  context?: string;
}

/**
 * Create research using OAuth proxy (user's credits)
 */
async function createResearchWithOAuth(
  accessToken: string,
  query: string,
  deliverables: Deliverable[],
  files?: FileAttachment[],
  urls?: string[],
  alertEmail?: string
) {
  const proxyUrl = `${VALYU_APP_URL}/api/oauth/proxy`;

  // Debug logging
  console.log("[OAuth] Proxy URL:", proxyUrl);
  console.log("[OAuth] Token (first 20 chars):", accessToken.substring(0, 20) + "...");
  console.log("[OAuth] Token length:", accessToken.length);

  const taskBody: Record<string, unknown> = {
    query,
    deliverables,
    mode: "fast",
    output_formats: ["markdown", "pdf"],
  };

  if (files && files.length > 0) {
    taskBody.files = files;
  }
  if (urls && urls.length > 0) {
    taskBody.urls = urls;
  }
  if (alertEmail) {
    taskBody.alert_email = alertEmail;
  }

  const requestBody = {
    path: "/v1/deepresearch/tasks",
    method: "POST",
    body: taskBody,
  };

  console.log("[OAuth] Request body (without query):", {
    path: requestBody.path,
    method: requestBody.method,
    body: {
      deliverables: taskBody.deliverables,
      mode: taskBody.mode,
      filesCount: files?.length ?? 0,
      urlsCount: urls?.length ?? 0,
    },
  });

  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  console.log("[OAuth] Response status:", response.status);
  console.log("[OAuth] Response headers:", Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    const errorText = await response.text();
    console.log("[OAuth] Error response body:", errorText);

    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }

    // Check for credit errors
    if (response.status === 402) {
      throw new Error("Insufficient credits. Please top up your Valyu account.");
    }

    // Check for auth errors
    if (response.status === 401 || response.status === 403) {
      console.log("[OAuth] Auth error - token may be invalid or expired");
      throw new Error(`Session expired. Please sign in again. (${response.status}: ${errorData.message || errorData.error || 'Unknown error'})`);
    }

    throw new Error(errorData.message || errorData.error || "Failed to create research");
  }

  return response.json();
}

/**
 * Create research using server API key (self-hosted mode)
 */
async function createResearchWithApiKey(
  query: string,
  deliverables: Deliverable[],
  files?: FileAttachment[],
  urls?: string[],
  alertEmail?: string
) {
  const valyu = new Valyu(getValyuApiKey());

  const options: Record<string, unknown> = {
    query,
    deliverables,
    mode: "fast",
  };

  if (files && files.length > 0) {
    options.files = files;
  }
  if (urls && urls.length > 0) {
    options.urls = urls;
  }
  if (alertEmail) {
    options.alertEmail = alertEmail;
  }

  return valyu.deepresearch.create(options);
}

export async function POST(request: NextRequest) {
  try {
    // Check for Authorization header (OAuth token)
    const authHeader = request.headers.get("Authorization");
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;

    const {
      researchType,
      researchSubject,
      researchFocus,
      clientContext,
      specificQuestions,
      files,
      urls,
      alertEmail,
    } = await request.json() as {
      researchType: string;
      researchSubject: string;
      researchFocus?: string;
      clientContext?: string;
      specificQuestions?: string;
      files?: FileAttachment[];
      urls?: string[];
      alertEmail?: string;
    };

    if (!researchSubject) {
      return NextResponse.json(
        { error: "Research subject is required" },
        { status: 400 }
      );
    }

    // Validate files and urls limits
    if (files && files.length > 10) {
      return NextResponse.json(
        { error: "Maximum 10 files allowed" },
        { status: 400 }
      );
    }
    if (urls && urls.length > 10) {
      return NextResponse.json(
        { error: "Maximum 10 URLs allowed" },
        { status: 400 }
      );
    }

    // Build the research query based on type
    const query = buildResearchQuery(
      researchType,
      researchSubject,
      researchFocus,
      clientContext,
      specificQuestions
    );

    // Build deliverables based on research type
    const deliverables = buildDeliverables(researchType, researchSubject);

    // Check mode first
    const selfHosted = isSelfHostedMode();

    // Valyu mode requires authentication
    if (!selfHosted && !accessToken) {
      return NextResponse.json(
        { error: "Sign in for free to start deepresearch", requiresReauth: true },
        { status: 401 }
      );
    }

    let response;

    // Route based on mode
    if (!selfHosted && accessToken) {
      // Valyu mode: use OAuth proxy (charges user's credits)
      response = await createResearchWithOAuth(accessToken, query, deliverables, files, urls, alertEmail);
    } else {
      // Self-hosted mode: use server API key
      response = await createResearchWithApiKey(query, deliverables, files, urls, alertEmail);
    }

    return NextResponse.json({
      deepresearch_id: response.deepresearch_id,
      status: "queued",
    });
  } catch (error) {
    console.error("Error creating research task:", error);

    let message = "Failed to start research";
    let statusCode = 500;

    if (error instanceof Error) {
      message = error.message;
      // Check if it's an API error with status code
      if ("status" in error && typeof (error as { status: number }).status === "number") {
        statusCode = (error as { status: number }).status;
      }
      // Check for specific error messages
      if (message.includes("Insufficient credits")) {
        statusCode = 402;
      } else if (message.includes("Session expired") || message.includes("sign in")) {
        statusCode = 401;
      }
    }

    // Log full error for debugging
    console.error("Full error details:", JSON.stringify(error, null, 2));

    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

function buildResearchQuery(
  researchType: string,
  researchSubject: string,
  researchFocus?: string,
  clientContext?: string,
  specificQuestions?: string
): string {
  let baseQuery = "";

  switch (researchType) {
    case "company":
      baseQuery = `
Conduct comprehensive due diligence research on ${researchSubject}.

Provide detailed analysis covering:

1. **Company Overview**
   - Company history, founding, and key milestones
   - Mission, vision, and strategic positioning
   - Headquarters location and global presence
   - Company size (employees, revenue if available)

2. **Business Model & Products/Services**
   - Core products and services
   - Revenue streams and business model
   - Key value propositions
   - Target markets and customer segments

3. **Financial Analysis** (if publicly available)
   - Revenue trends and growth rates
   - Profitability metrics
   - Funding history (for private companies)
   - Recent financial performance

4. **Leadership & Governance**
   - Executive team profiles
   - Board composition
   - Key leadership changes
   - Management track record

5. **Market Position & Competition**
   - Market share and positioning
   - Key competitors and competitive advantages
   - Differentiation factors
   - SWOT analysis

6. **Industry & Market Context**
   - Industry trends affecting the company
   - Regulatory environment
   - Market opportunities and threats

7. **Recent Developments**
   - Latest news and announcements
   - Strategic initiatives
   - Partnerships and acquisitions
   - Product launches

8. **Risk Assessment**
   - Key business risks
   - Operational challenges
   - Regulatory/legal risks
   - Market risks

9. **Investment Considerations** (if applicable)
   - Growth potential
   - Valuation context
   - Key metrics to monitor
`;
      break;

    case "market":
      baseQuery = `
Conduct comprehensive market analysis research on the ${researchSubject} market.

Provide detailed analysis covering:

1. **Market Overview**
   - Market definition and scope
   - Market size (TAM, SAM, SOM)
   - Historical growth rates
   - Projected growth rates and forecasts

2. **Market Segmentation**
   - Key market segments
   - Segment sizes and growth rates
   - Geographic breakdown
   - Customer segmentation

3. **Industry Dynamics**
   - Key growth drivers
   - Market restraints and challenges
   - Porter's Five Forces analysis
   - Industry lifecycle stage

4. **Competitive Landscape**
   - Major players and market shares
   - Competitive positioning map
   - Key success factors
   - Barriers to entry

5. **Value Chain Analysis**
   - Key value chain participants
   - Margin distribution across value chain
   - Vertical integration trends

6. **Technology & Innovation**
   - Key technologies driving the market
   - Innovation trends
   - Disruptive forces
   - R&D investment trends

7. **Regulatory Environment**
   - Key regulations affecting the market
   - Regulatory trends
   - Compliance requirements
   - Government initiatives

8. **Regional Analysis**
   - Geographic market breakdown
   - Regional growth variations
   - Emerging markets
   - Regional competitive dynamics

9. **Future Outlook**
   - Market projections (5-year)
   - Emerging opportunities
   - Potential disruptions
   - Strategic recommendations
`;
      break;

    case "competitive":
      baseQuery = `
Conduct comprehensive competitive landscape analysis for the ${researchSubject} space.

Provide detailed analysis covering:

1. **Market Overview**
   - Industry definition and scope
   - Total addressable market size
   - Key market segments

2. **Competitor Identification**
   - Major competitors (list and categorize)
   - Market share estimates
   - Competitor tiers (leaders, challengers, niche players)

3. **Competitor Profiles**
   For each major competitor, provide:
   - Company overview
   - Products/services offered
   - Pricing strategy
   - Target customers
   - Geographic presence
   - Key strengths and weaknesses
   - Recent strategic moves

4. **Competitive Comparison Matrix**
   - Feature comparison across competitors
   - Pricing comparison
   - Market positioning comparison
   - Technology/capability comparison

5. **Competitive Dynamics**
   - Competitive intensity
   - Recent competitive moves
   - M&A activity in the space
   - Partnership trends

6. **Differentiation Analysis**
   - Key differentiation factors
   - Sustainable competitive advantages
   - Areas of competitive parity
   - White space opportunities

7. **SWOT Analysis**
   - Provide SWOT for top 3-5 competitors

8. **Competitive Positioning Map**
   - Describe positioning across key dimensions
   - Identify gaps in the market

9. **Strategic Implications**
   - Competitive threats to monitor
   - Opportunities for differentiation
   - Recommended competitive strategies
`;
      break;

    case "industry":
      baseQuery = `
Conduct comprehensive industry overview research on the ${researchSubject} industry.

Provide detailed analysis covering:

1. **Industry Definition & Scope**
   - Industry definition and boundaries
   - Key sub-sectors and segments
   - Industry classification (NAICS/SIC codes if applicable)

2. **Industry Size & Growth**
   - Global industry size
   - Historical growth trends
   - Growth projections
   - Regional breakdown

3. **Industry Structure**
   - Value chain analysis
   - Key industry participants
   - Industry concentration
   - Vertical integration patterns

4. **Key Players**
   - Industry leaders
   - Emerging players
   - Key partnerships and alliances
   - Recent M&A activity

5. **Business Models**
   - Dominant business models
   - Emerging business models
   - Revenue models
   - Cost structures

6. **Industry Dynamics**
   - Porter's Five Forces analysis
   - Key success factors
   - Barriers to entry/exit
   - Industry lifecycle stage

7. **Technology & Innovation**
   - Key technologies
   - Technology trends
   - Digital transformation impact
   - Innovation hotspots

8. **Regulatory Landscape**
   - Key regulations
   - Regulatory bodies
   - Compliance requirements
   - Regulatory trends

9. **Trends & Drivers**
   - Macro trends affecting the industry
   - Growth drivers
   - Industry challenges
   - Disruption risks

10. **Future Outlook**
    - Industry projections
    - Emerging opportunities
    - Potential disruptions
    - Strategic considerations
`;
      break;

    default: // custom
      baseQuery = `
Conduct comprehensive research on: ${researchSubject}

Provide detailed, well-structured analysis with:
- Executive summary
- Key findings and insights
- Data and statistics with sources
- Analysis and implications
- Recommendations and conclusions

Ensure all information is:
- Accurate and well-sourced
- Current and relevant
- Actionable for business decision-making
`;
  }

  // Add research focus if provided
  if (researchFocus) {
    baseQuery += `

**SPECIFIC FOCUS AREAS:**
${researchFocus}

Please ensure these specific areas receive detailed attention in the analysis.
`;
  }

  // Add client context if provided
  if (clientContext) {
    baseQuery += `

**CLIENT CONTEXT:**
${clientContext}

Please tailor the analysis and recommendations with this context in mind.
`;
  }

  // Add specific questions if provided
  if (specificQuestions) {
    baseQuery += `

**SPECIFIC QUESTIONS TO ADDRESS:**
${specificQuestions}

Please ensure these specific questions are directly answered in the research.
`;
  }

  // Add formatting instructions
  baseQuery += `

**FORMATTING REQUIREMENTS:**
- Use clear headings and subheadings
- Include bullet points for easy scanning
- Provide data tables where appropriate
- Cite sources for all statistics and facts
- Include relevant charts/visualizations descriptions
- Maintain professional consulting report quality
`;

  return baseQuery;
}

function buildDeliverables(
  researchType: string,
  researchSubject: string
): Deliverable[] {
  const subjectClean = researchSubject.replace(/[^a-zA-Z0-9\s]/g, "").trim();

  switch (researchType) {
    case "company":
      return [
        {
          type: "csv",
          description: `${subjectClean} - Competitor Comparison Matrix with key metrics including revenue, market share, products, and competitive positioning`,
        },
        {
          type: "docx",
          description: `${subjectClean} - Executive Summary one-page due diligence overview for leadership briefing`,
        },
        {
          type: "pptx",
          description: `${subjectClean} - Executive Presentation Deck with company overview, financials, competitive position, and investment considerations`,
        },
      ];

    case "market":
      return [
        {
          type: "csv",
          description: `${subjectClean} - Market Data including market size, growth rates, segments, and key player market shares`,
        },
        {
          type: "docx",
          description: `${subjectClean} - Executive Summary one-page market overview with TAM/SAM/SOM and key insights`,
        },
        {
          type: "pptx",
          description: `${subjectClean} - Market Analysis Presentation with market sizing, segmentation, competitive landscape, and growth projections`,
        },
      ];

    case "competitive":
      return [
        {
          type: "csv",
          description: `${subjectClean} - Competitor Comparison Matrix with detailed feature, pricing, and capability comparison`,
        },
        {
          type: "docx",
          description: `${subjectClean} - Executive Summary one-page competitive landscape overview`,
        },
        {
          type: "pptx",
          description: `${subjectClean} - Competitive Analysis Presentation with competitor profiles, positioning map, and strategic recommendations`,
        },
      ];

    case "industry":
      return [
        {
          type: "csv",
          description: `${subjectClean} - Industry Data including key players, market sizes, growth rates, and segment breakdown`,
        },
        {
          type: "docx",
          description: `${subjectClean} - Executive Summary one-page industry overview for leadership briefing`,
        },
        {
          type: "pptx",
          description: `${subjectClean} - Industry Overview Presentation with market structure, key trends, and strategic implications`,
        },
      ];

    default:
      return [
        {
          type: "csv",
          description: `${subjectClean} - Supporting Data and analysis tables`,
        },
        {
          type: "docx",
          description: `${subjectClean} - Executive Summary one-page overview`,
        },
        {
          type: "pptx",
          description: `${subjectClean} - Executive Presentation Deck with key findings and recommendations`,
        },
      ];
  }
}
