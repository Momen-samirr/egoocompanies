#!/usr/bin/env node

/**
 * WebSocket Connection Test Script
 * Tests the WebSocket connection to ws.egoobus.com
 */

const WebSocket = require('ws');

const WS_URL = 'wss://ws.egoobus.com?role=admin';

console.log('🔌 Testing WebSocket connection...');
console.log(`📍 URL: ${WS_URL}\n`);

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected successfully!');
  console.log('📡 WebSocket connection is active\n');
  
  // Send a test message
  ws.send(JSON.stringify({
    type: 'test',
    message: 'Connection test from script'
  }));
  
  // Close connection after 5 seconds
  setTimeout(() => {
    console.log('🔌 Closing connection...');
    ws.close();
    process.exit(0);
  }, 5000);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('📨 Received message:', JSON.stringify(message, null, 2));
  } catch (error) {
    console.log('📨 Received message (raw):', data.toString());
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket Error:', error.message);
  console.error('   Code:', error.code);
  
  if (error.message.includes('502')) {
    console.error('\n⚠️  502 Bad Gateway Error:');
    console.error('   This means the service is not running or has crashed.');
    console.error('   Possible causes:');
    console.error('   1. Service is spinning down (Render free tier)');
    console.error('   2. Service crashed - check Render logs');
    console.error('   3. Service is not deployed yet');
    console.error('\n   Action: Check your Render dashboard for service status');
  } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
    console.error('\n⚠️  DNS Error:');
    console.error('   Domain cannot be resolved. Check DNS configuration.');
  } else if (error.message.includes('certificate') || error.message.includes('SSL')) {
    console.error('\n⚠️  SSL Error:');
    console.error('   SSL certificate issue. Wait for certificate provisioning.');
  }
  
  process.exit(1);
});

ws.on('close', (code, reason) => {
  console.log(`\n🔌 Connection closed`);
  console.log(`   Code: ${code}`);
  console.log(`   Reason: ${reason || 'No reason provided'}`);
  process.exit(0);
});

// Timeout after 10 seconds if no connection
setTimeout(() => {
  if (ws.readyState === WebSocket.CONNECTING) {
    console.error('❌ Connection timeout - server did not respond');
    ws.terminate();
    process.exit(1);
  }
}, 10000);

