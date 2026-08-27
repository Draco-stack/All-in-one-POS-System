const fs = require('fs');
let code = fs.readFileSync('src/components/pos/POSWorkstation.tsx', 'utf8');
const startMatch = "      {/* 3. Middle Column: Whites Castle Call Center Ticket & Inline Customizer (~430px) */}";
const endMatch = "      {/* 4. Right Column";

const startIdx = code.indexOf(startMatch);
const endIdx = code.indexOf(endMatch, startIdx);

if(startIdx !== -1 && endIdx !== -1) {
  const target = code.substring(startIdx, endIdx);
  const replacement = `      {/* Column 2: Ticket & Cart */}
      <div className="w-[430px] bg-[#1a1a1a] border-r border-[#222] flex flex-col shrink-0 shadow-sm h-full">
        {/* Row 1: Outlet, WhatsApp, Reset */}
        <div className="bg-[#111] border-b border-[#222] p-1.5 flex items-center gap-1.5 shrink-0">
          <select
            value={selectedOutlet}
            onChange={(e) => setSelectedOutlet(e.target.value)}
            className="flex-1 bg-[#1a1a1a] border border-[#333] text-white font-bold rounded-[3px] px-2 py-1.5 text-xs focus:outline-none shadow-xs"
          >
            <option value="Main Branch">Main Branch</option>
            <option value="Whites Castle - F-11 Branch">Whites Castle - F-11 Branch</option>
            <option value="Whites Castle - I-8 Branch">Whites Castle - I-8 Branch</option>
            <option value="Whites Castle - Gulberg Branch">Whites Castle - Gulberg Branch</option>
          </select>
          <button
            title="WhatsApp Support"
            className="w-[30px] h-[30px] bg-[#25d366] hover:bg-[#20b858] text-white rounded-[3px] flex items-center justify-center cursor-pointer shrink-0 transition"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
          <button
            title="Fast Reset / Clear"
            onClick={() => {
              clearPosCart();
              setPosCustomerField('phone', '');
              setPosCustomerField('name', '');
              setPosCustomerField('address', '');
              setDeliveryCharges(0);
              setDeliveryNote('');
              setIsPreOrder(false);
              setPreOrderTime('');
            }}
            className="w-[30px] h-[30px] bg-[#d32f2f] hover:bg-[#b71c1c] text-white rounded-[3px] flex items-center justify-center cursor-pointer shrink-0 transition shadow-xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Row 2: TakeAway / Delivery / Source */}
        <div className="bg-[#111] border-b border-[#222] p-1.5 flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setPosOrderType('takeaway')}
            className={\`flex-1 py-1.5 text-[11px] font-bold rounded-[3px] uppercase tracking-wider transition \${
              posCart.type === 'takeaway'
                ? 'bg-[#1a1a1a] text-white'
                : 'bg-[#111] text-slate-400 hover:text-white hover:bg-[#333]'
            }\`}
          >
            TakeAway
          </button>
          <button
            onClick={() => setPosOrderType('delivery')}
            className={\`flex-1 py-1.5 text-[11px] font-bold rounded-[3px] uppercase tracking-wider transition \${
              posCart.type === 'delivery'
                ? 'bg-[#00897b] text-white'
                : 'bg-[#111] text-slate-400 hover:text-white hover:bg-[#333]'
            }\`}
          >
            Delivery
          </button>
          <select
            value={orderSource}
            onChange={(e) => setOrderSource(e.target.value)}
            className="flex-[1.5] bg-[#1a1a1a] border border-[#333] text-white font-bold rounded-[3px] px-2 py-1.5 text-xs focus:outline-none shadow-xs"
          >
            <option value="Select Source">Select Source</option>
            <option value="Phone Call">Phone Call</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Website">Website</option>
            <option value="Foodpanda">Foodpanda</option>
          </select>
        </div>

        {/* Row 3: Customer Search */}
        <div className="bg-[#111] p-1.5 flex items-center gap-1.5 shrink-0">
          <input
            type="text"
            placeholder="Search Customer"
            value={posCart.customer.phone}
            onChange={(e) => setPosCustomerField('phone', e.target.value)}
            className="flex-1 bg-[#1a1a1a] border border-[#333] rounded-[3px] px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            className="w-[30px] h-[30px] bg-[#00897b] hover:bg-[#00796b] text-white rounded-[3px] flex items-center justify-center cursor-pointer shrink-0 transition font-bold"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            className="w-[30px] h-[30px] bg-[#333] hover:bg-[#444] text-white rounded-[3px] flex items-center justify-center cursor-pointer shrink-0 transition"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        {/* Cart Items Area */}
        <div className="flex-1 overflow-y-auto bg-[#1a1a1a] flex flex-col">
          {posCart.items.map((item, idx) => (
            <div key={idx} className="border-b border-[#333] p-2 hover:bg-[#222]">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <div className="font-bold text-xs text-white">
                    {item.menuItem.name}
                  </div>
                  {(item.options || item.modifiers) && (
                    <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                      {item.options && Object.values(item.options).join(', ')}
                      {item.modifiers && item.modifiers.map(m => m.name).join(', ')}
                    </div>
                  )}
                  {item.notes && (
                    <div className="text-[10px] text-amber-500 italic mt-0.5">"{item.notes}"</div>
                  )}
                </div>
                
                {/* QTY & Price */}
                <div className="flex flex-col items-end gap-1">
                  <div className="font-mono font-bold text-xs text-white">
                    Rs. {(item.menuItem.price * item.quantity).toFixed(0)}
                  </div>
                  <div className="flex items-center gap-1.5 bg-[#111] rounded-[3px] px-1 py-0.5">
                    <button
                      onClick={() => updatePosCartQty(idx, item.quantity - 1)}
                      className="w-4 h-4 rounded-sm flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-bold font-mono text-[10px] w-4 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updatePosCartQty(idx, item.quantity + 1)}
                      className="w-4 h-4 rounded-sm flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Totals & Actions */}
        <div className="bg-[#111] p-1.5 shrink-0 flex flex-col gap-1.5 border-t border-[#333]">
          {/* Row A: Subtotal, Discount, Charges */}
          <div className="grid grid-cols-3 gap-1.5">
            <div className="bg-[#1a1a1a] border border-[#333] rounded-[3px] px-2 py-1.5 flex items-center justify-center font-mono font-bold text-xs text-white">
              {subtotal.toFixed(0)}
            </div>
            <button
              type="button"
              onClick={() => setShowDiscountModal(true)}
              className="bg-[#00897b] hover:bg-[#00796b] text-white text-[11px] font-bold py-1.5 px-1 rounded-[3px] cursor-pointer transition text-center truncate shadow-xs"
            >
              Discount {posCart.discountPercent}({posCart.discountPercent}%)
            </button>
            <button
              type="button"
              onClick={() => setShowChargesModal(true)}
              className="bg-[#00897b] hover:bg-[#00796b] text-white text-[11px] font-bold py-1.5 px-1 rounded-[3px] cursor-pointer transition text-center truncate shadow-xs"
            >
              Charges {deliveryCharges}
            </button>
          </div>

          {/* Row B: Delivery Note */}
          <input
            type="text"
            placeholder="Delivery Note"
            value={deliveryNote}
            onChange={(e) => setDeliveryNote(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-[3px] px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
          />

          {/* Row C: PreOrder Checkbox & Place Order Button */}
          <div className="flex items-center gap-1.5">
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPreOrder}
                onChange={(e) => setIsPreOrder(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-[#333] bg-[#222] checked:bg-[#00897b] focus:ring-0 cursor-pointer"
              />
              PreOrder
            </label>
            
            {isPreOrder && (
              <input
                type="time"
                value={preOrderTime}
                onChange={(e) => setPreOrderTime(e.target.value)}
                className="bg-[#1a1a1a] border border-[#333] text-white rounded-[3px] px-1 py-0.5 text-xs font-mono"
              />
            )}

            <button
              type="button"
              onClick={handlePlaceOrderClick}
              disabled={posCart.items.length === 0}
              className={\`flex-1 py-1.5 px-2 rounded-[3px] font-bold text-xs transition cursor-pointer shadow-md \${
                posCart.items.length === 0
                  ? 'bg-[#004d40] text-slate-400 opacity-50 cursor-not-allowed'
                  : 'bg-[#00897b] hover:bg-[#00796b] text-white'
              }\`}
            >
              Place Order ({total.toFixed(0)})
            </button>
          </div>
        </div>
      </div>
\n`;
  code = code.substring(0, startIdx) + replacement + code.substring(endIdx);
  fs.writeFileSync('src/components/pos/POSWorkstation.tsx', code);
  console.log('Replaced successfully');
} else {
  console.log('Could not find start or end index');
}
