const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const express = require('express');
const { JSONFile } = require('lowdb/node');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const app = express();
app.use(express.json());

const DATA_PATH = path.join(__dirname, 'data/users.json');
const defaultData = { users: {} };
let db;

async function initDB() {
  try {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    db = new JSONFile(DATA_PATH);
    await db.read();
    db.data ??= defaultData;
    await db.write();
  } catch (e) {
    db = new JSONFile(DATA_PATH, { defaultData });
    await db.read();
  }
}

await initDB();

async function getUserData(userId) {
  const uid = userId || 'default';
  if (!db.data.users[uid]) {
    db.data.users[uid] = {
      customLabels: {},
      taggedItems: {}
    };
    await db.write();
  }
  return db.data.users[uid];
}

async function fetchMeta(id, type) {
  try {
    const res = await fetch(`https://www.cinemeta.dev/v4/metas/${type}/${id}.json`);
    if (res.ok) {
      const data = await res.json();
      return data.meta || null;
    }
  } catch (e) {}
  return null;
}

const manifest = {
  id: 'com.example.customlibrary',
  version: '1.0.0',
  name: 'Custom Library',
  description: 'Biblioteca personalizada',
  resources: ['catalog', 'stream', 'meta'],
  types: ['movie', 'series'],
  idPrefixes: ['tt', 'tm'],
  catalogs: [
    { type: 'movie', id: 'custom_1', name: 'Lista 1' },
    { type: 'movie', id: 'custom_2', name: 'Lista 2' },
    { type: 'movie', id: 'custom_3', name: 'Lista 3' },
    { type: 'movie', id: 'custom_4', name: 'Lista 4' },
    { type: 'movie', id: 'custom_5', name: 'Lista 5' },
    { type: 'series', id: 'custom_1', name: 'Lista 1' },
    { type: 'series', id: 'custom_2', name: 'Lista 2' },
    { type: 'series', id: 'custom_3', name: 'Lista 3' },
    { type: 'series', id: 'custom_4', name: 'Lista 4' },
    { type: 'series', id: 'custom_5', name: 'Lista 5' }
  ]
};

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async (args) => {
  const configId = new URLSearchParams(args.extra.uri || '').get('configId') || args.userId;
  const parts = (args.id || '').split(':');
  if (parts.length === 3 && ['add', 'remove'].includes(parts[1])) {
    const [, action, labelId] = parts;
    const contentId = args.extra.id || parts[0];
    const userData = await getUserData(configId);
    
    if (!userData.taggedItems[labelId]) userData.taggedItems[labelId] = [];
    
    if (action === 'add') {
      if (!userData.taggedItems[labelId].includes(contentId)) {
        userData.taggedItems[labelId].push(contentId);
      }
    } else {
      userData.taggedItems[labelId] = userData.taggedItems[labelId].filter(id => id !== contentId);
    }
    
    await db.write();
    return { streams: [] };
  }
  
  const contentId = args.id;
  const streams = [];
  const userData = await getUserData(configId);
  
  for (let i = 1; i <= 5; i++) {
    const labelId = `custom_${i}`;
    if (userData.customLabels[labelId]) {
      streams.push({
        name: '+',
        title: `+ ${userData.customLabels[labelId]}`,
        url: 'webfake://',
        behaviorHints: { bingeGroup: 'custom' }
      });
      streams.push({
        name: '-',
        title: `- ${userData.customLabels[labelId]}`,
        url: 'webfake://',
        behaviorHints: { bingeGroup: 'custom' }
      });
    }
  }
  
  return { streams };
});

builder.defineCatalogHandler(async (args) => {
  const configId = new URLSearchParams(args.extra.uri || '').get('configId') || args.userId;
  if (args.id.startsWith('custom_')) {
    const userData = await getUserData(configId);
    const itemIds = userData.taggedItems[args.id] || [];
    const skip = parseInt(args.extra.skip) || 0;
    const take = 20;
    
    const metas = [];
    for (const id of itemIds.slice(skip, skip + take)) {
      let meta = await fetchMeta(id, args.type);
      if (meta) metas.push(meta);
    }
    
    return {
      metas,
      meta: {
        title: userData.customLabels[args.id] || `${args.id} (${metas.length})`
      }
    };
  }
  return { metas: [] };
});

builder.defineMetaHandler(async (args) => {
  const meta = await fetchMeta(args.id, args.type);
  return { meta };
});

app.get('/config', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Crear Custom Library</title>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial; max-width: 500px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
    .card { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    input { padding: 12px; margin: 8px 0; width: 100%; box-sizing: border-box; border: 1px solid #ddd; border-radius: 5px; }
    button { padding: 12px 24px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; width: 100%; font-size: 16px; }
    button:hover { background: #0056b3; }
    .url-box { background: #e8f4fd; padding: 15px; border-radius: 5px; word-break: break-all; margin: 20px 0; }
    .list-item { margin: 15px 0; }
    h1 { color: #333; text-align: center; }
    .success { background: #d4edda; color: #155724; padding: 15px; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🎯 Custom Library</h1>
    <p>Crea tus listas personalizadas</p>
    
    <div class="list-item">
      <input id="name1" placeholder="Lista 1 (ej: Favoritos)">
    </div>
    <div class="list-item">
      <input id="name2" placeholder="Lista 2 (ej: Pendientes)">
    </div>
    <div class="list-item">
      <input id="name3" placeholder="Lista 3 (ej: Terror)">
    </div>
    <div class="list-item">
      <input id="name4" placeholder="Lista 4 (ej: Anime)">
    </div>
    <div class="list-item">
      <input id="name5" placeholder="Lista 5 (ej: Comedia)">
    </div>
    
    <button onclick="generate()">🚀 Generar URL Stremio</button>
    
    <div id="result"></div>
  </div>

  <script>
    async function generate() {
      const names = [
        document.getElementById('name1').value,
        document.getElementById('name2').value,
        document.getElementById('name3').value,
        document.getElementById('name4').value,
        document.getElementById('name5').value
      ].filter(n => n.trim());
      
      if (names.length === 0) return alert('Escribe al menos un nombre');
      
      const res = await fetch('/create-config', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ names })
      });
      
      const data = await res.json();
      if (data.url) {
        document.getElementById('result').innerHTML = `
          <div class="success">
            <strong>✅ URL lista para Stremio:</strong><br>
            <div class="url-box">${data.url}</div>
            <button onclick="copyUrl('${data.url}')">📋 Copiar</button>
            <p><small>Stremio → Addons → URL → Pega → Instalar</small></p>
          </div>
        `;
      }
    }
    
    function copyUrl(url) {
      navigator.clipboard.writeText(url);
      alert('Copiada');
    }
  </script>
</body>
</html>
  `);
});

app.post('/create-config', express.json(), async (req, res) => {
  const { names } = req.body;
  const configId = crypto.randomUUID();
  
  const userData = {
    customLabels: {},
    taggedItems: {}
  };
  
  names.forEach((name, i) => {
    const labelId = `custom_${i+1}`;
    userData.customLabels[labelId] = name;
  });
  
  db.data.users[configId] = userData;
  await db.write();
  
  res.json({
    url: `${req.protocol}://${req.get('host')}/manifest.json?configId=${configId}`
  });
});

serveHTTP(builder.getInterface(), { port: process.env.PORT || 3000 });
