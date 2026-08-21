import { chromium } from 'playwright';
const SHOT = '/tmp/claude-0/-home-user-github-slideshow/e8a7d708-7c84-5acb-85ba-b291cbd361e3/scratchpad';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await b.newPage({ viewport: { width: 1500, height: 1000 } });
page.on('pageerror', e => console.log('PAGE ERROR:', e.message));

for (const [name, path] of [['PLAN','/plan'],['COMMERCIALS','/commercials'],['OUTPUTS','/outputs'],['OVERVIEW','/overview']]) {
  await page.goto('http://localhost:3111' + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const cards = await page.locator('.card > .card-head > h3').allInnerTexts();
  const h = await page.evaluate(() => document.querySelector('.page').scrollHeight);
  const stats = await page.locator('.stat .label').allInnerTexts();
  console.log(`\n=== ${name} — ${h}px tall ===`);
  console.log('  cards :', cards.join(' · ') || '(none)');
  if (stats.length) console.log('  stats :', stats.join(' · '));
  await page.screenshot({ path: `${SHOT}/walk-${name.toLowerCase()}.png`, fullPage: true });
}

// Can I start from scratch?
console.log('\n=== STARTING FROM SCRATCH ===');
await page.goto('http://localhost:3111/plan', { waitUntil: 'networkidle' });
const buttons = await page.locator('.topbar button, .topbar a').allInnerTexts();
console.log('  top bar offers:', buttons.map(s => s.replace(/\n/g,' ')).join(' | '));
console.log('  a "new/blank engagement" control exists:',
  buttons.some(t => /new|blank|start/i.test(t)));

// Where do I set the client and engagement name?
const nameFields = await page.locator('input[aria-label*="name" i], input[aria-label*="client" i]').count();
console.log('  fields for engagement name or client on /plan:', nameFields);
await page.goto('http://localhost:3111/commercials', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
console.log('  fields for engagement name or client on /commercials:',
  await page.locator('input[aria-label*="name" i], input[aria-label*="client" i]').count());
await b.close();
