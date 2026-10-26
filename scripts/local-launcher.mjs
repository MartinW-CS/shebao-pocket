import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer, createConnection } from 'node:net';
import { mkdir, readFile, writeFile, readdir, stat, rm, chmod, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const RUNTIME = path.join(ROOT, '.sites-runtime/local-launcher');
const LOG = path.join(RUNTIME, 'startup.log');
const URL_HOME = 'http://127.0.0.1:5173/';
const SOCKET = `/tmp/bys-${process.getuid?.() ?? 'user'}-${createHash('sha256').update(ROOT).digest('hex').slice(0, 12)}.sock`;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export function supportedNode(version) {
  if (!/^v?\d+\.\d+\.\d+(?:[-+].*)?$/.test(version)) return false;
  const [major, minor] = version.replace(/^v/, '').split('.').map(Number);
  return major > 22 || (major === 22 && minor >= 15);
}

export function describeProbe(status, body) {
  if (status === 200 && body?.app === 'shebao-pocket' && body?.localLauncher === 1) return 'ours';
  return 'occupied';
}

async function probe() {
  try {
    const response = await fetch(`${URL_HOME}api/local-status`, { signal: AbortSignal.timeout(1800), redirect: 'manual' });
    const body = await response.json().catch(() => null);
    return describeProbe(response.status, body);
  } catch (error) {
    return error.cause?.code === 'ECONNREFUSED' ? 'free' : 'occupied';
  }
}

async function control(command = 'status') {
  return new Promise(resolve => {
    let data = '', settled = false;
    const socket = createConnection(SOCKET);
    const finish = value => { if (!settled) { settled = true; socket.destroy(); resolve(value); } };
    socket.setTimeout(1500, () => finish(null));
    socket.on('error', () => finish(null));
    socket.on('connect', () => socket.write(JSON.stringify({ command, root: ROOT }) + '\n'));
    socket.on('data', chunk => {
      data += chunk;
      if (data.length > 8192) return finish(null);
      if (data.includes('\n')) {
        try { const result = JSON.parse(data.split('\n')[0]); finish(result.root === ROOT ? result : null); }
        catch { finish(null); }
      }
    });
    socket.on('end', () => finish(null));
  });
}

export async function sourceFingerprint(root = ROOT) {
  const hash = createHash('sha256');
  const ignored = new Set(['node_modules', '.git', '.sites-runtime', '.wrangler', 'dist', '.next', '.vinext', 'docs', 'tests', 'outputs', 'work', '.agents', '.codex', 'next-env.d.ts']);
  async function walk(dir) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (ignored.has(entry.name) || entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name), relative = path.relative(root, full);
      if (entry.isDirectory()) await walk(full);
      else if (/\.(tsx?|m?[jc]s|json|css|svg|html)$/.test(entry.name) || ['.npmrc'].includes(entry.name)) {
        hash.update(relative); hash.update(await readFile(full));
      }
    }
  }
  await walk(root);
  return hash.digest('hex');
}

export async function dependenciesNeeded(root = ROOT) {
  const required = ['node_modules/vinext/dist/cli.js', 'node_modules/wrangler/bin/wrangler.js', 'node_modules/react/package.json'];
  try {
    for (const name of required) await stat(path.join(root, name));
    const installed = await stat(path.join(root, 'node_modules/.package-lock.json'));
    return (await stat(path.join(root, 'package-lock.json'))).mtimeMs > installed.mtimeMs ||
      (await stat(path.join(root, 'package.json'))).mtimeMs > installed.mtimeMs;
  } catch { return true; }
}

async function runNpm(task) {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const fd = await open(LOG, 'a');
  try {
    const child = spawn(command, ['run', task], { cwd: ROOT, env: process.env, stdio: ['ignore', fd.fd, fd.fd] });
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
    if (code !== 0) throw new Error(`${task === 'build' ? '页面生成' : '依赖安装'}失败。请检查网络或查看日志：${LOG}`);
  } finally { await fd.close(); }
}

async function prepare() {
  if (!supportedNode(process.versions.node)) throw new Error('Node.js 版本过旧。请安装 Node.js 22.15 或更新版本；推荐使用已验证的 Node.js 26。');
  const npm = spawnSync('npm', ['--version'], { encoding: 'utf8', timeout: 10000 });
  if (npm.status !== 0) throw new Error('没有找到可用的 npm。请重新安装包含 npm 的 Node.js，再双击启动。');
  if (await dependenciesNeeded()) {
    console.log('首次运行或依赖已更新，正在安装依赖（需要联网）……');
    await runNpm('install:ci');
  }
  const fingerprint = await sourceFingerprint();
  let previous;
  try { previous = JSON.parse(await readFile(path.join(RUNTIME, 'build.json'), 'utf8')); } catch {}
  const built = await stat(path.join(ROOT, 'dist/server/wrangler.json')).catch(() => null);
  if (!built || previous?.fingerprint !== fingerprint || previous?.node !== process.version) {
    console.log('正在生成本地页面，首次运行可能需要稍等……');
    await runNpm('build');
    await writeFile(path.join(RUNTIME, 'build.json'), JSON.stringify({ fingerprint, node: process.version }));
  } else console.log('本地页面已就绪，无需重新生成。');
}

