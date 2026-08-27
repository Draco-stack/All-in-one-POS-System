const fs = require('fs');
const file = './src/components/pos/POSWorkstation.tsx';
let content = fs.readFileSync(file, 'utf8');

const stateHookStr = `  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<Order | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);`;

const newHookStr = `${stateHookStr}
  const [selectedOrderForCashout, setSelectedOrderForCashout] = useState<Order | null>(null);
  const [isCashoutModalOpen, setIsCashoutModalOpen] = useState(false);`;

content = content.replace(stateHookStr, newHookStr);

const handleOneClickCashoutRegex = /  const handleOneClickCashout = \(order: Order\) => \{[\s\S]*?\};/;

const newCashoutHandler = `  const handleOneClickCashout = (order: Order) => {
    setSelectedOrderForCashout(order);
    setIsCashoutModalOpen(true);
  };
  
  const submitCashout = (method: 'cash' | 'card' | 'online') => {
    if (!selectedOrderForCashout) return;
    updateOrderStatus(selectedOrderForCashout.id, 'completed');
    editOrder(selectedOrderForCashout.id, { status: 'completed', paymentStatus: 'paid', paymentMethod: method });
    playCashRegisterSound();
    showToast(\`💵 Order #\${selectedOrderForCashout.orderNumber} paid via \${method.toUpperCase()} & completed!\`);
    setIsCashoutModalOpen(false);
    setSelectedOrderForCashout(null);
  };`;

content = content.replace(handleOneClickCashoutRegex, newCashoutHandler);

const cashoutModalJSX = `
      {/* CASHOUT MODAL */}
      {isCashoutModalOpen && selectedOrderForCashout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111111] border border-stone-800 rounded-xl w-[400px] shadow-2xl p-6 relative">
            <button onClick={() => setIsCashoutModalOpen(false)} className="absolute top-4 right-4 text-stone-500 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-black text-white uppercase tracking-wider mb-2">Process Cashout</h3>
            <p className="text-stone-400 mb-6">Order #{selectedOrderForCashout.orderNumber.replace('ORD-', '')}</p>
            
            <div className="bg-[#1a1a1a] rounded-lg p-6 text-center border border-stone-800 mb-6 shadow-inner">
              <div className="text-stone-400 text-sm font-semibold mb-1">AMOUNT DUE</div>
              <div className="text-4xl font-mono font-black text-[#1e7e4a]">
                PKR {selectedOrderForCashout.total.toLocaleString()}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => submitCashout('cash')} className="flex items-center justify-center gap-3 w-full py-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-lg transition border border-stone-700">
                💵 Cash Paid
              </button>
              <button onClick={() => submitCashout('card')} className="flex items-center justify-center gap-3 w-full py-4 rounded-xl bg-stone-800 hover:bg-[#1e7e4a]/20 hover:border-[#1e7e4a] hover:text-[#1e7e4a] text-white font-bold text-lg transition border border-stone-700">
                💳 Credit / Debit Card
              </button>
              <button onClick={() => submitCashout('online')} className="flex items-center justify-center gap-3 w-full py-4 rounded-xl bg-stone-800 hover:bg-[#c82333]/20 hover:border-[#c82333] hover:text-[#c82333] text-white font-bold text-lg transition border border-stone-700">
                🌐 Online Payment
              </button>
            </div>
          </div>
        </div>
      )}
`;

content = content.replace("{/* FLAVOR & VARIANT PICKER MODAL", `${cashoutModalJSX}\n      {/* FLAVOR & VARIANT PICKER MODAL`);

fs.writeFileSync(file, content, 'utf8');
console.log("Cashout modal added");
