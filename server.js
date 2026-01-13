const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

let customLists = {
    favoritos: { name: '⭐ Favoritos', items: [] },
    vistos: { name: '✅ Vistos', items: [] }
};

app.get('/', (req, res) => res.send(`
<!DOCTYPE html>
<html><head><title>Custom Library</title><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<style>body{font-family:system-ui;background:#0d1117;color:#f0f6fc;margin:0;padding:20px;max-width:900px;margin:auto;}
h1{text-align:center;color:#58a6ff;font-size:2.2em;margin-bottom:30px;}
input{padding:14px;font-size:16px;border:1px solid #30363d;border-radius:8px;background:#161b22;color:#f0f6fc;width:350px;max-width:calc(100% - 40px);}
input:focus{outline:none;border-color:#58a6ff;box-shadow:0 0 0 2px #58a6ff20;}
button{padding:14px 24px;font-size:16px;background:#238636;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;margin-left:10px;}
button:hover{background:#2ea043;}
.list{background:#161b22;border:1px solid #30363d;border-radius:12px;margin:20px 0;padding:20px;}
.list h3{font-size:1.6em;cursor:pointer;margin:0;padding:15px;background:#21262d;border-radius:8px;}
.content{display:none;margin-top:15px;padding:20px;background:#0d1117;border-radius:8px;border:1px solid #21262d;}
.item{background:#21262d;padding:12px;margin:8px 0;border-radius:6px;cursor:pointer;border-left:4px solid #58a6ff;}
.item:hover{background:#238636;}
#status{padding:15px;margin:20px 0;border-radius:8px;font-weight:500;text-align:center;}
.ok{background:#238636;color:white;}
.error{background:#da3633;color:white;}
</style></head><body>
<h1>📱 Custom Library Stremio</h1>
<div style="background:#21262d;padding:25px;border-radius:12px;text-align:center;margin-bottom:30px;">
<input id="newListName" placeholder="Nombre nueva lista...">
<button onclick="crearLista()">➕ CREAR LISTA</button>
</div>
<div id="lists"></div>
<div id="status"></div>
<script>
function status(msg,isOk){ 
  document.getElementById('status').innerHTML='<div class="'+(isOk?'ok':'error')+'">'+msg+'</div>'; 
}
function load(){ 
  fetch('/api/lists').then(r=>r.json()).then(lists=>{
    let html='';
    for(let key in lists){
      let list=lists[key];
      html+='<div class="list">';
      html+='<h3 onclick="toggle(\''+key+'\')">📁 '+list.name+' ('+list.items.length+' items)</h3>';
      html+='<div id="'+key+'" class="content">';
      html+='<input id="newItem'+key+'" placeholder="Nuevo ítem..." style="width:calc(70% - 10px);">';
      html+='<button onclick="addItem(\''+key+'\')" style="width:28%;">➕</button><br>';
      for(let i=0;i<list.items.length;i++){
        html+='<div class="item" onclick="install(\''+key+'\','+i+')">'+list.items[i].name+'</div>';
      }
      html+='</div></div>';
    }
    document.getElementById('lists').innerHTML=html;
  }).catch(e=>status('Error carga: '+e,false));
}
function toggle(id){
  let el=document.getElementById(id);
  el.style.display=el.style.display==='block'?'none':'block';
}
function crearLista(){
  let name=document.getElementById('newListName').value.trim();
  if(!name)return status('Escribe nombre',false);
  status('Creando "'+name+'"');
  fetch('/api/lists',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})})
  .then(r=>r.json()).then(d=>{
    if(d.ok){status('✅ "'+name+'" creada!');document.getElementById('newListName').value='';load();}
    else status('Error: '+d.error,false);
  }).catch(e=>status('Error: '+e,false));
}
function addItem(key){
  let name=document.getElementById('newItem'+key).value.trim();
  if(!name)return status('Escribe ítem',false);
  status('Añadiendo a '+key);
  fetch('/api/lists/'+key,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})})
  .then(r=>r.json()).then(d=>{
    if(d.ok){document.getElementById('newItem'+key).value='';load();}
  });
}
function install(key,i){
  let url=location.origin+'/manifest.json?list='+key+'&item='+i;
  prompt('Stremio URL:',url);
  status('📱 Copia en Stremio');
}
load();setInterval(load,3000);
</script></body></html>`));

app.get('/api/lists', (req, res) => res.json(customLists));

app.post('/api/lists', (req, res) => {
    const name = req.body.name;
    const key = name.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,20);
    if(name && !customLists[key]){
        customLists[key] = {name, items:[]};
        console.log('Nueva lista:',key);
        return res.json({ok:true});
    }
    res.json({ok:false,error:'Ya existe'});
});

app.post('/api/lists/:key', (req, res) => {
    const key = req.params.key;
    const name = req.body.name;
    if(customLists[key] && name){
        customLists[key].items.push({name});
        console.log('Item añadido:',key);
        res.json({ok:true});
    }else res.json({ok:false});
});

app.get('/manifest.json',(req,res)=>{
    const list=req.query.list||'favoritos';
    const item=parseInt(req.query.item)||0;
    const l=customLists[list]||customLists.favoritos;
    res.json({
        id:'customlibrary.mario',
        version:'1.0.0',
        name:'Custom Library - '+l.name,
        resources:['catalog'],
        types:['channel'],
        catalogs:[{type:'channel',id:'custom.'+list,name:l.name}],
        idPrefixes:['custom.']
    });
});

app.get('/catalog/:t/:id.json',(req,res)=>{
    const list=req.params.id.replace('custom.','');
    const l=customLists[list]||customLists.favoritos;
    res.json({metas:l.items.map((it,i)=>({
        id:'custom.'+list+'.'+i,
        type:'channel',
        name:it.name,
        poster:'https://via.placeholder.com/300x450/58a6ff/ffffff?text='+encodeURIComponent(it.name)
    }))});
});

app.get('/stream/:t/:id.json',()=>'{"streams":[]}');

app.listen(process.env.PORT||10000,()=>console.log('✅ LIVE '+process.env.PORT));
