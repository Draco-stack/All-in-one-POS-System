const fs = require('fs');
const file = './src/components/admin/AdminDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("import { AdminReportsAnalytics } from './AdminReportsAnalytics';", "import { AdminReportsAnalytics } from './AdminReportsAnalytics';\nimport { AdminSystemSettings } from './AdminSystemSettings';");

content = content.replace("type AdminTab = 'SALES' | 'MENU' | 'STAFF' | 'REPORTS';", "type AdminTab = 'SALES' | 'MENU' | 'STAFF' | 'REPORTS' | 'SETTINGS';");

const tabsRegex = /<button\n              onClick=\{\(\) => setActiveTab\('REPORTS'\)\}\n([\s\S]*?)<\/button>/;

const newTabs = `<button
              onClick={() => setActiveTab('REPORTS')}
$1</button>
            {currentUser.role === 'owner' && (
              <button
                onClick={() => setActiveTab('SETTINGS')}
                className={\`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold transition-colors cursor-pointer \${
                  activeTab === 'SETTINGS'
                    ? 'border-[#00897b] text-[#00897b] bg-[#00897b]/10'
                    : 'border-transparent text-stone-400 hover:text-stone-300 hover:bg-white/5'
                }\`}
              >
                <Settings className="w-4 h-4" />
                SETTINGS
              </button>
            )}`;

content = content.replace(tabsRegex, newTabs);

content = content.replace("{activeTab === 'REPORTS' && <AdminReportsAnalytics />}", "{activeTab === 'REPORTS' && <AdminReportsAnalytics />}\n        {activeTab === 'SETTINGS' && <AdminSystemSettings />}");

fs.writeFileSync(file, content, 'utf8');
