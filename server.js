const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

let customLists = {
    favoritos: { name: 'Favoritos', items: [] },
    vistos: { name: 'Vistos', items: [] }
};

// Ruta principal web
app.get('/', (req, res) => {
    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>Custom Library</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial; background: #1a1a1a; color: white; margin: 0; padding: 20px; }
        .container { max-width: 800px; margin: auto; }
        h1 { text-align: center; color: #00d4ff; }
        .list-container { margin: 20px 0; }
        .list-header { background: #333; padding: 15px; border-radius: 8px; cursor: pointer; }
        .list-items { background: #222; padding: 10px; border-radius: 8px; display: none; }
        .list-item { padding: 10px; border-bottom: 1px solid #444; cursor: pointer; }
        .list-item:last-child { border-bottom: none; }
        .list-item:hover { background: #00d4ff; color: black; }
        input, button { padding: 10px; margin: 5px; border: none; border-radius: 4px; }
        button { background: #00d4ff; color: black; cursor: pointer; }
        button:hover { background: #00b8d4; }
        .add-list { text-align: center; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Custom Library</h1>
        <div class="add-list">
            <input type="text" id="newListName" placeholder="Nombre nueva lista">
            <button onclick="addList()">Nueva Lista</button>
        </div>
        <div id="lists"></div>
    </div>
    <script>
        function loadLists() {
            fetch('/lists')
                .then(r => r.json())
                .then(lists => {
                    const container = document.getElementById('lists');
                    container.innerHTML = '';
                    Object.keys(lists).forEach(key => {
                        const list = lists[key];
                        const div = document.createElement('div');
                        div.className = 'list-container';
                        div.innerHTML = \`
app.post('/lists/:listKey/items', (req, res) => {  // Cambia :key → :listKey
    const listKey = req.params.listKey;  // Ahora definido
    if (customLists[listKey]) {
        customLists[listKey].items.push({ name: req.body.name || 'Nuevo ítem' });
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Lista no encontrada' });
    }
});

                                📁 \${list.name} (\${list.items.length})
                            </div>
                            <div id="\${key}" class="list-items">
                                <input type="text" id="newItem\${key}" placeholder="Añadir ítem">
                                <button onclick="addItem('\${key}')">Añadir</button>
                                <div id="items\${key}">\${list.items.map((item, i) => 
                                    '<div class="list-item" onclick="selectItem(\\'' + key + '\\',' + i + ')">' + item.name + '</div>'
                                ).join('')}</div>
                            </div>
                        \`;
                        container.appendChild(div);
                    });
                });
        }

        function toggleList(key) {
            const items = document.getElementById(key);
            items.style.display = items.style.display === 'block' ? 'none' : 'block';
        }

        function addList() {
            const name = document.getElementById('newListName').value;
            if (name) {
                fetch('/lists', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({name: name})
                }).then(() => loadLists());
            }
        }

        function addItem(key) {
            const name = document.getElementById('newItem' + key).value;
            if (name) {
                fetch('/lists/' + key + '/items', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({name: name})
                }).then(() => loadLists());
            }
        }

        function selectItem(listKey, itemIndex) {
            const url = '/manifest.json?list=' + listKey + '&item=' + itemIndex;
            prompt('URL Stremio:', window.location.origin + url);
        }

        loadLists();
    </script>
</body>
</html>`;
    res.send(html);
});

// API listas
app.get('/lists', (req, res) => res.json(customLists));

app.post('/lists', (req, res) => {
    const name = req.body.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    customLists[name] = { name: req.body.name, items: [] };
    res.json({ success: true });
});

app.post('/lists/:key/items', (req, res) => {
    const key = req.params.key;
    if (customLists[key]) {
        customLists[key].items.push({ name: req.body.name });
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Lista no encontrada' });
    }
});

// Stremio manifest
app.get('/manifest.json', (req, res) => {
    const listKey = req.query.list || 'favoritos';
    const itemIndex = parseInt(req.query.item) || 0;
    const list = customLists[listKey] || customLists.favoritos;
    const item = list.items[itemIndex] || { name: 'Ítem de prueba' };

    res.json({
        id: 'org.mario.customlibrary',
        version: '1.0.0',
        name: 'Custom Library - ' + list.name,
        description: 'Listas personalizadas en tu biblioteca Stremio',
        resources: ['catalog'],
        types: ['channel'],
        catalogs: [{
            type: 'channel',
            id: 'custom.' + listKey,
            name: list.name + ' - ' + item.name
        }],
        idPrefixes: ['custom.']
    });
});

// Stremio catalog (muestra la lista como catálogo)
app.get('/catalog/:type/:id.json', (req, res) => {
    const listKey = req.params.id.replace('custom.', '');
    const list = customLists[listKey] || customLists.favoritos;
    
    const metas = list.items.map((item, i) => ({
        id: 'custom.' + listKey + '.' + i,
        type: 'channel',
        name: item.name,
        poster: 'https://via.placeholder.com/300x450/00d4ff/000000?text=' + encodeURIComponent(item.name)
    }));

    res.json({
        metas: metas
    });
});

// Stream vacío (usa otros addons para streams reales)
app.get('/stream/:type/:id.json', (req, res) => {
    res.json({ streams: [] });
});

console.log('Custom Library OK en puerto ' + PORT);
app.listen(PORT, () => {
    console.log('Server running on port ' + PORT);
});
