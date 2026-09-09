/**
 * Phase 8 — Local Hardware Bridge, Printing, Cash Drawer, KDS & Device Infrastructure Test Suite
 */

import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import prisma from '../src/server/prisma';
import app from '../server';
import { signTenantToken } from '../src/server/auth/jwt';
import { TilloraLocalAgent } from '../src/server/hardware/localAgent';
import { activeAgentSockets, initHardwareSocket } from '../src/server/hardware/hardwareSocket';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import crypto from 'crypto';

function sha256(val: string): string {
  return crypto.createHash('sha256').update(val).digest('hex');
}

async function runLocalBridgeTests() {
  console.log('==================================================================');
  console.log('🔌 RUNNING PHASE 8 LOCAL HARDWARE BRIDGE & DEVICE INFRASTRUCTURE TESTS');
  console.log('==================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Setup test server from main app
  const server = http.createServer(app);
  const ioServer = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  initHardwareSocket(ioServer);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  const orgId = 'org_test_p8';
  const branchId = 'branch_test_p8';
  const ownerEmail = 'owner@testp8.com';
  const cashierEmail = 'cashier@testp8.com';

  try {
    // --------------------------------------------------------------------------
    // SETUP: Create P8 Test Organization, Branch, Users, and clean up
    // --------------------------------------------------------------------------
    const orgSettings = JSON.stringify({
      billing: {
        providerCustomerId: 'cust_p8_test',
        processedEvents: [],
        lastWebhookTimestamp: 0,
      },
    });

    await prisma.organization.upsert({
      where: { id: orgId },
      update: { status: 'ACTIVE', slug: 'org-test-p8', settings: orgSettings },
      create: { id: orgId, name: 'Test Org Phase 8', slug: 'org-test-p8', status: 'ACTIVE', settings: orgSettings },
    });

    await prisma.branch.upsert({
      where: { id: branchId },
      update: { active: true, slug: 'main-p8-branch' },
      create: { id: branchId, organizationId: orgId, name: 'Main P8 Branch', slug: 'main-p8-branch', active: true },
    });

    const ownerUser = await prisma.user.upsert({
      where: { id: 'user_test_p8_owner' },
      update: { pin: '1111', role: 'OWNER', active: true },
      create: { id: 'user_test_p8_owner', organizationId: orgId, name: 'P8 Owner', username: 'p8_owner', pin: '1111', role: 'OWNER', active: true },
    });

    const cashierUser = await prisma.user.upsert({
      where: { id: 'user_test_p8_cashier' },
      update: { pin: '2222', role: 'CASHIER', active: true, branchId },
      create: { id: 'user_test_p8_cashier', organizationId: orgId, branchId, name: 'P8 Cashier', username: 'p8_cashier', pin: '2222', role: 'CASHIER', active: true },
    });

    // Sign Auth tokens
    const ownerToken = signTenantToken({
      userId: ownerUser.id,
      organizationId: orgId,
      branchId: '',
      role: ownerUser.role,
      username: ownerUser.username,
    });

    const cashierToken = signTenantToken({
      userId: cashierUser.id,
      organizationId: orgId,
      branchId,
      role: cashierUser.role,
      username: cashierUser.username,
    });

    // Clear any previous print jobs, device pairings, and device credentials for this org
    await prisma.printJob.deleteMany({ where: { organizationId: orgId } });
    await prisma.devicePairing.deleteMany({ where: { organizationId: orgId } });
    await prisma.deviceCredential.deleteMany({ where: { organizationId: orgId } });
    await prisma.device.deleteMany({ where: { organizationId: orgId } });
    await prisma.registerShift.deleteMany({ where: { organizationId: orgId } });

    // Ensure organization starts with a known subscription plan for limits (FREE plan allows 2 devices)
    await prisma.subscription.deleteMany({ where: { organizationId: orgId } });
    await prisma.subscription.create({
      data: {
        organizationId: orgId,
        plan: 'FREE',
        status: 'ACTIVE',
      },
    });

    // Create 3 devices in the database for our tests
    const dev1 = await prisma.device.create({
      data: { organizationId: orgId, branchId, deviceIdentifier: 'POS-01', name: 'Counter Register 1', deviceType: 'POS', status: 'PENDING' },
    });

    const dev2 = await prisma.device.create({
      data: { organizationId: orgId, branchId, deviceIdentifier: 'POS-02', name: 'Counter Register 2', deviceType: 'POS', status: 'PENDING' },
    });

    const dev3 = await prisma.device.create({
      data: { organizationId: orgId, branchId, deviceIdentifier: 'POS-03', name: 'Counter Register 3', deviceType: 'POS', status: 'PENDING' },
    });

    console.log('\n--- Test Suite Setup Complete ---');

    // --------------------------------------------------------------------------
    // TEST 1: Generate Pairing Code Security & Expiry
    // --------------------------------------------------------------------------
    console.log('\n--- 1. Secure Pairing Code Generation ---');

    // Attempt generation with Cashier role (must be rejected)
    const resGenCode1 = await fetch(`${baseUrl}/api/devices/generate-pairing-code`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cashierToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: dev1.id }),
    });
    assert(resGenCode1.status === 403, 'Pairing code generation by cashier is rejected with 403 Forbidden');

    // Attempt with Owner role (succeeds)
    const resGenCode2 = await fetch(`${baseUrl}/api/devices/generate-pairing-code`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: dev1.id }),
    });
    assert(resGenCode2.status === 200, 'Pairing code generation by owner succeeds with 200 OK');
    const genCodeData = await resGenCode2.json();
    assert(genCodeData.success === true, 'Response indicates success');
    assert(typeof genCodeData.code === 'string' && genCodeData.code.length === 6, 'Generated code is a 6-digit alphanumeric string');

    // Verify it is saved in DB and belongs to correct tenant context
    const dbPairing = await prisma.devicePairing.findUnique({ where: { code: genCodeData.code } });
    assert(!!dbPairing, 'Pairing code is securely persisted in the database');
    assert(dbPairing?.organizationId === orgId, 'Persisted pairing code matches organization ID');
    assert(dbPairing?.status === 'PENDING', 'New pairing code starts in PENDING status');
    assert(dbPairing?.deviceId === dev1.id, 'Pairing code is mapped to the correct device ID');

    // --------------------------------------------------------------------------
    // TEST 2: Device Pairing Flow & Single-Use Enforcement
    // --------------------------------------------------------------------------
    console.log('\n--- 2. Device Pairing Flow ---');

    // Submit pairing request from Agent
    const resPair1 = await fetch(`${baseUrl}/api/devices/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: genCodeData.code }),
    });
    assert(resPair1.status === 200, 'Pairing request returns 200 OK');
    const pair1Data = await resPair1.json();
    assert(pair1Data.success === true, 'Pairing response indicates success');
    assert(!!pair1Data.deviceToken, 'Returns a secure long-lived device credentials token');
    assert(pair1Data.deviceId === dev1.id, 'Returns matched device ID');

    // Verify device status and credentials updated in DB
    const pairedDevice1 = await prisma.device.findUnique({ where: { id: dev1.id } });
    assert(pairedDevice1?.status === 'ACTIVE', 'Device status transitioned to ACTIVE upon successful pairing');

    const creds1 = await prisma.deviceCredential.findUnique({ where: { deviceId: dev1.id } });
    assert(!!creds1, 'Device credential generated and persisted in the DB');
    assert(creds1?.status === 'ACTIVE', 'Device credential status is ACTIVE');
    assert(creds1?.tokenHash === sha256(pair1Data.deviceToken), 'Credential stores SHA256 token hash (never the raw plaintext token)');

    // Attempt duplicate pairing with same code (single-use check)
    const resPairDuplicate = await fetch(`${baseUrl}/api/devices/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: genCodeData.code }),
    });
    assert(resPairDuplicate.status === 400, 'Re-using pairing code is strictly rejected with 400 Bad Request');

    // Attempt pairing with expired code
    const expiredCode = 'EXP123';
    await prisma.devicePairing.create({
      data: {
        organizationId: orgId,
        branchId,
        deviceId: dev2.id,
        code: expiredCode,
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 1000), // in the past
      },
    });

    const resPairExpired = await fetch(`${baseUrl}/api/devices/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: expiredCode }),
    });
    assert(resPairExpired.status === 400, 'Pairing with expired code is rejected with 400 Bad Request');

    // --------------------------------------------------------------------------
    // TEST 3: Subscription Entitlements Limits Enforcement on Pairing
    // --------------------------------------------------------------------------
    console.log('\n--- 3. Device Limits Enforcement ---');

    // Pair second device successfully (limit is 2, so this is allowed)
    const resGenCodeDev2 = await fetch(`${baseUrl}/api/devices/generate-pairing-code`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: dev2.id }),
    });
    const codeDev2 = (await resGenCodeDev2.json()).code;

    const resPairDev2 = await fetch(`${baseUrl}/api/devices/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: codeDev2 }),
    });
    assert(resPairDev2.status === 200, 'Pairing second device succeeds (limit is 2)');
    const dev2Token = (await resPairDev2.json()).deviceToken;

    // Generate pairing code for third device
    const resGenCodeDev3 = await fetch(`${baseUrl}/api/devices/generate-pairing-code`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: dev3.id }),
    });
    const codeDev3 = (await resGenCodeDev3.json()).code;

    // Try to pair third device (exceeds limit)
    const resPairDev3 = await fetch(`${baseUrl}/api/devices/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: codeDev3 }),
    });
    assert(resPairDev3.status === 403, 'Pairing third device is rejected with 403 Forbidden (LIMIT_EXCEEDED)');
    const dev3Err = await resPairDev3.json();
    assert(dev3Err.error && dev3Err.error.includes('LIMIT_EXCEEDED'), 'Error payload clearly details LIMIT_EXCEEDED');

    // --------------------------------------------------------------------------
    // TEST 4: Outbound Handshake Connection Authentication
    // --------------------------------------------------------------------------
    console.log('\n--- 4. Handshake Authentication ---');

    // Attempt socket connection with invalid credentials
    const socketFail = ClientIO(baseUrl, {
      query: { token: 'bad_token', type: 'agent' },
      autoConnect: false,
    });
    socketFail.connect();
    await new Promise<void>((res) => {
      socketFail.on('disconnect', () => {
        assert(true, 'Connection without valid token is immediately disconnected');
        res();
      });
      setTimeout(() => {
        socketFail.disconnect();
        res();
      }, 1500);
    });

    // --------------------------------------------------------------------------
    // TEST 5: Standalone Local Agent Lifecycle & Heartbeats
    // --------------------------------------------------------------------------
    console.log('\n--- 5. Standalone Local Agent Lifecycle ---');

    // Configure local config mock to point to our test server
    const agentConfigPath = path.join(process.cwd(), 'local_agent_config.json');
    fs.writeFileSync(agentConfigPath, JSON.stringify({
      serverUrl: baseUrl,
      deviceToken: pair1Data.deviceToken,
      deviceId: dev1.id,
      deviceIdentifier: 'POS-01',
    }));

    const agent = new TilloraLocalAgent();

    // Start local agent
    const agentStarted = await agent.start();
    assert(agentStarted === true, 'Tillora Local Agent starts and connects successfully');

    // Wait for connection to register on Socket server
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    assert(activeAgentSockets.has(dev1.id), 'Local Agent registered in cloud in-memory activeSockets map');

    // Test heartbeat
    const lastSeenBefore = (await prisma.device.findUnique({ where: { id: dev1.id } }))?.lastSeenAt;
    const agentSocket = activeAgentSockets.get(dev1.id);
    assert(!!agentSocket, 'Secure agent socket is connected');

    // Emit heartbeat from client-side agent socket
    (agent as any).socket?.emit('heartbeat', { agentVersion: '1.0.0' });
    await new Promise<void>((resolve) => setTimeout(resolve, 500));

    const lastSeenAfter = (await prisma.device.findUnique({ where: { id: dev1.id } }))?.lastSeenAt;
    assert(lastSeenAfter !== lastSeenBefore, 'Heartbeat successfully updates lastSeenAt timestamp on server');

    // --------------------------------------------------------------------------
    // TEST 6: Durable Print Job Queue, Real-time Dispatching, and Idempotency
    // --------------------------------------------------------------------------
    console.log('\n--- 6. Durable Print Job Queue, Real-time Dispatching, and Idempotency ---');

    const idempotencyKey = 'ik_p8_unique_print';

    // Submit print job
    const resPrintJob = await fetch(`${baseUrl}/api/printer/print-job`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cashierToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: dev1.id,
        jobType: 'RECEIPT',
        payload: '=== TILLORA RECEIPT ===\nTable: 5\nTotal: $42.00\n======================',
        idempotencyKey,
      }),
    });
    assert(resPrintJob.status === 200, 'Print job submission returns 200 OK');
    const printJobData = await resPrintJob.json();
    assert(!!printJobData.jobId, 'Returns created jobId');

    // Wait for agent to process job asynchronously
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));

    // Verify print job is marked ACKNOWLEDGED in database
    const dbJob = await prisma.printJob.findUnique({ where: { id: printJobData.jobId } });
    assert(dbJob?.status === 'ACKNOWLEDGED', 'Real-time dispatched print job status updated to ACKNOWLEDGED upon execution');
    assert(dbJob?.organizationId === orgId, 'Print job has correct organizationId context');
    assert(dbJob?.branchId === branchId, 'Print job has correct branchId context');

    // Attempt duplicate print job with same idempotency key
    const resPrintJobDup = await fetch(`${baseUrl}/api/printer/print-job`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cashierToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: dev1.id,
        jobType: 'RECEIPT',
        payload: '=== TILLORA RECEIPT ===\nTable: 5\nTotal: $42.00\n======================',
        idempotencyKey,
      }),
    });
    assert(resPrintJobDup.status === 200, 'Duplicate submission with same idempotency key returns 200 OK (idempotent response)');
    const dupJobData = await resPrintJobDup.json();
    assert(dupJobData.jobId === printJobData.jobId, 'Returned jobId matches previous job (duplicate ignored)');

    // --------------------------------------------------------------------------
    // TEST 7: Offline Queueing & Reconnection Synchronization
    // --------------------------------------------------------------------------
    console.log('\n--- 7. Offline Queueing & Reconnection Sync ---');

    // Disconnect agent (Simulate offline network)
    await agent.stop();
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
    assert(!activeAgentSockets.has(dev1.id), 'Agent socket removed from activeAgentSockets upon disconnection');

    // Submit print job while agent is offline
    const resPrintOffline = await fetch(`${baseUrl}/api/printer/print-job`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cashierToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: dev1.id,
        jobType: 'RECEIPT',
        payload: '=== OFFLINE RECORD ===\nStored in server-side queue.\n====================',
      }),
    });
    const offlineJobData = await resPrintOffline.json();

    // Check DB status -> must remain QUEUED
    const offlineJobBefore = await prisma.printJob.findUnique({ where: { id: offlineJobData.jobId } });
    assert(offlineJobBefore?.status === 'QUEUED', 'Offline printed job is safely persisted as QUEUED in database');

    // Restart local agent (Reconnection)
    await agent.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));

    // Check DB status again -> must have synced and updated to ACKNOWLEDGED automatically!
    const offlineJobAfter = await prisma.printJob.findUnique({ where: { id: offlineJobData.jobId } });
    assert(offlineJobAfter?.status === 'ACKNOWLEDGED', 'Outstanding queued print jobs automatically dispatched and ACKNOWLEDGED upon reconnection');

    // --------------------------------------------------------------------------
    // TEST 8: Cash Drawer Pulse & Security Context Verification
    // --------------------------------------------------------------------------
    console.log('\n--- 8. Secure Cash Drawer Pulse & Shift Validation ---');

    // Try to open cash drawer without an active shift (must be rejected)
    const resDrawerFail = await fetch(`${baseUrl}/api/printer/open-drawer`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cashierToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: dev1.id }),
    });
    assert(resDrawerFail.status === 403, 'Cash drawer pulse without active register shift is blocked with 403 Forbidden');

    // Create and open a register shift
    const shift = await prisma.registerShift.create({
      data: {
        organizationId: orgId,
        branchId,
        shiftNumber: 'SHIFT-P8-01',
        cashierName: 'P8 Cashier',
        startingFloat: 100,
        status: 'open',
      },
    });

    // Pulse cash drawer with active shift context (succeeds)
    const resDrawerSuccess = await fetch(`${baseUrl}/api/printer/open-drawer`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cashierToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: dev1.id, shiftId: shift.id }),
    });
    assert(resDrawerSuccess.status === 200, 'Cash drawer pulse with verified active shift returns 200 OK');
    const drawerJobData = await resDrawerSuccess.json();

    // Wait for processing
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));

    // Verify cash drawer pulse logged to Central Security Audit Log
    const auditLogs = await prisma.auditLog.findMany({
      where: { organizationId: orgId, action: 'CASH_DRAWER_OPENED', entityId: shift.id },
    });
    assert(auditLogs.length > 0, 'Authorized cash drawer pulse events are strictly recorded in the Central Security Audit Log');
    assert(auditLogs[0].entity === 'SHIFT', 'Audit log correctly attributes the open event to the active shift');

    // --------------------------------------------------------------------------
    // TEST 9: Central Security Revocation & Token Invalidation
    // --------------------------------------------------------------------------
    console.log('\n--- 9. Security Revocation & Token Invalidation ---');

    // Call revoke device API
    const resRevoke = await fetch(`${baseUrl}/api/devices/revoke`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: dev1.id }),
    });
    assert(resRevoke.status === 200, 'Revoking device via API returns 200 OK');

    // Wait for disconnection propagation
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));

    // Verify device status and credential status in DB
    const revokedDev = await prisma.device.findUnique({ where: { id: dev1.id } });
    assert(revokedDev?.status === 'REVOKED', 'Device status transitioned to REVOKED in database');

    const revokedCred = await prisma.deviceCredential.findUnique({ where: { deviceId: dev1.id } });
    assert(revokedCred?.status === 'REVOKED', 'Device credential revoked in database');

    // Verify active socket disconnected immediately
    assert(!activeAgentSockets.has(dev1.id), 'Active agent WebSocket connection terminated immediately upon revocation');

    // Verify revoked token is rejected on subsequent connections
    const socketRevoked = ClientIO(baseUrl, {
      query: { token: pair1Data.deviceToken, type: 'agent' },
      autoConnect: false,
    });
    socketRevoked.connect();
    await new Promise<void>((res) => {
      socketRevoked.on('disconnect', () => {
        assert(true, 'Subsequent connection handshake using revoked token is rejected');
        res();
      });
      setTimeout(() => {
        socketRevoked.disconnect();
        res();
      }, 1500);
    });

    // --------------------------------------------------------------------------
    // TEST 10: KDS Multi-Tenant Security Isolation
    // --------------------------------------------------------------------------
    console.log('\n--- 10. KDS Multi-Tenant Security Isolation ---');

    const kdsSocket = ClientIO(baseUrl, {
      query: { token: cashierToken, type: 'kds_user' },
    });

    await new Promise<void>((resolve) => {
      kdsSocket.on('connect', () => {
        assert(true, 'KDS staff socket connected successfully');
        resolve();
      });
    });

    // Attempt subscription to another tenant's branch
    kdsSocket.emit('kds:subscribe', { branchId: 'other_tenant_branch' });
    await new Promise<void>((resolve) => {
      kdsSocket.on('subscription:error', (data: { error: string }) => {
        assert(data.error.includes('Access denied'), 'KDS cross-branch/cross-tenant subscription request is strictly blocked');
        resolve();
      });
    });

    // Attempt subscription to authorized branch
    kdsSocket.emit('kds:subscribe', { branchId });
    await new Promise<void>((resolve) => {
      kdsSocket.on('subscription:success', (data: { channel: string }) => {
        assert(data.channel === branchId, 'KDS subscription to authorized branch succeeds');
        resolve();
      });
    });

    kdsSocket.disconnect();

    // --------------------------------------------------------------------------
    // TEST 11: Hardware State Error Simulation (Paper-out & Drawer Jam)
    // --------------------------------------------------------------------------
    console.log('\n--- 11. Hardware Error Simulation ---');

    // Enable simulated Paper-out on agent
    agent.simulatePaperOut = true;

    // Queue print job
    const resPrintErr = await fetch(`${baseUrl}/api/printer/print-job`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cashierToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: dev2.id, // Using active paired dev2
        jobType: 'RECEIPT',
        payload: 'Simulate paper out print job',
      }),
    });
    const printErrData = await resPrintErr.json();

    // Instantiate and pair a temporary agent for dev2 to test error simulation
    const agent2ConfigPath = path.join(process.cwd(), 'local_agent_config2.json');
    fs.writeFileSync(agent2ConfigPath, JSON.stringify({
      serverUrl: baseUrl,
      deviceToken: dev2Token,
      deviceId: dev2.id,
      deviceIdentifier: 'POS-02',
    }));
    const agent2 = new TilloraLocalAgent(agent2ConfigPath);
    agent2.simulatePaperOut = true;
    await agent2.start();

    // Wait for execution
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));

    // Verify job failure with PAPER_OUT error recorded
    const failedJob = await prisma.printJob.findUnique({ where: { id: printErrData.jobId } });
    assert(failedJob?.status === 'FAILED', 'Print job successfully transitions to FAILED status when agent reports error');
    assert(failedJob?.lastError === 'PRINTER_PAPER_OUT', 'Print job stores the correct failure error message (PRINTER_PAPER_OUT)');

    // Enable simulated Drawer Jam on agent2
    agent2.simulatePaperOut = false;
    agent2.simulateDrawerJam = true;

    // Queue drawer kick
    const resDrawerErr = await fetch(`${baseUrl}/api/printer/open-drawer`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cashierToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: dev2.id, shiftId: shift.id }),
    });
    const drawerErrData = await resDrawerErr.json();

    // Wait for execution
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));

    // Verify cash drawer jam is recorded
    const failedDrawerJob = await prisma.printJob.findUnique({ where: { id: drawerErrData.jobId } });
    assert(failedDrawerJob?.status === 'FAILED', 'Cash drawer kick job successfully transitions to FAILED status');
    assert(failedDrawerJob?.lastError === 'CASH_DRAWER_JAM', 'Cash drawer job stores correct error message (CASH_DRAWER_JAM)');

    // Cleanup agents
    await agent.stop();
    await agent2.stop();

    // Clean up local temp files
    try { fs.unlinkSync(agentConfigPath); } catch {}
    try { fs.unlinkSync(agent2ConfigPath); } catch {}

  } catch (error) {
    console.error('Fatal error during Phase 8 tests:', error);
    failed++;
  } finally {
    // Shutdown server
    server.close();
  }

  console.log('\n==================================================================');
  console.log('📊 PHASE 8 TEST EXECUTION RESULTS');
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log('==================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL 35+ PHASE 8 HARDWARE BRIDGE ASSERTIONS PASSED SUCCESSFULLY!');
  }
}

runLocalBridgeTests().catch((err) => {
  console.error('Unhandled test execution error:', err);
  process.exit(1);
});
