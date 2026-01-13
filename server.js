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

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head><title>Custom Library</title><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<style>body{font-family:Arial;background:#1a1a1a;color:#fff;margin:0;padding:20px;max-width:800px;margin:auto;}
h1{text-align:center;color:#00d4ff;}input,button{padding:12px;margin:5px;border:none;border-radius:6px;font-size:16px;}
button{background:#00d4ff;color:#000;cursor:pointer;font-weight:bold;}button:hover{background:#00b8d4;}
.list-container{background:#333;margin:20px 0;padding:20px;border-radius:8px;}
.list-header{font-size:20px;font-weight:bold;cursor:pointer;}
.list-items{display:none;margin-top:15px;}
.list-item{background:#444;padding:12px;margin:8px 0;border-radius:6px;cursor:pointer;}
.list-item:hover{background:#00d4ff;color:#000;}.add-section{text-align:center;padding:30px;background:#333;border-radius:8px;margin:20px 0;}</style>
</head>
<body>
<div><h1>📚 Custom Library</h1>
<div class="add-section">
<h3>➕ Nueva Lista</h3>
<input id="newList" placeholder="Nombre de la lista" style="width:300px;">
<button onclick="crearLista()">CREAR LISTA</button>
</div>
<div id="contenedor"></div>
</div>
<script>
function cargar() {
fetch('/api/listas').then(r=>r.json()).then(datos=>{
let html='';
for(let k in datos) {
let lista=datos[k];
html+='<div class="list-container">';
html+='<div class="list-header" onclick="mostrar(\''+k+'\')">📁 '+lista.name+' ('+lista.items.length+')</div>';
html+='<div id="'+k+'" class="list-items" style="display:none;">';
html+='<input id="item'+k+'" placeholder="Nombre del ítem">';
html+='<button onclick="agregarItem(\''+k+'\')">AÑADIR ÍTEM</button>';
html+='<div>';
for(let i=0;i<lista.items.length;i++) {
html+='<div class="list-item" onclick="stremio(\''+k+'\','+i+')">★ '+lista.items[i].name+'</div>';
}
html+='</div></div></div>';
}
document.getElementById('contenedor').innerHTML=html;
});
}
function mostrar(id) {
let el=document.getElementById(id);
el.style.display=el.style.display==='block'?'none':'block';
}
function crearLista() {
let nombre=document.getElementById('newList').value.trim();
if(!nombre)return alert('Escribe nombre');
fetch('/api/listas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:nombre})})
.then(r=>r.json()).then(()=> {document.getElementById('newList').value='';cargar();});
}
function agregarItem(id) {
let nombre=document.getElementById('item'+id).value.trim();
if(!nombre)return alert('Escribe nombre');
fetch('/api/listas/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:nombre})})
.then(r=>r.json()).then(()=> {document.getElementById('item'+id).value='';cargar();});
}
function stremio(lista,indice) {
let url=window.location.origin+'/manifest.json?list='+lista+'&item='+indice;
prompt('Instala en Stremio:',url);
}
cargar();setInterval(cargar,3000);
</script></body></html>`);
});

app.get('/api/listas', (req, res) => res.json(customLists));

app.post('/api/listas', (req, res) => {
    const nombre = req.body.nombre;
    const clave = nombre.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
    if (nombre && !customLists[clave]) {
        customLists[clave] = { name: nombre, items: [] };
    }
    res.json({ ok: true });
});

app.post('/api/listas/:clave', (req, res) => {
    const clave = req.params.clave;
    const nombre = req.body.nombre;
    if (customLists[clave] && nombre) {
        customLists[clave].items.push({ name: nombre });
    }
    res.json({ ok: true });
});

app.get('/manifest.json', (req, res) => {
    const lista = req.query.list || 'favoritos';
    const item = parseInt(req.query.item) || 0;
    const l = customLists[lista] || customLists.favoritos;
    const it = l.items[item] || { name: 'Prueba' };
    res.json({
        id: 'org.mario.customlibrary',
        version: '1.0',
        name: 'Custom Library - ' + l.name,
        resources: ['catalog'], types: ['channel'],
        catalogs: [{type: 'channel', id: 'custom.'+lista, name: l.name+' - '+it.name}],
        idPrefixes: ['custom.']
    });
});

app.get('/catalog/:type/:id.json', (req, res) => {
    const lista = req.params.id.replace('custom.', '');
    const l = customLists[lista] || customLists.favoritos;
    res.json({
        metas: l.items.map((it, i) => ({
            id: 'custom.'+lista+'.'+i, type: 'channel', name: it.name,
            poster: 'https://via.placeholder.com/300x450/00d4ff/000?text='+encodeURIComponent(it.name)
        }))
    });
});

app.get('/stream/:type/:id.json', (req, res) => res.json({streams:[]}));

app.listen(PORT, () => console.log('🚀 LIVE puerto '+PORT));
