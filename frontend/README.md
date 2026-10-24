# 💻 LogLens Frontend

The **LogLens Frontend** is a modern, high-performance web dashboard built with **Next.js 14** (App Router), **React 18**, **TypeScript**, and **Tailwind CSS**. It communicates with the LogLens FastAPI backend to visualize real-time log ingestion, time-series timelines, causality propagation graphs, and Gemma-powered root cause diagnoses.

## 👥 Authors

- **Achraf Eddiba**
- **Ziad Boualam**
- **Hassan Ahchtar**
- **Salah Laouina**

---

## ⚡ Tech Stack & Libraries

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: TypeScript 5.6
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with dark mode theme
- **Charts & Visualization**:
  - [Recharts](https://recharts.org/) for stacked timeline charts and event volume analysis.
  - Custom interactive SVG directed graph for the Service Causality Graph.
  - Dynamic density grid for the Service Error Heatmap.
- **Icons**: [Lucide React](https://lucide.dev/)
- **Authentication**: Google OAuth 2.0 via HttpOnly session cookies.

---

## 🧩 Components Overview

- `UploadDropzone.tsx`: Multi-file upload dropzone with source tagging and one-click demo data generation button.
- `SummaryCards.tsx`: Top-level KPI cards displaying Total Cleaned Logs, Services Monitored, Overall Error Rate, and Anomaly Count.
- `IncidentReportPanel.tsx`: Displays Gemma AI root cause synthesis, timeline narrative, affected services, and concrete remediation steps.
- `CausalityGraphView.tsx`: Directed graph illustrating error propagation pathways, lag durations, and confidence weights between services.
- `TimelineChart.tsx`: Multi-mode stacked area/bar timeline (grouped by Level, Service, or Cluster) with anomaly markers.
- `ErrorHeatmap.tsx`: Synchronized grid displaying fault density across services and chronological bins.
- `AnomalyList.tsx`: Ranked anomaly cards showing scores, types, sample raw log messages, and plain-English Gemma explanations.
- `ChatBox.tsx`: Interactive LogCopilot assistant for natural language Q&A grounded in session telemetry.
- `LogTable.tsx`: Full canonical log record explorer with level filters, service filters, and search.
- `Navbar.tsx`: Sticky navigation header with session indicator, system status, and Google OAuth login/logout controls.

---

## 🚀 Getting Started

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment

By default, the frontend connects to `http://localhost:8000`. To customize the backend URL:

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Run Development Server

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.
