let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) { window.location.href = '/login.html'; return; }
        currentUser = await res.json();

        if (currentUser.role !== 'admin' && currentUser.role !== 'operatore') {
            window.location.href = '/dashboard.html';
            return;
        }

        if (window.renderSidebarProfile) renderSidebarProfile(currentUser);

        if (currentUser.role === 'admin') {
            document.getElementById('nav-users').classList.remove('hidden');
            document.getElementById('workloadCard').classList.remove('hidden');
            await Promise.all([loadKPIs(), loadPriorityChart(), loadOperatorChart(), loadWorkload()]);
        } else {
            document.getElementById('operatorChartCard').classList.add('hidden');
            document.querySelector('.page-header p').textContent = 'Le tue statistiche personali sui ticket assegnati.';
            await Promise.all([loadKPIs(), loadPriorityChart()]);
        }
    } catch (err) {
        console.error(err);
    }
});

async function loadKPIs() {
    const stats = await fetch('/api/analytics/summary').then(r => r.json());
    document.getElementById('kpiOpen').textContent         = stats.open ?? 0;
    document.getElementById('kpiResolved').textContent     = stats.resolved ?? 0;
    document.getElementById('kpiFirstResponse').textContent = stats.avgFirstResponse ?? 0;
    document.getElementById('kpiResolution').textContent   = stats.avgResolutionTime ?? 0;
}

async function loadPriorityChart() {
    const data = await fetch('/api/analytics/by-priority').then(r => r.json());
    const colorMap = { bassa: '#94a3b8', media: '#facc15', alta: '#fb923c', urgente: '#f87171' };
    new Chart(document.getElementById('priorityChart').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.priority.charAt(0).toUpperCase() + d.priority.slice(1)),
            datasets: [{ data: data.map(d => d.count), backgroundColor: data.map(d => colorMap[d.priority] ?? '#cbd5e1'), borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

async function loadOperatorChart() {
    const data = await fetch('/api/analytics/by-operator').then(r => r.json());
    new Chart(document.getElementById('operatorChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: data.map(d => d.username),
            datasets: [{ label: 'Ticket Risolti', data: data.map(d => d.resolved_count), backgroundColor: '#6366f1', borderRadius: 4 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
            plugins: { legend: { display: false } }
        }
    });
}

async function loadWorkload() {
    const data = await fetch('/api/analytics/workload').then(r => r.json());
    document.getElementById('workloadContainer').innerHTML = data.map(op => {
        const color = op.active_tickets > 10 ? '#ef4444' : op.active_tickets > 5 ? '#f59e0b' : '#10b981';
        return `<div style="background:#f8fafc;border:1px solid #e2e8f0;padding:.75rem 1rem;border-radius:.5rem;display:flex;align-items:center;gap:.75rem;">
            <strong>${op.username}</strong>
            <span style="background:${color};color:white;padding:.25rem .5rem;border-radius:9999px;font-size:.75rem;font-weight:600;">${op.active_tickets} attivi</span>
        </div>`;
    }).join('');
}
