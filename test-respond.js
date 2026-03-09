import http from 'http';

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: data ? JSON.parse(data) : null
        });
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function test() {
  try {
    console.log('\n=== Testing Respond to Partnership Request ===\n');

    // Test: Accept partnership request
    console.log('1. Accept partnership request (id=1)');
    let res = await makeRequest('POST', '/api/auth/respond-partnership-request', {
      requestId: 1,
      accept: true
    });
    console.log(`   Status: ${res.status}`);
    console.log(`   Data:`, JSON.stringify(res.data, null, 2));

    // Test 2: Check partners
    console.log('\n2. GET /api/auth/partner/13');
    res = await makeRequest('GET', '/api/auth/partner/13');
    console.log(`   Status: ${res.status}`);
    console.log(`   Partner ID:`, res.data?.id);

    console.log('\n3. GET /api/auth/partner/14');
    res = await makeRequest('GET', '/api/auth/partner/14');
    console.log(`   Status: ${res.status}`);
    console.log(`   Partner ID:`, res.data?.id);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
