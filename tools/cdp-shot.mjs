// Capturas fiables con Chrome headless vía Chrome DevTools Protocol (sin dependencias).
// Uso: node tools/cdp-shot.mjs jobs.json
// jobs.json = [{ "name": "hero", "url": "http://localhost:5173/", "width": 1280, "height": 720,
//                "mobile": false, "steps": [{ "eval": "scrollTo(0,0)", "wait": 300 }], "out": "tools/out/shots/hero.png" }]
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.env.CDP_PORT) || 9333; // CDP_PORT=9335 para lanzar dos suites a la vez sin compartir Chrome
const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--disable-gpu', '--hide-scrollbars',
  '--no-first-run', '--no-default-browser-check', '--force-device-scale-factor=1',
  '--window-size=1280,720', 'about:blank',
], { stdio: 'ignore' });

let wsUrl = null;
for (let i = 0; i < 50 && !wsUrl; i++) {
  await sleep(200);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
  } catch { /* aún no */ }
}
if (!wsUrl) { chrome.kill(); throw new Error('Chrome no responde en el puerto de depuración'); }

const ws = new WebSocket(wsUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0;
const pending = new Map();
const events = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  else if (msg.method === 'Runtime.exceptionThrown') console.warn('[page exception]', msg.params.exceptionDetails.text, (msg.params.exceptionDetails.exception?.description || '').split(String.fromCharCode(10))[0]);
  else if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) console.warn(`[console.${msg.params.type}]`, msg.params.args.map((a) => a.value ?? a.description).join(' '));
  else if (msg.method) events.push(msg);
};
const send = (method, params = {}) => new Promise((resolve) => {
  const i = ++id;
  pending.set(i, resolve);
  ws.send(JSON.stringify({ id: i, method, params }));
});
const waitEvent = (method, timeout = 15000) => new Promise((resolve) => {
  const t0 = Date.now();
  const tick = () => {
    const idx = events.findIndex((e) => e.method === method);
    if (idx >= 0) { const e = events.splice(idx, 1)[0]; resolve(e); return; }
    if (Date.now() - t0 > timeout) { resolve(null); return; }
    setTimeout(tick, 30);
  };
  tick();
});

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

for (const job of jobs) {
  const width = job.width || 1280, height = job.height || 720;
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: job.scale || 1, mobile: !!job.mobile });
  if (job.mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  else await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  // cada job parte de la misma emulacion de medios: si no la pide, se restablece (antes se colaba de un job al siguiente)
  await send('Emulation.setEmulatedMedia', { features: job.media || [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  events.length = 0;
  await send('Page.navigate', { url: job.url });
  await waitEvent('Page.loadEventFired');
  await sleep(job.settle ?? 600);
  for (const step of job.steps || []) {
    if (step.click) {
      // clic real (con activación de usuario) en el centro del elemento
      const r = await send('Runtime.evaluate', { expression: `(() => { const el = document.querySelector(${JSON.stringify(step.click)}); if (!el) return null; const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`, returnByValue: true });
      const pt = r.result?.result?.value;
      if (!pt) { console.warn(`[${job.name}] no existe ${step.click}`); continue; }
      const [x, y] = pt;
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    }
    if (step.key) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: step.key, code: step.code || step.key, windowsVirtualKeyCode: step.keyCode || 0, text: step.text ?? (step.key === 'Enter' ? String.fromCharCode(13) : step.key === ' ' ? ' ' : undefined) });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: step.key, code: step.code || step.key, windowsVirtualKeyCode: step.keyCode || 0 });
    }
    if (step.eval) {
      const r = await send('Runtime.evaluate', { expression: step.eval, awaitPromise: true, returnByValue: true });
      if (r.result?.exceptionDetails) console.warn(`[${job.name}] error en eval:`, r.result.exceptionDetails.text);
      if (step.print && r.result?.result) console.log(`[${job.name}]`, JSON.stringify(r.result.result.value));
    }
    if (step.wait) await sleep(step.wait);
  }
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  mkdirSync(dirname(job.out), { recursive: true });
  writeFileSync(job.out, Buffer.from(shot.result.data, 'base64'));
  console.log(`${job.name} -> ${job.out}`);
}
ws.close();
chrome.kill();
