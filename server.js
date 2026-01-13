const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 7000;

app.use(express.static('public'));
app.use(express.json());

let customLists = {
    favoritos: { name: 'Favoritos', items: [], description: 'Tus favoritos' },
    vistos: { name: 'Vistos', items: [], description: 'Ya vistos' }
};

// Ruta principal - HTML simple con JS básico
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Custom Library</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<style>
* {margin:0;padding:0;box-sizing:border-box;}
body {font-family:Arial,sans-serif;background:#1a1a1a;color:white;padding:20px;}
.container {max-width:800px;margin:0 auto;}
h1 {text-align:center;margin-bottom:30px;color:#00d4ff;}
.list {background:#2a2a2a;margin:15px 0;padding:20px;border-radius:10px;}
.list h3 {color:#00d4ff;margin-bottom:10px;}
.list-items {display:flex;flex-wrap:wrap;gap:10px;}
.item {background:#3a3a3a;padding:10px;border-radius:5px;}
.success {background:#28a745;color:white;padding:15px;border-radius:5px;margin:10px 0;}
button {background:#00d4ff;color:black;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;margin:5px;}
button:hover {background:#00b8d4;}
input {padding:10px;border-radius:5px;border:1px solid #444;background:#3a3a3a;color:white;}
</style>
</head>
<body>
<div class="container">
<h1>🗂️ Custom Library</h1>
<div id="message"></div>
<h2>📋 Tus Listas</h2>
<div id="listsContainer">
`);

    // Render listas en servidor (evita JS complejo)
    Object.entries(customLists).forEach(([id, list]) => {
        res.write(`
<div class="list" data-listid="${id}">
<h3>${list.name} (${list.items.length} items)</h3>
<div class="list-items">`);
        list.items.forEach(item => {
            res.write(`<div class="item">${item.name || item.id}</div>`);
        });
        res.write(`</div>
<input type="text" placeholder="Nuevo item" class="item-input">
<button onclick="addItem('${id}')">Añadir Item</button>
<button onclick="deleteList('${id}')">Eliminar Lista</button>
</div>
`);
    });

    res.end(`
</div>
<h2>➕ Nueva Lista</h2>
<input type="text" id="newListName" placeholder="Nombre lista">
<button onclick="createList()">Crear</button>
</div>

<script>
function showMessage(msg) {
    document.getElementById('message').innerHTML = '<div class="success">' + msg + '</div>';
    setTimeout(() => document.getElementById('message').innerHTML = '', 3000);
}

function createList() {
    const name = document.getElementById('newListName').value;
    if (!name) return;
    fetch('/api/lists', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name: name})
    }).then(r => r.json()).then(() => {
        document.getElementById('newListName').value = '';
        location.reload();
    });
}

function addItem(listId) {
    const input = document.querySelector('[data-listid="${listId}"] .item-input');
    const name = input.value;
    if (!name) return;
    fetch('/api/lists/' + listId + '/items', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name: name})
    }).then(() => {
        input.value = '';
        location.reload();
    });
}

function deleteList(listId) {
    if (confirm('¿Eliminar?')) {
        fetch('/api/lists/' + listId, {method: 'DELETE'}).then(() => {
            location.reload();
        });
    }
}
</script>
</body>
</html>`);
});

// API endpoints
app.get('/api/lists', (req, res) => res.json(customLists));

app.post('/api/lists', express.json(), (req, res) => {
    const { name } = req.body;
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    customLists[id] = { name, items: [], description: name };
    res.json({ success: true });
});

app.post('/api/lists/:listId/items', express.json(), (req, res) => {
    const { listId } = req.params;
    const { name } = req.body;
    if (customLists[listId]) {
        customLists[listId].items.push({
            id: Date.now().toString(),
            name
        });
        res.json({ success: true });
    } else {
        res.status(404).json({ error: true });
    }
});

app.delete('/api/lists/:listId', (req, res) => {
    const { listId } = req.params;
    delete customLists[listId];
    res.json({ success: true });
});

// Stremio
app.get('/manifest.json', (req, res) => {
    res.json({
        id: 'com.mario9724.customlibrary',
        version: '1.0.0',
        name: 'Custom Library',
        description: 'Listas personalizadas',
        resources: ['catalog', 'meta'],
        types: ['movie', 'series'],
        catalogs: [{ id: 'lists', name: 'Mis Listas', type: 'list' }],
        idPrefixes: ['list']
    });
});

app.get('/catalog/lists.json', (req, res) => {
    const metas = Object.entries(customLists).map(([id, list]) => ({
        id: `list:${id}`,
        type: 'list',
        name: list.name,
        description: list.description,
        poster: 'https://via.placeholder.com/300x450/4ECDC4/FFFFFF?text=LIST'
    }));
    res.json({ metas });
});

app.get('/meta/list/:listId.json', (req, res) => {
    const { listId } = req.params;
    const list = customLists[listId];
    if (list) {
        res.json({
            meta: {
                id: `list:${listId}`,
                name: list.name,
                type: 'list',
                description: list.description,
                poster: 'https://via.placeholder.com/300x450/FF6B6B/FFFFFF?text=' + list.name
            }
        });
    } else {
        res.status(404).json({});
    }
});

// Health
app.get('/health', (req, res) => res.send('OK'));

// 404
app.use((req, res) => res.status(404).send('404 - <a href="/">Home</a>'));

// Start
app.listen(PORT, '0.0.0.0', () => {
    console.log('Custom Library OK en puerto ' + PORT);
});
