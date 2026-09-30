# Clarion OmniAI — Backend REST API & Intelligence Engine

> Explainable Intelligent Document Processing (IDP) & Procurement Analytics Backend

---

## 🌟 Overview
Clarion OmniAI Backend is an explainable document intelligence platform specializing in Accounts Payable and Procurement automation. It transforms business documents into auditable, validated, and structured records.

### Key Architecture & Capabilities
* **Three-Layer Trust Pipeline**:
  * **Layer 1 (AI & Spatial OCR)**: Token extraction, spatial bounding box coordinates (`{x, y, width, height}`), and calibrated confidence scores.
  * **Layer 2 (Deterministic Validation)**: Arithmetic equations ($\text{subtotal} + \text{tax} = \text{total}$), Indian GSTIN checksums, date chronology, and 2-way/3-way PO matching.
  * **Layer 3 (Decision Engine)**: Automatic approval for clean documents, with intelligent escalation to Human Review when thresholds or business rules flag uncertainty.
* **Supabase Integration**: Supabase Auth (primary authority for credentials and JWT sessions) and Supabase Storage for private document files.
* **Deterministic Matching**: Detects PO item variances, price markups, and exact or business-key duplicates.
* **Source-Grounded AI Assistant**: Strict zero-hallucination assistant with page and snippet citations.
* **Non-Destructive Versioning**: Maintains Version 1 (AI extraction) and Version 2 (Human reviewer correction) with full audit trails.

---

## 🛠️ Tech Stack
* **Runtime**: Node.js + Express.js (TypeScript)
* **Authentication**: Supabase Auth + JWT
* **Validation**: Zod & Deterministic Business Rules
* **Database**: Supabase PostgreSQL + pgvector (with zero-setup DataStore fallback)
* **Queue**: BullMQ + Redis (with resilient in-memory worker fallback)
* **Testing**: Jest + Supertest

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are configured.

### 3. Run Development Server
```bash
npm run dev
```
The server will start on `http://localhost:5000` (Health Check: `http://localhost:5000/health`).

### 4. Run Automated Tests
```bash
npm test
```
