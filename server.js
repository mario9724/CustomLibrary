const express = require('express');
const PORT = process.env.PORT || 10000;
const app = express();
app.use(express.json());
app.use(express.static('public'));

app.get('/manifest.json', (req, res) => {
  res.json({
    id: 'com.customlibrary.addon',
    version: '1.0.0',
    name: 'Custom Library',
    description: 'Tus listas personalizadas',
    types: ['movie', 'series'],
    catalogs: [],
    resources: ['catalog', 'meta', 'stream']
  });
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>✅ FUNCIONA!</title></head>
    <body>
      <h1>🚀 Custom Library OK!</h1>
      <p>Manifest: <a href="/manifest.json">/manifest.json</a></p>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log('🚀 OK port ' + PORT);
});
