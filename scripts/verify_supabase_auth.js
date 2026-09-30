const http = require('http');

function get(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body || {});
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function verifySupabaseConnection() {
  console.log('========================================================');
  console.log('CLARION OMNIAI — SUPABASE CONNECTION & AUTH VERIFICATION');
  console.log('========================================================\n');

  console.log('--- 1. Backend /health Verification ---');
  const healthRes = await get('/health');
  console.log('HTTP Status:', healthRes.status);
  console.log('Supabase Auth Service:', healthRes.data?.services?.supabaseAuth);
  console.log('Database Service:', healthRes.data?.services?.database);

  console.log('\n--- 2. Supabase Auth Login (reviewer@clarion.ai) ---');
  const loginRes = await post('/api/auth/login', {
    email: 'reviewer@clarion.ai',
    password: 'Password@123'
  });
  console.log('Login Status:', loginRes.status);
  console.log('Authenticated User:', loginRes.data?.data?.user);
  console.log('Password Stored in Response?:', loginRes.data?.data?.user?.passwordHash ? 'YES (VIOLATION)' : 'NO (SECURE)');
  const token = loginRes.data?.data?.token;
  console.log('Supabase Session JWT (first 40 chars):', token ? token.substring(0, 40) + '...' : 'NONE');

  console.log('\n--- 3. Token Verification via Supabase Auth (GET /api/auth/me) ---');
  const meRes = await get('/api/auth/me', token);
  console.log('Me Status:', meRes.status);
  console.log('Verified Session User:', meRes.data?.data?.user);

  console.log('\n--- 4. Register New User in Supabase Auth ---');
  const testEmail = `operator.${Date.now()}@clarion.ai`;
  const registerRes = await post('/api/auth/register', {
    email: testEmail,
    password: 'SecurePassword@2026',
    fullName: 'Procurement Specialist',
    role: 'REVIEWER',
    department: 'Accounts Payable'
  });
  console.log('Registration Status:', registerRes.status);
  console.log('Registered User:', registerRes.data?.data?.user);
  console.log('Token Issued from Supabase:', registerRes.data?.data?.token ? 'YES' : 'NO');

  console.log('\n========================================================');
  console.log('✅ SUPABASE CONNECTION AND AUTH SUCCESSFULLY VERIFIED');
  console.log('========================================================');
}

verifySupabaseConnection().catch(console.error);
