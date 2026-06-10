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
        adminLink.style.cssText = 'color: var(--text-main); font-weight: 700;';

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

    let cookMap = null;
    let cookMarker = null;

    function cleanCityName(cityName) {
        if (!cityName) return '';
        
        // Normalize string to remove accents and convert to lowercase for prefix matching
        const normalized = cityName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        
        // Prefix regex matching common Greek administrative divisions
        const prefixRegex = /^(δημος|δημοτικη ενοτητα|περιφερειακη ενοτητα|περιφερεια|δημοτικη κοινοτητα|τοπικη κοινοτητα|κοινοτητα)\s+/i;
        const match = normalized.match(prefixRegex);
        
        let baseOriginal = cityName.trim();
        let baseNormalized = normalized;
        
        if (match) {
            const matchLength = match[0].length;
            baseOriginal = cityName.trim().slice(matchLength).trim();
            baseNormalized = normalized.slice(matchLength).trim();
        }
        
        // Map common Greek city genitives/variations to their clean nominative name
        const map = {
            'πατρεων': 'Πάτρα',
            'πατρων': 'Πάτρα',
            'πατρα': 'Πάτρα',
            'αθηναιων': 'Αθήνα',
            'αθηνα': 'Αθήνα',
            'θεσσαλονικης': 'Θεσσαλονίκη',
            'θεσσαλονικη': 'Θεσσαλονίκη',
            'πειραιως': 'Πειραιάς',
            'πειραιας': 'Πειραιάς',
            'λαρισαιων': 'Λάρισα',
            'λαρισα': 'Λάρισα',
            'ηρακλειου': 'Ηράκλειο',
            'ηρακλειο': 'Ηράκλειο',
            'βολου': 'Βόλος',
            'βολος': 'Βόλος',
            'ιωαννιτων': 'Ιωάννινα',
            'ιωαννινα': 'Ιωάννινα',
            'χανιων': 'Χανιά',
            'χανια': 'Χανιά',
            'χαλκιδεων': 'Χαλκίδα',
            'χαλκιδα': 'Χαλκίδα'
        };
        
        return map[baseNormalized] || baseOriginal;
    }

    // Fetch address suggestions from Nominatim API (global search)
    async function fetchAddressSuggestions(query) {
        if (!query || query.trim().length < 3) return [];

        // Extract street number from user query if present
        const queryNumberMatch = query.match(/\b\d+\b/);
        const queryNumber = queryNumberMatch ? queryNumberMatch[0] : '';

        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q=${encodeURIComponent(query.trim())}`;
            const response = await fetch(url, {
                headers: {
                    'Accept-Language': 'el,en',
                    'User-Agent': 'UniBiteApp/1.0'
                }
            });
            if (!response.ok) return [];
            const data = await response.json();
            return data.map(item => {
                const addr = item.address || {};
                const parts = [];
                
                const rawParts = item.display_name ? item.display_name.split(',').map(s => s.trim()) : [];
                const road = addr.road || addr.pedestrian || addr.highway || addr.path || rawParts[0] || '';
                let number = addr.house_number || '';
                
                if (!number && queryNumber && !/\d/.test(road)) {
                    number = queryNumber;
                }

                if (road) {
                    parts.push(number ? `${road} ${number}` : road);
                }
                
                const area = addr.suburb || addr.neighbourhood || addr.quarter || addr.subdivision || '';
                if (area) {
                    parts.push(area);
                }
                
                const cityRaw = addr.city || addr.town || addr.village || addr.municipality || addr.city_district || '';
                const city = cleanCityName(cityRaw);
                if (city) {
                    parts.push(city);
                }
                
                const country = addr.country || '';
                if (country) {
                    parts.push(country);
                }
                
                let cleanName = parts.join(', ');
                if (!cleanName && item.display_name) {
                    cleanName = item.display_name.split(',').slice(0, 4).map(s => s.trim()).join(', ');
                }
                
                return {
                    display_name: cleanName || item.display_name,
                    lat: parseFloat(item.lat),
                    lon: parseFloat(item.lon)
                };
            });
        } catch (e) {
            console.error('Error fetching autocomplete suggestions:', e);
            return [];
        }
    }

    function setupAutocomplete(inputEl, suggestionsEl, onSelect) {
        let debounceTimer = null;

        inputEl.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const query = inputEl.value;

            if (query.trim().length < 3) {
                suggestionsEl.innerHTML = '';
                suggestionsEl.style.display = 'none';
                return;
            }

            debounceTimer = setTimeout(async () => {
                const results = await fetchAddressSuggestions(query);
                if (results.length === 0) {
                    suggestionsEl.innerHTML = '';
                    suggestionsEl.style.display = 'none';
                    return;
                }

                suggestionsEl.innerHTML = '';
                results.forEach(res => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'autocomplete-suggestion';
                    itemDiv.textContent = res.display_name;
                    itemDiv.addEventListener('click', () => {
                        inputEl.value = res.display_name;
                        suggestionsEl.innerHTML = '';
                        suggestionsEl.style.display = 'none';
                        onSelect(res);
                    });
                    suggestionsEl.appendChild(itemDiv);
                });
                suggestionsEl.style.display = 'block';
            }, 300);
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!inputEl.contains(e.target) && !suggestionsEl.contains(e.target)) {
                suggestionsEl.innerHTML = '';
                suggestionsEl.style.display = 'none';
            }
        });
    }

    async function reverseGeocode(lat, lon) {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
            const response = await fetch(url, {
                headers: {
                    'Accept-Language': 'el,en',
                    'User-Agent': 'UniBiteApp/1.0'
                }
            });
            if (response.ok) {
                const data = await response.json();
                if (data) {
                    const addr = data.address || {};
                    const parts = [];
                    
                    const road = addr.road || addr.pedestrian || addr.highway || addr.path || '';
                    const number = addr.house_number || '';
                    if (road) {
                        parts.push(number ? `${road} ${number}` : road);
                    }
                    
                    const area = addr.suburb || addr.neighbourhood || addr.quarter || addr.subdivision || '';
                    if (area) {
                        parts.push(area);
                    }
                    
                    const cityRaw = addr.city || addr.town || addr.village || addr.municipality || addr.city_district || '';
                    const city = cleanCityName(cityRaw);
                    if (city) {
                        parts.push(city);
                    }
                    
                    const country = addr.country || '';
                    if (country) {
                        parts.push(country);
                    }
                    
                    let cleanName = parts.join(', ');
                    if (!cleanName && data.display_name) {
                        cleanName = data.display_name.split(',').slice(0, 4).map(s => s.trim()).join(', ');
                    }
                    
                    document.getElementById('location').value = cleanName || data.display_name;
                }
            }
        } catch (e) {
            console.error('Reverse geocoding failed:', e);
        }
    }

    function initCookMap(lat = 40.6401, lon = 22.9444, zoom = 13) {
        const mapContainer = document.getElementById('cook-map');
        if (!mapContainer) return;

        if (!cookMap) {
            cookMap = L.map('cook-map').setView([lat, lon], zoom);
            L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
                attribution: '&copy; Google Maps'
            }).addTo(cookMap);
        } else {
            cookMap.setView([lat, lon], zoom);
        }

        updateCookMarker(lat, lon);
    }

    function updateCookMarker(lat, lon) {
        if (!cookMap) return;

        const pinIconHtml = `
            <svg viewBox="0 0 24 24" width="36" height="36" style="display: block; filter: drop-shadow(0 3px 4px rgba(0,0,0,0.35));">
                <path fill="#e05d3a" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" stroke="#ffffff" stroke-width="1.5"/>
            </svg>
        `;

        const customIcon = L.divIcon({
            html: pinIconHtml,
            className: 'cook-location-marker',
            iconSize: [36, 36],
            iconAnchor: [18, 36]
        });

        if (cookMarker) {
            cookMarker.setLatLng([lat, lon]);
        } else {
            cookMarker = L.marker([lat, lon], {
                icon: customIcon,
                draggable: true
            }).addTo(cookMap);

            cookMarker.on('dragend', async () => {
                const position = cookMarker.getLatLng();
                const newLat = position.lat;
                const newLon = position.lng;

                document.getElementById('latitude').value = newLat.toFixed(6);
                document.getElementById('longitude').value = newLon.toFixed(6);

                await reverseGeocode(newLat, newLon);
            });
        }

        cookMap.setView([lat, lon]);
    }

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
    initCookMap();

    const locationInput = document.getElementById('location');
    const locationSuggestions = document.getElementById('location-suggestions');
    if (locationInput && locationSuggestions) {
        setupAutocomplete(locationInput, locationSuggestions, (selected) => {
            const lat = selected.lat;
            const lon = selected.lon;
            document.getElementById('latitude').value = lat.toFixed(6);
            document.getElementById('longitude').value = lon.toFixed(6);
            initCookMap(lat, lon, 16);
        });
    }

    async function fallbackCookIPLocation(inputEl, originalPlaceholder) {
        try {
            const response = await fetch('https://ipapi.co/json/');
            if (response.ok) {
                const data = await response.json();
                if (data && data.latitude && data.longitude) {
                    const lat = parseFloat(data.latitude);
                    const lon = parseFloat(data.longitude);
                    
                    document.getElementById('latitude').value = lat.toFixed(6);
                    document.getElementById('longitude').value = lon.toFixed(6);

                    await reverseGeocode(lat, lon);
                    initCookMap(lat, lon, 16);

                    if (inputEl) {
                        inputEl.placeholder = originalPlaceholder;
                    }
                    return true;
                }
            }
        } catch (e) {
            console.error('IP Geolocation fallback failed:', e);
        }
        return false;
    }

    function detectCookLocation() {
        if (!navigator.geolocation) {
            console.warn('Geolocation not supported.');
            fallbackCookIPLocation(document.getElementById('location'), '');
            return;
        }

        const inputLocation = document.getElementById('location');
        const originalPlaceholder = inputLocation ? inputLocation.placeholder : '';
        if (inputLocation) {
            inputLocation.placeholder = 'Εντοπισμός τοποθεσίας...';
        }

        const successCallback = async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            document.getElementById('latitude').value = lat.toFixed(6);
            document.getElementById('longitude').value = lon.toFixed(6);

            await reverseGeocode(lat, lon);
            initCookMap(lat, lon, 16);

            if (inputLocation) {
                inputLocation.placeholder = originalPlaceholder;
            }
        };

        // Try high accuracy (GPS/Wi-Fi positioning) first
        navigator.geolocation.getCurrentPosition(
            successCallback,
            (error) => {
                console.warn('High accuracy geolocation failed/timed out. Trying IP fallback...', error);
                // Fallback to low accuracy (IP positioning)
                navigator.geolocation.getCurrentPosition(
                    successCallback,
                    async (error2) => {
                        console.warn('Low accuracy geolocation also failed. Trying IP API fallback...', error2);
                        const ipSuccess = await fallbackCookIPLocation(inputLocation, originalPlaceholder);
                        if (!ipSuccess && inputLocation) {
                            inputLocation.placeholder = originalPlaceholder;
                        }
                    },
                    { enableHighAccuracy: false, timeout: 8000, maximumAge: Infinity }
                );
            },
            { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 }
        );
    }

    const btnDetectGps = document.getElementById('btn-detect-gps');
    if (btnDetectGps) {
        btnDetectGps.addEventListener('click', detectCookLocation);
    }

    // Συμπίεση & Resize φωτογραφίας πριν την αποστολή
    // Οι φωτογραφίες κινητού είναι συχνά 5-15MB+ και σπάνε το όριο του server.
    // Μειώνουμε σε max 1200px και JPEG quality 0.7 (~100-300KB τελικό μέγεθος).
    const getBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onerror = error => reject(error);
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const MAX_DIM = 1200;
                let width = img.width;
                let height = img.height;

                // Αν η εικόνα είναι μεγαλύτερη από 1200px, τη μικραίνουμε αναλογικά
                if (width > MAX_DIM || height > MAX_DIM) {
                    if (width > height) {
                        height = Math.round(height * MAX_DIM / width);
                        width = MAX_DIM;
                    } else {
                        width = Math.round(width * MAX_DIM / height);
                        height = MAX_DIM;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Εξαγωγή ως JPEG με quality 0.7 — δραματική μείωση μεγέθους
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                resolve(compressedBase64);
            };
            img.onerror = () => reject(new Error('Αποτυχία φόρτωσης εικόνας'));
            img.src = reader.result;
        };
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
        const latVal = document.getElementById('latitude').value;
        const lonVal = document.getElementById('longitude').value;

        const listingData = {
            cook_id: currentCookId,
            title: document.getElementById('title').value,
            total_portions: document.getElementById('portions').value,
            pickup_location: document.getElementById('location').value,
            pickup_time: document.getElementById('time').value,
            notes: document.getElementById('notes').value,
            allergens: allergensInput ? allergensInput.split(',').map(item => item.trim()) : [],
            photo_base64: photoBase64String,
            latitude: latVal ? parseFloat(latVal) : null,
            longitude: lonVal ? parseFloat(lonVal) : null
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
        document.getElementById('latitude').value = listing.latitude || '';
        document.getElementById('longitude').value = listing.longitude || '';

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

        // Update map pin
        if (listing.latitude !== null && listing.longitude !== null) {
            initCookMap(parseFloat(listing.latitude), parseFloat(listing.longitude), 16);
        } else {
            initCookMap(40.6401, 22.9444, 13);
        }

        // Ανεβαίνουμε στην κορυφή της σελίδας για να δει τη φόρμα
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // --- ΑΚΥΡΩΣΗ ΕΠΕΞΕΡΓΑΣΙΑΣ ΚΑΙ ΕΠΙΣΤΡΟΦΗ ---
    window.cancelEdit = function() {
        form.reset();
        document.getElementById('edit-listing-id').value = '';
        document.getElementById('latitude').value = '';
        document.getElementById('longitude').value = '';
        document.getElementById('form-title').textContent = 'Δημιουργία Αγγελίας';
        document.getElementById('submit-btn').textContent = 'Ανέβασμα Αγγελίας';
        document.getElementById('cancel-edit-btn').style.display = 'none';
        messageDiv.textContent = '';

        if (cookMap) {
            initCookMap(40.6401, 22.9444, 13);
        }
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