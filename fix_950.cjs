const fs = require('fs');
const path = require('path');

const map = [
    { regex: /(?<!dark:|hover:|focus:|active:)bg-stone-950(?![/\w-])/g, replacement: 'bg-white dark:bg-stone-950' },
    { regex: /(?<!dark:|hover:|focus:|active:)bg-stone-950\/60/g, replacement: 'bg-white/60 dark:bg-stone-950/60' },
    { regex: /(?<!dark:|hover:|focus:|active:)bg-stone-950\/40/g, replacement: 'bg-white/40 dark:bg-stone-950/40' },
    { regex: /(?<!dark:|hover:|focus:|active:)border-white\/15/g, replacement: 'border-slate-300 dark:border-white/15' },
    { regex: /(?<!dark:|hover:|focus:|active:)border-white\/10/g, replacement: 'border-slate-300 dark:border-white/10' },
    { regex: /(?<!dark:|hover:|focus:|active:)border-white\/5/g, replacement: 'border-slate-200 dark:border-white/5' },
    { regex: /(?<!dark:|hover:|focus:|active:)border-white\/20/g, replacement: 'border-slate-300 dark:border-white/20' },
];

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    map.forEach(m => {
        content = content.replace(m.regex, m.replacement);
    });
    
    // Also fix text-white in bg-white combinations
    content = content.replace(/className=(['"{`][^>'"{}`]+['"}])/g, (match, classString) => {
        if (classString.includes('bg-white dark:bg-stone-950') || classString.includes('bg-white dark:bg-stone-900') || classString.includes('bg-slate-100 dark:bg-stone-950')) {
            const requiresWhite = /bg-(emerald|teal|blue|indigo|purple|pink|red|orange|green|cyan|sky|rose)-(500|600|700|800|900)/.test(classString);
            if (!requiresWhite && classString.match(/(?<!dark:|hover:|focus:|active:)text-white(?![/\w-])/)) {
                return `className=${classString.replace(/(?<!dark:|hover:|focus:|active:)text-white(?![/\w-])/g, 'text-slate-900 dark:text-white')}`;
            }
        }
        return match;
    });


    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated 950 in ${filePath}`);
    }
}

function walk(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            processFile(fullPath);
        }
    });
}

walk('./src/components');
console.log("Done 950 fix.");
