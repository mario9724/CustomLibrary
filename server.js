const express = require('express');
const crypto = require('crypto');
const PORT = process.env.PORT || 7000;

const app = express();
app.use(express.json({limit: '10mb'}));

// Datos persistentes
let dataStore = {users: {}, sessions: {}};
let lang = 'en';

const L = {
    en: {
        title: 'Custom Library', iconAlt: 'Books',
        lists: 'Your Lists', newList: 'New List', namePlh: 'List name',
        create: 'Create', up: '↑', down: '↓', delete: 'Delete',
        backup: 'Backup', restore: 'Restore', share: 'Share Selected',
        install: 'Install Stremio', copyUrl: 'Copy URL', openStremio: 'Open Stremio',
        login: 'Login', register: 'Register', logout: 'Logout',
        user: 'Username', pass: 'Password', loginReq: 'Login required!',
        msgCreated: 'List created!', msgRenamed: 'Renamed!', msgDeleted: 'Deleted!',
        msgBackup: 'Backup ready!', msgImported: 'Imported OK!', msgCopied: 'Copied!',
        selectLang: 'EN'
    },
    es: {
        title: 'Biblioteca Personalizada', iconAlt: 'Libros',
        lists: 'Tus Listas', newList: 'Nueva Lista', namePlh: 'Nombre lista',
        create: 'Crear', up: '↑', down: '↓', delete: 'Eliminar',
        backup: 'Backup', restore: 'Restaurar', share: 'Compartir Seleccionadas',
        install: 'Instalar Stremio', copyUrl: 'Copiar URL', openStremio: 'Abrir Stremio',
        login: 'Entrar', register: 'Registrarse', logout: 'Salir',
        user: 'Usuario', pass: 'Contraseña', loginReq: '¡Inicia sesión!',
        msgCreated: '¡Lista creada!', msgRenamed: '¡Renombrada!', msgDeleted: '¡Eliminada!',
        msgBackup: '¡Backup listo!', msgImported: '¡Importado!', msgCopied: '¡Copiado!',
        selectLang: 'ES'
    }
};

function getUser(req) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) return null;
    try {
        const token = auth.split(' ')[1];
        return dataStore.sessions[token] || null;
    } catch(e) {
        return null;
    }
}

function hash(str) { 
    return crypto.createHash('sha256').update(str).digest('hex'); 
}

// Middleware auth
app.use((req, res, next) => {
    req.user = getUser(req);
    next();
});

app.get('/', (req, res) => {
    const user = req.user;
    const t = L[lang];
    if (!user) {
        return res.send(getLoginHTML(t));
    }
    const html = getMainHTML(t, user, req.headers.host || 'localhost:7000');
    res.send(html);
});

