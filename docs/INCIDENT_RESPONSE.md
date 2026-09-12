# TILLORA — PILOT INCIDENT RESPONSE & SUPPORT WORKFLOW

## 1. Overview

This document outlines the operational support, issue escalation, and emergency recovery protocol for restaurant pilots running on the **Tillora Operating System**.

---

## 2. Severity Classification Matrix

| Level | Severity | Definition & Trigger Criteria | Target Response SLA | Target Resolution SLA |
| :--- | :--- | :--- | :--- | :--- |
| **P0** | **Catastrophic / Blocker** | • Cross-tenant data leak or security isolation failure.<br>• Financial corruption (incorrect arithmetic, lost cash record).<br>• Complete POS outage preventing order placement during service.<br>• Authentication / authorization bypass. | **< 15 Minutes** | **< 2 Hours** |
| **P1** | **Critical Operational** | • Thermal receipt or kitchen printer failure during service.<br>• KDS screen disconnections / missed KOT orders.<br>• Cash drawer pulse hardware failure.<br>• Inability to close active shift or perform cash reconciliation. | **< 30 Minutes** | **< 4 Hours** |
| **P2** | **Major Workable** | • Offline sync delay (orders queue safely but sync is delayed).<br>• Minor reporting aggregation discrepancies in non-critical views.<br>• Customer lookup or loyalty points display latency. | **< 2 Hours** | **< 24 Hours** |
| **P3** | **Minor / Cosmetic** | • UI alignment, typography, or styling glitches.<br>• Non-blocking feature requests.<br>• Minor UX polish suggestions. | **< 8 Hours** | **Next Sprint Release** |

---

## 3. Incident Logging Standard

Every pilot incident must be logged in the pilot issue tracker using the following standardized schema:

```text
Issue ID:           PILOT-INC-2026-001
Restaurant:         Tillora Pilot Restaurant
Branch:             Main Branch (branch_main_01)
Date/Time:          2026-09-12 13:45:00 UTC
Reporter / Role:    Zubair Ahmed (Manager)
Affected Terminal:  POS Counter 01 (dev_pos_counter_01)
Affected Workflow:  Split Payment Checkout
Severity Level:     P1

Reproduction Steps:
1. Open Table T03 with order total Rs. 2,500.
2. Select Split Payment with Tender 1 (Cash: Rs. 1,500) and Tender 2 (Card: Rs. 1,000).
3. Attempt to process payment when card terminal experiences momentary network timeout.

Expected Result:
• POS reports card processing error; cash portion remains uncollected or transaction rolls back cleanly.

Actual Result:
• POS recorded partial order state with unhandled promise rejection in offline queue.

Root Cause Analysis:
• Concurrency race condition between local indexedDB queue write and partial socket emit.

Remediation & Regression Plan:
• Implement atomic transaction rollback on multi-tender failure.
• Add regression test in tests/phase16PilotOperationalReadiness.test.ts.
• Verify build passes cleanly.

Resolution Status: RESOLVED
Verified By:        Lead Engineer
```

---

## 4. Emergency Operational Runbook (Fail-Closed & Offline Recovery)

### Scenario A: Local Internet Outage During Busy Meal Service
1. **Immediate Action:** Do **NOT** panic or restart POS applet. Tillora automatically transitions to **Offline Mode**.
2. **Cashier Operation:** Continue taking cash/card orders. All transactions are written safely to local browser storage (`IndexedDB`).
3. **Receipts & Kitchen:** If Local Bridge is connected to LAN, local ESC/POS thermal printing continues uninterrupted.
4. **Restoration:** Once internet connectivity resumes:
   * Tillora automatically replays queued offline transactions in chronological order.
   * Background sync indicator changes from Yellow (*Pending Sync*) to Green (*Synchronized*).
   * Verify on Manager Portal that all order IDs and shift totals match local drawer count.

### Scenario B: Thermal Receipt Printer Paper Jam / Hardware Disconnect
1. **Immediate Action:** Cashier continues checking out customers; transaction remains safely completed on server.
2. Clear the paper jam or reconnect the USB/LAN cable.
3. Once printer status is restored, navigate to **Order History** ➔ Select the order ➔ Tap **[Reprint Receipt]**.

### Scenario C: Unexpected POS Terminal Crash or Reboot
1. Relaunch Tillora on the terminal.
2. Cashier logs in with PIN.
3. System automatically restores the active shift and reloads all open table states from server cache.
4. Zero orders or cash amounts are lost.
