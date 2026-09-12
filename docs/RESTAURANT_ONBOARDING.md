# TILLORA — RESTAURANT ONBOARDING GUIDE

## 1. Introduction

This guide provides the complete onboarding specification for provisioning a new restaurant organization and branch on the **Tillora Operating System**. Following this standardized process guarantees zero-friction setup without requiring developer intervention.

---

## 2. Onboarding Workflow Overview

```text
1. Organization Setup  ➔  2. Branch Configuration  ➔  3. Floor & Tables  ➔  4. Categories & Menu
         ↓
8. Go-Live Test        ←  7. Tax & Receipt Profile  ←  6. Hardware Bridge  ←  5. Staff Accounts
```

---

## 3. Step-by-Step Configuration Specifications

### Step 1: Organization & Subscription Creation
* **Restaurant / Legal Name:** e.g., *Tillora Pilot Restaurant*
* **Slug:** Unique alphanumeric URL identifier (e.g., `tillora-pilot-restaurant`)
* **Default Currency:** Currency code (e.g. `PKR`, `USD`, `AED`) and symbol (`Rs.`, `$`, `AED`)
* **Timezone:** Standard IANA timezone string (e.g., `Asia/Karachi`, `America/New_York`)
* **SaaS Subscription:** Automatically initialized on the 14-Day Free Trial (or mapped to a paid plan: *STARTER*, *GROWTH*, *BUSINESS*, *ENTERPRISE*).

### Step 2: Multi-Branch & Store Profile
* **Branch Name:** e.g., *Main Branch* or *Downtown Flagship*
* **Physical Address:** Street address, city, postal code.
* **Contact Phone:** Primary store telephone number.
* **Operating Hours:** Weekly schedule for kitchen routing.
* **Service Modes Enabled:**
  * [x] Dine-In
  * [x] Takeaway
  * [x] Delivery

### Step 3: Floor Layout & Table Management
Configure the floor areas and table numbering for dine-in operations:
* **Table Identifiers:** `T01`, `T02`, `T03`, `T04`, `T05`, `T06`, `T07`, `T08`, `T09`, `T10`.
* **Seating Capacities:** 2-tops, 4-tops, 6-tops, and family booth configurations.
* **Floor Assignment:** Main Dining Room, Patio, Mezzanine, VIP Lounge.

### Step 4: Menu Categories, Items & Modifier Groups
1. **Categories:**
   * *Burgers* (Zinger, Beef Gourmet, Crispy Chicken)
   * *Pizza* (Chicken Fajita, Pepperoni, Margherita, BBQ Ranch)
   * *Rice* (Fried Rice, Biryani Platters)
   * *Drinks* (Cold Drinks, Fresh Juices, Smoothies)
   * *Desserts* (Lava Cake, Ice Cream, Brownies)
   * *Deals* (Combo packs, Value meals)
2. **Modifier Groups:**
   * **Add-ons:** Extra Cheese (+Rs. 60), Extra Sauce (+Rs. 40), Jalapeños (+Rs. 30), Bacon/Ham (+Rs. 100).
   * **Sizes:** Small (Base), Medium (+Rs. 300), Large (+Rs. 600).
   * **Spice Levels:** Mild, Medium, Hot, Extra Hot.
3. **Kitchen Routing:**
   * Grill / Fryer Station
   * Pizza Oven Station
   * Beverage & Dessert Bar

### Step 5: Staff Roles & Least-Privilege Access (RBAC)
Create individual user accounts for every staff member (strictly no shared accounts):

| Role | Permitted Actions | Prohibited Actions |
| :--- | :--- | :--- |
| **OWNER** | Full business portal, billing, subscription upgrades, multi-branch analytics, staff creation, financial exports. | Platform-wide super-admin endpoints (`/api/platform-admin/*`). |
| **MANAGER** | Shift oversight, discount approvals, void/refund authorization, petty cash adjustments, pairing code generation. | Billing plan cancellations, tenant database alterations. |
| **CASHIER** | Shift open/close, order taking, cart modifications, payment processing, receipt printing. | Unapproved voids/discounts, platform administration. |
| **WAITER** | Table status view, KOT order punch, modifier selection, order note entry. | Final invoice settlement, drawer kick, refunds. |
| **KITCHEN** | KDS ticket viewing, preparation status toggles (*Preparing*, *Ready*, *Served*). | Order pricing, financial reports, customer database. |

### Step 6: Hardware Bridge & Device Pairing
1. On POS terminal, download/run the **Tillora Local Agent**.
2. Manager clicks **[Generate Pairing Code]** in POS Settings.
3. Enter the generated 6-digit code into the local agent prompt.
4. Terminal receives an authenticated cryptographic token (`br_live_...`) and transitions to `ACTIVE`.
5. Map thermal printers:
   * **Receipt Printer:** Port 9100 TCP / USB ESC/POS.
   * **Cash Drawer:** RJ11/RJ12 drawer kick pulse connector attached to receipt printer.
   * **Kitchen Printer / KDS:** Dedicated LAN IP / Tablet WebSocket client.

### Step 7: Fiscal Tax, Surcharge & Receipt Profile
* **Sales Tax Rate:** Percentage (e.g., `16.0%` standard provincial tax or `8.25%` state tax).
* **Tax Application:** Inclusive vs. Exclusive calculation.
* **Service Charge:** (Optional, e.g. 5.0% for Dine-In only).
* **Receipt Header:** Store name, branch address, tax registration number (NTN/STRN/VAT).
* **Receipt Footer:** Custom message, Wi-Fi password, return policy, barcode/QR code for feedback.

### Step 8: Pre-Flight Certification Run
Before seating first customer, run the dry-run test suite:
* [x] 1 Dine-In Order with Modifier + KOT.
* [x] 1 Takeaway Order with Split Payment.
* [x] 1 Cash-In and 1 Cash-Out Drawer Event.
* [x] Complete shift close with zero cash discrepancy.
