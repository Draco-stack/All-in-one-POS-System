const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const orders = await prisma.order.findMany({
        where: { orderNumber: { startsWith: 'P5-SHIFT' } }
    });
    console.log(orders.map(o => ({ id: o.id, orderNumber: o.orderNumber, shiftId: o.shiftId })));
}
main().catch(console.error);
