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
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        username VARCHAR(255) PRIMARY KEY,
        pin VARCHAR(4) NOT NULL,
        addon_name VARCHAR(255) DEFAULT 'CustomLibrary',
        tmdb_key VARCHAR(255),
        language VARCHAR(10) DEFAULT 'en',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_friends (
        username VARCHAR(255) REFERENCES users(username) ON DELETE CASCADE,
        friend_username VARCHAR(255),
        added_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (username, friend_username)
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lists (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        list_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    try {
      await pool.query(`ALTER TABLE lists ADD COLUMN IF NOT EXISTS owner VARCHAR(255);`);
      const hasUsername = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='lists' AND column_name='username'
      `);
      if (hasUsername.rows.length > 0) {
        await pool.query(`UPDATE lists SET owner = username WHERE owner IS NULL;`);
        await pool.query(`ALTER TABLE lists DROP COLUMN IF EXISTS username;`);
      }
    } catch (err) {}
    
    await pool.query(`ALTER TABLE lists ADD COLUMN IF NOT EXISTS pin VARCHAR(6);`);
    
    const listsWithoutPin = await pool.query(`SELECT id FROM lists WHERE pin IS NULL`);
    for (const list of listsWithoutPin.rows) {
      let pinGenerated = false;
      let attempts = 0;
      while (!pinGenerated && attempts < 10) {
        try {
          const newPin = Math.floor(100000 + Math.random() * 900000).toString();
          await pool.query(`UPDATE lists SET pin = $1 WHERE id = $2`, [newPin, list.id]);
          pinGenerated = true;
        } catch (err) {
          attempts++;
        }
      }
    }
    
    try {
      await pool.query(`ALTER TABLE lists ADD CONSTRAINT lists_pin_key UNIQUE (pin);`);
    } catch (err) {}
    
    try {
      await pool.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'lists_owner_fkey'
          ) THEN
            ALTER TABLE lists ADD CONSTRAINT lists_owner_fkey 
            FOREIGN KEY (owner) REFERENCES users(username) ON DELETE CASCADE;
          END IF;
        END $$;
      `);
    } catch (err) {}
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS list_collaborators (
        list_id UUID REFERENCES lists(id) ON DELETE CASCADE,
        username VARCHAR(255),
        added_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (list_id, username)
      );
    `);
    
    await pool.query(`
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
        added_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS item_ratings (
        id UUID PRIMARY KEY,
        item_id UUID REFERENCES list_items(id) ON DELETE CASCADE,
        username VARCHAR(255),
        stars INTEGER CHECK (stars >= 1 AND stars <= 5),
        review TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(item_id, username)
      );
    `);
    
    console.log('✅ Database initialized and migrated successfully');
  } catch (err) {
    console.error('❌ Database init error:', err);
  }
}

initDB();

function generatePIN() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateUserPIN() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

app.post('/api/auth/check-user', async (req, res) => {
  const { username } = req.body;
  try {
    const result = await pool.query('SELECT username, addon_name, language FROM users WHERE username = $1', [username]);
    if (result.rows.length > 0) {
      res.json({ exists: true, user: result.rows[0] });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, pin } = req.body;
  try {
    const result = await pool.query('SELECT username, addon_name, tmdb_key, language FROM users WHERE username = $1 AND pin = $2', [username, pin]);
    if (result.rows.length > 0) {
      res.json({ success: true, user: result.rows[0] });
    } else {
      res.json({ success: false, error: 'PIN incorrecto' });
    }
  } catch (err) {
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
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tmdb/search', async (req, res) => {
  const { q, key, lang = 'es-ES' } = req.query;
  try {
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${key}&query=${encodeURIComponent(q)}&language=${lang}`;
    const response = await fetch(url);
    res.json(await response.json());
  } catch (e) {
    res.status(500).json({ error: 'TMDB request failed' });
  }
});

