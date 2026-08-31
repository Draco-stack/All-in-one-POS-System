# 1. Fix missing createdAt NaN bug in ShiftCloseModal
sed -i 's/const orderTime = new Date(o.createdAt).getTime();/const orderTime = o.createdAt ? new Date(o.createdAt).getTime() : Date.now();/g' src/components/shift/ShiftCloseModal.tsx

# 2. Fix missing createdAt NaN bug in RestaurantContext (shift recalculation)
sed -i 's/new Date(o.createdAt).getTime() >= shiftStartTime/(o.createdAt ? new Date(o.createdAt).getTime() : Date.now()) >= shiftStartTime/g' src/context/RestaurantContext.tsx

# 3. Fix punchOrder to ensure createdAt is ALWAYS set. Let's find "cashierId: currentUser.id," and append createdAt.
sed -i 's/cashierId: currentUser.id,/cashierId: currentUser.id,\n      createdAt: new Date().toISOString(),/g' src/context/RestaurantContext.tsx

# 4. Fix paymentMethod fallback in ShiftCloseModal
sed -i "s/(o.paymentMethod || '').toLowerCase() === 'cash'/(o.paymentMethod || 'cash').toLowerCase() === 'cash'/g" src/components/shift/ShiftCloseModal.tsx
sed -i "s/(o.paymentMethod || '').toLowerCase() === 'cash'/(o.paymentMethod || 'cash').toLowerCase() === 'cash'/g" src/context/RestaurantContext.tsx

# 5. Fix POSCart DEFAULT_EMPTY_CART to ensure paymentMethod is initialized to cash
sed -i 's/orderType: .takeaway.,/orderType: "takeaway",\n  paymentMethod: "cash",/g' src/context/RestaurantContext.tsx
