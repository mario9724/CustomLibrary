const express = require('express');
const cors = require('cors'); // ← NUEVO
const bodyParser = require('body-parser');

const app = express();
app.use(cors()); // ← CORS FIJO
app.use(express.json());
app.use(express.urlencoded({extended:true}));

let listas = {favoritos:[],vistos:[]};

app.get('/',(req,res)=>res.send(`
<h1>🔥 Custom Library LIVE</h1>
<button onclick="test()">TEST CREAR</button>
<div id="log"></div>
<script>
function test(){fetch('/test').then(r=>r.text()).then(d=>document.getElementById('log').innerHTML=d);}
</script>`));

app.get('/test',(req,res)=>{
  listas.miLista = ['test'];
  res.send('✅ CORS OK! Lista "miLista" creada. Ver /api');
});

app.get('/api',(req,res)=>res.json(listas));

app.listen(process.env.PORT||10000,()=>console.log('✅ LIVE'));
