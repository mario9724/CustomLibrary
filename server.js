const express = require('express');
const crypto = require('crypto');
const PORT = process.env.PORT || 10000;

const app = express();
app.use(express.json({limit: '10mb'}));
app.use(express.urlencoded({extended: true, limit: '10mb'}));
app.use(express.static('public'));

let dataStore = {users: {}, sessions: {}, lists: {}, currentList: {}};

const i18n = {
  es: {
    welcome: 'Bienvenido',
    createList: 'Crear Lista',
    myLists: 'Mis Listas',
    addItem: 'Añadir Item',
    username: 'Usuario',
    password: 'Contraseña',
    login: 'Iniciar Sesión',
    logout: 'Cerrar Sesión',
    editUsername: 'Editar Usuario',
    language: 'Idioma',
    export: 'Exportar',
    import: 'Importar',
    delete: 'Eliminar',
    selectList: 'Selecciona una lista',
    items: 'items',
    noLists: 'Sin listas aún',
    listCreated: 'Lista creada ✅',
    itemAdded: 'Item añadido ✅',
    itemDeleted: 'Item eliminado ✅',
    installStremio: 'Instalar en Stremio',
    copyUrl: 'Copiar URL',
    description: 'Crea y gestiona tus listas personalizadas para Stremio'
  },
  en: {
    welcome: 'Welcome',
    createList: 'Create List',
    myLists: 'My Lists',
    addItem: 'Add Item',
    username: 'Username',
    password: 'Password',
    login: 'Sign In',
    logout: 'Sign Out',
    editUsername: 'Edit Username',
    language: 'Language',
    export: 'Export',
    import: 'Import',
    delete: 'Delete',
    selectList: 'Select a list',
    items: 'items',
    noLists: 'No lists yet',
    listCreated: 'List created ✅',
    itemAdded: 'Item added ✅',
    itemDeleted: 'Item deleted ✅',
    installStremio: 'Install in Stremio',
    copyUrl: 'Copy URL',
    description: 'Create and manage your custom lists for Stremio'
  }
};

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
    version: '2.0.0',
    name: 'Custom Library',
    description: 'Create and manage your custom lists',
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
      name: 'Item ' + id,
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
  const username = req.user.username;
  const currentListId = dataStore.currentList[username];

  if (!currentListId) {
    return res.json({ streams: [] });
  }

  const list = dataStore.lists[username]?.[currentListId];
  if (!list) {
    return res.json({ streams: [] });
  }

  res.json({ 
    streams: [{
      title: '📚 Añadir a Mi Lista',
      url: 'javascript:addToMyList("' + req.params.id + '", "' + req.params.type + '")',
      behavioral: { autoPlay: false, playerFocus: false }
    }]
  });
});

