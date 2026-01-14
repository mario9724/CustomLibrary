const translations = {
  es: {
    username: 'Nombre de usuario (obligatorio)',
    tmdbKey: 'Clave API de TMDB',
    tmdbHelp: 'Obtén tu clave gratuita en:',
    searchTitle: 'Buscar y agregar contenido',
    searchPlaceholder: 'Buscar películas/series...',
    selectList: 'Selecciona una lista...',
    myLists: 'Mis Listas',
    createList: 'Crear Nueva Lista',
    listName: 'Nombre de la lista',
    listType: 'Tipo (movie, series, anime...)',
    create: 'Crear Lista',
    export: '📥 Exportar Todas las Listas',
    copyUrl: '📋 Copiar URL de Instalación',
    install: '🚀 Instalar en Stremio',
    recommended: '{{username}} te recomendó {{listName}}'
  },
  en: {
    username: 'Username (required)',
    tmdbKey: 'TMDB API Key',
    tmdbHelp: 'Get your free key at:',
    searchTitle: 'Search and add content',
    searchPlaceholder: 'Search movies/series...',
    selectList: 'Select a list...',
    myLists: 'My Lists',
    createList: 'Create New List',
    listName: 'List name',
    listType: 'Type (movie, series, anime...)',
    create: 'Create List',
    export: '📥 Export All Lists',
    copyUrl: '📋 Copy Install URL',
    install: '🚀 Install in Stremio',
    recommended: '{{username}} recommended {{listName}} to you'
  },
  fr: {
    username: "Nom d'utilisateur (obligatoire)",
    tmdbKey: 'Clé API TMDB',
    tmdbHelp: 'Obtenez votre clé gratuite sur:',
    searchTitle: 'Rechercher et ajouter du contenu',
    searchPlaceholder: 'Rechercher films/séries...',
    selectList: 'Sélectionner une liste...',
    myLists: 'Mes Listes',
    createList: 'Créer une Nouvelle Liste',
    listName: 'Nom de la liste',
    listType: 'Type (film, série, anime...)',
    create: 'Créer la Liste',
    export: '📥 Exporter Toutes les Listes',
    copyUrl: "📋 Copier l'URL d'Installation",
    install: '🚀 Installer dans Stremio',
    recommended: '{{username}} vous a recommandé {{listName}}'
  }
  // Añade más idiomas aquí...
};

let currentLang = 'es';
let currentUsername = '';
let currentTmdbKey = '';

// Cambio de idioma
document.getElementById('langSelect').addEventListener('change', (e) => {
  currentLang = e.target.value;
  updateUI();
});

function updateUI() {
  const t = translations[currentLang] || translations.es;
  
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.textContent = t[key];
  });
  
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key]) el.placeholder = t[key];
  });
}

// Validar usuario
document.getElementById('username').addEventListener('blur', (e) => {
  const username = e.target.value.trim();
  if (username) {
    currentUsername = username;
    localStorage.setItem('username', username);
    document.getElementById('tmdbSection').style.display = 'block';
    document.getElementById('listsSection').style.display = 'block';
    document.getElementById('bottomActions').style.display = 'block';
    loadLists(username);
  }
});

// Validar TMDB Key
document.getElementById('tmdbKey').addEventListener('blur', (e) => {
  const key = e.target.value.trim();
  if (key) {
    currentTmdbKey = key;
    localStorage.setItem('tmdbKey', key);
    document.getElementById('searchSection').style.display = 'block';
  }
});

// Crear lista
document.getElementById('newListForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('listName').value.trim();
  const type = document.getElementById('listType').value.trim();
  
  if (!name || !type) return;
  
  const res = await fetch('/api/lists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: currentUsername, list: { name, type } })
  });
  
  if (res.ok) {
    loadLists(currentUsername);
    e.target.reset();
  }
});

