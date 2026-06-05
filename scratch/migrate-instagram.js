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

const instagramData = [
  {
    "id": "17856188259641320",
    "permalink": "https://www.instagram.com/reel/DYDM_JfJu2q/",
    "media_url": "https://scontent-lga3-3.cdninstagram.com/v/t51.71878-15/688601603_1010919168029627_4629924956393220293_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=106&ccb=7-5&_nc_sid=18de74&efg=eyJlZmdfdGFnIjoiQ0xJUFMuYmVzdF9pbWFnZV91cmxnZW4uQzMifQ%3D%3D&_nc_ohc=R1x3v2CZeUQQ7kNvwFfzJLb&_nc_oc=AdoYZsc_h82NOvqmLIa_d8TX22utfQB3w4vtmneK5Vs0Bm8ep9HfvFPYuw3JNYq4CbQ&_nc_zt=23&_nc_ht=scontent-lga3-3.cdninstagram.com&edm=ANo9K5cEAAAA&_nc_gid=EgEna4TjfjxZlDOFYPRidw&_nc_tpa=Q5bMBQHuauGmLLjT9oDU_a_PhDkYlfUmXuxTDtpgFIcRrxl6eUqZ7tWAk-ydMrIAQbnua7ADySZYHO9Cqw&oh=00_Af-Gt_GXU3m89TpZlzH93QyydvD38CvlsgNP5HnaXSE4-w&oe=6A27B38B",
    "media_type": "VIDEO",
    "caption": "¡Ahora también pueden vivir sus partidos fuera de la cancha!\n\nDescarguen esas jugadas para seguir comentando y disfrutando con sus amigos 🙌🏾\n\n⚽️\n\n⚽️\n\n⚽️",
    "timestamp": "2026-05-07T20:05:19+0000"
  },
  {
    "id": "17974764156010309",
    "permalink": "https://www.instagram.com/p/DWWXV7LEe18/",
    "media_url": "https://scontent-lga3-1.cdninstagram.com/v/t51.82787-15/656291192_18040921142770701_8588415954243858301_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=110&ccb=7-5&_nc_sid=18de74&efg=eyJlZmdfdGFnIjoiRkVFRC5iZXN0X2ltYWdlX3VybGdlbi5DMyJ9&_nc_ohc=4qcK6W_IQ4oQ7kNvwH5gSJB&_nc_oc=Adp1y_ElW5wd-v6HpQ_WbzvMw1-_SYdSBrzWMfxCYyevj41MYwkc0lNf_7phKWaYLnk&_nc_zt=23&_nc_ht=scontent-lga3-1.cdninstagram.com&edm=ANo9K5cEAAAA&_nc_gid=HObcxLLOF21HcLS6zWg6AQ&_nc_tpa=Q5bMBQFaQ8rg58b4Z-yQR2N8izZykbpFOHltqioH05xiUN5LLzjPAUd_sq4O_4t1PY0a8hNqXHl_nOOGHw&oh=00_Af9eKoE2Nw14aoQh-94odgTmFEu2VNpF0dV31vJ5F_-Mkw&oe=6A21FA43",
    "media_type": "IMAGE",
    "caption": "ESCUELITA este 2026\n\n⚽️⚽️⚽️",
    "timestamp": "2026-03-26T13:33:14+0000"
  },
  {
    "id": "17989063769814012",
    "permalink": "https://www.instagram.com/p/DZLNNtUp8wd/",
    "media_url": "https://scontent-lga3-2.cdninstagram.com/v/t51.82787-15/716702655_18050468924770701_7247287490612789420_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=101&ccb=7-5&_nc_sid=18de74&efg=eyJlZmdfdGFnIjoiRkVFRC5iZXN0X2ltYWdlX3VybGdlbi5DMyJ9&_nc_ohc=RvhtyghRkq0Q7kNvwGKjuVS&_nc_oc=AdoYtEb2h5lFCiBRSb9ldRaMNeJbUiuP5TWrLix7qK_gIpJl4GuUg1VUlvbj6ZArNz4&_nc_zt=23&_nc_ht=scontent-lga3-2.cdninstagram.com&edm=ANo9K5cEAAAA&_nc_gid=EgEna4TjfjxZlDOFYPRidw&_nc_tpa=Q5bMBQHTZPjEDybZSe8sljusiyepRaiqh67B0QLpokTgl8Ztd4Ql2IB9lslH7bIZiihoYoY-rJf7UVQWTA&oh=00_Af9wdqR1MBS7MdNZMz_qaOwITbFnQps3d7yfGlVhoO9u2A&oe=6A27AAE6",
    "media_type": "IMAGE",
    "caption": "⚽ Hola! Hoy te presentamos nuestra nueva marca!\n\nNos renovamos para seguir creciendo junto a vos y ofrecerte una experiencia cada vez mejor.\n\nDesde 1997, trabajamos con una misma pasión: crear el espacio ideal para quienes viven el fútbol como nosotros. A lo largo de estos años, nos convertimos en un punto de encuentro donde el deporte, la amistad y la competencia se disfrutan en cada partido.\n\nCreemos que el fútbol es mucho más que un juego: es barrio, amistad, compañerismo y esfuerzo. Por eso, seguimos invirtiendo para brindarte las mejores instalaciones y la máxima calidad en cada detail.\n\n🌱 Canchas con césped sintético de primer nivel de @forbexcespedsintetico\n⚽ Canchas de fútbol 5, 6 y 9 para alquiler\n👦 Escuelita de fútbol para todas las edades\n🍔 Buffet con opciones para disfrutar antes y después del partido\n\n📍 Todo lo que necesitás para vivir el fútbol en un solo lugar. ¡Te esperamos! ⚽🔥\n\nY esto es solo el comienzo...\n\n💻 Próximamente lanzaremos nuestro nuevo sitio web con sistema de reservas online para que organizar tu partido sea más fácil que nunca.\n\n¡Te esperamos para seguir compartiendo la pasión por el fútbol!\n\nGarden Club\n\n📲 Reservas y consultas: +54 9 11 4479-6321\n📍 Pedro Morán 2379, Buenos Aires, Argentina",
    "timestamp": "2026-06-04T19:09:35+0000"
  },
  {
    "id": "18031659619383044",
    "permalink": "https://www.instagram.com/p/Chctr58L2w0/",
    "media_url": "https://scontent-lga3-3.cdninstagram.com/v/t51.82787-15/626437683_18173253070383044_6329520694376613300_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ccb=7-5&_nc_sid=18de74&efg=eyJlZmdfdGFnIjoiRkVFRC5iZXN0X2ltYWdlX3VybGdlbi5DMyJ9&_nc_ohc=upw3DgD7SxgQ7kNvwFx3qw5&_nc_oc=AdoelAST9VfJS2Vt0wXGN5A7J2qjsEQaQdQFlGIohRaqVgETGHNVCeyz9jPpzbcWW3c&_nc_zt=23&_nc_ht=scontent-lga3-3.cdninstagram.com&edm=ANo9K5cEAAAA&_nc_gid=HObcxLLOF21HcLS6zWg6AQ&_nc_tpa=Q5bMBQEyQG6krnkhvwtaCIOGg4vKA9yd6H2uHisjxMuvplLP0Sy0rpIDjw3JR33_0_L3aUKMJ9NU5tpnMQ&oh=00_Af8YDiRSoKFc37XMziU89El959RBhMopileDkoDI2B5Brg&oe=6A2206D6",
    "media_type": "IMAGE",
    "caption": "Se acerca el finde 💥💥💥\n\nLa onda es venir a jugar con amigos, ducharse y seguir de largo ⚽️❤️\u200d🔥\n\nReservas al 11 4479-6321 📲\n\n¡Nos vemos gente!\n.\n.\n.\n.\n.\n.\n.",
    "timestamp": "2022-08-19T16:59:25+0000"
  },
  {
    "id": "18193721302202765",
    "permalink": "https://www.instagram.com/p/ChuC6bXuH4t/",
    "media_url": "https://scontent-lga3-1.cdninstagram.com/v/t51.82787-15/628369352_18362136967202765_7985510029842904255_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ccb=7-5&_nc_sid=18de74&efg=eyJlZmdfdGFnIjoiRkVFRC5iZXN0X2ltYWdlX3VybGdlbi5DMyJ9&_nc_ohc=Z8n2XIh33tQQ7kNvwH5OtNh&_nc_oc=Adoy2O411mEsnuvndSDF7Wusz5kASzqDMeI9cFGUrsxeDONMNLoi1lZGd31QVZUNAWM&_nc_zt=23&_nc_ht=scontent-lga3-1.cdninstagram.com&edm=ANo9K5cEAAAA&_nc_gid=HObcxLLOF21HcLS6zWg6AQ&_nc_tpa=Q5bMBQH_41gQM-MKbYDhUA8ZpPwxXp2nWO-dX_N7MCxHKF04UdjHEs0_PveIUr2-DV1mEVK363nZ_NX6bw&oh=00_Af-_2nTsiMD34w24c-bLC3nEPz29WhVp7vDrICbDklZDbw&oe=6A21ECF9",
    "media_type": "IMAGE",
    "caption": "Entrenamientos y jornadas deportivas.\n\nDisponibles también para colegios y torneos.\n\nConsultanos 📲 11 4479-6321\n📞 4574-0030\n.\n.\n.\n.\n.\n.",
    "timestamp": "2022-08-26T10:32:00+0000"
  },
  {
    "id": "18313884694032338",
    "permalink": "https://www.instagram.com/p/ChmbW81LJWY/",
    "media_url": "https://scontent-lga3-3.cdninstagram.com/v/t51.82787-15/641766745_18568139224032338_7850874391085165180_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ccb=7-5&_nc_sid=18de74&efg=eyJlZmdfdGFnIjoiRkVFRC5iZXN0X2ltYWdlX3VybGdlbi5DMyJ9&_nc_ohc=QoNn88BzTHQQ7kNvwF5dMsX&_nc_oc=AdpQGnkj3tCT49SFwLt3ZP8raeMqOr4wFjAhthoz90-OcZSAHxebUvWKrRZ8MI5_B0M&_nc_zt=23&_nc_ht=scontent-lga3-3.cdninstagram.com&edm=ANo9K5cEAAAA&_nc_gid=HObcxLLOF21HcLS6zWg6AQ&_nc_tpa=Q5bMBQHrXnXP6L1ATKUA4V5I2K26CFa-_ZVX1ccIQ289HUFbgfYK_KOKVuQ8b33CmGqaG8FLwUH08Q1xvg&oh=00_Af_kLSgSy98Re-8LJBSdfKl2FyAkuarqfhFaP3HpNC3XRw&oe=6A221247",
    "media_type": "IMAGE",
    "caption": "Tenemos el mejor césped sintético, de eso, no hay dudas 💪💪💪\n@forbexcespedsintetico \n.\n.\n.\n.",
    "timestamp": "2022-08-23T11:31:41+0000"
  }
];

console.log('Connecting to Supabase...');
const sql = postgres(supabaseUrl, { prepare: false, ssl: 'require' });

try {
  console.log(`Migrating ${instagramData.length} Instagram posts to Supabase...`);

  for (const row of instagramData) {
    console.log(`Inserting/Upserting Instagram post ID: ${row.id}...`);

    await sql`
      INSERT INTO instagram_posts (
        id, permalink, media_url, media_type, caption, timestamp
      ) VALUES (
        ${row.id}, ${row.permalink}, ${row.media_url}, ${row.media_type}, ${row.caption}, ${row.timestamp}
      )
      ON CONFLICT (id) DO UPDATE SET
        permalink = EXCLUDED.permalink,
        media_url = EXCLUDED.media_url,
        media_type = EXCLUDED.media_type,
        caption = EXCLUDED.caption,
        timestamp = EXCLUDED.timestamp
    `;
  }

  console.log('Instagram posts migration completed successfully!');
  process.exit(0);
} catch (err) {
  console.error('Instagram posts migration failed:', err);
  process.exit(1);
} finally {
  await sql.end();
}
