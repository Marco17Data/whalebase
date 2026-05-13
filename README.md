# 🐳 Whalebase

**Self-serve sales analytics for people who don't write SQL.**

Drop a CSV. Get a dashboard in five seconds. Ask questions in plain language.
No accounts. No database. No data on disk.

![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=flat-square&logo=python&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![DuckDB](https://img.shields.io/badge/DuckDB-FFF000?style=flat-square&logo=duckdb&logoColor=black)
![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

[Features](#-features) · [Quick Start](#-quick-start) · [How It Works](#-how-it-works) · [Tech Stack](#-tech-stack) · [API](#-api) · [Deployment](#-deployment)

---

## 📖 Overview

Whalebase turns raw spreadsheets into interactive sales dashboards in seconds. Designed for **non-technical users** — sales managers, founders, small-business owners — who have data but no time to learn SQL, BI tools, or Excel pivot wizardry.

**Three ways to analyze**, ranked by ease:

| Method | What it does | When to use |
|--------|--------------|-------------|
| 🎯 **Templates** | One-click dashboards (Sales Overview, Repurchase, Channels, Customers) | "Show me everything." |
| ⚡ **Preset Questions** | Pre-baked SQL for the 8 most common analyses | "I know what I want." |
| 🤖 **Ask AI** | Plain-language → SQL → chart → insight | "Show me something custom." |

Plus a **pivot table builder** and **SQL playground** for power users.

---

## ✨ Features

### Analytics

- **4 one-click dashboard templates** — Sales Overview, Repurchase Analysis, Channel Comparison, Customer Insights
- **8 preset analytical questions** — sales by month, top by category, repurchase rate, frequency distribution, and more
- **Natural-language AI** — type a question in any of 10 languages, get SQL + chart + insight
- **Pivot table builder** — drag fields to build cross-tabs with custom aggregations
- **SQL playground** — read-only access (SELECT/WITH/SHOW/DESCRIBE) for power users

### Data Handling

- **Multi-format upload** — CSV, TSV, Excel (.xlsx), JSON
- **Auto type detection** — text, numeric, datetime, boolean
- **Multi-table support** — upload several files, switch analysis with one click
- **10 currencies** — USD, EUR, GBP, CNY, JPY, KRW, INR, CAD, AUD, BRL

### Localization

- **10 languages, end-to-end** — UI, card titles, SQL column aliases, AND AI-generated text all switch together
- 🇬🇧 English · 🇨🇳 中文 · 🇪🇸 Español · 🇯🇵 日本語 · 🇰🇷 한국어 · 🇫🇷 Français · 🇩🇪 Deutsch · 🇵🇹 Português · 🇮🇹 Italiano · 🇷🇺 Русский

### Privacy & Architecture

- **Zero persistence** — uploaded data lives only in DuckDB session memory
- **No disk writes, no telemetry, no analytics tracking**
- **2-hour session TTL** — inactive sessions clean themselves up
- **No accounts required** — open the page and start analyzing

### Developer Experience

- **4-provider LLM adapter** — Gemini, OpenAI, Anthropic Claude, DeepSeek (swap in `.env`)
- **Markdown export** — share entire dashboards as reports
- **Hot reload** in dev mode (Vite HMR + Uvicorn auto-reload)

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Python      | 3.11+   |
| Node.js     | 18+     |
| LLM API key | Free Gemini key from [aistudio.google.com](https://aistudio.google.com/apikey) |

### Installation

```bash
git clone https://github.com/<your-username>/whalebase.git
cd whalebase
```

### Run the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate            # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env and set: GEMINI_API_KEY=your_key_here

python main.py
```

Backend runs at **http://localhost:8000**.

### Run the frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at **http://localhost:5173**.

Open it. Drop a CSV. Done.

---

## 🎯 How It Works

A typical session takes about 30 seconds:

1. Drop a CSV → Whalebase parses it into a DuckDB in-memory table
2. Pick currency → All money figures get the right symbol
3. Click a template → KPIs, trend charts, top-N charts appear
4. Switch language → Everything translates in place, including AI text
5. Ask AI in plain English → SQL generated, executed, charted, explained
6. Export to Markdown → Share the dashboard as a report

### Architecture

```
┌─────────────────────────────────────┐
│  Frontend  ·  http://localhost:5173 │
│                                     │
│  React 18 · Vite 5 · Tailwind 3     │
│  Recharts · TypeScript · i18n       │
└─────────────────┬───────────────────┘
                  │ HTTP / JSON
                  ▼
┌─────────────────────────────────────┐
│  Backend   ·  http://localhost:8000 │
│                                     │
│  FastAPI · Uvicorn · Pydantic       │
│  ┌─────────────────────────────┐    │
│  │  Session Pool · 2h TTL      │    │
│  │  └─ DuckDB (in-memory)      │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │  LLM Adapter                │    │
│  │  └─ Gemini · OpenAI ·       │    │
│  │     Anthropic · DeepSeek    │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │  i18n · 10 languages        │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

---

## 🛠 Tech Stack

### Languages

`Python 3.13` · `TypeScript 5` · `SQL (DuckDB dialect)` · `TSX/JSX` · `CSS (Tailwind)` · `HTML` · `JSON` · `Markdown` · `Bash`

### Backend

| Library         | Purpose                            |
| --------------- | ---------------------------------- |
| FastAPI         | Async REST framework               |
| DuckDB          | In-memory analytical SQL engine    |
| Pydantic        | Request/response validation        |
| Uvicorn         | ASGI server                        |
| pandas          | CSV / Excel / JSON parsing         |
| python-dotenv   | Environment config                 |
| google-genai    | Gemini SDK (primary LLM)           |

### Frontend

| Library       | Purpose                  |
| ------------- | ------------------------ |
| React 18      | UI framework             |
| Vite 5        | Build tool + dev server  |
| TypeScript 5  | Type safety              |
| Tailwind CSS 3| Utility-first styling    |
| Recharts      | Chart library            |
| lucide-react  | Icon set                 |

---

## ⚙️ Configuration

All config lives in `backend/.env` (copy from `.env.example`):

```bash
# LLM provider — gemini / openai / anthropic / deepseek
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.5-flash

# API key — only the one for your chosen provider is needed
GEMINI_API_KEY=your_key_here
# OPENAI_API_KEY=...
# ANTHROPIC_API_KEY=...
# DEEPSEEK_API_KEY=...

# Server
PORT=8000
FRONTEND_ORIGIN=http://localhost:5173
```

Switching LLM provider is a single env var — the rest is handled by the adapter layer.

---

## 📁 Project Structure

```
whalebase/
├── backend/
│   ├── main.py              # FastAPI app + all endpoints
│   ├── database.py          # DuckDB session pool (2h TTL)
│   ├── llm.py               # 4-provider LLM adapter
│   ├── analytics.py         # NL→SQL, insights, auto-suggestions
│   ├── dashboard.py         # Auto-generated default dashboard
│   ├── templates.py         # Templates + preset question library
│   ├── pivot.py             # Pivot table SQL builder
│   ├── i18n.py              # Backend translation tables
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── App.tsx          # Main shell + state
    │   ├── api.ts           # Type-safe API client
    │   ├── i18n.tsx         # Frontend i18n provider
    │   ├── types.ts         # Shared TypeScript interfaces
    │   ├── lib/format.ts    # Number / currency formatters
    │   └── components/
    │       ├── TopBar.tsx
    │       ├── DataPanel.tsx
    │       ├── DashboardView.tsx
    │       ├── SmartChart.tsx
    │       ├── PivotView.tsx
    │       ├── QueryCard.tsx
    │       ├── AIModal.tsx
    │       ├── CurrencyDialog.tsx
    │       └── SettingsDialog.tsx
    ├── package.json
    ├── vite.config.ts
    └── tailwind.config.js
```

---

## 🔌 API

All endpoints live under `/api/`. Most accept a `lang` query parameter (`en` default).

### Session

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/session` | Create a new session, returns `session_id` |
| `DELETE` | `/api/session/{sid}` | Destroy session |

### Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/session/{sid}/upload` | Upload one or more files (CSV/TSV/Excel/JSON) |
| `GET`  | `/api/session/{sid}/tables` | List tables in this session |
| `DELETE` | `/api/session/{sid}/table/{name}` | Remove a table |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/session/{sid}/dashboard` | Auto-generated dashboard cards |
| `POST` | `/api/session/{sid}/template/{tid}` | Run a dashboard template |
| `GET`  | `/api/templates` | List available templates |
| `GET`  | `/api/session/{sid}/preset-questions` | List preset questions available for this dataset |
| `POST` | `/api/session/{sid}/preset/{pid}` | Execute a preset question |
| `POST` | `/api/session/{sid}/ask` | Natural-language → SQL → result |
| `POST` | `/api/session/{sid}/sql` | Execute raw SQL (read-only) |
| `POST` | `/api/session/{sid}/pivot` | Run a pivot configuration |

### Currency & Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/session/{sid}/currency` | Get currency setting |
| `POST` | `/api/session/{sid}/currency` | Set currency |
| `POST` | `/api/session/{sid}/export/markdown` | Export queries as Markdown report |

---

## 🌍 Internationalization

Whalebase translates **everything user-facing**:

- UI labels (buttons, menus, dialogs)
- Card titles ("Total Revenue" / "总销售额" / "総売上")
- SQL column aliases ("Month" / "月份" / "月")
- AI-generated explanations and insights
- Preset question labels
- Dashboard subtitles

Column names from your data are kept in their original form. The LLM is instructed to output in the active language via prompt templates.

---

## 🔒 Privacy

Whalebase is designed around the principle that **your data shouldn't leave your control**:

- Files are loaded into DuckDB in-memory and the source bytes discarded
- Nothing is written to disk by the server
- No telemetry, no analytics, no user tracking
- Sessions auto-expire after 2 hours of inactivity
- No accounts means no breach surface

The trade-off is that **refreshing the browser starts a new session**. This is intentional. For multi-user persistence, you'd need to add a database + auth layer.

---

## 🚧 Deployment

Whalebase is a standard FastAPI + Vite app. Recommended free-tier deployment:

### Frontend (Vercel)

```
Build command:  cd frontend && npm install && npm run build
Output dir:     frontend/dist
Env var:        VITE_API_BASE = https://your-backend.onrender.com/api
```

### Backend (Render)

```
Build command:  cd backend && pip install -r requirements.txt
Start command:  cd backend && python main.py
Env vars:       GEMINI_API_KEY, FRONTEND_ORIGIN
```

> **Note**: Render's free tier has cold starts (~30s after 15 min idle). Gemini's free tier is rate-limited to 15 RPM. Both are fine for demo/personal use.

---

## 🗺 Roadmap

- [ ] Multi-user accounts with Postgres-backed persistence
- [ ] Scheduled reports (daily/weekly Markdown emails)
- [ ] Live data source connectors (Google Sheets, Shopify, Stripe)
- [ ] Embed mode — drop dashboards into other products
- [ ] React Native mobile app (the API is already there)

---

## 🤝 Contributing

Pull requests welcome. For major changes, please open an issue first to discuss what you'd like to change.

---

## 📝 License

[MIT](LICENSE)

---

Built with FastAPI · React · DuckDB · Recharts · Gemini
