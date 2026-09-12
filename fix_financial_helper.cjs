const fs = require('fs');

let code = fs.readFileSync('src/server/financialHelper.ts', 'utf8');

const oldLogic = `    // Use authoritative database price if menu item found; otherwise sanitize client price
    let unitPrice = 0;
    if (dbItem) {
      unitPrice = roundMoney(dbItem.price);
    } else {
      const rawPrice = Number(item.price);
      if (!Number.isFinite(rawPrice) || rawPrice < 0) {
        throw new Error(\`Invalid price for item: \${item.name}\`);
      }
      unitPrice = roundMoney(rawPrice);
    }

    const itemSubtotal = roundMoney(unitPrice * quantity);`;

const newLogic = `    // Use authoritative database price if menu item found; otherwise sanitize client price
    let unitPrice = 0;
    if (dbItem) {
      unitPrice = roundMoney(dbItem.price);
    } else {
      const rawPrice = Number(item.price);
      if (!Number.isFinite(rawPrice) || rawPrice < 0) {
        throw new Error(\`Invalid price for item: \${item.name}\`);
      }
      unitPrice = roundMoney(rawPrice);
    }

    // Process Modifiers authoritatively
    let mods = [];
    if (typeof item.modifiers === 'string') {
        try { mods = JSON.parse(item.modifiers); } catch (e) {}
    } else if (Array.isArray(item.modifiers)) {
        mods = item.modifiers;
    }

    let modifierTotal = 0;
    if (dbItem && dbItem.options) {
        let dbOptions = [];
        try { dbOptions = JSON.parse(dbItem.options); } catch (e) {}
        for (const mod of mods) {
            const dbMod = dbOptions.find(o => o.name === mod.name);
            if (dbMod) {
                modifierTotal += Number(dbMod.price) || 0;
            }
        }
    } else {
        // Custom item fallback: use client provided modifier prices
        for (const mod of mods) {
            modifierTotal += Number(mod.price) || 0;
        }
    }
    
    unitPrice = roundMoney(unitPrice + modifierTotal);

    const itemSubtotal = roundMoney(unitPrice * quantity);`;

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('src/server/financialHelper.ts', code);
