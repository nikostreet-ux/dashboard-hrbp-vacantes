// import vacanciesData from './data.js'; // REMOVED: Now using /api/data

// Configuration & State
const CONFIG = {
  itemsPerPage: 10,
  colors: {
    activa: '#00c9a7',
    cerrada: '#0d97ff',
    cancelada: '#ef4444',
    standby: '#8b5cf6',
    ttf: '#f59e0b',
    text: '#0f172a',
    muted: '#64748b'
  }
};

let state = {
  data: [], // Starts empty
  filteredData: [],
  currentPage: 1,
  sortBy: 'Fecha Inicio Búsqueda',
  sortOrder: 'desc',
  filters: {
    search: '',
    hrbp: '',
    gerencia: '',
    pais: '',
    estado: '',
    motivo: '',
    familia: '',
    equipo: ''
  },
  activeTab: 'all',
  statusColumnName: '' // Dynamic: e.g. "Status 23 marzo"
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
  fetchData();
});

async function fetchData() {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) throw new Error('Failed to fetch data from API');
    
    const payload = await response.json();
    // Normalize data: parse TTF as number, keep rest as-is
    state.data = (payload.rows || []).map(row => ({
      ...row,
      TTF: parseInt(row.TTF) || 0
    }));
    state.filteredData = [...state.data];
    state.statusColumnName = payload.statusColumnName || '';

    // Update the Status column header dynamically
    const thStatus = document.getElementById('th-status');
    if (thStatus && state.statusColumnName) {
      thStatus.innerHTML = `${state.statusColumnName} <span class="sort-icon">↕</span>`;
      thStatus.setAttribute('data-sort', state.statusColumnName);
    }

    // Continue initialization
    initFilters();
    applyFilters();
    initEventListeners();
    updateLastUpdate();
    
    if (payload.updatedAt) {
      const date = new Date(payload.updatedAt);
      document.getElementById('last-update').textContent = `Actualizado (Sharepoint): ${date.toLocaleDateString()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    // Fallback or error message
    document.getElementById('table-body').innerHTML = `<tr><td colspan="11"><div class="empty-state"><div class="empty-icon">⚠️</div><p>No se pudo cargar la data de Sharepoint. Verifica la configuración.</p></div></td></tr>`;
  }
}

function updateLastUpdate() {
  const now = new Date();
  const el = document.getElementById('last-update');
  if (el) el.textContent = `Actualizado: ${now.toLocaleDateString()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function initFilters() {
  // Populate HRBP filter dynamically
  const hrbps = [...new Set(state.data.map(v => v.HRBP))].filter(Boolean).sort();
  const fHrbp = document.getElementById('f-hrbp');
  const mHrbp = document.getElementById('m-hrbp');
  
  hrbps.forEach(h => {
    const opt = document.createElement('option');
    opt.value = opt.textContent = h;
    fHrbp.appendChild(opt.cloneNode(true));
    mHrbp.appendChild(opt);
  });

  // Populate Gerencia filter dynamically
  const gerencias = [...new Set(state.data.map(v => v['Gerencia Madre']))].filter(Boolean).sort();
  const fGerencia = document.getElementById('f-gerencia');
  const mGerencia = document.getElementById('m-gerencia');
  
  gerencias.forEach(g => {
    const opt = document.createElement('option');
    opt.value = opt.textContent = g;
    if (fGerencia) fGerencia.appendChild(opt.cloneNode(true));
    if (mGerencia) mGerencia.appendChild(opt);
  });
}

function initEventListeners() {
  // Filter inputs
  const filterIds = ['search', 'f-hrbp', 'f-gerencia', 'f-pais', 'f-estado', 'f-motivo', 'f-familia', 'f-equipo'];
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
  const btnPdf = document.getElementById('btn-pdf');
  if (btnPdf) btnPdf.addEventListener('click', exportToPDF);

  // Save new vacante
  document.getElementById('btn-save-vacante').addEventListener('click', submitNewVacante);
}

// ─── CORE LOGIC ───

function applyFilters() {
  state.filteredData = state.data.filter(v => {
    const matchesSearch = !state.filters.search || 
      (v.Cargo && v.Cargo.toLowerCase().includes(state.filters.search.toLowerCase())) ||
      (v['Gerencia Madre'] && v['Gerencia Madre'].toLowerCase().includes(state.filters.search.toLowerCase())) ||
      (v.HRBP && v.HRBP.toLowerCase().includes(state.filters.search.toLowerCase()));
    
    const matchesHrbp = !state.filters.hrbp || v.HRBP === state.filters.hrbp;
    const matchesGerencia = !state.filters.gerencia || v['Gerencia Madre'] === state.filters.gerencia;
    const matchesPais = !state.filters.pais || v.País === state.filters.pais;
    const matchesEstado = !state.filters.estado || v.Estado === state.filters.estado;
    const matchesMotivo = !state.filters.motivo || v["Motivo de Busqueda"] === state.filters.motivo;
    const matchesFamilia = !state.filters.familia || v["Familia de cargo"] === state.filters.familia;
    const matchesEquipo = !state.filters.equipo || v["Equipo TA"] === state.filters.equipo;
    
    // Tab filter
    let matchesTab = true;
    if (state.activeTab === 'activa') matchesTab = v.Estado === 'Activa';
    else if (state.activeTab === 'cerrada') matchesTab = v.Estado === 'Cerrada';

    return matchesSearch && matchesHrbp && matchesGerencia && matchesPais && matchesEstado && 
           matchesMotivo && matchesFamilia && matchesEquipo && matchesTab;
  });

  // Sorting
  state.filteredData.sort((a, b) => {
    let valA = a[state.sortBy];
    let valB = b[state.sortBy];
    
    // Handle dates
    if (state.sortBy && state.sortBy.includes('Fecha')) {
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
    cancelada: state.filteredData.filter(v => v.Estado === 'Cancelada' || v.Estado === 'Cancelada ').length,
    standby: state.filteredData.filter(v => v.Estado === 'Stand By').length,
  };

  const ttfValues = state.filteredData
    .filter(v => v.Estado === 'Activa' && typeof v.TTF === 'number')
    .map(v => v.TTF);
  const avgTTF = ttfValues.length ? Math.round(ttfValues.reduce((a, b) => a + b, 0) / ttfValues.length) : 0;

  const forecast = {
    si: state.filteredData.filter(v => v.Forecast === 'Si').length,
    no: state.filteredData.filter(v => v.Forecast === 'No').length,
    pdte: state.filteredData.filter(v => v.Forecast === 'Pendiente' || !v.Forecast).length
  };

  animateValue('kpi-activa', totals.activa);
  animateValue('kpi-cerrada', totals.cerrada);
  animateValue('kpi-cancelada', totals.cancelada);
  animateValue('kpi-standby', totals.standby);
  animateValue('kpi-ttf', avgTTF);

  const forecastEl = document.getElementById('kpi-forecast');
  if (forecastEl) {
    forecastEl.innerHTML = `<span style="color:var(--success)">${forecast.si}</span> <small style="color:var(--text-dim); font-weight:400; font-size:12px;">Si</small> / <span style="color:var(--danger)">${forecast.no}</span> <small style="color:var(--text-dim); font-weight:400; font-size:12px;">No</small> / <span style="color:var(--text-muted)">${forecast.pdte}</span> <small style="color:var(--text-dim); font-weight:400; font-size:12px;">Pdte</small>`;
  }

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
    const key = v.HRBP || 'Sin HRBP';
    if (!hrbpGroups[key]) hrbpGroups[key] = { Activa: 0, Cerrada: 0, Otr: 0 };
    if (v.Estado === 'Activa') hrbpGroups[key].Activa++;
    else if (v.Estado === 'Cerrada') hrbpGroups[key].Cerrada++;
    else hrbpGroups[key].Otr++;
  });

  const hrbpLabels = Object.keys(hrbpGroups);
  updateChart('Hrbp', 'bar', {
    labels: hrbpLabels,
    datasets: [
      { label: 'Activas', data: hrbpLabels.map(l => hrbpGroups[l].Activa), backgroundColor: CONFIG.colors.activa },
      { label: 'Cerradas', data: hrbpLabels.map(l => hrbpGroups[l].Cerrada), backgroundColor: CONFIG.colors.cerrada },
      { label: 'Otras', data: hrbpLabels.map(l => hrbpGroups[l].Otr), backgroundColor: '#cbd5e1' }
    ]
  }, { indexAxis: 'y', scales: { x: { stacked: true, grid: { color: '#f1f5f9' } }, y: { stacked: true, grid: { display: false } } } });

  // Chart Pais
  const paisGroups = countBy(state.filteredData, 'País');
  updateChart('Pais', 'doughnut', {
    labels: Object.keys(paisGroups),
    datasets: [{ 
      data: Object.values(paisGroups), 
      backgroundColor: ['#0d97ff', '#7c3aed', '#00c9a7', '#f59e0b', '#ef4444'] 
    }]
  }, { cutout: '70%', plugins: { legend: { display: true, position: 'right' } } });

  // Chart Motivo
  const motivoGroups = countBy(state.filteredData, 'Motivo de Busqueda');
  updateChart('Motivo', 'pie', {
    labels: Object.keys(motivoGroups),
    datasets: [{ 
      data: Object.values(motivoGroups), 
      backgroundColor: ['#00c9a7', '#8b5cf6', '#3b82f6', '#f59e0b'] 
    }]
  }, { plugins: { legend: { display: true, position: 'right' } } });

  // Chart Familia (ONLY ACTIVE)
  const activeVacancies = state.filteredData.filter(v => v.Estado === 'Activa');
  const famGroups = countBy(activeVacancies, 'Familia de cargo');
  const sortedFam = Object.entries(famGroups).sort((a,b) => b[1] - a[1]);
  updateChart('Familia', 'bar', {
    labels: sortedFam.map(i => i[0]),
    datasets: [{ 
      label: 'Vacantes Activas',
      data: sortedFam.map(i => i[1]), 
      backgroundColor: '#0d97ff'
    }]
  }, { 
    indexAxis: 'y', 
    scales: { 
      x: { grid: { color: '#f1f5f9' } }, 
      y: { grid: { display: false } } 
    },
    plugins: { legend: { display: false } }
  });
}

function updateChart(id, type, data, options = {}) {
  const ctx = document.getElementById(`chart${id}`);
  if (!ctx) return;
  if (charts[id.toLowerCase()]) charts[id.toLowerCase()].destroy();
  
  charts[id.toLowerCase()] = new Chart(ctx, {
    type,
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { display: true, position: 'bottom', labels: { color: '#64748b', boxWidth: 10, font: { size: 10, weight: '600' } } }
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

// Converts ISO date strings ("2026-03-24T00:00:00.000Z") to "DD-MM-AAAA"
function formatDate(dateStr) {
  if (!dateStr || dateStr === '—') return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr; // return as-is if unparseable
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

function renderTable() {
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';
  
  const start = (state.currentPage - 1) * CONFIG.itemsPerPage;
  const pageData = state.filteredData.slice(start, start + CONFIG.itemsPerPage);

  if (pageData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11"><div class="empty-state"><div class="empty-icon">📂</div><p>No se encontraron vacantes con los filtros aplicados</p></div></td></tr>`;
    updatePagination(0);
    return;
  }

  pageData.forEach(v => {
    const tr = document.createElement('tr');
    const statusVal = state.statusColumnName ? (v[state.statusColumnName] || '—') : '—';
    tr.innerHTML = `
      <td>${v.HRBP || '—'}</td>
      <td><span class="country-flag">${getFlag(v.País)}</span> ${v.País || '—'}</td>
      <td class="truncate" title="${v.Cargo || ''}">${v.Cargo || '—'}</td>
      <td class="truncate" title="${v['Gerencia Madre'] || ''}">${v['Gerencia Madre'] || '—'}</td>
      <td><span class="badge badge-${(v.Estado || '').toLowerCase().replace(' ', '')}"><span class="badge-dot"></span>${v.Estado || '—'}</span></td>
      <td><small>${statusVal}</small></td>
      <td><small>${v["Motivo de Busqueda"] || '—'}</small></td>
      <td><small>${v["Familia de cargo"] || '—'}</small></td>
      <td><span class="ttf-pill ${getTTFClass(v.TTF)}">${v.TTF || 0}d</span></td>
      <td>${formatDate(v["Fecha Inicio Búsqueda"])}</td>
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
  
  const statusLabel = state.statusColumnName || 'Status';
  const statusValue = state.statusColumnName ? (v[state.statusColumnName] || '—') : '—';

  content.innerHTML = `
    <div class="detail-section">
      <h5>Información General</h5>
      <div class="detail-row"><span class="detail-key">Estado</span><span class="detail-val"><span class="badge badge-${(v.Estado || '').toLowerCase().replace(' ', '')}">${v.Estado || '—'}</span></span></div>
      <div class="detail-row"><span class="detail-key">${statusLabel}</span><span class="detail-val"><b>${statusValue}</b></span></div>
      <div class="detail-row"><span class="detail-key">Gerencia Madre</span><span class="detail-val">${v['Gerencia Madre'] || '—'}</span></div>
      <div class="detail-row"><span class="detail-key">HRBP</span><span class="detail-val">${v.HRBP || '—'}</span></div>
      <div class="detail-row"><span class="detail-key">Líder</span><span class="detail-val">${v.Líder || '—'}</span></div>
      <div class="detail-row"><span class="detail-key">País</span><span class="detail-val">${v.País || '—'}</span></div>
      <div class="detail-row"><span class="detail-key">¿A quién reemplaza?</span><span class="detail-val">${v['¿A quién reemplaza?'] || '—'}</span></div>
      <div class="detail-row"><span class="detail-key">Motivo</span><span class="detail-val">${v['Motivo de Busqueda'] || '—'}</span></div>
      <div class="detail-row"><span class="detail-key">Familia de Cargo</span><span class="detail-val">${v['Familia de cargo'] || '—'}</span></div>
      <div class="detail-row"><span class="detail-key">Banda</span><span class="detail-val">${v.Banda || '—'}</span></div>
      <div class="detail-row"><span class="detail-key">Tipo de Movimiento</span><span class="detail-val">${v['Tipo de Movimiento'] || '—'}</span></div>
    </div>
    <div class="detail-section">
      <h5>Proceso TA</h5>
      <div class="detail-row"><span class="detail-key">Coordinador</span><span class="detail-val">${v['Coordinador TA Responsable'] || '—'}</span></div>
      <div class="detail-row"><span class="detail-key">Equipo</span><span class="detail-val">${v['Equipo TA'] || '—'}</span></div>
      <div class="detail-row"><span class="detail-key">TTF Acumulado</span><span class="detail-val"><b>${v.TTF || 0} días</b></span></div>
      <div class="detail-row"><span class="detail-key">Forecast</span><span class="detail-val">${v.Forecast || '—'}</span></div>
      <div class="detail-row"><span class="detail-key">Nombre Candidato</span><span class="detail-val">${v['Nombre candidato seleccionado'] || '—'}</span></div>
    </div>
    <div class="detail-section">
      <h5>Fechas</h5>
      <div class="detail-row"><span class="detail-key">Inicio Búsqueda</span><span class="detail-val">${formatDate(v['Fecha Inicio Búsqueda'])}</span></div>
      <div class="detail-row"><span class="detail-key">Fecha Ingreso</span><span class="detail-val">${formatDate(v['Fecha Ingreso'])}</span></div>
      <div class="detail-row"><span class="detail-key">Fecha Cubierta</span><span class="detail-val">${formatDate(v['Fecha Cubierta Búsqueda'])}</span></div>
      <div class="detail-row"><span class="detail-key">Ceco</span><span class="detail-val">${v.Ceco || '—'}</span></div>
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

function exportToPDF() {
  const element = document.querySelector('.main');
  const opt = {
    margin:       0.2,
    filename:     `vacantes_mallplaza_${new Date().toISOString().split('T')[0]}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'in', format: 'a3', orientation: 'landscape' }
  };
  
  html2pdf().set(opt).from(element).save();
}

function submitNewVacante() {
  const payload = {
    "HRBP": document.getElementById('m-hrbp').value,
    "País": document.getElementById('m-pais').value,
    "Cargo": document.getElementById('m-cargo').value,
    "Gerencia Madre": document.getElementById('m-gerencia').value,
    "Líder": document.getElementById('m-lider').value,
    "Coordinador TA Responsable": document.getElementById('m-coord').value,
    "Estado": document.getElementById('m-estado').value,
    "Motivo de Busqueda": document.getElementById('m-motivo').value,
    "Familia de cargo": document.getElementById('m-familia').value,
    "Equipo TA": document.getElementById('m-equipo').value,
    "Fecha Inicio Búsqueda": document.getElementById('m-fecha').value,
    "TTF": document.getElementById('m-ttf').value,
    "¿A quién reemplaza?": document.getElementById('m-reemplaza').value,
    "Forecast": document.getElementById('m-forecast').value,
    "Fecha Ingreso": document.getElementById('m-fecha-ingreso').value,
    "Fecha Cubierta Búsqueda": document.getElementById('m-fecha-cubierta').value,
    "Tipo de Movimiento": document.getElementById('m-tipo').value,
    "Banda": document.getElementById('m-banda').value,
    "Ceco": document.getElementById('m-ceco').value,
    "Nombre candidato seleccionado": document.getElementById('m-candidato').value,
    "Comentarios": document.getElementById('m-comentarios').value
  };
  
  if (!payload["HRBP"] || !payload["País"] || !payload["Cargo"] || !payload["Estado"]) {
    alert('Por favor complete todos los campos obligatorios (*)');
    return;
  }

  console.log("PAYLOAD LISTO PARA ENVIAR AL BACKEND (Power Automate):", payload);
  alert("Simulación de envío completada. Revisa la consola para ver los datos capturados.\nUna vez configures Power Automate, los datos se enviarán hacia Excel.");
  
  document.getElementById('modal-overlay').classList.remove('open');
}

