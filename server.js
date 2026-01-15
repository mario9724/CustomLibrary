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
        list_order INTEGER DEFAULT 0,
        pin VARCHAR(6) UNIQUE,
        is_collaborative BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Lists table created');

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

// Manifest endpoint - Stremio usa este endpoint para descubrir las capacidades del addon
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
      SELECT DISTINCT l.* FROM lists l
      LEFT JOIN list_collaborators lc ON l.id = lc.list_id
      WHERE l.owner = $1 OR lc.username = $1
      ORDER BY l.list_order ASC
    `, [username]);

    // Crear un catálogo por cada lista
    const catalogs = listsResult.rows.map(list => ({
      type: list.type === 'movie' || list.type === 'series' ? list.type : 'movie',
      id: `customlibrary_${list.id}`,
      name: list.name,
      extra: [{ name: 'skip', isRequired: false }]
    }));

    // Manifest completo siguiendo el protocolo de Stremio
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

// Catalog endpoint - Retorna los items de una lista específica como catálogo
app.get('/:username/catalog/:type/:id.json', async (req, res) => {
  const { username, type, id } = req.params;
  const skip = parseInt(req.query.skip) || 0;

  try {
    // Extraer el UUID de la lista del catalog ID (formato: customlibrary_UUID)
    const listId = id.replace('customlibrary_', '');

    // Verificar acceso a la lista
    const listResult = await pool.query(`
      SELECT l.* FROM lists l
      LEFT JOIN list_collaborators lc ON l.id = lc.list_id
      WHERE l.id = $1 AND (l.owner = $2 OR lc.username = $2)
    `, [listId, username]);

    if (listResult.rows.length === 0) {
      return res.status(404).json({ error: 'List not found or access denied' });
    }

    // Obtener items de la lista
    const itemsResult = await pool.query(`
      SELECT * FROM list_items 
      WHERE list_id = $1 
      ORDER BY added_at DESC 
      LIMIT 100 OFFSET $2
    `, [listId, skip]);

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

// Meta endpoint - Retorna metadata detallada de un item específico
app.get('/:username/meta/:type/:id.json', async (req, res) => {
  const { username, type, id } = req.params;

  try {
    // Buscar el item en las listas del usuario (por IMDB ID o TMDB ID)
    const itemResult = await pool.query(`
      SELECT li.*, l.name as list_name, l.id as list_id
      FROM list_items li
      JOIN lists l ON li.list_id = l.id
      LEFT JOIN list_collaborators lc ON l.id = lc.list_id
      WHERE (l.owner = $1 OR lc.username = $1)
      AND (li.imdb_id = $2 OR li.tmdb_id = $3)
      LIMIT 1
    `, [username, id, id.replace('tmdb:', '')]);

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found in user lists' });
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

    // Obtener notas del usuario
    const noteResult = await pool.query(
      'SELECT note FROM item_notes WHERE item_id = $1 AND username = $2',
      [item.id, username]
    );

    // Obtener tags del usuario
    const tagsResult = await pool.query(
      'SELECT tag FROM item_tags WHERE item_id = $1 AND username = $2',
      [item.id, username]
    );

    // Construir respuesta meta siguiendo el protocolo de Stremio
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
      // Datos adicionales personalizados
      userRating: avgRating,
      inList: item.list_name,
      userNote: noteResult.rows[0]?.note,
      userTags: tagsResult.rows.map(t => t.tag),
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

// ============ AUTH ENDPOINTS ============
app.post('/api/auth/check-user', async (req, res) => {
  const { username } = req.body;
  try {
    const result = await pool.query('SELECT username, addon_name, language, theme FROM users WHERE username = $1', [username]);
    if (result.rows.length > 0) {
      res.json({ exists: true, user: result.rows[0] });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    console.error('Error in check-user:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, pin } = req.body;
  try {
    const result = await pool.query('SELECT username, addon_name, tmdb_key, language, theme FROM users WHERE username = $1 AND pin = $2', [username, pin]);
    if (result.rows.length > 0) {
      res.json({ success: true, user: result.rows[0] });
    } else {
      res.json({ success: false, error: 'PIN incorrecto' });
    }
  } catch (err) {
    console.error('Error in login:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { username, pin, addonName, tmdbKey, language } = req.body;
  try {
    await pool.query(
      'INSERT INTO users (username, pin, addon_name, tmdb_key, language) VALUES ($1, $2, $3, $4, $5)',
      [username, pin, addonName, tmdbKey, language]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error in register:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:username/theme', async (req, res) => {
  const { username } = req.params;
  const { theme } = req.body;
  try {
    await pool.query('UPDATE users SET theme = $1 WHERE username = $2', [theme, username]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating theme:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ TMDB & SEARCH ============
app.get('/api/tmdb/search', async (req, res) => {
  const { q, key, lang = 'es-ES' } = req.query;
  try {
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${key}&query=${encodeURIComponent(q)}&language=${lang}`;
    const response = await fetch(url);
    res.json(await response.json());
  } catch (e) {
    console.error('TMDB search error:', e);
    res.status(500).json({ error: 'TMDB request failed' });
  }
});

