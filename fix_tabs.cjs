const fs = require('fs');
const file = './src/components/admin/AdminDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacement = `<button
          onClick={() => setActiveTab('REPORTS')}
          className={\`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition cursor-pointer \${
            activeTab === 'REPORTS'
              ? 'bg-[#00897b] text-white shadow-md shadow-[#00897b]/20'
              : 'bg-stone-900 text-stone-400 hover:text-white hover:bg-stone-800 border border-stone-800'
          }\`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Shift Audits & Reports
        </button>
        {currentUser.role === 'owner' && (
          <>
            <button
              onClick={() => setActiveTab('RIDERS')}
              className={\`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition cursor-pointer \${
                activeTab === 'RIDERS'
                  ? 'bg-[#00897b] text-white shadow-md shadow-[#00897b]/20'
                  : 'bg-stone-900 text-stone-400 hover:text-white hover:bg-stone-800 border border-stone-800'
              }\`}
            >
              <Users className="w-4 h-4" />
              Rider Fleet
            </button>
            <button
              onClick={() => setActiveTab('SETTINGS')}
              className={\`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition cursor-pointer \${
                activeTab === 'SETTINGS'
                  ? 'bg-[#00897b] text-white shadow-md shadow-[#00897b]/20'
                  : 'bg-stone-900 text-stone-400 hover:text-white hover:bg-stone-800 border border-stone-800'
              }\`}
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </>
        )}`;

content = content.replace(/<button\n          onClick=\{\(\) => setActiveTab\('REPORTS'\)\}[\s\S]*?<\/button>/, replacement);

content = content.replace("type AdminTab = 'SALES' | 'MENU' | 'STAFF' | 'REPORTS' | 'SETTINGS';", "type AdminTab = 'SALES' | 'MENU' | 'STAFF' | 'REPORTS' | 'SETTINGS' | 'RIDERS';");

content = content.replace("{activeTab === 'REPORTS' && <AdminReportsAnalytics />}", "{activeTab === 'REPORTS' && <AdminReportsAnalytics />}\n        {activeTab === 'RIDERS' && <AdminRidersFleet />}");

content = content.replace("import { AdminSystemSettings } from './AdminSystemSettings';", "import { AdminSystemSettings } from './AdminSystemSettings';\nimport { AdminRidersFleet } from './AdminRidersFleet';");

fs.writeFileSync(file, content, 'utf8');
