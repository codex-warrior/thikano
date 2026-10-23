// Wait until the given emulator TCP ports are free. On Windows the Firestore emulator's Java
// process can outlive `emulators:exec`; after 10 s we stop whatever still listens on these
// (local emulator) ports so the next emulator run can start.
import { execSync } from 'node:child_process';
import { createServer } from 'node:net';

const ports = process.argv.slice(2).map(Number);
const free = (port) =>
  new Promise((resolve) => {
    const s = createServer()
      .once('error', () => resolve(false))
      .once('listening', () => s.close(() => resolve(true)));
    s.listen(port, '127.0.0.1');
  });

const start = Date.now();
let killed = false;
for (;;) {
  const results = await Promise.all(ports.map(free));
  const busy = ports.filter((_, i) => !results[i]);
  if (!busy.length) process.exit(0);
  if (!killed && process.platform === 'win32' && Date.now() - start > 10_000) {
    killed = true;
    const list = busy.join(',');
    execSync(`powershell -NoProfile -Command "foreach($p in ${list}){ Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | % { try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction Stop } catch {} } }"`, { stdio: 'ignore' });
    console.log(`Stopped stale emulator on port(s) ${list}`);
  }
  if (Date.now() - start > 60_000) {
    console.error(`Ports still busy: ${busy.join(', ')}`);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 500));
}
