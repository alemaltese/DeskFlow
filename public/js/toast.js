window.showToast = function(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const icons = {
        success: '<i class="fa-solid fa-check-circle" style="color:#10b981;font-size:1.1rem;"></i>',
        error:   '<i class="fa-solid fa-circle-exclamation" style="color:#ef4444;font-size:1.1rem;"></i>'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `${icons[type] ?? ''} <span style="font-weight:500;">${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
};
