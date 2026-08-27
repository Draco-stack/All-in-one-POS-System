const fs = require('fs');

const file = './src/components/pos/POSWorkstation.tsx';
let content = fs.readFileSync(file, 'utf8');

const startStr = `      {/* ========================================================================= */}\n      {/* PANE 1: LEFT CONTROL SIDEBAR (Approx 28% width, h-full)                   */}`;
const endStr = `      {/* FLAVOR & VARIANT PICKER MODAL                                             */}`;

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find start or end bounds.");
  process.exit(1);
}

const replacement = `      {/* ========================================================================= */}
      {/* PANE 1: LEFT SIDEBAR & ORDER STREAM (Approx 20% width)                    */}
      {/* ========================================================================= */}
      <div className="w-[22%] xl:w-[20%] flex flex-row h-full shrink-0 border-r border-stone-800 bg-[#111111] z-10">
        
        {/* Far-Left Icon Strip */}
        <div className="w-11 bg-[#1a1a1a] border-r border-stone-800 flex flex-col items-center justify-between py-2 shrink-0">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center font-black text-2xl text-white select-none tracking-tighter">
              H
            </div>

            <button onClick={() => showToast('Support & Intercom audio connected')} title="Audio / Intercom" className="p-1 rounded text-stone-300 hover:text-white transition cursor-pointer">
              <Headphones className="w-5 h-5 stroke-[2]" />
            </button>

            <button onClick={() => showToast('Terminal brightness optimized')} title="Terminal Night Mode" className="p-1 rounded text-stone-300 hover:text-white transition cursor-pointer">
              <Moon className="w-5 h-5 fill-current" />
            </button>

            <button onClick={() => setIsShiftCloseOpen(true)} title="End-of-Shift Denomination Counter" className="w-8 h-8 rounded hover:bg-stone-800 flex items-center justify-center text-stone-300 transition cursor-pointer">
              <Calculator className="w-4 h-4" />
            </button>

            {onOpenAdminDashboard && (
              <button onClick={onOpenAdminDashboard} title="Executive Administrative Console & Sales Dashboard" className="w-8 h-8 rounded hover:bg-stone-800 flex items-center justify-center text-stone-300 transition cursor-pointer">
                <ShieldCheck className="w-4.5 h-4.5 text-amber-400" />
              </button>
            )}

            {onOpenUserSwitch && (
              <button onClick={onOpenUserSwitch} title={\`Active User: \${currentUser.name} (\${currentUser.role})\`} className="w-7 h-7 rounded-full bg-stone-700 border border-stone-600 text-white font-bold text-[10px] flex items-center justify-center cursor-pointer hover:bg-stone-600 transition">
                {currentUser.name.charAt(0)}
              </button>
            )}
          </div>

          <div className="flex flex-col items-center gap-2">
            <button onClick={() => showToast('Connecting to POS Live Dispatch Chat...')} title="Live Chat Support" className="w-8 h-8 rounded-full bg-[#1e7e4a] flex items-center justify-center text-white shadow-md hover:bg-[#137333] transition cursor-pointer">
              <MessageSquare className="w-4 h-4 fill-white" />
            </button>
          </div>
        </div>

        {/* Order Stream */}
        <div className="flex-1 flex flex-col h-full bg-[#111111] overflow-hidden">
          
          <div className="flex flex-col gap-1 p-1 shrink-0 bg-[#111111]">
            <button onClick={() => showToast('Showing all orders')} className="bg-[#1e7e4a] text-white text-[12px] font-bold px-2 py-1.5 rounded cursor-pointer w-full shadow-xs text-center border border-[#1e7e4a]">
              Blink Co Orders
            </button>

            <div className="flex items-center gap-1">
              <input
                type="text"
                placeholder="search orders"
                value={searchOrdersInput}
                onChange={(e) => setSearchOrdersInput(e.target.value)}
                className="bg-[#222222] border border-stone-700 rounded px-1.5 py-1 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-[#1e7e4a] flex-1 min-w-0"
              />
              <button onClick={() => { setSearchOrdersInput(''); showToast('Ongoing orders list refreshed'); }} className="bg-stone-800 hover:bg-stone-700 text-white p-1 rounded cursor-pointer shrink-0 border border-stone-700">
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { if (onOpenOrdersView) onOpenOrdersView(); }} className="bg-[#1e7e4a] hover:bg-[#137333] text-white p-1 rounded cursor-pointer shrink-0 border border-[#1e7e4a]">
                <LayoutDashboard className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden bg-[#111111]">
            <div className="flex-1 overflow-y-auto p-1 space-y-1.5 no-scrollbar">
              {ongoingOrders.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-stone-500 space-y-2">
                  <Database className="w-8 h-8 stroke-1 text-stone-700" />
                  <p className="text-xs font-semibold">No active orders</p>
                </div>
              ) : (
                ongoingOrders.map((ord) => {
                  const isSelected = selectedOrderId === ord.id;
                  return (
                    <div
                      key={ord.id}
                      onClick={() => {
                        setSelectedOrderId(ord.id);
                        if (ord.status === 'completed' || ord.status === 'cancelled') {
                          handleOneClickCashout(ord);
                        } else {
                          handleOneClickDispatch(ord);
                        }
                      }}
                      className={\`bg-[#1c1c1c] rounded p-2 text-xs transition cursor-pointer hover:border-[#1e7e4a] border \${isSelected ? 'border-[#1e7e4a] ring-1 ring-[#1e7e4a]' : 'border-stone-800'}\`}
                    >
                      <div className="flex justify-between items-center border-b border-stone-800 pb-1 mb-1">
                        <span className="font-mono text-white font-semibold">#{ord.orderNumber.replace('ORD-', '')}</span>
                        <span className="text-[#1e7e4a] font-bold">PKR {ord.total.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-stone-400 mb-1">
                        <span className="capitalize">{ord.type}</span>
                        <span>•</span>
                        <span>{ord.status}</span>
                      </div>
                      <div className="text-stone-300 text-[11px] truncate leading-tight">
                        {ord.items.map((i) => \`\${i.quantity}x \${i.name}\`).join(', ')}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PANE 2: CENTER PANE (Order Construction, Approx 28% width)                */}
      {/* ========================================================================= */}
      <div className="w-[30%] xl:w-[28%] flex flex-col h-full bg-[#111111] border-r border-stone-800 relative overflow-hidden justify-between">
        <div className="flex flex-col p-1 gap-1 shrink-0 bg-[#1a1a1a]">
          {/* Row 1: Select Outlet */}
          <div className="flex items-center gap-1">
            <select value={selectedOutlet} onChange={(e) => setSelectedOutlet(e.target.value)} className="bg-[#222222] border border-stone-700 rounded px-2 py-1 text-xs text-white font-semibold focus:outline-none focus:border-[#1e7e4a] flex-1 cursor-pointer">
              <option value="Gulberg Branch">Select Outlet</option>
              <option value="DHA Phase 5">DHA Phase 5</option>
              <option value="F-7 Islamabad">F-7 Islamabad</option>
              <option value="Mall of Lahore">Mall of Lahore</option>
            </select>
            <button onClick={() => showToast('WhatsApp Sync Status')} className="bg-[#1e7e4a] hover:bg-[#137333] text-white p-1 rounded shrink-0 cursor-pointer"><Check className="w-4 h-4 stroke-[3]" /></button>
            <button onClick={() => setSelectedOutlet('Gulberg Branch')} className="bg-[#c82333] hover:bg-[#bd2130] text-white p-1 rounded shrink-0 cursor-pointer"><X className="w-4 h-4 stroke-[3]" /></button>
          </div>
          
          {/* Row 2: Order Type & Source */}
          <div className="flex items-center gap-1">
            <div className="flex rounded overflow-hidden shrink-0 border border-stone-700">
              <button onClick={() => setPosOrderType('takeaway')} className={\`px-2 py-1 text-xs font-bold transition cursor-pointer \${posCart.orderType === 'takeaway' ? 'bg-[#333333] text-white' : 'bg-[#222222] text-stone-400 hover:bg-[#333333]'}\`}>TakeAway</button>
              <button onClick={() => setPosOrderType('delivery')} className={\`px-2 py-1 text-xs font-bold transition cursor-pointer \${posCart.orderType === 'delivery' ? 'bg-[#1e7e4a] text-white' : 'bg-[#222222] text-stone-400 hover:bg-[#333333]'}\`}>Delivery</button>
            </div>
            <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)} className="bg-[#222222] border border-stone-700 rounded px-2 py-1 text-xs text-white font-semibold focus:outline-none focus:border-[#1e7e4a] flex-1 cursor-pointer">
              <option value="Pos">Select Source</option>
              <option value="Blink Co Mobile">Blink Co Mobile</option>
              <option value="Website Web">Website Web</option>
              <option value="Call Center">Call Center</option>
            </select>
          </div>
          
          {/* Row 3: Customer Input */}
          <div className="flex items-center gap-1">
            <input type="text" placeholder="Search Customer" value={phoneSearchInput} onChange={(e) => setPhoneSearchInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleCustomerLookup(); }} className="bg-[#222222] border border-stone-700 rounded px-2 py-1 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-[#1e7e4a] flex-1 min-w-0" />
            <button onClick={() => setIsCustomerManageModalOpen(true)} className="bg-[#1e7e4a] hover:bg-[#137333] text-white px-2 py-1 rounded shrink-0 text-[10px] font-bold font-mono cursor-pointer">{'>'}</button>
            <button onClick={handleCustomerLookup} className="bg-[#1e7e4a] hover:bg-[#137333] text-white p-1 rounded shrink-0 cursor-pointer"><Search className="w-3.5 h-3.5" /></button>
          </div>
          
          {/* Customer Details Display Area */}
          {posCart.customerId && (
            <div className="bg-[#111111] border border-stone-800 rounded p-1 mt-1 flex justify-between items-center">
               <span className="font-bold text-white text-[11px] truncate ml-1">{posCart.customerName}</span>
               <button onClick={() => setIsCustomerViewModalOpen(true)} className="text-[10px] text-[#1e7e4a] hover:text-[#137333] font-bold cursor-pointer underline mr-1">View Info</button>
            </div>
          )}
        </div>

        {/* Active Ticket Cart Items */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-1 bg-[#111111] no-scrollbar">
           {posCart.items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-stone-600 space-y-2">
                 <ChefHat className="w-8 h-8 stroke-1 text-stone-800" />
                 <p className="text-xs font-semibold">Active Ticket is Empty</p>
              </div>
           ) : (
              posCart.items.map((cartItem) => (
                <div key={cartItem.id} className="bg-[#1c1c1c] border border-stone-800 rounded p-1.5 flex items-center justify-between text-xs hover:border-[#1e7e4a] transition">
                  <div className="flex-1 min-w-0 pr-1.5">
                    <div className="font-bold text-white truncate text-[11px]">{cartItem.name}</div>
                    {cartItem.flavor && <div className="text-[10px] text-emerald-500 truncate">{cartItem.flavor}</div>}
                    {cartItem.modifiers && cartItem.modifiers.length > 0 && <div className="text-[9px] text-stone-500 truncate">+{cartItem.modifiers.map(m=>m.name).join(', ')}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => updateCartItemQty(cartItem.id, cartItem.quantity - 1)} className="w-5 h-5 rounded bg-stone-700 hover:bg-stone-600 text-white font-bold flex items-center justify-center cursor-pointer transition text-[10px]"><Minus className="w-2.5 h-2.5" /></button>
                    <span className="w-4 text-center font-mono font-bold text-white text-[11px]">{cartItem.quantity}</span>
                    <button onClick={() => updateCartItemQty(cartItem.id, cartItem.quantity + 1)} className="w-5 h-5 rounded bg-stone-700 hover:bg-stone-600 text-white font-bold flex items-center justify-center cursor-pointer transition text-[10px]"><Plus className="w-2.5 h-2.5" /></button>
                  </div>
                  <div className="text-right shrink-0 pl-1.5 min-w-[50px]">
                    <span className="font-mono font-bold text-amber-400 text-[10px] block truncate">{Number(cartItem.price * cartItem.quantity).toLocaleString()}</span>
                    <button onClick={() => removeFromPosCart(cartItem.id)} className="text-stone-500 hover:text-red-500 text-[9px] transition cursor-pointer font-bold">X</button>
                  </div>
                </div>
              ))
           )}
        </div>

        {/* Bottom Action Controls */}
        <div className="p-1.5 bg-[#1a1a1a] border-t border-stone-800 space-y-1.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-12 bg-[#222222] border border-stone-700 rounded py-1.5 text-center font-mono font-bold text-xs text-white">0</div>
            <button onClick={() => setShowDiscountPrompt(true)} className="flex-1 bg-[#1e7e4a] hover:bg-[#137333] text-white font-bold text-[11px] py-1.5 px-2 rounded cursor-pointer transition text-center shadow-xs truncate">Discount {posCart.discountPercent > 0 ? \`\${(cartSubtotal * (posCart.discountPercent / 100)).toFixed(0)}(\${posCart.discountPercent}%)\` : '0(0%)'}</button>
            <button onClick={() => setShowChargesPrompt(true)} className="flex-1 bg-[#1e7e4a] hover:bg-[#137333] text-white font-bold text-[11px] py-1.5 px-2 rounded cursor-pointer transition text-center shadow-xs truncate">Charges {posCart.tipAmount || 0}</button>
          </div>
          <input type="text" placeholder="Delivery Note" value={activeDeliveryNote} onChange={(e) => setActiveDeliveryNote(e.target.value)} className="w-full bg-[#222222] border border-stone-700 rounded px-2 py-1.5 text-[11px] text-white placeholder:text-stone-500 focus:outline-none focus:border-[#1e7e4a]" />
          <div className="flex items-center gap-2 pt-0.5">
            <label className="flex items-center gap-1 text-[11px] text-stone-400 font-semibold cursor-pointer shrink-0">
              <input type="checkbox" checked={isPreOrder} onChange={(e) => setIsPreOrder(e.target.checked)} className="rounded border-stone-700 bg-[#333333] text-[#1e7e4a] focus:ring-0 cursor-pointer w-3.5 h-3.5" />
              PreOrder
            </label>
            <button onClick={handlePlaceOrder} disabled={isPunching} className={\`flex-1 bg-[#1e7e4a] hover:bg-[#137333] active:scale-[0.99] text-white font-bold text-xs py-2 px-4 rounded cursor-pointer transition shadow flex items-center justify-center gap-2 \${punchSuccessAnimation ? 'bg-emerald-600' : ''}\`}>
              {isPunching ? <span className="animate-pulse">...</span> : punchSuccessAnimation ? <span>✓ Punched!</span> : <span>Place Order ({posCart.items.length === 0 ? '0' : cartTotal.toLocaleString()})</span>}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PANE 3: RIGHT MENU GRID (Approx 50% width)                                */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col h-full bg-[#111111] relative overflow-hidden border-l border-stone-800">
        
        {/* Top Category Strip & Search */}
        <div className="bg-[#1a1a1a] border-b border-stone-800 p-1.5 shrink-0">
          <div className="flex items-center gap-1 flex-wrap">
            {['all', 'deals', 'fried', 'square_pizza', 'desert', 'special_pizza', 'traditional_pizza', 'extra', 'pasta', 'crust_house', 'appetizers', 'beverages', 'fifa'].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={\`px-2 py-0.5 text-[11px] font-bold rounded-xs whitespace-nowrap cursor-pointer transition \${
                  selectedCategory === cat
                    ? 'bg-[#c82333] text-white shadow-xs'
                    : 'bg-[#222222] text-stone-300 hover:bg-[#333333]'
                }\`}
              >
                {cat === 'all' ? 'All' : cat === 'square_pizza' ? 'Square Pizza' : cat === 'special_pizza' ? 'Special Pizza' : cat === 'traditional_pizza' ? 'Traditional Pizza' : cat === 'crust_house' ? 'Crust House' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
            
            <div className="flex items-center gap-1 flex-1 min-w-[150px] ml-auto">
               <input
                 type="text"
                 placeholder="Item Search"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="bg-[#222222] border border-stone-700 rounded-xs px-2 py-0.5 text-[11px] text-white placeholder:text-stone-500 focus:outline-none focus:border-[#c82333] flex-1 min-w-0"
               />
               <button onClick={() => setSearchQuery('')} className="bg-[#c82333] hover:bg-[#bd2130] text-white font-bold px-2 py-0.5 text-[11px] rounded-xs cursor-pointer shrink-0">X</button>
            </div>
          </div>
        </div>

        {/* Visual Menu Grid */}
        <div className="flex-1 overflow-y-auto p-1.5 bg-[#111111] no-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-1">
            {filteredMenuItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemTap(item)}
                className="border border-stone-700 bg-[#1c1c1c] rounded-sm flex flex-col overflow-hidden relative cursor-pointer hover:border-[#1e7e4a] active:scale-[0.98] transition h-[150px]"
              >
                {/* Title */}
                <div className="px-1.5 pt-1.5 pb-1 text-center z-10 shrink-0 min-h-[36px] bg-[#1c1c1c]">
                  <h4 className="font-medium text-white text-[11px] leading-tight line-clamp-2">
                    {item.name}
                  </h4>
                </div>

                {/* Image or empty space */}
                <div className="flex-1 relative w-full h-full flex items-end justify-end">
                  {item.image && (
                     <img src={item.image} alt={item.name} className="absolute inset-0 w-full h-full object-cover opacity-90" />
                  )}
                  {/* Price Badge */}
                  <div className="relative z-10 border border-stone-400 bg-[#111111] px-1.5 py-0.5 text-[11px] font-mono text-white m-1 leading-none rounded-sm">
                    {item.price}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
\n      {/* ========================================================================= */}
      {/* FLAVOR & VARIANT PICKER MODAL                                             */}`;

const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex + endStr.length);
fs.writeFileSync(file, newContent, 'utf8');
console.log("Successfully replaced layout.");
