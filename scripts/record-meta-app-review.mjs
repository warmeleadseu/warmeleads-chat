#!/usr/bin/env node
/**
 * Record one Meta App Review screencast against production admin.
 *
 * Usage:
 *   set -a && source .env.vercel.prod && set +a
 *   node scripts/record-meta-app-review.mjs
 *
 * Output:
 *   assets/meta-app-review/warmeleads-meta-app-review.mp4
 */

import { mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
import { createClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'assets', 'meta-app-review');
const BASE_URL = (
  process.env.SCREENCAST_BASE_URL || 'http://localhost:3010'
).replace(/\/$/, '');
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env ontbreekt');
  const sb = createClient(url, key);
  const prefer = process.env.SCREENCAST_ADMIN_EMAIL?.toLowerCase();
  let q = sb
    .from('admin_users')
    .select('id, email')
    .eq('role', 'superadmin')
    .eq('is_active', true);
  if (prefer) q = q.eq('email', prefer);
  const { data, error } = await q.order('email').limit(1).single();
  if (error || !data) throw new Error(`Geen superadmin: ${error?.message || 'leeg'}`);
  console.log(`Superadmin sessie: ${data.email}`);
  return data.id;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function showBanner(page, text, ms = 3500) {
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
      background: 'rgba(15,23,42,0.92)',
      color: '#fff',
      font: '600 22px/1.4 system-ui, sans-serif',
      textAlign: 'center',
      padding: '32px',
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
  } catch {
    /* optional dep */
  }
  candidates.push('/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg');
  for (const p of candidates.filter(Boolean)) {
    try {
      execSync(`"${p}" -version`, { stdio: 'ignore' });
      return p;
    } catch {
      /* next */
    }
  }
  return null;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const adminId = await getSuperadminId();
  const jwt = await signAdminSession(adminId);
  const host = new URL(BASE_URL).hostname;

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 720 } },
    locale: 'nl-NL',
    colorScheme: 'light',
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
  console.log(`Opname tegen: ${BASE_URL}`);

  const pause = (ms) => sleep(ms);

  try {
    await showBanner(
      page,
      'Warme Leads — internal admin CRM\nMeta Lead Ads · System User token in Koppelingen',
      4000,
    );

    // Dashboard
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: 'Koppelingen' }).waitFor({ state: 'visible', timeout: 60_000 });
    await pause(2500);

    // Koppelingen — Meta token + sync (business_management, ads_management)
    await page.getByRole('link', { name: 'Koppelingen' }).click();
    await page.waitForURL(/\/admin\/koppelingen/);
    await pause(2000);
    const metaHeading = page.getByText('Meta Ads: Leadkosten');
    await metaHeading.scrollIntoViewIfNeeded();
    await pause(3500);
    const connected = page.getByText('Verbonden met Meta');
    if (await connected.isVisible().catch(() => false)) {
      await connected.scrollIntoViewIfNeeded();
      await pause(2500);
    }
    await page.getByText('Meta Access Token', { exact: false }).scrollIntoViewIfNeeded().catch(() => {});
    await pause(2000);

    // AI Campagnes — lead forms + pages + create
    await page.getByRole('link', { name: 'AI campagnes' }).click();
    await page.waitForURL(/\/admin\/ai-campaigns/);
    await pause(2500);

    const branchSelect = page.locator('select').first();
    await branchSelect.waitFor({ state: 'visible' });
    const branchSlug = await branchSelect.locator('option').nth(1).getAttribute('value');
    if (branchSlug) {
      await branchSelect.selectOption(branchSlug);
      console.log(`Branche: ${branchSlug}`);
    }
    await pause(1500);

    const aiBtn = page.getByRole('button', { name: /Maak met AI|Nieuw/ });
    await aiBtn.click();
    await page.getByText('Nieuw Meta Lead Form met AI').waitFor({ state: 'visible' });
    await pause(2000);

    // Stap 1 — Facebook pages (pages_show_list, pages_read_engagement)
    await page.getByText('Kies een Facebook-page').waitFor();
    await pause(1500);
    const pageButtons = page.locator('button').filter({ has: page.locator('div.truncate.text-sm.font-medium') });
    await pageButtons.first().waitFor({ state: 'visible', timeout: 60_000 });
    const count = await pageButtons.count();
    console.log(`Facebook pages in UI: ${count}`);
    if (count > 0) {
      await pageButtons.first().click();
      await pause(1000);
      if (count >= 2) {
        const scrollBox = page.locator('.max-h-\\[min\\(50dvh\\,22rem\\)\\]').first();
        if (await scrollBox.isVisible().catch(() => false)) {
          await scrollBox.evaluate((el) => { el.scrollTop = el.scrollHeight; });
          await pause(1200);
          await scrollBox.evaluate((el) => { el.scrollTop = 0; });
          await pause(1200);
        }
      }
      const search = page.getByPlaceholder('Zoek page op naam of ID');
      if (await search.isVisible().catch(() => false)) {
        await search.fill('Service');
        await pause(1500);
        await search.fill('');
        await pause(1000);
      }
    }

    await page.getByRole('button', { name: 'Volgende' }).click();
    await pause(2000);

    // Stap 2 — AI draft (leads_retrieval context)
    await page.getByText('Laat AI het formulier ontwerpen').waitFor({ timeout: 15_000 });
    await pause(2000);
    const modalFooter = page.locator('.shrink-0.flex.items-center.justify-between').last();
    await modalFooter.getByRole('button', { name: 'Genereer', exact: true }).click();
    await page.getByText('Check + bewerk het formulier').waitFor({ state: 'visible', timeout: 90_000 });
    await pause(3000);

    // Stap 3 — edit
    await modalFooter.getByRole('button', { name: 'Verder', exact: true }).click();
    await pause(3000);

    // Stap 4 — create in Meta (pages_manage_ads)
    await page.getByRole('button', { name: 'Maak aan in Meta' }).waitFor({ state: 'visible' });
    await pause(2000);
    await page.getByRole('button', { name: 'Maak aan in Meta' }).click();
    await pause(5000);

    // Show error or success message
    const errBox = page.locator('text=/capability|mislukt|fout|error/i').first();
    await errBox.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
    await pause(4000);

    await page.keyboard.press('Escape');
    await pause(1500);

    // Brief / launch area (ads_management)
    await page.getByText('Brief').first().scrollIntoViewIfNeeded();
    await pause(2500);
    const launchArea = page.getByText(/Lanceer|Launch|live zetten/i).first();
    if (await launchArea.isVisible().catch(() => false)) {
      await launchArea.scrollIntoViewIfNeeded();
      await pause(2000);
    }

    await showBanner(page, 'End of demo — Warme Leads admin CRM', 2500);
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  // Playwright writes webm per context — find newest
  const videos = readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.webm'))
    .map((f) => ({ f, mtime: statSync(join(OUT_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!videos.length) throw new Error('Geen video opgenomen');
  const webmPath = join(OUT_DIR, videos[0].f);
  const mp4Path = join(OUT_DIR, 'warmeleads-meta-app-review.mp4');

  const ffmpeg = findFfmpeg();
  if (ffmpeg) {
    execSync(
      `"${ffmpeg}" -y -i "${webmPath}" -c:v libx264 -pix_fmt yuv420p -movflags +faststart -an "${mp4Path}"`,
      { stdio: 'inherit' },
    );
    try { unlinkSync(webmPath); } catch { /* ignore */ }
    console.log(`\n✅ Screencast: ${mp4Path}`);
  } else {
    console.log(`\n✅ Screencast (webm): ${webmPath}\nInstalleer ffmpeg voor MP4-export.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
