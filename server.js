const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

let customLists = {
    favoritos: { name: 'Favoritos', items: [] },
    vistos: { name: 'Vistos', items: [] }
};

// Ruta principal web (sin fetch inicial que falle)
app.get('/', (req, res) => {
    const html = `<!DOCTYPE html>
<html><head><title>Custom Library</title><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:Arial;background:#1a1a1a;color:white;margin:0;padding:20px;max-width:800px;margin:auto;}
h1{text-align:center;color:#00d4ff;}.list-container{margin:20px 0;background:#333;padding:15px;border-radius:8px;}
.list-header{font-weight:bold;cursor:pointer;}.list-items{display:none;background:#222;padding:10px;border-radius:4px;margin-top:10px;}
.list-item{padding:8px;border-bottom:1px solid #444;cursor:pointer;transition:background 0.2s;}.list-item:hover{background:#00d4ff;color:black;}
.list-item:last-child{border-bottom:none;}input,button{padding:10px;margin:5px;border:none;border-radius:4px;font-size:16px;}
button{background:#00d4ff;color:black;cursor:pointer;font-weight:bold;}button:hover{background:#00b8d4;}
.add-list{text-align:center;margin:30px 0;}</style></head><body>
<h1>Custom Library</h1>
<div class="add-list"><input type="text" id="newListName" placeholder="Nombre nueva lista">
<button onclick="addList()">Nueva Lista</button></div>
<div id="lists"><div class="list-container"><div class="list-header">📁 Favoritos (0)</div>
<div class="list-items" id="favoritos"><input type="text" id="newItemFavoritos" placeholder="Añadir ítem">
<button onclick="addItem('favoritos')">Añadir</button><div id="itemsFavoritos"></div></div></div>
<div class="list-container"><div class="list-header">📁 Vistos (0)</div>
<div class="list-items" id="vistos"><input type="text" id="newItemVistos" placeholder="Añadir ítem">
<button onclick="addItem('vistos')">Añadir</button><div id="itemsVistos"></div></div></div></div>

<script>
function toggleList(key) {document.getElementById(key).style.display=document.getElementById(key).style.display==='block'?'none':'block';}
function addList() {
    const name = document.getElementById('newListName').value.trim();
    if (!name) return;
    fetch('/lists', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name})})
    .then(r=>r.json()).then(()=> {document.getElementById('newListName').value=''; loadLists();})
    .catch(e=>alert('Error: '+e));
}
function addItem(key) {
    const name = document.getElementById('newItem'+key.charAt(0).toUpperCase()+key.slice(1)).value.trim();
    if (!name) return;
    fetch('/lists/'+key+'/items', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name})})
    .then(r=>r.json()).then(()=> {document.getElementById('newItem'+key.charAt(0).toUpperCase()+key.slice(1)).value=''; loadItems(key);})
    .catch(e=>alert('Error: '+e));
}
function loadLists() {
    fetch('/lists').then(r=>r.json()).then(lists=>{
        const container = document.getElementById('lists');
        Object.keys(lists).forEach(key => {
            let itemsDiv = document.getElementById('items'+key.charAt(0).toUpperCase()+key.slice(1));
            if (!itemsDiv) {
                const div = document.createElement('div'); div.className='list-container';
                div.innerHTML = '<div class="list-header" onclick="toggleList(\\''+key+'\\')">📁 '+lists[key].name+' ('+lists[key].items.length+')</div><div id="'+key+'" class="list-items"><input type="text" id="newItem'+key.charAt(0).toUpperCase()+key.slice(1)+'" placeholder="Añadir ítem"><button onclick="addItem(\\''+key+'\\')">Añadir</button><div id="items'+key.charAt(0).toUpperCase()+key.slice(1)+'"></div></div>';
                container.appendChild(div);
            }
        });
    }).catch(()=>{}); // Ignora errores carga inicial
}
function loadItems(key) {
    fetch('/lists').then(r=>r.json()).then(lists=>{
        const itemsDiv = document.getElementById('items'+key.charAt(0).toUpperCase()+key.slice(1));
        itemsDiv.innerHTML = lists[key].items.map((item,i)=>'<div class="list-item" onclick="selectItem(\\''+key+'\\','+i+')">★ '+item.name+'</div>').join('');
    });
}
function selectItem(key, index) {
    const url = window.location.origin + '/manifest.json?list=' + key + '&item=' + index;
    prompt('Instala en Stremio esta URL:', url);
}
loadLists(); setInterval(loadLists, 5000);</script></body></html>`;
    res.send(html);
}

// API robusta (maneja errores)
app.get('/lists', (req, res) => res.json(customLists));

app.post('/lists', express.json(), (req, res) => {
    try {
        const name = (req.body.name || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0,20);
        if (name && !customLists[name]) {
            customLists[name] = { name: req.body.name || 'Nueva', items: [] };
            return res.json({ success: true });
        }
    } catch(e) {}
    res.status(400).json({ error: 'Nombre inválido' });
});

app.post('/lists/:listKey/items', express.json(), (req, res) => {
    try {
        const listKey = req.params.listKey;
        const name = (req.body.name || '').toString().slice(0,100);
        if (customLists[listKey] && name) {
            customLists[listKey].items.push({ name });
            return res.json({ success: true });
        }
    } catch(e) {}
    res.status(400).json({ error: 'Lista o nombre inválido' });
});

// Stremio (sin cambios)
app.get('/manifest.json', (req, res) => {
    const listKey = req.query.list || 'favoritos';
    const itemIndex = parseInt(req.query.item) || 0;
    const list = customLists[listKey] || customLists.favoritos;
    const item = list.items[itemIndex] || { name: 'Ítem de prueba' };
    res.json({
        id: 'org.mario.customlibrary',
        version: '1.0.0',
        name: 'Custom Library - ' + list.name,
        description: 'Listas personalizadas en biblioteca Stremio',
        resources: ['catalog'], types: ['channel'],
        catalogs: [{type:'channel', id:'custom.'+listKey, name:list.name+' - '+item.name}],
        idPrefixes: ['custom.']
    });
});

app.get('/catalog/:type/:id.json', (req, res) => {
    const listKey = req.params.id.replace('custom.', '');
    const list = customLists[listKey] || customLists.favoritos;
    const metas = list.items.map((item,i)=>({
        id: 'custom.'+listKey+'.'+i, type: 'channel', name: item.name,
        poster: 'https://via.placeholder.com/300x450/00d4ff/000000?text='+encodeURIComponent(item.name)
    }));
    res.json({metas});
});

app.get('/stream/:type/:id.json', (req, res) => res.json({streams:[]}));

app.listen(PORT, () => console.log('Custom Library LIVE en puerto '+PORT));
