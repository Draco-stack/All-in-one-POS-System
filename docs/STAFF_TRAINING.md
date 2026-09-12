# TILLORA — STAFF TRAINING MANUAL

## 1. Overview

This manual provides role-specific, hands-on training syllabi for restaurant staff. Every procedure reflects actual UI workflows in the **Tillora Operating System**.

---

## 2. Cashier Training Syllabus (Duration: 30 Minutes)

### Module 1: Starting Your Day (Opening the Shift)
1. Enter your 4-digit PIN on the login screen.
2. The screen will state: *"No active shift found."*
3. Count the cash in your drawer (your starting float, e.g., Rs. 5,000).
4. Type `5000` in the Starting Float field and press **[Open Shift]**.
5. Your register is now live and locked to your session.

### Module 2: Punching Quick Orders (Takeaway)
1. Tap on category tabs (e.g. *Burgers*, *Deals*).
2. Tap the item image or title.
3. If an item has modifiers (e.g. Extra Cheese), select options in the popup and click **[Add to Order]**.
4. To adjust quantities, tap `+` or `-` on the right-hand cart panel.
5. Tap **[Pay]** ➔ Tap **[Cash]** ➔ Enter tendered cash (e.g., Rs. 1,000).
6. The system calculates exact change.
7. Click **[Complete]** ➔ Drawer kicks open ➔ Hand change and printed receipt to customer.

### Module 3: Handling Split Payments
1. Customer requests to pay Rs. 1,000 in Cash and Rs. 500 via Card.
2. Tap **[Pay]** ➔ Tap **[Split Payment]**.
3. Under *Tender 1*, select **Cash** and enter `1000`.
4. Under *Tender 2*, select **Card** and enter `500`.
5. Verify the *Remaining Balance* indicates `0.00`.
6. Click **[Process Payment]**.

### Module 4: Closing Shift & Daily Reconciliation
1. At the end of your shift, click **[Close Shift]**.
2. Count all cash, coins, and checks currently in the drawer.
3. Enter the counted total in the *Actual Cash* field.
4. The system compares your counted cash against the expected cash.
5. Enter any variance notes if prompted.
6. Click **[Confirm & Close Shift]**.
7. Hand the printed shift summary slip to your manager.

---

## 3. Waiter Training Syllabus (Duration: 20 Minutes)

### Module 1: Seating Tables & Opening Bills
1. Log in with your Waiter PIN.
2. Tap the **[Floor Layout]** icon.
3. Tap an empty table (e.g., `T02` - Green).
4. Table turns Blue (*Occupied*) and opens the live ordering canvas.

### Module 2: Taking Orders & Sending KOTs (Kitchen Order Tickets)
1. Select items ordered by the guests.
2. Tap on item to add special kitchen instructions (e.g., *"No onions"*, *"Allergy alert: No nuts"*).
3. Tap **[Send to Kitchen / KOT]**.
4. A green confirmation badge appears: *"KOT Dispatched to Kitchen"*.

### Module 3: Adding Extra Rounds of Drinks or Food
1. Tap the occupied table `T02`.
2. Add the extra items (e.g. *Dessert* or *Second drink*).
3. Tap **[Update KOT]**.
4. The kitchen receives only the new items, with ticket header noting *"Add-on Order - Table T02"*.

---

## 4. Kitchen / KDS Staff Training Syllabus (Duration: 15 Minutes)

### Module 1: Reading the Kitchen Display System (KDS)
1. The KDS screen auto-updates in real time as orders arrive.
2. Each order card shows:
   * Table Number (or *Takeaway* / *Delivery*)
   * Elapsed preparation timer (Turns Yellow after 10 mins, Red after 15 mins)
   * Line items with bold modifier badges (e.g. **+EXTRA CHEESE**, **NO ONIONS**)
   * Kitchen notes

### Module 2: Order Status Lifecycle
* **Incoming (New):** Card flashes with sound alert.
* **Tap [Start Preparing]:** Status turns Yellow. Informs floor staff that cooking is underway.
* **Tap [Mark Ready]:** Status turns Green. Floor staff and runners are alerted that food is ready for pickup.
* **Tap [Dismiss / Served]:** Order is cleared from the active cooking grid.

---

## 5. Restaurant Manager Training Syllabus (Duration: 45 Minutes)

### Module 1: Void & Discount Approvals
* Cashiers cannot apply discounts or void placed orders without Manager Authorization.
* When a discount or void is requested on POS:
  1. Manager enters their 4-digit PIN.
  2. Select predefined discount reason (e.g., *Staff Meal 20%*, *Manager Discretion 10%*).
  3. Every override is immutably recorded in the central **Audit Log**.

### Module 2: Petty Cash & Cash Adjustments
* If extra cash is needed in the drawer:
  * Open POS menu ➔ **[Cash Adjustment]** ➔ **[Cash-In]** ➔ Enter amount and reason.
* If paying cash for emergency supplies (e.g. fresh lemons, ice delivery):
  * Open POS menu ➔ **[Cash Adjustment]** ➔ **[Cash-Out]** ➔ Enter amount and reason.

### Module 3: Reviewing Daily Shift Z-Reports
* Review end-of-shift cash variances.
* Investigate shortages/overages exceeding acceptable thresholds (> 0.1%).
* Sign off on cashier shift slips.

---

## 6. Restaurant Owner Training Syllabus (Duration: 30 Minutes)

### Module 1: Business Overview Dashboard
* Access `https://your-domain.com/portal` from any laptop, tablet, or phone.
* View live KPIs: Gross Revenue, Net Revenue, Today's Order Count, Average Order Value (AOV), and Top-Selling Items.

### Module 2: Multi-Branch & Staff Management
* View sales across all branches in real-time.
* Add or deactivate staff members instantly with zero downtime.
* Update prices and categories across branch menus.

### Module 3: Subscription & Billing
* Monitor remaining trial days or subscription tier entitlements.
* Upgrade or renew plans directly via the Customer Portal with instant access restoration.
