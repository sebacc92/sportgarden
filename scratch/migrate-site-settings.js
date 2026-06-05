import { createClient } from '@libsql/client';
import postgres from 'postgres';
import fs from 'fs';

// Read .env.local manually to get Turso and Supabase URLs
const envContent = fs.readFileSync('.env.local', 'utf-8');

function getEnvVar(name) {
  const regex = new RegExp(`^(?:#\\s*)?${name}=(?:"([^"]*)"|'([^']*)'|([^\\s#]+))`, 'm');
  const match = envContent.match(regex);
  if (!match) return null;
  return match[1] || match[2] || match[3] || null;
}

const tursoUrl = getEnvVar('TURSO_DATABASE_URL');
const tursoToken = getEnvVar('TURSO_AUTH_TOKEN');
const supabaseUrl = getEnvVar('DATABASE_URL');

if (!tursoUrl || !supabaseUrl) {
  console.error('Missing Turso or Supabase credentials in .env.local');
  process.exit(1);
}

console.log('Connecting to Turso:', tursoUrl);
const turso = createClient({
  url: tursoUrl,
  authToken: tursoToken || undefined,
});

console.log('Connecting to Supabase...');
const sql = postgres(supabaseUrl, { prepare: false, ssl: 'require' });

// Safe helper to parse JSON fields
function safeParseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    console.warn('Failed to parse JSON field:', value, err.message);
    return null;
  }
}

