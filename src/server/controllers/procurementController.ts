import { Request, Response } from 'express';
import prisma from '../prisma';
import { z } from 'zod';

// Zod schemas for procurement
const poItemSchema = z.object({
  ingredientId: z.string(),
  orderedQuantity: z.number().positive(),
  purchaseUnit: z.string().min(1),
  conversionRatio: z.number().positive(),
  unitCost: z.number().nonnegative(),
  notes: z.string().optional().nullable()
});

const createPoSchema = z.object({
  vendorId: z.string(),
  branchId: z.string().optional().nullable(),
  expectedDeliveryDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(poItemSchema).min(1)
});

const updatePoSchema = createPoSchema.partial();

const receiptItemSchema = z.object({
  purchaseOrderItemId: z.string(),
  receivedQuantity: z.number().nonnegative(),
  rejectedQuantity: z.number().nonnegative(),
  batchNumber: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

const createReceiptSchema = z.object({
  notes: z.string().optional().nullable(),
  invoiceReference: z.string().optional().nullable(),
  items: z.array(receiptItemSchema).min(1)
});

// Helper for generating PO numbers (e.g. PO-ORGID-TIMESTAMP)
function generatePoNumber(orgId: string): string {
  const shortOrg = orgId.substring(0, 4).toUpperCase();
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `PO-${shortOrg}-${timestamp}-${random}`;
}

function generateReceiptNumber(orgId: string): string {
  const shortOrg = orgId.substring(0, 4).toUpperCase();
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `RCPT-${shortOrg}-${timestamp}-${random}`;
}

export async function createPurchaseOrder(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId;
    if (!organizationId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const data = createPoSchema.parse(req.body);

    // Validate vendor
    const vendor = await prisma.vendor.findFirst({
      where: { id: data.vendorId, organizationId, active: true }
    });
    if (!vendor) return res.status(404).json({ error: 'Vendor not found or inactive' });

    // Validate branch if provided
    if (data.branchId) {
       // Validate branch authorization logic
       if (req.tenant.role !== 'OWNER' && req.tenant.role !== 'ADMIN' && req.tenant.branchId !== data.branchId) {
          return res.status(403).json({ error: 'Not authorized for this branch' });
       }
    }

    // Validate ingredients
    const ingredientIds = data.items.map(i => i.ingredientId);
    const ingredients = await prisma.ingredient.findMany({
      where: { id: { in: ingredientIds }, organizationId }
    });
    
    if (ingredients.length !== ingredientIds.length) {
       return res.status(400).json({ error: 'One or more ingredients are invalid or belong to another organization' });
    }

    let total = 0;
    const poItemsInput = data.items.map(item => {
      const normalizedQuantity = item.orderedQuantity * item.conversionRatio;
      const totalCost = item.orderedQuantity * item.unitCost;
      total += totalCost;
      return {
        ingredientId: item.ingredientId,
        orderedQuantity: item.orderedQuantity,
        remainingQuantity: item.orderedQuantity,
        purchaseUnit: item.purchaseUnit,
        conversionRatio: item.conversionRatio,
        normalizedQuantity,
        unitCost: item.unitCost,
        totalCost,
        notes: item.notes
      };
    });

    const poNumber = generatePoNumber(organizationId);

    const po = await prisma.purchaseOrder.create({
      data: {
        organizationId,
        branchId: data.branchId || null,
        vendorId: data.vendorId,
        poNumber,
        status: 'DRAFT',
        expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
        notes: data.notes,
        subtotal: total,
        total: total,
        createdById: userId,
        items: {
          create: poItemsInput
        }
      },
      include: {
        items: true,
        vendor: true
      }
    });

    // We should probably log audit, but we'll keep it simple for now or add it later

    return res.json({ success: true, data: po });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('[ProcurementController] createPurchaseOrder error:', error);
    return res.status(500).json({ error: 'Failed to create purchase order' });
  }
}

export async function getPurchaseOrders(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const branchId = req.tenant?.branchId;
    const role = req.tenant?.role;
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });

    let whereClause: any = { organizationId };
    if (role !== 'OWNER' && role !== 'ADMIN' && branchId) {
      whereClause.OR = [
        { branchId },
        { branchId: null }
      ];
    }

    const pos = await prisma.purchaseOrder.findMany({
      where: whereClause,
      include: {
        vendor: true,
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ success: true, data: pos });
  } catch (error: any) {
    console.error('[ProcurementController] getPurchaseOrders error:', error);
    return res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
}

export async function getPurchaseOrder(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const { id } = req.params;
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });

    const po = await prisma.purchaseOrder.findFirst({
      where: { id, organizationId },
      include: {
        vendor: true,
        items: {
          include: { ingredient: true }
        },
        receipts: {
          include: { items: true, receivedBy: { select: { name: true } } }
        },
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } }
      }
    });

    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    
    // Branch check
    const role = req.tenant?.role;
    const branchId = req.tenant?.branchId;
    if (role !== 'OWNER' && role !== 'ADMIN' && branchId) {
       if (po.branchId && po.branchId !== branchId) {
           return res.status(403).json({ error: 'Not authorized to view this branch PO' });
       }
    }

    return res.json({ success: true, data: po });
  } catch (error: any) {
    console.error('[ProcurementController] getPurchaseOrder error:', error);
    return res.status(500).json({ error: 'Failed to fetch purchase order' });
  }
}

