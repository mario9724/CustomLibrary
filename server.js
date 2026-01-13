const express = require('express');
const crypto = require('crypto');
const PORT = process.env.PORT || 10000;

const app = express();
app.use(express.json({limit: '10mb'}));
app.use(express.urlencoded({extended: true, limit: '10mb'}));
app.use(express.static('public'));

let dataStore = {users: {}, sessions: {}, lists: {}};

function getUser(req) {
  let username = 'anon';
  let sessionId = crypto.randomBytes(8).toString('hex');

  if (req.headers.cookie) {
    const cookies = {};
    req.headers.cookie.split(';').forEach(c => {
      const [name, value] = c.trim().split('=');
      if (name && value) cookies[name] = decodeURIComponent(value);
    });
    username = cookies.user || 'anon';
    sessionId = cookies.session || sessionId;
  }

  return { username, sessionId };
}

app.use((req, res, next) => {
  req.user = getUser(req);
  next();
});

app.get('/manifest.json', (req, res) => {
  res.json({
    id: 'com.customlibrary.addon',
    version: '1.0.0',
    name: 'Custom Library',
    description: 'Crea y gestiona tus listas personalizadas',
    types: ['movie', 'series', 'sports'],
    catalogs: [],
    resources: ['catalog', 'meta', 'stream'],
    idPrefixes: ['tt', 'custom_'],
    contactEmail: 'mario9724@gmail.com'
  });
});

app.get('/catalog/:type/:id.json', (req, res) => {
  const { type, id } = req.params;
  const username = req.user.username;

  const userList = dataStore.lists[username]?.[id];
  if (userList && userList.type === type) {
    return res.json({ metas: userList.metas || [] });
  }

  res.json({ metas: [] });
});

app.get('/meta/:type/:id.json', (req, res) => {
  const { type, id } = req.params;

  res.json({
    meta: {
      id,
      type,
      name: `Item ${id}`,
      poster: 'https://via.placeholder.com/342x513?text=' + id,
      posterShape: 'portrait',
      description: 'Item de tu librería personalizada',
      imdbRating: 7.5,
      genre: ['Personal'],
      year: 2024
    }
  });
});

app.get('/stream/:type/:id.json', (req, res) => {
  res.json({ streams: [] });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({error: 'Usuario/contraseña requeridos'});
  }

  if (!dataStore.users[username]) {
    dataStore.users[username] = {
      username,
      createdAt: new Date()
    };
  }

  const sessionId = crypto.randomBytes(16).toString('hex');
  dataStore.sessions[sessionId] = {username, createdAt: new Date()};

  res.setHeader('Set-Cookie', [
    `user=${username}; Path=/; Max-Age=2592000`,
    `session=${sessionId}; Path=/; Max-Age=2592000`
  ]);

  res.json({
    success: true,
    username,
    sessionId,
    message: `¡Bienvenido ${username}!`
  });
});

app.post('/api/lists/create', (req, res) => {
  const { listName, description, type } = req.body;
  const username = req.user.username;

  if (username === 'anon') {
    return res.status(401).json({error: 'Debes iniciar sesión'});
  }

  if (!listName || !type) {
    return res.status(400).json({error: 'Nombre y tipo de lista requeridos'});
  }

  if (!dataStore.lists[username]) {
    dataStore.lists[username] = {};
  }

  const listId = listName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();

  dataStore.lists[username][listId] = {
    id: listId,
    name: listName,
    type: type,
    description: description || '',
    metas: [],
    createdAt: new Date(),
    owner: username
  };

  res.json({
    success: true,
    listId,
    message: `Lista "${listName}" creada ✅`
  });
});

app.post('/api/lists/:listId/add', (req, res) => {
  const { listId } = req.params;
  const { id, name, type, poster } = req.body;
  const username = req.user.username;

  if (username === 'anon') {
    return res.status(401).json({error: 'Debes iniciar sesión'});
  }

  const list = dataStore.lists[username]?.[listId];
  if (!list) {
    return res.status(404).json({error: 'Lista no encontrada'});
  }

  list.metas.push({
    id: id || 'custom_' + Date.now(),
    name: name || 'Sin título',
    type: type || 'movie',
    poster: poster || 'https://via.placeholder.com/342x513?text=' + name
  });

  res.json({
    success: true,
    message: `"${name}" añadido ✅`,
    totalItems: list.metas.length
  });
});

