const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const readProjectFile = (...parts) => fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');

test('platform audit log declares framework-maintained edit fields', () => {
  const source = readProjectFile('cloudfunctions', 'cloud', 'project', 'model', 'platform_log_model.js');

  assert.match(source, /PLOG_EDIT_TIME:\s*['\"]int\|true['\"]/);
  assert.match(source, /PLOG_EDIT_IP:\s*['\"]string\|false['\"]/);
});

test('platform health reads all matching records through pagination', () => {
  const source = readProjectFile('cloudfunctions', 'cloud', 'project', 'service', 'admin', 'admin_tenant_service.js');

  assert.match(source, /JoinModel\.getAllBig\(/);
  assert.match(source, /UserModel\.getAllBig\(/);
  assert.doesNotMatch(source, /JoinModel\.getAll\([\s\S]{0,250}20000/);
  assert.doesNotMatch(source, /UserModel\.getAll\([\s\S]{0,250}20000/);
});
