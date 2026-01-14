const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let db;

(async () => {
  const adapter = new JSONFile('db.json');
  db = new Low(adapter, { users: {} });
  await db.read();
  db.data = db.data || { users: {} };
  await db.write();

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
    const user = db.data.users[username];
    const lists = user ? Object.values(user.lists || {}) : [];
    res.json(lists.sort((a, b) => (a.order || 0) - (b.order || 0)));
  });

  app.post('/api/lists', async (req, res) => {
    const { username, list } = req.body;
    if (!db.data.users[username]) db.data.users[username] = { lists: {} };
    const id = uuidv4();
    const lists = db.data.users[username].lists;
    db.data.users[username].lists[id] = {
      id, ...list,
      order: Object.keys(lists).length,
      items: [],
      public: false
    };
    await db.write();
    res.json({ id });
  });

  app.put('/api/lists/:id', async (req, res) => {
    const { id } = req.params;
    const { username, list } = req.body;
    if (db.data.users[username]?.lists[id]) {
      Object.assign(db.data.users[username].lists[id], list);
      await db.write();
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'List not found' });
    }
  });

  app.delete('/api/lists/:id', async (req, res) => {
    const { id } = req.params;
    const { username } = req.query;
    if (db.data.users[username]?.lists[id]) {
      delete db.data.users[username].lists[id];
      await db.write();
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'List not found' });
    }
  });

  app.post('/api/lists/:id/items', async (req, res) => {
    const { id } = req.params;
    const { username, item } = req.body;
    if (db.data.users[username]?.lists[id]) {
      db.data.users[username].lists[id].items.push({
        id: uuidv4(), ...item,
        addedBy: username,
        addedAt: Date.now()
      });
      await db.write();
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'List not found' });
    }
  });

  app.put('/api/lists/:id/reorder', async (req, res) => {
    const { id } = req.params;
    const { username, newOrder } = req.body;
    if (db.data.users[username]?.lists[id]) {
      db.data.users[username].lists[id].order = newOrder;
      await db.write();
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'List not found' });
    }
  });

  // ✅ IMPORTAR LISTAS
  app.post('/api/lists/import', async (req, res) => {
    const { username, lists } = req.body;
    if (!db.data.users[username]) db.data.users[username] = { lists: {} };
    
    lists.forEach((list, idx) => {
      const id = uuidv4();
      db.data.users[username].lists[id] = {
        ...list,
        id,
        order: Object.keys(db.data.users[username].lists).length + idx
      };
    });
    
    await db.write();
    res.json({ success: true });
  });

  app.get('/manifest.json', (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'username required' });
    
    const userLists = db.data.users[username]?.lists || {};
    const types = [...new Set(Object.values(userLists).map(l => l.type))];

    const catalogs = Object.values(userLists)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(l => ({ id: l.id, type: l.type, name: l.name }));

    res.json({
      id: `com.customlibrary.${username}`,
      version: '1.0.0',
      name: `CustomLibrary - ${username}`,
      description: 'Personal curated library',
      resources: ['catalog'],
      types: types.length > 0 ? types : ['movie', 'series'],
      idPrefixes: ['tt', 'tmdb'],
      catalogs,
      logo: `${req.protocol}://${req.get('host')}/icon.svg`
    });
  });

  // ✅ CATÁLOGO CON POSTERS DE TMDB + METADATA DE STREMIO
  app.get('/catalog/:type/:id.json', (req, res) => {
    const { type, id } = req.params;
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'username required' });

    const userLists = db.data.users[username]?.lists || {};
    const list = userLists[id];
    if (!list || list.type !== type) return res.json({ metas: [] });

    const metas = (list.items || []).slice(0, 100).map(item => ({
      id: item.imdbId || `tmdb:${item.tmdbId}`,
      type: item.mediaType || type,
      name: item.title || 'Untitled',
      poster: item.poster ? `https://image.tmdb.org/t/p/w500${item.poster}` : undefined
    }));

    res.json({ metas });
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`✅ Custom Library running on port ${port}`));
})();
