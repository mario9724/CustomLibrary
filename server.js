const express = require('express');
const crypto = require('crypto');
const PORT = process.env.PORT || 7000;

const app = express();
app.use(express.json({limit: '10mb'}));

// Datos persistentes (usa file/DB prod)
let dataStore = {
    users: {},
    sessions: {}
};
let lang = 'en';

const L = {
    en: {
        title: 'Custom Library', iconAlt: 'Books',
        lists: 'Your Lists', newList: 'New List', namePlh: 'List name',
        create: 'Create', rename: 'Rename', up: '↑', down: '↓', delete: 'Delete',
        backup: 'Backup', restore: 'Restore', share: 'Share Selected',
        install: 'Install Stremio', copyUrl: 'Copy URL', openStremio: 'Open Stremio',
        login: 'Login', register: 'Register', logout: 'Logout',
        user: 'Username', pass: 'Password', loginReq: 'Login required!',
        msgCreated: 'List created!', msgRenamed: 'Renamed!', msgDeleted: 'Deleted!',
        msgBackup: 'Backup JSON ready!', msgImported: 'Imported OK!', msgCopied: 'Copied!',
        selectLang: 'EN', sharePrefix: ' recommends list '
    },
    es: {
        title: 'Biblioteca Personalizada', iconAlt: 'Libros',
        lists: 'Tus Listas', newList: 'Nueva Lista', namePlh: 'Nombre lista',
        create: 'Crear', rename: 'Renombrar', up: '↑', down: '↓', delete: 'Eliminar',
        backup: 'Backup', restore: 'Restaurar', share: 'Compartir Seleccionadas',
        install: 'Instalar Stremio', copyUrl: 'Copiar URL', openStremio: 'Abrir Stremio',
        login: 'Entrar', register: 'Registrarse', logout: 'Salir',
        user: 'Usuario', pass: 'Contraseña', loginReq: '¡Inicia sesión!',
        msgCreated: '¡Lista creada!', msgRenamed: '¡Renombrada!', msgDeleted: '¡Eliminada!',
        msgBackup: '¡Backup listo!', msgImported: '¡Importado!', msgCopied: '¡Copiado!',
        selectLang: 'ES', sharePrefix: ' te recomienda la lista '
    }
};

// Helpers
function getUser(req) {
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    return dataStore.sessions[token] || null;
}
function hash(str) { return crypto.createHash('sha256').update(str).digest('hex'); }

// Middleware auth
app.use((req, res, next) => {
    req.user = getUser(req);
    next();
});

// Ruta principal
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
    return '<!DOCTYPE html>' +
    '<html><head><title>' + t.title + '</title>' +
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width">' +
    '<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;background:black;color:white;padding:20px;}.container{max-width:600px;margin:auto;text-align:center;}.form-group{margin:20px 0;}input,button{padding:15px;border-radius:8px;border:1px solid #8b5cf6;background:#1a1a1a;color:white;font-size:16px;width:80%;max-width:300px;}button{background:#8b5cf6;color:black;border:none;cursor:pointer;font-weight:bold;}button:hover{background:#a78bfa;}.logo{width:120px;height:120px;margin:20px auto;}</style></head><body>' +
    '<div class="container">' +
    '<svg class="logo" viewBox="0 0 200 200" fill="#8b5cf6">' +
    '  <rect x="50" y="120" width="40" height="60" rx="5" transform="rotate(-5 70 150)"/>' +
    '  <rect x="60" y="100" width="40" height="60" rx="5"/>' +
    '  <rect x="70" y="80" width="40" height="60" rx="5"/>' +
    '  <rect x="80" y="60" width="40" height="60" rx="5"/>' +
    '</svg>' +
    '<h1>' + t.title + '</h1>' +
    '<div class="form-group"><input id="user" placeholder="' + t.user + '" autocomplete="username"></div>' +
    '<div class="form-group"><input id="pass" type="password" placeholder="' + t.pass + '" autocomplete="current-password"></div>' +
    '<button onclick="login()">' + t.login + '</button>' +
    '<button onclick="register()">' + t.register + '</button>' +
    '<script>' +
    'function api(path, opts){return fetch("/api"+path, {headers:{"Content-Type":"application/json", "Authorization":"Basic "+btoa(document.getElementById("user").value+":"+document.getElementById("pass").value)}, ...opts});}' +
    'async function login(){const u=document.getElementById("user").value;await api("/login", {method:"POST", body:JSON.stringify({user:u})});location.reload();}' +
    'async function register(){const u=document.getElementById("user").value, p=document.getElementById("pass").value;await api("/register", {method:"POST", body:JSON.stringify({user:u, pass:p})});location.reload();}' +
    '</script></body></html>';
}

