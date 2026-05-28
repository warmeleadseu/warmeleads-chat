import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { getMetaCredentials, META_GRAPH_URL } from '../src/lib/meta';

config({ path: resolve(process.cwd(), '.env.vercel.prod.full') });

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: keys } = await sb.from('webhook_keys').select('id,key,branch,name');
  console.log('webhook_keys:', keys?.filter((k) => k.branch?.includes('thuis') || k.key?.includes('756c9f')));

  const { data: settings } = await sb
    .from('app_settings')
    .select('key,value')
    .or('key.like.webhook_form:%,key.like.field_mapping:%');
  for (const s of settings || []) console.log(s.key, '=', String(s.value).slice(0, 100));

  const creds = await getMetaCredentials();
  if (!creds) throw new Error('no meta');
  const token = creds.accessToken;
  const acct = creds.adAccountId.replace(/^act_/, '');
  const res = await fetch(
    `${META_GRAPH_URL}/act_${acct}/campaigns?fields=promoted_object&limit=100&access_token=${token}`,
  );
  const camps = await res.json();
  const pageIds = new Set<string>();
  for (const c of camps.data || []) {
    if (c.promoted_object?.page_id) pageIds.add(c.promoted_object.page_id);
  }
  console.log('pages', [...pageIds]);
  for (const pid of pageIds) {
    const fr = await fetch(
      `${META_GRAPH_URL}/${pid}/leadgen_forms?fields=id,name,status&limit=100&access_token=${token}`,
    );
    const fd = await fr.json();
    for (const f of fd.data || []) console.log('FORM', f.id, '|', f.name, '|', f.status);
  }
}

main().catch(console.error);
