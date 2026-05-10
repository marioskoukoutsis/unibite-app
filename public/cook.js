document.addEventListener('DOMContentLoaded', () => {
    // 1. Έλεγχος Σύνδεσης (Ασφάλεια)
    const storedUser = localStorage.getItem('user');

    // Αν ΔΕΝ είναι συνδεδεμένος, τον στέλνουμε στο auth!
    if (!storedUser) {
        window.location.href = 'auth.html?redirect=cook.html';
        return;
    }

    // Διαβάζουμε τα στοιχεία του χρήστη που έκανε Login
    const user = JSON.parse(storedUser);
    const currentCookId = user.id;

    // 2. Βρίσκουμε τα στοιχεία του DOM
    const form = document.getElementById('create-listing-form');
    const messageDiv = document.getElementById('message');
    const listingsContainer = document.getElementById('my-listings-container');

    // Μόλις φορτώσει η σελίδα, τραβάμε τις αγγελίες
    fetchMyListings();

    // Βοηθητική συνάρτηση για μετατροπή εικόνας σε Base64 Text
    const getBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });

    // 3. Υποβολή νέας αγγελίας (POST)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Ελέγχουμε αν έχει επιλέξει φωτογραφία
        const photoInput = document.getElementById('photo');
        let photoBase64String = null;
        if (photoInput.files.length > 0) {
            photoBase64String = await getBase64(photoInput.files[0]);
        }

        const allergensInput = document.getElementById('allergens').value;

        // Φτιάχνουμε το JSON αντικείμενο
        const listingData = {
            cook_id: currentCookId,
            title: document.getElementById('title').value,
            total_portions: document.getElementById('portions').value,
            pickup_location: document.getElementById('location').value,
            pickup_time: document.getElementById('time').value,
            notes: document.getElementById('notes').value,
            allergens: allergensInput ? allergensInput.split(',').map(item => item.trim()) : [],
            photo_base64: photoBase64String
        };

        try {
            const response = await fetch('http://localhost:3000/api/listings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(listingData)
            });

            const result = await response.json();

            if (response.ok) {
                messageDiv.style.color = 'var(--primary-color)';
                messageDiv.textContent = `Επιτυχία! ${result.message}`;
                form.reset();
                fetchMyListings(); // Ανανεώνουμε τη λίστα δυναμικά
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

    // 4. Συνάρτηση που τραβάει τις αγγελίες (GET)
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

    // 5. Συνάρτηση που φτιάχνει τις κάρτες στο HTML
    function renderListings(listings) {
        listingsContainer.innerHTML = '';

        if (listings.length === 0) {
            listingsContainer.innerHTML = '<p style="color: var(--text-muted);">Δεν έχεις καμία ενεργή αγγελία ακόμα.</p>';
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
                    <div style="flex: 1;">
                        <h3 style="color: var(--text-main); font-weight: 700; margin-bottom: 0.5rem;">${listing.title}</h3>
                        
                        ${listing.photo_url ? `<img src="${listing.photo_url}" style="max-width: 150px; border-radius: 8px; margin-bottom: 10px;" alt="Φαγητό">` : ''}

                        <p style="margin-bottom: 0.3rem; color: var(--text-muted); font-size: 0.95rem;"><strong>Διαθέσιμες:</strong> ${listing.available_portions} / ${listing.total_portions}</p>
                        <p style="margin-bottom: 0.3rem; color: var(--text-muted); font-size: 0.95rem;"><strong>Παραλαβή:</strong> ${listing.pickup_location} | ${formattedDate}</p>
                        ${listing.notes ? `<p style="color: var(--text-muted); font-size: 0.95rem;"><strong>Σημειώσεις:</strong> ${listing.notes}</p>` : ''}
                    </div>
                    <div style="display: flex; gap: 10px; flex-direction: column; padding-left: 20px;">
                        <button class="btn" style="background-color: transparent; color: var(--text-main); border: 1px solid var(--border-color); box-shadow: none; padding: 0.5rem 1rem;" onclick="editListing(${listing.id})">Επεξεργασία</button>
                        <button class="btn" style="background-color: transparent; color: #ef4444; border: 1px solid #fca5a5; box-shadow: none; padding: 0.5rem 1rem;" onclick="deleteListing(${listing.id})">Διαγραφή</button>
                    </div>
                </div>
            `;
            listingsContainer.appendChild(card);
        });
    }
});

// --- ΠΑΓΚΟΣΜΙΕΣ ΣΥΝΑΡΤΗΣΕΙΣ ΓΙΑ ΤΑ ΚΟΥΜΠΙΑ ---

window.editListing = function(id) {
    alert('Σύντομα θα φτιάξουμε την επεξεργασία για την αγγελία με ID: ' + id);
};

window.deleteListing = async function(id) {
    const isConfirmed = confirm("Είσαι σίγουρος ότι θέλεις να διαγράψεις αυτή την αγγελία;");

    if (!isConfirmed) return;

    try {
        const response = await fetch(`http://localhost:3000/api/listings/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (response.ok) {
            alert('Η αγγελία διαγράφηκε!');
            location.reload();
        } else {
            alert(`Σφάλμα: ${result.error}`);
        }
    } catch (error) {
        console.error('Σφάλμα κατά τη διαγραφή:', error);
        alert('Πρόβλημα σύνδεσης με τον server.');
    }
};