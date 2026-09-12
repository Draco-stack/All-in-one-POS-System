# TILLORA — RESTAURANT PILOT RUNBOOK

## 1. Scope and Objective

This Runbook provides restaurant managers, cashiers, and on-site support personnel with step-by-step operational workflows for running a real restaurant on the **Tillora Operating System**.

---

## 2. Daily Opening Procedures (30 Minutes Before Opening)

```text
[Power On Hardware] ➔ [Launch Tillora POS] ➔ [Cashier PIN Login] ➔ [Verify Branch & Till] ➔ [Open Shift & Enter Float] ➔ [Test Hardware Bridge & KDS] ➔ [Ready for Service]
```

### Step-by-Step Opening Workflow

1. **Hardware Power & Network Check:**
   * Ensure POS terminal, LAN thermal receipt printer (e.g. 80mm ESC/POS), kitchen printer/KDS screen, and local router are powered on.
   * Verify terminal shows active network indicator (LAN/Wi-Fi).
2. **Launch Tillora POS & Login:**
   * Navigate to Tillora POS entry URL.
   * Input assigned Cashier/Manager PIN (e.g., 4-digit code).
   * Confirm the banner displays the correct **Organization** and **Branch Name**.
3. **Open Register Shift:**
   * Prompt displays: *"No active shift detected. Open shift to begin."*
   * Enter the physical opening cash float (e.g. `Rs. 5,000.00` or `$50.00`).
   * Enter optional shift notes (e.g., *"Morning Shift - Register 01"*).
   * Click **[Open Shift]**. Server authoritatively locks the till to this cashier session.
4. **Pre-Service Hardware Verification:**
   * Navigate to **Settings ➔ Hardware Bridge**.
   * Verify Bridge status is **ONLINE / CONNECTED**.
   * Click **[Test Print]** ➔ Confirm receipt paper feeds cleanly and cuts.
   * Click **[Test Kick]** ➔ Confirm cash drawer relay fires smoothly.
   * Check KDS screen in kitchen ➔ Confirm test ping is received.

---

## 3. Daytime Service Workflows

### A. Dine-In Workflow
1. Tap **[Floor / Tables]** ➔ Select available table (e.g. `T04`). Table status transitions to *Occupied*.
2. Tap Category (e.g. *Burgers*) ➔ Tap Item (e.g. *Zinger Burger*).
3. Modal displays Modifier options:
   * Select Add-ons: *Extra Cheese* (+Rs. 60), *Spicy Sauce* (+Rs. 40).
   * Enter kitchen note: *"Well done, sauce on side"*.
4. Click **[Send KOT]**:
   * Order transmits immediately to Kitchen Display (KDS) & Kitchen Printer.
   * Table shows live order running total.
5. **Adding Additional Items:**
   * Tap Table `T04` ➔ Add items (e.g. *Cold Drink*, *Dessert*) ➔ Click **[Update KOT]**.
   * Only the *new* line items are dispatched to the kitchen.
6. **Settlement & Checkout:**
   * Tap **[Pay / Checkout]**.
   * Review bill: Subtotal, Modifiers, applicable Tax (e.g. 16%), Discounts (if authorized).
   * Select Payment Method: **Cash**, **Card**, or **Split Payment**.
   * If Split: Enter Cash portion (e.g. Rs. 1,000) ➔ Enter Card portion (Rs. 1,000). Remaining balance drops to 0.
   * Click **[Complete Payment & Print Receipt]**.
   * Cash drawer opens automatically for cash transactions; receipt prints.
   * Table `T04` auto-clears to *Available*.

### B. Takeaway Workflow
1. Tap **[Takeaway / Quick Order]**.
2. Optional: Enter Customer Phone number to load loyalty points / name.
3. Add items and modifiers to cart.
4. Tap **[Pay]** ➔ Collect payment ➔ Order number prints on receipt & kitchen slip.
5. When food is ready, cashier calls order number.

### C. Delivery Workflow
1. Tap **[Delivery]** ➔ Input customer name, phone, and delivery address.
2. Select menu items. Standard delivery fee is automatically applied.
3. Order routes to Kitchen with *Delivery* badge.
4. Once marked *Ready* on KDS, assign order to active Rider.
5. Upon rider return, mark order *Delivered & Settled*.

---

## 4. Mid-Shift Cash Drawer Adjustments

All mid-shift cash drawer adjustments require **Manager Authorization**:

* **Cash-In (Pay-In):** Adding extra change to the drawer mid-day.
  1. Click **[Shift Actions ➔ Cash Adjustment]**.
  2. Select Type: **Cash-In**.
  3. Enter Amount & Reason (e.g., *"Added Rs. 2,000 small currency notes"*).
  4. Manager enters authorization PIN.
  5. Drawer expected balance updates dynamically; audit log record created.
* **Cash-Out (Pay-Out / Petty Cash Expense):**
  1. Click **[Shift Actions ➔ Cash Adjustment]**.
  2. Select Type: **Cash-Out**.
  3. Enter Amount & Reason (e.g., *"Paid Rs. 1,000 for ice supply"*).
  4. Manager enters authorization PIN.
  5. Drawer expected balance decreases; audit log record created.

---

## 5. Daily Closing & Cash Reconciliation Procedures

```text
[Stop New Orders] ➔ [Count Physical Cash] ➔ [Input Denominations] ➔ [Close Shift] ➔ [Review Expected vs Actual] ➔ [Print Z-Report] ➔ [Manager Sign-off]
```

1. **Initiate Shift Close:**
   * Ensure all open tables and delivery orders are settled or transferred.
   * Click **[Close Shift]**.
2. **Physical Blind Cash Count:**
   * Cashier counts all physical cash in drawer without looking at system sales totals.
   * Enter denomination breakdown (1000s, 500s, 100s, 50s, 20s, 10s) or total actual cash.
   * Enter retained float amount for tomorrow (e.g., Rs. 5,000).
3. **System Server-Authoritative Calculation:**
   * System calculates expected cash:
     $$\text{Expected Cash} = \text{Starting Float} + \text{Cash Sales} + \text{Cash-In} - \text{Cash-Out}$$
   * System calculates variance:
     $$\text{Variance} = \text{Actual Physical Cash} - \text{Expected Cash}$$
4. **Reconciliation Analysis:**
   * If $\text{Variance} = 0$: Perfect balance.
   * If $\text{Variance} < 0$: Shortage (cashier must supply explanatory note).
   * If $\text{Variance} > 0$: Overage (recorded as surplus).
5. **Print End-of-Day Z-Report:**
   * Thermal printer produces detailed shift report: Gross Sales, Net Sales, Tax Collected, Discount Summary, Payment Method Breakdown, and Shift Variance.
   * Cashier and Manager sign the physical printout and store in safe.
