const fs = require('fs');

const file = './src/components/pos/POSWorkstation.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldCustomerSectionStart = '          {/* Row 3: Customer Input */}';
const oldCustomerSectionEnd = '        {/* Active Ticket Cart Items */}';

const startIndex = content.indexOf(oldCustomerSectionStart);
const endIndex = content.indexOf(oldCustomerSectionEnd);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find customer section bounds.");
  process.exit(1);
}

const replacement = `          {/* Row 3: Customer Input */}
          <div className="flex items-center gap-1">
            <input type="text" placeholder="Search Customer Phone" value={phoneSearchInput} onChange={(e) => setPhoneSearchInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handlePhoneLookup(undefined, true); }} className="bg-[#222222] border border-stone-700 rounded px-2 py-1 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-[#1e7e4a] flex-1 min-w-0" />
            <button onClick={() => setIsCustomerManageModalOpen(true)} className="bg-[#1e7e4a] hover:bg-[#137333] text-white px-2 py-1 rounded shrink-0 text-[10px] font-bold font-mono cursor-pointer">{'>'}</button>
            <button onClick={() => handlePhoneLookup(undefined, true)} className="bg-[#1e7e4a] hover:bg-[#137333] text-white p-1 rounded shrink-0 cursor-pointer"><Search className="w-3.5 h-3.5" /></button>
          </div>
          
          {/* Customer Details Display Area */}
          {customerLookupStatus === 'new' ? (
            <div className="bg-[#111111] border border-stone-800 rounded p-1 mt-1 flex flex-col gap-1">
               <input type="text" placeholder="Customer Name (Required)" value={posCart.customer?.name || ''} onChange={(e) => setPosCustomerField('name', e.target.value)} className="bg-[#222222] border border-stone-700 rounded px-2 py-1 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-[#1e7e4a] w-full" />
               <input type="text" placeholder="Address (Optional)" value={posCart.customer?.address || ''} onChange={(e) => setPosCustomerField('address', e.target.value)} className="bg-[#222222] border border-stone-700 rounded px-2 py-1 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-[#1e7e4a] w-full" />
            </div>
          ) : customerLookupStatus === 'found' && posCart.customer ? (
            <div className="bg-[#111111] border border-stone-800 rounded p-1 mt-1 flex justify-between items-center">
               <span className="font-bold text-white text-[11px] truncate ml-1">{posCart.customer.name}</span>
               <button onClick={() => setIsCustomerModalOpen(true)} className="text-[10px] text-[#1e7e4a] hover:text-[#137333] font-bold cursor-pointer underline mr-1">View Info</button>
            </div>
          ) : null}
        </div>

`;

content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync(file, content, 'utf8');
console.log("Customer section updated successfully.");
