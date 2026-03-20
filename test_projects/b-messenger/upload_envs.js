const { execSync } = require('child_process');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const lines = envContent.split('\n');

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;

  const equalIndex = trimmed.indexOf('=');
  if (equalIndex > 0) {
    const key = trimmed.slice(0, equalIndex).trim();
    const value = trimmed.slice(equalIndex + 1).trim();

    console.log(`Adding ${key} to Vercel production...`);
    try {
      execSync(`npx vercel env rm ${key} production -y`, { stdio: 'ignore' });
    } catch (e) {}

    try {
      execSync(`npx vercel env add ${key} production`, { input: value, stdio: ['pipe', 'inherit', 'inherit'] });
      console.log(`✅ successfully added ${key}`);
    } catch (e) {
      console.error(`❌ failed to add ${key}`);
    }
  }
}
console.log('✅ All environment variables uploaded.');
