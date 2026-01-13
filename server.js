const express = require('express');
const PORT = process.env.PORT || 7000;

const app = express();
app.use(express.json());

// Datos
let customLists = {
    favoritos: { name: 'Favoritos', items: [] },
    vistos: { name: 'Vistos', items: [] }
};

// ÚNICA ruta principal - TODO en un res.send()
app.get('/', (req, res) => {
    let html = `
<!DOCTYPE html>
<html><head><title>Custom Library</title>
<meta charset="utf-8"><meta name="viewport" content="width=device-width">
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;background:#1a1a1a;color:white;padding:20px;}.container{max-width:800px;margin:0 auto;}h1{text-align:center;margin-bottom:30px;color:#00d4ff;}.list{background:#2a2a2a;margin:15px 0;padding:20px;border-radius:10px;}.list h3{color:#00d4ff;margin-bottom:10px;}.list-items{display:flex;flex-wrap:wrap;gap:10px;}.item{background:#3a3a3a;padding:10px;border-radius:5px;}.success,.error{padding:15px;border-radius:5px;margin:10px 0;}button{background:#00d4ff;color:black;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;margin:5px;}button:hover{background:#00b8d4;}input{padding:10px;border-radius:5px;border:1px solid #444;background:#3a3a3a;color:white;}</style>
</head><body>
<div class="container">
<h1>🗂️ Custom Library</h1>
<div id="message"></div>
<h2>📋 Tus Listas</h2>`;

    // Listas renderizadas servidor
    Object.entries(customLists).forEach(([id, list]) => {
        html += `<div class="list" data-id="${id}">
<h3>${list.name} (${list.items.length} items)</h3>
<div class="list-items">`;
        list.items.forEach(item => html += `<div class="item">${item.name}</div>`);
        html += `</div>
<input class="item-input" placeholder="Nuevo item">
<button onclick="addItem('${id}')">Añadir</button>
<button onclick="deleteList('${id}')">Eliminar</button>
</div>`;
    });

    html += `
<h2>➕ Nueva Lista</h2>
<input id="newName" placeholder="Nombre">
<button onclick="createList()">Crear</button>
</div>

<script>
function msg(text) {
    document.getElementById('message').innerHTML = '<div class="success">' + text + '</div>';
    setTimeout(()=>document.getElementById('message').innerHTML='',3000);
}
function createList() {
    const n = document.getElementById('newName').value;
    fetch('/api/lists',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n})})
    .then(()=> {document.getElementById('newName').value=''; location.reload(); });
}
function addItem(id) {
    const inp = document.querySelector('[data-id="${id}"] .item-input').value;
    fetch('/api/lists/'+id+'/items',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:inp})})
    .then(()=> { location.reload(); });
}
function deleteList(id) {
    if(confirm('¿Eliminar?')) fetch('/api/lists/'+id,{method:'DELETE'}).then(()=>location.reload());
}
</script></body></html>`;
    
    res.send(html);
});

// API
app.get('/api/lists', (req, res) => res.json(customLists));
app.post('/api/lists', express.json(), (req, res) => {
    const id = req.body.name.toLowerCase().replace(/[^a-z0-9]/g,'-');
    customLists[id] = { name: req.body.name, items: [] };
    res.json({ok:1});
});
app.post('/api/lists/:id/items', express.json(), (req, res) => {
    customLists[req.params.id].items.push({name: req.body.name});
    res.json({ok:1});
});
app.delete('/api/lists/:id', (req, res) => {
    delete customLists[req.params.id];
    res.json({ok:1});
});

// Stremio
app.get('/manifest.json', (req, res) => res.json({
    id: 'com.customlibrary', name: 'Custom Library', version: '1.0.0',
    resources: ['catalog','meta'], types: ['movie','series'],
    catalogs: [{id: 'lists', name: 'Listas', type: 'list'}]
}));
app.get('/catalog/lists.json', (req, res) => {
    res.json({metas: Object.entries(customLists).map(([id,l])=>({
        id: 'list:'+id, type: 'list', name: l.name,
        poster: 'https://via.placeholder.com/300x450/4ECDC4?text='+l.name
    }))});
});

// Health + 404
app.get('/health', (req, res) => res.send('OK'));
app.use((req, res) => res.status(404).send('404'));

app.listen(PORT, () => console.log('Custom Library OK puerto '+PORT));