app.get('/api/tmdb/recommendations/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;
  const { key, type = 'movie', lang = 'es-ES' } = req.query;
  try {
    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}/recommendations?api_key=${key}&language=${lang}`;
    const response = await fetch(url);
    res.json(await response.json());
  } catch (e) {
    console.error('TMDB recommendations error:', e);
    res.status(500).json({ error: 'TMDB request failed' });
  }
});

app.get('/api/tmdb/details/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;
  const { key, type = 'movie', lang = 'es-ES' } = req.query;
  try {
    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${key}&language=${lang}&append_to_response=credits`;
    const response = await fetch(url);
    res.json(await response.json());
  } catch (e) {
    console.error('TMDB details error:', e);
    res.status(500).json({ error: 'TMDB request failed' });
  }
});

// ============ FRIENDS ============
app.get('/api/friends', async (req, res) => {
  const { username } = req.query;
  try {
    const result = await pool.query(
      'SELECT friend_username, added_at FROM user_friends WHERE username = $1 ORDER BY added_at DESC',
      [username]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting friends:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/friends/add', async (req, res) => {
  const { username, friendUsername } = req.body;
  try {
    const userExists = await pool.query('SELECT username FROM users WHERE username = $1', [friendUsername]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await pool.query(
      'INSERT INTO user_friends (username, friend_username) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [username, friendUsername]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error adding friend:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/friends/:friendUsername', async (req, res) => {
  const { friendUsername } = req.params;
  const { username } = req.query;
  try {
    await pool.query('DELETE FROM user_friends WHERE username = $1 AND friend_username = $2', [username, friendUsername]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting friend:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ LISTS ============
app.get('/api/lists', async (req, res) => {
  const { username } = req.query;
  try {
    const result = await pool.query(`
      SELECT DISTINCT l.* FROM lists l
      LEFT JOIN list_collaborators lc ON l.id = lc.list_id
      WHERE l.owner = $1 OR lc.username = $1
      ORDER BY l.list_order ASC
    `, [username]);

    const lists = await Promise.all(result.rows.map(async (list) => {
      const items = await pool.query(
        'SELECT * FROM list_items WHERE list_id = $1 ORDER BY added_at DESC',
        [list.id]
      );
      return { ...list, items: items.rows, isOwner: list.owner === username };
    }));

    res.json(lists);
  } catch (err) {
    console.error('Error getting lists:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lists/:id', async (req, res) => {
  const { id } = req.params;
  const { username } = req.query;
  try {
    const listResult = await pool.query('SELECT * FROM lists WHERE id = $1', [id]);
    if (listResult.rows.length === 0) return res.status(404).json({ error: 'List not found' });

    const list = listResult.rows[0];
    const isOwner = list.owner === username;

    const itemsResult = await pool.query(
      'SELECT * FROM list_items WHERE list_id = $1 ORDER BY added_at DESC',
      [id]
    );

    const itemsWithExtras = await Promise.all(itemsResult.rows.map(async (item) => {
      const [ratings, tags, notes, votes, comments] = await Promise.all([
        pool.query('SELECT * FROM item_ratings WHERE item_id = $1 ORDER BY created_at DESC', [item.id]),
        pool.query('SELECT * FROM item_tags WHERE item_id = $1 AND username = $2', [item.id, username]),
        pool.query('SELECT * FROM item_notes WHERE item_id = $1 AND username = $2', [item.id, username]),
        pool.query('SELECT username, vote FROM list_votes WHERE item_id = $1', [item.id]),
        pool.query('SELECT * FROM list_comments WHERE item_id = $1 ORDER BY created_at DESC', [item.id])
      ]);

      const avgRating = ratings.rows.length > 0
        ? (ratings.rows.reduce((sum, r) => sum + r.stars, 0) / ratings.rows.length).toFixed(1)
        : null;

      const userVote = votes.rows.find(v => v.username === username)?.vote || 0;
      const totalVotes = votes.rows.reduce((sum, v) => sum + v.vote, 0);

      return {
        ...item,
        ratings: ratings.rows,
        avgRating,
        tags: tags.rows,
        note: notes.rows[0]?.note || null,
        userVote,
        totalVotes,
        comments: comments.rows
      };
    }));

    res.json({ ...list, items: itemsWithExtras, isOwner });
  } catch (err) {
    console.error('Error getting list details:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lists', async (req, res) => {
  const { username, list } = req.body;
  const id = uuidv4();
  console.log('📝 Creating list:', { username, list, id });
  try {
    let pin;
    let pinUnique = false;
    let attempts = 0;

    while (!pinUnique && attempts < 10) {
      pin = Math.floor(100000 + Math.random() * 900000).toString();
      const existing = await pool.query('SELECT id FROM lists WHERE pin = $1', [pin]);
      if (existing.rows.length === 0) pinUnique = true;
      attempts++;
    }

    const orderResult = await pool.query('SELECT COALESCE(MAX(list_order), -1) + 1 AS next_order FROM lists WHERE owner = $1', [username]);
    const nextOrder = orderResult.rows[0].next_order;

    await pool.query(
      'INSERT INTO lists (id, owner, name, type, list_order, pin, is_collaborative) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, username, list.name, list.type, nextOrder, pin, list.isCollaborative || false]
    );

    await pool.query(
      'INSERT INTO activity_feed (id, username, action_type, target_type, target_id, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
      [uuidv4(), username, 'create_list', 'list', id, JSON.stringify({ listName: list.name })]
    );

    console.log('✅ List created successfully:', { id, pin });
    res.json({ success: true, id, pin });
  } catch (err) {
    console.error('❌ Error creating list:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/lists/:id', async (req, res) => {
  const { id } = req.params;
  const { username } = req.query;
  try {
    await pool.query('DELETE FROM lists WHERE id = $1 AND owner = $2', [id, username]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting list:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lists/import-pin', async (req, res) => {
  const { username, pin } = req.body;
  try {
    const listResult = await pool.query('SELECT * FROM lists WHERE pin = $1', [pin]);
    if (listResult.rows.length === 0) {
      return res.status(404).json({ error: 'PIN no válido' });
    }

    const list = listResult.rows[0];

    await pool.query(
      'INSERT INTO list_collaborators (list_id, username) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [list.id, username]
    );

    res.json({ success: true, list });
  } catch (err) {
    console.error('Error importing list:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/lists/:id/reorder', async (req, res) => {
  const { id } = req.params;
  const { username, newOrder } = req.body;
  try {
    await pool.query('UPDATE lists SET list_order = $1 WHERE id = $2', [newOrder, id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error reordering list:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ LIST ITEMS ============
app.post('/api/lists/:id/items', async (req, res) => {
  const { id } = req.params;
  const { username, item } = req.body;
  const itemId = uuidv4();
  console.log('📝 Adding item to list:', { listId: id, itemId, username, item });
  try {
    await pool.query(
      'INSERT INTO list_items (id, list_id, tmdb_id, imdb_id, media_type, title, poster, overview, rating, added_by, release_date, runtime, genres, director, cast_members) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)',
      [itemId, id, item.tmdbId, item.imdbId, item.mediaType, item.title, item.poster, item.overview, item.rating, username, item.releaseDate, item.runtime, item.genres, item.director, item.cast]
    );

    await pool.query(
      'INSERT INTO activity_feed (id, username, action_type, target_type, target_id, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
      [uuidv4(), username, 'add_item', 'item', itemId, JSON.stringify({ title: item.title, listId: id })]
    );

    console.log('✅ Item added successfully');
    res.json({ success: true, itemId });
  } catch (err) {
    console.error('❌ Error adding item:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/lists/:listId/items/:itemId', async (req, res) => {
  const { listId, itemId } = req.params;
  const { username } = req.query;
  try {
    const listResult = await pool.query('SELECT owner FROM lists WHERE id = $1', [listId]);
    if (listResult.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    if (listResult.rows[0].owner !== username) {
      return res.status(403).json({ error: 'Only owner can delete items' });
    }

    await pool.query('DELETE FROM list_items WHERE id = $1 AND list_id = $2', [itemId, listId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ TAGS ============
app.post('/api/items/:itemId/tags', async (req, res) => {
  const { itemId } = req.params;
  const { username, tag } = req.body;
  const id = uuidv4();
  try {
    await pool.query(
      'INSERT INTO item_tags (id, item_id, username, tag) VALUES ($1, $2, $3, $4)',
      [id, itemId, username, tag.toLowerCase()]
    );
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23505') {
      res.json({ success: true });
    } else {
      console.error('Error adding tag:', err);
      res.status(500).json({ error: err.message });
    }
  }
});

app.delete('/api/items/:itemId/tags/:tag', async (req, res) => {
  const { itemId, tag } = req.params;
  const { username } = req.query;
  try {
    await pool.query('DELETE FROM item_tags WHERE item_id = $1 AND username = $2 AND tag = $3', [itemId, username, tag]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting tag:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ NOTES ============
app.post('/api/items/:itemId/note', async (req, res) => {
  const { itemId } = req.params;
  const { username, note } = req.body;
  const id = uuidv4();
  try {
    const existing = await pool.query('SELECT id FROM item_notes WHERE item_id = $1 AND username = $2', [itemId, username]);

    if (existing.rows.length > 0) {
      await pool.query('UPDATE item_notes SET note = $1, updated_at = NOW() WHERE item_id = $2 AND username = $3', [note, itemId, username]);
    } else {
      await pool.query('INSERT INTO item_notes (id, item_id, username, note) VALUES ($1, $2, $3, $4)', [id, itemId, username, note]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving note:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ RATINGS ============
app.post('/api/items/:itemId/rate', async (req, res) => {
  const { itemId } = req.params;
  const { username, stars, review } = req.body;
  const ratingId = uuidv4();
  try {
    const existing = await pool.query('SELECT id FROM item_ratings WHERE item_id = $1 AND username = $2', [itemId, username]);

    if (existing.rows.length > 0) {
      await pool.query('UPDATE item_ratings SET stars = $1, review = $2, created_at = NOW() WHERE item_id = $3 AND username = $4', [stars, review, itemId, username]);
    } else {
      await pool.query('INSERT INTO item_ratings (id, item_id, username, stars, review) VALUES ($1, $2, $3, $4, $5)', [ratingId, itemId, username, stars, review]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving rating:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/items/:itemId/ratings', async (req, res) => {
  const { itemId } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM item_ratings WHERE item_id = $1 ORDER BY created_at DESC',
      [itemId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting ratings:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ VOTES ============
app.post('/api/lists/:listId/items/:itemId/vote', async (req, res) => {
  const { listId, itemId } = req.params;
  const { username, vote } = req.body;
  const id = uuidv4();
  try {
    const existing = await pool.query('SELECT id FROM list_votes WHERE list_id = $1 AND item_id = $2 AND username = $3', [listId, itemId, username]);

    if (existing.rows.length > 0) {
      await pool.query('UPDATE list_votes SET vote = $1 WHERE list_id = $2 AND item_id = $3 AND username = $4', [vote, listId, itemId, username]);
    } else {
      await pool.query('INSERT INTO list_votes (id, list_id, item_id, username, vote) VALUES ($1, $2, $3, $4, $5)', [id, listId, itemId, username, vote]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving vote:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ COMMENTS ============
app.post('/api/items/:itemId/comments', async (req, res) => {
  const { itemId } = req.params;
  const { username, listId, comment } = req.body;
  const id = uuidv4();
  try {
    await pool.query(
      'INSERT INTO list_comments (id, list_id, item_id, username, comment) VALUES ($1, $2, $3, $4, $5)',
      [id, listId, itemId, username, comment]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ WATCHED ============
app.post('/api/items/:itemId/watched', async (req, res) => {
  const { itemId } = req.params;
  const { username } = req.body;
  const id = uuidv4();
  try {
    await pool.query(
      'INSERT INTO watched_items (id, username, item_id) VALUES ($1, $2, $3)',
      [id, username, itemId]
    );
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23505') {
      res.json({ success: true });
    } else {
      console.error('Error marking as watched:', err);
      res.status(500).json({ error: err.message });
    }
  }
});

app.get('/api/watched', async (req, res) => {
  const { username } = req.query;
  try {
    const result = await pool.query(`
      SELECT w.*, li.* FROM watched_items w
      JOIN list_items li ON w.item_id = li.id
      WHERE w.username = $1
      ORDER BY w.watched_at DESC
      LIMIT 50
    `, [username]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting watched items:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ ACTIVITY FEED ============
app.get('/api/feed', async (req, res) => {
  const { username } = req.query;
  try {
    const result = await pool.query(`
      SELECT af.* FROM activity_feed af
      WHERE af.username IN (
        SELECT friend_username FROM user_friends WHERE username = $1
        UNION
        SELECT $1
      )
      ORDER BY af.created_at DESC
      LIMIT 50
    `, [username]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting feed:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ START SERVER ============
const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📺 Stremio manifest available at: http://localhost:${PORT}/manifest.json?username=YOUR_USERNAME`);
});
