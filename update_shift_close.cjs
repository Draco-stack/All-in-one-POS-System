const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

// Update shiftOrders query to use shiftId
const oldOrdersQuery = `    const shiftOrders = await prisma.order.findMany({
      where: {
        organizationId: tenant.organizationId,
        createdAt: { gte: shift.openedAt, lte: closeTime },
        status: { notIn: ['CANCELLED', 'cancelled'] },
      },`;

const newOrdersQuery = `    const shiftOrders = await prisma.order.findMany({
      where: {
        organizationId: tenant.organizationId,
        shiftId: shift.id,
        status: { notIn: ['CANCELLED', 'cancelled'] },
      },`;

code = code.replace(oldOrdersQuery, newOrdersQuery);

const oldReconciliation = `      if (!handledViaSplit) {
        if (String(ord.paymentMethod).toUpperCase() === 'CASH') systemCashSales += orderTotal;
        else systemCardSales += orderTotal;
      }
    }

    const startingFloat = Number(shift.startingFloat) || 0;
    const expectedCashInDrawer = startingFloat + systemCashSales;
    const countedCash = Number(actualCash) || 0;
    const cashVariance = countedCash - expectedCashInDrawer;`;

const newReconciliation = `      if (!handledViaSplit) {
        if (String(ord.paymentMethod).toUpperCase() === 'CASH') systemCashSales += orderTotal;
        else systemCardSales += orderTotal;
      }
    }

    const startingFloat = Number(shift.startingFloat) || 0;
    const currentPettyCash = Number(shift.startingPettyCash) || 0;
    const expectedCashInDrawer = currentPettyCash + systemCashSales;
    const countedCash = Number(actualCash) || 0;
    const cashVariance = countedCash - expectedCashInDrawer;`;

code = code.replace(oldReconciliation, newReconciliation);

fs.writeFileSync('server.ts', code);