app.get('/api/lists', (req, res) => {
  const username = req.user.username;
  const userLists = dataStore.lists[username] || {};

  res.json({
    user: username,
    lists: Object.values(userLists),
    total: Object.keys(userLists).length
  });
});

app.delete('/api/lists/:listId/item/:itemId', (req, res) => {
  const { listId, itemId } = req.params;
  const username = req.user.username;

  if (username === 'anon') {
    return res.status(401).json({error: 'Debes iniciar sesión'});
  }

  const list = dataStore.lists[username]?.[listId];
  if (!list) {
    return res.status(404).json({error: 'Lista no encontrada'});
  }

  list.metas = list.metas.filter(m => m.id !== itemId);

  res.json({
    success: true,
    message: 'Item eliminado ✅'
  });
});

app.get('/api/lists/:listId/export', (req, res) => {
  const { listId } = req.params;
  const username = req.user.username;
  const list = dataStore.lists[username]?.[listId];

  if (!list) {
    return res.status(404).json({error: 'Lista no encontrada'});
  }

  res.setHeader('Content-Disposition', `attachment; filename="${list.name}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.json(list);
});

app.get('/', (req, res) => {
  const isLoggedIn = req.user.username !== 'anon';

  let html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Custom Library</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      background: #0a0e27;
      color: #fff;
      min-height: 100vh;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    header { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
      padding: 40px 20px; 
      text-align: center; 
      border-radius: 10px; 
      margin-bottom: 30px; 
    }
    h1 { font-size: 2.5em; margin-bottom: 10px; }
    .user-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding: 15px;
      background: #1a1f3a;
      border-radius: 8px;
    }
    .btn { 
      display: inline-block; 
      padding: 12px 24px; 
      background: #667eea; 
      color: white; 
      text-decoration: none; 
      border-radius: 5px; 
      border: none; 
      cursor: pointer; 
      font-size: 1em; 
      transition: all 0.3s; 
    }
    .btn:hover { background: #764ba2; transform: translateY(-2px); }
    .btn-small { padding: 8px 16px; font-size: 0.9em; }
    .btn-danger { background: #e74c3c; }
    .btn-danger:hover { background: #c0392b; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; }
    .card { 
      background: #1a1f3a; 
      padding: 20px; 
      border-radius: 10px; 
      border-left: 4px solid #667eea;
    }
    .card h3 { color: #667eea; margin-bottom: 15px; }
    input, textarea, select { 
      width: 100%; 
      padding: 10px; 
      margin: 8px 0; 
      background: #2a2f4a; 
      color: white; 
      border: 1px solid #444; 
      border-radius: 5px; 
      font-family: inherit; 
    }
    input:focus, textarea:focus, select:focus { outline: none; border-color: #667eea; box-shadow: 0 0 10px rgba(102, 126, 234, 0.3); }
    .list-item {
      background: #2a2f4a;
      padding: 12px;
      border-radius: 5px;
      margin: 10px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .manifest-box {
      background: #2a2f4a;
      padding: 20px;
      border-radius: 10px;
      border: 2px dashed #667eea;
      text-align: center;
      margin-bottom: 30px;
    }
    .manifest-box code {
      background: #0a0e27;
      padding: 10px;
      border-radius: 5px;
      display: block;
      word-break: break-all;
      margin: 10px 0;
      font-family: monospace;
    }
    .copy-btn { cursor: pointer; font-size: 0.9em; color: #667eea; }
    .login-form { max-width: 400px; margin: 50px auto; background: #1a1f3a; padding: 30px; border-radius: 10px; }
    .login-form input { margin-bottom: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📚 Custom Library</h1>
      <p>Crea y gestiona tus listas personalizadas para Stremio</p>
    </header>

    <div class="manifest-box">
      <h2>🔗 Instalar en Stremio</h2>
      <p>Copia esta URL en Addons → Instalar desde URL:</p>
      <code id="manifest-url">https://customlibrary.onrender.com/manifest.json</code>
      <button class="copy-btn" onclick="copyManifest()">📋 Copiar URL</button>
    </div>
  `;

  if (isLoggedIn) {
    html += `
    <div class="user-bar">
      <div>
        <strong>👤 ${req.user.username}</strong>
      </div>
      <button class="btn btn-small btn-danger" onclick="logout()">Logout</button>
    </div>

    <div class="grid">
      <div class="card">
        <h3>➕ Nueva Lista</h3>
        <input type="text" id="listName" placeholder="Nombre de lista">
        <select id="listType">
          <option value="movie">🎬 Película</option>
          <option value="series">📺 Serie</option>
          <option value="sports">⚽ Deporte</option>
        </select>
        <textarea id="listDesc" placeholder="Descripción (opcional)" style="resize: vertical; min-height: 60px;"></textarea>
        <button class="btn" onclick="createList()">Crear Lista</button>
      </div>

      <div class="card">
        <h3>📋 Mis Listas</h3>
        <div id="listContainer" style="max-height: 400px; overflow-y: auto;">
          <p style="opacity: 0.6;">Cargando listas...</p>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: 20px;">
      <h3>➕ Añadir Item a Lista</h3>
      <select id="selectList" style="width: 100%; margin-bottom: 10px;">
        <option value="">Selecciona una lista...</option>
      </select>
      <input type="text" id="itemId" placeholder="ID (ej: tt0111161)">
      <input type="text" id="itemName" placeholder="Título">
      <input type="text" id="itemPoster" placeholder="URL de poster (opcional)">
      <button class="btn" onclick="addItem()">Añadir Item</button>
    </div>
    `;
  } else {
    html += `
    <div class="login-form">
      <h2>Iniciar Sesión</h2>
      <input type="text" id="loginUsername" placeholder="Usuario">
      <input type="password" id="loginPassword" placeholder="Contraseña">
      <button class="btn" onclick="login()" style="width: 100%;">Entrar</button>
      <p style="opacity: 0.7; margin-top: 15px; font-size: 0.9em;">No tienes cuenta? Se crea automáticamente.</p>
    </div>
    `;
  }

  html += `
  </div>

  <script>
    function copyManifest() {
      navigator.clipboard.writeText(document.getElementById('manifest-url').textContent);
      alert('¡URL copiada al portapapeles!');
    }

    function logout() {
      document.cookie = "user=; Max-Age=0";
      document.cookie = "session=; Max-Age=0";
      location.reload();
    }

    function login() {
      const username = document.getElementById('loginUsername').value;
      const password = document.getElementById('loginPassword').value;

      if (!username || !password) {
        return alert('Usuario y contraseña requeridos');
      }

      fetch('/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username, password})
      })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          location.reload();
        } else {
          alert('Error: ' + data.error);
        }
      });
    }

    function createList() {
      const name = document.getElementById('listName').value;
      const type = document.getElementById('listType').value;
      const desc = document.getElementById('listDesc').value;

      if (!name) return alert('Nombre requerido');

      fetch('/api/lists/create', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({listName: name, type, description: desc})
      })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          alert(data.message);
          loadLists();
          document.getElementById('listName').value = '';
          document.getElementById('listDesc').value = '';
        } else {
          alert('Error: ' + data.error);
        }
      });
    }

    function loadLists() {
      fetch('/api/lists')
      .then(r => r.json())
      .then(data => {
        const html = data.lists.length > 0 
          ? data.lists.map(l => 
              `<div class="list-item">
                <div>
                  <strong>${l.name}</strong> 
                  <span style="opacity: 0.6;">(${l.type}, ${l.metas.length} items)</span>
                </div>
                <button class="btn btn-small btn-danger" onclick="deleteList('${l.id}')">🗑️</button>
              </div>`
            ).join('')
          : '<p style="opacity: 0.6;">Sin listas aún</p>';

        document.getElementById('listContainer').innerHTML = html;

        const selectHtml = '<option value="">Selecciona una lista...</option>' + 
          data.lists.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
        document.getElementById('selectList').innerHTML = selectHtml;
      });
    }

    function deleteList(listId) {
      if (confirm('¿Eliminar esta lista?')) {
        loadLists();
      }
    }

    function addItem() {
      const listId = document.getElementById('selectList').value;
      const id = document.getElementById('itemId').value;
      const name = document.getElementById('itemName').value;
      const poster = document.getElementById('itemPoster').value;

      if (!listId || !id || !name) return alert('Rellena los campos requeridos');

      fetch('/api/lists/' + listId + '/add', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id, name, type: 'movie', poster})
      })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          alert(data.message);
          document.getElementById('itemId').value = '';
          document.getElementById('itemName').value = '';
          document.getElementById('itemPoster').value = '';
          loadLists();
        } else {
          alert('Error: ' + data.error);
        }
      });
    }

    if (${isLoggedIn ? 'true' : 'false'}) {
      loadLists();
    }
  </script>
</body>
</html>`;

  res.send(html);
});

app.listen(PORT, () => {
  console.log(`🚀 Custom Library running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`📋 Manifest: http://localhost:${PORT}/manifest.json`);
});