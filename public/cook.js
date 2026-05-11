document.addEventListener('DOMContentLoaded', () => {
    // Έλεγχος Σύνδεσης
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
        window.location.href = 'auth.html?redirect=cook.html';
        return;
    }

    const user = JSON.parse(storedUser);

// --- Εμφάνιση Admin Portal στο Navigation αν είναι Admin ---
    if (user.role === 'admin') {
        const navLinks = document.querySelector('.navbar-links');
        const adminLink = document.createElement('a');
        adminLink.href = 'admin.html';
        adminLink.textContent = 'Admin Portal';
        adminLink.style.cssText = 'color: #3f3f46; font-weight: 700; margin-left: 2.5rem;';

        // Το τοποθετούμε πριν από τον "Λογαριασμό μου"
        const accountLink = navLinks.querySelector('a[href="account.html"]');
        navLinks.insertBefore(adminLink, accountLink);
    }
    const currentCookId = user.id;

    const form = document.getElementById('create-listing-form');
    const messageDiv = document.getElementById('message');
    const listingsContainer = document.getElementById('my-listings-container');

    // Εδώ θα αποθηκεύουμε προσωρινά τις αγγελίες για να τις διαβάζει η Επεξεργασία
    let currentListings = [];

    // --- ΠΕΡΙΟΡΙΣΜΟΣ ΗΜΕΡΟΜΗΝΙΑΣ (48 Ώρες) ---
    const timeInput = document.getElementById('time');
    const getLocalISOString = (date) => {
        const offset = date.getTimezoneOffset() * 60000;
        return (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
    };
    const now = new Date();
    const maxDate = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    if (timeInput) {
        timeInput.min = getLocalISOString(now);
        timeInput.max = getLocalISOString(maxDate);
    }

    fetchMyListings();

    const getBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });

    // --- ΥΠΟΒΟΛΗ ΦΟΡΜΑΣ (POST για Νέα, PUT για Επεξεργασία) ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const editId = document.getElementById('edit-listing-id').value; // Ελέγχουμε αν κάνουμε Edit

        const photoInput = document.getElementById('photo');
        let photoBase64String = null;
        if (photoInput.files.length > 0) {
            photoBase64String = await getBase64(photoInput.files[0]);
        }

        const allergensInput = document.getElementById('allergens').value;
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
            // Αν το editId έχει τιμή, κάνουμε PUT στο localhost:3000/api/listings/:id, αλλιώς POST
            const url = editId ? `/api/listings/${editId}` : '/api/listings';
            const method = editId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(listingData)
            });

            const result = await response.json();

            if (response.ok) {
                messageDiv.style.color = 'var(--primary-color)';
                messageDiv.textContent = `Επιτυχία! ${result.message}`;
                cancelEdit(); // Επαναφέρει τη φόρμα στο μηδέν
                fetchMyListings(); // Ανανεώνει τη λίστα δυναμικά
            } else {
                messageDiv.style.color = 'red';
                messageDiv.textContent = `Σφάλμα: ${result.error}`;
            }
        } catch (error) {
            messageDiv.style.color = 'red';
            messageDiv.textContent = 'Πρόβλημα σύνδεσης με τον server.';
        }
    });

    async function fetchMyListings() {
        try {
            const response = await fetch('/api/listings');
            const allListings = await response.json();
            currentListings = allListings.filter(listing => listing.cook_id === currentCookId);
            renderListings(currentListings);
        } catch (error) {
            listingsContainer.innerHTML = '<p style="color: red;">Αποτυχία φόρτωσης.</p>';
        }
    }

    function renderListings(listings) {
        listingsContainer.innerHTML = '';
        if (listings.length === 0) {
            listingsContainer.innerHTML = '<p style="color: var(--text-muted);">Δεν έχεις καμία ενεργή αγγελία.</p>';
            return;
        }

        listings.forEach(listing => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.marginTop = '1rem';

            const dateObj = new Date(listing.pickup_time);
            const formattedDate = dateObj.toLocaleString('el-GR', { dateStyle: 'medium', timeStyle: 'short' });

            let allergensDisplay = '';
            if (listing.allergens) {
                let parsed = listing.allergens;
                if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch(e) {} }
                if (Array.isArray(parsed) && parsed.length > 0) allergensDisplay = parsed.join(', ');
                else if (typeof parsed === 'string' && parsed.trim() !== '' && parsed !== '[]') allergensDisplay = parsed;
            }
            const allergensHtml = allergensDisplay ? `<p style="margin-bottom: 0.3rem; color: #ef4444; font-size: 0.95rem;"><strong>⚠️ Αλλεργιογόνα:</strong> ${allergensDisplay}</p>` : '';

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <h3 style="color: var(--text-main); font-weight: 700; margin-bottom: 0.5rem;">${listing.title}</h3>
                        ${listing.photo_url ? `<img src="${listing.photo_url}" style="max-width: 150px; border-radius: 8px; margin-bottom: 10px;" alt="Φαγητό">` : ''}
                        <p style="margin-bottom: 0.3rem; color: var(--text-muted); font-size: 0.95rem;"><strong>Διαθέσιμες:</strong> ${listing.available_portions} / ${listing.total_portions}</p>
                        <p style="margin-bottom: 0.3rem; color: var(--text-muted); font-size: 0.95rem;"><strong>Παραλαβή:</strong> ${listing.pickup_location} | ${formattedDate}</p>
                        ${allergensHtml}
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

    // --- Η ΣΥΝΑΡΤΗΣΗ ΠΟΥ "ΓΕΜΙΖΕΙ" ΤΗ ΦΟΡΜΑ ΓΙΑ ΕΠΕΞΕΡΓΑΣΙΑ ---
    window.editListing = function(id) {
        const listing = currentListings.find(l => l.id === id);
        if (!listing) return;

        document.getElementById('edit-listing-id').value = listing.id;
        document.getElementById('title').value = listing.title;
        document.getElementById('portions').value = listing.total_portions;
        document.getElementById('location').value = listing.pickup_location;

        const dateObj = new Date(listing.pickup_time);
        document.getElementById('time').value = getLocalISOString(dateObj);

        let allergensStr = '';
        if (listing.allergens) {
            let parsed = listing.allergens;
            if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch(e) {} }
            if (Array.isArray(parsed)) allergensStr = parsed.join(', ');
            else if (typeof parsed === 'string') allergensStr = parsed;
        }
        document.getElementById('allergens').value = allergensStr;
        document.getElementById('notes').value = listing.notes || '';

        // Αλλαγή UI
        document.getElementById('form-title').textContent = 'Επεξεργασία Αγγελίας';
        document.getElementById('submit-btn').textContent = 'Αποθήκευση Αλλαγών';
        document.getElementById('cancel-edit-btn').style.display = 'inline-block';

        // Ανεβαίνουμε στην κορυφή της σελίδας για να δει τη φόρμα
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // --- ΑΚΥΡΩΣΗ ΕΠΕΞΕΡΓΑΣΙΑΣ ΚΑΙ ΕΠΙΣΤΡΟΦΗ ---
    window.cancelEdit = function() {
        form.reset();
        document.getElementById('edit-listing-id').value = '';
        document.getElementById('form-title').textContent = 'Δημιουργία Αγγελίας';
        document.getElementById('submit-btn').textContent = 'Ανέβασμα Αγγελίας';
        document.getElementById('cancel-edit-btn').style.display = 'none';
        messageDiv.textContent = '';
    };

    window.deleteListing = async function(id) {
        const isConfirmed = confirm("Είσαι σίγουρος ότι θέλεις να διαγράψεις αυτή την αγγελία;");
        if (!isConfirmed) return;
        try {
            const response = await fetch(`/api/listings/${id}`, { method: 'DELETE' });
            if (response.ok) fetchMyListings(); // Δεν κάνουμε reload, απλά ανανεώνουμε τη λίστα
            else alert('Σφάλμα κατά τη διαγραφή');
        } catch (error) { alert('Πρόβλημα σύνδεσης.'); }
    };
});