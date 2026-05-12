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

    async function loadAdminStats() {
        try {
            const response = await fetch('http://localhost:3000/api/admin/stats');
            const data = await response.json();

            if (response.ok) {

                document.getElementById('total-portions').textContent = data.totalPortions;
                
                document.getElementById('top-donor').textContent = `${data.topDonor.name} (${data.topDonor.portions_given} μερίδες)`;

                const mealsList = document.getElementById('top-meals');
                mealsList.innerHTML = ''; 
                
                if (data.topMeals.length === 0) {
                    mealsList.innerHTML = '<li style="color: var(--text-muted);">Δεν υπάρχουν ακόμα αξιολογήσεις.</li>';
                } else {
                    data.topMeals.forEach(meal => {
                        const li = document.createElement('li');
                        li.style.marginBottom = '0.5rem';
                        li.innerHTML = `<strong>${meal.title}</strong> - ${Number(meal.avg_rating).toFixed(1)} ⭐`;
                        mealsList.appendChild(li);
                    });
                }
            }
        } catch (error) {
            console.error('Σφάλμα φόρτωσης στατιστικών:', error);
            document.getElementById('total-portions').textContent = "Σφάλμα";
        }
    }

    
    loadAdminStats();
});