import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const server = await createServer();
await server.listen();
const environment = { ...process.env, TRIP_PLANNER_DEV_URL: 'http://127.0.0.1:5173' };
delete environment.ELECTRON_RUN_AS_NODE;
const electron = spawn(require('electron'), ['.'], { stdio: 'inherit', env: environment });
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  electron.kill();
  await server.close();
}
electron.on('exit', async code => { await stop(); process.exitCode = code ?? 1; });
electron.on('error', async error => { console.error(error); await stop(); process.exitCode = 1; });
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
