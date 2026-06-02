document.addEventListener('DOMContentLoaded', () => {
    const storedUser = localStorage.getItem('user');
    
    if (!storedUser) {
        window.location.href = 'auth.html';
        return;
    }

    const user = JSON.parse(storedUser);

    if (user.role !== 'admin') {
        alert('Δεν έχεις δικαίωμα πρόσβασης σε αυτή τη σελίδα.');
        window.location.href = 'index.html';
        return;
    }

    // =============================================
    //  TAB SWITCHING
    // =============================================
    const tabs = document.querySelectorAll('.admin-tab');
    const contents = document.querySelectorAll('.admin-tab-content');
    const loaded = {};

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.dataset.tab;
            document.getElementById(target).classList.add('active');

            // Lazy load data on first tab visit
            if (!loaded[target]) {
                loaded[target] = true;
                if (target === 'tab-users') loadUsers();
                if (target === 'tab-listings') loadListings();
                if (target === 'tab-requests') loadRequests();
            }
        });
    });

    // Load stats immediately (default tab)
    loadAdminStats();

    // =============================================
    //  SEARCH HANDLERS
    // =============================================
    document.getElementById('search-users').addEventListener('input', (e) => {
        filterRows('admin-users-container', e.target.value);
    });
    document.getElementById('search-listings').addEventListener('input', (e) => {
        filterRows('admin-listings-container', e.target.value);
    });

    function filterRows(containerId, query) {
        const container = document.getElementById(containerId);
        const rows = container.querySelectorAll('.admin-row');
        const q = query.toLowerCase();
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(q) ? '' : 'none';
        });
    }
});

