# Admin Financial Summary Reports Feature
- Added `DailyFinancialSummaryThermal.tsx`.
- Integrated to existing AdminReportsAnalytics "Print PDF" action.
- Uses `window.print()` targeting a hidden printable 80mm div.
- Aggregates daily orders, calculating gross sales, discounts, cogs, payment breakdowns, and audits shifts dynamically.
