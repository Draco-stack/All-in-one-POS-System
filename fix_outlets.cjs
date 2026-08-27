const fs = require('fs');
const file = './src/components/admin/AdminStaffManager.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("  const { users, toggleUserActive, deleteUser, addNewUser, updatePin, showToast, currentUser } = useRestaurant();", "  const { users, toggleUserActive, deleteUser, addNewUser, updatePin, showToast, currentUser, outlets } = useRestaurant();");

const outletSelectRegex = /<select\n                  value=\{formData\.outlet\}\n                  onChange=\{\(e\) => setFormData\(\{ \.\.\.formData, outlet: e\.target\.value \}\)\}\n                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white focus:outline-none focus:border-\[#00897b\]"\n                >([\s\S]*?)<\/select>/;

const newOutletSelect = `<select
                  value={formData.outlet}
                  onChange={(e) => setFormData({ ...formData, outlet: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white focus:outline-none focus:border-[#00897b]"
                >
                  <option value="Main Branch">Main Branch</option>
                  {outlets.map(o => <option key={o} value={o}>{o}</option>)}
                </select>`;

content = content.replace(outletSelectRegex, newOutletSelect);
fs.writeFileSync(file, content, 'utf8');