app.get('/api/friends', async (req, res) => {
  const { username } = req.query;
  try {
    const result = await pool.query(
      'SELECT friend_username, added_at FROM user_friends WHERE username = $1 ORDER BY added_at DESC',
      [username]
    );
    res.json(result.rows);
  } catch (err) {
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
    res.status(500).json({ error: err.message });
  }
});

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
    console.error('Error loading lists:', err);
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
    
    const itemsWithRatings = await Promise.all(itemsResult.rows.map(async (item) => {
      const ratingsResult = await pool.query(
        'SELECT * FROM item_ratings WHERE item_id = $1 ORDER BY created_at DESC',
        [item.id]
      );
      
      const ratings = ratingsResult.rows;
      const avgRating = ratings.length > 0 
        ? (ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length).toFixed(1)
        : null;
      
      return { ...item, ratings, avgRating };
    }));
    
    res.json({ ...list, items: itemsWithRatings, isOwner });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lists', async (req, res) => {
  const { username, list } = req.body;
  const id = uuidv4();
  
  try {
    let pin = generatePIN();
    let pinUnique = false;
    let attempts = 0;
    
    while (!pinUnique && attempts < 10) {
      const existing = await pool.query('SELECT id FROM lists WHERE pin = $1', [pin]);
      if (existing.rows.length === 0) {
        pinUnique = true;
      } else {
        pin = generatePIN();
        attempts++;
      }
    }
    
    const orderResult = await pool.query('SELECT COALESCE(MAX(list_order), -1) + 1 AS next_order FROM lists WHERE owner = $1', [username]);
    const nextOrder = orderResult.rows[0].next_order;
    
    await pool.query(
      'INSERT INTO lists (id, owner, name, type, list_order, pin) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, username, list.name, list.type, nextOrder, pin]
    );
    
    res.json({ id, pin });
  } catch (err) {
    console.error('Error creating list:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/lists/:id', async (req, res) => {
  const { id } = req.params;
  const { username, list } = req.body;
  
  try {
    const listResult = await pool.query('SELECT owner FROM lists WHERE id = $1', [id]);
    if (listResult.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }
    
    if (listResult.rows[0].owner !== username) {
      return res.status(403).json({ error: 'Only owner can edit list' });
    }
    
    await pool.query(
      'UPDATE lists SET name = $1, type = $2 WHERE id = $3',
      [list.name, list.type, id]
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lists/:id/reset-pin', async (req, res) => {
  const { id } = req.params;
  const { username } = req.body;
  
  try {
    const listResult = await pool.query('SELECT owner FROM lists WHERE id = $1', [id]);
    if (listResult.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }
    
    if (listResult.rows[0].owner !== username) {
      return res.status(403).json({ error: 'Only owner can reset PIN' });
    }
    
    let pin = generatePIN();
    let pinUnique = false;
    let attempts = 0;
    
    while (!pinUnique && attempts < 10) {
      const existing = await pool.query('SELECT id FROM lists WHERE pin = $1 AND id != $2', [pin, id]);
      if (existing.rows.length === 0) {
        pinUnique = true;
      } else {
        pin = generatePIN();
        attempts++;
      }
    }
    
    await pool.query('UPDATE lists SET pin = $1 WHERE id = $2', [pin, id]);
    res.json({ pin });
  } catch (err) {
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
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lists/:id/items', async (req, res) => {
  const { id } = req.params;
  const { username, item } = req.body;
  const itemId = uuidv4();
  
  try {
    await pool.query(
      'INSERT INTO list_items (id, list_id, tmdb_id, imdb_id, media_type, title, poster, overview, rating, added_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [itemId, id, item.tmdbId, item.imdbId, item.mediaType, item.title, item.poster, item.overview, item.rating, username]
    );
    res.json({ success: true });
  } catch (err) {
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
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/items/:itemId/rate', async (req, res) => {
  const { itemId } = req.params;
  const { username, stars, review } = req.body;
  const ratingId = uuidv4();
  
  try {
    await pool.query(
      'INSERT INTO item_ratings (id, item_id, username, stars, review) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (item_id, username) DO UPDATE SET stars = $4, review = $5, created_at = NOW()',
      [ratingId, itemId, username, stars, review]
    );
    res.json({ success: true });
  } catch (err) {
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
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/lists/:id/reorder', async (req, res) => {
  const { id } = req.params;
  const { username, newOrder } = req.body;
  
  try {
    await pool.query(
      'UPDATE lists SET list_order = $1 WHERE id = $2',
      [newOrder, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/manifest.json', async (req, res) => {
  const { username, addonName } = req.query;
  if (!username) return res.status(400).json({ error: 'username required' });
  
  try {
    const result = await pool.query(`
      SELECT DISTINCT l.* FROM lists l
      LEFT JOIN list_collaborators lc ON l.id = lc.list_id
      WHERE l.owner = $1 OR lc.username = $1
      ORDER BY l.list_order ASC
    `, [username]);
    
    const types = [...new Set(result.rows.map(l => l.type))];
    const catalogs = result.rows.map(l => ({ id: l.id, type: l.type, name: l.name }));
    
    res.json({
      id: `com.customlibrary.${username}`,
      version: '1.0.0',
      name: addonName || `CustomLibrary - ${username}`,
      description: 'Personal curated library',
      resources: ['catalog'],
      types: types.length > 0 ? types : ['movie', 'series'],
      idPrefixes: ['tt', 'tmdb'],
      catalogs,
      logo: `${req.protocol}://${req.get('host')}/icon.svg`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/catalog/:type/:id.json', async (req, res) => {
  const { type, id } = req.params;
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'username required' });
  
  try {
    const listResult = await pool.query('SELECT * FROM lists WHERE id = $1', [id]);
    if (listResult.rows.length === 0 || listResult.rows[0].type !== type) {
      return res.json({ metas: [] });
    }
    
    const itemsResult = await pool.query(
      'SELECT * FROM list_items WHERE list_id = $1 ORDER BY added_at DESC LIMIT 100',
      [id]
    );
    
    const metas = itemsResult.rows.map(item => ({
      id: item.imdb_id || `tmdb:${item.tmdb_id}`,
      type: item.media_type || type,
      name: item.title || 'Untitled',
      poster: item.poster ? `https://image.tmdb.org/t/p/w500${item.poster}` : undefined
    }));
    
    res.json({ metas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Custom Library running on port ${port}`));
