const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

let customLists = {
    favoritos: { name: 'Favoritos', items: [] },
    vistos: { name: 'Vistos', items: [] }
};

// Ruta principal
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Custom Library</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; background: #1a1a1a; color: white; margin: 0; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        h1 { text-align: center; color: #00d4ff; margin-bottom: 30px; }
        .list-container { background: #333; margin: 15px 0; padding: 15px; border-radius: 8px; }
        .list-header { font-weight: bold; cursor: pointer; font-size: 18px; }
        .list-items { display: none; margin-top: 10px; }
        .list-item { background: #222; padding: 10px; margin: 5px 0; border-radius: 4px; cursor: pointer; }
        .list-item:hover { background: #00d4ff; color: black; }
        input, button { padding: 10px; margin: 5px; border: none; border-radius: 4px; font-size: 16px; }
        button { background: #00d4ff; color: black; cursor: pointer; font-weight: bold; }
        button:hover { background: #00b8d4; }
        .add-section { text-align: center; margin: 20px 0; background: #333; padding: 20px; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📚 Custom Library</h1>
        
        <div class="add-section">
            <h3>Nueva Lista</h3>
            <input type="text" id="newListName" placeholder="Nombre de la lista">
            <button onclick="addList()">Crear Lista</button>
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
                        div.innerHTML = 
                            '<div class="list-header" onclick="toggleList(\'' + key + '\')">' +
                            '📁 ' + list.name + ' (' + list.items.length + ')' +
                            '</div>' +
                            '<div id="' + key + '" class="list-items">' +
                            '<input type="text" id="newItem' + key + '" placeholder="Añadir ítem">' +
                            '<button onclick="addItem(\'' + key + '\')">Añadir</button>' +
                            '<div id="items' + key + '">' +
                            list.items.map((item, i) => 
                                '<div class="list-item" onclick="selectItem(\'' + key + '\',' + i + ')">★ ' + item.name + '</div>'
                            ).join('') +
                            '</div></div>';
                        container.appendChild(div);
                    });
                });
        }

        function toggleList(key) {
            const el = document.getElementById(key);
            el.style.display = el.style.display === 'block' ? 'none' : 'block';
        }

        function addList() {
            const name = document.getElementById('newListName').value.trim();
            if (!name) return alert('Escribe un nombre');
            
            fetch('/lists', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({name: name})
            })
            .then(r => r.json())
            .then(() => {
                document.getElementById('newListName').value = '';
                loadLists();
            })
            .catch(e => alert('Error: ' + e));
        }

        function addItem(key) {
            const name = document.getElementById('newItem' + key).value.trim();
            if (!name) return alert('Escribe un nombre');
            
            fetch('/lists/' + key + '/items', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({name: name})
            })
            .then(r => r.json())
            .then(() => {
                document.getElementById('newItem' + key).value = '';
                loadLists();
            })
            .catch(e => alert('Error: ' + e));
        }

        function selectItem(key, index) {
            const url = window.location.origin + '/manifest.json?list=' + key + '&item=' + index;
            prompt('Instala en Stremio:', url);
        }

        loadLists();
        setInterval(loadLists, 5000);
    </script>
</body>
</html>
`);
});

// API
app.get('/lists', (req, res) => res.json(customLists));

app.post('/lists', (req, res) => {
    try {
        const name = (req.body.name || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
        if (name && !customLists[name]) {
            customLists[name] = { name: req.body.name, items: [] };
            return res.json({ success: true });
        }
    } catch(e) {}
    res.status(400).json({ error: 'Nombre inválido' });
});

app.post('/lists/:listKey/items', (req, res) => {
    try {
        const listKey = req.params.listKey;
        const name = (req.body.name || '').slice(0, 100);
        if (customLists[listKey] && name) {
            customLists[listKey].items.push({ name });
            return res.json({ success: true });
        }
    } catch(e) {}
    res.status(400).json({ error: 'Error al añadir' });
});

// Stremio
app.get('/manifest.json', (req, res) => {
    const listKey = req.query.list || 'favoritos';
    const itemIndex = parseInt(req.query.item) || 0;
    const list = customLists[listKey] || customLists.favoritos;
    const item = list.items[itemIndex] || { name: 'Ítem de prueba' };
    
    res.json({
        id: 'org.mario.customlibrary',
        version: '1.0.0',
        name: 'Custom Library - ' + list.name,
        description: 'Listas personalizadas en Stremio',
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

app.get('/catalog/:type/:id.json', (req, res) => {
    const listKey = req.params.id.replace('custom.', '');
    const list = customLists[listKey] || customLists.favoritos;
    
    const metas = list.items.map((item, i) => ({
        id: 'custom.' + listKey + '.' + i,
        type: 'channel',
        name: item.name,
        poster: 'https://via.placeholder.com/300x450/00d4ff/000000?text=' + encodeURIComponent(item.name)
    }));
    
    res.json({ metas });
});

app.get('/stream/:type/:id.json', (req, res) => {
    res.json({ streams: [] });
});

app.listen(PORT, () => {
    console.log('✅ Custom Library LIVE en puerto ' + PORT);
});
