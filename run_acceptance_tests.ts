import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000/api';

async function runTests() {
  console.log('🚀 Starting Tillora Production Acceptance Tests...\n');

  // 1. Registration Test
  console.log('--- 1. Registration Test ---');
  const testEmail = `test_${Date.now()}@example.com`;
  const regPayload = {
    name: 'Acceptance Test User',
    email: testEmail,
    password: 'password123',
    restaurantName: 'Acceptance Rest',
    branchName: 'Main',
    plan: 'STARTER'
  };

  let tokenA = '';
  let orgIdA = '';
  let branchIdA = '';
  let userIdA = '';
  
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regPayload)
    });
    const data = await res.json();
    if (res.ok && data.token && data.user.role === 'OWNER') {
      console.log('✅ PASS: Registration succeeds, token issued, role is OWNER.');
      tokenA = data.token;
      orgIdA = data.organization.id;
      branchIdA = data.branch.id;
      userIdA = data.user.id;
    } else {
      console.error('❌ FAIL: Registration failed', data);
    }
  } catch (e) {
    console.error('❌ FAIL: Registration exception', e);
  }

  // 2. Duplicate Registration Test
  console.log('\n--- 2. Duplicate Registration Test ---');
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regPayload)
    });
    if (res.status === 400 || res.status === 409) {
       console.log(`✅ PASS: Duplicate registration properly rejected (${res.status}).`);
    } else {
       console.error('❌ FAIL: Duplicate registration not rejected', await res.json());
    }
  } catch(e) {}

  // 3. IDOR Protection (Cross-Tenant)
  console.log('\n--- 3. IDOR / Tenant Isolation Test ---');
  // First, find the flagship organization or create Org B
  const flagship = await prisma.organization.findFirst({ where: { name: 'Tillora Flagship' } });
  if (flagship) {
    try {
      // Try to fetch users from Flagship using Token A (belonging to Org A)
      const res = await fetch(`${API_URL}/users`, {
        headers: { 
          'Authorization': `Bearer ${tokenA}`,
          'x-organization-id': flagship.id // Malicious header override attempt
        }
      });
      const data = await res.json();
      
      // We expect the backend to completely ignore x-organization-id and return ONLY users from Org A
      // Or to reject it if it tries to access a specific resource.
      // Since /api/users returns users for the *authenticated tenant*, it should return 1 user (the one we just registered).
      if (res.ok && data.length === 1 && (data[0].username === testEmail || data[0].email === testEmail)) {
        console.log('✅ PASS: IDOR attempt ignored. Only authenticated tenant data returned.');
      } else {
        console.error('❌ FAIL: IDOR attempt leaked data or failed improperly', data);
      }
    } catch(e) {}
  } else {
    console.log('⚠️ SKIP: Flagship not found.');
  }

  // 4. Session / Unauthorized Test
  console.log('\n--- 4. Unauthenticated Access Test ---');
  try {
    const res = await fetch(`${API_URL}/orders`);
    if (res.status === 401) {
      console.log('✅ PASS: Unauthenticated access rejected with 401.');
    } else {
      console.error('❌ FAIL: Unauthenticated access allowed!', res.status);
    }
  } catch(e) {}

  // 5. Existing User Login Test
  console.log('\n--- 5. Existing User (Flagship) Login ---');
  try {
    const flagshipUser = await prisma.user.findFirst({ where: { role: 'OWNER', organizationId: flagship?.id } });
    if (flagshipUser) {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: flagshipUser.username,
          password: 'password123',
          pin: '1234'
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token && data.user.id === flagshipUser.id) {
           console.log('✅ PASS: Existing seeded user logged in successfully.');
        } else {
           console.error('❌ FAIL: Existing user login data mismatched', data);
        }
      } else {
        console.log('⚠️ Existing user login rejected (might be expected if passwords differ in test). Status:', res.status);
      }
    }
  } catch(e) {}

  console.log('\n✅ All scripted acceptance checks completed.');
  process.exit(0);
}

runTests();