export async function submitPurchaseOrder(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const { id } = req.params;
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });

    const po = await prisma.purchaseOrder.findFirst({ where: { id, organizationId } });
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    if (po.status !== 'DRAFT') return res.status(400).json({ error: 'Only DRAFT POs can be submitted' });

    // Branch check
    if (req.tenant?.role !== 'OWNER' && req.tenant?.role !== 'ADMIN' && req.tenant?.branchId) {
      if (po.branchId && po.branchId !== req.tenant.branchId) {
        return res.status(403).json({ error: 'Not authorized for this branch' });
      }
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'SUBMITTED' }
    });

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[ProcurementController] submitPurchaseOrder error:', error);
    return res.status(500).json({ error: 'Failed to submit purchase order' });
  }
}

export async function approvePurchaseOrder(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId;
    const role = req.tenant?.role;
    const { id } = req.params;
    if (!organizationId || !userId) return res.status(401).json({ error: 'Unauthorized' });
    if (role !== 'OWNER' && role !== 'ADMIN' && role !== 'MANAGER') {
       return res.status(403).json({ error: 'Only managers and owners can approve POs' });
    }

    const po = await prisma.purchaseOrder.findFirst({ where: { id, organizationId } });
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    if (po.status !== 'SUBMITTED') return res.status(400).json({ error: 'Only SUBMITTED POs can be approved' });

    // Branch check
    if (role !== 'OWNER' && role !== 'ADMIN' && req.tenant?.branchId) {
      if (po.branchId && po.branchId !== req.tenant.branchId) {
        return res.status(403).json({ error: 'Not authorized for this branch' });
      }
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { 
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date()
      }
    });

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[ProcurementController] approvePurchaseOrder error:', error);
    return res.status(500).json({ error: 'Failed to approve purchase order' });
  }
}


