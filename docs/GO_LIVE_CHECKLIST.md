# TILLORA — GO / NO-GO PILOT CRITERIA & GO-LIVE CHECKLIST

## 1. Executive Decision Framework

Before transitioning any restaurant venue from Onboarding/Testing into a **Live Commercial Pilot**, a formal Go/No-Go evaluation must be conducted.

---

## 2. Decision Matrix

| Verdict | Criteria Required | Operational Implication |
| :--- | :--- | :--- |
| **GO** | • 100% of Mandatory Technical Criteria passed.<br>• 0 open P0 or P1 issues.<br>• Cash reconciliation variance = 0.00% across test service.<br>• Staff passed role-based training.<br>• Physical hardware verified on-site. | Full commercial launch authorized. Live customer orders processed on Tillora. |
| **CONDITIONAL GO** | • 0 open P0 issues.<br>• Only minor P2/P3 cosmetic or non-blocking issues remaining.<br>• Documented manual workaround in place for any minor defect.<br>• Dedicated technical observer present on-site during initial service. | Restricted soft-launch authorized (e.g., 1-2 tills or single meal shift). |
| **NO-GO** | • Any open P0 issue (security, isolation, or financial discrepancy).<br>• Any unresolved double-charging or lost order defect.<br>• Unreliable printer/drawer integration during live service.<br>• Incomplete cashier training. | Live launch strictly blocked. Venue remains in test mode until all blocking issues are resolved. |

---

## 3. Pre-Flight Technical Verification Checklist

### A. Security & Multi-Tenant Isolation
- [x] Dedicated tenant organization and branch established with unique IDs.
- [x] Cashier, Manager, Waiter, and Owner accounts provisioned with individual PINs.
- [x] Zero cross-tenant data leakage verified (IDOR defense confirmed).
- [x] JWT sessions include explicit `organizationId` and `branchId` claims.

### B. Financial Logic & Calculations
- [x] Server-authoritative subtotal, tax, discount, and total calculations verified.
- [x] Half-up rounding tested on odd decimal splits.
- [x] Multi-tender split payment balance checks prevent underpayment or negative balance.
- [x] Shift opening float, cash sales, cash-in, cash-out, and closing expected cash equations verified.

### C. Menu, Tables & Kitchen Routing
- [x] All menu categories, items, and modifier price tiers configured and verified.
- [x] Table floor plan mapped and tested for Dine-In table status transitions.
- [x] KOT dispatch routes correctly to Kitchen Display System (KDS).

### D. Physical Hardware Integration
- [x] POS terminal runs authenticated Local Bridge (`ACTIVE` status).
- [x] Thermal receipt printer feeds, cuts, and prints legible bills on 80mm roll.
- [x] Cash drawer opens automatically upon cash settlement and Manager cash adjustments.
- [x] KDS tablet connects via authenticated WebSocket room.

### E. Offline & Resilience Handling
- [x] POS queues orders locally when internet connection is disconnected.
- [x] System syncs queued transactions without duplicates upon reconnection.
- [x] Zero fallback to default or shared tenant contexts.

---

## 4. Rollback & Emergency Contingency Plan

In the event of an unrecoverable operational failure during live service:
1. **Immediate Fallback:** Manager switches to manual paper order slips or legacy backup POS.
2. **Data Export:** Export all completed shift transaction logs from local browser storage / database backup.
3. **Session Termination:** Manager executes shift close with physical cash count.
4. **Post-Mortem:** Log P0/P1 incident in tracker according to `docs/INCIDENT_RESPONSE.md` and initiate engineering triage.
