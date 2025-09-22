#!/usr/bin/env node
import { execSync } from 'node:child_process';

const PROJECT_ID = 'freecanvas-9eac7';

function run(cmd) {
  return execSync(cmd, { stdio: 'pipe', encoding: 'utf8' });
}

function updateCanvas(canvasId) {
  const rawCanvas = run(`firebase database:get /shared_canvases/${canvasId} --project ${PROJECT_ID}`);
  const canvas = JSON.parse(rawCanvas || '{}');
  const shareSettings = {
    ...(canvas.shareSettings || {}),
    allowPublicAccess: true,
  };
  const payload = JSON.stringify({
    isPublic: true,
    shareSettings,
  });
  run(`firebase database:update /shared_canvases/${canvasId} --project ${PROJECT_ID} --force --data '${payload}'`);
  console.log(`Updated canvas ${canvasId}`);
}

try {
  const rawTokens = run(`firebase database:get /share_tokens --project ${PROJECT_ID}`);
  const tokens = JSON.parse(rawTokens || '{}');
  const ids = new Set();
  Object.values(tokens).forEach((token) => {
    if (token && typeof token === 'object' && token.canvasId) {
      ids.add(token.canvasId);
    }
  });

  if (!ids.size) {
    console.log('No share tokens found. Nothing to update.');
    process.exit(0);
  }

  console.log(`Updating ${ids.size} canvases to allow public access...`);
  ids.forEach((id) => {
    try {
      updateCanvas(id);
    } catch (error) {
      console.error(`Failed to update canvas ${id}:`, error.message);
    }
  });

  console.log('Update script finished.');
} catch (error) {
  console.error('Failed to update canvases:', error.message);
  process.exit(1);
}
