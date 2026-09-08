import { Order } from '../types';

interface ExportExcelOptions {
  title?: string;
  subTitle?: string;
  reportType?: 'all' | 'rejected' | 'delivered' | 'dispatched' | 'custom';
  orders: Order[];
  filename?: string;
}

/**
 * Generates a structured, beautifully formatted Excel (.xls) file with:
 * 1. Orange/Yellow Top Header Banner with Company Logo/Title
 * 2. Amber Subheader Banner listing included Outlets/Branches
 * 3. Vibrant Pink/Magenta Column Header Row with White Bold Typography
 * 4. Structured Data Rows with Status Badges and Color-coded Reasons
 * 5. Summary Footer Row with Total Revenue, Order Counts & Averages
 */
export const exportToStyledExcel = ({
  title,
  subTitle,
  reportType = 'all',
  orders,
  filename,
}: ExportExcelOptions) => {
  if (!orders || orders.length === 0) {
    alert('No orders available to export.');
    return;
  }

  // Determine Report Title based on type
  const reportTitle =
    title ||
    (reportType === 'rejected'
      ? 'Rejected & Cancelled Order Trend Report'
      : reportType === 'delivered'
      ? 'Delivered Orders Performance Report'
      : 'Comprehensive Restaurant Orders Audit Report');

  // Extract unique branches included
  const branches = Array.from(
    new Set(orders.map((o) => o.branchName || o.outlet || 'Main Branch'))
  );

  const reportSubTitle =
    subTitle ||
    `Section / Branches Included: ${
      branches.length > 0 ? branches.join(', ') : 'All Outlets'
    }`;

  // Generate HTML Table with inline CSS styles supported by Excel
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Order Report</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11pt; }
        .header-table { border-collapse: collapse; width: 100%; margin-bottom: 0px; }
        .banner-header { background-color: #f59e0b; color: #ffffff; font-size: 18pt; font-weight: bold; text-align: center; padding: 12px; height: 45px; vertical-align: middle; }
        .banner-sub { background-color: #fde047; color: #1e293b; font-size: 11pt; font-weight: bold; text-align: center; padding: 8px; height: 30px; vertical-align: middle; border-bottom: 2px solid #e2e8f0; }
        .col-header { background-color: #e91e63; color: #ffffff; font-size: 11pt; font-weight: bold; text-align: center; border: 1px solid #c2185b; padding: 8px; vertical-align: middle; height: 32px; }
        .data-cell { border: 1px solid #d1d5db; padding: 6px 8px; vertical-align: middle; font-size: 10pt; }
        .data-cell-center { text-align: center; border: 1px solid #d1d5db; padding: 6px 8px; vertical-align: middle; font-size: 10pt; }
        .data-cell-right { text-align: right; border: 1px solid #d1d5db; padding: 6px 8px; vertical-align: middle; font-size: 10pt; font-weight: bold; }
        .badge-placed { background-color: #dcfce7; color: #15803d; font-weight: bold; padding: 3px 8px; border-radius: 12px; text-align: center; border: 1px solid #86efac; }
        .badge-cancelled { background-color: #ffe4e6; color: #be123c; font-weight: bold; padding: 3px 8px; border-radius: 12px; text-align: center; border: 1px solid #fca5a5; }
        .badge-kitchen { background-color: #fef3c7; color: #b45309; font-weight: bold; padding: 3px 8px; border-radius: 12px; text-align: center; border: 1px solid #fde68a; }
        .reason-cancelled { color: #dc2626; font-weight: bold; font-style: italic; }
        .footer-summary { background-color: #1e293b; color: #ffffff; font-size: 11pt; font-weight: bold; padding: 10px; border: 1px solid #0f172a; }
      </style>
    </head>
    <body>
      <table className="header-table">
        <!-- TOP HEADER BANNER (Matching image style) -->
        <tr>
          <td colspan="11" class="banner-header" style="background-color: #f59e0b; color: #ffffff; font-size: 18pt; font-weight: bold; text-align: center; height: 50px; vertical-align: middle;">
            MASTER POS - ${reportTitle}
          </td>
        </tr>

        <!-- SUBHEADER BRANCHES BANNER (Matching image style) -->
        <tr>
          <td colspan="11" class="banner-sub" style="background-color: #fde047; color: #0f172a; font-size: 11pt; font-weight: bold; text-align: center; height: 32px; vertical-align: middle; border-bottom: 2px solid #cbd5e1;">
            ${reportSubTitle}
          </td>
        </tr>

        <!-- COLUMN HEADERS (Magenta/Pink matching image style) -->
        <tr style="height: 35px;">
          <th class="col-header" style="background-color: #e91e63; color: #ffffff; font-weight: bold; text-align: center; border: 1px solid #c2185b; width: 60px;">Sr #</th>
          <th class="col-header" style="background-color: #e91e63; color: #ffffff; font-weight: bold; text-align: center; border: 1px solid #c2185b; width: 90px;">Date</th>
          <th class="col-header" style="background-color: #e91e63; color: #ffffff; font-weight: bold; text-align: center; border: 1px solid #c2185b; width: 140px;">Name</th>
          <th class="col-header" style="background-color: #e91e63; color: #ffffff; font-weight: bold; text-align: center; border: 1px solid #c2185b; width: 120px;">Number</th>
          <th class="col-header" style="background-color: #e91e63; color: #ffffff; font-weight: bold; text-align: center; border: 1px solid #c2185b; width: 130px;">Branch</th>
          <th class="col-header" style="background-color: #e91e63; color: #ffffff; font-weight: bold; text-align: center; border: 1px solid #c2185b; width: 100px;">Source</th>
          <th class="col-header" style="background-color: #e91e63; color: #ffffff; font-weight: bold; text-align: center; border: 1px solid #c2185b; width: 100px;">Amount (PKR)</th>
          <th class="col-header" style="background-color: #e91e63; color: #ffffff; font-weight: bold; text-align: center; border: 1px solid #c2185b; width: 130px;">Punched / Staff</th>
          <th class="col-header" style="background-color: #e91e63; color: #ffffff; font-weight: bold; text-align: center; border: 1px solid #c2185b; width: 120px;">Status</th>
          <th class="col-header" style="background-color: #e91e63; color: #ffffff; font-weight: bold; text-align: center; border: 1px solid #c2185b; width: 220px;">Items Summary</th>
          <th class="col-header" style="background-color: #e91e63; color: #ffffff; font-weight: bold; text-align: center; border: 1px solid #c2185b; width: 260px;">Reason / Customer Notes</th>
        </tr>
  `;

  let totalAmount = 0;

  orders.forEach((order, index) => {
    totalAmount += order.total || 0;

    const rawDate = order.createdAt ? new Date(order.createdAt) : new Date();
    const isValidDate = !isNaN(rawDate.getTime());
    const dateObj = isValidDate ? rawDate : new Date();

    // Format Date matching the user's reference report ("6 Sep")
    const dayNum = dateObj.getDate();
    const monthShort = dateObj.toLocaleString('en-US', { month: 'short' });
    const formattedDate = `${dayNum} ${monthShort}`;

    const timeStr = dateObj.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const name = order.customer?.name || 'Walk-in Customer';
    const phone = order.customer?.phone || '03000000000';
    const branch = order.branchName || order.outlet || 'Main Branch';
    const source = order.source || order.sourceChannel || (order.type === 'delivery' ? 'Call' : 'Branch');
    const amount = (order.total || 0).toLocaleString();
    const staff = order.punchedBy || order.cashierName || order.serverName || 'Staff CC';
    const status = (order.status || 'pending').toLowerCase();

    // Format Items List
    const itemsText = order.items
      ? order.items.map((it) => `${it.quantity}x ${it.name}`).join('; ')
      : 'Food Items';

    // Format Reason (Check cancelReason, cancellationReason, refundReason, notes, customer notes)
    let reasonText =
      order.cancelReason ||
      (order as any).cancellationReason ||
      order.refundReason ||
      (order.notes && order.notes.includes('[CANCELLED]:')
        ? order.notes.split('[CANCELLED]:')[1]?.split('|')[0]?.trim()
        : order.notes) ||
      order.customer?.notes ||
      '';

    if (!reasonText || reasonText.trim() === '-' || reasonText.trim() === '') {
      if (status === 'cancelled' || status === 'refunded') {
        reasonText = 'Customer change of mind / Order cancelled';
      } else if (status === 'delivered' || status === 'completed') {
        reasonText = 'Order delivered successfully';
      } else {
        reasonText = '-';
      }
    }

    // Status Badge Style
    let statusStyle = 'background-color: #f3f4f6; color: #374151;';
    let statusLabel = status.toUpperCase();

    if (status === 'delivered' || status === 'completed') {
      statusStyle = 'background-color: #dcfce7; color: #15803d; font-weight: bold;';
      statusLabel = 'Delivered';
    } else if (status === 'cancelled' || status === 'refunded') {
      statusStyle = 'background-color: #ffe4e6; color: #be123c; font-weight: bold;';
      statusLabel = 'Cancelled';
    } else if (status === 'dispatched') {
      statusStyle = 'background-color: #dbeafe; color: #1e40af; font-weight: bold;';
      statusLabel = 'Dispatched';
    } else {
      statusStyle = 'background-color: #fef3c7; color: #b45309; font-weight: bold;';
      statusLabel = 'In Kitchen';
    }

    // Reason Text Style
    const reasonStyle =
      status === 'cancelled' || status === 'refunded'
        ? 'color: #dc2626; font-weight: bold;'
        : 'color: #475569;';

    html += `
      <tr style="height: 28px;">
        <td class="data-cell-center" style="border: 1px solid #d1d5db; text-align: center;">${index + 1}</td>
        <td class="data-cell-center" style="border: 1px solid #d1d5db; text-align: center; font-weight: 600;">${formattedDate}</td>
        <td class="data-cell" style="border: 1px solid #d1d5db; font-weight: bold; color: #0284c7;">${name}</td>
        <td class="data-cell-center" style="border: 1px solid #d1d5db; text-align: center; mso-number-format:'\\@';">${phone}</td>
        <td class="data-cell-center" style="border: 1px solid #d1d5db; text-align: center; font-weight: 600;">${branch}</td>
        <td class="data-cell-center" style="border: 1px solid #d1d5db; text-align: center;">${source}</td>
        <td class="data-cell-right" style="border: 1px solid #d1d5db; text-align: right; font-weight: bold;">${amount}</td>
        <td class="data-cell" style="border: 1px solid #d1d5db;">${staff}</td>
        <td class="data-cell-center" style="border: 1px solid #d1d5db; text-align: center; ${statusStyle}">${statusLabel}</td>
        <td class="data-cell" style="border: 1px solid #d1d5db; font-size: 9.5pt;">${itemsText}</td>
        <td class="data-cell" style="border: 1px solid #d1d5db; ${reasonStyle}">${reasonText}</td>
      </tr>
    `;
  });

  // Footer Summary Statistics Row
  html += `
        <!-- SUMMARY FOOTER ROW -->
        <tr style="height: 35px;">
          <td colspan="6" style="background-color: #0f172a; color: #ffffff; font-size: 11pt; font-weight: bold; text-align: right; padding: 8px; border: 1px solid #020617;">
            TOTAL AUDITED ORDERS: ${orders.length} | COMBINED REVENUE:
          </td>
          <td style="background-color: #0f172a; color: #4ade80; font-size: 12pt; font-weight: bold; text-align: right; padding: 8px; border: 1px solid #020617;">
            PKR ${totalAmount.toLocaleString()}
          </td>
          <td colspan="4" style="background-color: #0f172a; color: #94a3b8; font-size: 10pt; font-weight: bold; text-align: center; padding: 8px; border: 1px solid #020617;">
            Generated on ${new Date().toLocaleString()} | MASTER POS
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  // Create Blob & Trigger Download
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  const dateStamp = new Date().toISOString().split('T')[0];
  const actualFilename = filename || `Whites_Technologies_Order_Trend_Report_${dateStamp}.xls`;

  downloadLink.href = url;
  downloadLink.download = actualFilename;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
};