// Cargar listas
async function loadLists(username) {
  const res = await fetch(`/api/lists?username=${username}`);
  const lists = await res.json();
  
  const display = document.getElementById('listDisplay');
  display.innerHTML = lists.length === 0 
    ? '<p style="text-align:center; opacity:0.7;">No hay listas creadas aún</p>'
    : lists.map((list, idx) => `
    <div class="list-item">
      <div class="list-info">
        <strong>${list.name}</strong> <span style="opacity:0.8">(${list.type})</span><br>
        <small>${list.items?.length || 0} elementos</small>
      </div>
      <div class="list-actions">
        <button onclick="shareList('${list.id}', '${list.name}')">📤</button>
        <button onclick="moveList('${list.id}', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>⬆️</button>
        <button onclick="moveList('${list.id}', ${idx}, 1)" ${idx === lists.length - 1 ? 'disabled' : ''}>⬇️</button>
        <button onclick="deleteList('${list.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
  
  // Actualizar dropdown de búsqueda
  document.getElementById('targetList').innerHTML = 
    '<option value="">Selecciona lista...</option>' +
    lists.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
}

// Compartir lista
async function shareList(id, name) {
  const t = translations[currentLang] || translations.es;
  const text = t.recommended.replace('{{username}}', currentUsername).replace('{{listName}}', name);
  const url = `${window.location.origin}/manifest.json?username=${currentUsername}`;
  
  if (navigator.share) {
    await navigator.share({ title: text, text, url });
  } else {
    navigator.clipboard.writeText(`${text}\n${url}`);
    alert('¡Enlace copiado al portapapeles!');
  }
}

// Eliminar lista
async function deleteList(id) {
  if (!confirm('¿Eliminar esta lista?')) return;
  await fetch(`/api/lists/${id}?username=${currentUsername}`, { method: 'DELETE' });
  loadLists(currentUsername);
}

// Mover lista
async function moveList(id, currentIndex, direction) {
  const newOrder = currentIndex + direction;
  await fetch(`/api/lists/${id}/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: currentUsername, newOrder })
  });
  loadLists(currentUsername);
}

// Exportar todo
document.getElementById('exportBtn').addEventListener('click', async () => {
  const res = await fetch(`/api/lists?username=${currentUsername}`);
  const lists = await res.json();
  
  const blob = new Blob([JSON.stringify({ username: currentUsername, lists }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `customlibrary-${currentUsername}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// Copiar URL instalación
document.getElementById('copyInstallBtn').addEventListener('click', () => {
  const url = `${window.location.origin}/manifest.json?username=${currentUsername}`;
  navigator.clipboard.writeText(url);
  alert('¡URL copiada! Pégala en Stremio > Addons > Install from URL');
});

// Instalar directo en Stremio
document.getElementById('installBtn').addEventListener('click', () => {
  const url = `stremio://${window.location.host}/manifest.json?username=${currentUsername}`;
  window.open(url, '_blank');
});

// Búsqueda TMDB
let searchTimeout;
document.getElementById('searchInput').addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    const q = e.target.value.trim();
    
    if (q.length < 3 || !currentTmdbKey) return;
    
    const res = await fetch(`/api/tmdb/search?q=${q}&key=${currentTmdbKey}&lang=${currentLang}-${currentLang.toUpperCase()}`);
    const data = await res.json();
    
    document.getElementById('searchResults').innerHTML = (data.results || []).slice(0, 12).map(item => `
      <div class="search-item" onclick="addToList('${item.id}', '${item.media_type}', '${(item.title || item.name || '').replace(/'/g, "\\'")}', '${item.poster_path || ''}')">
        <img src="https://image.tmdb.org/t/p/w200${item.poster_path || '/placeholder.png'}" alt="${item.title || item.name}" onerror="this.src='image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22300%22%3E%3Crect fill=%22%23333%22 width=%22200%22 height=%22300%22/%3E%3C/svg%3E'">
        <strong>${item.title || item.name}</strong>
        <button onclick="event.stopPropagation()">+ Añadir</button>
      </div>
    `).join('');
  }, 600);
});

async function addToList(tmdbId, mediaType, title, poster) {
  const listId = document.getElementById('targetList').value;
  
  if (!listId) {
    alert('Selecciona una lista primero');
    return;
  }
  
  await fetch(`/api/lists/${listId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      username: currentUsername, 
      item: { tmdbId, mediaType, title, poster } 
    })
  });
  
  alert('¡Añadido correctamente!');
  loadLists(currentUsername);
}

// Cargar datos guardados
window.addEventListener('DOMContentLoaded', () => {
  const savedUsername = localStorage.getItem('username');
  const savedKey = localStorage.getItem('tmdbKey');
  
  if (savedUsername) {
    document.getElementById('username').value = savedUsername;
    currentUsername = savedUsername;
    document.getElementById('tmdbSection').style.display = 'block';
    document.getElementById('listsSection').style.display = 'block';
    document.getElementById('bottomActions').style.display = 'block';
    loadLists(savedUsername);
  }
  
  if (savedKey) {
    document.getElementById('tmdbKey').value = savedKey;
    currentTmdbKey = savedKey;
    document.getElementById('searchSection').style.display = 'block';
  }
  
  updateUI();
});
