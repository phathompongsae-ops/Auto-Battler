// Minimal Chrome DevTools Protocol driver for browser tests (no dependencies).
import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (found) return found;
  for (const name of ['google-chrome', 'chromium', 'chromium-browser']) {
    try {
      return execSync(`command -v ${name}`, { encoding: 'utf8' }).trim();
    } catch {}
  }
  throw new Error('Chrome not found. Set CHROME_PATH.');
}

const KEY_CODES = {
  ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40,
  KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68,
  KeyQ: 81, KeyE: 69, KeyR: 82, Space: 32, Tab: 9,
};
const keyName = (code) =>
  code === 'Space' ? ' ' : code === 'Tab' ? 'Tab' : code.startsWith('Key') ? code.slice(3).toLowerCase() : code;

export class Browser {
  static async launch({ port = 9333, width = 960, height = 540 } = {}) {
    const profile = join(tmpdir(), `phaser-test-profile-${process.pid}`);
    rmSync(profile, { recursive: true, force: true });
    const proc = spawn(findChrome(), [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-sandbox',
      '--enable-unsafe-swiftshader',
      `--window-size=${width},${height}`,
      'about:blank',
    ], { stdio: 'ignore' });

    let target;
    for (let i = 0; i < 100 && !target; i++) {
      try {
        target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
      } catch {
        await sleep(100);
      }
    }
    if (!target) throw new Error('Chrome did not start');
    const browser = new Browser(proc, profile, width, height);
    await browser.connect(target.webSocketDebuggerUrl);
    return browser;
  }

  constructor(proc, profile, width, height) {
    this.proc = proc;
    this.profile = profile;
    this.width = width;
    this.height = height;
    this.nextId = 1;
    this.pending = new Map();
    this.consoleErrors = [];
  }

  async connect(url) {
    this.ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (event) => this.onMessage(JSON.parse(event.data));
    await this.send('Runtime.enable');
    await this.send('Log.enable');
    await this.send('Page.enable');
    await this.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await this.setViewport({ mobile: false });
  }

  onMessage(msg) {
    if (msg.id && this.pending.has(msg.id)) {
      const p = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
      else p.resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      this.consoleErrors.push(d.exception?.description ?? d.text);
    } else if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
      this.consoleErrors.push(`${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description).join(' ')}`);
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      this.consoleErrors.push(`log: ${msg.params.entry.text} ${msg.params.entry.url ?? ''}`);
    }
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
  }

  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      throw new Error(`eval failed: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}\n  in: ${expression}`);
    }
    return r.result.value;
  }

  /** Poll an expression until it is truthy. Returns its value, or throws on timeout. */
  async waitFor(expression, { timeout = 5000, interval = 50, label } = {}) {
    const end = Date.now() + timeout;
    let last;
    while (Date.now() < end) {
      try {
        last = await this.eval(expression);
        if (last) return last;
      } catch {}
      await sleep(interval);
    }
    throw new Error(`Timed out waiting for ${label ?? expression} (last: ${JSON.stringify(last)})`);
  }

  async setViewport({ mobile }) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width: this.width,
      height: this.height,
      deviceScaleFactor: 1,
      mobile,
    });
  }

  async goto(url) {
    await this.send('Page.navigate', { url });
  }

  async reload() {
    await this.send('Page.reload', { ignoreCache: true });
  }

  keyDown(code) {
    return this.send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: keyName(code), windowsVirtualKeyCode: KEY_CODES[code] });
  }

  keyUp(code) {
    return this.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: keyName(code), windowsVirtualKeyCode: KEY_CODES[code] });
  }

  /** Tap a key: down, short hold, up. */
  async press(code, holdMs = 40) {
    await this.keyDown(code);
    await sleep(holdMs);
    await this.keyUp(code);
  }

  mouse(type, x, y) {
    return this.send('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button: 'left',
      buttons: type === 'mouseReleased' ? 0 : 1,
      clickCount: 1,
    });
  }

  touch(type, x, y) {
    return this.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  }

  async screenshot(path) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path, Buffer.from(r.data, 'base64'));
  }

  async close() {
    try {
      this.ws?.close();
    } catch {}
    this.proc.kill();
    await sleep(300);
    rmSync(this.profile, { recursive: true, force: true, maxRetries: 3 });
  }
}

/** Collects pass/fail checks for a run. */
export class Checks {
  constructor() {
    this.results = [];
  }

  check(name, ok, detail = '') {
    this.results.push({ name, ok: !!ok, detail });
    console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
    return !!ok;
  }

  section(title) {
    console.log(`\n${title}`);
  }

  get failed() {
    return this.results.filter((r) => !r.ok);
  }
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}