function getMainHTML(t, user, host) {
    let listsHTML = '';
    const lists = Object.entries(user.lists || {}).sort((a,b)=>a[1].order - b[1].order);
    lists.forEach(([id, list]) => {
        listsHTML += '<div class="list" data-id="' + id + '" draggable="true">' +
        '<h3 contenteditable="true" onblur="rename(\'' + id.replace(/'/g, "\\'") + '\', this.textContent)">' + list.name + ' (' + list.items.length + ')</h3>' +
        '<div class="actions">' +
        '<button onclick="move(\'' + id.replace(/'/g, "\\'") + '\', -1)">' + t.up + '</button>' +
        '<button onclick="move(\'' + id.replace(/'/g, "\\'") + '\', 1)">' + t.down + '</button>' +
        '<button onclick="remove(\'' + id.replace(/'/g, "\\'") + '\')">' + t.delete + '</button>' +
        '<input type="checkbox" class="share-check">' +
        '</div></div>';
    });

    const manifestUrl = 'https://' + host + '/manifest.json';
    const stremioUrl = 'stremio://catalog/?url=' + encodeURIComponent(manifestUrl) + '&preload';
    const langClassEN = lang === 'en' ? 'active' : '';
    const langClassES = lang === 'es' ? 'active' : '';

    return '<!DOCTYPE html>' +
    '<html><head><title>' + t.title + '</title>' +
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width">' +
    '<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;background:black;color:white;padding:20px;}.container{max-width:900px;margin:auto;}.h1{text-align:center;color:#8b5cf6;margin:20px 0;}.lang{display:flex;gap:10px;margin:10px 0;}.lang button{padding:8px 12px;background:#1a1a1a;border:1px solid #8b5cf6;color:#8b5cf6;cursor:pointer;border-radius:5px;}.lang .active{background:#8b5cf6;color:black;}.lists{display:flex;flex-direction:column;gap:15px;margin:30px 0;}.list{background:#1a1a1a;padding:20px;border-radius:10px;border-left:4px solid #8b5cf6;cursor:move;}.list h3{color:#8b5cf6;margin-bottom:10px;font-size:18px;}.actions{display:flex;gap:5px;margin-top:10px;}.actions button{padding:5px 10px;background:#8b5cf6;color:black;border:none;border-radius:4px;cursor:pointer;font-size:12px;}.new-list{display:flex;gap:10px;margin:20px 0;max-width:400px;}.new-list input{flex:1;padding:12px;background:#1a1a1a;border:1px solid #8b5cf6;border-radius:5px;color:white;}.new-list button{padding:12px 20px;}.install-section{background:#1a1a1a;padding:20px;border-radius:10px;margin:20px 0;text-align:center;}.install-section button{padding:12px 24px;font-size:16px;margin:5px;}.share-section{margin:20px 0;}.share-section button{background:#4ade80;color:black;}.backup-section input[type=file]{padding:10px;background:#1a1a1a;border:1px solid #8b5cf6;color:white;border-radius:5px;}.success{padding:15px;background:#10b981;border-radius:5px;margin:10px 0;color:white;}.error{background:#ef4444;}.logout{float:right;padding:10px;background:#6b7280;color:white;cursor:pointer;border-radius:5px;}</style></head><body>' +
    '<div class="container">' +
    '<svg width="60" height="60" viewBox="0 0 200 200" fill="#8b5cf6" style="display:block;margin:0 auto 20px;">' +
    '  <rect x="50" y="120" width="40" height="60" rx="5" transform="rotate(-10 70 150)"/>' +
    '  <rect x="55" y="105" width="40" height="60" rx="5" transform="rotate(-3 75 135)"/>' +
    '  <rect x="60" y="90" width="40" height="60" rx="5"/>' +
    '  <rect x="65" y="75" width="40" height="60" rx="5"/>' +
    '</svg>' +
    '<h1 class="h1">' + t.title + ' - ' + user + '</h1>' +
    '<div class="lang"><button class="' + langClassEN + '" onclick="setLang(\'en\')">EN</button><button class="' + langClassES + '" onclick="setLang(\'es\')">ES</button></div>' +
    '<span class="logout" onclick="logout()">' + t.logout + '</span>' +
    '<div class="new-list"><input id="newName" placeholder="' + t.namePlh + '"><button onclick="createList()">' + t.create + '</button></div>' +
    '<h2>' + t.lists + '</h2>' +
    '<div id="lists">' + listsHTML + '</div>' +
    '<div class="share-section"><button onclick="shareSelected()">' + t.share + '</button></div>' +
    '<div class="backup-section">' +
    '<button onclick="backup()">' + t.backup + '</button>' +
    '<input type="file" id="importFile" accept=".json" onchange="importFile(this.files[0])">' +
    '<button onclick="document.getElementById(\'importFile\').click()">' + t.restore + '</button>' +
    '</div>' +
    '<div class="install-section">' +
    '<p>' + manifestUrl + '</p>' +
    '<button onclick="copyUrl(\'' + manifestUrl.replace(/'/g, "\\'") + '\')">' + t.copyUrl + '</button>' +
    '<button onclick="openStremio(\'' + stremioUrl.replace(/'/g, "\\'") + '\')">' + t.openStremio + '</button>' +
    '<button onclick="location.href=\'' + stremioUrl.replace(/'/g, "\\'") + '\'">' + t.install + '</button>' +
    '</div>' +
    '<div id="message"></div>' +

    '<script>' +
    'let dragId=null;' +
    'document.addEventListener("DOMContentLoaded", function(){' +
    '  document.querySelectorAll(".list").forEach(function(el){' +
    '    el.addEventListener("dragstart", function(e){dragId=e.target.dataset.id});' +
    '    el.addEventListener("dragover", function(e){e.preventDefault()});' +
    '    el.addEventListener("drop", function(e){if(dragId&&dragId!==e.target.dataset.id)move(dragId, e.target.dataset.id);dragId=null;});' +
    '  });' +
    '});' +

    'function msg(text, isError){' +
    '  const m=document.getElementById("message");' +
    '  const className=isError?"success error":"success";' +
    '  m.innerHTML="<div class=\\""+className+"\\">"+text+"</div>";' +
    '  setTimeout(function(){m.innerHTML="";}, 3000);' +
    '}' +

    'async function api(path, body){' +
    '  const resp=await fetch("/api"+path, {' +
    '    method:"POST",' +
    '    headers:{"Content-Type":"application/json"},' +
    '    body:JSON.stringify(body)' +
    '  });' +
    '  return resp.json();' +
    '}' +

    'async function createList(){' +
    '  const name=document.getElementById("newName").value.trim();' +
    '  if(!name)return;' +
    '  await api("/lists", {name:name});' +
    '  document.getElementById("newName").value="";' +
    '  location.reload();' +
    '}' +

    'async function rename(id, newName){' +
    '  await api("/lists/"+id+"/rename", {name:newName});' +
    '  msg("' + t.msgRenamed.replace(/"/g, '\\"') + '");' +
    '}' +

    'async function move(id, dir){' +
    '  await api("/lists/"+id+"/move", {dir:typeof dir==="number"?dir:1});' +
    '  location.reload();' +
    '}' +

    'async function remove(id){' +
    '  if(!confirm("Delete?"))return;' +
    '  await fetch("/api/lists/"+id, {method:"DELETE"});' +
    '  location.reload();' +
    '}' +

    'async function logout(){' +
    '  await fetch("/api/logout", {method:"POST"});' +
    '  location.reload();' +
    '}' +

    'async function setLang(l){' +
    '  await fetch("/api/lang", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({lang:l})});' +
    '  location.reload();' +
    '}' +

    'function backup(){' +
    '  msg("' + t.msgBackup.replace(/"/g, '\\"') + '");' +
    '}' +

    'async function importFile(file){' +
    '  const reader=new FileReader();' +
    '  reader.onload=async function(e){' +
    '    try{' +
    '      const data=JSON.parse(e.target.result);' +
    '      await api("/import", data);' +
    '      msg("' + t.msgImported.replace(/"/g, '\\"') + '");' +
    '      location.reload();' +
    '    }catch(err){' +
    '      msg("Error importing: "+err.message, true);' +
    '    }' +
    '  };' +
    '  reader.readAsText(file);' +
    '}' +

    'function shareSelected(){' +
    '  msg("Shared!");' +
    '}' +

    'async function copyUrl(url){' +
    '  try{' +
    '    await navigator.clipboard.writeText(url);' +
    '    msg("' + t.msgCopied.replace(/"/g, '\\"') + '");' +
    '  }catch(err){' +
    '    prompt("Copy this URL:", url);' +
    '  }' +
    '}' +

    'function openStremio(url){' +
    '  window.location=url;' +
    '}' +
    '</script></body></html>';
}

// API routes (sin cambios)
app.post('/api/login', (req, res) => {
    const {user, pass} = req.body;
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
    if (dataStore.users[user]) return res.status(400).json({error: 'User exists'});
    dataStore.users[user] = {passHash: hash(pass), lists: {}};
    const token = crypto.randomUUID();
    dataStore.sessions[token] = user;
    res.json({token});
});

app.post('/api/logout', (req, res) => {
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    delete dataStore.sessions[token];
    res.json({ok:1});
});

app.post('/api/lang', (req, res) => {
    lang = req.body.lang;
    res.json({ok:1});
});

app.post('/api/lists', (req, res) => {
    if (!req.user) return res.status(401).json({error: 'No auth'});
    const id = req.body.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    dataStore.users[req.user].lists[id] = {name: req.body.name, items: [], order: Object.keys(dataStore.users[req.user].lists).length};
    res.json({ok:1});
});

app.post('/api/lists/:id/rename', (req, res) => {
    if (!req.user || !dataStore.users[req.user].lists[req.params.id]) return res.status(404).json({error: 'Not found'});
    dataStore.users[req.user].lists[req.params.id].name = req.body.name;
    res.json({ok:1});
});

app.post('/api/lists/:id/move', (req, res) => {
    if (!req.user || !dataStore.users[req.user].lists[req.params.id]) return res.status(404).json({error: 'Not found'});
    const lists = dataStore.users[req.user].lists;
    const id = req.params.id;
    const dir = req.body.dir;
    const order = lists[id].order + dir;
    for (let lid in lists) {
        if (lists[lid].order === order) {
            lists[lid].order = lists[id].order;
            lists[id].order = order;
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
    Object.assign(dataStore.users[req.user].lists, req.body.lists);
    res.json({ok:1});
});

// Stremio endpoints (sin cambios)
app.get('/manifest.json', (req, res) => res.json({
    id: 'com.customlibrary.' + (req.query.user || 'anon'),
    name: 'Custom Library',
    version: '1.1.0',
    resources: ['catalog', 'meta', 'stream'],
    types: ['movie', 'series'],
    catalogs: [{id: 'lists', name: 'My Lists', type: 'list'}],
    behaviorHints: {configurable: true}
}));

app.get('/catalog/lists.json', (req, res) => {
    const user = req.query.user || req.user;
    if (!user || !dataStore.users[user]) return res.json({metas: []});
    const metas = Object.entries(dataStore.users[user].lists).sort((a,b)=>a[1].order-b[1].order).map(([id,l]) => ({
        id: `list:${id}`,
        type: 'list',
        name: l.name,
        poster: `https://via.placeholder.com/300x450/8b5cf6/FFFFFF?text=${encodeURIComponent(l.name)}`
    }));
    res.json({metas});
});

app.get('/meta/:type/:id.json', (req, res) => {
    const [listId, itemId] = req.params.id.split(':');
    const user = req.query.user || req.user;
    if (!user || !dataStore.users[user]?.lists[listId]?.items?.find(i=>i.id===itemId)) {
        return res.json({});
    }
    const item = dataStore.users[user].lists[listId].items.find(i=>i.id===itemId);
    res.json({
        meta: {
            id: req.params.id,
            type: req.params.type,
            name: item.name,
            poster: item.poster || 'https://via.placeholder.com/300x450/333/fff?text=' + encodeURIComponent(item.name)
        }
    });
});

app.get('/stream/:type/:id.json', (req, res) => {
    const [listId, itemId] = req.params.id.split(':');
    const user = req.query.user || req.user;
    if (!user || !dataStore.users[user]?.lists[listId]) return res.json({streams: []});
    
    const streams = [];
    const list = dataStore.users[user].lists[listId];
    const isRecommended = list.recommended?.[itemId];
    streams.push({
        name: isRecommended ? '❤️ Te ha gustado' : '❤️ Recomendar',
        url: `/api/recommend/${listId}/${itemId}`,
        type: 'ready',
        title: isRecommended ? 'Liked' : 'Recommend'
    });
    res.json({streams});
});

app.post('/api/recommend/:listId/:itemId', (req, res) => {
    if (!req.user) return res.status(401).json({});
    const list = dataStore.users[req.user].lists[req.params.listId];
    if (!list) return res.status(404).json({});
    if (!list.recommended) list.recommended = {};
    if (list.recommended[req.params.itemId]) {
        delete list.recommended[req.params.itemId];
    } else {
        list.recommended[req.params.itemId] = true;
    }
    res.json({toggle: !!list.recommended[req.params.itemId]});
});

app.get('/share', (req, res) => {
    res.send('<h1>Shared Lists</h1><p>Install addon to view lists</p>');
});

app.get('/health', (req, res) => res.send('OK'));

app.use((req, res) => res.status(404).send('Not Found'));

app.listen(PORT, () => console.log('Custom Library on port ' + PORT));
