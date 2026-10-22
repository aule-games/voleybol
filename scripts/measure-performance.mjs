// Local built-output measurement only. No content mocks, date changes or production instrumentation.
import { chromium, webkit } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import os from 'node:os';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const output = resolve(process.argv[2] ?? `.gstack/benchmark-reports/${new Date().toISOString().replaceAll(':', '-')}`);
const origin = 'http://127.0.0.1:4176';
const routes = ['home', 'tahmin', 'takim', 'quiz'];
const report = {
  startedAt: new Date().toISOString(), machine: { platform: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model, node: process.version },
  protocol: {
    viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, samplesPerCacheMode: 5,
    chromium: { cpuSlowdown: 4, downloadBitsPerSecond: 1_600_000, uploadBitsPerSecond: 1_600_000, latencyMs: 150 },
    webkit: 'Unthrottled comparison only. No equivalent CPU/network throttle or CLS API is assumed.',
    cold: 'New browser context; Chromium HTTP cache explicitly cleared before navigation.',
    warm: 'Same context after one unmeasured priming navigation; normal reload, cache headers unchanged. Revalidation is not a memory-cache hit.',
    usable: 'First animation frame after a mode-specific visible enabled control and valid rendered content exist; followed by a real interaction after metric collection.',
    observation: 'At least five seconds after navigation before interaction; CLS maximum session window, excluding recent input.',
    host: 'Loopback Vite preview of dist; NOT production/CDN latency or cache proof. Real current demo content, no clock mock.',
    limits: 'Five samples report median/worst, never p95. No earlier timing baseline. Native phone/OS and physical GPU memory remain unmeasured.',
  }, inputs: [], bundles: [], runs: [], summary: [],
};
await mkdir(output, { recursive: true });
for (const path of ['public/content.json', 'package-lock.json', 'scripts/measure-performance.mjs', 'dist/index.html', ...(await readdir('dist/assets')).map(p => `dist/assets/${p}`)]) {
  const bytes = await readFile(path);
  report.inputs.push({ path, sha256: createHash('sha256').update(bytes).digest('hex') });
  if (path.endsWith('.js') && path.startsWith('dist/')) report.bundles.push({ path, bytes: bytes.length, gzipBytes: gzipSync(bytes).length });
}
const jsGzipBytes = report.bundles.reduce((sum, b) => sum + b.gzipBytes, 0);
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4176', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = ''; server.stdout.on('data', b => { serverLog += b; }); server.stderr.on('data', b => { serverLog += b; });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(`Preview exited: ${serverLog}`);
    try { ready = (await fetch(origin)).ok; } catch { /* Startup only. Timings come from browsers. */ }
    if (ready) break; await delay(100);
  }
  if (!ready) throw new Error('Preview startup timed out');
  for (const [engine, launcher] of [['chromium', chromium], ['webkit', webkit]]) {
    browser = await launcher.launch();
    for (const mode of routes) for (const cache of ['cold', 'warm']) {
      let warmContext;
      try {
        for (let sample = 1; sample <= 5; sample++) {
          const context = warmContext ?? await browser.newContext({ viewport: report.protocol.viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
          if (cache === 'warm') warmContext = context;
          const page = context.pages()[0] ?? await context.newPage();
          if (sample === 1 || cache === 'cold') {
            if (engine === 'chromium') {
              const cdp = await context.newCDPSession(page);
              await cdp.send('Network.enable');
              await cdp.send('Network.clearBrowserCache');
              await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
              await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 200_000, connectionType: 'cellular4g' });
            }
            await page.addInitScript(mode => {
              const m = { usable: null, cls: null, lcp: null, shifts: [] };
              window.__performanceRun = m;
              const supported = PerformanceObserver.supportedEntryTypes;
              if (supported.includes('layout-shift')) {
                m.cls = 0; let start = 0; let last = 0; let value = 0;
                new PerformanceObserver(list => {
                  for (const entry of list.getEntries()) {
                    if (entry.hadRecentInput) continue;
                    if (entry.startTime - last > 1000 || entry.startTime - start > 5000) { start = entry.startTime; value = 0; }
                    last = entry.startTime; value += entry.value; m.cls = Math.max(m.cls, value);
                    m.shifts.push({ time: entry.startTime, value: entry.value });
                  }
                }).observe({ type: 'layout-shift', buffered: true });
              }
              if (supported.includes('largest-contentful-paint')) new PerformanceObserver(list => {
                m.lcp = list.getEntries().at(-1)?.startTime ?? m.lcp;
              }).observe({ type: 'largest-contentful-paint', buffered: true });
              const check = () => {
                const main = document.querySelector(`main[data-mode="${mode}"]`);
                const selector = { home: '.featured-match a', tahmin: 'input[type="radio"]:not(:disabled)', takim: '#slot-0:not(:disabled)', quiz: '.quiz-welcome button:not(:disabled)' }[mode];
                const control = main?.querySelector(selector);
                if (m.usable === null && control?.getClientRects().length) requestAnimationFrame(() => {
                  if (m.usable === null && control.isConnected && control.getClientRects().length) m.usable = performance.now();
                });
              };
              new MutationObserver(check).observe(document, { childList: true, subtree: true, attributes: true });
              document.addEventListener('DOMContentLoaded', check);
            }, mode);
          }
          const url = `${origin}/#/${mode === 'home' ? '' : mode}`;
          if (cache === 'warm' && sample === 1) {
            await page.goto(url); await page.waitForFunction(() => typeof window.__performanceRun?.usable === 'number', undefined, { timeout: 15_000 });
          }
          const requests = []; const errors = [];
          const onRequest = request => requests.push({ path: new URL(request.url()).pathname, local: new URL(request.url()).origin === origin });
          const onError = e => errors.push(e.message);
          page.on('request', onRequest); page.on('pageerror', onError);
          if (cache === 'warm') await page.reload({ waitUntil: 'load' });
          else await page.goto(url, { waitUntil: 'load' });
          await page.waitForFunction(() => typeof window.__performanceRun?.usable === 'number', undefined, { timeout: 15_000 });
          await page.waitForFunction(() => performance.now() >= 5000);
          const metrics = await page.evaluate(() => {
            const nav = performance.getEntriesByType('navigation')[0];
            const resources = performance.getEntriesByType('resource').map(r => ({ path: new URL(r.name).pathname, initiator: r.initiatorType, duration: r.duration, transferBytes: r.transferSize, encodedBytes: r.encodedBodySize, decodedBytes: r.decodedBodySize, responseStatus: r.responseStatus ?? null }));
            return { ...window.__performanceRun, fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
              ttfb: nav.responseStart - nav.requestStart, domInteractive: nav.domInteractive, load: nav.loadEventEnd,
              resources, observationMs: performance.now(), navigation: nav.toJSON() };
          });
          // A timing marker alone is not evidence that an interaction works.
          if (mode === 'home') {
            await page.locator('.featured-match a').first().click();
            await page.locator('main[data-mode="tahmin"] input[type="radio"]').first().waitFor();
          } else if (mode === 'tahmin') {
            const radio = page.locator('input[type="radio"]:not(:disabled)').first(); await radio.check();
            if (!(await radio.isChecked())) throw new Error('Prediction interaction failed');
          } else if (mode === 'takim') {
            await page.locator('#slot-0').click(); await page.locator('.player-option').first().waitFor();
          } else {
            await page.getByRole('button', { name: 'Quiz’e başla' }).click(); await page.getByRole('radio').first().waitFor();
          }
          page.off('request', onRequest); page.off('pageerror', onError);
          // Interactions can change the fragment. Restore the benchmark URL before the next reload.
          await page.evaluate(url => history.replaceState(null, '', url), url);
          const row = { engine, version: browser.version(), mode, cache, sample, ...metrics, requests, errors, interactionPassed: true };
          report.runs.push(row);
          await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
          console.log(`${engine} ${mode} ${cache} ${sample}/5: usable=${Math.round(metrics.usable)}ms CLS=${metrics.cls ?? 'N/A'}`);
          if (cache === 'cold') await context.close();
        }
      } finally { await warmContext?.close(); }
    }
    await browser.close(); browser = null;
  }
  const stats = values => {
    const valid = values.filter(v => typeof v === 'number').sort((a, b) => a - b);
    return valid.length ? { median: valid[Math.floor(valid.length / 2)], worst: valid.at(-1), samples: valid.length } : null;
  };
  for (const engine of ['chromium', 'webkit']) for (const mode of routes) for (const cache of ['cold', 'warm']) {
    const runs = report.runs.filter(r => r.engine === engine && r.mode === mode && r.cache === cache);
    report.summary.push({ engine, mode, cache, usable: stats(runs.map(r => r.usable)), cls: stats(runs.map(r => r.cls)), fcp: stats(runs.map(r => r.fcp)), lcp: stats(runs.map(r => r.lcp)),
      contentRequests: runs.map(r => r.resources.filter(x => x.path === '/content.json').length), errors: runs.flatMap(r => r.errors) });
  }
  report.finishedAt = new Date().toISOString();
  report.budgets = { jsGzipBytes, jsCapBytes: 102400, chromiumUsableMs: 2500, chromiumCls: 0.1 };
  report.pass = jsGzipBytes <= 102400 && report.runs.every(r => r.errors.length === 0 && r.requests.every(q => q.local) && r.resources.filter(x => x.path === '/content.json').length === 1 &&
    (r.engine !== 'chromium' || (r.usable <= 2500 && r.cls !== null && r.cls <= 0.1)));
  await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
  const rows = report.summary.map(s => `| ${s.engine} | ${s.mode} | ${s.cache} | ${Math.round(s.usable.median)} / ${Math.round(s.usable.worst)} | ${s.cls ? `${s.cls.median.toFixed(4)} / ${s.cls.worst.toFixed(4)}` : 'N/A'} |`);
  await writeFile(`${output}/report.md`, `# Built-output performance\n\n${JSON.stringify(report.machine)}\n\nProtocol and raw evidence: results.json. Chromium: 4x CPU, 1.6 Mbps, 150 ms latency. WebKit: unthrottled comparison, not equivalent evidence. Five cold and five warm reloads per route. No p95 or production claim. JS gzip: ${jsGzipBytes} bytes / 102400 cap.\n\n| Engine | Route | Cache | Usable median / worst ms | CLS median / worst |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\nMeasured Chromium budgets: ${report.pass ? 'PASS' : 'FAIL'}. Physical-device and comparable throttled WebKit gates remain OPEN.\n`);
  console.log(`REPORT ${output}/report.md`);
  if (!report.pass) process.exitCode = 1;
} catch (error) {
  report.failure = String(error); report.finishedAt = new Date().toISOString();
  await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
  throw error;
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await writeFile(`${output}/server.log`, serverLog);
}
