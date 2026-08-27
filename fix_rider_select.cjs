const fs = require('fs');
const file = './src/components/pos/POSWorkstation.tsx';
let content = fs.readFileSync(file, 'utf8');

const deliveryNoteRegex = /<input type="text" placeholder="Delivery Note" value=\{activeDeliveryNote\} onChange=\{\(e\) => setActiveDeliveryNote\(e\.target\.value\)\} className="w-full bg-\[#222222\] border border-stone-700 rounded px-2 py-1\.5 text-\[11px\] text-white placeholder:text-stone-500 focus:outline-none focus:border-\[#1e7e4a\]" \/>/;

const riderSelect = `{posCart.orderType === 'delivery' && (
            <select
              value={posCart.deliveryDriver || ''}
              onChange={(e) => setPosCart(prev => ({ ...prev, deliveryDriver: e.target.value }))}
              className="w-full bg-[#222222] border border-stone-700 rounded px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-[#1e7e4a] cursor-pointer"
            >
              <option value="">Assign Rider (Optional)</option>
              {users.filter(u => u.role === 'rider').map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          )}
          <input type="text" placeholder="Delivery Note" value={activeDeliveryNote} onChange={(e) => setActiveDeliveryNote(e.target.value)} className="w-full bg-[#222222] border border-stone-700 rounded px-2 py-1.5 text-[11px] text-white placeholder:text-stone-500 focus:outline-none focus:border-[#1e7e4a]" />`;

content = content.replace(deliveryNoteRegex, riderSelect);
fs.writeFileSync(file, content, 'utf8');
console.log("Rider select added");
