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
    console.log('\n=== Testing Partnership Endpoints ===\n');

    // Test 1: Get pending requests
    console.log('1. GET /api/auth/pending-partnership-requests/13');
    let res = await makeRequest('GET', '/api/auth/pending-partnership-requests/13');
    console.log(`   Status: ${res.status}`);
    console.log(`   Data:`, JSON.stringify(res.data, null, 2));

    // Test 2: Send partnership request
    console.log('\n2. POST /api/auth/send-partnership-request');
    res = await makeRequest('POST', '/api/auth/send-partnership-request', {
      userId: 13,
      partnerId: 14
    });
    console.log(`   Status: ${res.status}`);
    console.log(`   Data:`, JSON.stringify(res.data, null, 2));

    // Test 3: Get pending requests again
    console.log('\n3. GET /api/auth/pending-partnership-requests/14');
    res = await makeRequest('GET', '/api/auth/pending-partnership-requests/14');
    console.log(`   Status: ${res.status}`);
    console.log(`   Data:`, JSON.stringify(res.data, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
