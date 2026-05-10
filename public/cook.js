document.addEventListener('DOMContentLoaded', () => {
    // 1. Βρίσκουμε τα στοιχεία του DOM
    const form = document.getElementById('create-listing-form');
    const messageDiv = document.getElementById('message');
    const listingsContainer = document.getElementById('my-listings-container');

    // Προσωρινά, θεωρούμε ότι ο μάγειρας είναι ο χρήστης με ID 1
    const currentCookId = 1;

    // Μόλις φορτώσει η σελίδα, τραβάμε τις αγγελίες
    fetchMyListings();

    // 2. Υποβολή νέας αγγελίας (POST)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const allergensInput = document.getElementById('allergens').value;
        const listingData = {
            cook_id: currentCookId,
            title: document.getElementById('title').value,
            total_portions: document.getElementById('portions').value,
            pickup_location: document.getElementById('location').value,
            pickup_time: document.getElementById('time').value,
            notes: document.getElementById('notes').value,
            allergens: allergensInput ? allergensInput.split(',').map(item => item.trim()) : []
        };

        try {
            const response = await fetch('http://localhost:3000/api/listings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(listingData)
            });

            const result = await response.json();

            if (response.ok) {
                messageDiv.style.color = 'green';
                messageDiv.textContent = `Επιτυχία! ${result.message}`;
                form.reset();

                // Ανανεώνουμε τη λίστα για να φανεί κατευθείαν η νέα αγγελία
                fetchMyListings();
            } else {
                messageDiv.style.color = 'red';
                messageDiv.textContent = `Σφάλμα: ${result.error}`;
            }
        } catch (error) {
            console.error('Σφάλμα:', error);
            messageDiv.style.color = 'red';
            messageDiv.textContent = 'Πρόβλημα σύνδεσης με τον server.';
        }
    });

    // 3. Συνάρτηση που τραβάει τις αγγελίες (GET)
    async function fetchMyListings() {
        try {
            const response = await fetch('http://localhost:3000/api/listings');
            const allListings = await response.json();

            // Φιλτράρουμε τις αγγελίες για να δείξουμε μόνο αυτές του τρέχοντος μάγειρα
            const myListings = allListings.filter(listing => listing.cook_id === currentCookId);

            renderListings(myListings);
        } catch (error) {
            console.error('Σφάλμα κατά τη λήψη των αγγελιών:', error);
            listingsContainer.innerHTML = '<p style="color: red;">Αποτυχία φόρτωσης αγγελιών.</p>';
        }
    }

    // 4. Συνάρτηση που φτιάχνει τις κάρτες στο HTML
    function renderListings(listings) {
        listingsContainer.innerHTML = '';

        if (listings.length === 0) {
            listingsContainer.innerHTML = '<p>Δεν έχεις καμία ενεργή αγγελία ακόμα.</p>';
            return;
        }

        listings.forEach(listing => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.marginTop = '1rem';

            const dateObj = new Date(listing.pickup_time);
            const formattedDate = dateObj.toLocaleString('el-GR', { dateStyle: 'medium', timeStyle: 'short' });

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h3 style="color: var(--text-main); font-weight: 700; margin-bottom: 0.5rem;">${listing.title}</h3>
                        <p style="margin-bottom: 0.3rem; color: var(--text-muted); font-size: 0.95rem;"><strong>Διαθέσιμες:</strong> ${listing.available_portions} / ${listing.total_portions}</p>
                        <p style="margin-bottom: 0.3rem; color: var(--text-muted); font-size: 0.95rem;"><strong>Παραλαβή:</strong> ${listing.pickup_location} | ${formattedDate}</p>
                        ${listing.notes ? `<p style="color: var(--text-muted); font-size: 0.95rem;"><strong>Σημειώσεις:</strong> ${listing.notes}</p>` : ''}
                    </div>
                    <div style="display: flex; gap: 10px; flex-direction: column;">
                        <button class="btn" style="background-color: transparent; color: var(--text-main); border: 1px solid var(--border-color); box-shadow: none; padding: 0.5rem 1rem;" onclick="editListing(${listing.id})">Επεξεργασία</button>
                        <button class="btn" style="background-color: transparent; color: #ef4444; border: 1px solid #fca5a5; box-shadow: none; padding: 0.5rem 1rem;" onclick="deleteListing(${listing.id})">Διαγραφή</button>
                    </div>
                </div>
            `;
            listingsContainer.appendChild(card);
        });
    }
});

// Συναρτήσεις για Επεξεργασία και Διαγραφή
window.editListing = function(id) {
    alert('Σύντομα θα φτιάξουμε την επεξεργασία για την αγγελία με ID: ' + id);
};

window.deleteListing = function(id) {
    alert('Σύντομα θα φτιάξουμε τη διαγραφή για την αγγελία με ID: ' + id);
};