import postgres from 'postgres';
import fs from 'fs';

// Read .env.local manually to get Supabase URL
const envContent = fs.readFileSync('.env.local', 'utf-8');

function getEnvVar(name) {
  const regex = new RegExp(`^(?:#\\s*)?${name}=(?:"([^"]*)"|'([^']*)'|([^\\s#]+))`, 'm');
  const match = envContent.match(regex);
  if (!match) return null;
  return match[1] || match[2] || match[3] || null;
}

const supabaseUrl = getEnvVar('DATABASE_URL');

if (!supabaseUrl) {
  console.error('Missing DATABASE_URL in .env.local');
  process.exit(1);
}

const usersData = [
  {
    "id": "0173a431-97a5-4ece-8fbb-0becaf12857b",
    "name": "vanesa",
    "email": null,
    "phone": null,
    "role": "MANAGER",
    "created_at": 1778199491,
    "password": "$2b$10$FmZqHbHUFK0dhkWPJ08HYe5u/t2OYRHRQRA5fGDtWTwXOa6M94ZXS",
    "last_login_at": 1780533283,
    "client_type": "INDIVIDUAL",
    "organization_name": null,
    "email_verified": null,
    "image": null
  },
  {
    "id": "229f25a1-6bbd-4691-8dce-83f56be2dea1",
    "name": "agostina",
    "email": null,
    "phone": null,
    "role": "MANAGER",
    "created_at": 1778199492,
    "password": "$2b$10$rVyDBI4OG.LNoFGoUiwLkObiiefjFe9grEIXXATCbZ5A8qnfmWZ6O",
    "last_login_at": 1780533823,
    "client_type": "INDIVIDUAL",
    "organization_name": null,
    "email_verified": null,
    "image": null
  },
  {
    "id": "885b35bf-15e9-4319-8b34-2a804afb0f55",
    "name": "admin",
    "email": "admin@sportgarden.com",
    "phone": null,
    "role": "OWNER",
    "created_at": 1777942787,
    "password": "$2b$10$vP7sB1o93qOcBwy/bse02ulUlV851LdGRUqHNXUKU4IfXI8WfsaRK",
    "last_login_at": 1780595272,
    "client_type": "INDIVIDUAL",
    "organization_name": null,
    "email_verified": null,
    "image": null
  },
  {
    "id": "a560751b-89df-44eb-a286-0c07ada83734",
    "name": "gardenclub",
    "email": null,
    "phone": null,
    "role": "OWNER",
    "created_at": 1778199493,
    "password": "$2b$10$F45Pihyj7WnXCfezDJHv8OJ8e7dm.wbCOoOYXqynKBOpsV03dnA1.",
    "last_login_at": 1780591130,
    "client_type": "INDIVIDUAL",
    "organization_name": null,
    "email_verified": null,
    "image": null
  },
  {
    "id": "b7c5b7f8-a40a-4ac4-a390-b5a25bfb0ffa",
    "name": "Bautista Babuin",
    "email": "bautistababuin@gmail.com",
    "phone": "1154091935",
    "role": "REGISTERED",
    "created_at": 1780662998,
    "password": "$2b$10$IiU1dXKOHVJ6bxtS2vLSzen86y.TQ508kiUr/E/4P4TCZxzrn.gea",
    "last_login_at": null,
    "client_type": "INDIVIDUAL",
    "organization_name": null,
    "email_verified": null,
    "image": null
  },
  {
    "id": "c478d40d-9b1c-49e0-85ab-98b88e55fb7d",
    "name": "mariajose",
    "email": null,
    "phone": null,
    "role": "EMPLOYEE",
    "created_at": 1778199492,
    "password": "$2b$10$O7uhxeJwtwz4C2dX29jGO.pvcCnH5wxVoLqxg8YGQQ7pMrqRbv5Q.",
    "last_login_at": null,
    "client_type": "INDIVIDUAL",
    "organization_name": null,
    "email_verified": null,
    "image": null
  },
  {
    "id": "usr-diego-1778110114550",
    "name": "diego",
    "email": "diego@sportgarden.com",
    "phone": null,
    "role": "DEV",
    "created_at": 1778110114,
    "password": "$2b$10$vzdncASU.6EYfd6aBDYGuew5Rd1booDN6hMxLn/Etxx5EmT5Qbf6G",
    "last_login_at": 1779290450,
    "client_type": "INDIVIDUAL",
    "organization_name": null,
    "email_verified": null,
    "image": null
  },
  {
    "id": "usr-seba-1778110113856",
    "name": "seba",
    "email": "seba@sportgarden.com",
    "phone": null,
    "role": "DEV",
    "created_at": 1778110114,
    "password": "$2b$10$EPm0nwbnKeWBzfCYD14Fe.JmdgL7BB6sCkgMwhCx1QUuHkNzXJDEm",
    "last_login_at": 1780405400,
    "client_type": "INDIVIDUAL",
    "organization_name": null,
    "email_verified": null,
    "image": null
  }
];

console.log('Connecting to Supabase...');
const sql = postgres(supabaseUrl, { prepare: false, ssl: 'require' });

try {
  console.log(`Migrating ${usersData.length} users to Supabase...`);

  for (const row of usersData) {
    // Map SQLite unix timestamps (seconds) to JavaScript Date objects
    const createdAt = row.created_at ? new Date(row.created_at * 1000) : new Date();
    const lastLoginAt = row.last_login_at ? new Date(row.last_login_at * 1000) : null;
    const emailVerified = row.email_verified ? new Date(row.email_verified * 1000) : null;

    console.log(`Inserting/Upserting user: ${row.name} (${row.id})...`);

    await sql`
      INSERT INTO users (
        id, name, email, password, phone, role, 
        client_type, organization_name, email_verified, image, 
        last_login_at, created_at
      ) VALUES (
        ${row.id}, ${row.name}, ${row.email}, ${row.password}, ${row.phone}, ${row.role}, 
        ${row.client_type}, ${row.organization_name}, ${emailVerified}, ${row.image}, 
        ${lastLoginAt}, ${createdAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        password = EXCLUDED.password,
        phone = EXCLUDED.phone,
        role = EXCLUDED.role,
        client_type = EXCLUDED.client_type,
        organization_name = EXCLUDED.organization_name,
        email_verified = EXCLUDED.email_verified,
        image = EXCLUDED.image,
        last_login_at = EXCLUDED.last_login_at,
        created_at = EXCLUDED.created_at
    `;
  }

  console.log('Users migration completed successfully!');
  process.exit(0);
} catch (err) {
  console.error('Users migration failed:', err);
  process.exit(1);
} finally {
  await sql.end();
}
