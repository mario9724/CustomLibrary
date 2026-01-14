const translations = {
  es: {
    username: 'Nombre de usuario',
    tmdbKey: 'Clave API TMDB',
    tmdbHelp: 'Obtén tu clave gratuita en',
    myLists: 'Mis Listas',
    createList: 'Crear Nueva Lista',
    listName: 'Nombre de la lista',
    listType: 'Tipo (movie, series, custom...)',
    create: 'Crear',
    export: 'Exportar Todo',
    copyUrl: 'Copiar URL Instalación',
    install: 'Instalar en Stremio',
    searchPlaceholder: 'Buscar películas/series...',
    recommended: '{{username}} te recomendó {{listName}}'
  },
  en: {
    username: 'Username',
    tmdbKey: 'TMDB API Key',
    tmdbHelp: 'Get your free key at',
    myLists: 'My Lists',
    createList: 'Create New List',
    listName: 'List name',
    listType: 'Type (movie, series, custom...)',
    create: 'Create',
    export: 'Export All',
    copyUrl: 'Copy Install URL',
    install: 'Install in Stremio',
    searchPlaceholder: 'Search movies/series...',
    recommended: '{{username}} recommended {{listName}} to you'
  },
  // Añade más idiomas aquí (fr, de, it, pt, ru, zh, ja, ar, hi, ko)
};

i18next.init({
  lng: 'es',
  resources: Object.entries(translations).reduce((acc, [key, val]) => {
    acc[key] = { translation: val };
    return acc;
  }, {})
});

document.getElementById('langSelect').addEventListener('change', (e) => {
  i18next.changeLanguage(e.target.value);
  updateUI();
});

function updateUI() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = i18next.t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = i18next.t(el.getAttribute('data-i18n-placeholder'));
  });
}

// Username validation
document.getElementById('username').addEventListener('blur', (e) => {
  const username = e.target.value.trim();
  if (username) {
    localStorage.setItem('username', username);
    document.getElementById('tmdbSection').style.display = 'block';
    document.getElementById('listsSection').style.display = 'block';
    document.getElementById('bottomActions').style.display = 'block';
    loadLists(username);
  }
});

// TMDB Key validation
document.getElementById('tmdbKey').addEventListener('blur', (e) => {
  const key = e.target.value.trim();
  if (key) {
    localStorage.setItem('tmdbKey', key);
    document.getElementById('searchSection').style.display = 'block';
  }
});

// Create List
document.getElementById('newListForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = localStorage.getItem('username');
  const name = document.getElementById('listName').value;
  const type = document.getElementById('listType').value;
  
  const res = await fetch('/api/lists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, list: { name, type } })
  });
  
  if (res.ok) {
    loadLists(username);
    e.target.reset();
  }
});

async function loadLists(username) {
  const res = await fetch(`/api/lists?username=${username}`);
  const lists = await res.json();
  
  const display = document.getElementById('listDisplay');
  display.innerHTML = lists.map((list, idx) => `
    <div class="list-item">
      <span><strong>${list.name}</strong> (${list.type})</span>
      <div class="list-actions">
        <button onclick="shareList('${list.id}', '${list.name}')">📤 Compartir</button>
        <button onclick="moveList('${list.id}', ${idx}, -1)">⬆️</button>
        <button onclick="moveList('${list.id}', ${idx}, 1)">⬇️</button>
        <button onclick="deleteList('${list.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
  
  // Update target list dropdown
  document.getElementById('targetList').innerHTML = '<option value="">Selecciona lista...</option>' +
    lists.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
}

async function shareList(id, name) {
  const username = localStorage.getItem('username');
  const lang = i18next.language;
  const text = i18next.t('recommended', { username, listName: name });
  const url = `${window.location.origin}/manifest.json?username=${username}`;
  
  if (navigator.share) {
    await navigator.share({ title: text, text, url });
  } else {
    navigator.clipboard.writeText(`${text}\n${url}`);
    alert('Enlace copiado!');
  }
}

async function deleteList(id) {
  const username = localStorage.getItem('username');
  await fetch(`/api/lists/${id}?username=${username}`, { method: 'DELETE' });
  loadLists(username);
}

// Export
document.getElementById('exportBtn').addEventListener('click', async () => {
  const username = localStorage.getItem('username');
  const res = await fetch(`/api/lists?username=${username}`);
  const lists = await res.json();
  
  const blob = new Blob([JSON.stringify({ username, lists }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `custom-library-${username}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// Copy Install URL
document.getElementById('copyInstallBtn').addEventListener('click', () => {
  const username = localStorage.getItem('username');
  const url = `${window.location.origin}/manifest.json?username=${username}`;
  navigator.clipboard.writeText(url);
  alert('URL copiada!');
});

// Install Direct
document.getElementById('installBtn').addEventListener('click', () => {
  const username = localStorage.getItem('username');
  const url = `stremio://${window.location.host}/manifest.json?username=${username}`;
  window.open(url, '_blank');
});

// TMDB Search (básico)
let searchTimeout;
document.getElementById('searchInput').addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    const q = e.target.value;
    const key = localStorage.getItem('tmdbKey');
    const lang = i18next.language;
    
    if (q.length < 3 || !key) return;
    
    const res = await fetch(`/api/tmdb/search?q=${q}&key=${key}&lang=${lang}`);
    const data = await res.json();
    
    document.getElementById('searchResults').innerHTML = (data.results || []).slice(0, 10).map(item => `
      <div class="search-item">
        <img src="https://image.tmdb.org/t/p/w200${item.poster_path || ''}" alt="${item.title || item.name}">
        <strong>${item.title || item.name}</strong>
        <button onclick="addToList('${item.id}', '${item.media_type}')">+ Añadir</button>
      </div>
    `).join('');
  }, 500);
});

async function addToList(tmdbId, mediaType) {
  const listId = document.getElementById('targetList').value;
  const username = localStorage.getItem('username');
  
  if (!listId) return alert('Selecciona una lista primero');
  
  await fetch(`/api/lists/${listId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, item: { tmdbId, mediaType } })
  });
  
  alert('Añadido!');
}

updateUI();
