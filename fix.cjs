const fs = require('fs');
let code = fs.readFileSync('src/components/pos/POSWorkstation.tsx', 'utf8');

const errMatch = `        </div>
      </div>
    </div>

      {/* Modals & Dialogs */}`;

const fix = `        </div>
      </div>

      {/* Modals & Dialogs */}`;

code = code.replace(errMatch, fix);
fs.writeFileSync('src/components/pos/POSWorkstation.tsx', code);
