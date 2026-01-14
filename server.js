const express = require('express');
const { addonBuilder } = require('stremio-addon-sdk');
const { JSONFile } = require('lowdb/node');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const db = new JSONFile('db.json');
await db.read();
db.data ||= { users: {} }; // {username: {lists: [{id, name, type, order, items: [{imdbId, tmdbId}]}]} }
await db.write();

// Proxy TMDB
app.get('/api/tmdb/search', async (req, res) => {
  const { q, key, lang = 'es-ES' } = req.query;
  const url = `https://api.themoviedb.org/3/search/multi?api_key=${key}&query=${q}&language=${lang}`;
  try {
    const response = await fetch(url);
    res.json(await response.json());
  } catch (e) { res.status(500).json({error: 'TMDB fail'}); }
});

// API Listas (CRUD)
app.get('/api/lists', async (req, res) => {
  const { username, imported } = req.query;
  const user = db.data.users[username];
  let lists = user ? Object.values(user.lists || {}) : [];
  if (imported) lists = lists.filter(l => l.imported);
  res.json(lists);
});
app.post('/api/lists', async (req, res) => {
  const { username, list } = req.body;
  if (!db.data.users[username]) db.data.users[username] = { lists: {} };
  const id = uuidv4();
  db.data.users[username].lists[id] = { id, ...list, order: Object.keys(db.data.users[username].lists).length, items: [], public: false };
  await db.write();
  res.json({ id });
});
// + PUT /lists/:id, DELETE, POST /lists/:id/items

// Manifest Dinámico
app.get('/manifest.json', (req, res) => {
  const { username } = req.query;
  const userLists = db.data.users[username]?.lists || {};
  const catalogs = Object.values(userLists).map(l => ({
    id: `${username}_${l.name.toLowerCase().replace(/\s+/g, '_')}`,
    type: l.type,
    name: l.name
  }));
  res.json({
    id: `com.customlibrary.${username}`,
    version: '1.0.0',
    name: `Custom Library - ${username}`,
    description: 'Biblioteca personalizada multilingüe',
    resources: ['catalog', 'meta'],
    types: ['movie', 'series'], // + custom
    idPrefixes: [`tt`, `custom:${username}`],
    catalogs
  });
});

// Addon Handlers Básicos
const builder = new addonBuilder(/* from /manifest.json */);
builder.defineCatalogHandler(async (args) => {
  const [_, username, listName] = args.extra.id.split('_');
  const list = Object.values(db.data.users[username].lists).find(l => l.name.toLowerCase().replace(/\s+/g, '_') === listName);
  if (!list) return { metas: [] };
  // Genera metas de items con TMDB/Cinemeta + recs
  return { metas: /* fetch items metas */ };
});
// + metaHandler

app.get('/manifest.json', (req, res) => res.json(builder.getManifest()));
app.get('/addon.json', (req, res) => res.json(builder.getInterface()));

app.listen(process.env.PORT || 3000, () => console.log('Custom Library on Render'));
