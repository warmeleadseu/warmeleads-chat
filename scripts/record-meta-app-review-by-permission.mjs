#!/usr/bin/env node
/**
 * Per-permissie screencasts voor Meta App Review.
 *
 *   set -a && source .env.vercel.prod.full && set +a
 *   export SCREENCAST_BASE_URL=http://localhost:3010
 *   node scripts/record-meta-app-review-by-permission.mjs
 *
 * Output (MP4):
 *   assets/meta-app-review/meta-review-business_management.mp4
 *   assets/meta-app-review/meta-review-pages_show_list.mp4
 *   …
 */

import { mkdirSync, readdirSync, statSync, unlinkSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'assets', 'meta-app-review');
const BASE_URL = (process.env.SCREENCAST_BASE_URL || 'http://localhost:3010').replace(/\/$/, '');
const ADMIN_COOKIE = 'wl_admin_session';
const IS_LOCAL = /localhost|127\.0\.0\.1/.test(BASE_URL);

function getSessionSecret() {
  const app = process.env.APP_SESSION_SECRET?.trim();
  if (app) return app;
  const admin = process.env.ADMIN_SESSION_SECRET?.trim();
  if (admin) return admin;
  const cron = process.env.CRON_SECRET?.trim();
  if (cron) return cron;
  throw new Error('Geen CRON_SECRET / APP_SESSION_SECRET in env');
}

async function signAdminSession(adminId) {
  const secret = new TextEncoder().encode(getSessionSecret());
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('warmeleads-admin-session')
    .setAudience('warmeleads-admin-api')
    .setSubject(adminId)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

async function getSuperadminId() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const prefer = process.env.SCREENCAST_ADMIN_EMAIL?.toLowerCase();
  let q = sb.from('admin_users').select('id, email').eq('role', 'superadmin').eq('is_active', true);
  if (prefer) q = q.eq('email', prefer);
  const { data, error } = await q.order('email').limit(1).single();
  if (error || !data) throw new Error(`Geen superadmin: ${error?.message || 'leeg'}`);
  return data.id;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function showBanner(page, text, ms = 3200) {
  await page.evaluate((t) => {
    const el = document.createElement('div');
    el.id = 'wl-screencast-banner';
    el.textContent = t;
    Object.assign(el.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '99999',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(15,23,42,0.93)',
      color: '#fff',
      font: '600 20px/1.45 system-ui, sans-serif',
      textAlign: 'center',
      padding: '28px',
      whiteSpace: 'pre-line',
    });
    document.body.appendChild(el);
  }, text);
  await sleep(ms);
  await page.evaluate(() => document.getElementById('wl-screencast-banner')?.remove());
}

function findFfmpeg() {
  const candidates = [process.env.FFMPEG_PATH];
  try {
    candidates.push(require('@ffmpeg-installer/ffmpeg').path);
  } catch { /* */ }
  candidates.push('/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg');
  for (const p of candidates.filter(Boolean)) {
    try {
      execSync(`"${p}" -version`, { stdio: 'ignore' });
      return p;
    } catch { /* */ }
  }
  return null;
}

function webmToMp4(webmPath, mp4Path) {
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) throw new Error('ffmpeg niet gevonden');
  execSync(
    `"${ffmpeg}" -y -i "${webmPath}" -c:v libx264 -pix_fmt yuv420p -movflags +faststart -an "${mp4Path}"`,
    { stdio: 'pipe' },
  );
  try { unlinkSync(webmPath); } catch { /* */ }
}

async function gotoAdmin(page) {
  await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: 'Koppelingen' }).waitFor({ state: 'visible', timeout: 60_000 });
}

async function gotoKoppelingen(page, pause) {
  await page.getByRole('link', { name: 'Koppelingen' }).click();
  await page.waitForURL(/\/admin\/koppelingen/);
  await pause(1500);
  await page.getByText('Meta Ads: Leadkosten').scrollIntoViewIfNeeded();
  await pause(2000);
}

async function gotoAiCampaigns(page, pause) {
  await page.getByRole('link', { name: 'AI campagnes' }).click();
  await page.waitForURL(/\/admin\/ai-campaigns/);
  await pause(2000);
  const branchSelect = page.locator('select').first();
  await branchSelect.waitFor({ state: 'visible' });
  const slug = await branchSelect.locator('option').nth(1).getAttribute('value');
  if (slug) await branchSelect.selectOption(slug);
  await pause(1200);
}

async function openLeadFormModal(page, pause) {
  await page.getByRole('button', { name: /Maak met AI|Nieuw/ }).click();
  await page.getByText('Nieuw Meta Lead Form met AI').waitFor({ state: 'visible' });
  await pause(1500);
}

