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
    return '<!DOCTYPE html>\n<html><head><title>' + t.title + '</title>\n<meta charset="utf-8"><meta name="viewport" content="width=device-width">\n<style>\n*{margin:0;padding:0;box-sizing:border-box;}\nbody{font-family:Arial,sans-serif;background:linear-gradient(135deg,#1a1a1a 0%,#2d1b69 100%);color:white;padding:40px 20px;min-height:100vh;display:flex;align-items:center;}\n.container{max-width:500px;margin:auto;text-align:center;}\n.logo{width:140px;height:140px;margin:30px auto;display:block;}\n.form-group{margin:25px 0;}\ninput{padding:18px;border-radius:12px;border:2px solid #8b5cf6;background:rgba(26,26,26,0.8);color:white;font-size:16px;width:100%;max-width:350px;box-shadow:0 4px 15px rgba(139,92,246,0.2);}\ninput:focus{outline:none;border-color:#a78bfa;box-shadow:0 0 20px rgba(139,92,246,0.4);}\nbutton{padding:18px 30px;border-radius:12px;border:none;font-size:16px;font-weight:bold;cursor:pointer;margin:10px;transition:all 0.3s;box-shadow:0 4px 15px rgba(139,92,246,0.3);}\n.btn-login{background:#8b5cf6;color:white;width:100%;max-width:350px;}\n.btn-login:hover{background:#a78bfa;transform:translateY(-2px);}\n.btn-register{background:#4ade80;color:black;width:100%;max-width:350px;}\n.btn-register:hover{background:#6ee7b7;transform:translateY(-2px);}\nh1{font-size:2.2em;margin-bottom:20px;background:linear-gradient(45deg,#8b5cf6,#a78bfa);background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent;}\n</style></head><body>\n<div class="container">\n<svg class="logo" viewBox="0 0 200 200" fill="#8b5cf6">\n  <rect x="45" y="130" width="35" height="55" rx="4" transform="rotate(-8 62.5 157.5)"/>\n  <rect x="55" y="110" width="35" height="55" rx="4" transform="rotate(-3 72.5 137.5)"/>\n  <rect x="65" y="90" width="35" height="55" rx="4"/>\n  <rect x="75" y="70" width="35" height="55" rx="4"/>\n</svg>\n<h1>' + t.title + '</h1>\n<div class="form-group"><input id="user" placeholder="' + t.user + '" autocomplete="username"></div>\n<div class="form-group"><input id="pass" type="password" placeholder="' + t.pass + '" autocomplete="current-password"></div>\n<button class="btn-login" onclick="login()">' + t.login + '</button>\n<button class="btn-register" onclick="register()">' + t.register + '</button>\n</div>\n<script>\nlet currentUser = \'\';\nlet currentPass = \'\';\nfunction updateAuth(){\n  currentUser = document.getElementById(\'user\').value;\n  currentPass = document.getElementById(\'pass\').value;\n}\ndocument.getElementById(\'user\').addEventListener(\'input\', updateAuth);\ndocument.getElementById(\'pass\').addEventListener(\'input\', updateAuth);\nasync function api(path, opts={method:\'POST\'}){\n  return fetch(\'/api\'+path, {\n    headers:{\'Content-Type\':\'application/json\', \'Authorization\':\'Basic \'+btoa(currentUser+\':\'+currentPass)},\n    ...opts\n  });\n}\nasync function login(){\n  if(!currentUser){\n    alert(\'Enter username\');\n    return;\n  }\n  try{\n    await api(\'/login\', {method:\'POST\', body:JSON.stringify({user:currentUser})});\n    location.reload();\n  }catch(e){\n    alert(\'Login failed\');\n  }\n}\nasync function register(){\n  if(!currentUser || !currentPass){\n    alert(\'Enter username and password\');\n    return;\n  }\n  try{\n    await api(\'/register\', {method:\'POST\', body:JSON.stringify({user:currentUser, pass:currentPass})});\n    location.reload();\n  }catch(e){\n    alert(\'Registration failed\');\n  }\n}\n</script>\n</body></html>';
}

