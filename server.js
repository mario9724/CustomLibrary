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
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        username VARCHAR(50) PRIMARY KEY,
        password VARCHAR(255) NOT NULL,
        display_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created');

    // Lists table with PIN
    await client.query(`
      CREATE TABLE IF NOT EXISTS lists (
        id UUID PRIMARY KEY,
        username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        message TEXT,
        pin VARCHAR(6) UNIQUE NOT NULL,
        position INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Lists table created');

    // List items table
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
        rating DECIMAL(3,1),
        added_by VARCHAR(50),
        release_date VARCHAR(50),
        runtime INTEGER,
        genres TEXT,
        director VARCHAR(200),
        cast_members TEXT,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ List items table created');

    // Friends table
    await client.query(`
      CREATE TABLE IF NOT EXISTS friends (
        id UUID PRIMARY KEY,
        username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
        friend_username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username, friend_username)
      )
    `);
    console.log('✅ Friends table created');

    // Ratings table (1-10 stars)
    await client.query(`
      CREATE TABLE IF NOT EXISTS ratings (
        id UUID PRIMARY KEY,
        username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
        tmdb_id VARCHAR(50) NOT NULL,
        imdb_id VARCHAR(50),
        media_type VARCHAR(20),
        title VARCHAR(500),
        poster VARCHAR(500),
        rating INTEGER CHECK (rating >= 1 AND rating <= 10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username, tmdb_id)
      )
    `);
    console.log('✅ Ratings table created');

    await client.query('COMMIT');
    console.log('✅ Database initialized successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error initializing database:', err);
  } finally {
    client.release();
  }
}

initDB();

// Generate 6-digit PIN
function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ========== AUTH ENDPOINTS ==========

app.post('/api/register', async (req, res) => {
  const { username, password, displayName } = req.body;
  try {
    await pool.query(
      'INSERT INTO users (username, password, display_name) VALUES ($1, $2, $3)',
      [username, password, displayName]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Register error:', err);
    res.status(400).json({ success: false, error: 'Username already exists' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND password = $2',
      [username, password]
    );
    if (result.rows.length > 0) {
      res.json({ success: true, displayName: result.rows[0].display_name });
    } else {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ========== LISTS ENDPOINTS ==========

app.get('/api/lists/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM lists WHERE username = $1 ORDER BY position ASC',
      [username]
    );
    res.json({ success: true, lists: result.rows });
  } catch (err) {
    console.error('❌ Get lists error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/lists', async (req, res) => {
  const { username, name, message } = req.body;
  const id = uuidv4();
  const pin = generatePin();
  
  try {
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM lists WHERE username = $1',
      [username]
    );
    const position = parseInt(countResult.rows[0].count);

    await pool.query(
      'INSERT INTO lists (id, username, name, message, pin, position) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, username, name, message, pin, position]
    );
    
    res.json({ success: true, id, pin });
  } catch (err) {
    console.error('❌ Create list error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.delete('/api/lists/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM lists WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Delete list error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.put('/api/lists/reorder', async (req, res) => {
  const { listIds } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    for (let i = 0; i < listIds.length; i++) {
      await client.query(
        'UPDATE lists SET position = $1 WHERE id = $2',
        [i, listIds[i]]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Reorder lists error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  } finally {
    client.release();
  }
});

// ========== LIST ITEMS ENDPOINTS ==========

app.get('/api/lists/:listId/items', async (req, res) => {
  const { listId } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM list_items WHERE list_id = $1 ORDER BY added_at DESC',
      [listId]
    );
    res.json({ success: true, items: result.rows });
  } catch (err) {
    console.error('❌ Get items error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/lists/:listId/items', async (req, res) => {
  const { listId } = req.params;
  const { username, item } = req.body;
  const itemId = uuidv4();
  
  try {
    await pool.query(
      'INSERT INTO list_items (id, list_id, tmdb_id, imdb_id, media_type, title, poster, overview, rating, added_by, release_date, runtime, genres, director, cast_members) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)',
      [itemId, listId, item.tmdbId, item.imdbId, item.mediaType, item.title, item.poster, item.overview, item.rating, username, item.releaseDate, item.runtime, item.genres, item.director, item.cast]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Add item error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.delete('/api/lists/:listId/items/:itemId', async (req, res) => {
  const { itemId } = req.params;
  try {
    await pool.query('DELETE FROM list_items WHERE id = $1', [itemId]);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Delete item error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ========== IMPORT LIST BY PIN ==========

app.post('/api/lists/import', async (req, res) => {
  const { username, pin } = req.body;
  
  try {
    const listResult = await pool.query(
      'SELECT * FROM lists WHERE pin = $1',
      [pin]
    );
    
    if (listResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'List not found' });
    }
    
    const sourceList = listResult.rows[0];
    const newId = uuidv4();
    const newPin = generatePin();
    
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM lists WHERE username = $1',
      [username]
    );
    const position = parseInt(countResult.rows[0].count);
    
    await pool.query(
      'INSERT INTO lists (id, username, name, message, pin, position) VALUES ($1, $2, $3, $4, $5, $6)',
      [newId, username, sourceList.name, sourceList.message, newPin, position]
    );
    
    const itemsResult = await pool.query(
      'SELECT * FROM list_items WHERE list_id = $1',
      [sourceList.id]
    );
    
    for (const item of itemsResult.rows) {
      const newItemId = uuidv4();
      await pool.query(
        'INSERT INTO list_items (id, list_id, tmdb_id, imdb_id, media_type, title, poster, overview, rating, added_by, release_date, runtime, genres, director, cast_members) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)',
        [newItemId, newId, item.tmdb_id, item.imdb_id, item.media_type, item.title, item.poster, item.overview, item.rating, username, item.release_date, item.runtime, item.genres, item.director, item.cast_members]
      );
    }
    
    res.json({ success: true, listId: newId });
  } catch (err) {
    console.error('❌ Import list error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ========== FRIENDS ENDPOINTS ==========

app.get('/api/friends/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const result = await pool.query(
      'SELECT friend_username FROM friends WHERE username = $1',
      [username]
    );
    res.json({ success: true, friends: result.rows.map(r => r.friend_username) });
  } catch (err) {
    console.error('❌ Get friends error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/friends', async (req, res) => {
  const { username, friendUsername } = req.body;
  const id = uuidv4();
  
  try {
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [friendUsername]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    await pool.query(
      'INSERT INTO friends (id, username, friend_username) VALUES ($1, $2, $3)',
      [id, username, friendUsername]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Add friend error:', err);
    res.status(500).json({ success: false, error: 'Friend already added' });
  }
});

app.get('/api/friends/:username/lists', async (req, res) => {
  const { username } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM lists WHERE username = $1 ORDER BY position ASC',
      [username]
    );
    res.json({ success: true, lists: result.rows });
  } catch (err) {
    console.error('❌ Get friend lists error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ========== RATINGS ENDPOINTS ==========

app.post('/api/ratings', async (req, res) => {
  const { username, tmdbId, imdbId, mediaType, title, poster, rating } = req.body;
  const id = uuidv4();
  
  try {
    await pool.query(
      'INSERT INTO ratings (id, username, tmdb_id, imdb_id, media_type, title, poster, rating) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (username, tmdb_id) DO UPDATE SET rating = $8, created_at = CURRENT_TIMESTAMP',
      [id, username, tmdbId, imdbId, mediaType, title, poster, rating]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Add rating error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.get('/api/ratings/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;
  try {
    const result = await pool.query(
      'SELECT username, rating, created_at FROM ratings WHERE tmdb_id = $1 ORDER BY created_at DESC',
      [tmdbId]
    );
    res.json({ success: true, ratings: result.rows });
  } catch (err) {
    console.error('❌ Get ratings error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.get('/api/ratings/user/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM ratings WHERE username = $1 ORDER BY created_at DESC',
      [username]
    );
    res.json({ success: true, ratings: result.rows });
  } catch (err) {
    console.error('❌ Get user ratings error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ========== STREMIO MANIFEST ==========

app.get('/manifest.json', (req, res) => {
  res.json({
    id: 'com.customlibrary',
    version: '2.0.0',
    name: 'CustomLibrary',
    description: 'Your personalized library with custom lists',
    resources: ['catalog', 'meta'],
    types: ['movie', 'series', 'other'],
    catalogs: [],
    idPrefixes: ['customlib']
  });
});

app.get('/:username/manifest.json', async (req, res) => {
  const { username } = req.params;
  
  try {
    const userResult = await pool.query(
      'SELECT display_name FROM users WHERE username = $1',
      [username]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const displayName = userResult.rows[0].display_name || username;
    const listsResult = await pool.query(
      'SELECT id, name FROM lists WHERE username = $1 ORDER BY position ASC',
      [username]
    );
    
    const catalogs = listsResult.rows.map(list => ({
      id: list.id,
      name: list.name,
      type: 'other'
    }));
    
    res.json({
      id: `com.customlibrary.${username}`,
      version: '2.0.0',
      name: `Librería de ${displayName}`,
      description: `Listas personalizadas de ${displayName}`,
      resources: ['catalog', 'meta'],
      types: ['movie', 'series', 'other'],
      catalogs: catalogs,
      idPrefixes: ['tt', 'tmdb']
    });
  } catch (err) {
    console.error('❌ Manifest error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/:username/catalog/other/:listId.json', async (req, res) => {
  const { listId } = req.params;
  
  try {
    const itemsResult = await pool.query(
      'SELECT * FROM list_items WHERE list_id = $1 ORDER BY added_at DESC',
      [listId]
    );
    
    const metas = itemsResult.rows.map(item => ({
      id: `customlib:${item.id}`,
      type: 'other',
      name: item.title,
      poster: item.poster,
      posterShape: 'poster',
      description: item.overview || ''
    }));
    
    res.json({ metas });
  } catch (err) {
    console.error('❌ Catalog error:', err);
    res.json({ metas: [] });
  }
});

app.get('/:username/meta/other/:itemId.json', async (req, res) => {
  const { itemId } = req.params;
  const cleanId = itemId.replace('customlib:', '');
  
  try {
    const result = await pool.query(
      'SELECT * FROM list_items WHERE id = $1',
      [cleanId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ meta: null });
    }
    
    const item = result.rows[0];
    const meta = {
      id: `customlib:${item.id}`,
      type: 'other',
      name: item.title,
      poster: item.poster,
      posterShape: 'poster',
      background: item.poster,
      description: item.overview || '',
      releaseInfo: item.release_date || '',
      imdbRating: item.rating ? item.rating.toString() : undefined,
      director: item.director ? [item.director] : [],
      cast: item.cast_members ? item.cast_members.split(', ') : [],
      runtime: item.runtime ? `${item.runtime} min` : undefined
    };
    
    res.json({ meta });
  } catch (err) {
    console.error('❌ Meta error:', err);
    res.status(404).json({ meta: null });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Custom Library running on port ${port}`));
