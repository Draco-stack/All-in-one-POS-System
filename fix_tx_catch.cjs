const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetTry = `    const result = await prisma.$transaction(async (tx) => {`;
const targetCatch = `    return res.status(200).json(transformOrder(result));
  } catch (error) {`;

code = code.replace(targetTry, `    let result;
    try {
      result = await prisma.$transaction(async (tx) => {`);

code = code.replace(targetCatch, `    } catch (txError: any) {
      if (txError.code === 'P2002' || (txError.message && txError.message.includes('DUPLICATE_IDEMPOTENCY'))) {
        const dupOrder = await prisma.order.findFirst({
           where: { organizationId: tenant.organizationId, idempotencyKey: String(idempotencyKey) },
           include: { customer: true, items: true, assignedRider: true, auditLogs: true },
        });
        if (dupOrder) return res.status(200).json(transformOrder(dupOrder));
      }
      throw txError;
    }
    return res.status(200).json(transformOrder(result));
  } catch (error) {`);

fs.writeFileSync('server.ts', code);
