const fs = require('fs');
let code = fs.readFileSync('src/components/pos/POSWorkstation.tsx', 'utf8');

const regex = /(className="[^"]*)text-white([^"]*")/g;
code = code.replace(regex, (match, p1, p2) => {
  // If the string contains a button background color like bg-[#00897b], bg-[#d32f2f], bg-[#b71c1c], bg-[#7b1fa2], bg-[#25d366], bg-[#00796b], etc
  if (
    /bg-\[#(00897b|d32f2f|b71c1c|7b1fa2|6a1b9a|25d366|20b858|00796b|004d40|c026d3|581c87|6b21a8|333|444)\]/.test(p1) ||
    /bg-\[#(00897b|d32f2f|b71c1c|7b1fa2|6a1b9a|25d366|20b858|00796b|004d40|c026d3|581c87|6b21a8|333|444)\]/.test(p2) ||
    /bg-black/.test(p1) || /bg-black/.test(p2)
  ) {
    return match; // Keep as text-white
  }
  return p1 + 'text-slate-900 dark:text-white' + p2;
});

code = code.replace(/text-slate-400 hover:text-white/g, 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white');
code = code.replace(/text-slate-400/g, 'text-slate-500 dark:text-slate-400');
code = code.replace(/text-slate-300/g, 'text-slate-600 dark:text-slate-300');

fs.writeFileSync('src/components/pos/POSWorkstation.tsx', code);
