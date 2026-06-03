document.addEventListener('DOMContentLoaded', () => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
        window.location.href = 'auth.html?redirect=stats.html';
        return;
    }

    const user = JSON.parse(storedUser);

    // --- Admin link injection αν είναι admin ---
    if (user.role === 'admin') {
        const navLinks = document.querySelector('.navbar-links');
        const adminLink = document.createElement('a');
        adminLink.href = 'admin.html';
        adminLink.textContent = 'Admin Portal';
        adminLink.style.cssText = 'color: var(--text-main); font-weight: 700;';
        const accountLink = navLinks.querySelector('a[href="account.html"]');
        navLinks.insertBefore(adminLink, accountLink);
    }

    loadLeaderboard();
});

async function loadLeaderboard() {
    try {
        const response = await fetch('/api/stats/leaderboard');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Σφάλμα API');
        }

        // --- Overview Stats ---
        animateCounter('stat-total-portions', data.totalPortions);
        animateCounter('stat-monthly-portions', data.monthlyPortions);
        animateCounter('stat-total-cooks', data.totalCooks);

        // --- Top Cooks Leaderboard ---
        renderLeaderboard(data.topCooks);

        // --- Top Meals ---
        renderTopMeals(data.topMeals);

    } catch (error) {
        console.error('Σφάλμα φόρτωσης leaderboard:', error);
        document.getElementById('leaderboard-container').innerHTML = 
            '<p style="color: #ef4444; text-align: center;">Πρόβλημα στη φόρτωση των στατιστικών.</p>';
    }
}

// --- Animated Counter ---
function animateCounter(elementId, target) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const duration = 1200;
    const start = performance.now();
    target = Number(target) || 0;

    function step(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // easeOutExpo
        const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        el.textContent = Math.round(eased * target);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// --- Leaderboard Rendering ---
function renderLeaderboard(cooks) {
    const container = document.getElementById('leaderboard-container');
    container.innerHTML = '';

    if (!cooks || cooks.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Δεν υπάρχουν στοιχεία κατάταξης ακόμα.</p>';
        return;
    }

    cooks.forEach((cook, index) => {
        const rank = index + 1;
        const row = document.createElement('div');
        row.className = 'lb-row';
        if (rank <= 3) row.classList.add('lb-top');

        // Medal / rank display
        let rankDisplay = '';
        if (rank === 1) rankDisplay = '<span class="lb-medal gold">🥇</span>';
        else if (rank === 2) rankDisplay = '<span class="lb-medal silver">🥈</span>';
        else if (rank === 3) rankDisplay = '<span class="lb-medal bronze">🥉</span>';
        else rankDisplay = `<span class="lb-rank">${rank}</span>`;

        // Rating stars
        let ratingHtml = '';
        if (cook.avg_rating) {
            const r = Number(cook.avg_rating);
            const full = Math.floor(r);
            const starsStr = '★'.repeat(full) + '☆'.repeat(5 - full);
            ratingHtml = `<span class="lb-rating"><span class="lb-stars">${starsStr}</span> ${r.toFixed(1)}</span>`;
        } else {
            ratingHtml = '<span class="lb-rating lb-no-rating">Χωρίς αξιολογήσεις</span>';
        }

        row.innerHTML = `
            ${rankDisplay}
            <div class="lb-info">
                <span class="lb-name">${cook.name}</span>
                ${ratingHtml}
            </div>
            <div class="lb-portions">
                <span class="lb-portions-count">${cook.portions_given}</span>
                <span class="lb-portions-label">μερίδες</span>
            </div>
        `;

        // Staggered entrance animation
        row.style.opacity = '0';
        row.style.transform = 'translateY(12px)';
        setTimeout(() => {
            row.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            row.style.opacity = '1';
            row.style.transform = 'translateY(0)';
        }, index * 80);

        container.appendChild(row);
    });
}

// --- Top Meals Rendering ---
function renderTopMeals(meals) {
    const container = document.getElementById('top-meals-container');
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
                <span class="meal-cook">από ${meal.cook_name}</span>
            </div>
            <div class="meal-rating">
                <span class="meal-stars">${starsStr}</span>
                <span class="meal-avg">${r.toFixed(1)}</span>
                <span class="meal-count">(${meal.total_ratings} κριτ.)</span>
            </div>
        `;

        // Staggered entrance animation
        row.style.opacity = '0';
        row.style.transform = 'translateY(12px)';
        setTimeout(() => {
            row.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            row.style.opacity = '1';
            row.style.transform = 'translateY(0)';
        }, index * 100);

        container.appendChild(row);
    });
}
