# TILLORA — PILOT OPERATIONAL READINESS MODEL

## 1. Executive Overview

**Tillora — The Operating System for Your Restaurant.**

The Operational Readiness Model defines the standardized, deterministic lifecycle through which a hospitality venue progresses from initial onboarding to a fully certified, live production deployment. This framework bridges automated software engineering certification with real-world operational execution across staff, hardware, and dining rooms.

---

## 2. The 13-Stage Operational Lifecycle

```text
[01. DISCOVERY]
       ↓
[02. RESTAURANT CREATED]
       ↓
[03. BRANCH CONFIGURED]
       ↓
[04. MENU CONFIGURED]
       ↓
[05. STAFF CREATED]
       ↓
[06. HARDWARE CONFIGURED]
       ↓
[07. TRAINING]
       ↓
[08. TEST SERVICE]
       ↓
[09. SOFT PILOT]
       ↓
[10. LIVE PILOT]
       ↓
[11. DAILY RECONCILIATION]
       ↓
[12. PILOT REVIEW]
       ↓
[13. GO / FIX / NO-GO]
```

### Stage Breakdown & Gateways

| Stage | Name | Key Deliverables & Entrance Criteria | Exit / Verification Criteria |
| :--- | :--- | :--- | :--- |
| **01** | **Discovery** | Venue profile, service modes (Dine-in, Takeaway, Delivery), table count, till count, local tax rate, currency, hardware inventory. | Operational requirements document signed off. |
| **02** | **Restaurant Created** | Tenant Organization created in Tillora SaaS platform with 14-day trial / active subscription plan. | Unique `organizationId`, valid JWT issuance, subscription entitlement active. |
| **03** | **Branch Configured** | Branch profile, physical address, contact phone, operating hours, local sales tax rate, receipt headers/footers. | Branch record persisted and accessible via `/api/branches`. |
| **04** | **Menu Configured** | Categories, menu items, modifier groups (sizes, add-ons, spice levels), kitchen station routing, item taxability. | Catalog verified via POS UI; modifier price calculations verified. |
| **05** | **Staff Created** | Multi-role user creation (Owner, Manager, Cashier, Waiter, Kitchen). Unique usernames and high-entropy PINs assigned. | No shared logins; RBAC privilege boundaries validated. |
| **06** | **Hardware Configured** | Local Bridge installed on POS terminal, 6-digit pairing code redeemed, receipt/kitchen thermal printers mapped, cash drawer relay configured. | Device status `ACTIVE`, Socket.IO room joined, test receipt and drawer kick successful. |
| **07** | **Training** | Hands-on staff training according to role-based procedures (`docs/STAFF_TRAINING.md`). | Cashier passes shift open/close quiz; kitchen staff acknowledges KDS ticket updates. |
| **08** | **Test Service** | Dry-run service simulation with dummy orders: Dine-in, Takeaway, Delivery, Modifiers, Split Payments, Cash-in/out, and Shift reconciliation. | 100% order accuracy; cash drawer matches expected balance exactly ($0.00 variance). |
| **09** | **Soft Pilot** | Restricted operational window (e.g. 1 meal period / 20 real transactions) with dedicated on-site observer. | Real receipt printing, card payment settlement, zero critical crash reports. |
| **10** | **Live Pilot** | Full-day operational service under real customer volume across all active tills. | Uninterrupted service; offline fallback handling tested if network flickers. |
| **11** | **Daily Reconciliation** | Shift end physical cash count, denomination tally, cash variance tracking, daily executive sales audit. | Cash drawer expected vs actual balanced; daily summary approved by Owner. |
| **12** | **Pilot Review** | Aggregate 7-day or 14-day operational review: order velocity, uptime, sync stability, staff feedback, incident log review. | Scorecard compiled across all 24 evaluation categories. |
| **13** | **Go / Fix / No-Go** | Formal executive decision meeting evaluating the Go-Live criteria (`docs/GO_LIVE_CHECKLIST.md`). | Unanimous GO or CONDITIONAL GO with remediation plan. |

---

## 3. Operational Measurement Framework

Tillora evaluates operational health using three core telemetry pillars:

### A. Activation Metrics
* Time from Organization creation to first completed test transaction (< 45 minutes).
* Completion rate of the 8 onboarding checklist domains.
* Zero developer intervention required during configuration.

### B. Daily Operational Metrics
* **Order Processing Velocity:** P95 order punch time (< 15 seconds for 5-item order).
* **KOT Dispatch Latency:** < 500ms from POS punch to Kitchen display/printer.
* **Cash Drawer Accuracy:** Physical count variance tolerance ≤ 0.1% of gross cash receipts.
* **Payment Mix Integrity:** Exact balancing of multi-tender split payments (Cash, Card, QR).

### C. Reliability & Safety Metrics
* **Zero Cross-Tenant Leakage:** Absolute cryptographic and database isolation between organizations.
* **Zero Silent Failures:** Offline queueing notifies staff immediately if background sync is pending.
* **Zero Unaccounted Cash:** All cash-in/out events mandate authenticated Manager PIN authorization with immutable audit log trails.
