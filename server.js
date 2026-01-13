const { addonBuilder } = require('stremio-addon-sdk');
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 7000;

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Config manifest
const manifest = {
    id: 'com.mario9724.customlibrary',
    version: '1.0.0',
    name: 'Custom Library',
    description: 'Stremio Addon para crear listas dentro de la biblioteca',
    resources: ['catalog', 'meta'],
    types: ['movie', 'series'],
    catalogs: [{ id: 'custom-lists', name: 'Mis Listas', type: 'list' }],
    idPrefixes: ['tt', 'kodi', 'custom']
};

const builder = new addonBuilder(manifest);

// Datos listas
let customLists = {
    favoritos: { name: 'Favoritos', items: [], description: 'Favoritos' },
    vistos: { name: 'Vistos', items: [], description: 'Vistos' }
};

// Handlers Stremio
builder.defineCatalogHandler((args) => {
    const metas = Object.entries(customLists).map(([id, list]) => ({
        id: `list:${id}`,
        type: 'list',
        name: list.name,
        description: list.description,
        poster: `https://via.placeholder.com/300x450/FF6B6B/FFFFFF?text=${list.name}`,
        badge: `vods:${list.items.length}`
    }));
    return Promise.resolve({ metas });
});

builder.defineMetaHandler((args) => {
    if (args.id.startsWith('list:')) {
        const listId = args.id.replace('list:', '');
        const list = customLists[listId];
        if (list) return Promise.resolve({
            meta: {
                id: args.id,
                name: list.name,
                type: 'list',
                description: list.description,
                poster: `https://via.placeholder.com/300x450/4ECDC4/FFFFFF?text=${list.name}`
            }
        });
    }
    return Promise.resolve({ meta: null });
});

// Ruta web principal
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Custom Library</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;background:#1a1a1a;color:white;padding:20px;}.container{max-width:800px;margin:0 auto;}h1{text-align:center;margin-bottom:30px;color:#00d4ff;}.list{background:#2a2a2a;margin:15px 0;padding:20px;border-radius:10px;}.list h3{color:#00d4ff;margin-bottom:10px;}.list-items{display:flex;flex-wrap:wrap;gap:10px;}.item{background:#3a3a3a;padding:10px;border-radius:5px;cursor:pointer;}.success{background:#28a745;color:white;padding:15px;border-radius:5px;margin:10px 0;}.error{background:#dc3545;color:white;padding:15px;border-radius:5px;margin:10px 0;}button{background:#00d4ff;color:black;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;margin:5px;}button:hover{background:#00b8d4;}input{padding:10px;border-radius:5px;border:1px solid #444;background:#3a3a3a;color:white;margin:5px;}</style>
</head>
<body>
    <div class="container">
        <h1>🗂️ Custom Library</h1>
        <div id="message"></div>
        <h2>📋 Tus Listas</h2>
        <div id="lists"></div>
        <h2>➕ Nueva Lista</h2>
        <input type="text" id="newListName" placeholder="Nombre de la nueva lista">
        <button onclick="createList()">Crear Lista</button>
    </div>
    <script>
        let lists = ${JSON.stringify(customLists)};
        function showMessage(msg,type='success'){document.getElementById('message').innerHTML=\`<div class="\${type}">\${msg}</div>\`;setTimeout(()=>document.getElementById('message').innerHTML='',3000);}
        function loadLists(){fetch('/api/lists').then(r=>r.json()).then(data=>{lists=data;document.getElementById('lists').innerHTML=Object.entries(lists).map(([id,list])=>`<div class="list"><h3>${list.name} (${list.items.length} items)</h3><div class="list-items">${list.items.map(item=>`<div class="item">${item.name||item.id}</div>`).join('')}</div><button onclick="addItem('${id}')">Añadir Item</button><button onclick="deleteList('${id}')">Eliminar</button></div>`).join('');});}
        function createList(){const name=document.getElementById('newListName').value;if(!name)return showMessage('Nombre requerido','error');fetch('/api/lists',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})}).then(()=>{document.getElementById('newListName').value='';loadLists();showMessage('Lista creada!');});}
        function addItem(listId){const name=prompt('Nombre del item:');if(name)fetch(\`/api/lists/\${listId}/items\`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})}).then(()=>{loadLists();showMessage('Item añadido!');});}
        function deleteList(listId){if(confirm('¿Eliminar?'))fetch(\`/api/lists/\${listId}\`,{method:'DELETE'}).then(()=>{loadLists();showMessage('Eliminada!');});}
        loadLists();
    </script>
</body>
</html>`);
});

// API
app.get('/api/lists', (req, res) => res.json(customLists));
app.post('/api/lists', express.json(), (req, res) => {
    const { name } = req.body;
    const id = name.toLowerCase().replace(/\s+/g, '-');
    customLists[id] = { name, items: [], description: `Lista ${name}` };
    res.json({ success: true, id });
});
app.post('/api/lists/:listId/items', express.json(), (req, res) => {
    const { listId } = req.params;
    const { name } = req.body;
    if (customLists[listId]) {
        customLists[listId].items.push({ id: Date.now().toString(), name, added: new Date().toISOString() });
        res.json({ success: true });
    } else res.status(404).json({ error: 'No encontrada' });
});
app.delete('/api/lists/:listId', (req, res) => {
    const { listId } = req.params;
    delete customLists[listId];
    res.json({ success: true });
});

// Stremio routes manuales (FIX del error)
app.get('/manifest.json', (req, res) => res.json(manifest));
app.get('/catalog/:extra.json', (req, res) => {
    const metas = Object.entries(customLists).map(([id, list]) => ({
        id: `list:${id}`, type: 'list', name: list.name, description: list.description,
        poster: `https://via.placeholder.com/300x450/FF6B6B/FFFFFF?text=${list.name}`
    }));
    res.json({ metas });
});
app.get('/manifest', (req, res) => res.json(manifest));

// Health
app.get('/health', (req, res) => res.status(200).send('OK'));

// 404
app.use((req, res) => res.status(404).send('<div style="background:#1a1a1a;color:white;padding:50px;text-align:center;"><h1>404</h1><a href="/" style="color:#00d4ff;">Custom Library</a></div>'));

// Start
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Custom Library en puerto ${PORT}`);
});
