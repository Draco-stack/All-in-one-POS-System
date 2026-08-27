const fs = require('fs');
const file = './src/components/pos/POSWorkstation.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldOrdersRegex = /                    <div\n                      key=\{ord\.id\}\n                      onClick=\{\(\) => \{\n                        setSelectedOrderId\(ord\.id\);\n                        handleOneClickDispatch\(ord\);\n                      \}\}\n                      className=\{\`bg-\\[#1c1c1c\\] rounded p-2 text-xs transition cursor-pointer hover:border-\\[#1e7e4a\\] border \$\{isSelected \? 'border-\\[#1e7e4a\\] ring-1 ring-\\[#1e7e4a\\]' : 'border-stone-800'\}\`\}\n                    >\n                      <div className="flex justify-between items-center border-b border-stone-800 pb-1 mb-1">\n                        <span className="font-mono text-white font-semibold">#\{ord\.orderNumber\.replace\('ORD-', ''\)\}<\/span>\n                        <span className="text-\\[#1e7e4a\\] font-bold">PKR \{ord\.total\.toLocaleString\(\)\}<\/span>\n                      <\/div>\n                      <div className="flex items-center gap-1\.5 text-\\[10px\\] text-stone-400 mb-1">\n                        <span className="capitalize">\{ord\.type\}<\/span>\n                        <span>•<\/span>\n                        <span>\{ord\.status\}<\/span>\n                      <\/div>\n                      <div className="text-stone-300 text-\\[11px\\] truncate leading-tight">\n                        \{ord\.items\.map\(\(i\) => \`\$\{i\.quantity\}x \$\{i\.name\}\`\)\.join\(', '\)\}\n                      <\/div>\n                    <\/div>/;

const newOrders = `                    <div
                      key={ord.id}
                      onClick={() => {
                        setSelectedOrderId(ord.id);
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
                      <div className="text-stone-300 text-[11px] truncate leading-tight mb-2">
                        {ord.items.map((i) => \`\${i.quantity}x \${i.name}\`).join(', ')}
                      </div>
                      
                      <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-stone-800/80">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedOrderId(ord.id); handleOneClickDispatch(ord); }}
                          className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500 hover:text-white rounded text-[10px] font-bold transition flex-1"
                        >
                          Dispatch
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedOrderId(ord.id); handleOneClickCashout(ord); }}
                          className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white rounded text-[10px] font-bold transition flex-1"
                        >
                          Cashout
                        </button>
                        {(currentUser.role === 'manager' || currentUser.role === 'owner') && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedOrderId(ord.id); handleOneClickEdit(ord); }}
                            className="px-2 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500 hover:text-white rounded text-[10px] font-bold transition"
                          >
                            Edit
                          </button>
                        )}
                        {(currentUser.role === 'manager' || currentUser.role === 'owner') && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedOrderId(ord.id); handleOneClickCancel(ord.id, ord.orderNumber); }}
                            className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white rounded text-[10px] font-bold transition"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>`;

content = content.replace(oldOrdersRegex, newOrders);

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