app.post('/api/auth/changeuser', (req, res) => {
  const { newUsername, password } = req.body;

  if (!newUsername || !password) {
    return res.status(400).json({error: 'Usuario y contraseña requeridos'});
  }

  if (!dataStore.users[newUsername]) {
    dataStore.users[newUsername] = {
      username: newUsername,
      createdAt: new Date()
    };
  }

  const sessionId = crypto.randomBytes(16).toString('hex');
  dataStore.sessions[sessionId] = {username: newUsername, createdAt: new Date()};

  res.setHeader('Set-Cookie', [
    'user=' + newUsername + '; Path=/; Max-Age=2592000',
    'session=' + sessionId + '; Path=/; Max-Age=2592000'
  ]);

  res.json({
    success: true,
    username: newUsername,
    sessionId
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({error: 'Usuario y contraseña requeridos'});
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
    'user=' + username + '; Path=/; Max-Age=2592000',
    'session=' + sessionId + '; Path=/; Max-Age=2592000'
  ]);

  res.json({
    success: true,
    username,
    sessionId
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

  dataStore.currentList[username] = listId;

  res.json({
    success: true,
    listId,
    message: 'Lista creada'
  });
});

app.post('/api/lists/:listId/add', (req, res) => {
  const { listId } = req.params;
  const { id, name, type, poster } = req.body;
  const username = req.user.username;

  const list = dataStore.lists[username]?.[listId];
  if (!list) {
    return res.status(404).json({error: 'Lista no encontrada'});
  }

  if (list.metas.some(m => m.id === id)) {
    return res.status(400).json({error: 'Item ya existe'});
  }

  list.metas.push({
    id: id || 'custom_' + Date.now(),
    name: name || 'Sin título',
    type: type || 'movie',
    poster: poster || 'https://via.placeholder.com/342x513?text=' + encodeURIComponent(name)
  });

  res.json({
    success: true,
    message: 'Item añadido',
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

app.delete('/api/lists/:listId', (req, res) => {
  const { listId } = req.params;
  const username = req.user.username;

  if (!dataStore.lists[username]?.[listId]) {
    return res.status(404).json({error: 'Lista no encontrada'});
  }

  delete dataStore.lists[username][listId];

  if (dataStore.currentList[username] === listId) {
    dataStore.currentList[username] = null;
  }

  res.json({
    success: true,
    message: 'Lista eliminada'
  });
});

app.delete('/api/lists/:listId/item/:itemId', (req, res) => {
  const { listId, itemId } = req.params;
  const username = req.user.username;

  const list = dataStore.lists[username]?.[listId];
  if (!list) {
    return res.status(404).json({error: 'Lista no encontrada'});
  }

  list.metas = list.metas.filter(m => m.id !== itemId);

  res.json({
    success: true,
    message: 'Item eliminado'
  });
});

app.get('/api/lists/:listId/export', (req, res) => {
  const { listId } = req.params;
  const username = req.user.username;
  const list = dataStore.lists[username]?.[listId];

  if (!list) {
    return res.status(404).json({error: 'Lista no encontrada'});
  }

  res.setHeader('Content-Disposition', 'attachment; filename="' + list.name + '.json"');
  res.setHeader('Content-Type', 'application/json');
  res.json(list);
});

app.post('/api/lists/import', (req, res) => {
  const username = req.user.username;
  const { list } = req.body;

  if (username === 'anon') {
    return res.status(401).json({error: 'Debes iniciar sesión'});
  }

  if (!list || !list.name) {
    return res.status(400).json({error: 'Lista inválida'});
  }

  if (!dataStore.lists[username]) {
    dataStore.lists[username] = {};
  }

  const listId = list.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();

  dataStore.lists[username][listId] = {
    ...list,
    id: listId,
    owner: username,
    createdAt: new Date()
  };

  res.json({
    success: true,
    listId,
    message: 'Lista importada'
  });
});

app.get('/', (req, res) => {
  const isLoggedIn = req.user.username !== 'anon';

  res.send('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Custom Library</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0e27;color:#fff;min-height:100vh}.container{max-width:1200px;margin:0 auto;padding:20px}header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px 20px;text-align:center;border-radius:10px;margin-bottom:30px}.header-bottom{display:flex;justify-content:space-between;align-items:center;margin-top:20px}h1{font-size:2.5em;margin-bottom:10px}.user-bar{display:flex;justify-content:space-between;align-items:center;margin-bottom:30px;padding:15px;background:#1a1f3a;border-radius:8px;flex-wrap:wrap;gap:10px}.user-info{display:flex;align-items:center;gap:15px;flex-wrap:wrap}.btn{display:inline-block;padding:12px 24px;background:#667eea;color:white;text-decoration:none;border-radius:5px;border:none;cursor:pointer;font-size:1em;transition:all .3s}.btn:hover{background:#764ba2;transform:translateY(-2px)}.btn-small{padding:8px 16px;font-size:.9em}.btn-danger{background:#e74c3c}.btn-danger:hover{background:#c0392b}.btn-success{background:#27ae60}.btn-success:hover{background:#229954}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(350px,1fr));gap:20px}.card{background:#1a1f3a;padding:20px;border-radius:10px;border-left:4px solid #667eea}.card h3{color:#667eea;margin-bottom:15px}input,textarea,select{width:100%;padding:10px;margin:8px 0;background:#2a2f4a;color:white;border:1px solid #444;border-radius:5px;font-family:inherit}input:focus,textarea:focus,select:focus{outline:none;border-color:#667eea;box-shadow:0 0 10px rgba(102,126,234,.3)}.list-item{background:#2a2f4a;padding:12px;border-radius:5px;margin:10px 0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}.list-item-actions{display:flex;gap:5px}.manifest-box{background:#2a2f4a;padding:20px;border-radius:10px;border:2px dashed #667eea;text-align:center;margin-bottom:30px}.manifest-box code{background:#0a0e27;padding:10px;border-radius:5px;display:block;word-break:break-all;margin:10px 0;font-family:monospace;font-size:.85em}.copy-btn{cursor:pointer;font-size:.9em;color:#667eea}.hidden{display:none}.modal{display:none;position:fixed;z-index:1;left:0;top:0;width:100%;height:100%;background-color:rgba(0,0,0,.7)}.modal-content{background:#1a1f3a;margin:50px auto;padding:20px;border-radius:10px;max-width:400px}.close{color:#aaa;float:right;font-size:28px;cursor:pointer}.close:hover{color:white}.item-list{max-height:300px;overflow-y:auto;margin-top:10px}.item-card{background:#2a2f4a;padding:10px;border-radius:5px;margin:8px 0;display:flex;justify-content:space-between;align-items:center}@media(max-width:768px){.grid{grid-template-columns:1fr}.header-bottom{flex-direction:column}.user-info{flex-direction:column;width:100%}}</style></head><body><div class="container"><header><h1>📚 Custom Library</h1><p id="description">Crea y gestiona tus listas personalizadas para Stremio</p><div class="header-bottom"><select id="langSelect" onchange="changeLanguage(this.value)"><option value="es">🇪🇸 Español</option><option value="en">🇺🇸 English</option></select></div></header><div class="user-bar"><div class="user-info" id="userInfo">' + (isLoggedIn ? '<div>👤 <strong id="userDisplay">' + req.user.username + '</strong></div><button class="btn btn-small" onclick="openEditUser()">✏️ Editar Usuario</button><button class="btn btn-small btn-danger" onclick="logout()">Logout</button>' : '<div>👤 <strong>Anónimo</strong></div><button class="btn btn-small" onclick="openLoginModal()">Iniciar Sesión</button>') + '</div></div><div class="manifest-box"><h2 id="installTitle">🔗 Instalar en Stremio</h2><p id="installText">Copia esta URL en Addons → Instalar desde URL:</p><code id="manifest-url">https://customlibrary.onrender.com/manifest.json</code><button class="copy-btn" onclick="copyManifest()">📋 Copiar URL</button></div>' + (isLoggedIn ? '<div class="grid"><div class="card"><h3 id="createListTitle">➕ Nueva Lista</h3><input type="text" id="listName" placeholder="Nombre de lista"><select id="listType"><option value="movie">🎬 Película</option><option value="series">📺 Serie</option><option value="sports">⚽ Deporte</option></select><textarea id="listDesc" placeholder="Descripción (opcional)" style="resize:vertical;min-height:60px;"></textarea><button class="btn" onclick="createList()" id="createBtn">Crear Lista</button></div><div class="card"><h3 id="myListsTitle">📋 Mis Listas</h3><div id="listContainer" style="max-height:400px;overflow-y:auto;"><p style="opacity:.6;">Cargando listas...</p></div></div></div><div class="card" style="margin-top:20px;"><h3 id="addItemTitle">➕ Añadir Item a Lista</h3><select id="selectList" style="width:100%;margin-bottom:10px;" onchange="loadListItems()"><option value="">Selecciona una lista...</option></select><div id="itemsPreview" class="item-list hidden"></div><input type="text" id="itemId" placeholder="ID (ej: tt0111161)"><input type="text" id="itemName" placeholder="Título"><input type="text" id="itemPoster" placeholder="URL de poster (opcional)"><button class="btn" onclick="addItem()" id="addBtn">Añadir Item</button><div style="margin-top:15px;"><button class="btn btn-success btn-small" onclick="exportList()" id="exportBtn">📤 Exportar</button> <button class="btn btn-success btn-small" onclick="importList()" id="importBtn">📥 Importar</button></div><input type="file" id="importFile" accept=".json" style="display:none;" onchange="handleImport(event)"></div>' : '') + '</div><div id="loginModal" class="modal"><div class="modal-content"><span class="close" onclick="closeLoginModal()">&times;</span><h2>Iniciar Sesión</h2><input type="text" id="loginUsername" placeholder="Usuario" style="margin-top:15px;"><input type="password" id="loginPassword" placeholder="Contraseña"><button class="btn" style="width:100%;margin-top:15px;" onclick="login()">Iniciar Sesión</button></div></div><div id="editUserModal" class="modal"><div class="modal-content"><span class="close" onclick="closeEditUserModal()">&times;</span><h2>Cambiar Usuario</h2><input type="text" id="newUsername" placeholder="Nuevo usuario" style="margin-top:15px;"><input type="password" id="changePassword" placeholder="Contraseña"><button class="btn" style="width:100%;margin-top:15px;" onclick="changeUser()">Cambiar</button></div></div><script>let lang=localStorage.getItem("lang")||"es";const translations=' + JSON.stringify(i18n) + ';function t(key){return translations[lang]?.[key]||key}function changeLanguage(newLang){lang=newLang;localStorage.setItem("lang",lang);location.reload()}function updateUI(){document.getElementById("description").textContent=t("description");document.getElementById("installTitle").textContent="🔗 "+t("installStremio");document.getElementById("installText").textContent=t("copyUrl");document.getElementById("createListTitle").textContent="➕ "+t("createList");document.getElementById("myListsTitle").textContent="📋 "+t("myLists");document.getElementById("addItemTitle").textContent="➕ "+t("addItem");if(document.getElementById("selectList"))document.getElementById("selectList").options[0].textContent=t("selectList");if(document.getElementById("createBtn"))document.getElementById("createBtn").textContent=t("createList");if(document.getElementById("addBtn"))document.getElementById("addBtn").textContent=t("addItem");if(document.getElementById("exportBtn"))document.getElementById("exportBtn").textContent="📤 "+t("export");if(document.getElementById("importBtn"))document.getElementById("importBtn").textContent="📥 "+t("import")}function copyManifest(){const url=document.getElementById("manifest-url").textContent;navigator.clipboard.writeText(url);alert(lang==="es"?"¡URL copiada!":"URL copied!")}function logout(){document.cookie="user=; Max-Age=0";document.cookie="session=; Max-Age=0";location.reload()}function openLoginModal(){document.getElementById("loginModal").style.display="block"}function closeLoginModal(){document.getElementById("loginModal").style.display="none"}function openEditUser(){document.getElementById("editUserModal").style.display="block"}function closeEditUserModal(){document.getElementById("editUserModal").style.display="none"}function login(){const username=document.getElementById("loginUsername").value;const password=document.getElementById("loginPassword").value;if(!username||!password)return alert(lang==="es"?"Rellena ambos campos":"Fill both fields");fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})}).then(r=>r.json()).then(d=>{if(d.success)location.reload()})}function changeUser(){const newUsername=document.getElementById("newUsername").value;const password=document.getElementById("changePassword").value;if(!newUsername||!password)return alert(lang==="es"?"Rellena ambos campos":"Fill both fields");fetch("/api/auth/changeuser",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({newUsername,password})}).then(r=>r.json()).then(d=>{if(d.success)location.reload()})}function createList(){const name=document.getElementById("listName").value;const type=document.getElementById("listType").value;const desc=document.getElementById("listDesc").value;if(!name)return alert(lang==="es"?"Nombre requerido":"Name required");fetch("/api/lists/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({listName:name,type,description:desc})}).then(r=>r.json()).then(d=>{if(d.success){alert(d.message);loadLists();document.getElementById("listName").value="";document.getElementById("listDesc").value=""}})}function loadLists(){fetch("/api/lists").then(r=>r.json()).then(d=>{const html=d.lists.length>0?d.lists.map(l=>"<div class=\"list-item\"><div><strong>"+l.name+"</strong> <span style=\"opacity:.6;\">("+l.type+", "+l.metas.length+" "+t("items")+")</span></div><div class=\"list-item-actions\"><button class=\"btn btn-small btn-success\" onclick=\"setCurrentList(\""+l.id+"\")\">✓ Usar</button><button class=\"btn btn-small btn-danger\" onclick=\"deleteList(\""+l.id+"\")\" style=\"margin-left:5px;\">🗑️ "+t("delete")+"</button></div></div>").join(""):"<p style=\"opacity:.6;\">"+t("noLists")+"</p>";document.getElementById("listContainer").innerHTML=html;const selectHtml="<option value=\"\">"+t("selectList")+"</option>"+d.lists.map(l=>"<option value=\""+l.id+"\">"+l.name+"</option>").join("");document.getElementById("selectList").innerHTML=selectHtml})}function setCurrentList(listId){document.getElementById("selectList").value=listId;loadListItems()}function loadListItems(){const listId=document.getElementById("selectList").value;if(!listId){document.getElementById("itemsPreview").classList.add("hidden");return}fetch("/api/lists").then(r=>r.json()).then(d=>{const list=d.lists.find(l=>l.id===listId);if(list&&list.metas.length>0){const html="<h4>"+t("items")+":</h4>"+list.metas.map(m=>"<div class=\"item-card\"><span>"+m.name+"</span><button class=\"btn btn-small btn-danger\" onclick=\"deleteItem(\""+listId+"\", \""+m.id+"\")\">🗑️</button></div>").join("");document.getElementById("itemsPreview").innerHTML=html;document.getElementById("itemsPreview").classList.remove("hidden")}else{document.getElementById("itemsPreview").classList.add("hidden")}})}function deleteList(listId){if(!confirm(lang==="es"?"¿Eliminar esta lista?":"Delete this list?"))return;fetch("/api/lists/"+listId,{method:"DELETE"}).then(r=>r.json()).then(d=>{if(d.success){loadLists();document.getElementById("selectList").value="";document.getElementById("itemsPreview").classList.add("hidden")}})}function deleteItem(listId,itemId){fetch("/api/lists/"+listId+"/item/"+itemId,{method:"DELETE"}).then(r=>r.json()).then(d=>{if(d.success){loadLists();loadListItems()}})}function addItem(){const listId=document.getElementById("selectList").value;const id=document.getElementById("itemId").value;const name=document.getElementById("itemName").value;const poster=document.getElementById("itemPoster").value;if(!listId||!id||!name)return alert(lang==="es"?"Rellena los campos requeridos":"Fill required fields");fetch("/api/lists/"+listId+"/add",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,name,type:"movie",poster})}).then(r=>r.json()).then(d=>{if(d.success){alert(d.message);document.getElementById("itemId").value="";document.getElementById("itemName").value="";document.getElementById("itemPoster").value="";loadLists();loadListItems()}else{alert(d.error)}})}function exportList(){const listId=document.getElementById("selectList").value;if(!listId)return alert(lang==="es"?"Selecciona una lista":"Select a list");window.location.href="/api/lists/"+listId+"/export"}function importList(){document.getElementById("importFile").click()}function handleImport(event){const file=event.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=e=>{try{const list=JSON.parse(e.target.result);fetch("/api/lists/import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({list})}).then(r=>r.json()).then(d=>{if(d.success){alert(d.message);loadLists()}})}catch(err){alert(lang==="es"?"Archivo JSON inválido":"Invalid JSON file")}};reader.readAsText(file)}updateUI();loadLists();</script></body></html>');
});

app.listen(PORT, () => {
  console.log("✅ Custom Library corriendo en puerto " + PORT);
  console.log("http://localhost:" + PORT);
  console.log("Manifest: http://localhost:" + PORT + "/manifest.json");
});