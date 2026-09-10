import sys

with open('src/server/controllers/billingController.ts', 'r') as f:
    content = f.read()

new_webhook = """
export async function webhookHandler(req: Request, res: Response) {
  try {
    const signature = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret || !signature) {
      return res.status(400).json({ error: 'Missing signature or webhook secret' });
    }
    
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.organizationId;
      const plan = session.metadata?.plan;
      
      if (orgId && plan) {
        await prisma.subscription.updateMany({
          where: { organizationId: orgId },
          data: {
            plan: plan,
            status: 'ACTIVE',
          }
        });
        
        await prisma.auditLog.create({
          data: {
            organizationId: orgId,
            action: 'SUBSCRIPTION_PAYMENT_SUCCESS',
            entity: 'SUBSCRIPTION',
            metadata: JSON.stringify({ plan, sessionId: session.id })
          }
        });
      }
    }
    
    return res.json({ received: true });
  } catch (error: any) {
    console.error('[BillingController] Webhook error:', error.message);
    return res.status(400).json({ error: true, message: error.message });
  }
}
"""

import re
# Replace the existing webhookHandler with the new one
content = re.sub(r'export async function webhookHandler.*?^}', new_webhook, content, flags=re.MULTILINE|re.DOTALL)

with open('src/server/controllers/billingController.ts', 'w') as f:
    f.write(content)
