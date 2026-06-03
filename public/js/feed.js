document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    
    // Αν δεν είναι συνδεδεμένος, στείλτον στο login
    if (!user) {
        window.location.href = 'auth.html';
        return;
    }

    // --- Εμφάνιση Admin Portal στο Navigation αν είναι Admin ---
    if (user.role === 'admin') {
        const navLinks = document.querySelector('.navbar-links');
        if (navLinks) {
            const adminLink = document.createElement('a');
            adminLink.href = 'admin.html';
            adminLink.textContent = 'Admin Portal';
            adminLink.style.cssText = 'color: var(--text-main); font-weight: 700;';
            const accountLink = navLinks.querySelector('a[href="account.html"]');
            if (accountLink) {
                navLinks.insertBefore(adminLink, accountLink);
            } else {
                navLinks.appendChild(adminLink);
            }
        }
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

        // Φιλτράρουμε τις αγγελίες ώστε να ΜΗΝ δείχνει τις δικές μας!
        const feedListings = listings.filter(item => item.cook_id !== user.id);

        if (feedListings.length === 0) {
            feedContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Δεν υπάρχουν διαθέσιμες μερίδες από άλλους φοιτητές αυτή τη στιγμή. 😢</p>';
            return;
        }

        feedListings.forEach(item => {
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
                    ${(() => {
                        let allergensDisplay = '';
                        if (item.allergens) {
                            let parsed = item.allergens;
                            if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch(e) {} }
                            if (Array.isArray(parsed) && parsed.length > 0) allergensDisplay = parsed.join(', ');
                            else if (typeof parsed === 'string' && parsed.trim() !== '' && parsed !== '[]') allergensDisplay = parsed;
                        }
                        return allergensDisplay ? `<p style="margin-top: 0.5rem; color: #ef4444; font-size: 0.88rem; font-weight: 500;"><strong>⚠️ Αλλεργιογόνα:</strong> ${allergensDisplay}</p>` : '';
                    })()}
                    
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

    const ordersContainer = document.getElementById('my-orders-container');

async function fetchMyOrders() {
    if (!ordersContainer) return;
    try {
        const response = await fetch(`/api/requests?consumer_id=${user.id}`);
        const orders = await response.json();

        ordersContainer.innerHTML = '';
        if (orders.length === 0) {
            ordersContainer.innerHTML = '<p style="text-align: center;">Δεν έχεις κάνει κανένα αίτημα ακόμα. 😢</p>';
            return;
        }

        orders.forEach(order => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.marginTop = '1rem';
            card.style.padding = '1rem';
            let statusText = '';
            if (order.status === 'pending') statusText = '<span style="color: #f59e0b; font-weight: bold;">Σε Εκκρεμότητα ⏳</span>';
                else if (order.status === 'approved') statusText = '<span style="color: #3b82f6; font-weight: bold;">Εγκρίθηκε - Προς Παράδοση 📦</span>';
                else if (order.status === 'picked_up') statusText = '<span style="color: #10b981; font-weight: bold;">Παραλήφθηκε ✅ (Καλή όρεξη!)</span>';
                else if (order.status === 'no_show') statusText = '<span style="color: #ef4444; font-weight: bold;">Ακυρώθηκε (No-show) ❌</span>';
                else if (order.status === 'rejected') statusText = '<span style="color: #ef4444; font-weight: bold;">Απορρίφθηκε ❌</span>';
                else statusText = order.status;
                
                const pickupDate = new Date(order.pickup_time).toLocaleString('el-GR', { dateStyle: 'short', timeStyle: 'short' });

                // --- Premium Rating Section ---
                let ratingSection = '';
                if (order.status === 'picked_up') {
                    if (order.rating && Number(order.rating) === -1) {
                        // Penalty: δεν αξιολόγησε εντός 48 ωρών
                        ratingSection = `
                            <div class="rating-display" style="background: linear-gradient(135deg, #fef2f2, #fee2e2); border-color: #fca5a5;">
                                <span class="stars-show">⏰</span>
                                <span class="rating-text" style="color: #dc2626;">Δεν αξιολόγησες εντός 48 ωρών — <strong>αφαιρέθηκε 1 credit</strong></span>
                            </div>
                        `;
                    } else if (order.rating && Number(order.rating) > 0) {
                        // Ήδη αξιολογημένο — δείχνουμε visual stars
                        const ratingNum = Number(order.rating);
                        const starsVisual = '★'.repeat(ratingNum) + '☆'.repeat(5 - ratingNum);
                        const ratingLabels = { 1: 'Κακό', 2: 'Μέτριο', 3: 'Καλό', 4: 'Πολύ Καλό', 5: 'Εξαιρετικό' };
                        ratingSection = `
                            <div class="rating-display">
                                <span class="stars-show">${starsVisual}</span>
                                <span class="rating-text">Η αξιολόγησή σου: <strong>${ratingLabels[ratingNum] || ratingNum}</strong> (${ratingNum}/5)</span>
                            </div>
                        `;
                    } else {
                        // Δεν έχει αξιολογηθεί ακόμα — interactive star picker
                        ratingSection = `
                            <div class="rating-container">
                                <p class="rating-title">✨ Πώς ήταν το γεύμα;</p>
                                <div class="star-picker" id="star-picker-${order.id}">
                                    <span class="star" data-value="1">★</span>
                                    <span class="star" data-value="2">★</span>
                                    <span class="star" data-value="3">★</span>
                                    <span class="star" data-value="4">★</span>
                                    <span class="star" data-value="5">★</span>
                                </div>
                                <div class="rating-label" id="rating-label-${order.id}">
                                    <p class="label-desc" style="color: #a1a1aa;">Πάτα σε ένα αστέρι για να αξιολογήσεις</p>
                                </div>
                                <input type="hidden" id="rating-${order.id}" value="0">
                                <button class="btn-submit-rating" id="btn-rating-${order.id}" disabled onclick="submitRating(${order.id})">
                                    Αποστολή Αξιολόγησης
                                </button>
                            </div>
                        `;
                    }
                }

                card.innerHTML = `
                    <h4 style="margin-bottom: 0.5rem; color: var(--text-main);">🍽️ ${order.listing_title}</h4>
                    <p style="font-size: 0.9rem; margin-bottom: 0.3rem;"><strong>Μάγειρας:</strong> ${order.cook_name}</p>
                    <p style="font-size: 0.9rem; margin-bottom: 0.3rem;"><strong>Παραλαβή:</strong> ${order.pickup_location} | ${pickupDate}</p>
                    <p style="font-size: 0.95rem; margin-top: 0.5rem;"><strong>Κατάσταση:</strong> ${statusText}</p>
                    ${ratingSection}
                `;
            ordersContainer.appendChild(card);
        });

        // Αφού μπουν οι κάρτες στο DOM, ενεργοποιούμε τα interactive stars
        initStarPickers();

    } catch (error) {
        console.error('Σφάλμα fetch:', error);
        ordersContainer.innerHTML = '<p>Πρόβλημα στη φόρτωση των αιτημάτων σου.</p>';
    }
}

    fetchListings();
    fetchMyOrders();
});

