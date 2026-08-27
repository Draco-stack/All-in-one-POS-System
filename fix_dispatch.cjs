const fs = require('fs');
const file = './src/components/pos/POSWorkstation.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldDispatch = /  const handleOneClickDispatch = \(order: Order\) => \{[\s\S]*?showToast\(`🚀 Order #\$\{order\.orderNumber\} dispatched → \$\{labelMap\[nextStatus\] \|\| nextStatus\}`\);\n  \};/;

const newDispatch = `  const handleOneClickDispatch = (order: Order) => {
    if (order.status === 'completed' || order.status === 'cancelled') {
      return;
    }
    
    let nextStatus: OrderStatus = 'in_kitchen';
    if (
      order.status === 'pending' ||
      order.status === 'PUNCHED' ||
      order.status === 'open' ||
      order.status === 'MODIFIED'
    ) {
      nextStatus = 'in_kitchen';
    } else if (order.status === 'in_kitchen') {
      nextStatus = order.orderType === 'delivery' ? 'dispatched' : 'ready';
    } else if (order.status === 'dispatched' || order.status === 'ready' || order.status === 'delivered') {
      handleOneClickCashout(order);
      return;
    } else {
      nextStatus = order.status;
    }

    if (nextStatus === order.status) return;

    updateOrderStatus(order.id, nextStatus);
    const labelMap: Record<string, string> = {
      in_kitchen: 'In Kitchen',
      ready: 'Ready for Pickup',
      dispatched: 'Out for Delivery',
    };
    showToast(\`🚀 Order #\${order.orderNumber} dispatched → \${labelMap[nextStatus] || nextStatus}\`);
  };`;

content = content.replace(oldDispatch, newDispatch);

content = content.replace(/if \(ord\.status === 'completed' \|\| ord\.status === 'cancelled'\) \{\n                          handleOneClickCashout\(ord\);\n                        \} else \{\n                          handleOneClickDispatch\(ord\);\n                        \}/g, "handleOneClickDispatch(ord);");

fs.writeFileSync(file, content, 'utf8');
