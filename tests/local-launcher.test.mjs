import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { supportedNode, describeProbe, sourceFingerprint, dependenciesNeeded } from '../scripts/local-launcher.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'benefit-launcher-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('Node 版本要求与无效版本', () => {
  for (const value of ['22.15.0', 'v26.0.0', '24.1.0']) assert.equal(supportedNode(value), true);
  for (const value of ['20.20.0', '22.14.9', '26', 'garbage', 'v22.x.0']) assert.equal(supportedNode(value), false);
});

test('只识别成功响应的保有数身份，其他服务均视为占用', () => {
  const identity = { app: 'shebao-pocket', localLauncher: 1 };
  assert.equal(describeProbe(200, identity), 'ours');
  for (const [status, body] of [[404, identity], [301, identity], [200, null], [200, {}], [200, { app: 'other', localLauncher: 1 }]]) {
    assert.equal(describeProbe(status, body), 'occupied');
  }
});

test('构建指纹忽略截图、日志和生成文件，但识别源代码与配置变更', async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'package.json'), '{}');
  const before = await sourceFingerprint(root);
  for (const folder of ['docs', 'dist', '.sites-runtime', 'node_modules']) {
    await mkdir(path.join(root, folder));
    await writeFile(path.join(root, folder, 'generated.json'), '{"changed":true}');
  }
  await writeFile(path.join(root, 'next-env.d.ts'), 'generated');
  assert.equal(await sourceFingerprint(root), before);
  await mkdir(path.join(root, 'app'));
  await writeFile(path.join(root, 'app/page.tsx'), 'export default 1');
  const source = await sourceFingerprint(root);
  assert.notEqual(source, before);
  await writeFile(path.join(root, 'package.json'), '{"version":"2"}');
  assert.notEqual(await sourceFingerprint(root), source);
});

test('缺少依赖或安装记录、依赖声明更新均需要重新安装', async t => {
  const root = await fixture(t);
  assert.equal(await dependenciesNeeded(root), true);
  for (const file of ['node_modules/vinext/dist/cli.js', 'node_modules/wrangler/bin/wrangler.js', 'node_modules/react/package.json', 'package.json', 'package-lock.json']) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), '{}');
    await utimes(path.join(root, file), 100, 100);
  }
  assert.equal(await dependenciesNeeded(root), true);
  await writeFile(path.join(root, 'node_modules/.package-lock.json'), '{}');
  await utimes(path.join(root, 'node_modules/.package-lock.json'), 200, 200);
  assert.equal(await dependenciesNeeded(root), false);
  await utimes(path.join(root, 'package-lock.json'), 300, 300);
  assert.equal(await dependenciesNeeded(root), true);
});
