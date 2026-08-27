const fs = require('fs');
let code = fs.readFileSync('src/components/pos/POSWorkstation.tsx', 'utf8');

// Fix cart items area
const oldCartArea = `{/* Cart Items Area */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-[#1a1a1a] flex flex-col">
          {posCart.items.map((item, idx) => (
            <div key={idx} className="border-b border-slate-300 dark:border-[#333] p-2 hover:bg-slate-50 dark:bg-[#222]">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <div className="font-bold text-xs text-slate-900 dark:text-white">
                    {item.menuItem.name}
                  </div>
                  {(item.options || item.modifiers) && (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
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
                  <div className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                    Rs. {(item.menuItem.price * item.quantity).toFixed(0)}
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#111] rounded-[3px] px-1 py-0.5">
                    <button
                      onClick={() => updatePosCartQty(idx, item.quantity - 1)}
                      className="w-4 h-4 rounded-sm flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-700 transition cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-bold font-mono text-[10px] w-4 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updatePosCartQty(idx, item.quantity + 1)}
                      className="w-4 h-4 rounded-sm flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-700 transition cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>`;

const newCartArea = `{/* Cart Items Area */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-[#1a1a1a] flex flex-col">
          {posCart.items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-slate-400 text-xs text-center">
              <span>Cart is empty</span>
              <span className="text-[10px] text-slate-500 mt-1">Select items from the right menu catalog to add</span>
            </div>
          ) : (
            posCart.items.map((item, idx) => (
              <div key={item.id || idx} className="border-b border-slate-200 dark:border-[#333] p-2 hover:bg-slate-50 dark:hover:bg-[#222]">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <div className="font-bold text-xs text-slate-900 dark:text-white">
                      {item.name || (item as any).menuItem?.name || 'Item'}
                    </div>
                    {(item.flavor || item.customization || (item.selectedOptions && item.selectedOptions.length > 0) || (item.modifiers && item.modifiers.length > 0)) && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight flex flex-col gap-0.5">
                        {item.flavor && <span>• {item.flavor}</span>}
                        {item.customization && <span>• {item.customization}</span>}
                        {item.selectedOptions && item.selectedOptions.map((opt: any, i: number) => (
                          <span key={i}>• {typeof opt === 'string' ? opt : (opt.optionName ? \`\${opt.optionName}: \${opt.choice}\` : JSON.stringify(opt))}</span>
                        ))}
                        {item.modifiers && item.modifiers.map((m: any, i: number) => (
                          <span key={i}>• {typeof m === 'string' ? m : (m?.name || JSON.stringify(m))}</span>
                        ))}
                      </div>
                    )}
                    {(item.itemNote || (item as any).notes) && (
                      <div className="text-[10px] text-amber-500 italic mt-0.5">"{item.itemNote || (item as any).notes}"</div>
                    )}
                  </div>
                  
                  {/* QTY & Price */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                      Rs. {((item.price ?? (item as any).menuItem?.price ?? 0) * item.quantity).toFixed(0)}
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#111] rounded-[3px] px-1 py-0.5 border border-slate-200 dark:border-[#333]">
                      <button
                        type="button"
                        onClick={() => updatePosCartQty(item.id, -1)}
                        className="w-4 h-4 rounded-sm flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                        title="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-bold font-mono text-[10px] w-4 text-center text-slate-900 dark:text-white">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updatePosCartQty(item.id, 1)}
                        className="w-4 h-4 rounded-sm flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                        title="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>`;

code = code.replace(oldCartArea, newCartArea);

// Safe customer lookups and WhatsApp share
code = code.replace(/posCart\.customer\.name/g, "(posCart.customer?.name || 'Customer')");
code = code.replace(/posCart\.customer\.phone/g, "(posCart.customer?.phone || '')");
code = code.replace(/posCart\.customer\.address/g, "(posCart.customer?.address || '')");

fs.writeFileSync('src/components/pos/POSWorkstation.tsx', code);
