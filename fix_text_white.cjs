const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    // We want to replace "text-white" with "text-slate-900 dark:text-white"
    // only inside className="..." that also contains "dark:bg-stone-900" or similar.
    content = content.replace(/className=(['"{`][^>'"{}`]+['"}])/g, (match, classString) => {
        if (classString.includes('dark:bg-stone-') || classString.includes('bg-white')) {
            // Check if it has a strong background that requires white text in light mode
            const requiresWhite = /bg-(emerald|teal|blue|indigo|purple|pink|red|orange|green|cyan|sky|rose)-(500|600|700|800|900)/.test(classString);
            if (!requiresWhite && classString.match(/(?<!dark:|hover:|focus:|active:)text-white(?![/\w-])/)) {
                return `className=${classString.replace(/(?<!dark:|hover:|focus:|active:)text-white(?![/\w-])/g, 'text-slate-900 dark:text-white')}`;
            }
        }
        return match;
    });

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated text-white in ${filePath}`);
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
console.log("Done text-white fix.");
