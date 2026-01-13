const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 10000;

// CORS para móvil/Stremio
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

let customLists = {
    favoritos: { name: 'Favoritos', items: [] },
    vistos: { name: 'Vistos', items: [] }
};

console.log('🚀 Servidor iniciado, listas:', Object.keys(customLists));

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Custom Library</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0d1117;color:#f0f6fc;margin:0;padding:20px;max-width:900px;margin:auto;}
h1{text-align:center;color:#58a6ff;margin:0 0 40px 0;font-size:2.5em;}
.container{max-width:100%;margin:0 auto;}
.add-section{background:linear-gradient(135deg,#21262d 0%,#161b22 100%);border:1px solid #30363d;border-radius:12px;padding:30px;margin:30px 0;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.3);}
.add-section h3{margin:0 0 20px;color:#f0f6fc;font-size:1.4em;}
input{padding:14px 18px;font-size:16px;border:1px solid #30363d;border-radius:8px;background:#161b22;color:#f0f6fc;width:320px;max-width:100%;box-sizing:border-box;}
input:focus{outline:none;border-color:#58a6ff;box-shadow:0 0 0 3px rgba(88,166,255,0.1);}
button{padding:14px 28px;font-size:16px;font-weight:600;border:none;border-radius:8px;background:linear-gradient(135deg,#1f6feb 0%,#388bfd 100%);color:#fff;cursor:pointer;transition:all 0.2s;}
button:hover{background:linear-gradient(135deg,#1a5fd8 0%,#3173e1 100%);transform:translateY(-1px);box-shadow:0 4px 12px rgba(88,166,255,0.3);}
.list-container{background:#161b22;border:1px solid #30363d;border-radius:12px;margin:20px 0;padding:24px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.2);}
.list-header{font-size:22px;font-weight:700;cursor:pointer;padding:16px;background:linear-gradient(90deg,#21262d,#30363d);border-radius:8px;transition:all 0.2s;}
.list-header:hover{background:linear-gradient(90deg,#238636,#2ea043);}
.list-items{display:none;margin-top:20px;padding:20px;background:#0d1117;border-radius:8px;border:1px solid #21262d;}
.list-item{background:#21262d;padding:16px;margin:10px 0;border-radius:8px;cursor:pointer;transition:all 0.2s;border-left:4px solid #58a6ff;}
.list-item:hover{background:#238636;color:#fff;border-left-color:#2ea043;transform:translateX(4px);}
.status{padding:12px 20px;background:#238636;color:#fff;border-radius:8px;margin:20px 0;font-weight:500;text-align:center;}
.error{padding:12px 20px;background:#da3633;color:#fff;border-radius:8px;margin:20px 0;}
@media(max-width:600px){.container{padding:10px;}input{width:100% !important;}}
</style>
</head>
<body>
<div class="container">
<h1>📚 Custom Library Stremio</h1>
<div class="add-section">
<h3>➕ Crear Nueva Lista</h3>
<input id="nuevaLista" placeholder="Escribe el nombre de tu lista...">
<button onclick="crearLista()">🔥 CREAR LISTA</button>
</div>
<div id="listas"></div>
<div id="estado"></div>
</div>
<script>
let intentos=0;
function estado(msg,color='info') {
document.getElementById('estado').innerHTML='<div class="'+(color==='error'?'error':'status')+'">'+msg+'</div>';
}
function cargarListas() {
intentos++;
estado('🔄 Cargando listas... ('+intentos+')');
fetch('/api/listas')
.then(r=>r.json())
.then(datos=>{
estado('✅ '+Object.keys(datos).length+' listas cargadas');
let html='';
for(let clave in datos) {
let lista=datos[clave];
html+='<div class="list-container">';
html+='<div class="list-header" onclick="toggleLista(\''+clave+'\')">';
html+='📁 '+lista.name+' <span style="font-size:16px;color:#58a6ff;">('+lista.items.length+' ítems)</span>';
html+='</div>';
html+='<div id="lista_'+clave+'" class="list-items">';
html+='<div style="margin-bottom:15px;">';
html+='<input id="item_'+clave+'" placeholder="Nombre del ítem..." style="width:calc(70% - 10px);">';
html+='<button onclick="agregarItem(\''+clave+'\')" style="width:28%;margin-left:2px;">➕ AÑADIR</button>';
html+='</div>';
html+='<div style="max-height:300px;overflow:auto;">';
for(let i=0;i<lista.items.length;i++) {
html+='<div class="list-item" onclick="instalarStremio(\''+clave+'\','+i+')">';
html+='★ '+lista.items[i].name;
html+='</div>';
}
html+='</div></div></div>';
}
document.getElementById('listas').innerHTML=html;
})
.catch(e=>{
estado('❌ Error cargando: '+e,'error');
console.error('Error:',e);
});
}
function toggleLista(clave) {
let el=document.getElementById('lista_'+clave);
el.style.display=el.style.display==='block'?'none':'block';
}
function crearLista() {
let nombre=document.getElementById('nuevaLista').value.trim();
if(!nombre) return estado('❌ Escribe un nombre','error');
estado('💾 Creando lista "'+nombre+'"');
fetch('/api/listas',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({nombre:nombre})
})
.then(r=>r.json())
.then(()=>{
estado('✅ ¡Lista "'+nombre+'" creada!');
document.getElementById('nuevaLista').value='';
setTimeout(cargarListas,1000);
})
.catch(e=>{
estado('❌ Error creando: '+e,'error');
console.error(e);
});
}
function agregarItem(clave) {
let nombre=document.getElementById('item_'+clave).value.trim();
if(!nombre) return estado('❌ Escribe nombre del ítem','error');
estado('💾 Añadiendo ítem a '+clave);
fetch('/api/listas/'+clave,{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({nombre:nombre})
})
.then(r=>r.json())
.then(()=>{
estado('✅ Ítem añadido');
document.getElementById('item_'+clave).value='';
setTimeout(cargarListas,500);
})
.catch(e=>estado('❌ Error: '+e,'error'));
}
function instalarStremio(clave,indice) {
let url=window.location.origin+'/manifest.json?list='+clave+'&item='+indice;
prompt('📱 Copia esta URL en Stremio:',url);
estado('🔗 URL lista para Stremio');
}
cargarListas();
setInterval(cargarListas,4000);
</script>
</body>
</html>`);
});

app.get('/api/listas', (req, res) => {
    console.log('GET /api/listas - listas:', Object.keys(customLists));
    res.json(customLists);
});

app.post('/api/listas', (req, res) => {
    console.log('POST /api/listas:', req.body);
    try {
        const nombre = req.body.nombre || '';
        const clave = nombre.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
        if (nombre && clave && !customLists[clave]) {
            customLists[clave] = { name: nombre, items: [] };
            console.log('✅ Nueva lista creada:', clave);
            res.json({ ok: true, clave });
        } else {
            res.status(400).json({ error: 'Nombre inválido o existe' });
        }
    } catch (e) {
        console.error('Error POST listas:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/listas/:clave', (req, res) => {
    const clave = req.params.clave;
    console.log('POST /api/listas/' + clave + ':', req.body);
    try {
        const nombre = req.body.nombre || '';
        if (customLists[clave] && nombre) {
            customLists[clave].items.push({ name: nombre });
            console.log('✅ Ítem añadido a', clave, 'total:', customLists[clave].items.length);
            res.json({ ok: true });
        } else {
            res.status(400).json({ error: 'Lista no existe' });
        }
    } catch (e) {
        console.error('Error POST item:', e);
        res.status(500).json({ error: e.message });
    }
});

// Stremio endpoints
app.get('/manifest.json', (req, res) => {
    const lista = req.query.list || 'favoritos';
    const item = parseInt(req.query.item) || 0;
    const l = customLists[lista] || customLists.favoritos;
    const it = l.items[item] || { name: 'Demo' };
    res.json({
        id: 'org.mario.customlibrary',
        version: '1.1.0',
        name: 'Custom Library',
        description: 'Tus listas personalizadas',
        resources: ['catalog'],
        types: ['channel'],
        catalogs: [{ type: 'channel', id: 'custom.' + lista, name: l.name }],
        idPrefixes: ['custom.']
    });
});

app.get('/catalog/:type/:id.json', (req, res) => {
    const lista = req.params.id.replace('custom.', '');
    const l = customLists[lista] || customLists.favoritos;
    res.json({
        metas: l.items.map((it, i) => ({
            id: 'custom.' + lista + '.' + i,
            type: 'channel',
            name: it.name,
            poster: 'https://via.placeholder.com/300x450/58a6ff/ffffff?text=' + encodeURIComponent(it.name)
        }))
    });
});

app.get('/stream/:type/:id.json', (req, res) => res.json({ streams: [] }));

app.listen(PORT, () => {
    console.log('✅ Custom Library LIVE en puerto', PORT);
    console.log('Listas iniciales:', Object.keys(customLists));
});
