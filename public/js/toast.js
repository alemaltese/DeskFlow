window.showToast = function(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const iconHtml = {
        success: '<i class="fa-solid fa-check-circle" style="color:#10b981;font-size:1.1rem;"></i>',
        error:   '<i class="fa-solid fa-circle-exclamation" style="color:#ef4444;font-size:1.1rem;"></i>'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Icon uses trusted static HTML; message uses textContent to prevent XSS
    const iconEl = document.createElement('span');
    iconEl.innerHTML = iconHtml[type] ?? '';

    const textEl = document.createElement('span');
    textEl.style.fontWeight = '500';
    textEl.textContent = message;

    toast.appendChild(iconEl);
    toast.appendChild(textEl);
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
};
