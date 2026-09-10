import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000/api';

async function testIDOR() {
  const testEmail = `test_${Date.now()}@example.com`;
  const regPayload = {
    name: 'Acceptance Test User',
    email: testEmail,
    password: 'password123',
    restaurantName: 'Acceptance Rest',
    branchName: 'Main',
    plan: 'STARTER'
  };

  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(regPayload)
  });
  const data = await res.json();
  const token = data.token;
  const newOrgId = data.organization.id;

  const flagship = await prisma.organization.findFirst({ where: { name: 'Tillora Flagship' } });
  
  const ordersRes = await fetch(`${API_URL}/orders`, {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'x-organization-id': flagship!.id
    }
  });
  const ordersData = await ordersRes.json();
  
  console.log('Orders length for new user trying to read Flagship:', ordersData.length);
  process.exit(0);
}

testIDOR();
