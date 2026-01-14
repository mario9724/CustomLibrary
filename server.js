const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const { JSONFile } = require("lowdb/node");
const { addonBuilder } = require("stremio-addon-sdk");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

let db;

(async () => {
  db = new JSONFile("db.json");
  await db.read();
  db.data ||= { users: {} };
  await db.write();

  // Proxy TMDB
  app.get("/api/tmdb/search", async (req, res) => {
    const { q, key, lang = "es-ES" } = req.query;
    try {
      const response = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${key}&query=${q}&language=${lang}`);
      res.json(await response.json());
    } catch (e) {
      res.status(500).json({ error: "TMDB fail" });
    }
  });

  // API Lists
  app.get("/api/lists", async (req, res) => {
    const { username } = req.query;
    const user = db.data.users[username];
    const lists = user ? Object.values(user.lists || {}) : [];
    res.json(lists.sort((a,b) => a.order - b.order));
  });

  app.post("/api/lists", async (req, res) => {
    const { username, list } = req.body;
    if (!db.data.users[username]) db.data.users[username] = { lists: {} };
    const id = uuidv4();
    const lists = db.data.users[username].lists;
    db.data.users[username].lists[id] = { id, ...list, order: Object.keys(lists).length, items: [], public: false };
    await db.write();
    res.json({ id });
  });

  app.put("/api/lists/:id", async (req, res) => {
    const { id } = req.params;
    const { username, list } = req.body;
    if (db.data.users[username]?.lists[id]) {
      db.data.users[username].lists[id] = { ...db.data.users[username].lists[id], ...list };
      await db.write();
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "List not found" });
    }
  });

  app.delete("/api/lists/:id", async (req, res) => {
    const { id } = req.params;
    const { username } = req.query;
    if (db.data.users[username]?.lists[id]) {
      delete db.data.users[username].lists[id];
      await db.write();
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "List not found" });
    }
  });

  // Manifest Dinámico
  app.get("/manifest.json", (req, res) => {
    const { username } = req.query;
    const userLists = db.data.users[username]?.lists || {};
    const catalogs = Object.values(userLists).sort((a,b) => a.order - b.order).map(l => ({
      id: `${username}_${l.name.toLowerCase().replace(/\s+/g, "_")}`,
      type: l.type,
      name: l.name
    }));
    res.json({
      id: `com.customlibrary.${username}`,
      version: "1.0.0",
      name: `Custom Library - ${username}`,
      description: "Biblioteca personalizada multilingüe",
      resources: ["catalog", "meta"],
      types: ["movie", "series"],
      idPrefixes: ["tt"],
      catalogs
    });
  });

  // Addon Builder
  const builder = new addonBuilder({
    id: "com.customlibrary",
    version: "1.0.0",
    name: "Custom Library",
    description: "Personal library addon"
  });

  builder.defineCatalogHandler((args) => {
    const [_, username, listName] = args.extra.id.split("_");
    const list = Object.values(db.data.users[username]?.lists || {}).find(l => 
      l.name.toLowerCase().replace(/\s+/g, "_") === listName
    );
    if (!list) return { metas: [] };
    // Mock metas from items (expande con TMDB/Cinemeta)
    return {
      metas: list.items.slice(0, 20).map(item => ({
        id: item.imdbId,
        type: list.type,
        name: item.title || "Item",
        poster: item.poster
      }))
    };
  });

  builder.defineMetaHandler((args) => {
    if (args.type !== "meta") return Promise.resolve({ metas: [] });
    // Fetch from Cinemeta + recs
    return Promise.resolve({ metas: [{ id: args.id, name: "Meta", type: args.type }] });
  });

  app.get("/addon.json", (req, res) => res.json(builder.getInterface()));

  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Custom Library on port ${port}`));
})();