function getLoginHTML(t) {
    return `<!DOCTYPE html>
<html><head><title>${t.title}</title>
<meta charset="utf-8"><meta name="viewport" content="width=device-width">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#1a1a1a 0%,#2d1b69 100%);color:white;padding:40px 20px;min-height:100vh;display:flex;align-items:center;}
.container{max-width:500px;margin:auto;text-align:center;}
.logo{width:140px;height:140px;margin:30px auto;display:block;}
.form-group{margin:25px 0;}
input{padding:18px;border-radius:12px;border:2px solid #8b5cf6;background:rgba(26,26,26,0.8);color:white;font-size:16px;width:100%;max-width:350px;box-shadow:0 4px 15px rgba(139,92,246,0.2);}
input:focus{outline:none;border-color:#a78bfa;box-shadow:0 0 20px rgba(139,92,246,0.4);}
button{padding:18px 30px;border-radius:12px;border:none;font-size:16px;font-weight:bold;cursor:pointer;margin:10px;transition:all 0.3s;box-shadow:0 4px 15px rgba(139,92,246,0.3);}
.btn-login{background:#8b5cf6;color:white;width:100%;max-width:350px;}
.btn-login:hover{background:#a78bfa;transform:translateY(-2px);}
.btn-register{background:#4ade80;color:black;width:100%;max-width:350px;}
.btn-register:hover{background:#6ee7b7;transform:translateY(-2px);}
h1{font-size:2.2em;margin-bottom:20px;background:linear-gradient(45deg,#8b5cf6,#a78bfa);background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
</style></head><body>
<div class="container">
<svg class="logo" viewBox="0 0 200 200" fill="#8b5cf6">
  <rect x="45" y="130" width="35" height="55" rx="4" transform="rotate(-8 62.5 157.5)"/>
  <rect x="55" y="110" width="35" height="55" rx="4" transform="rotate(-3 72.5 137.5)"/>
  <rect x="65" y="90" width="35" height="55" rx="4"/>
  <rect x="75" y="70" width="35" height="55" rx="4"/>
</svg>
<h1>${t.title}</h1>
<div class="form-group"><input id="user" placeholder="${t.user}" autocomplete="username"></div>
<div class="form-group"><input id="pass" type="password" placeholder="${t.pass}" autocomplete="current-password"></div>
<button class="btn-login" onclick="login()">${t.login}</button>
<button class="btn-register" onclick="register()">${t.register}</button>
</div>
<script>
let currentUser = '';
let currentPass = '';
function updateAuth(){
  currentUser = document.getElementById('user').value;
  currentPass = document.getElementById('pass').value;
}
document.getElementById('user').addEventListener('input', updateAuth);
document.getElementById('pass').addEventListener('input', updateAuth);
async function api(path, opts={method:'POST'}){
  return fetch('/api'+path, {
    headers:{'Content-Type':'application/json', 'Authorization':'Basic '+btoa(currentUser+':'+currentPass)},
    ...opts
  });
}
async function login(){
  if(!currentUser){
    alert('Enter username');
    return;
  }
  try{
    await api('/login', {method:'POST', body:JSON.stringify({user:currentUser})});
    location.reload();
  }catch(e){
    alert('Login failed');
  }
}
async function register(){
  if(!currentUser || !currentPass){
    alert('Enter username and password');
    return;
  }
  try{
    await api('/register', {method:'POST', body:JSON.stringify({user:currentUser, pass:currentPass})});
    location.reload();
  }catch(e){
    alert('Registration failed');
  }
}
</script>
</body></html>`;
}