// =============================================
//  ANIMATED COUNTER
// =============================================
function animateCounter(elementId, target) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const duration = 1200;
    const start = performance.now();
    target = Number(target) || 0;

    function step(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        el.textContent = Math.round(eased * target);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// =============================================
//  TAB 1: ΣΤΑΤΙΣΤΙΚΑ
// =============================================
async function loadAdminStats() {
    try {
        const response = await fetch('/api/admin/stats');
        const data = await response.json();

        if (response.ok) {
            animateCounter('admin-total-portions', data.totalPortions);
            animateCounter('admin-top-donor-count', data.topDonor ? data.topDonor.portions_given : 0);
            animateCounter('admin-top-meals-count', data.topMeals ? data.topMeals.length : 0);
            renderTopDonor(data.topDonor);
            renderTopMealsStats(data.topMeals);
        }
    } catch (error) {
        console.error('Σφάλμα φόρτωσης στατιστικών:', error);
        document.getElementById('admin-total-portions').textContent = '—';
    }
}

function renderTopDonor(donor) {
    const container = document.getElementById('admin-top-donor-container');
    container.innerHTML = '';
    if (!donor || !donor.name || donor.name === 'Κανένας ακόμα') {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Δεν υπάρχουν δεδομένα ακόμα.</p>';
        return;
    }
    const row = document.createElement('div');
    row.className = 'lb-row lb-top';
    row.innerHTML = `
        <span class="lb-medal gold">🥇</span>
        <div class="lb-info">
            <span class="lb-name">${donor.name}</span>
            <span class="lb-rating" style="color: var(--text-muted);">Περισσότερες προσφορές αυτόν τον μήνα</span>
        </div>
        <div class="lb-portions">
            <span class="lb-portions-count">${donor.portions_given}</span>
            <span class="lb-portions-label">μερίδες</span>
        </div>
    `;
    animateEntrance(row, 0);
    container.appendChild(row);
}

function renderTopMealsStats(meals) {
    const container = document.getElementById('admin-top-meals-container');
    container.innerHTML = '';
    if (!meals || meals.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Δεν υπάρχουν αξιολογημένα γεύματα ακόμα.</p>';
        return;
    }
    meals.forEach((meal, index) => {
        const row = document.createElement('div');
        row.className = 'meal-row';
        const r = Number(meal.avg_rating);
        const full = Math.floor(r);
        const starsStr = '★'.repeat(full) + '☆'.repeat(5 - full);
        row.innerHTML = `
            <div class="meal-info">
                <span class="meal-title">🍲 ${meal.title}</span>
            </div>
            <div class="meal-rating">
                <span class="meal-stars">${starsStr}</span>
                <span class="meal-avg">${r.toFixed(1)}</span>
            </div>
        `;
        animateEntrance(row, index);
        container.appendChild(row);
    });
}

// =============================================
//  TAB 2: ΧΡΗΣΤΕΣ
// =============================================
async function loadUsers() {
    const container = document.getElementById('admin-users-container');
    try {
        const response = await fetch('/api/admin/users');
        const users = await response.json();
        container.innerHTML = '';

        if (users.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Δεν βρέθηκαν χρήστες.</p>';
            return;
        }

        users.forEach((u, index) => {
            const row = document.createElement('div');
            row.className = 'admin-row';
            row.setAttribute('data-user-id', u.id);

            const roleColor = u.role === 'admin' ? '#e05d3a' : '#71717a';
            const roleBadge = u.role === 'admin' ? '🛡️ Admin' : '🎓 Student';
            const dateStr = new Date(u.created_at).toLocaleDateString('el-GR');

            row.innerHTML = `
                <div class="admin-row-info">
                    <div class="admin-row-main">
                        <span class="admin-row-name">${u.name}</span>
                        <span class="admin-row-badge" style="color: ${roleColor};">${roleBadge}</span>
                    </div>
                    <div class="admin-row-meta">
                        <span>📧 ${u.email}</span>
                        <span>💰 ${u.credits} credits</span>
                        <span>📅 ${dateStr}</span>
                    </div>
                </div>
                <div class="admin-row-actions">
                    <button class="admin-btn admin-btn-role" onclick="toggleUserRole(${u.id}, '${u.role}')" title="Αλλαγή ρόλου">
                        ${u.role === 'admin' ? '⬇️ Student' : '⬆️ Admin'}
                    </button>
                    <button class="admin-btn admin-btn-delete" onclick="deleteUser(${u.id}, '${u.name}')" title="Διαγραφή χρήστη">
                        🗑️
                    </button>
                </div>
            `;
            animateEntrance(row, index);
            container.appendChild(row);
        });
    } catch (error) {
        console.error('Σφάλμα φόρτωσης χρηστών:', error);
        container.innerHTML = '<p style="color: #ef4444; text-align: center;">Πρόβλημα στη φόρτωση χρηστών.</p>';
    }
}

window.toggleUserRole = async function(userId, currentRole) {
    const newRole = currentRole === 'admin' ? 'student' : 'admin';
    const confirmed = confirm(`Θέλεις σίγουρα να αλλάξεις τον ρόλο σε "${newRole}";`);
    if (!confirmed) return;

    try {
        const response = await fetch(`/api/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: newRole })
        });
        const result = await response.json();
        if (response.ok) {
            // DOM update χωρίς reload
            const row = document.querySelector(`[data-user-id="${userId}"]`);
            if (row) {
                const roleColor = newRole === 'admin' ? '#e05d3a' : '#71717a';
                const roleBadge = newRole === 'admin' ? '🛡️ Admin' : '🎓 Student';
                row.querySelector('.admin-row-badge').style.color = roleColor;
                row.querySelector('.admin-row-badge').textContent = roleBadge;
                const roleBtn = row.querySelector('.admin-btn-role');
                roleBtn.textContent = newRole === 'admin' ? '⬇️ Student' : '⬆️ Admin';
                roleBtn.setAttribute('onclick', `toggleUserRole(${userId}, '${newRole}')`);
                // Flash animation
                row.style.transition = 'background 0.3s ease';
                row.style.background = 'rgba(224, 93, 58, 0.08)';
                setTimeout(() => { row.style.background = ''; }, 600);
            }
        } else {
            alert(result.error || 'Σφάλμα κατά την αλλαγή ρόλου.');
        }
    } catch (error) {
        alert('Πρόβλημα σύνδεσης με τον server.');
    }
};

window.deleteUser = async function(userId, userName) {
    const confirmed = confirm(`⚠️ Είσαι σίγουρος ότι θέλεις να διαγράψεις τον χρήστη "${userName}";\n\nΑυτή η ενέργεια είναι μη αναστρέψιμη!`);
    if (!confirmed) return;

    try {
        const response = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok) {
            removeRowAnimated(`[data-user-id="${userId}"]`);
        } else {
            alert(result.error || 'Σφάλμα κατά τη διαγραφή.');
        }
    } catch (error) {
        alert('Πρόβλημα σύνδεσης με τον server.');
    }
};

// =============================================
//  TAB 3: ΑΓΓΕΛΙΕΣ
// =============================================
async function loadListings() {
    const container = document.getElementById('admin-listings-container');
    try {
        const response = await fetch('/api/admin/listings');
        const listings = await response.json();
        container.innerHTML = '';

        if (listings.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Δεν βρέθηκαν αγγελίες.</p>';
            return;
        }

        listings.forEach((listing, index) => {
            const row = document.createElement('div');
            row.className = 'admin-row';
            row.setAttribute('data-listing-id', listing.id);

            const statusColors = {
                active: '#10b981',
                inactive: '#f59e0b',
                deleted: '#ef4444'
            };
            const statusLabels = {
                active: '🟢 Ενεργή',
                inactive: '🟡 Ανενεργή',
                deleted: '🔴 Διαγραμμένη'
            };

            const statusColor = statusColors[listing.status] || '#71717a';
            const statusLabel = statusLabels[listing.status] || listing.status;
            const dateStr = new Date(listing.created_at).toLocaleDateString('el-GR');
            const pickupStr = new Date(listing.pickup_time).toLocaleString('el-GR', { dateStyle: 'short', timeStyle: 'short' });

            // Allergens parsing
            let allergensHtml = '';
            if (listing.allergens) {
                let parsed = listing.allergens;
                if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch(e) {} }
                let display = '';
                if (Array.isArray(parsed) && parsed.length > 0) display = parsed.join(', ');
                else if (typeof parsed === 'string' && parsed.trim() !== '' && parsed !== '[]') display = parsed;
                if (display) {
                    allergensHtml = `<span style="color: #ef4444; font-size: 0.8rem;">⚠️ ${display}</span>`;
                }
            }

            row.innerHTML = `
                <div class="admin-row-info">
                    <div class="admin-row-main">
                        <span class="admin-row-name">${listing.title}</span>
                        <span class="admin-row-badge" style="color: ${statusColor};">${statusLabel}</span>
                    </div>
                    <div class="admin-row-meta">
                        <span>👨‍🍳 ${listing.cook_name}</span>
                        <span>🍽️ ${listing.available_portions}/${listing.total_portions} μερίδες</span>
                        <span>📍 ${listing.pickup_location}</span>
                        <span>⏰ ${pickupStr}</span>
                        ${allergensHtml}
                    </div>
                </div>
                <div class="admin-row-actions">
                    ${listing.status !== 'deleted' ? `
                        <button class="admin-btn admin-btn-delete" onclick="adminDeleteListing(${listing.id}, '${listing.title.replace(/'/g, "\\'")}')" title="Διαγραφή αγγελίας">
                            🗑️
                        </button>
                    ` : '<span style="font-size: 0.78rem; color: var(--text-muted);">Διαγραμμένη</span>'}
                </div>
            `;
            animateEntrance(row, index);
            container.appendChild(row);
        });
    } catch (error) {
        console.error('Σφάλμα φόρτωσης αγγελιών:', error);
        container.innerHTML = '<p style="color: #ef4444; text-align: center;">Πρόβλημα στη φόρτωση αγγελιών.</p>';
    }
}

window.adminDeleteListing = async function(listingId, title) {
    const confirmed = confirm(`⚠️ Θέλεις να διαγράψεις την αγγελία "${title}";\n\nΤα εκκρεμή αιτήματα θα απορριφθούν αυτόματα.`);
    if (!confirmed) return;

    try {
        const response = await fetch(`/api/admin/listings/${listingId}`, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok) {
            // DOM update: αλλαγή status σε "Διαγραμμένη" χωρίς reload
            const row = document.querySelector(`[data-listing-id="${listingId}"]`);
            if (row) {
                row.querySelector('.admin-row-badge').style.color = '#ef4444';
                row.querySelector('.admin-row-badge').textContent = '🔴 Διαγραμμένη';
                const actionsDiv = row.querySelector('.admin-row-actions');
                actionsDiv.innerHTML = '<span style="font-size: 0.78rem; color: var(--text-muted);">Διαγραμμένη</span>';
                row.style.transition = 'opacity 0.4s ease';
                row.style.opacity = '0.5';
            }
        } else {
            alert(result.error || 'Σφάλμα κατά τη διαγραφή.');
        }
    } catch (error) {
        alert('Πρόβλημα σύνδεσης με τον server.');
    }
};

// =============================================
//  TAB 4: ΑΙΤΗΜΑΤΑ
// =============================================
async function loadRequests() {
    const container = document.getElementById('admin-requests-container');
    try {
        const response = await fetch('/api/admin/requests');
        const requests = await response.json();
        container.innerHTML = '';

        if (requests.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Δεν βρέθηκαν πρόσφατα αιτήματα.</p>';
            return;
        }

        requests.forEach((req, index) => {
            const row = document.createElement('div');
            row.className = 'admin-row';

            const statusMap = {
                pending:    { label: '⏳ Εκκρεμεί',    color: '#f59e0b' },
                approved:   { label: '📦 Εγκρίθηκε',   color: '#3b82f6' },
                picked_up:  { label: '✅ Παραδόθηκε',   color: '#10b981' },
                rejected:   { label: '❌ Απορρίφθηκε',  color: '#ef4444' },
                no_show:    { label: '👻 No-show',      color: '#6b7280' }
            };

            const status = statusMap[req.status] || { label: req.status, color: '#71717a' };
            const dateStr = new Date(req.created_at).toLocaleString('el-GR', { dateStyle: 'short', timeStyle: 'short' });

            let ratingHtml = '';
            if (req.rating) {
                const r = Number(req.rating);
                if (r === -1) {
                    ratingHtml = `<span style="color: #dc2626; font-size: 0.8rem; font-weight: 600;">⏰ Penalty (-1 credit)</span>`;
                } else if (r > 0) {
                    const stars = '★'.repeat(r) + '☆'.repeat(5 - r);
                    ratingHtml = `<span style="color: #facc15; font-size: 0.85rem;">${stars}</span> <span style="color: #b45309; font-weight: 600; font-size: 0.85rem;">${r}/5</span>`;
                }
            }

            row.innerHTML = `
                <div class="admin-row-info">
                    <div class="admin-row-main">
                        <span class="admin-row-name">🍽️ ${req.listing_title}</span>
                        <span class="admin-row-badge" style="color: ${status.color};">${status.label}</span>
                    </div>
                    <div class="admin-row-meta">
                        <span>👤 ${req.consumer_name} → 👨‍🍳 ${req.cook_name}</span>
                        <span>📍 ${req.pickup_location}</span>
                        <span>📅 ${dateStr}</span>
                        ${ratingHtml}
                    </div>
                </div>
            `;
            animateEntrance(row, index);
            container.appendChild(row);
        });
    } catch (error) {
        console.error('Σφάλμα φόρτωσης αιτημάτων:', error);
        container.innerHTML = '<p style="color: #ef4444; text-align: center;">Πρόβλημα στη φόρτωση αιτημάτων.</p>';
    }
}

// =============================================
//  UTILITY: Staggered Entrance Animation
// =============================================
function animateEntrance(el, index) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(12px)';
    setTimeout(() => {
        el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
    }, index * 60);
}

// Fade-out + collapse αφαίρεση γραμμής
function removeRowAnimated(selector) {
    const row = document.querySelector(selector);
    if (!row) return;
    row.style.transition = 'opacity 0.3s ease, transform 0.3s ease, max-height 0.3s ease, margin 0.3s ease, padding 0.3s ease';
    row.style.opacity = '0';
    row.style.transform = 'translateX(20px)';
    row.style.overflow = 'hidden';
    setTimeout(() => {
        row.style.maxHeight = '0';
        row.style.margin = '0';
        row.style.padding = '0';
        setTimeout(() => row.remove(), 300);
    }, 300);
}