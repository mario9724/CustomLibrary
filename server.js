const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const { Low } = require("lowdb");
const { JSONFile } = require("lowdb/node");
const { addonBuilder } = require("stremio-addon-sdk");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

let db;

(async () => {
  const adapter = new JSONFile("db.json");
  db = new Low(adapter, { users: {} });
  await db.read();
  db.data = db.data || { users: {} };
  await db.write();

  // Proxy TMDB
  app.get("/api/tmdb/search", async (req, res) => {
    const { q, key, lang = "es-ES" } = req.query;
    try {
      const response = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${key}&query=${encodeURIComponent(q)}&language=${lang}`);
      res.json(await response.json());
    } catch (e) {
      res.status(500).json({ error: "TMDB fail" });
    }
  });

  // GET Lists
  app.get("/api/lists", async (req, res) => {
    const { username } = req.query;
    const user = db.data.users[username];
    const lists = user ? Object.values(user.lists || {}) : [];
    res.json(lists.sort((a, b) => (a.order || 0) - (b.order || 0)));
  });

  // POST New List
  app.post("/api/lists", async (req, res) => {
    const { username, list } = req.body;
    if (!db.data.users[username]) db.data.users[username] = { lists: {} };
    const id = uuidv4();
    const lists = db.data.users[username].lists;
    db.data.users[username].lists[id] = {
      id,
      ...list,
      order: Object.keys(lists).length,
      items: [],
      public: false
    };
    await db.write();
    res.json({ id });
  });

  // PUT Edit List
  app.put("/api/lists/:id", async (req, res) => {
    const { id } = req.params;
    const { username, list } = req.body;
    if (db.data.users[username]?.lists[id]) {
      db.data.users[username].lists[id] = {
        ...db.data.users[username].lists[id],
        ...list
      };
      await db.write();
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "List not found" });
    }
  });

  // DELETE List
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
    if (!username) return res.status(400).json({ error: "username required" });
    const userLists = db.data.users[username]?.lists || {};
    const catalogs = Object.values(userLists)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(l => ({
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

  // Addon Builder Basic
  const builder = new addonBuilder({
    id: "com.customlibrary",
    version: "1.0.0",
    name: "Custom Library",
    description: "Personal library addon",
    resources: ["catalog"],
    types: ["movie", "series"],
    catalogs: []
  });

  builder.defineCatalogHandler((args) => {
    // Mock simple handler
    return Promise.resolve({ metas: [] });
  });

  app.get("/addon.json", (req, res) => res.json(builder.getInterface()));

  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Custom Library running on port ${port}`));
})();