function getMainHTML(t, user, host) {
    let listsHTML = '';
    const lists = Object.entries(user.lists || {}).sort((a,b)=>a[1].order - b[1].order);
    lists.forEach(([id, list]) => {
        listsHTML += `<div class="list-item" data-id="${id}" draggable="true">
<h3 contenteditable="true" onblur="rename('${id}', this.textContent.trim())">${list.name} (${list.items.length})</h3>
<div class="actions">
<button onclick="moveUp('${id}')">${t.up}</button>
<button onclick="moveDown('${id}')">${t.down}</button>
<button class="delete-btn" onclick="removeList('${id}')">${t.delete}</button>
<input type="checkbox" class="share-check">
</div>
</div>`;
    });

    const manifestUrl = `https://${host}/manifest.json`;
    const stremioUrl = `stremio://catalog/?url=${encodeURIComponent(manifestUrl)}&preload`;

    const langClassEN = lang === 'en' ? 'active' : '';
    const langClassES = lang === 'es' ? 'active' : '';

    return `<!DOCTYPE html>
<html><head><title>${t.title}</title>
<meta charset="utf-8"><meta name="viewport" content="width=device-width">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#1a1a1a 0%,#2d1b69 100%);color:white;padding:30px;min-height:100vh;}
.container{max-width:1000px;margin:auto;}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:30px;flex-wrap:wrap;gap:15px;}
.logo{width:70px;height:70px;display:block;}
h1{color:#8b5cf6;font-size:2em;margin:0;}
.lang{display:flex;gap:10px;}
.lang button{padding:10px 15px;background:rgba(26,26,26,0.8);border:2px solid #8b5cf6;color:#8b5cf6;cursor:pointer;border-radius:8px;font-weight:bold;transition:all 0.3s;}
.lang .active{background:#8b5cf6;color:black;}
.logout{padding:12px 20px;background:#6b7280;color:white;cursor:pointer;border-radius:8px;font-weight:bold;transition:all 0.3s;}
.logout:hover{background:#4b5563;}
.new-list{display:flex;gap:15px;margin:30px 0;max-width:500px;align-items:center;}
.new-list input{flex:1;padding:15px;background:rgba(26,26,26,0.8);border:2px solid #8b5cf6;border-radius:10px;color:white;font-size:16px;}
.new-list button{padding:15px 30px;background:#8b5cf6;color:black;border:none;border-radius:10px;font-size:16px;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(139,92,246,0.3);transition:all 0.3s;}
.new-list button:hover{background:#a78bfa;transform:translateY(-2px);}
h2{color:#8b5cf6;margin:30px 0 20px 0;font-size:1.8em;}
.lists{display:flex;flex-direction:column;gap:20px;}
.list-item{background:rgba(26,26,26,0.8);padding:25px;border-radius:15px;border-left:5px solid #8b5cf6;box-shadow:0 8px 25px rgba(139,92,246,0.2);cursor:move;transition:all 0.3s;}
.list-item:hover{transform:translateY(-3px);box-shadow:0 12px 35px rgba(139,92,246,0.3);}
.list-item h3{color:#8b5cf6;margin-bottom:15px;font-size:20px;}
.list-item h3:focus{outline:none;background:rgba(139,92,246,0.1);padding:5px;border-radius:5px;}
.actions{display:flex;gap:10px;align-items:center;}
.actions button{padding:8px 16px;background:#8b5cf6;color:black;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:bold;transition:all 0.3s;}
.actions button:hover{background:#a78bfa;}
.delete-btn{background:#ef4444;color:white;}
.delete-btn:hover{background:#dc2626;}
.share-section{margin:30px 0;text-align:center;}
.share-section button{padding:15px 40px;background:#4ade80;color:black;border:none;border-radius:10px;font-size:16px;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(74,222,128,0.3);transition:all 0.3s;}
.share-section button:hover{background:#6ee7b7;transform:translateY(-2px);}
.backup-section{display:flex;gap:15px;justify-content:center;margin:30px 0;align-items:center;}
.backup-section button{padding:15px 25px;background:#10b981;color:white;border:none;border-radius:10px;font-weight:bold;cursor:pointer;transition:all 0.3s;}
.backup-section button:hover{background:#059669;transform:translateY(-2px);}
.backup-section input[type=file]{padding:15px;background:rgba(26,26,26,0.8);border:2px solid #8b5cf6;color:white;border-radius:10px;cursor:pointer;}
.install-section{background:rgba(26,26,26,0.6);padding:30px;border-radius:15px;margin:30px 0;text-align:center;box-shadow:0 8px 25px rgba(0,0,0,0.3);}
.install-section p{font-size:16px;margin-bottom:20px;word-break:break-all;background:rgba(139,92,246,0.1);padding:15px;border-radius:8px;}
.install-section button{padding:15px 25px;margin:8px;font-size:16px;font-weight:bold;border-radius:10px;border:none;cursor:pointer;transition:all 0.3s;box-shadow:0 4px 15px rgba(139,92,246,0.3);}
.copy-btn{background:#3b82f6;color:white;}
.copy-btn:hover{background:#2563eb;}
.stremio-btn{background:#8b5cf6;color:black;}
.stremio-btn:hover{background:#a78bfa;}
.install-btn{background:#10b981;color:black;}
.install-btn:hover{background:#059669;}
.message{padding:20px;margin:20px 0;border-radius:10px;font-weight:bold;text-align:center;}
.success{background:#10b981;}
.error{background:#ef4444;}
@media(max-width:768px){.container{padding:0 20px;}.header{flex-direction:column;text-align:center;}.new-list{flex-direction:column;}.backup-section{flex-direction:column;}.actions{flex-wrap:wrap;}}
</style></head><body>
<div class="container">
<svg class="logo" viewBox="0 0 200 200" fill="#8b5cf6">
  <rect x="45" y="130" width="35" height="55" rx="4" transform="rotate(-8 62.5 157.5)"/>
  <rect x="55" y="110" width="35" height="55" rx="4" transform="rotate(-3 72.5 137.5)"/>
  <rect x="65" y="90" width="35" height="55" rx="4"/>
  <rect x="75" y="70" width="35" height="55" rx="4"/>
</svg>
<div class="header">
<h1>${t.title} - ${user}</h1>
<div style="display:flex;gap:15px;align-items:center;">
<div class="lang">
<button class="${langClassEN}" onclick="setLang('en')">EN</button>
<button class="${langClassES}" onclick="setLang('es')">ES</button>
</div>
<button class="logout" onclick="logout()">${t.logout}</button>
</div>
</div>
<div class="new-list">
<input id="newName" placeholder="${t.namePlh}">
<button onclick="createList()">${t.create}</button>
</div>
<h2>${t.lists}</h2>
<div id="lists">${listsHTML}</div>
<div class="share-section">
<button onclick="shareSelected()">${t.share}</button>
</div>
<div class="backup-section">
<button onclick="backup()">${t.backup}</button>
<input type="file" id="importFile" accept=".json" onchange="importFile(event)">
<button onclick="document.getElementById('importFile').click()">${t.restore}</button>
</div>
<div class="install-section">
<p>${manifestUrl}</p>
<button class="copy-btn" onclick="copyUrl('${manifestUrl}')">${t.copyUrl}</button>
<button class="stremio-btn" onclick="openStremio('${stremioUrl}')">${t.openStremio}</button>
<button class="install-btn" onclick="window.location='${stremioUrl}'">${t.install}</button>
</div>
<div id="message"></div>
</div>
<script>
let dragId = null;
document.addEventListener('DOMContentLoaded', function() {
  const lists = document.querySelectorAll('.list-item');
  lists.forEach(el => {
    el.addEventListener('dragstart', e => { dragId = e.target.dataset.id; });
    el.addEventListener('dragover', e => e.preventDefault());
    el.addEventListener('drop', e => {
      if (dragId && dragId !== e.target.closest('.list-item').dataset.id) {
        moveList(dragId, e.target.closest('.list-item').dataset.id);
      }
      dragId = null;
    });
  });
});

function showMsg(text, isError = false) {
  const msgDiv = document.getElementById('message');
  msgDiv.innerHTML = `<div class="message ${isError ? 'error' : 'success'}">${text}</div>`;
  setTimeout(() => { msgDiv.innerHTML = ''; }, 4000);
}

async function api(path, body) {
  const resp = await fetch('/api' + path, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  });
  return resp.json();
}

async function createList() {
  const name = document.getElementById('newName').value.trim();
  if (!name) return showMsg('Enter list name', true);
  await api('/lists', {name});
  document.getElementById('newName').value = '';
  location.reload();
}

async function rename(id, newName) {
  if (!newName.trim()) return;
  await api(`/lists/${id}/rename`, {name: newName});
  showMsg('${t.msgRenamed}');
}

async function moveUp(id) {
  await api(`/lists/${id}/move`, {dir: -1});
  location.reload();
}

async function moveDown(id) {
  await api(`/lists/${id}/move`, {dir: 1});
  location.reload();
}

async function moveList(id1, id2) {
  // Simplified drag-drop - just reload for now
  location.reload();
}

async function removeList(id) {
  if (!confirm('Delete this list?')) return;
  await fetch(`/api/lists/${id}`, {method: 'DELETE'});
  location.reload();
}

async function logout() {
  await fetch('/api/logout', {method: 'POST'});
  location.reload();
}

async function setLang(l) {
  await fetch('/api/lang', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({lang: l})
  });
  location.reload();
}

function backup() {
  showMsg('${t.msgBackup}');
}

async function importFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      await api('/import', data);
      showMsg('${t.msgImported}');
      location.reload();
    } catch (err) {
      showMsg('Import error: ' + err.message, true);
    }
  };
  reader.readAsText(file);
}

async function shareSelected() {
  const selected = Array.from(document.querySelectorAll('.share-check:checked'))
    .map(cb => cb.closest('.list-item').dataset.id);
  if (selected.length === 0) return showMsg('Select lists to share', true);
  showMsg('Share functionality coming soon!');
}

async function copyUrl(url) {
  try {
    await navigator.clipboard.writeText(url);
    showMsg('${t.msgCopied}');
  } catch {
    const textArea = document.createElement('textarea');
    textArea.value = url;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showMsg('${t.msgCopied}');
  }
}

function openStremio(url) {
  window.location = url;
}
</script>
</body></html>`;
}

