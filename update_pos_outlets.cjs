const fs = require('fs');
const file = './src/components/pos/POSWorkstation.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("  } = useRestaurant();", "    users,\n    outlets,\n  } = useRestaurant();");

const outletSelectRegex = /<select value=\{selectedOutlet\} onChange=\{\(e\) => setSelectedOutlet\(e\.target\.value\)\} className="bg-\[#222222\] border border-stone-700 rounded px-2 py-1 text-xs text-white font-semibold focus:outline-none focus:border-\[#1e7e4a\] flex-1 cursor-pointer">[\s\S]*?<\/select>/;

const newOutletSelect = `<select value={selectedOutlet} onChange={(e) => setSelectedOutlet(e.target.value)} className="bg-[#222222] border border-stone-700 rounded px-2 py-1 text-xs text-white font-semibold focus:outline-none focus:border-[#1e7e4a] flex-1 cursor-pointer">
              <option value="">Select Outlet</option>
              {outlets.map(o => <option key={o} value={o}>{o}</option>)}
            </select>`;

content = content.replace(outletSelectRegex, newOutletSelect);
fs.writeFileSync(file, content, 'utf8');
