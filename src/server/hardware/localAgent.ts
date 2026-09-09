import { io, Socket } from 'socket.io-client';
import fs from 'fs';
import path from 'path';
import net from 'net';

export interface LocalAgentConfig {
  serverUrl: string;
  deviceId?: string;
  deviceToken?: string;
  deviceIdentifier?: string;
  name?: string;
  organizationId?: string;
  branchId?: string;
}

export class TilloraLocalAgent {
  private configPath: string;
  private config: LocalAgentConfig;
  private socket: Socket | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isShuttingDown = false;

  // Simulation flags for testing
  public simulateOffline = false;
  public simulatePaperOut = false;
  public simulateDrawerJam = false;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'local_agent_config.json');
    this.config = this.loadConfig();
  }

  /**
   * Load agent configuration from local disk.
   */
  private loadConfig(): LocalAgentConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('[LocalAgent] Error reading config file:', err);
    }
    return { serverUrl: process.env.VITE_API_URL || 'http://localhost:3000' };
  }

  /**
   * Persist agent configuration securely to disk.
   */
  private saveConfig(newConfig: Partial<LocalAgentConfig>) {
    this.config = { ...this.config, ...newConfig };
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), {
        encoding: 'utf-8',
        mode: 0o600, // Read/write only for the owner of the run context (Hardened)
      });
    } catch (err) {
      console.error('[LocalAgent] Error saving config file:', err);
    }
  }

  /**
   * Starts the local agent. If not paired, it will try to pair if a code is provided,
   * otherwise it will wait or throw.
   */
  public async start(pairingCode?: string): Promise<boolean> {
    console.log('[LocalAgent] Starting Tillora Local Agent...');
    this.isShuttingDown = false;

    if (!this.config.deviceToken) {
      if (pairingCode) {
        const paired = await this.pairWithCloud(pairingCode);
        if (!paired) {
          console.error('[LocalAgent] Initial pairing failed. Outbound connection aborted.');
          return false;
        }
      } else {
        console.warn('[LocalAgent] No device token stored and no pairing code provided. Waiting for pairing...');
        return false;
      }
    }

    this.connectToCloud();
    return true;
  }

  /**
   * Stops the agent and releases all resources.
   */
  public async stop(): Promise<void> {
    console.log('[LocalAgent] Stopping Tillora Local Agent...');
    this.isShuttingDown = true;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Invokes secure device pairing API on Tillora Cloud.
   */
  public async pairWithCloud(code: string): Promise<boolean> {
    try {
      console.log(`[LocalAgent] Attempting device pairing with code: ${code}...`);
      const response = await fetch(`${this.config.serverUrl}/api/devices/pair`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.success) {
          const { deviceId, deviceToken, deviceIdentifier, name, organizationId, branchId } = data;
          this.saveConfig({
            deviceId,
            deviceToken,
            deviceIdentifier,
            name,
            organizationId,
            branchId,
          });
          console.log(`[LocalAgent] Pairing SUCCESSFUL! Device paired as ${deviceIdentifier}`);
          return true;
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        console.error('[LocalAgent] Pairing API failed:', errData.error || response.statusText);
      }
    } catch (err: any) {
      console.error('[LocalAgent] Pairing API failed:', err.message);
    }
    return false;
  }

  /**
   * Establishes the secure persistent outbound WebSocket connection to Tillora Cloud.
   */
  private connectToCloud() {
    if (!this.config.deviceToken) {
      console.error('[LocalAgent] Cannot connect: Missing deviceToken.');
      return;
    }

    const token = this.config.deviceToken;
    const url = this.config.serverUrl;

    console.log(`[LocalAgent] Connecting to Tillora Cloud at ${url}...`);

    this.socket = io(url, {
      query: {
        token,
        type: 'agent',
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000, // Exponential backoff max delay (Hardened)
      randomizationFactor: 0.5,
    });

    this.socket.on('connect', () => {
      console.log('[LocalAgent] Outbound connection to cloud established successfully.');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
    });

    this.socket.on('disconnect', (reason) => {
      console.warn(`[LocalAgent] Disconnected from cloud. Reason: ${reason}`);
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.error(`[LocalAgent] Connection error: ${error.message}. Retrying in ${delay}ms...`);
    });

    // Listen for incoming hardware execution jobs
    this.socket.on('job:execute', async (job: { id: string; jobType: string; payload: string; idempotencyKey?: string }) => {
      console.log(`[LocalAgent] Received job: [Type: ${job.jobType}] ID: ${job.id}`);
      await this.executeHardwareJob(job);
    });

    // Revocation command listener
    this.socket.on('auth:revoked', (data: { message: string }) => {
      console.error(`[LocalAgent] Central security revocation received: ${data.message}`);
      this.saveConfig({ deviceToken: undefined }); // Erase credentials immediately
      this.stop();
    });
  }

  /**
   * Executes a queued print/pulse job on LAN hardware.
   */
  private async executeHardwareJob(job: { id: string; jobType: string; payload: string }) {
    if (!this.socket) return;

    try {
      // 1. Check simulated printer state failures (paper-out, offline, disconnected)
      if (this.simulateOffline) {
        console.warn(`[LocalAgent Simulation] Job FAILED: Printer is OFFLINE.`);
        this.socket.emit('job:ack', { jobId: job.id, status: 'failed', error: 'PRINTER_OFFLINE' });
        return;
      }

      if (this.simulatePaperOut && job.jobType !== 'CASH_DRAWER') {
        console.warn(`[LocalAgent Simulation] Job FAILED: Printer is PAPER_OUT.`);
        this.socket.emit('job:ack', { jobId: job.id, status: 'failed', error: 'PRINTER_PAPER_OUT' });
        return;
      }

      if (this.simulateDrawerJam && job.jobType === 'CASH_DRAWER') {
        console.warn(`[LocalAgent Simulation] Job FAILED: Cash drawer sensor detects JAM.`);
        this.socket.emit('job:ack', { jobId: job.id, status: 'failed', error: 'CASH_DRAWER_JAM' });
        return;
      }

      // 2. Process physical connection (simulated net socket connection or actual LAN write)
      console.log(`[LocalAgent Executor] Processing LAN operation for job #${job.id}...`);

      if (job.jobType === 'CASH_DRAWER') {
        // Mocking LAN cash drawer trigger
        console.log(`[LocalAgent Hardware] [SUCCESS] Transmitting pulse command (ESC p m t1 t2) to drawer relay.`);
      } else {
        // Mocking LAN receipt printer writing
        console.log(`[LocalAgent Hardware] [SUCCESS] Spooling ${job.payload.length} ESC/POS command bytes.`);
      }

      // Successfully processed! Notify Tillora Cloud to mark queue complete.
      this.socket.emit('job:ack', { jobId: job.id, status: 'success' });
      console.log(`[LocalAgent Executor] Job #${job.id} marked as ACKNOWLEDGED.`);
    } catch (err: any) {
      console.error(`[LocalAgent Executor] Error executing job #${job.id}:`, err);
      this.socket.emit('job:ack', { jobId: job.id, status: 'failed', error: err.message || 'LAN_WRITE_FAILURE' });
    }
  }

  /**
   * Periodically emits a heartbeat to keep connection alive and update state.
   */
  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.socket.connected) {
        console.log('[LocalAgent] Sending heartbeat...');
        this.socket.emit('heartbeat', {
          agentVersion: '1.0.0',
          capabilities: ['PRINT_RECEIPT', 'PRINT_KITCHEN', 'CASH_DRAWER'],
          simulationState: {
            offline: this.simulateOffline,
            paperOut: this.simulatePaperOut,
            drawerJam: this.simulateDrawerJam,
          },
        });
      }
    }, 30000);
  }
}
