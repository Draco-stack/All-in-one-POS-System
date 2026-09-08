const fs = require('fs');
const filePath = './src/components/history/CustomerHistoryView.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const map = [
    { regex: /(?<!dark:|hover:|focus:|active:)text-\[#e4e4e7\](?![/\w-])/g, replacement: 'text-slate-800 dark:text-[#e4e4e7]' },
    { regex: /(?<!dark:|hover:|focus:|active:)text-\[#e4e4e7\]\/60/g, replacement: 'text-slate-500 dark:text-[#e4e4e7]/60' },
    { regex: /(?<!dark:|hover:|focus:|active:)text-\[#e4e4e7\]\/80/g, replacement: 'text-slate-600 dark:text-[#e4e4e7]/80' },
    { regex: /(?<!dark:|hover:|focus:|active:)border-\[#e4e4e7\]\/10/g, replacement: 'border-slate-300 dark:border-[#e4e4e7]/10' },
    { regex: /(?<!dark:|hover:|focus:|active:)bg-\[#141417\]/g, replacement: 'bg-white dark:bg-[#141417]' },
    { regex: /(?<!dark:|hover:|focus:|active:)bg-\[#27272a\]/g, replacement: 'bg-slate-100 dark:bg-[#27272a]' },
    { regex: /(?<!dark:|hover:|focus:|active:)hover:bg-\[#3f3f46\]/g, replacement: 'hover:bg-slate-200 dark:hover:bg-[#3f3f46]' },
    { regex: /(?<!dark:|hover:|focus:|active:)hover:text-\[#e4e4e7\]/g, replacement: 'hover:text-slate-900 dark:hover:text-[#e4e4e7]' },
    { regex: /(?<!dark:|hover:|focus:|active:)hover:bg-\[#e4e4e7\]\/10/g, replacement: 'hover:bg-slate-100 dark:hover:bg-[#e4e4e7]/10' },
    { regex: /(?<!dark:|hover:|focus:|active:)hover:bg-\[#e4e4e7\]\/20/g, replacement: 'hover:bg-slate-200 dark:hover:bg-[#e4e4e7]/20' },
    { regex: /(?<!dark:|hover:|focus:|active:)bg-\[#e4e4e7\]\/10/g, replacement: 'bg-slate-100 dark:bg-[#e4e4e7]/10' },
    { regex: /(?<!dark:|hover:|focus:|active:)text-white/g, replacement: 'text-slate-900 dark:text-white' }
];

map.forEach(m => {
    content = content.replace(m.regex, m.replacement);
});

fs.writeFileSync(filePath, content, 'utf8');
