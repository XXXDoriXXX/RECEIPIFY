<div align="center">
  <h1>🧾 Receiptify</h1>
  <p><strong>A highly-scalable, AI-powered system for Automated Receipt Data Extraction and Expense Management.</strong></p>
</div>

<br />

## 📖 Overview

**Receiptify** is an enterprise-grade backend infrastructure built on top of the **NestJS** and **Nx Monorepo** patterns. It allows users to upload their daily receipts, safely processes them asynchronously via an advanced AI OCR Pipeline (featuring Google Vision Hybrid & multimodal GenAI models), and organizes the extracted data into a high-performance database for analytics, filtering, and deep search.

---

## 🏗 Architecture & Tech Stack

Receiptify takes advantage of distributed software architecture designed for high availability and load handling.

### 🧩 Core Infrastructure
- **Nx Monorepo:** Centralized repository managing both apps and shared libraries.
- **NestJS:** Progressive Node.js framework for fast, robust, and strongly-typed (TypeScript) backend services.
- **PostgreSQL:** Primary ACID-compliant SQL database, featuring natively optimized Full-Text Search (FTS).
- **Prisma ORM:** Next-generation TypeScript ORM used for strictly-typed database queries, relations, and migrations.
- **Redis / BullMQ:** High-performance message broker and job queue managing the asynchronous OCR jobs, retry strategies, and rate-limiting.
- **MinIO (S3-compatible):** Object storage for secure storage of raw uncompressed receipt images.

### 🧠 AI & OCR Pipeline
- **Tier 1:** Native **Gemini Multimodal Models** for complex text extraction and contextual inference.
- **Tier 2:** **Google Cloud Vision API** combined with Gemma (Hybrid Strategy) as an ultimate fallback to ensure total system resilience during extreme rate limits.

---

## 📂 Repository Structure

The Nx monorepo divides code into deployable applications and reusable libraries:

```text
receiptify/
├── apps/
│   ├── api/                 # Main REST API serving client apps (Auth, Receipts CRUD, Analytics)
│   └── ocr-worker/          # Background worker consuming jobs from Redis and executing AI OCR
├── libs/
│   ├── infra/
│   │   ├── prisma/          # Prisma schema, migrations, and generated client
│   │   └── storage/         # Shared S3/MinIO service module
│   └── shared/
│       ├── dto/             # Shared validation schemas (Zod) and TypeScript DTOs
│       └── utils/           # Shared helper functions
├── package.json
└── nx.json
```

---

## 🚀 Getting Started

Follow these steps to run **Receiptify** on your local machine for development.

### 1. Prerequisites
- **Node.js** (v20+ recommended)
- **Docker** & **Docker Compose**
- **npm** or **yarn**

### 2. Environment Variables
Create a `.env` file in the root of the project with the following essential variables:

```env
# Database & Cache
DATABASE_URL="postgresql://user:password@localhost:5432/receiptify?schema=public"
REDIS_HOST="localhost"
REDIS_PORT="6379"

# S3 (MinIO)
MINIO_ENDPOINT="localhost"
MINIO_PORT="9000"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
S3_BUCKET_NAME="receipts"

# AI/OCR Keys
GEMINI_API_KEY="your-gemini-key"
GOOGLE_APPLICATION_CREDENTIALS="/path/to/gcp/key.json"
```

### 3. Start Infrastructure Dependencies
Spin up PostgreSQL, Redis, and MinIO using Docker Compose:
```bash
docker-compose up -d
```

### 4. Database Setup
Deploy Prisma migrations and generate the database client:
```bash
npx prisma migrate dev
npx prisma generate
```

### 5. Start the Services
Run the API and Worker in parallel (thanks to Nx):

**To start the Main API:**
```bash
npx nx serve api
```

**To start the OCR Worker:**
```bash
npx nx serve ocr-worker
```

---

## 🛠 Key Features

* **High-Load Search & Pagination:** Cursor-based ($O(1)$) pagination and PostgreSQL GIN index-powered Full-Text Search ensure lag-free fetching of receipts even with millions of rows.
* **Resilient Job Processing:** Distributed architecture isolates image uploads from heavy AI inferences. Worker services use Exponential Backoff and specific strategies for `HTTP 429` Rate Limits.
* **Idempotent Webhooks & Database:** Ensures no double-crediting or duplicate expense generation during unexpected network re-transmissions.
* **Strict Validation:** Edge-to-edge data integrity provided by `Zod` schemas for API endpoints and internal DB operations.

---

## 👨‍💻 Contributing & CLI Commands

**Adding a new Library:**
```bash
npx nx g @nx/nest:lib libs/features/analytics
```

**Adding a new Service / Controller:**
```bash
npx nx generate @nx/nest:controller src/app/auth/auth.controller --project=api
npx nx generate @nx/nest:service src/app/auth/auth.service --project=api
```

**Run Unit & E2E Tests:**
```bash
npx nx test api
npx nx test ocr-worker
```

<p align="center">Made with ❤️ for elegant backend architectures.</p>
