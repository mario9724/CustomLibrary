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
        addon_name VARCHAR(255) DEFAULT 'CustomLibrary',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lists (
        id UUID PRIMARY KEY,
        owner VARCHAR(255) REFERENCES users(username) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        list_order INTEGER DEFAULT 0,
        pin VARCHAR(6) UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS list_collaborators (
        list_id UUID REFERENCES lists(id) ON DELETE CASCADE,
        username VARCHAR(255) REFERENCES users(username) ON DELETE CASCADE,
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
    
    console.log('✅ Database initialized');
  } catch (err) {
    console.error('❌ Database init error:', err);
  }
}

initDB();

function generatePIN() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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
      return { ...list, items: items.rows };
    }));
    
    res.json(lists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lists/:id', async (req, res) => {
  const { id } = req.params;
  const { username } = req.query;
  
  try {
    const listResult = await pool.query('SELECT * FROM lists WHERE id = $1', [id]);
    if (listResult.rows.length === 0) return res.status(404).json({ error: 'List not found' });
    
    const itemsResult = await pool.query(
      'SELECT * FROM list_items WHERE list_id = $1 ORDER BY added_at DESC',
      [id]
    );
    
    res.json({ ...listResult.rows[0], items: itemsResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lists', async (req, res) => {
  const { username, list } = req.body;
  const id = uuidv4();
  const pin = generatePIN();
  
  try {
    await pool.query('INSERT INTO users (username) VALUES ($1) ON CONFLICT DO NOTHING', [username]);
    
    const orderResult = await pool.query('SELECT COALESCE(MAX(list_order), -1) + 1 AS next_order FROM lists WHERE owner = $1', [username]);
    const nextOrder = orderResult.rows[0].next_order;
    
    await pool.query(
      'INSERT INTO lists (id, owner, name, type, list_order, pin) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, username, list.name, list.type, nextOrder, pin]
    );
    
    res.json({ id, pin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lists/import-pin', async (req, res) => {
  const { username, pin } = req.body;
  
  try {
    await pool.query('INSERT INTO users (username) VALUES ($1) ON CONFLICT DO NOTHING', [username]);
    
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
  
  try {
    await pool.query('DELETE FROM list_items WHERE id = $1 AND list_id = $2', [itemId, listId]);
    res.json({ success: true });
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
