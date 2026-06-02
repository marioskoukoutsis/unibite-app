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
            currentListings = allListings.filter(listing => Number(listing.cook_id) === Number(currentCookId));
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

    const requestsContainer = document.getElementById('requests-container');

    async function fetchMyRequests() {
        try {
            const response = await fetch(`/api/requests?cook_id=${currentCookId}`);
            const requests = await response.json();
            renderRequests(requests);
        } catch (error) {
            console.error("Σφάλμα κατά τη φόρτωση των αιτημάτων:", error);
            if (requestsContainer) {
                requestsContainer.innerHTML = '<p style="color: red;">Αποτυχία φόρτωσης των αιτημάτων.</p>';
            }
        }
    }

    function renderRequests(requests) {
    if (!requestsContainer) return;
    requestsContainer.innerHTML = '';

    if (requests.length === 0) {
        requestsContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Δεν έχεις λάβει ακόμα αιτήματα.</p>';
        return;
    }

    requests.forEach(request => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.marginTop = '1rem';
        card.style.padding = '1.5rem';

        let actionButtons = '';
        let statusText = '';

        if (request.status === 'pending') {
            statusText = '<span style="color: #f59e0b; font-weight: 600;">Σε Εκκρεμότητα ⏳</span>';
            actionButtons = `
                <button class="btn" style="background-color: #10b981; margin-bottom: 8px; padding: 0.5rem;" onclick="updateRequestStatus(${request.id}, 'approved')">✅ Έγκριση</button>
                <button class="btn" style="background-color: #ef4444; padding: 0.5rem;" onclick="updateRequestStatus(${request.id}, 'rejected')">❌ Απόρριψη</button>
            `;
        } else if (request.status === 'approved') {
            statusText = '<span style="color: #3b82f6; font-weight: 600;">Προς Παράδοση 📦</span>';
                actionButtons = `
                    <button class="btn" style="background-color: #3b82f6; margin-bottom: 8px; padding: 0.5rem;" onclick="updateRequestStatus(${request.id}, 'picked_up')">🛍️ Παραδόθηκε</button>
                    <button class="btn" style="background-color: #6b7280; padding: 0.5rem;" onclick="updateRequestStatus(${request.id}, 'no_show')">👻 Δεν ήρθε</button>
            `;
        }else if (request.status === 'picked_up') {
            statusText = '<span style="color: #10b981; font-weight: 600;">Παραδόθηκε ✅</span>';
        } else if (request.status === 'no_show') {
            statusText = '<span style="color: #6b7280; font-weight: 600;">Δεν ήρθε 👻</span>';
        } else if (request.status === 'rejected') {
            statusText = '<span style="color: #ef4444; font-weight: 600;">Απορρίφθηκε ❌</span>';
        } else {
            statusText = `<span style="color: var(--text-muted); font-weight: 600;">${request.status}</span>`;
        }

        const formattedDate = new Date(request.created_at).toLocaleString('el-GR', { dateStyle: 'medium', timeStyle: 'short' });
        const pickupStr = new Date(request.pickup_time).toLocaleString('el-GR', { dateStyle: 'medium', timeStyle: 'short' });

        let ratingHtml = '';
        if (request.rating) {
            const ratingNum = Number(request.rating);
            if (ratingNum === -1) {
                ratingHtml = `
                    <div class="rating-badge-cook" style="background: linear-gradient(135deg, #fef2f2, #fee2e2); border-color: #fca5a5;">
                        <span class="badge-label" style="color: #dc2626;">⏰ Ο χρήστης δεν αξιολόγησε εντός 48 ωρών</span>
                    </div>
                `;
            } else if (ratingNum > 0) {
                const starsVisual = '★'.repeat(ratingNum) + '☆'.repeat(5 - ratingNum);
                const ratingLabels = { 1: 'Κακό 😞', 2: 'Μέτριο 😐', 3: 'Καλό 🙂', 4: 'Πολύ Καλό 😊', 5: 'Εξαιρετικό 🤩' };
                ratingHtml = `
                    <div class="rating-badge-cook">
                        <span class="badge-label">Αξιολόγηση:</span>
                        <span class="stars-show">${starsVisual}</span>
                        <span class="badge-value">${ratingLabels[ratingNum] || ratingNum}</span>
                    </div>
                `;
            }
        }

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                <div>
                    <h4 style="margin-bottom: 0.3rem; color: var(--text-main); font-weight: 600;">Ο/Η <strong>${request.consumer_name}</strong> ζήτησε: </h4>
                    <p style="color: var(--primary-color); font-weight: 600; margin-bottom: 0.5rem;">🍽️ ${request.listing_title}</p>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.2rem;">Παραλαβή: ${request.pickup_location} | ${pickupStr}</p>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.2rem;">Κατάσταση: ${statusText}</p>
                    <p style="font-size: 0.8rem; color: var(--text-muted);">Αίτημα: ${formattedDate}</p>
                    ${ratingHtml}
                </div>
                <div style="display: flex; flex-direction: column; min-width: 120px;">
                    ${actionButtons}
                </div>
            </div>
        `;
        requestsContainer.appendChild(card);
    });
}

    window.updateRequestStatus = async function(id, newStatus) {
        try {
            const response = await fetch(`/api/requests/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            const result = await response.json();

            if (response.ok) {
                fetchMyRequests();
                fetchMyListings();
                fetchAndDisplayCredits();
            } else {
                alert(`Σφάλμα: ${result.error}`);
            }
        } catch (error) {
            alert('Πρόβλημα σύνδεσης με τον server.');
        }
    }

    fetchMyRequests();
    fetchAndDisplayCredits();

    async function fetchAndDisplayCredits() {
        try {
            const response = await fetch(`/api/auth/user/${currentCookId}`);
            if (!response.ok) return;
            const userData = await response.json();
            const creditsEl = document.getElementById('credits-value');
            if (creditsEl) creditsEl.textContent = userData.credits;
        } catch (error) {
            console.error('Αποτυχία φόρτωσης πόντων.');
        }
    }

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