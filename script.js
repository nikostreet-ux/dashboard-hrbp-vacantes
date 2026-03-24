import vacanciesData from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('table-body');
    const filterDept = document.getElementById('filter-dept');
    const filterHRBP = document.getElementById('filter-hrbp');
    const filterStatus = document.getElementById('filter-status');
    const searchInput = document.getElementById('search-input');
    const totalVacanciesEl = document.getElementById('total-vacancies');
    const activeVacanciesEl = document.getElementById('active-vacancies');
    const closedVacanciesEl = document.getElementById('closed-vacancies');
    const currentDateEl = document.getElementById('current-date');

    let currentData = [...vacanciesData];
    let sortConfig = { key: null, direction: 'asc' };

    // Set current date
    const now = new Date();
    currentDateEl.textContent = now.toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    function renderTable(data) {
        tableBody.innerHTML = '';
        data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="font-weight: 600;">${item.role}</td>
                <td>${item.department}</td>
                <td>${item.hrbp}</td>
                <td>${new Date(item.postedDate).toLocaleDateString('es-ES')}</td>
                <td style="text-align: center;">${item.applicants}</td>
                <td><span class="priority-${item.priority.toLowerCase()}">${item.priority}</span></td>
                <td><span class="status-badge status-${item.status.toLowerCase().replace(' ', '-')}">${item.status}</span></td>
            `;
            tableBody.appendChild(row);
        });
        updateStats(data);
    }

    function updateStats(data) {
        totalVacanciesEl.textContent = data.length;
        activeVacanciesEl.textContent = data.filter(v => v.status !== 'Closed').length;
        closedVacanciesEl.textContent = data.filter(v => v.status === 'Closed').length;
    }

    function applyFilters() {
        const deptValue = filterDept.value;
        const hrbpValue = filterHRBP.value;
        const statusValue = filterStatus.value;
        const searchText = searchInput.value.toLowerCase();

        currentData = vacanciesData.filter(item => {
            const matchDept = deptValue === 'all' || item.department === deptValue;
            const matchHRBP = hrbpValue === 'all' || item.hrbp === hrbpValue;
            const matchStatus = statusValue === 'all' || item.status === statusValue;
            const matchSearch = item.role.toLowerCase().includes(searchText) || 
                               item.id.toLowerCase().includes(searchText);

            return matchDept && matchHRBP && matchStatus && matchSearch;
        });

        if (sortConfig.key) {
            sortData(sortConfig.key, sortConfig.direction);
        } else {
            renderTable(currentData);
        }
    }

    function sortData(key, direction) {
        sortConfig = { key, direction };
        currentData.sort((a, b) => {
            let valA = a[key];
            let valB = b[key];

            if (key === 'postedDate') {
                valA = new Date(valA);
                valB = new Date(valB);
            }

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        renderTable(currentData);
    }

    // Event Listeners
    filterDept.addEventListener('change', applyFilters);
    filterHRBP.addEventListener('change', applyFilters);
    filterStatus.addEventListener('change', applyFilters);
    searchInput.addEventListener('input', applyFilters);

    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.getAttribute('data-sort');
            const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
            
            // Remove sort indicators from all headers
            document.querySelectorAll('th').forEach(h => h.innerHTML = h.textContent);
            
            // Add indicator to current header
            th.innerHTML = `${th.textContent} ${direction === 'asc' ? '↑' : '↓'}`;
            
            sortData(key, direction);
        });
    });

    // Initial render
    renderTable(currentData);
});