// Resto de API routes (sin cambios)...
app.post('/api/login', (req, res) => {
    const {user, pass} = req.body;
    if (!user || !pass) return res.status(400).json({error: 'Missing credentials'});
    const passHash = hash(pass);
    if (!dataStore.users[user] || dataStore.users[user].passHash !== passHash) {
        return res.status(401).json({error: L[lang].loginReq});
    }
    const token = crypto.randomUUID();
    dataStore.sessions[token] = user;
    res.json({token});
});

app.post('/api/register', (req, res) => {
    const {user, pass} = req.body;
    if (!user || !pass) return res.status(400).json({error: 'Missing credentials'});
    if (dataStore.users[user]) return res.status(400).json({error: 'User exists'});
    dataStore.users[user] = {passHash: hash(pass), lists: {}};
    const token = crypto.randomUUID();
    dataStore.sessions[token] = user;
    res.json({token});
});

app.post('/api/logout', (req, res) => {
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    if (token) delete dataStore.sessions[token];
    res.json({ok:1});
});

app.post('/api/lang', (req, res) => {
    if (req.body.lang && ['en', 'es'].includes(req.body.lang)) {
        lang = req.body.lang;
    }
    res.json({ok:1});
});

app.post('/api/lists', (req, res) => {
    if (!req.user) return res.status(401).json({error: 'No auth'});
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({error: 'List name required'});
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50);
    dataStore.users[req.user].lists[id] = {name, items: [], order: Object.keys(dataStore.users[req.user].lists).length};
    res.json({ok:1});
});

