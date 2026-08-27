const fs = require('fs');
let code = fs.readFileSync('src/components/pos/POSWorkstation.tsx', 'utf8');

// Container & structural bgs
code = code.replace(/bg-\[\#111\]/g, 'bg-slate-100 dark:bg-[#111]');
code = code.replace(/bg-\[\#1a1a1a\]/g, 'bg-white dark:bg-[#1a1a1a]');
code = code.replace(/bg-\[\#222\]/g, 'bg-slate-50 dark:bg-[#222]');

// Borders
code = code.replace(/border-\[\#222\]/g, 'border-slate-200 dark:border-[#222]');
code = code.replace(/border-\[\#333\]/g, 'border-slate-300 dark:border-[#333]');

// Replace text-white EXCEPT inside colored buttons.
// Colored buttons usually have bg-[#...] where ... is a bright color.
// The easiest way is to let text-white be replaced with text-slate-900 dark:text-white,
// but for the colored buttons, we can leave them as text-white. 
// Wait, actually, let's just replace specific classes:

// Search/inputs text
code = code.replace(/text-white placeholder-\[\#555\]/g, 'text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#555]');
code = code.replace(/text-white placeholder-slate-500/g, 'text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500');

// General text colors that need flipping
// We will look for text-white and text-slate-300/400.
// Let's do it manually on a line-by-line basis to avoid breaking button texts.

fs.writeFileSync('src/components/pos/POSWorkstation.tsx', code);
