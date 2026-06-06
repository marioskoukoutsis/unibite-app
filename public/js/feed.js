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

    // --- Global State for Map and Filtering ---
    let allListings = [];
    let userLocation = null;
    let geocodeCache = JSON.parse(localStorage.getItem('unibite_geocode_cache') || '{}');
    let map = null;
    let markersGroup = null;
    let userMarker = null;
    let currentView = 'list';

    // Helper to escape HTML and prevent injection
    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    // Haversine formula to calculate distance in km
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    // Geocode an address string via free Nominatim API with cache
    async function geocodeAddress(address) {
        if (!address) return null;
        const cleanAddress = address.trim();
        if (geocodeCache[cleanAddress]) {
            return geocodeCache[cleanAddress];
        }
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(cleanAddress)}`;
            const response = await fetch(url, {
                headers: {
                    'Accept-Language': 'el,en',
                    'User-Agent': 'UniBiteApp/1.0'
                }
            });
            if (!response.ok) return null;
            const data = await response.json();
            if (data && data.length > 0) {
                const coords = {
                    lat: parseFloat(data[0].lat),
                    lon: parseFloat(data[0].lon)
                };
                geocodeCache[cleanAddress] = coords;
                localStorage.setItem('unibite_geocode_cache', JSON.stringify(geocodeCache));
                return coords;
            }
        } catch (e) {
            console.error('OSM Geocoding failed for:', address, e);
        }
        return null;
    }

    // Geocode all listing locations sequentially with a rate limit delay
    async function geocodeAllListingsAndRefresh(listings) {
        const locations = [...new Set(listings.map(l => l.pickup_location))];
        let hasNewGeocodes = false;
        
        for (const loc of locations) {
            if (!geocodeCache[loc]) {
                const coords = await geocodeAddress(loc);
                if (coords) {
                    hasNewGeocodes = true;
                }
                // Pause for 1 second to respect OSM Nominatim rate limits (max 1 req/sec)
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        if (hasNewGeocodes) {
            await processAndRenderFeed();
        }
    }

    // Initialize Leaflet Map
    function initMap() {
        const mapContainer = document.getElementById('map');
        if (!mapContainer || map) return;

        // Default center on Thessaloniki: 40.6401, 22.9444
        const center = userLocation ? [userLocation.lat, userLocation.lon] : [40.6401, 22.9444];
        map = L.map('map').setView(center, 13);

        // Google Maps styled roadmap tiles!
        L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            attribution: '&copy; Google Maps'
        }).addTo(map);

        markersGroup = L.layerGroup().addTo(map);
    }

    // Update markers on Leaflet map
    function updateMapMarkers(listings) {
        if (!map) return;
        if (!markersGroup) {
            markersGroup = L.layerGroup().addTo(map);
        }

        markersGroup.clearLayers();

        // User location marker (Google Maps style blue pin)
        if (userLocation) {
            if (userMarker) {
                map.removeLayer(userMarker);
            }
            
            const userIconHtml = `
                <svg viewBox="0 0 24 24" width="32" height="32" style="display: block; filter: drop-shadow(0 3px 4px rgba(0,0,0,0.3));">
                    <path fill="#3b82f6" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" stroke="#ffffff" stroke-width="1.5"/>
                </svg>
            `;

            const userIcon = L.divIcon({
                html: userIconHtml,
                className: 'user-location-marker',
                iconSize: [32, 32],
                iconAnchor: [16, 32],
                popupAnchor: [0, -32]
            });

            userMarker = L.marker([userLocation.lat, userLocation.lon], { icon: userIcon })
                .bindPopup('<b>📍 Η Τοποθεσία σου</b>')
                .addTo(map);
        } else if (userMarker) {
            map.removeLayer(userMarker);
            userMarker = null;
        }

        let bounds = [];
        if (userLocation) {
            bounds.push([userLocation.lat, userLocation.lon]);
        }

        listings.forEach(item => {
            const coords = geocodeCache[item.pickup_location];
            if (coords) {
                const isSoldOut = item.available_portions === 0;
                // Google Maps style red/terracotta pin or gray if sold out
                const pinColor = isSoldOut ? '#9ca3af' : '#e05d3a';
                
                const pinIconHtml = `
                    <svg viewBox="0 0 24 24" width="32" height="32" style="display: block; filter: drop-shadow(0 3px 4px rgba(0,0,0,0.35));">
                        <path fill="${pinColor}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" stroke="#ffffff" stroke-width="1.5"/>
                    </svg>
                `;
                
                const customIcon = L.divIcon({
                    html: pinIconHtml,
                    className: 'custom-food-marker',
                    iconSize: [32, 32],
                    iconAnchor: [16, 32],
                    popupAnchor: [0, -32]
                });

                const popupContent = `
                    <div style="font-family: var(--font-main); min-width: 170px; padding: 2px;">
                        <h4 style="margin: 0 0 4px 0; font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${escapeHTML(item.title)}</h4>
                        <p style="margin: 0 0 4px 0; font-size: 0.85rem; color: var(--text-muted);">📍 ${escapeHTML(item.pickup_location)}</p>
                        <p style="margin: 0 0 6px 0; font-size: 0.85rem; color: var(--text-muted);">🍽️ Μερίδες: <b>${item.available_portions} / ${item.total_portions}</b></p>
                        <button class="btn btn-order" 
                            onclick="requestPortion(${item.id})" 
                            style="width: 100%; padding: 6px 10px; font-size: 0.8rem; height: auto;"
                            ${isSoldOut ? 'disabled' : ''}>
                            ${isSoldOut ? 'Εξαντλήθηκε' : 'Θέλω Μερίδα!'}
                        </button>
                    </div>
                `;

                const marker = L.marker([coords.lat, coords.lon], { icon: customIcon })
                    .bindPopup(popupContent);
                
                markersGroup.addLayer(marker);
                bounds.push([coords.lat, coords.lon]);
            }
        });

        // Fit map bounds to show all markers nicely
        if (bounds.length > 0 && map) {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
        }
    }

    // Process Listings, calculate distances, apply sorting & distance filter
    async function processAndRenderFeed() {
        const listingsWithDistance = allListings.map(item => {
            let distance = null;
            const coords = geocodeCache[item.pickup_location];
            if (userLocation && coords) {
                distance = calculateDistance(userLocation.lat, userLocation.lon, coords.lat, coords.lon);
            }
            return { ...item, distance };
        });

        // Filter out own user listings
        let filteredListings = listingsWithDistance.filter(item => item.cook_id !== user.id);

        // Filter by max distance slider
        const maxDistance = parseFloat(document.getElementById('distance-range')?.value || 25);
        if (userLocation && maxDistance < 25) {
            filteredListings = filteredListings.filter(item => {
                return item.distance !== null && item.distance <= maxDistance;
            });
        }

        // Sort by distance if userLocation exists
        if (userLocation) {
            filteredListings.sort((a, b) => {
                if (a.distance === null) return 1;
                if (b.distance === null) return -1;
                return a.distance - b.distance;
            });
        }

        // Render listings cards
        renderFeed(filteredListings);

        // Update Leaflet pins
        updateMapMarkers(filteredListings);
    }

    // 1. Λήψη των αγγελιών από το Backend
    async function fetchListings() {
        try {
            const response = await fetch('/api/listings');
            allListings = await response.json();
            
            // Background geocode
            geocodeAllListingsAndRefresh(allListings);
            
            // Initial render
            await processAndRenderFeed();
        } catch (error) {
            console.error('Σφάλμα fetch:', error);
            feedContainer.innerHTML = '<p>Πρόβλημα στη φόρτωση του feed.</p>';
        }
    }

    // 2. Εμφάνιση των αγγελιών στην HTML
    function renderFeed(listings) {
        feedContainer.innerHTML = ''; 

        if (listings.length === 0) {
            feedContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">Δεν υπάρχουν διαθέσιμα γεύματα που να ταιριάζουν στα κριτήρια. 😢</p>';
            return;
        }

        listings.forEach(item => {
            const isSoldOut = item.available_portions === 0;
            
            const card = document.createElement('div');
            card.className = `card ${isSoldOut ? 'sold-out' : ''}`;
            
            // Allergens HTML
            let allergensHTML = '';
            if (item.allergens) {
                let parsed = item.allergens;
                if (typeof parsed === 'string') { 
                    try { parsed = JSON.parse(parsed); } catch(e) {} 
                }
                if (Array.isArray(parsed) && parsed.length > 0) {
                    allergensHTML = `<div class="allergen-pills-container">`;
                    parsed.forEach(allergen => {
                        allergensHTML += `<span class="allergen-pill">${escapeHTML(allergen)}</span>`;
                    });
                    allergensHTML += `</div>`;
                } else if (typeof parsed === 'string' && parsed.trim() !== '' && parsed !== '[]') {
                    allergensHTML = `<div class="allergen-pills-container"><span class="allergen-pill">${escapeHTML(parsed)}</span></div>`;
                }
            }

            // Distance badge HTML
            let distanceBadgeHTML = '';
            if (item.distance !== null) {
                distanceBadgeHTML = `
                    <div class="distance-badge-pill">
                        📍 ${item.distance.toFixed(1)} χλμ
                    </div>
                `;
            }
            
            card.innerHTML = `
                ${item.photo_url ? `<img src="${item.photo_url}" alt="${escapeHTML(item.title)}" class="food-img">` : ''}
                <div class="card-content">
                    ${distanceBadgeHTML}
                    <h3 style="font-weight: 700; margin-bottom: 0.5rem; font-size: 1.15rem;">${escapeHTML(item.title)}</h3>
                    <p style="font-size: 0.9rem; margin-bottom: 0.3rem;"><strong>📍 Τοποθεσία:</strong> ${escapeHTML(item.pickup_location)}</p>
                    <p style="font-size: 0.9rem; margin-bottom: 0.3rem;"><strong>⏰ Ώρα:</strong> ${new Date(item.pickup_time).toLocaleString('el-GR')}</p>
                    <p style="font-size: 0.9rem; margin-bottom: 0.4rem;"><strong>🍽️ Μερίδες:</strong> ${item.available_portions} / ${item.total_portions}</p>
                    ${item.notes ? `<p class="notes" style="font-style: italic; color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.6rem;">"${escapeHTML(item.notes)}"</p>` : ''}
                    ${allergensHTML}
                    
                    <button class="btn btn-order" 
                        onclick="requestPortion(${item.id})" 
                        style="width: 100%; margin-top: 0.5rem;"
                        ${isSoldOut ? 'disabled' : ''}>
                        ${isSoldOut ? 'Εξαντλήθηκε' : 'Θέλω Μερίδα!'}
                    </button>
                </div>
            `;
            feedContainer.appendChild(card);
        });
    }

    // Geocoding user address input handler
    async function handleGeocodeUserAddress() {
        const addressInput = document.getElementById('user-address');
        if (!addressInput) return;
        const addressValue = addressInput.value.trim();
        if (!addressValue) {
            alert('Παρακαλώ εισάγετε μια διεύθυνση.');
            return;
        }

        const btnGeocode = document.getElementById('btn-geocode');
        const originalText = btnGeocode.textContent;
        btnGeocode.disabled = true;
        btnGeocode.textContent = 'Αναζήτηση...';

        try {
            const coords = await geocodeAddress(addressValue);
            if (coords) {
                userLocation = coords;
                localStorage.setItem('unibite_user_address', addressValue);
                localStorage.setItem('unibite_user_coords', JSON.stringify(coords));
                
                if (!map) {
                    initMap();
                } else {
                    map.setView([userLocation.lat, userLocation.lon], 13);
                }

                await processAndRenderFeed();
            } else {
                alert('Δεν μπορέσαμε να εντοπίσουμε αυτή τη διεύθυνση. Δοκιμάστε ξανά με πιο απλούς όρους (π.χ. Θεσσαλονίκη).');
            }
        } catch (e) {
            console.error(e);
            alert('Σφάλμα κατά την αναζήτηση διεύθυνσης.');
        } finally {
            btnGeocode.disabled = false;
            btnGeocode.textContent = originalText;
        }
    }

    // DOM wire up
    const btnGeocode = document.getElementById('btn-geocode');
    const inputAddress = document.getElementById('user-address');
    const sliderDistance = document.getElementById('distance-range');
    const distanceValueSpan = document.getElementById('distance-value');

    if (btnGeocode) {
        btnGeocode.addEventListener('click', handleGeocodeUserAddress);
    }
    if (inputAddress) {
        inputAddress.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleGeocodeUserAddress();
            }
        });
    }
    if (sliderDistance) {
        sliderDistance.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (val >= 25) {
                distanceValueSpan.textContent = 'Όλα';
            } else {
                distanceValueSpan.textContent = `${val} χλμ`;
            }
        });
        sliderDistance.addEventListener('change', () => {
            processAndRenderFeed();
        });
    }

    const toggleListBtn = document.getElementById('toggle-list');
    const toggleMapBtn = document.getElementById('toggle-map');
    const mapViewContainer = document.getElementById('map-view-container');

    if (toggleListBtn && toggleMapBtn) {
        toggleListBtn.addEventListener('click', () => {
            currentView = 'list';
            toggleListBtn.classList.add('active');
            toggleMapBtn.classList.remove('active');
            mapViewContainer.classList.add('hidden-view');
            feedContainer.classList.remove('hidden-view');
        });

        toggleMapBtn.addEventListener('click', () => {
            currentView = 'map';
            toggleMapBtn.classList.add('active');
            toggleListBtn.classList.remove('active');
            feedContainer.classList.add('hidden-view');
            mapViewContainer.classList.remove('hidden-view');
            
            if (map) {
                map.invalidateSize(true);
            }
        });
    }

    // Load stored values
    const storedAddress = localStorage.getItem('unibite_user_address');
    const storedCoords = localStorage.getItem('unibite_user_coords');

    if (storedAddress && storedCoords) {
        if (inputAddress) inputAddress.value = storedAddress;
        try {
            userLocation = JSON.parse(storedCoords);
            const val = sliderDistance ? parseFloat(sliderDistance.value) : 25;
            if (distanceValueSpan) {
                distanceValueSpan.textContent = val >= 25 ? 'Όλα' : `${val} χλμ`;
            }
        } catch (e) {
            console.error('Failed to parse stored coordinates:', e);
        }
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
    initMap();
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