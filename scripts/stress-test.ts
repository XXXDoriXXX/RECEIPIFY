// @ts-nocheck
import * as fs from 'fs';
import * as path from 'path';


const API_URL = 'http://localhost:3000/api';
const DOWNLOADS_DIR = path.join(process.env.HOME || '', 'Downloads/receipts');
const NUM_USERS = 5;
const POLL_INTERVAL_MS = 2000;

async function runStressTest() {
  console.log('--- Starting Receiptify Stress Test ---');

  // 1. Find images in Downloads
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    console.error(`Downloads directory not found at ${DOWNLOADS_DIR}`);
    return;
  }

  const files = fs.readdirSync(DOWNLOADS_DIR);
  const images = files
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
    .map(f => path.join(DOWNLOADS_DIR, f));

  if (images.length < 5) {
    console.error(`Not enough images in Downloads (found ${images.length}, need at least 5)`);
    return;
  }

  console.log(`Found ${images.length} unique images.`);
  console.log(`Setting up ${NUM_USERS} concurrent users...`);

  // 2. Prepare users and their image sets
  const usersPromises = Array.from({ length: NUM_USERS }).map(async (_, i) => {
    const email = `stress_test_${Date.now()}_${i}@example.com`;
    const password = 'Password123!';
    const fullName = `Stress User ${i}`;

    // Register
    const regRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName })
    });
    if (!regRes.ok) throw new Error(`Registration failed: ${await regRes.text()}`);

    // Login
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!loginRes.ok) throw new Error(`Login failed: ${await loginRes.text()}`);

    const loginData = await loginRes.json();
    const token = loginData.accessToken;

    // Assign images (unique subset for each user)
    const startIdx = Math.floor((i * images.length) / NUM_USERS);
    const endIdx = Math.floor(((i + 1) * images.length) / NUM_USERS);
    const userImages = images.slice(startIdx, endIdx);

    return { email, token, userImages };
  });

  const users = await Promise.all(usersPromises);
  console.log(`Registered and logged in ${NUM_USERS} users.`);

  const startTime = Date.now();
  console.log(`\nStarting parallel uploads at ${new Date(startTime).toLocaleTimeString()}...`);

  // 3. Parallel Uploads
  const uploadPromises = users.map(async (user) => {
    const uploadStart = Date.now();

    const formData = new FormData();
    for (const imgPath of user.userImages) {
      const fileName = path.basename(imgPath).toLowerCase();
      const fileData = fs.readFileSync(imgPath);
      
      let mimeType = 'image/jpeg';
      if (fileName.endsWith('.png')) mimeType = 'image/png';
      else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) mimeType = 'image/jpeg';
      
      const blob = new Blob([fileData], { type: mimeType });
      formData.append('receiptImages', blob, fileName);
    }

    const res = await fetch(`${API_URL}/receipt/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${user.token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Upload failed for ${user.email}: ${res.status} ${await res.text()}`);
    }

    const uploadEnd = Date.now();
    return {
      email: user.email,
      latency: uploadEnd - uploadStart,
      count: user.userImages.length
    };
  });

  const uploadResults = await Promise.all(uploadPromises);
  const totalUploadTime = Date.now() - startTime;

  console.log('\n--- API Upload Stats ---');
  uploadResults.forEach(r => {
    console.log(`${r.email}: Sent ${r.count} images in ${r.latency}ms`);
  });
  console.log(`Cumulative upload request time: ${totalUploadTime}ms`);

  console.log('\n--- OCR Processing Monitoring ---');
  console.log('Polling status from database until finished...');

  // 4. Polling for Completion
  let allDone = false;
  const totalImages = images.length;

  while (!allDone) {
    const statusPromises = users.map(async (user) => {
      const res = await fetch(`${API_URL}/receipt?limit=100`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      const receipts = data.data;

      const pending = receipts.filter(r => r.status === 'pending' || r.status === 'processing').length;
      const failed = receipts.filter(r => r.status === 'failed').length;
      const done = receipts.filter(r => r.status === 'done').length;

      return { pending, done, failed };
    });

    const statuses = await Promise.all(statusPromises);
    const totalPending = statuses.reduce((sum, s) => sum + s.pending, 0);
    const totalDone = statuses.reduce((sum, s) => sum + s.done, 0);
    const totalFailed = statuses.reduce((sum, s) => sum + s.failed, 0);

    const processed = totalDone + totalFailed;
    process.stdout.write(`\rProgress: ${processed}/${totalImages} | Done: ${totalDone} | Failed: ${totalFailed} | Pending: ${totalPending}   `);

    if (totalPending === 0 && processed >= totalImages) {
      allDone = true;
      const totalProcessTime = Date.now() - startTime;
      console.log('\n\n--- Final Results ---');
      console.log(`Total Time (Start -> All Finished): ${(totalProcessTime / 1000).toFixed(2)}s`);
      console.log(`Success Rate: ${((totalDone / totalImages) * 100).toFixed(2)}%`);
      break;
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

runStressTest().catch(err => {
  console.error('\n\nStress test error:', err.message);
});