// --- Rating Labels Configuration ---
const RATING_LEVELS = {
    1: { title: 'Κακό 😞',         desc: 'Δεν ήταν αυτό που περίμενα. Υπάρχουν πολλά περιθώρια βελτίωσης.' },
    2: { title: 'Μέτριο 😐',       desc: 'Εντάξει, αλλά χρειάζεται βελτίωση σε γεύση ή ποσότητα.' },
    3: { title: 'Καλό 🙂',         desc: 'Αρκετά ικανοποιητικό! Κάλυψε τις βασικές προσδοκίες μου.' },
    4: { title: 'Πολύ Καλό 😊',    desc: 'Νόστιμο και σε καλή ποσότητα. Σίγουρα θα ξαναπαρήγγελνα.' },
    5: { title: 'Εξαιρετικό 🤩',   desc: 'Σπιτικό αριστούργημα! Γεύση, παρουσίαση, τα πάντα τέλεια.' }
};

// --- Star Picker Initialization ---
function initStarPickers() {
    document.querySelectorAll('.star-picker').forEach(picker => {
        const orderId = picker.id.replace('star-picker-', '');
        const stars = picker.querySelectorAll('.star');
        const hiddenInput = document.getElementById(`rating-${orderId}`);
        const labelDiv = document.getElementById(`rating-label-${orderId}`);
        const submitBtn = document.getElementById(`btn-rating-${orderId}`);

        stars.forEach(star => {
            const val = Number(star.dataset.value);

            // Hover: φωτίζουμε όλα τα αστέρια μέχρι αυτό + δείχνουμε label
            star.addEventListener('mouseenter', () => {
                stars.forEach(s => {
                    s.classList.toggle('hovered', Number(s.dataset.value) <= val);
                });
                const level = RATING_LEVELS[val];
                labelDiv.setAttribute('data-level', val);
                labelDiv.innerHTML = `
                    <p class="label-title">${level.title}</p>
                    <p class="label-desc">${level.desc}</p>
                `;
            });

            // Click: κλειδώνουμε την επιλογή
            star.addEventListener('click', () => {
                hiddenInput.value = val;
                submitBtn.disabled = false;
                stars.forEach(s => {
                    const sv = Number(s.dataset.value);
                    s.classList.toggle('selected', sv <= val);
                    // Pulse animation
                    if (sv <= val) {
                        s.classList.remove('pulse');
                        void s.offsetWidth; // force reflow
                        s.classList.add('pulse');
                    }
                });
                const level = RATING_LEVELS[val];
                labelDiv.setAttribute('data-level', val);
                labelDiv.innerHTML = `
                    <p class="label-title">${level.title}</p>
                    <p class="label-desc">${level.desc}</p>
                `;
            });
        });

        // Mouse leave: επιστρέφουμε στο selected state
        picker.addEventListener('mouseleave', () => {
            const currentVal = Number(hiddenInput.value);
            stars.forEach(s => {
                s.classList.remove('hovered');
            });
            if (currentVal > 0) {
                const level = RATING_LEVELS[currentVal];
                labelDiv.setAttribute('data-level', currentVal);
                labelDiv.innerHTML = `
                    <p class="label-title">${level.title}</p>
                    <p class="label-desc">${level.desc}</p>
                `;
            } else {
                labelDiv.removeAttribute('data-level');
                labelDiv.innerHTML = `<p class="label-desc" style="color: #a1a1aa;">Πάτα σε ένα αστέρι για να αξιολογήσεις</p>`;
            }
        });
    });
}

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
            location.reload(); // Ανανέωση για να φανεί η αλλαγή στις μερίδες
        } else {
            alert(data.error || "Κάτι πήγε στραβά.");
        }
    } catch (err) {
        console.error(err);
        alert("Σφάλμα σύνδεσης με τον server.");
    }
};

window.submitRating = async function(orderId) {
    const ratingValue = document.getElementById(`rating-${orderId}`).value;

    if (!ratingValue || ratingValue === '0') {
        alert('Παρακαλώ επίλεξε μια βαθμολογία πρώτα.');
        return;
    }

    const btn = document.getElementById(`btn-rating-${orderId}`);
    btn.disabled = true;
    btn.textContent = 'Αποστολή...';

    try {
        const response = await fetch(`/api/requests/${orderId}/rating`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating: Number(ratingValue) })
        });

        const result = await response.json();
        if (response.ok) {
            alert('Η βαθμολογία σου καταχωρήθηκε! Ευχαριστούμε για την αξιολόγηση. 🙏');
            location.reload();
        } else {
            btn.disabled = false;
            btn.textContent = 'Αποστολή Αξιολόγησης';
            alert(result.error || 'Κάτι πήγε στραβά με την αποστολή της βαθμολογίας.');
        }
    } catch (error) {
        btn.disabled = false;
        btn.textContent = 'Αποστολή Αξιολόγησης';
        alert('Σφάλμα σύνδεσης με τον server.');
    }
};