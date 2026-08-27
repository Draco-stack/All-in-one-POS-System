/**
 * Hardware Integration Service for ESC/POS Thermal Printers
 * 
 * In a standard web browser, `window.print()` intercepts raw ESC/POS hex codes.
 * For true hardware-level control (like popping a physical cash drawer), we use
 * the Web Serial API / WebUSB API to send the raw hex bytes directly to the 
 * connected thermal printer, bypassing the OS print spooler.
 */

export const ESC_POS_COMMANDS = {
  // ESC p <drawer> <pulse1> <pulse2>
  // \x1B = ESC (27)
  // \x70 = p (112)
  // \x00 = drawer 1 (0)
  // \x19 = 25ms pulse ON (25)
  // \xFA = 250ms pulse OFF (250)
  KICK_DRAWER_1: new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]),
  KICK_DRAWER_2: new Uint8Array([0x1b, 0x70, 0x01, 0x19, 0xfa]),
};

let cachedPort: any = null;

export const connectAndKickDrawer = async () => {
  try {
    // Web Serial requires HTTPS and browser feature permission policy support
    if (typeof window === 'undefined' || !('serial' in navigator)) {
      return false;
    }

    if (!cachedPort) {
      try {
        cachedPort = await (navigator as any).serial.requestPort();
        await cachedPort.open({ baudRate: 9600 });
      } catch (err: any) {
        // Handle iframe sandbox permissions policy restrictions or user cancellation gracefully
        if (
          err?.name === 'SecurityError' ||
          err?.name === 'NotAllowedError' ||
          err?.message?.includes('permissions policy') ||
          err?.message?.includes('disallowed')
        ) {
          console.info('[Hardware] Web Serial API skipped (iframe sandbox permissions policy restriction). Thermal print ESC/POS fallback active.');
          return false;
        }
        throw err;
      }
    }

    if (cachedPort?.writable) {
      const writer = cachedPort.writable.getWriter();
      await writer.write(ESC_POS_COMMANDS.KICK_DRAWER_1);
      writer.releaseLock();
      console.log('✓ Cash drawer kick signal sent successfully.');
      return true;
    }
    
    return false;
  } catch (error: any) {
    cachedPort = null;
    return false;
  }
};
