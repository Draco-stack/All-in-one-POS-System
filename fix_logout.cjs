const fs = require('fs');
let code = fs.readFileSync('src/context/RestaurantContext.tsx', 'utf8');

const oldLogout = `  const logoutUser = useCallback(() => {
    setIsLoggedIn(false);
    saveToStorage('pos_is_logged_in_v5', false);
    saveToStorage('pos_jwt_token_v5', null);
    showToast('🔒 Logged out. Return to login screen.');
  }, [showToast]);`;

const newLogout = `  const logoutUser = useCallback(() => {
    setIsLoggedIn(false);
    
    // Clear tenant identity
    saveToStorage('pos_is_logged_in_v5', false);
    saveToStorage('pos_jwt_token_v5', null);
    saveToStorage('pos_current_user_v5', null);
    
    // Clear all tenant-specific cached state to prevent cross-tenant leakage
    saveToStorage('pos_orders_cache', []);
    saveToStorage('pos_shifts_cache', []);
    saveToStorage('pos_customers_cache', []);
    saveToStorage('pos_categories_cache', []);
    saveToStorage('pos_menu_items_cache', []);
    saveToStorage('pos_sales_adjustments_cache', []);
    saveToStorage('pos_current_shift', null);
    saveToStorage('pos_parked_orders_cache', []);
    
    // Reset state in memory
    setCurrentUser(null);
    setOrders([]);
    setHistoricalShifts([]);
    setCustomers([]);
    setCategories([]);
    setMenuItems([]);
    setSalesAdjustments([]);
    setCurrentShift(null);
    setParkedOrders([]);
    
    showToast('🔒 Logged out. Cache cleared securely.');
  }, [showToast]);`;

code = code.replace(oldLogout, newLogout);

// Also need to clear pos_current_user_v5
fs.writeFileSync('src/context/RestaurantContext.tsx', code);
