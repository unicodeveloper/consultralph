# [consultralph.com](https://consultralph.com)

![Ralph](consultralph.png)

**Consult Ralph** is an autonomous deep research AI agent for consultants. It generates comprehensive due diligence reports, market analyses, competitive landscapes, and strategic insights in minutes. It can also run multiple research tasks simultaneously, like a swarm of agents completing in minutes what would normally take days or weeks or months.

Built for consultants at any top firms: EY, Deloitte, PwC, KPMG, McKinsey, BCG, Bain, investment banks etc.

## What It Does

This tool transforms hours of manual research into minutes of automated intelligence gathering. Input your research topic, and receive:

- **📄 Comprehensive PDF Report** - Detailed analysis with executive summary, findings, and recommendations
- **📊 Data Spreadsheet (CSV)** - Structured data, competitor comparisons, and key metrics
- **📝 Executive Summary (DOCX)** - One-page briefing document for leadership presentations
- **🎯 PowerPoint Deck (PPTX)** - Presentation-ready slides for client meetings
- **🔗 Cited Sources** - All findings backed by verifiable sources

## Research Types

| Type | Use Case | Example Inputs |
|------|----------|----------------|
| **Company Due Diligence** | M&A targets, investment analysis, competitor deep-dives | "Stripe", "Databricks", "SpaceX" |
| **Market Analysis** | TAM/SAM/SOM sizing, market entry decisions | "Electric Vehicle Market", "Cloud Computing" |
| **Competitive Landscape** | Category mapping, positioning analysis | "CRM Software", "Food Delivery Apps" |
| **Industry Overview** | Sector research, value chain analysis | "Fintech", "Healthcare IT", "Renewable Energy" |
| **Custom Research** | Any business intelligence question | Free-form queries |

## Features

