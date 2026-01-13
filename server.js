const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 7000;

// Middleware para servir archivos estáticos (HTML, CSS, JS)
app.use(express.static('public'));
app.use(express.json());

// Configuración del addon Stremio
const manifest = {
    id: 'com.mario9724.customlibrary',
    version: '1.0.0',
    name: 'Custom Library',
    description: 'Stremio Addon para crear listas dentro de la biblioteca',
    resources: ['catalog', 'meta', 'stream'],
    types: ['movie', 'series'],
    catalogs: [{
        id: 'custom-lists',
        name: 'Mis Listas Personalizadas',
        type: 'list'
    }],
    idPrefixes: ['tt', 'kodi', 'custom']
};

// Builder del addon
const builder = new addonBuilder(manifest);

// Almacenamiento simple de listas (en memoria, usa DB para producción)
let customLists = {
    favoritos: {
        name: 'Favoritos',
        items: [],
        description: 'Tus contenidos favoritos'
    },
    vistos: {
        name: 'Vistos',
        items: [],
        description: 'Contenidos ya vistos'
    }
};

// Catalog handler - devuelve listas personalizadas
builder.defineCatalogHandler((args) => {
    const metas = Object.entries(customLists).map(([id, list]) => ({
        id: `list:${id}`,
        type: 'list',
        name: list.name,
        description: list.description,
        poster: `https://via.placeholder.com/300x450/FF6B6B/FFFFFF?text=${encodeURIComponent(list.name)}`,
        badge: `vods:${customLists[id].items.length}`
    }));
    
    return Promise.resolve({ metas });
});

// Meta handler - detalles de una lista
builder.defineMetaHandler((args) => {
    if (args.id.startsWith('list:')) {
        const listId = args.id.replace('list:', '');
        const list = customLists[listId];
        if (list) {
            return Promise.resolve({
                meta: {
                    id: args.id,
                    name: list.name,
                    type: 'list',
                    description: list.description,
                    poster: `https://via.placeholder.com/300x450/4ECDC4/FFFFFF?text=${encodeURIComponent(list.name)}`,
                    addons: [{ manifest: manifest }]
                }
            });
        }
    }
    return Promise.resolve({ meta: null });
});

// Ruta web principal (tu interfaz)
app.get('/', (req, res) => {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Custom Library - Stremio</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #1a1a1a; color: white; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        h1 { text-align: center; margin-bottom: 30px; color: #00d4ff; }
        .list { background: #2a2a2a; margin: 15px 0; padding: 20px; border-radius: 10px; }
        .list h3 { color: #00d4ff; margin-bottom: 10px; }
        .list-items { display: flex; flex-wrap: wrap; gap: 10px; }
        .item { background: #3a3a3a; padding: 10px; border-radius: 5px; cursor: pointer; }
        .success { background: #28a745; color: white; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .error { background: #dc3545; color: white; padding: 15px; border-radius: 5px; margin: 10px 0; }
        button { background: #00d4ff; color: black; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 5px; }
        button:hover { background: #00b8d4; }
        input { padding: 10px; border-radius: 5px; border: 1px solid #444; background: #3a3a3a; color: white; margin: 5px; }
    </style>
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
        
        function showMessage(msg, type = 'success') {
            const div = document.getElementById('message');
            div.innerHTML = \`<div class="\${type}">\${msg}</div>\`;
            setTimeout(() => div.innerHTML = '', 3000);
        }
        
        function loadLists() {
            fetch('/api/lists')
                .then(r => r.json())
                .then(data => {
                    lists = data;
                    const container = document.getElementById('lists');
                    container.innerHTML = Object.entries(lists).map(([id, list]) => 
                        \`<div class="list">
                            <h3>\${list.name} (\${list.items.length} items)</h3>
                            <div class="list-items">\${list.items.map(item => 
                                \`<div class="item">\${item.name || item.id}</div>\`).join('')}</div>
                            <button onclick="addItem('\${id}')">Añadir Item</button>
                            <button onclick="deleteList('\${id}')">Eliminar</button>
                        </div>\`
                    ).join('');
                });
        }
        
        function createList() {
            const name = document.getElementById('newListName').value;
            if (!name) return showMessage('Nombre requerido', 'error');
            
            fetch('/api/lists', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({name})
            }).then(() => {
                document.getElementById('newListName').value = '';
                loadLists();
                showMessage('Lista creada!');
            });
        }
        
        function addItem(listId) {
            const name = prompt('Nombre del item:');
            if (name) {
                fetch(\`/api/lists/\${listId}/items\`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({name})
                }).then(() => {
                    loadLists();
                    showMessage('Item añadido!');
                });
            }
        }
        
        function deleteList(listId) {
            if (confirm('¿Eliminar esta lista?')) {
                fetch(\`/api/lists/\${listId}\`, {method: 'DELETE'})
                    .then(() => {
                        loadLists();
                        showMessage('Lista eliminada!');
                    });
            }
        }
        
        loadLists();
    </script>
</body>
</html>`;
    res.send(html);
});

// API endpoints para la web
app.get('/api/lists', (req, res) => {
    res.json(customLists);
});

app.post('/api/lists', express.json(), (req, res) => {
    const { name } = req.body;
    const id = name.toLowerCase().replace(/\s+/g, '-');
    customLists[id] = {
        name,
        items: [],
        description: `Lista ${name} creada el ${new Date().toLocaleDateString('es-ES')}`
    };
    res.json({ success: true, id });
});

app.post('/api/lists/:listId/items', express.json(), (req, res) => {
    const { listId } = req.params;
    const { name } = req.body;
    if (customLists[listId]) {
        customLists[listId].items.push({
            id: Date.now().toString(),
            name,
            added: new Date().toISOString()
        });
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Lista no encontrada' });
    }
});

app.delete('/api/lists/:listId', (req, res) => {
    const { listId } = req.params;
    delete customLists[listId];
    res.json({ success: true });
});

// Ruta del manifest Stremio
app.get('/manifest.json', (req, res) => {
    res.send(builder.getManifest());
});

// Stream handler mejorado
builder.defineStreamHandler((args) => {
    if (args.id.startsWith('list:')) {
        return Promise.resolve({ streams: [] });
    }
    return Promise.resolve({ streams: [] });
});

// Ruta principal del addon
app.use('/', serveHTTP(builder.getInterface()));

// Health check para Render
app.get('/health', (req, res) => {
    res.status(200).send('CustomLibrary funcionando correctamente');
});

// 404
app.use((req, res) => {
    res.status(404).send(`
        <div style="background: #1a1a1a; color: white; padding: 50px; text-align: center;">
            <h1>404 - No encontrado</h1>
            <p><a href="/" style="color: #00d4ff;">Ir a Custom Library</a></p>
        </div>
    `);
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Custom Library addon corriendo en puerto ${PORT}`);
    console.log(`📱 Web: http://localhost:${PORT}`);
    console.log(`🔌 Stremio: http://localhost:${PORT}/manifest.json`);
});
