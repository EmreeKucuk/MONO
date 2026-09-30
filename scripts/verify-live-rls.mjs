import assert from 'node:assert/strict';

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'MONO_TEST_EMAIL_A', 'MONO_TEST_PASSWORD_A', 'MONO_TEST_EMAIL_B', 'MONO_TEST_PASSWORD_B'];
for (const name of required) if (!process.env[name]) throw Error(`Eksik ortam değişkeni: ${name}`);
const url = process.env.SUPABASE_URL.replace(/\/$/, '');
const key = process.env.SUPABASE_ANON_KEY;

async function request(path, token, method = 'GET', body) {
  const response = await fetch(url + path, {
    method, headers: { apikey: key, Authorization: `Bearer ${token || key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, data: await response.json().catch(() => null) };
}

async function login(suffix) {
  const result = await request('/auth/v1/token?grant_type=password', null, 'POST', {
    email: process.env[`MONO_TEST_EMAIL_${suffix}`], password: process.env[`MONO_TEST_PASSWORD_${suffix}`]
  });
  assert.equal(result.status, 200, `${suffix} test hesabı giriş yapamadı.`);
  return result.data;
}

const a = await login('A'), b = await login('B');
assert.notEqual(a.user.id, b.user.id, 'İki farklı test hesabı gerekli.');
const ownPath = `/rest/v1/workspaces?user_id=eq.${a.user.id}`;
const previous = await request(ownPath, a.access_token);
assert.equal(previous.status, 200);
let created = false;
try {
  if (!previous.data.length) {
    const result = await request('/rest/v1/workspaces', a.access_token, 'POST', { user_id: a.user.id, state: { widgets: [], events: [] } });
    assert.equal(result.status, 201);
    created = true;
  }
  const read = await request(ownPath, b.access_token);
  assert.equal(read.status, 200); assert.deepEqual(read.data, [], 'B, A kaydını okuyabiliyor.');
  const update = await request(ownPath, b.access_token, 'PATCH', { state: { widgets: [], events: [] } });
  assert.equal(update.status, 200); assert.deepEqual(update.data, [], 'B, A kaydını değiştirebiliyor.');
  const remove = await request(ownPath, b.access_token, 'DELETE');
  assert.equal(remove.status, 200); assert.deepEqual(remove.data, [], 'B, A kaydını silebiliyor.');
  const insert = await request('/rest/v1/workspaces', b.access_token, 'POST', { user_id: a.user.id, state: { widgets: [], events: [] } });
  assert.ok([401, 403].includes(insert.status), 'B, A adına satır ekleyebiliyor.');
  const preserved = await request(ownPath, a.access_token);
  assert.equal(preserved.data.length, 1);
  if (previous.data.length) assert.deepEqual(preserved.data, previous.data);
  const anonymous = await request('/rest/v1/workspaces', null);
  assert.ok([401, 403].includes(anonymous.status), 'Anonim erişim reddedilmeli.');
  console.log('Canlı RLS doğrulandı: iki hesap arasında okuma/yazma/silme/ekleme engellendi.');
} finally {
  if (created) {
    const cleanup = await request(ownPath, a.access_token, 'DELETE');
    assert.equal(cleanup.status, 200, 'Geçici test satırı temizlenemedi.');
  }
}