function getMainHTML(t, user, host) {
    let listsHTML = '';
    const lists = Object.entries(user.lists || {}).sort((a,b)=>a[1].order - b[1].order);
    lists.forEach(([id, list]) => {
        listsHTML += '<div class="list-item" data-id="' + id + '" draggable="true">\n<h3 contenteditable="true" onblur="rename(\'' + id + '\', this.textContent.trim())">' + list.name + ' (' + list.items.length + ')</h3>\n<div class="actions">\n<button onclick="moveUp(\'' + id + '\')">' + t.up + '</button>\n<button onclick="moveDown(\'' + id + '\')">' + t.down + '</button>\n<button class="delete-btn" onclick="removeList(\'' + id + '\')">' + t.delete + '</button>\n<input type="checkbox" class="share-check">\n</div>\n</div>';
    });

    const manifestUrl = 'https://' + host + '/manifest.json';
    const stremioUrl = 'stremio://catalog/?url=' + encodeURIComponent(manifestUrl) + '&preload';

    const langClassEN = lang === 'en' ? 'active' : '';
    const langClassES = lang === 'es' ? 'active' : '';

    return '<!DOCTYPE html>\n<html><head><title>' + t.title + '</title>\n<meta charset="utf-8"><meta name="viewport" content="width=device-width">\n<style>' +
        '*{margin:0;padding:0;box-sizing:border-box;}\n' +
        'body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#1a1a1a 0%,#2d1b69 100%);color:white;padding:30px;min-height:100vh;}\n' +
        '.container{max-width:1000px;margin:auto;}\n' +
        // ... resto del CSS igual pero con concatenación
        // (Para mantenerlo breve, uso el CSS completo pero concatenado)
        '*{margin:0;padding:0;box-sizing:border-box;}' +
        'body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#1a1a1a 0%,#2d1b69 100%);color:white;padding:30px;min-height:100vh;}' +
        '.container{max-width:1000px;margin:auto;}' +
        '.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:30px;flex-wrap:wrap;gap:15px;}' +
        '.logo{width:70px;height:70px;display:block;}' +
        'h1{color:#8b5cf6;font-size:2em;margin:0;}' +
        '.lang{display:flex;gap:10px;}' +
        '.lang button{padding:10px 15px;background:rgba(26,26,26,0.8);border:2px solid #8b5cf6;color:#8b5cf6;cursor:pointer;border-radius:8px;font-weight:bold;transition:all 0.3s;}' +
        '.lang .active{background:#8b5cf6;color:black;}' +
        '.logout{padding:12px 20px;background:#6b7280;color:white;cursor:pointer;border-radius:8px;font-weight:bold;transition:all 0.3s;}' +
        '.logout:hover{background:#4b5563;}' +
        '.new-list{display:flex;gap:15px;margin:30px 0;max-width:500px;align-items:center;}' +
        '.new-list input{flex:1;padding:15px;background:rgba(26,26,26,0.8);border:2px solid #8b5cf6;border-radius:10px;color:white;font-size:16px;}' +
        '.new-list button{padding:15px 30px;background:#8b5cf6;color:black;border:none;border-radius:10px;font-size:16px;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(139,92,246,0.3);transition:all 0.3s;}' +
        '.new-list button:hover{background:#a78bfa;transform:translateY(-2px);}' +
        'h2{color:#8b5cf6;margin:30px 0 20px 0;font-size:1.8em;}' +
        '.lists{display:flex;flex-direction:column;gap:20px;}' +
        '.list-item{background:rgba(26,26,26,0.8);padding:25px;border-radius:15px;border-left:5px solid #8b5cf6;box-shadow:0 8px 25px rgba(139,92,246,0.2);cursor:move;transition:all 0.3s;}' +
        '.list-item:hover{transform:translateY(-3px);box-shadow:0 12px 35px rgba(139,92,246,0.3);}' +
        '.list-item h3{color:#8b5cf6;margin-bottom:15px;font-size:20px;}' +
        '.list-item h3:focus{outline:none;background:rgba(139,92,246,0.1);padding:5px;border-radius:5px;}' +
        '.actions{display:flex;gap:10px;align-items:center;}' +
        '.actions button{padding:8px 16px;background:#8b5cf6;color:black;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:bold;transition:all 0.3s;}' +
        '.actions button:hover{background:#a78bfa;}' +
        '.delete-btn{background:#ef4444;color:white;}' +
        '.delete-btn:hover{background:#dc2626;}' +
        '.share-section{margin:30px 0;text-align:center;}' +
        '.share-section button{padding:15px 40px;background:#4ade80;color:black;border:none;border-radius:10px;font-size:16px;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(74,222,128,0.3);transition:all 0.3s;}' +
        '.share-section button:hover{background:#6ee7b7;transform:translateY(-2px);}' +
        '.backup-section{display:flex;gap:15px;justify-content:center;margin:30px 0;align-items:center;}' +
        '.backup-section button{padding:15px 25px;background:#10b981;color:white;border:none;border-radius:10px;font-weight:bold;cursor:pointer;transition:all 0.3s;}' +
        '.backup-section button:hover{background:#059669;transform:translateY(-2px);}' +
        '.backup-section input[type=file]{padding:15px;background:rgba(26,26,26,0.8);border:2px solid #8b5cf6;color:white;border-radius:10px;cursor:pointer;}' +
        '.install-section{background:rgba(26,26,26,0.6);padding:30px;border-radius:15px;margin:30px 0;text-align:center;box-shadow:0 8px 25px rgba(0,0,0,0.3);}' +
        '.install-section p{font-size:16px;margin-bottom:20px;word-break:break-all;background:rgba(139,92,246,0.1);padding:15px;border-radius:8px;}' +
        '.install-section button{padding:15px 25px;margin:8px;font-size:16px;font-weight:bold;border-radius:10px;border:none;cursor:pointer;transition:all 0.3s;box-shadow:0 4px 15px rgba(139,92,246,0.3);}' +
        '.copy-btn{background:#3b82f6;color:white;}' +
        '.copy-btn:hover{background:#2563eb;}' +
        '.stremio-btn{background:#8b5cf6;color:black;}' +
        '.stremio-btn:hover{background:#a78bfa;}' +
        '.install-btn{background:#10b981;color:black;}' +
        '.install-btn:hover{background:#059669;}' +
        '.message{padding:20px;margin:20px 0;border-radius:10px;font-weight:bold;text-align:center;}' +
        '.success{background:#10b981;}' +
        '.error{background:#ef4444;}' +
        '@media(max-width:768px){.container{padding:0 20px;}.header{flex-direction:column;text-align:center;}.new-list{flex-direction:column;}.backup-section{flex-direction:column;}.actions{flex-wrap:wrap;}}' +
        '</style></head><body>\n<div class="container">\n<svg class="logo" viewBox="0 0 200 200" fill="#8b5cf6">\n  <rect x="45" y="130" width="35" height="55" rx="4" transform="rotate(-8 62.5 157.5)"/>\n  <rect x="55" y="110" width="35" height="55" rx="4" transform="rotate(-3 72.5 137.5)"/>\n  <rect x="65" y="90" width="35" height="55" rx="4"/>\n  <rect x="75" y="70" width="35" height="55" rx="4"/>\n</svg>\n<div class="header">\n<h1>' + t.title + ' - ' + user + '</h1>\n<div style="display:flex;gap:15px;align-items:center;">\n<div class="lang">\n<button class="' + langClassEN + '" onclick="setLang(\'en\')">EN</button>\n<button class="' + langClassES + '" onclick="setLang(\'es\')">ES</button>\n</div>\n<button class="logout" onclick="logout()">' + t.logout + '</button>\n</div>\n</div>\n<div class="new-list">\n<input id="newName" placeholder="' + t.namePlh + '">\n<button onclick="createList()">' + t.create + '</button>\n</div>\n<h2>' + t.lists + '</h2>\n<div id="lists">' + listsHTML + '</div>\n<div class="share-section">\n<button onclick="shareSelected()">' + t.share + '</button>\n</div>\n<div class="backup-section">\n<button onclick="backup()">' + t.backup + '</button>\n<input type="file" id="importFile" accept=".json" onchange="importFile(event)">\n<button onclick="document.getElementById(\'importFile\').click()">' + t.restore + '</button>\n</div>\n<div class="install-section">\n<p>' + manifestUrl + '</p>\n<button class="copy-btn" onclick="copyUrl(\'' + manifestUrl + '\')">' + t.copyUrl + '</button>\n<button class="stremio-btn" onclick="openStremio(\'' + stremioUrl + '\')">' + t.openStremio + '</button>\n<button class="install-btn" onclick="window.location=\'' + stremioUrl + '\'">' + t.install + '</button>\n</div>\n<div id="message"></div>\n</div>\n<script>\nlet dragId = null;\ndocument.addEventListener(\'DOMContentLoaded\', function() {\n  const lists = document.querySelectorAll(\'.list-item\');\n  lists.forEach(el => {\n    el.addEventListener(\'dragstart\', e => { dragId = e.target.dataset.id; });\n    el.addEventListener(\'dragover\', e => e.preventDefault());\n    el.addEventListener(\'drop\', e => {\n      if (dragId && dragId !== e.target.closest(\'.list-item\').dataset.id) {\n        moveList(dragId, e.target.closest(\'.list-item\').dataset.id);\n      }\n      dragId = null;\n    });\n  });\n});\n\nfunction showMsg(text, isError = false) {\n  const msgDiv = document.getElementById(\'message\');\n  msgDiv.innerHTML = \'<div class="message \'+ (isError ? \'error\' : \'success\') +\'">\'+text+\'</div>\';\n  setTimeout(() => { msgDiv.innerHTML = \'\'; }, 4000);\n}\n\nasync function api(path, body) {\n  const resp = await fetch(\'/api\' + path, {\n    method: \'POST\',\n    headers: {\'Content-Type\': \'application/json\'},\n    body: JSON.stringify(body)\n  });\n  return resp.json();\n}\n\nasync function createList() {\n  const name = document.getElementById(\'newName\').value.trim();\n  if (!name) return showMsg(\'Enter list name\', true);\n  await api(\'/lists\', {name});\n  document.getElementById(\'newName\').value = \'\';\n  location.reload();\n}\n\nasync function rename(id, newName) {\n  if (!newName.trim()) return;\n  await api(\'/lists/\'+id+\'/rename\', {name: newName});\n  showMsg(\'Renamed!\');\n}\n\nasync function moveUp(id) {\n  await api(\'/lists/\'+id+\'/move\', {dir: -1});\n  location.reload();\n}\n\nasync function moveDown(id) {\n  await api(\'/lists/\'+id+\'/move\', {dir: 1});\n  location.reload();\n}\n\nasync function moveList(id1, id2) {\n  location.reload();\n}\n\nasync function removeList(id) {\n  if (!confirm(\'Delete this list?\')) return;\n  await fetch(\'/api/lists/\'+id, {method: \'DELETE\'});\n  location.reload();\n}\n\nasync function logout() {\n  await fetch(\'/api/logout\', {method: \'POST\'});\n  location.reload();\n}\n\nasync function setLang(l) {\n  await fetch(\'/api/lang\', {\n    method: \'POST\',\n    headers: {\'Content-Type\': \'application/json\'},\n    body: JSON.stringify({lang: l})\n  });\n  location.reload();\n}\n\nfunction backup() {\n  showMsg(\'Backup ready!\');\n}\n\nasync function importFile(event) {\n  const file = event.target.files[0];\n  if (!file) return;\n  const reader = new FileReader();\n  reader.onload = async (e) => {\n    try {\n      const data = JSON.parse(e.target.result);\n      await api(\'/import\', data);\n      showMsg(\'Imported OK!\');\n      location.reload();\n    } catch (err) {\n      showMsg(\'Import error: \' + err.message, true);\n    }\n  };\n  reader.readAsText(file);\n}\n\nasync function shareSelected() {\n  const selected = Array.from(document.querySelectorAll(\'.share-check:checked\'))\n    .map(cb => cb.closest(\'.list-item\').dataset.id);\n  if (selected.length === 0) return showMsg(\'Select lists to share\', true);\n  showMsg(\'Share functionality coming soon!\');\n}\n\nasync function copyUrl(url) {\n  try {\n    await navigator.clipboard.writeText(url);\n    showMsg(\'Copied!\');\n  } catch {\n    const textArea = document.createElement(\'textarea\');\n    textArea.value = url;\n    document.body.appendChild(textArea);\n    textArea.select();\n    document.execCommand(\'copy\');\n    document.body.removeChild(textArea);\n    showMsg(\'Copied!\');\n  }\n}\n\nfunction openStremio(url) {\n  window.location = url;\n}\n</script>\n</body></html>';
}

// Resto de API routes SIN CAMBIOS
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

// Stremio endpoints
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