- **Deep AI Research** - Leverages [Valyu's Deep Research API](https://docs.valyu.ai/api-reference/endpoint/deepresearch-create) to search across thousands of sources
- **Real-time Progress** - Visual indicators showing research stages and completion
- **Professional Deliverables** - Consulting-quality PDF reports, spreadsheets, presentations, and summaries
- **Multiple Research Types** - Company, market, competitive, industry, or custom research
- **Advanced Options** - Add client context, specific questions, and research focus areas
- **Dark Mode by Default** - Sleek dark UI with light mode toggle available

## App Modes

ConsultRalph supports two deployment modes controlled by the `NEXT_PUBLIC_APP_MODE` environment variable:

### Self-Hosted Mode (Default)

```env
NEXT_PUBLIC_APP_MODE=self-hosted
```

- **No user authentication required** — anyone with access to the app can run research
- Uses a single **server-side Valyu API key** (`VALYU_API_KEY`) for all requests
- All research costs are billed to the API key owner
- Ideal for internal team deployments, personal use, or private instances
- Only requires `VALYU_API_KEY` to be set

### Valyu Mode

```env
NEXT_PUBLIC_APP_MODE=valyu
```

- **Requires user authentication** via OAuth 2.0 with PKCE (Valyu as identity provider)
- Each user signs in with their Valyu account and uses their own credits
- Research costs are billed to the individual user's Valyu account
- Ideal for public-facing deployments like [consultralph.com](https://consultralph.com)
- Requires OAuth configuration: `NEXT_PUBLIC_VALYU_CLIENT_ID`, `VALYU_CLIENT_SECRET`, `NEXT_PUBLIC_VALYU_AUTH_URL`, `VALYU_APP_URL`, and `NEXT_PUBLIC_REDIRECT_URI`

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| AI Research | [Valyu Deep Research API](https://valyu.ai) |
| Auth | OAuth 2.0 with PKCE (Valyu mode) |
| State | Zustand |
| Markdown | react-markdown with GFM |
| Icons | Lucide React |

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm
- Valyu API key (get one at [valyu.ai](https://valyu.ai))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/unicodeveloper/consultralph.git
   cd consultralph
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

4. **Configure your mode**

   **For self-hosted mode** (simplest setup):
   ```env
   NEXT_PUBLIC_APP_MODE=self-hosted
   VALYU_API_KEY=your_valyu_api_key_here
   ```

   **For Valyu mode** (with user authentication):
   ```env
   NEXT_PUBLIC_APP_MODE=valyu
   NEXT_PUBLIC_VALYU_CLIENT_ID=your_client_id_here
   VALYU_CLIENT_SECRET=your_client_secret_here
   NEXT_PUBLIC_VALYU_AUTH_URL=https://auth.valyu.ai
   VALYU_APP_URL=https://platform.valyu.ai
   NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000/auth/valyu/callback
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open [http://localhost:3000](http://localhost:3000)**

## Usage

### Basic Research

1. Select a research type (Company, Market, Competitive, Industry, or Custom)
2. Enter your research subject
3. Click "Start Deep Research"
4. Wait 5-10 minutes for comprehensive results
5. Download your deliverables (PDF, CSV, DOCX, PPTX)

### Advanced Options

Expand "Advanced Options" to add:

- **Research Focus** - Specify particular aspects to emphasize
- **Client Context** - Tailor analysis for specific use cases (e.g., "PE firm evaluating acquisition" or "Fortune 500 company exploring market entry")
- **Specific Questions** - List questions that must be directly answered

### Example Queries

**Company Due Diligence:**
> "OpenAI" with focus on "competitive positioning in enterprise AI and recent partnership strategies"

**Market Analysis:**
> "Digital Payments Market" with context "Client is a regional bank exploring fintech partnerships"

**Competitive Landscape:**
> "Cloud Infrastructure Providers" with questions "What are the key differentiators between AWS, Azure, and GCP for enterprise customers?"

## Deployment

### Railway (Recommended)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template)

1. Click the button above
2. Add your `VALYU_API_KEY` environment variable
3. Set `NEXT_PUBLIC_APP_MODE=self-hosted` (or `valyu` with OAuth config)
4. Deploy

### Vercel

```bash
npm i -g vercel
vercel
```

Add environment variables in the Vercel dashboard.

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

## Project Structure

```
consultralph/
├── app/
│   ├── api/
│   │   └── consulting-research/
│   │       ├── route.ts              # Create research task
│   │       ├── status/route.ts       # Get task status
│   │       ├── public-status/route.ts # Public report access
│   │       └── cancel/route.ts       # Cancel task
│   ├── components/
│   │   ├── ConsultingResearchForm.tsx # Main research form
│   │   ├── ResearchResults.tsx        # Results display
│   │   ├── ResearchActivityFeed.tsx   # Live activity feed
│   │   ├── Sidebar.tsx                # Navigation sidebar
│   │   ├── ExampleReports.tsx         # Example report cards
│   │   ├── GitHubCorner.tsx           # GitHub link
│   │   └── auth/                      # OAuth components
│   │       ├── sign-in-modal.tsx
│   │       ├── sign-in-panel.tsx
│   │       └── auth-initializer.tsx
│   ├── lib/
│   │   ├── app-mode.ts               # Self-hosted vs Valyu mode helpers
│   │   └── researchHistory.ts        # Local research history
│   ├── stores/
│   │   ├── auth-store.ts             # Auth state (Zustand)
│   │   └── theme-store.ts            # Theme state (Zustand)
│   ├── globals.css                    # Global styles & theme variables
│   ├── layout.tsx                     # Root layout
│   └── page.tsx                       # Main page
├── public/                            # Static assets
├── .env.example                       # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

## API Reference

### POST /api/consulting-research

Create a new research task.

**Request Body:**
```json
{
  "researchType": "company",
  "researchSubject": "Stripe",
  "researchFocus": "Focus on payment infrastructure and developer experience",
  "clientContext": "PE firm evaluating fintech investments",
  "specificQuestions": "What is Stripe's market share?\nWho are the main competitors?"
}
```

**Response:**
```json
{
  "deepresearch_id": "dr_abc123",
  "status": "queued"
}
```

### GET /api/consulting-research/status

Get research task status.

**Query Parameters:**
- `taskId` - The research task ID

**Response:**
```json
{
  "status": "completed",
  "task_id": "dr_abc123",
  "output": "# Research Report\n...",
  "sources": [...],
  "deliverables": [...],
  "pdf_url": "https://...",
  "usage": {
    "search_units": 50,
    "ai_units": 100,
    "compute_units": 25,
    "total_cost": 1.50
  }
}
```

### POST /api/consulting-research/cancel

Cancel a running research task.

**Request Body:**
```json
{
  "taskId": "dr_abc123"
}
```

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Valyu](https://valyu.ai) - Deep Research API
- [Next.js](https://nextjs.org) - React Framework
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [Lucide](https://lucide.dev) - Icons

---

Built with ❤️ for consultants who value their time.

**[Join our Discord](https://discord.com/invite/BhUWrFbHRa)** for updates and support.
