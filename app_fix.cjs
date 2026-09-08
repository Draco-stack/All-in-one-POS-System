const fs = require('fs');
const path = require('path');

const mappings = [
    { regex: /(?<!dark:|hover:|focus:|active:)bg-stone-900(?![/\w-])/g, replacement: 'bg-white dark:bg-stone-900' },
    { regex: /(?<!dark:|hover:|focus:|active:)bg-stone-900\/60/g, replacement: 'bg-white/60 dark:bg-stone-900/60' },
    { regex: /(?<!dark:|hover:|focus:|active:)bg-stone-900\/40/g, replacement: 'bg-white/40 dark:bg-stone-900/40' },
    { regex: /(?<!dark:|hover:|focus:|active:)bg-stone-900\/95/g, replacement: 'bg-white/95 dark:bg-stone-900/95' },
    { regex: /(?<!dark:)hover:bg-stone-900(?![/\w-])/g, replacement: 'hover:bg-slate-50 dark:hover:bg-stone-900' },
    { regex: /(?<!dark:|hover:|focus:|active:)bg-stone-800(?![/\w-])/g, replacement: 'bg-slate-50 dark:bg-stone-800' },
    { regex: /(?<!dark:)hover:bg-stone-800(?![/\w-])/g, replacement: 'hover:bg-slate-100 dark:hover:bg-stone-800' },
    { regex: /(?<!dark:|hover:|focus:|active:)border-stone-800(?![/\w-])/g, replacement: 'border-slate-200 dark:border-stone-800' },
    { regex: /(?<!dark:|hover:|focus:|active:)border-stone-700(?![/\w-])/g, replacement: 'border-slate-300 dark:border-stone-700' },
    { regex: /(?<!dark:|hover:|focus:|active:)text-stone-300(?![/\w-])/g, replacement: 'text-slate-600 dark:text-stone-300' },
    { regex: /(?<!dark:|hover:|focus:|active:)text-stone-400(?![/\w-])/g, replacement: 'text-slate-500 dark:text-stone-400' },
    { regex: /(?<!dark:|hover:|focus:|active:)text-stone-500(?![/\w-])/g, replacement: 'text-slate-400 dark:text-stone-500' },
    { regex: /(?<!dark:|hover:|focus:|active:)text-stone-100(?![/\w-])/g, replacement: 'text-slate-900 dark:text-stone-100' },
];

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    mappings.forEach(m => {
        content = content.replace(m.regex, m.replacement);
    });

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
    }
}

    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            processFile(fullPath);
        }
    });
}

processFile('./src/App.tsx'); processFile('./src/main.tsx');