export async function createGoodsReceipt(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId;
    const { purchaseOrderId, items, notes, invoiceReference } = req.body;
    
    if (!organizationId || !userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!purchaseOrderId) return res.status(400).json({ error: 'Purchase Order ID required' });

    // Validate PO
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, organizationId },
      include: { items: true }
    });
    
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    if (po.status !== 'APPROVED' && po.status !== 'PARTIALLY_RECEIVED') {
      return res.status(400).json({ error: 'Cannot receive goods for this PO status' });
    }

    // Branch check
    if (req.tenant?.role !== 'OWNER' && req.tenant?.role !== 'ADMIN' && req.tenant?.branchId) {
      if (po.branchId && po.branchId !== req.tenant.branchId) {
        return res.status(403).json({ error: 'Not authorized for this branch PO' });
      }
    }

    const receiptNumber = generateReceiptNumber(organizationId);

    // Calculate accepted quantities and map items
    let totalCost = 0;
    const receiptItemsInput = [];

    for (const item of items) {
      const poItem = po.items.find(i => i.id === item.purchaseOrderItemId);
      if (!poItem) return res.status(400).json({ error: `PO Item ${item.purchaseOrderItemId} not found in this PO` });

      const acceptedQty = item.receivedQuantity - (item.rejectedQuantity || 0);
      if (acceptedQty < 0) return res.status(400).json({ error: 'Accepted quantity cannot be negative' });

      // Calculate cost based on accepted quantity and PO unit cost
      const itemCost = acceptedQty * poItem.unitCost;
      totalCost += itemCost;

      receiptItemsInput.push({
        purchaseOrderItemId: poItem.id,
        ingredientId: poItem.ingredientId,
        orderedQuantity: poItem.orderedQuantity,
        receivedQuantity: item.receivedQuantity,
        rejectedQuantity: item.rejectedQuantity || 0,
        acceptedQuantity: acceptedQty,
        purchaseUnit: poItem.purchaseUnit,
        conversionRatio: poItem.conversionRatio,
        normalizedAcceptedQty: acceptedQty * poItem.conversionRatio,
        unitCost: poItem.unitCost,
        totalCost: itemCost,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
        notes: item.notes
      });
    }

    const receipt = await prisma.goodsReceipt.create({
      data: {
        organizationId,
        branchId: po.branchId,
        vendorId: po.vendorId,
        purchaseOrderId: po.id,
        receiptNumber,
        status: 'DRAFT',
        notes,
        invoiceReference,
        totalCost,
        items: {
          create: receiptItemsInput
        }
      },
      include: {
        items: true
      }
    });

    return res.json({ success: true, data: receipt });

  } catch (error: any) {
    console.error('[ProcurementController] createGoodsReceipt error:', error);
    return res.status(500).json({ error: 'Failed to create goods receipt' });
  }
}

