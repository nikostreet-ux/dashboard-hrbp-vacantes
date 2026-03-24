import vacanciesData from './data.js';

// Configuration & State
const CONFIG = {
  itemsPerPage: 10,
  colors: {
    activa: '#00c9a7',
    cerrada: '#0d97ff',
    cancelada: '#f85149',
    standby: '#a371f7',
    ttf: '#f7a325',
    text: '#e6edf3',
    muted: '#7d8590'
  }
};

let state = {
  data: [...vacanciesData],
  filteredData: [...vacanciesData],
  currentPage: 1,
  sortBy: 'Fecha Inicio Búsqueda',
  sortOrder: 'desc',
  filters: {
    search: '',
    hrbp: '',
    pais: '',
    estado: '',
    motivo: '',
    familia: '',
    equipo: ''
  },
  activeTab: 'all'
};

// Charts instances
let charts = {
  hrbp: null,
  pais: null,
  motivo: null,
  familia: null
};

// ─── INITIALIZATION ───
document.addEventListener('DOMContentLoaded', () => {
  initFilters();
  applyFilters();
  initEventListeners();
  updateLastUpdate();
});

function updateLastUpdate() {
  const now = new Date();
  const el = document.getElementById('last-update');
  if (el) el.textContent = `Actualizado: ${now.toLocaleDateString()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function initFilters() {
  // Populate HRBP filter dynamically
  const hrbps = [...new Set(vacanciesData.map(v => v.HRBP))].filter(Boolean).sort();
  const fHrbp = document.getElementById('f-hrbp');
  const mHrbp = document.getElementById('m-hrbp');
  
  hrbps.forEach(h => {
    const opt = document.createElement('option');
    opt.value = opt.textContent = h;
    fHrbp.appendChild(opt.cloneNode(true));
    mHrbp.appendChild(opt);
  });
}

function initEventListeners() {
  // Filter inputs
  const filterIds = ['search', 'f-hrbp', 'f-pais', 'f-estado', 'f-motivo', 'f-familia', 'f-equipo'];
  filterIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', (e) => {
      const key = id.startsWith('f-') ? id.replace('f-', '') : id;
      state.filters[key] = e.target.value;
      state.currentPage = 1;
      applyFilters();
    });
  });

  // Reset filters
  document.getElementById('btn-reset').addEventListener('click', () => {
    filterIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    Object.keys(state.filters).forEach(k => state.filters[k] = '');
    state.currentPage = 1;
    applyFilters();
  });

  // Sorting
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (state.sortBy === field) {
        state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortBy = field;
        state.sortOrder = 'asc';
      }
      applyFilters();
    });
  });

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeTab = tab.dataset.tab;
      state.currentPage = 1;
      applyFilters();
    });
  });

  // Modal handlers
  const modal = document.getElementById('modal-overlay');
  document.getElementById('btn-new-vacante').addEventListener('click', () => {
    modal.classList.add('open');
    document.getElementById('modal-title').textContent = '+ Nueva Vacante';
  });
  
  const closeModal = () => modal.classList.remove('open');
  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);

  // Detail panel handler
  document.getElementById('btn-close-detail').addEventListener('click', () => {
    document.getElementById('detail-panel').classList.remove('open');
  });

  // Export
  document.getElementById('btn-export').addEventListener('click', exportToCSV);
}

// ─── CORE LOGIC ───

function applyFilters() {
  state.filteredData = state.data.filter(v => {
    const matchesSearch = !state.filters.search || 
      v.Cargo.toLowerCase().includes(state.filters.search.toLowerCase()) ||
      v.Gerencia.toLowerCase().includes(state.filters.search.toLowerCase()) ||
      v.HRBP.toLowerCase().includes(state.filters.search.toLowerCase());
    
    const matchesHrbp = !state.filters.hrbp || v.HRBP === state.filters.hrbp;
    const matchesPais = !state.filters.pais || v.País === state.filters.pais;
    const matchesEstado = !state.filters.estado || v.Estado === state.filters.estado;
    const matchesMotivo = !state.filters.motivo || v["Motivo de Busqueda"] === state.filters.motivo;
    const matchesFamilia = !state.filters.familia || v["Familia de cargo"] === state.filters.familia;
    const matchesEquipo = !state.filters.equipo || v["Equipo TA"] === state.filters.equipo;
    
    // Tab filter
    let matchesTab = true;
    if (state.activeTab === 'activa') matchesTab = v.Estado === 'Activa';
    else if (state.activeTab === 'cerrada') matchesTab = v.Estado === 'Cerrada';

    return matchesSearch && matchesHrbp && matchesPais && matchesEstado && 
           matchesMotivo && matchesFamilia && matchesEquipo && matchesTab;
  });

  // Sorting
  state.filteredData.sort((a, b) => {
    let valA = a[state.sortBy];
    let valB = b[state.sortBy];
    
    // Handle dates
    if (state.sortBy.includes('Fecha')) {
      valA = new Date(valA || 0);
      valB = new Date(valB || 0);
    }
    
    if (valA < valB) return state.sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return state.sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  updateUI();
}

function updateUI() {
  renderKPIs();
  renderCharts();
  renderTable();
  renderActiveFilters();
}

function renderKPIs() {
  const totals = {
    activa: state.filteredData.filter(v => v.Estado === 'Activa').length,
    cerrada: state.filteredData.filter(v => v.Estado === 'Cerrada').length,
    cancelada: state.filteredData.filter(v => v.Estado === 'Cancelada').length,
    standby: state.filteredData.filter(v => v.Estado === 'Stand By').length,
  };

  const ttfValues = state.filteredData
    .filter(v => v.Estado === 'Activa' && typeof v.TTF === 'number')
    .map(v => v.TTF);
  const avgTTF = ttfValues.length ? Math.round(ttfValues.reduce((a, b) => a + b, 0) / ttfValues.length) : 0;

  animateValue('kpi-activa', totals.activa);
  animateValue('kpi-cerrada', totals.cerrada);
  animateValue('kpi-cancelada', totals.cancelada);
  animateValue('kpi-standby', totals.standby);
  animateValue('kpi-ttf', avgTTF);

  document.getElementById('kpi-activa-sub').textContent = `${((totals.activa / (state.filteredData.length || 1)) * 100).toFixed(1)}% del total`;
  document.getElementById('kpi-cerrada-sub').textContent = `${((totals.cerrada / (state.filteredData.length || 1)) * 100).toFixed(1)}% del total`;
  document.getElementById('kpi-ttf-sub').textContent = `${ttfValues.length} vacantes activas promediadas`;
}

function animateValue(id, end) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  if (start === end) return;
  
  const duration = 800;
  let startTime = null;

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    el.textContent = Math.floor(progress * (end - start) + start);
    if (progress < 1) window.requestAnimationFrame(step);
  }
  window.requestAnimationFrame(step);
}

function renderCharts() {
  // Chart HRBP (Stacked Bar)
  const hrbpGroups = {};
  state.filteredData.forEach(v => {
    if (!hrbpGroups[v.HRBP]) hrbpGroups[v.HRBP] = { Activa: 0, Cerrada: 0, Otr: 0 };
    if (v.Estado === 'Activa') hrbpGroups[v.HRBP].Activa++;
    else if (v.Estado === 'Cerrada') hrbpGroups[v.HRBP].Cerrada++;
    else hrbpGroups[v.HRBP].Otr++;
  });

  const hrbpLabels = Object.keys(hrbpGroups);
  updateChart('hrbp', 'bar', {
    labels: hrbpLabels,
    datasets: [
      { label: 'Activas', data: hrbpLabels.map(l => hrbpGroups[l].Activa), backgroundColor: CONFIG.colors.activa },
      { label: 'Cerradas', data: hrbpLabels.map(l => hrbpGroups[l].Cerrada), backgroundColor: CONFIG.colors.cerrada },
      { label: 'Otras', data: hrbpLabels.map(l => hrbpGroups[l].Otr), backgroundColor: CONFIG.colors.muted }
    ]
  }, { indexAxis: 'y', scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, grid: { display: false } } } });

  // Chart Pais
  const paisGroups = countBy(state.filteredData, 'País');
  updateChart('pais', 'doughnut', {
    labels: Object.keys(paisGroups),
    datasets: [{ data: Object.values(paisGroups), backgroundColor: [CONFIG.colors.accent2, CONFIG.colors.standby, CONFIG.colors.accent] }]
  }, { cutout: '70%' });

  // Chart Motivo
  const motivoGroups = countBy(state.filteredData, 'Motivo de Busqueda');
  updateChart('motivo', 'pie', {
    labels: Object.keys(motivoGroups),
    datasets: [{ data: Object.values(motivoGroups), backgroundColor: [CONFIG.colors.activa, CONFIG.colors.standby] }]
  });

  // Chart Familia
  const famGroups = countBy(state.filteredData, 'Familia de cargo');
  updateChart('familia', 'polarArea', {
    labels: Object.keys(famGroups),
    datasets: [{ data: Object.values(famGroups), backgroundColor: [
      'rgba(0, 201, 167, 0.4)', 'rgba(13, 151, 255, 0.4)', 'rgba(247, 163, 37, 0.4)', 
      'rgba(163, 113, 247, 0.4)', 'rgba(248, 81, 73, 0.4)', 'rgba(255, 255, 255, 0.2)'
    ]}]
  });
}

function updateChart(id, type, data, options = {}) {
  const ctx = document.getElementById(`chart${id.charAt(0).toUpperCase() + id.slice(1)}`);
  if (!ctx) return;
  if (charts[id]) charts[id].destroy();
  
  charts[id] = new Chart(ctx, {
    type,
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { display: id !== 'hrbp', position: 'bottom', labels: { color: CONFIG.colors.text, boxWidth: 10, font: { size: 10 } } }
      },
      ...options
    }
  });
}

function countBy(arr, key) {
  return arr.reduce((acc, obj) => {
    const val = obj[key] || 'Sin especificar';
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
}

function renderTable() {
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';
  
  const start = (state.currentPage - 1) * CONFIG.itemsPerPage;
  const pageData = state.filteredData.slice(start, start + CONFIG.itemsPerPage);

  if (pageData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">📂</div><p>No se encontraron vacantes con los filtros aplicados</p></div></td></tr>`;
    updatePagination(0);
    return;
  }

  pageData.forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${v.HRBP}</td>
      <td><span class="country-flag">${getFlag(v.País)}</span> ${v.País}</td>
      <td class="truncate" title="${v.Cargo}">${v.Cargo}</td>
      <td class="truncate" title="${v.Gerencia}">${v.Gerencia}</td>
      <td><span class="badge badge-${v.Estado.toLowerCase().replace(' ', '')}"><span class="badge-dot"></span>${v.Estado}</span></td>
      <td><small>${v["Motivo de Busqueda"]}</small></td>
      <td><small>${v["Familia de cargo"]}</small></td>
      <td><span class="ttf-pill ${getTTFClass(v.TTF)}">${v.TTF}d</span></td>
      <td>${v["Fecha Inicio Búsqueda"]}</td>
      <td class="row-actions">
        <button class="icon-btn btn-view" title="Ver detalle">👁</button>
        <button class="icon-btn" title="Editar">✎</button>
      </td>
    `;
    
    tr.querySelector('.btn-view').addEventListener('click', () => showDetail(v));
    tbody.appendChild(tr);
  });

  updatePagination(state.filteredData.length);
  updateSortHeaders();
}

function getFlag(pais) {
  const flags = { 'Chile': '🇨🇱', 'Perú': '🇵🇪', 'Colombia': '🇨🇴' };
  return flags[pais] || '🏳️';
}

function getTTFClass(days) {
  if (days > 45) return 'ttf-high';
  if (days > 20) return 'ttf-mid';
  return 'ttf-low';
}

function updatePagination(total) {
  const totalPages = Math.ceil(total / CONFIG.itemsPerPage);
  const info = document.getElementById('page-info');
  info.textContent = `Mostrando ${Math.min(state.currentPage * CONFIG.itemsPerPage, total)} de ${total} vacantes`;
  
  const controls = document.getElementById('page-controls');
  controls.innerHTML = '';
  
  if (totalPages <= 1) return;
  
  const addBtn = (label, page, isActive = false, isDisabled = false) => {
    const btn = document.createElement('button');
    btn.className = `page-btn ${isActive ? 'active' : ''}`;
    btn.textContent = label;
    btn.disabled = isDisabled;
    btn.onclick = () => { state.currentPage = page; applyFilters(); };
    controls.appendChild(btn);
  };
  
  addBtn('«', 1, false, state.currentPage === 1);
  addBtn('<', state.currentPage - 1, false, state.currentPage === 1);
  
  let start = Math.max(1, state.currentPage - 1);
  let end = Math.min(totalPages, start + 2);
  if (end === totalPages) start = Math.max(1, end - 2);

  for (let i = start; i <= end; i++) {
    addBtn(i, i, i === state.currentPage);
  }
  
  addBtn('>', state.currentPage + 1, false, state.currentPage === totalPages);
  addBtn('»', totalPages, false, state.currentPage === totalPages);
}

function updateSortHeaders() {
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.classList.toggle('sorted', th.dataset.sort === state.sortBy);
    const icon = th.querySelector('.sort-icon');
    if (th.dataset.sort === state.sortBy) {
      icon.textContent = state.sortOrder === 'asc' ? '↑' : '↓';
    } else {
      icon.textContent = '↕';
    }
  });
}

function renderActiveFilters() {
  const container = document.getElementById('active-filters');
  container.innerHTML = '';
  
  const countEl = document.getElementById('filter-count');
  let activeCount = 0;

  Object.entries(state.filters).forEach(([key, val]) => {
    if (!val) return;
    activeCount++;
    const tag = document.createElement('div');
    tag.className = 'filter-tag';
    tag.innerHTML = `${val} <button data-key="${key}">×</button>`;
    tag.querySelector('button').onclick = () => {
      state.filters[key] = '';
      const el = document.getElementById(key === 'search' ? 'search' : `f-${key}`);
      if (el) el.value = '';
      applyFilters();
    };
    container.appendChild(tag);
  });
  
  countEl.textContent = activeCount ? `${activeCount} filtros aplicados` : 'Sin filtros';
}

function showDetail(v) {
  const panel = document.getElementById('detail-panel');
  const title = document.getElementById('detail-title');
  const content = document.getElementById('detail-content');
  
  title.textContent = v.Cargo;
  
  content.innerHTML = `
    <div class="detail-section">
      <h5>Información General</h5>
      <div class="detail-row"><span class="detail-key">Estado</span><span class="detail-val"><span class="badge badge-${v.Estado.toLowerCase().replace(' ', '')}">${v.Estado}</span></span></div>
      <div class="detail-row"><span class="detail-key">Gerencia</span><span class="detail-val">${v.Gerencia}</span></div>
      <div class="detail-row"><span class="detail-key">HRBP</span><span class="detail-val">${v.HRBP}</span></div>
      <div class="detail-row"><span class="detail-key">Líder</span><span class="detail-val">${v.Líder}</span></div>
      <div class="detail-row"><span class="detail-key">País</span><span class="detail-val">${v.País}</span></div>
    </div>
    <div class="detail-section">
      <h5>Proceso TA</h5>
      <div class="detail-row"><span class="detail-key">Coordinador</span><span class="detail-val">${v["Coordinador TA Responsable"]}</span></div>
      <div class="detail-row"><span class="detail-key">Equipo</span><span class="detail-val">${v["Equipo TA"]}</span></div>
      <div class="detail-row"><span class="detail-key">TTF Acumulado</span><span class="detail-val"><b>${v.TTF} días</b></span></div>
      <div class="detail-row"><span class="detail-key">Inicio</span><span class="detail-val">${v["Fecha Inicio Búsqueda"]}</span></div>
      <div class="detail-row"><span class="detail-key">Forecast</span><span class="detail-val">${v.Forecast}</span></div>
    </div>
    <div class="detail-section">
      <h5>Observaciones</h5>
      <div class="comment-box">${v.Comentarios || 'Sin comentarios registrados.'}</div>
    </div>
    <div style="display:flex;gap:10px;margin-top:20px;">
      <button class="btn btn-primary" style="flex:1">Editar Vacante</button>
      <button class="btn btn-ghost" style="padding:10px;"><span style="font-size:16px;">🗑</span></button>
    </div>
  `;
  
  panel.classList.add('open');
}

function exportToCSV() {
  const headers = Object.keys(state.filteredData[0]);
  const rows = state.filteredData.map(v => headers.map(h => `"${v[h]}"`).join(','));
  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `vacantes_mallplaza_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
