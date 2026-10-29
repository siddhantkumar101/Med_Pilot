# Med_Pilot — Production-Grade Multi-Tenant Hospital Patient Management Platform

[![Tech Stack](https://img.shields.io/badge/Architecture-Clean%20Layered%20%2B%20Microservices-blue)](#tech-stack)
[![Multitenancy](https://img.shields.io/badge/Multitenancy-Row--Level%20Isolation-green)](#multitenancy-strategy)
[![Real-Time](https://img.shields.io/badge/Real--Time-WebSocket%20%2B%20Redis-red)](#real-time-opd-engine)

> **Med_Pilot** is a full-stack, multi-tenant healthcare operations platform designed to solve systemic inefficiencies across Indian hospitals and clinics — including 4-6 hour OPD wait times, scattered patient histories, doctor data-blindness, and lack of post-discharge follow-ups.

---

## 📌 Executive Summary & Real-World Impact

India has approximately **1.3 doctors per 1,000 people**, far below the WHO recommendation. Overloaded doctors and chaotic OPD lines lead to compromised patient outcomes not due to medical gaps, but due to broken logistical workflows.

Med_Pilot addresses four core operational bottlenecks:
1. **OPD Queue Congestion**: Eliminates physical lines with a live digital token engine powered by Redis sorted sets and WebSocket push updates.
2. **Scattered Patient Records**: Consolidates past visit histories, diagnostic records, allergies, and digital prescriptions into an unified timeline.
3. **Doctor Cognitive Load & Data-Blindness**: Uses Claude AI to synthesize a 3-sentence clinical summary of a patient's last 5 visits, active medications, and allergies right before they walk into the consultation chamber.
4. **Zero Post-Discharge Engagement**: Automates SMS follow-up reminders via asynchronous job queues (BullMQ + Twilio/SMS Gateway).

---

## 🏛️ System Architecture

Med_Pilot uses a four-tier architecture designed for horizontal scalability, sub-millisecond queue lookups, and multi-tenant data isolation:

```
                            [ Client Portals (Next.js 14) ]
                               (Patient | Doctor | Admin)
                                           │
                              HTTPS (443) / WSS (WebSocket)
                                           ▼
                             ┌───────────────────────────┐
                             │    Nginx (Reverse Proxy)  │
                             │  - SSL Termination        │
                             │  - Subdomain Extraction   │
                             │  - WebSocket Upgrade      │
                             └─────────────┬─────────────┘
                                           │
              ┌────────────────────────────┴────────────────────────────┐
              │ (Route: /*)                                             │ (Route: /api/* & /socket.io/*)
              ▼                                                         ▼
     ┌───────────────────┐                                     ┌─────────────────────────┐
     │  Next.js 14 (SSR) │                                     │  Express.js API Engine  │
     │  - App Router     │ ─── [Client-side API via JWT] ─────▶│  - Tenant Middleware    │
     │  - shadcn/ui      │                                     │  - RBAC & Rate Limiting │
     │  - Dynamic Themes │                                     │  - Socket.io Server     │
     └───────────────────┘                                     └────────────┬────────────┘
                                                                            │
                ┌───────────────────────────────────────────────────────────┴────────────────┐
                ▼                                                                            ▼
     ┌──────────────────────────────┐                                            ┌───────────────────────┐
     │       Redis Cluster          │                                            │    MongoDB Cluster    │
     │ - Tenant-Scoped OPD Queues   │                                            │ - Unified History     │
     │ - In-Memory Current Token    │                                            │ - Compound Tenant Idx │
     │ - AI Summary Cache (1h TTL)  │                                            │ - Prescriptions & EHR │
     │ - Session Refresh Tokens     │                                            └───────────────────────┘
     │ - BullMQ Job Store           │
     └──────────────┬───────────────┘
                    │
                    ▼
     ┌──────────────────────────────┐
     │    BullMQ Background Worker  │ ──▶ Twilio / SMS Gateway (Async Reminders)
     └──────────────────────────────┘
                    ▲
                    │
     ┌──────────────────────────────┐
     │  Anthropic Claude API (AI)   │ (Pre-consultation 3-sentence clinical summaries)
     └──────────────────────────────┘
```

---

## 🏢 Multitenancy Strategy (Row-Level Isolation)

Med_Pilot serves multiple healthcare networks (e.g., Apollo, Fortis, Max) on a single infrastructure:

* **Subdomain Extraction**: Nginx identifies the incoming subdomain (e.g. `apollo.medpilot.com`) and passes `X-Tenant-ID: apollo`.
* **Zero Cross-Tenant Leakage**:
  * Every document includes an indexed `tenantId` field.
  * Express `tenantMiddleware` caches tenant state in Redis.
  * Auth guard performs a mandatory cross-check between `req.tenant` and `jwt.tenantId`.
* **Tenant-Scoped Redis Data**:
  ```
  apollo:queue:dr123:current
  fortis:queue:dr456:current
  apollo:aisummary:patient99
  ```

---

## 🛠️ Tech Stack & Justifications

| Layer | Technology | Justification |
| :--- | :--- | :--- |
| **Frontend** | **Next.js 14 (App Router)** | Server-side rendering (SSR) for instant first-paint on low-bandwidth networks; isolated layout-level routing. |
| **UI Library** | **shadcn/ui + TailwindCSS** | Accessible, headless Radix primitives copied directly into the project; dynamic CSS variables for tenant branding. |
| **Backend API** | **Express.js (TypeScript)** | Clean separation of concerns, robust middleware chaining (Helmet, CORS, Rate-Limiting), independent horizontal scaling. |
| **Primary DB** | **MongoDB (Mongoose)** | Document model matches patient health records (embedded vitals, prescriptions, timeline arrays without N-table joins). |
| **Cache & Queue** | **Redis (ioredis)** | Sub-millisecond reads for live OPD queue state, session tokens, and temporary AI summary caching. |
| **Real-time** | **Socket.io** | Bidirectional TCP communication organized into doctor-specific rooms with automatic fallback to polling. |
| **Async Jobs** | **BullMQ** | Reliable scheduling of 24h pre-appointment and follow-up SMS reminders without blocking REST threads. |
| **AI Integration** | **Claude 3.5 Sonnet** | Synthesizes complex clinical histories into strict 3-sentence pre-consultation briefings. |
| **Reverse Proxy** | **Nginx** | Single point of ingress, SSL termination, path-based routing, and WebSocket proxying. |

---

## 👥 Three Role-Based Portals

### 1. Patient Portal
- Register, authenticate, and manage family medical profiles.
- Book appointment slots with available doctors.
- Real-time OPD screen displaying **"Now Calling"** token, estimated wait time, and user token.
- Access complete medical history, lab records, and downloadable PDF prescriptions.

### 2. Doctor Portal
- Daily chronological appointment queue view.
- AI-synthesized 3-sentence pre-consultation patient briefs (medications, allergies, last visit).
- Digital prescription writer (medicines, dosage frequency, diagnosis notes).
- One-click token advance that triggers real-time queue shifts for waiting patients.

### 3. Hospital Admin Portal
- Doctor management and OPD schedule configuration.
- Real-time hospital-wide OPD queue monitor across all departments.
- Manual queue override (pause, skip, emergency injection).
- System health monitors (Redis ping, active WebSocket connections, MongoDB metrics).

---

## 🚀 Branching Model & Development Roadmap

We adopt the **Git-Flow** model (`main` ➔ `develop` ➔ `feat/...`):

* `feat/server-core-multitenancy`: Express + TypeScript, MongoDB connection, Redis client, Tenant model & middleware.
* `feat/auth-rbac`: Multi-role JWT authentication, password hashing, and role guard.
* `feat/appointments-slots`: Doctor scheduling engine, slot generator, booking endpoints.
* `feat/opd-queue-redis-socket`: Redis sorted set queue operations and Socket.io broadcasts.
* `feat/prescriptions-ai-sms`: Prescription pipeline, Claude AI caching, and BullMQ worker.
* `feat/frontend-portals`: Next.js 14 dashboards with shadcn/ui and real-time client sockets.

---

## 📄 License
This project is licensed under the MIT License.