export async function finalizeGoodsReceipt(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId;
    const { id } = req.params;
    
    if (!organizationId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    // Validate receipt
    const receipt = await prisma.goodsReceipt.findFirst({
      where: { id, organizationId },
      include: { 
        items: {
          include: { ingredient: true }
        },
        purchaseOrder: {
          include: { items: true }
        }
      }
    });

    if (!receipt) return res.status(404).json({ error: 'Goods receipt not found' });
    if (receipt.status === 'FINALIZED' || receipt.inventoryPosted) {
      return res.status(400).json({ error: 'Goods receipt already finalized' });
    }

    // Branch check
    if (req.tenant?.role !== 'OWNER' && req.tenant?.role !== 'ADMIN' && req.tenant?.branchId) {
      if (receipt.branchId && receipt.branchId !== req.tenant.branchId) {
        return res.status(403).json({ error: 'Not authorized for this branch receipt' });
      }
    }

    // Prepare exactly-once operations
    const operations = [];

    // 1. Lock/update the Goods Receipt to FINALIZED
    operations.push(prisma.goodsReceipt.update({
      where: { 
        id,
        status: 'DRAFT', // concurrency safety check
        inventoryPosted: false // concurrency safety check
      },
      data: {
        status: 'FINALIZED',
        inventoryPosted: true,
        inventoryPostedAt: new Date(),
        receivedById: userId,
        receivedAt: new Date()
      }
    }));

    // 2. Update PO status & item remaining quantities
    let allItemsReceived = true;
    for (const poItem of receipt.purchaseOrder.items) {
      const receiptItem = receipt.items.find(ri => ri.purchaseOrderItemId === poItem.id);
      let newReceivedQty = poItem.receivedQuantity;
      let newRejectedQty = poItem.rejectedQuantity;
      let newRemainingQty = poItem.remainingQuantity;

      if (receiptItem) {
        newReceivedQty += receiptItem.receivedQuantity;
        newRejectedQty += receiptItem.rejectedQuantity;
        newRemainingQty = Math.max(0, poItem.remainingQuantity - receiptItem.acceptedQuantity);
      }

      if (newRemainingQty > 0) {
        allItemsReceived = false;
      }

      if (receiptItem) {
        operations.push(prisma.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: {
            receivedQuantity: newReceivedQty,
            rejectedQuantity: newRejectedQty,
            remainingQuantity: newRemainingQty
          }
        }));
      }
    }

    operations.push(prisma.purchaseOrder.update({
      where: { id: receipt.purchaseOrderId },
      data: {
        status: allItemsReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED'
      }
    }));

    // 3. Post to Inventory Ledger
    for (const item of receipt.items) {
      if (item.acceptedQuantity <= 0) continue;

      const delta = item.normalizedAcceptedQty;
      const ingredient = item.ingredient;
      const prevStock = ingredient.currentStock;
      const newStock = prevStock + delta;
      
      // We will also update the average cost per base unit based on standard weighted average cost formula
      // New Cost = ((Old Stock * Old Cost) + (New Received * New Cost)) / (Old Stock + New Received)
      // costPerBaseUnit is updated, costPerPurchaseUnit can just be mathematically updated if it relies on conversion ratio
      
      const prevTotalValue = prevStock * ingredient.costPerBaseUnit;
      const newReceivedValue = item.normalizedAcceptedQty * (item.unitCost / item.conversionRatio); // unitCost is per purchase unit
      let newCostPerBaseUnit = ingredient.costPerBaseUnit;
      
      if (newStock > 0) {
        newCostPerBaseUnit = (prevTotalValue + newReceivedValue) / newStock;
      } else {
        newCostPerBaseUnit = item.unitCost / item.conversionRatio; // Fallback to new cost
      }
      
      const newCostPerPurchaseUnit = newCostPerBaseUnit * ingredient.conversionRatio;

      operations.push(prisma.ingredient.update({
        where: { id: ingredient.id },
        data: { 
          currentStock: { increment: delta },
          costPerBaseUnit: newCostPerBaseUnit,
          costPerPurchaseUnit: newCostPerPurchaseUnit
        }
      }));

      operations.push(prisma.stockMovement.create({
        data: {
          organizationId: receipt.organizationId,
          branchId: receipt.branchId || ingredient.branchId,
          ingredientId: ingredient.id,
          quantityDelta: delta,
          unit: ingredient.baseUnit,
          previousStock: prevStock, // note: in a parallel transaction, prevStock here could be slightly stale, but the ledger records the intent. Using { increment: delta } above is safe.
          newStock: newStock, // similarly, newStock is a snapshot.
          costBasis: item.unitCost / item.conversionRatio,
          movementType: 'PURCHASE',
          referenceType: 'GOODS_RECEIPT',
          referenceId: receipt.id,
          reason: `Goods receipt from PO ${receipt.purchaseOrder.poNumber}`,
          actorId: userId,
          actorName: req.tenant?.name || 'Portal User'
        }
      }));
    }

    try {
      await prisma.$transaction(operations);
    } catch (err: any) {
      // Catch transaction failures (e.g. concurrency RecordNotFound)
      if (err.code === 'P2025') {
        return res.status(409).json({ error: 'Receipt has already been finalized or is no longer in DRAFT status' });
      }
      throw err;
    }

    return res.json({ success: true, message: 'Goods receipt finalized and inventory posted' });
  } catch (error: any) {
    console.error('[ProcurementController] finalizeGoodsReceipt error:', error);
    return res.status(500).json({ error: 'Failed to finalize goods receipt' });
  }
}