try {
  console.log('Fetching site_settings from Turso...');
  const result = await turso.execute('SELECT * FROM site_settings');
  const settings = result.rows;
  console.log(`Found ${settings.length} site_settings records in Turso.`);

  if (settings.length === 0) {
    console.log('No site_settings to migrate.');
    process.exit(0);
  }

  console.log('Migrating site_settings to Supabase...');
  for (const row of settings) {
    // Map individual fields
    const mappedRow = {
      id: parseInt(row.id),
      ai_enabled: row.ai_enabled === 1 || row.ai_enabled === true,
      store_enabled: row.store_enabled !== undefined ? (row.store_enabled === 1 || row.store_enabled === true) : true,
      ai_tone: row.ai_tone || null,
      ai_instructions: row.ai_instructions || null,
      ai_knowledge: row.ai_knowledge || null,
      ai_initial_greeting: row.ai_initial_greeting || null,
      ai_call_to_action: row.ai_call_to_action || null,
      whatsapp_number: row.whatsapp_number || null,
      ai_avatar_url: row.ai_avatar_url || null,
      club_name: row.club_name || null,
      club_address: row.club_address || null,
      club_phone: row.club_phone || null,
      club_status: row.club_status || 'AUTO',
      operating_hours: safeParseJson(row.operating_hours),
      services: safeParseJson(row.services),
      extra_services: safeParseJson(row.extra_services),
      bank_alias: row.bank_alias || null,
      gallery_images: safeParseJson(row.gallery_images),
      reels: safeParseJson(row.reels),
      school_categories: safeParseJson(row.school_categories),
      payment_methods: safeParseJson(row.payment_methods),
      movement_categories: safeParseJson(row.movement_categories),
      holidays: safeParseJson(row.holidays),
      landing_texts: safeParseJson(row.landing_texts),
      hero_slides: safeParseJson(row.hero_slides),
      promo_popup: safeParseJson(row.promo_popup),
      mp_access_token: row.mp_access_token || null,
      mp_refresh_token: row.mp_refresh_token || null,
      mp_public_key: row.mp_public_key || null,
      mp_token_expires_at: row.mp_token_expires_at ? new Date(row.mp_token_expires_at * 1000) : null,
      payway_site_id: row.payway_site_id || null,
      payway_public_key: row.payway_public_key || null,
      payway_private_key: row.payway_private_key || null,
      payway_environment: row.payway_environment || 'SANDBOX',
      is_payway_active: row.is_payway_active === 1 || row.is_payway_active === true,
      updated_at: row.updated_at ? new Date(row.updated_at * 1000) : new Date()
    };

    console.log(`Inserting/Upserting site_settings record ID: ${mappedRow.id}...`);

    await sql`
      INSERT INTO site_settings (
        id, ai_enabled, store_enabled, ai_tone, ai_instructions, ai_knowledge, 
        ai_initial_greeting, ai_call_to_action, whatsapp_number, ai_avatar_url, 
        club_name, club_address, club_phone, club_status, operating_hours, 
        services, extra_services, bank_alias, gallery_images, reels, 
        school_categories, payment_methods, movement_categories, holidays, 
        landing_texts, hero_slides, promo_popup, mp_access_token, mp_refresh_token, 
        mp_public_key, mp_token_expires_at, payway_site_id, payway_public_key, 
        payway_private_key, payway_environment, is_payway_active, updated_at
      ) VALUES (
        ${mappedRow.id}, ${mappedRow.ai_enabled}, ${mappedRow.store_enabled}, ${mappedRow.ai_tone}, ${mappedRow.ai_instructions}, ${mappedRow.ai_knowledge}, 
        ${mappedRow.ai_initial_greeting}, ${mappedRow.ai_call_to_action}, ${mappedRow.whatsapp_number}, ${mappedRow.ai_avatar_url}, 
        ${mappedRow.club_name}, ${mappedRow.club_address}, ${mappedRow.club_phone}, ${mappedRow.club_status}, ${mappedRow.operating_hours}, 
        ${mappedRow.services}, ${mappedRow.extra_services}, ${mappedRow.bank_alias}, ${mappedRow.gallery_images}, ${mappedRow.reels}, 
        ${mappedRow.school_categories}, ${mappedRow.payment_methods}, ${mappedRow.movement_categories}, ${mappedRow.holidays}, 
        ${mappedRow.landing_texts}, ${mappedRow.hero_slides}, ${mappedRow.promo_popup}, ${mappedRow.mp_access_token}, ${mappedRow.mp_refresh_token}, 
        ${mappedRow.mp_public_key}, ${mappedRow.mp_token_expires_at}, ${mappedRow.payway_site_id}, ${mappedRow.payway_public_key}, 
        ${mappedRow.payway_private_key}, ${mappedRow.payway_environment}, ${mappedRow.is_payway_active}, ${mappedRow.updated_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        ai_enabled = EXCLUDED.ai_enabled,
        store_enabled = EXCLUDED.store_enabled,
        ai_tone = EXCLUDED.ai_tone,
        ai_instructions = EXCLUDED.ai_instructions,
        ai_knowledge = EXCLUDED.ai_knowledge,
        ai_initial_greeting = EXCLUDED.ai_initial_greeting,
        ai_call_to_action = EXCLUDED.ai_call_to_action,
        whatsapp_number = EXCLUDED.whatsapp_number,
        ai_avatar_url = EXCLUDED.ai_avatar_url,
        club_name = EXCLUDED.club_name,
        club_address = EXCLUDED.club_address,
        club_phone = EXCLUDED.club_phone,
        club_status = EXCLUDED.club_status,
        operating_hours = EXCLUDED.operating_hours,
        services = EXCLUDED.services,
        extra_services = EXCLUDED.extra_services,
        bank_alias = EXCLUDED.bank_alias,
        gallery_images = EXCLUDED.gallery_images,
        reels = EXCLUDED.reels,
        school_categories = EXCLUDED.school_categories,
        payment_methods = EXCLUDED.payment_methods,
        movement_categories = EXCLUDED.movement_categories,
        holidays = EXCLUDED.holidays,
        landing_texts = EXCLUDED.landing_texts,
        hero_slides = EXCLUDED.hero_slides,
        promo_popup = EXCLUDED.promo_popup,
        mp_access_token = EXCLUDED.mp_access_token,
        mp_refresh_token = EXCLUDED.mp_refresh_token,
        mp_public_key = EXCLUDED.mp_public_key,
        mp_token_expires_at = EXCLUDED.mp_token_expires_at,
        payway_site_id = EXCLUDED.payway_site_id,
        payway_public_key = EXCLUDED.payway_public_key,
        payway_private_key = EXCLUDED.payway_private_key,
        payway_environment = EXCLUDED.payway_environment,
        is_payway_active = EXCLUDED.is_payway_active,
        updated_at = EXCLUDED.updated_at
    `;
  }

  console.log('site_settings migration completed successfully!');
  process.exit(0);
} catch (err) {
  console.error('site_settings migration failed:', err);
  process.exit(1);
} finally {
  await sql.end();
}
