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
    console.log('\n=== Testing Active Cards Partner Restriction ===\n');

    // Test 1: Get active cards for user 13 (has partner 14)
    console.log('1. GET /api/active-cards/13 (has partner 14)');
    let res = await makeRequest('GET', '/api/active-cards/13');
    console.log(`   Status: ${res.status}`);
    console.log(`   Response:`, JSON.stringify(res.data, null, 2));

  } catch (error) {
    console.error('Error:', error);
  }
}

test();