async function pagesStepDemo(page, pause) {
  await page.getByText('Kies een Facebook-page').waitFor();
  const pageButtons = page.locator('button').filter({ has: page.locator('div.truncate.text-sm.font-medium') });
  await pageButtons.first().waitFor({ state: 'visible', timeout: 60_000 });
  const count = await pageButtons.count();
  const scrollBox = page.locator('.max-h-\\[min\\(50dvh\\,22rem\\)\\]').first();
  if (count >= 2 && (await scrollBox.isVisible().catch(() => false))) {
    await scrollBox.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await pause(1200);
    await scrollBox.evaluate((el) => { el.scrollTop = 0; });
    await pause(1000);
  }
  const search = page.getByPlaceholder('Zoek page op naam of ID');
  if (await search.isVisible().catch(() => false)) {
    await search.fill('Service');
    await pause(1200);
    await search.fill('');
    await pause(800);
  }
  if (count > 0) {
    await pageButtons.first().click();
    await pause(800);
    if (count > 1) await pageButtons.nth(1).click();
    await pause(1500);
  }
  return count;
}

/** @type {Record<string, (page: import('playwright').Page, pause: (n:number)=>Promise<void>) => Promise<void>>} */
const FLOWS = {
  async business_management(page, pause) {
    await showBanner(page, 'Meta permission: business_management\nWarme Leads admin — Business Manager assets');
    await gotoAdmin(page);
    await gotoKoppelingen(page, pause);
    if (await page.getByText('Verbonden met Meta').isVisible().catch(() => false)) {
      await page.getByText('Verbonden met Meta').scrollIntoViewIfNeeded();
      await pause(2500);
    }
    await page.getByText('Meta Access Token', { exact: false }).scrollIntoViewIfNeeded();
    await pause(2000);
    await page.getByText('Ad Account ID', { exact: false }).scrollIntoViewIfNeeded();
    await pause(2000);
    const syncBtn = page.getByRole('button', { name: /Nu synchroniseren/ });
    if (await syncBtn.isVisible().catch(() => false)) {
      await syncBtn.scrollIntoViewIfNeeded();
      await pause(2500);
    }
    await pause(2000);
  },

  async pages_show_list(page, pause) {
    await showBanner(page, 'Meta permission: pages_show_list\nList Facebook Pages for Lead Ads');
    await gotoAdmin(page);
    await gotoAiCampaigns(page, pause);
    await openLeadFormModal(page, pause);
    await pagesStepDemo(page, pause);
    await pause(2000);
    await page.keyboard.press('Escape');
    await pause(1000);
  },

  async pages_read_engagement(page, pause) {
    await showBanner(page, 'Meta permission: pages_read_engagement\nRead Page info (name, category, tasks)');
    await gotoAdmin(page);
    await gotoAiCampaigns(page, pause);
    await openLeadFormModal(page, pause);
    const pageButtons = page.locator('button').filter({ has: page.locator('div.truncate.text-sm.font-medium') });
    await pageButtons.first().waitFor({ state: 'visible', timeout: 60_000 });
    const n = Math.min(await pageButtons.count(), 4);
    for (let i = 0; i < n; i++) {
      await pageButtons.nth(i).click();
      await pause(2200);
    }
    await pause(1500);
    await page.keyboard.press('Escape');
  },

  async pages_manage_ads(page, pause) {
    await showBanner(page, 'Meta permission: pages_manage_ads\nCreate Lead Gen form on a Facebook Page');
    await gotoAdmin(page);
    await gotoAiCampaigns(page, pause);
    await openLeadFormModal(page, pause);
    const pageButtons = page.locator('button').filter({ has: page.locator('div.truncate.text-sm.font-medium') });
    await pageButtons.first().waitFor({ state: 'visible', timeout: 60_000 });
    if ((await pageButtons.count()) > 0) await pageButtons.first().click();
    await page.getByRole('button', { name: 'Volgende' }).click();
    await pause(1500);
    const footer = page.locator('.shrink-0.flex.items-center.justify-between').last();
    await footer.getByRole('button', { name: 'Genereer', exact: true }).click();
    await page.getByText('Check + bewerk het formulier').waitFor({ state: 'visible', timeout: 90_000 });
    await pause(2500);
    await footer.getByRole('button', { name: 'Verder', exact: true }).click();
    await pause(2500);
    await page.getByRole('button', { name: 'Maak aan in Meta' }).waitFor({ state: 'visible' });
    await pause(1500);
    await page.getByRole('button', { name: 'Maak aan in Meta' }).click();
    await pause(5000);
    await page.locator('text=/capability|mislukt|aangemaakt|error/i').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
    await pause(3500);
    await page.keyboard.press('Escape');
  },

  async leads_retrieval(page, pause) {
    await showBanner(page, 'Meta permission: leads_retrieval\nRetrieve Lead Ad forms for campaigns');
    await gotoAdmin(page);
    await gotoAiCampaigns(page, pause);
    const leadLabel = page.getByText('Lead Form', { exact: true }).first();
    await leadLabel.scrollIntoViewIfNeeded();
    await pause(1500);
    const select = page.locator('select').filter({ has: page.locator('option') }).nth(1);
    if (await select.isVisible().catch(() => false)) {
      const opts = await select.locator('option').count();
      for (let i = 0; i < Math.min(opts, 4); i++) {
        await select.selectOption({ index: i });
        await pause(1800);
      }
    }
    await openLeadFormModal(page, pause);
    await page.getByRole('button', { name: 'Volgende' }).click().catch(() => {});
    await pause(1000);
    const footer = page.locator('.shrink-0.flex.items-center.justify-between').last();
    if (await footer.getByRole('button', { name: 'Genereer', exact: true }).isVisible().catch(() => false)) {
      await footer.getByRole('button', { name: 'Genereer', exact: true }).click();
      await page.getByText('Check + bewerk het formulier').waitFor({ state: 'visible', timeout: 90_000 }).catch(() => {});
      await pause(3000);
    }
    await page.keyboard.press('Escape');
    await pause(1000);
  },

  async ads_management(page, pause) {
    await showBanner(page, 'Meta permission: ads_management\nCreate & manage Lead Ad campaigns in Meta');
    await gotoAdmin(page);
    await gotoKoppelingen(page, pause);
    const syncBtn = page.getByRole('button', { name: /Nu synchroniseren/ });
    if (await syncBtn.isVisible().catch(() => false)) {
      await syncBtn.click();
      await pause(4000);
    }
    await gotoAiCampaigns(page, pause);
    await page.getByText('Brief').first().scrollIntoViewIfNeeded();
    await pause(2000);
    await page.getByText('Lead Form').first().scrollIntoViewIfNeeded();
    await pause(1500);
    const launch = page.getByText(/Lanceer|Launch|Genereer strategie|Varianten/i).first();
    if (await launch.isVisible().catch(() => false)) {
      await launch.scrollIntoViewIfNeeded();
      await pause(2500);
    }
    await page.mouse.wheel(0, 600);
    await pause(2000);
  },
};

