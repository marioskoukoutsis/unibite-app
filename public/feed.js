document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    
    // Αν δεν είναι συνδεδεμένος, στείλτον στο login
    if (!user) {
        window.location.href = 'auth.html';
        return;
    }

    const feedContainer = document.getElementById('feed-container');

    async function fetchAndDisplayCredits() {
        try {
            const response = await fetch(`/api/auth/user/${user.id}`);
            if (!response.ok) return;
            const userData = await response.json();
            const creditsCount = document.getElementById('credits-count');
            if (creditsCount) creditsCount.textContent = userData.credits;
        } catch (error) {
            console.error('Αποτυχία φόρτωσης πόντων.');
        }
    }

    fetchAndDisplayCredits();

    // 1. Λήψη των αγγελιών από το Backend
    async function fetchListings() {
        try {
            const response = await fetch('/api/listings');
            const listings = await response.json();
            renderFeed(listings);
        } catch (error) {
            console.error('Σφάλμα fetch:', error);
            feedContainer.innerHTML = '<p>Πρόβλημα στη φόρτωση του feed.</p>';
        }
    }

    // 2. Εμφάνιση των αγγελιών στην HTML
    function renderFeed(listings) {
        feedContainer.innerHTML = ''; // Καθαρισμός του "loading"

        if (listings.length === 0) {
            feedContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Δεν υπάρχουν διαθέσιμες μερίδες αυτή τη στιγμή. 😢</p>';
            return;
        }

        listings.forEach(item => {
            const isSoldOut = item.available_portions === 0;
            
            const card = document.createElement('div');
            card.className = `card ${isSoldOut ? 'sold-out' : ''}`;
            
            // HTML για την κάθε κάρτα φαγητού
            card.innerHTML = `
                ${item.photo_url ? `<img src="${item.photo_url}" alt="${item.title}" class="food-img">` : ''}
                <div class="card-content">
                    <h3>${item.title}</h3>
                    <p><strong>📍 Τοποθεσία:</strong> ${item.pickup_location}</p>
                    <p><strong>⏰ Ώρα:</strong> ${new Date(item.pickup_time).toLocaleString('el-GR')}</p>
                    <p><strong>🍽️ Μερίδες:</strong> ${item.available_portions} / ${item.total_portions}</p>
                    ${item.notes ? `<p class="notes"><em>"${item.notes}"</em></p>` : ''}
                    
                    <button class="btn-order" 
                        onclick="requestPortion(${item.id})" 
                        ${isSoldOut ? 'disabled' : ''}>
                        ${isSoldOut ? 'Εξαντλήθηκε' : 'Θέλω Μερίδα!'}
                    </button>
                </div>
            `;
            feedContainer.appendChild(card);
        });
    }

    fetchListings();
});

// 3. Λειτουργία Κουμπιού "Θέλω Μερίδα"
window.requestPortion = async function(listingId) {
    const user = JSON.parse(localStorage.getItem('user'));

    // Έλεγχος πόντων (Απαίτηση Γ2)
    if (user.credits < 1) {
        alert("Δεν έχεις αρκετούς πόντους! Πρέπει να μαγειρέψεις για να κερδίσεις πόντους.");
        return;
    }

    try {
        const response = await fetch('/api/requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                listing_id: listingId,
                consumer_id: user.id
            })
        });

        const data = await response.json();
        if (response.ok) {
            alert("Το αίτημα στάλθηκε! Περίμενε έγκριση από τον μάγειρα.");
            location.reload();
        } else {
            alert(data.error || "Κάτι πήγε στραβά.");
        }
    } catch (err) {
        console.error(err);
        alert("Σφάλμα σύνδεσης με τον server.");
    }
};