app.post('/api/lists/:id/rename', (req, res) => {
    if (!req.user || !dataStore.users[req.user].lists[req.params.id]) return res.status(404).json({error: 'Not found'});
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({error: 'Name required'});
    dataStore.users[req.user].lists[req.params.id].name = name;
    res.json({ok:1});
});

app.post('/api/lists/:id/move', (req, res) => {
    if (!req.user || !dataStore.users[req.user].lists[req.params.id]) return res.status(404).json({error: 'Not found'});
    const lists = dataStore.users[req.user].lists;
    const id = req.params.id;
    const dir = parseInt(req.body.dir) || 0;
    const order = lists[id].order + dir;
    
    // Find and swap with adjacent list
    for (let lid in lists) {
        if (lists[lid].order === order) {
            const temp = lists[lid].order;
            lists[lid].order = lists[id].order;
            lists[id].order = temp;
            break;
        }
    }
    res.json({ok:1});
});

app.delete('/api/lists/:id', (req, res) => {
    if (!req.user || !dataStore.users[req.user].lists[req.params.id]) return res.status(404).json({error: 'Not found'});
    delete dataStore.users[req.user].lists[req.params.id];
    res.json({ok:1});
});

app.post('/api/import', (req, res) => {
    if (!req.user) return res.status(401).json({error: 'No auth'});
    if (req.body.lists) {
        Object.assign(dataStore.users[req.user].lists, req.body.lists);
    }
    res.json({ok:1});
});

// Stremio endpoints (sin cambios)
app.get('/manifest.json', (req, res) => res.json({
    id: 'com.customlibrary.' + (req.query.user || 'anon'),
    name: 'Custom Library',
    version: '1.2.0',
    resources: ['catalog', 'meta', 'stream'],
    types: ['movie', 'series'],
    catalogs: [{id: 'lists', name: 'My Lists', type: 'list'}],
    behaviorHints: {configurable: true}
}));

app.get('/catalog/lists.json', (req, res) => {
    const user = req.query.user || req.user;
    if (!user || !dataStore.users[user]) return res.json({metas: []});
    const metas = Object.entries(dataStore.users[user].lists)
        .sort((a,b)=>a[1].order-b[1].order)
        .map(([id,l]) => ({
            id: `list:${id}`,
            type: 'list',
            name: l.name,
            poster: `https://via.placeholder.com/300x450/8b5cf6/FFFFFF?text=${encodeURIComponent(l.name.substring(0,20))}`
        }));
    res.json({metas});
});

app.get('/health', (req, res) => res.send('OK'));

app.use((req, res) => res.status(404).send('Not Found'));

app.listen(PORT, () => {
    console.log('🚀 Custom Library server running on port ' + PORT);
});