const PERMISSION_ORDER = [
  'business_management',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_ads',
  'leads_retrieval',
  'ads_management',
];

async function recordOne(browser, jwt, host, permissionId) {
  const subDir = join(OUT_DIR, '_tmp', permissionId);
  mkdirSync(subDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: subDir, size: { width: 1280, height: 720 } },
    locale: 'nl-NL',
  });

  await context.addCookies([
    {
      name: ADMIN_COOKIE,
      value: jwt,
      domain: host,
      path: '/',
      httpOnly: true,
      secure: !IS_LOCAL,
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();
  page.setDefaultTimeout(120_000);
  const pause = (ms) => sleep(ms);

  console.log(`  ▶ ${permissionId}…`);
  try {
    await FLOWS[permissionId](page, pause);
    await showBanner(page, `End — ${permissionId}`, 2000);
  } finally {
    await page.close();
    await context.close();
  }

  const webms = readdirSync(subDir).filter((f) => f.endsWith('.webm'));
  if (!webms.length) throw new Error(`Geen webm voor ${permissionId}`);
  const webmPath = join(subDir, webms[0]);
  const mp4Path = join(OUT_DIR, `meta-review-${permissionId}.mp4`);
  webmToMp4(webmPath, mp4Path);
  console.log(`  ✅ ${mp4Path}`);
  return mp4Path;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(join(OUT_DIR, '_tmp'), { recursive: true });

  const only = process.env.SCREENCAST_ONLY?.split(',').map((s) => s.trim()).filter(Boolean);
  const list = only?.length ? only.filter((id) => PERMISSION_ORDER.includes(id)) : PERMISSION_ORDER;

  const adminId = await getSuperadminId();
  const jwt = await signAdminSession(adminId);
  const host = new URL(BASE_URL).hostname;

  console.log(`Opname: ${BASE_URL}`);
  console.log(`Permissies: ${list.join(', ')}\n`);

  const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  const outputs = [];

  try {
    for (const id of list) {
      outputs.push(await recordOne(browser, jwt, host, id));
    }
  } finally {
    await browser.close();
  }

  console.log('\n── Klaar ──');
  for (const p of outputs) console.log(`  ${p}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
