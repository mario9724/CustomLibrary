const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDB() {
  const client = await pool.connect();
  try {
    console.log('🔥 Initializing database...');
    const forceReset = true;

    if (forceReset) {
      console.log('⚠️ FORCE RESET ENABLED - Dropping all tables...');
      await client.query('DROP TABLE IF EXISTS watched_items CASCADE');
      await client.query('DROP TABLE IF EXISTS activity_feed CASCADE');
      await client.query('DROP TABLE IF EXISTS user_achievements CASCADE');
      await client.query('DROP TABLE IF EXISTS list_comments CASCADE');
      await client.query('DROP TABLE IF EXISTS list_votes CASCADE');
      await client.query('DROP TABLE IF EXISTS item_ratings CASCADE');
      await client.query('DROP TABLE IF EXISTS item_notes CASCADE');
      await client.query('DROP TABLE IF EXISTS item_tags CASCADE');
      await client.query('DROP TABLE IF EXISTS list_items CASCADE');
      await client.query('DROP TABLE IF EXISTS list_collaborators CASCADE');
      await client.query('DROP TABLE IF EXISTS lists CASCADE');
      await client.query('DROP TABLE IF EXISTS user_friends CASCADE');
      await client.query('DROP TABLE IF EXISTS users CASCADE');
      console.log('✅ All tables dropped successfully');
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        username VARCHAR(255) PRIMARY KEY,
        pin VARCHAR(4) NOT NULL,
        addon_name VARCHAR(255) DEFAULT 'CustomLibrary',
        tmdb_key VARCHAR(255),
        language VARCHAR(10) DEFAULT 'en',
        theme VARCHAR(20) DEFAULT 'dark',
        streaming_services TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Users table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_friends (
        username VARCHAR(255) REFERENCES users(username) ON DELETE CASCADE,
        friend_username VARCHAR(255),
        added_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (username, friend_username)
      )
    `);
    console.log('✅ User friends table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS lists (
        id UUID PRIMARY KEY,
        owner VARCHAR(255) REFERENCES users(username) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        stremio_type VARCHAR(20) NOT NULL DEFAULT 'movie',
        list_order INTEGER DEFAULT 0,
        pin VARCHAR(6) UNIQUE,
        is_collaborative BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Lists table created (with stremio_type)');

    await client.query(`
      CREATE TABLE IF NOT EXISTS list_collaborators (
        list_id UUID REFERENCES lists(id) ON DELETE CASCADE,
        username VARCHAR(255),
        added_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (list_id, username)
      )
    `);
    console.log('✅ List collaborators table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS list_items (
        id UUID PRIMARY KEY,
        list_id UUID REFERENCES lists(id) ON DELETE CASCADE,
        tmdb_id VARCHAR(50),
        imdb_id VARCHAR(50),
        media_type VARCHAR(20),
        title VARCHAR(500),
        poster VARCHAR(500),
        overview TEXT,
        rating VARCHAR(20),
        added_by VARCHAR(255),
        added_at TIMESTAMP DEFAULT NOW(),
        release_date DATE,
        runtime INTEGER,
        genres TEXT[],
        director VARCHAR(255),
        cast_members TEXT[]
      )
    `);
    console.log('✅ List items table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS item_tags (
        id UUID PRIMARY KEY,
        item_id UUID REFERENCES list_items(id) ON DELETE CASCADE,
        username VARCHAR(255),
        tag VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_item_tags_unique ON item_tags(item_id, username, tag)`);
    console.log('✅ Item tags table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS item_notes (
        id UUID PRIMARY KEY,
        item_id UUID REFERENCES list_items(id) ON DELETE CASCADE,
        username VARCHAR(255),
        note TEXT,
        is_private BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_item_notes_unique ON item_notes(item_id, username)`);
    console.log('✅ Item notes table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS item_ratings (
        id UUID PRIMARY KEY,
        item_id UUID REFERENCES list_items(id) ON DELETE CASCADE,
        username VARCHAR(255),
        stars INTEGER CHECK (stars >= 1 AND stars <= 5),
        review TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_item_ratings_unique ON item_ratings(item_id, username)`);
    console.log('✅ Item ratings table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS list_votes (
        id UUID PRIMARY KEY,
        list_id UUID REFERENCES lists(id) ON DELETE CASCADE,
        item_id UUID REFERENCES list_items(id) ON DELETE CASCADE,
        username VARCHAR(255),
        vote INTEGER CHECK (vote IN (-1, 1)),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_list_votes_unique ON list_votes(list_id, item_id, username)`);
    console.log('✅ List votes table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS list_comments (
        id UUID PRIMARY KEY,
        list_id UUID REFERENCES lists(id) ON DELETE CASCADE,
        item_id UUID REFERENCES list_items(id) ON DELETE CASCADE,
        username VARCHAR(255),
        comment TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ List comments table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_achievements (
        id UUID PRIMARY KEY,
        username VARCHAR(255),
        achievement_key VARCHAR(100),
        earned_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_achievements_unique ON user_achievements(username, achievement_key)`);
    console.log('✅ User achievements table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_feed (
        id UUID PRIMARY KEY,
        username VARCHAR(255),
        action_type VARCHAR(50),
        target_type VARCHAR(50),
        target_id UUID,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Activity feed table created');

    await client.query(`
      CREATE TABLE IF NOT EXISTS watched_items (
        id UUID PRIMARY KEY,
        username VARCHAR(255),
        item_id UUID REFERENCES list_items(id) ON DELETE CASCADE,
        watched_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_watched_items_unique ON watched_items(username, item_id)`);
    console.log('✅ Watched items table created');

    console.log('🎉 Database initialized successfully with all tables');
  } catch (err) {
    console.error('❌ Database initialization error:', err);
  } finally {
    client.release();
  }
}

initDB();

// ============ STREMIO ADDON ENDPOINTS ============
app.get('/manifest.json', async (req, res) => {
  const { username, addonName } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    // Verificar que el usuario existe
    const userResult = await pool.query('SELECT addon_name FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const finalAddonName = addonName || userResult.rows[0].addon_name || 'CustomLibrary';

    // Obtener todas las listas del usuario para crear catálogos dinámicos
    const listsResult = await pool.query(`
      SELECT l.* FROM lists l
      LEFT JOIN list_collaborators lc ON l.id = lc.list_id
      WHERE l.owner = $1 OR lc.username = $1
      ORDER BY l.list_order ASC
    `, [username]);

    // Crear un catálogo por cada lista usando el UUID como ID único
    const catalogs = listsResult.rows.map(list => ({
      type: list.stremio_type,  // movie o series
      id: list.id,              // UUID puro de la lista
      name: list.name           // Tu nombre custom: "Terror", "Anime 90s", etc.
    }));

    const manifest = {
      id: `com.customlibrary.${username}`,
      version: '1.0.0',
      name: finalAddonName,
      description: `Personal library for ${username} with custom lists and ratings`,
      logo: `${req.protocol}://${req.get('host')}/icon.svg`,
      resources: ['catalog', 'meta'],
      types: ['movie', 'series'],
      catalogs: catalogs,
      idPrefixes: ['tt', 'tmdb']
    };

    res.json(manifest);
  } catch (err) {
    console.error('Error generating manifest:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/catalog/:type/:id.json', async (req, res) => {
  const { type, id } = req.params;
  const skip = parseInt(req.query.skip) || 0;

  try {
    // Verificar que la lista existe y tiene el stremio_type correcto
    const listResult = await pool.query(
      'SELECT owner FROM lists WHERE id = $1 AND stremio_type = $2',
      [id, type]
    );

    if (listResult.rows.length === 0) {
      return res.status(404).json({ metas: [] });
    }

    // Obtener items de la lista
    const itemsResult = await pool.query(`
      SELECT * FROM list_items 
      WHERE list_id = $1 
      ORDER BY added_at DESC 
      LIMIT 100 OFFSET $2
    `, [id, skip]);

    // Convertir items al formato meta preview de Stremio
    const metas = itemsResult.rows.map(item => ({
      id: item.imdb_id || `tmdb:${item.tmdb_id}`,
      type: item.media_type === 'tv' ? 'series' : 'movie',
      name: item.title,
      poster: item.poster,
      posterShape: 'poster',
      description: item.overview,
      releaseInfo: item.release_date ? new Date(item.release_date).getFullYear().toString() : undefined,
      imdbRating: item.rating
    }));

    res.json({ metas });
  } catch (err) {
    console.error('Error in catalog endpoint:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/meta/:type/:id.json', async (req, res) => {
  const { type, id } = req.params;

  try {
    // Buscar el item en las listas del usuario por IMDB ID o TMDB ID
    const itemResult = await pool.query(`
      SELECT li.*, l.name as list_name, l.stremio_type
      FROM list_items li
      JOIN lists l ON li.list_id = l.id
      WHERE (li.imdb_id = $1 OR li.tmdb_id = $2)
    `, [id, id.replace('tmdb:', '')]);

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ meta: null });
    }

    const item = itemResult.rows[0];

    // Obtener ratings del item
    const ratingsResult = await pool.query(
      'SELECT * FROM item_ratings WHERE item_id = $1',
      [item.id]
    );

    const avgRating = ratingsResult.rows.length > 0
      ? (ratingsResult.rows.reduce((sum, r) => sum + r.stars, 0) / ratingsResult.rows.length).toFixed(1)
      : null;

    const meta = {
      id: item.imdb_id || `tmdb:${item.tmdb_id}`,
      type: item.media_type === 'tv' ? 'series' : 'movie',
      name: item.title,
      poster: item.poster,
      posterShape: 'poster',
      background: item.poster,
      logo: item.poster,
      description: item.overview,
      releaseInfo: item.release_date ? new Date(item.release_date).getFullYear().toString() : undefined,
      runtime: item.runtime ? `${item.runtime} min` : undefined,
      genres: item.genres || [],
      director: item.director ? [item.director] : undefined,
      cast: item.cast_members || [],
      imdbRating: item.rating,
      // Datos personalizados
      userRating: avgRating,
      inList: item.list_name,
      links: [
        {
          name: 'IMDB',
          category: 'imdb',
          url: item.imdb_id ? `https://www.imdb.com/title/${item.imdb_id}` : undefined
        },
        {
          name: 'TMDB',
          category: 'tmdb',
          url: `https://www.themoviedb.org/${item.media_type === 'tv' ? 'tv' : 'movie'}/${item.tmdb_id}`
        }
      ].filter(link => link.url)
    };

    res.json({ meta });
  } catch (err) {
    console.error('Error in meta endpoint:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ TODO EL RESTO DE ENDPOINTS (auth, listas, etc.) ============
// [Aquí va TODO tu código existente de /api/... sin cambios]
// ... (auth, tmdb, friends, lists, items, tags, notes, ratings, etc.)

// Copia aquí desde tu server.js actual TODO lo que esté entre initDB() y el final, 
// pero ELIMINA cualquier sección anterior de manifest/catalog/meta que tengas

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📺 Stremio: http://localhost:${PORT}/manifest.json?username=TU_USERNAME`);
  console.log(`🎯 Catalog ejemplo: http://localhost:${PORT}/catalog/movie/LIST_UUID.json`);
});
