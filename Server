const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const express = require('express');
const { JSONFile } = require('lowdb/node');
const path = require('path');
const fs = require('fs').promises;

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
  const parts = (args.id || '').split(':');
  if (parts.length === 3 && ['add', 'remove'].includes(parts[1])) {
    const [, action, labelId] = parts;
    const contentId = args.extra.id || parts[0];
    const userData = await getUserData(args.userId);
    
    if (!userData.taggedItems[labelId]) userData.taggedItems[labelId] = [];
    
    if (action === 'add') {
      if (!userData.taggedItems[labelId].includes(contentId)) {
        userData.taggedItems[labelId].push(contentId);
      }
    } else {
      userData.taggedItems[labelId] = userData.taggedItems[labelId].filter(id => id !== contentId);
    }
    
    if (args.extra.labelName) {
      userData.customLabels[labelId] = args.extra.labelName;
    }
    
    await db.write();
    return { streams: [] };
  }
  
  const contentId = args.id;
  const streams = [];
  const userData = await getUserData(args.userId);
  
  for (let i = 1; i <= 5; i++) {
    const labelId = `custom_${i}`;
    streams.push({
      name: '+',
      title: `+ ${userData.customLabels[labelId] || labelId}`,
      url: 'webfake://',
      behaviorHints: { bingeGroup: 'custom' }
    });
    streams.push({
      name: '-',
      title: `- ${userData.customLabels[labelId] || labelId}`,
      url: 'webfake://',
      behaviorHints: { bingeGroup: 'custom' }
    });
  }
  
  return { streams };
});

builder.defineCatalogHandler(async (args) => {
  if (args.id.startsWith('custom_')) {
    const userData = await getUserData(args.userId);
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

serveHTTP(builder.getInterface(), { port: process.env.PORT || 3000 });
