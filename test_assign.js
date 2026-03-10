const fetch = require('node-fetch');

async function test() {
    const loginRes = await fetch('http://localhost:8000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@campus.edu', password: 'admin' })
    });
    const { access_token } = await loginRes.json();

    const res = await fetch('http://localhost:8000/api/v1/tasks/assign', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`
        },
        body: JSON.stringify({
            issue_id: 'REQ-1002',
            asset_id: 'asset-4',
            assigned_to: 'u-service-1',
            assigned_by: 'u-admin-1',
            priority: 'medium'
        })
    });

    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
}

test();
