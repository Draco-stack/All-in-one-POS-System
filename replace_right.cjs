const fs = require('fs');
let code = fs.readFileSync('src/components/pos/POSWorkstation.tsx', 'utf8');
const startMatch = "      {/* 4. Right Column: Purple Categories Bar & Menu Items Cards Grid */}";
const endMatch = "      {/* Modals & Dialogs */}";

const startIdx = code.indexOf(startMatch);
const endIdx = code.indexOf(endMatch, startIdx);

if(startIdx !== -1 && endIdx !== -1) {
  const replacement = `      {/* Column 3: Menu Catalog */}
      <div className="flex-1 flex flex-col bg-[#1a1a1a] overflow-hidden">
        {/* Categories Header */}
        <div className="bg-[#111] p-1.5 flex flex-col gap-1 border-b border-[#222]">
          <div className="flex flex-wrap items-center gap-1">
            <button className="bg-[#b71c1c] hover:bg-[#d32f2f] text-white px-2 py-0.5 text-[11px] font-bold rounded-[3px] transition cursor-pointer">All</button>
            <button className="bg-[#00897b] hover:bg-[#00796b] text-white px-2 py-0.5 text-[11px] font-bold rounded-[3px] transition cursor-pointer">Deals</button>
            <button className="bg-[#7b1fa2] hover:bg-[#6a1b9a] text-white px-2 py-0.5 text-[11px] font-bold rounded-[3px] transition cursor-pointer">Fried</button>
            <button className="bg-[#7b1fa2] hover:bg-[#6a1b9a] text-white px-2 py-0.5 text-[11px] font-bold rounded-[3px] transition cursor-pointer">Square Pizza</button>
            <button className="bg-[#7b1fa2] hover:bg-[#6a1b9a] text-white px-2 py-0.5 text-[11px] font-bold rounded-[3px] transition cursor-pointer">Desert</button>
            <button className="bg-[#7b1fa2] hover:bg-[#6a1b9a] text-white px-2 py-0.5 text-[11px] font-bold rounded-[3px] transition cursor-pointer">Special Pizza</button>
            <button className="bg-[#7b1fa2] hover:bg-[#6a1b9a] text-white px-2 py-0.5 text-[11px] font-bold rounded-[3px] transition cursor-pointer">Traditional Pizza</button>
            <button className="bg-[#7b1fa2] hover:bg-[#6a1b9a] text-white px-2 py-0.5 text-[11px] font-bold rounded-[3px] transition cursor-pointer">Extra</button>
            <button className="bg-[#7b1fa2] hover:bg-[#6a1b9a] text-white px-2 py-0.5 text-[11px] font-bold rounded-[3px] transition cursor-pointer">Pasta</button>
            <button className="bg-[#7b1fa2] hover:bg-[#6a1b9a] text-white px-2 py-0.5 text-[11px] font-bold rounded-[3px] transition cursor-pointer">Crust House</button>
            <button className="bg-[#7b1fa2] hover:bg-[#6a1b9a] text-white px-2 py-0.5 text-[11px] font-bold rounded-[3px] transition cursor-pointer">Appetizers</button>
          </div>
          <div className="flex items-center gap-1">
            <button className="bg-[#00897b] hover:bg-[#00796b] text-white px-2 py-0.5 text-[11px] font-bold rounded-[3px] transition cursor-pointer">Beverages</button>
            <button className="bg-[#7b1fa2] hover:bg-[#6a1b9a] text-white px-2 py-0.5 text-[11px] font-bold rounded-[3px] transition cursor-pointer">FIFA</button>
            
            {/* Search Input Row */}
            <div className="flex-1 flex items-center bg-[#1a1a1a] border border-[#333] rounded-[3px] overflow-hidden ml-1">
              <input
                type="text"
                placeholder="Item Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent px-2 py-0.5 text-[11px] text-white placeholder-[#555] focus:outline-none"
              />
            </div>
            <button
              onClick={() => setSearchQuery('')}
              className="w-6 h-[22px] bg-[#d32f2f] hover:bg-[#b71c1c] text-white rounded-[3px] flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Menu Items Grid */}
        <div className="flex-1 overflow-y-auto p-2 bg-[#222]">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pb-24">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleMenuItemClick(item)}
                className="bg-[#1a1a1a] border border-[#333] rounded-[3px] overflow-hidden cursor-pointer hover:border-[#00897b] transition flex flex-col relative group"
              >
                <div className="text-center text-white font-bold text-[10px] uppercase py-1 border-b border-[#333] truncate px-1">
                  {item.name}
                </div>
                <div className="h-28 relative bg-[#111]">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#444]">
                      <LayoutGrid className="w-8 h-8 opacity-20" />
                    </div>
                  )}
                  <div className="absolute bottom-0 right-0 bg-black/90 text-white font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-tl-[3px]">
                    {item.price}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
\n`;
  code = code.substring(0, startIdx) + replacement + code.substring(endIdx);
  fs.writeFileSync('src/components/pos/POSWorkstation.tsx', code);
  console.log('Replaced right column successfully');
} else {
  console.log('Could not find start or end index for right column');
}