async function serve() {
  // Only this project's private control socket can stop its background process.
  let state = 'starting', child, closing = false;
  const server = createServer(socket => {
    let data = '';
    socket.setTimeout(2000, () => socket.destroy());
    socket.on('error', () => {});
    socket.on('data', chunk => {
      data += chunk;
      if (data.length > 8192) return socket.destroy();
      if (!data.includes('\n')) return;
      try {
        const request = JSON.parse(data.split('\n')[0]);
        if (request.root !== ROOT || !['status', 'stop'].includes(request.command)) return socket.destroy();
        socket.end(JSON.stringify({ root: ROOT, state, pid: process.pid }) + '\n');
        if (request.command === 'stop') void shutdown();
      } catch { socket.destroy(); }
    });
  });
  async function shutdown() {
    if (closing) return;
    closing = true; state = 'stopping';
    if (child?.pid) { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
    server.close();
    await rm(SOCKET, { force: true });
    setTimeout(() => {
      if (child?.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
      process.exit(0);
    }, 1500);
  }
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(SOCKET, resolve); });
  await chmod(SOCKET, 0o600);
  child = spawn(process.execPath, ['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js', 'dev', '--config', 'dist/server/wrangler.json', '--local', '--persist-to', '.wrangler/state', '--ip', '127.0.0.1', '--inspector-port', '0', '--port', '5173'], {
    cwd: ROOT, env: process.env, detached: true, stdio: ['ignore', 'inherit', 'inherit'],
  });
  child.once('error', error => { console.error(error); void shutdown(); });
  child.once('exit', () => { state = 'failed'; void shutdown(); });
  for (let i = 0; i < 90 && !closing; i++) {
    if (await probe() === 'ours') { state = 'ready'; return; }
    await delay(500);
  }
  if (!closing) { console.error('服务启动超时。'); await shutdown(); }
}

async function launchBrowser() {
  if (process.argv.includes('--no-open')) return;
  const executable = process.platform === 'darwin' ? '/usr/bin/open' : 'xdg-open';
  const result = spawnSync(executable, [URL_HOME], { stdio: 'ignore', timeout: 10000 });
  if (result.status !== 0) console.log(`无法自动打开浏览器，请手动访问：${URL_HOME}`);
}

async function start() {
  await mkdir(RUNTIME, { recursive: true, mode: 0o700 });
  const lock = path.join(RUNTIME, 'start.lock');
  let acquired = false;
  for (let i = 0; i < 180; i++) {
    try { await mkdir(lock); acquired = true; await writeFile(path.join(lock, 'pid'), String(process.pid)); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        const pid = Number(await readFile(path.join(lock, 'pid'), 'utf8'));
        if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('invalid lock');
        try { process.kill(pid, 0); } catch (e) { if (e.code === 'ESRCH') { await rm(lock, { recursive: true, force: true }); continue; } }
      } catch {
        const age = Date.now() - (await stat(lock).catch(() => ({ mtimeMs: Date.now() }))).mtimeMs;
        if (age > 15000) { await rm(lock, { recursive: true, force: true }); continue; }
      }
      if (i === 0) console.log('另一个启动窗口正在准备，请稍等……');
      await delay(500);
    }
  }
  if (!acquired) throw new Error('另一个启动仍在进行。请查看原启动窗口，稍后再次打开。');
  try {
    let existing = await control();
    if (existing?.state === 'starting') {
      console.log('服务正在启动，请稍等……');
      for (let i = 0; i < 90 && existing?.state === 'starting'; i++) { await delay(500); existing = await control(); }
    }
    const availability = await probe();
    if (availability === 'ours') {
      console.log('保有数已在运行，正在打开首页。');
      await launchBrowser(); return;
    }
    if (availability !== 'free') throw new Error('5173 端口已被其他服务或旧版页面占用。请关闭原服务后重试；不会自动停止其他程序。');
    if (existing) throw new Error('已有本地服务正在退出或未就绪。请先双击“停止保有数.command”，再重新启动。');
    await rm(SOCKET, { force: true });
    await writeFile(LOG, `保有数启动日志 ${new Date().toISOString()}\n`, { mode: 0o600 });
    await prepare();
    if (await probe() !== 'free') throw new Error('准备期间 5173 端口被占用，请关闭占用程序后重试。');
    console.log('正在启动后台服务……');
    const fd = await open(LOG, 'a');
    const daemon = spawn(process.execPath, [fileURLToPath(import.meta.url), '--serve'], { cwd: ROOT, env: process.env, detached: true, stdio: ['ignore', fd.fd, fd.fd] });
    await new Promise((resolve, reject) => { daemon.once('spawn', resolve); daemon.once('error', reject); });
    daemon.unref(); await fd.close();
    for (let i = 0; i < 100; i++) {
      const current = await control();
      if (current?.state === 'ready' && await probe() === 'ours') {
        console.log(`启动成功：${URL_HOME}\n可以关闭此终端窗口，服务会继续运行。\n需要结束时，双击“停止保有数.command”。`);
        await launchBrowser(); return;
      }
      await delay(500);
    }
    await control('stop');
    throw new Error(`启动未成功。请查看日志：${LOG}`);
  } finally { await rm(lock, { recursive: true, force: true }); }
}

async function stop() {
  const current = await control();
  if (!current) {
    console.log(await probe() === 'free' ? '保有数已经停止，无需重复操作。' : '当前端口上的服务不是由本项目一键启动入口管理，请到原启动终端按 Control+C 停止。');
    return;
  }
  await control('stop');
  for (let i = 0; i < 30; i++) {
    if (!(await control()) && await probe() === 'free') { console.log('保有数已停止，浏览器中的个人资料仍然保留。'); return; }
    await delay(300);
  }
  throw new Error(`服务尚未完全退出，请稍后重试。日志：${LOG}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes('--serve')) await serve();
    else if (process.argv.includes('--stop')) await stop();
    else await start();
  } catch (error) { console.error(`\n启动工具提示：${error.message}`); process.exitCode = 1; }
}
