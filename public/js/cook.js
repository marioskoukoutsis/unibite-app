document.addEventListener('DOMContentLoaded', () => {
    // απαιτείται σύνδεση
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
        window.location.href = 'auth.html?redirect=cook.html';
        return;
    }

    const user = JSON.parse(storedUser);

// προσθήκη Admin Portal στο μενού αν είναι admin
    if (user.role === 'admin') {
        const navLinks = document.querySelector('.navbar-links');
        const adminLink = document.createElement('a');
        adminLink.href = 'admin.html';
        adminLink.textContent = 'Admin Portal';
        adminLink.style.cssText = 'color: var(--text-main); font-weight: 700;';

        // μπαίνει πριν τον "Λογαριασμό μου"
        const accountLink = navLinks.querySelector('a[href="account.html"]');
        navLinks.insertBefore(adminLink, accountLink);
    }
    const currentCookId = user.id;

    const form = document.getElementById('create-listing-form');
    const messageDiv = document.getElementById('message');
    const listingsContainer = document.getElementById('my-listings-container');

    // προσωρινό cache των αγγελιών — το διαβάζει η Επεξεργασία
    let currentListings = [];

    let cookMap = null;
    let cookMarker = null;

    function cleanCityName(cityName) {
        if (!cityName) return '';
        
        // χωρίς τόνους & πεζά, για να ταιριάζουν τα prefixes
        const normalized = cityName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        
        // κόβει διοικητικά prefixes (Δήμος, Περιφέρεια, κ.λπ.)
        const prefixRegex = /^(δημος|δημοτικη ενοτητα|περιφερειακη ενοτητα|περιφερεια|δημοτικη κοινοτητα|τοπικη κοινοτητα|κοινοτητα)\s+/i;
        const match = normalized.match(prefixRegex);
        
        let baseOriginal = cityName.trim();
        let baseNormalized = normalized;
        
        if (match) {
            const matchLength = match[0].length;
            baseOriginal = cityName.trim().slice(matchLength).trim();
            baseNormalized = normalized.slice(matchLength).trim();
        }
        
        // γενική/παραλλαγές πόλεων → καθαρή ονομαστική (π.χ. Πατρών → Πάτρα)
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

    // προτάσεις διευθύνσεων από το Nominatim (μόνο Ελλάδα)
    async function fetchAddressSuggestions(query) {
        if (!query || query.trim().length < 3) return [];

        // αν ο χρήστης έγραψε αριθμό, τον κρατάμε
        const queryNumberMatch = query.match(/\b\d+\b/);
        const queryNumber = queryNumberMatch ? queryNumberMatch[0] : '';

        try {
            // countrycodes=gr → αποτελέσματα μόνο εντός Ελλάδας
            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&countrycodes=gr&q=${encodeURIComponent(query.trim())}`;
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

        // κλείσιμο προτάσεων με κλικ έξω
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

    function initCookMap(lat = 38.2466, lon = 21.7346, zoom = 13) {
        const mapContainer = document.getElementById('cook-map');
        if (!mapContainer) return;

        if (!cookMap) {
            // όρια Ελλάδας [[νότος, δύση], [βορράς, ανατολή]] — κλειδώνουν τον χάρτη εντός χώρας
            const greeceBounds = L.latLngBounds([34.7, 19.2], [41.9, 29.8]);
            cookMap = L.map('cook-map', {
                maxBounds: greeceBounds,
                maxBoundsViscosity: 1.0,
                minZoom: 6
            }).setView([lat, lon], zoom);
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

    // η ώρα παραλαβής δεν μπορεί να ξεπερνά τις 48 ώρες
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

        // πρώτα υψηλή ακρίβεια (GPS/Wi-Fi)
        navigator.geolocation.getCurrentPosition(
            successCallback,
            (error) => {
                console.warn('High accuracy geolocation failed/timed out. Trying IP fallback...', error);
                // αλλιώς χαμηλή ακρίβεια (εντοπισμός μέσω IP)
                navigator.geolocation.getCurrentPosition(
                    successCallback,
                    async (error2) => {
                        console.warn('Low accuracy geolocation also failed. Trying IP API fallback...', error2);
                        const ipSuccess = await fallbackCookIPLocation(inputLocation, originalPlaceholder);
                        if (!ipSuccess && inputLocation) {
                            inputLocation.placeholder = originalPlaceholder;
                        }
                    },
                    { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
                );
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    }

    const btnDetectGps = document.getElementById('btn-detect-gps');
    if (btnDetectGps) {
        btnDetectGps.addEventListener('click', detectCookLocation);
    }

    // Ανίχνευση κινητού & UI φωτογραφίας.
    // pointer:coarse (touch) + μικρή οθόνη → πιάνει κινητά/tablets αλλά όχι touch desktops
    const isMobileDevice = (() => {
        const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
        const isNarrowScreen = window.innerWidth <= 1024;
        const hasTouchPoints = navigator.maxTouchPoints > 0;
        // κινητό = touch ΚΑΙ μικρή οθόνη
        return (hasCoarsePointer || hasTouchPoints) && isNarrowScreen;
    })();

    const btnTakePhoto = document.getElementById('btn-take-photo');
    const btnPickGallery = document.getElementById('btn-pick-gallery');
    const galleryBtnText = document.getElementById('gallery-btn-text');
    const photoInput = document.getElementById('photo');          // από συλλογή
    const photoCameraInput = document.getElementById('photo-camera'); // από κάμερα
    const photoPreviewContainer = document.getElementById('photo-preview-container');
    const photoPreviewImg = document.getElementById('photo-preview-img');
    const btnRemovePhoto = document.getElementById('btn-remove-photo');

    // η επιλεγμένη φωτογραφία (από κάμερα ή συλλογή)
    let selectedPhotoFile = null;

    if (isMobileDevice) {
        // κινητό: και τα δύο κουμπιά (κάμερα + συλλογή)
        if (btnTakePhoto) btnTakePhoto.style.display = 'inline-flex';
        if (galleryBtnText) galleryBtnText.textContent = 'Επίλεξε από Συλλογή';
    } else {
        // desktop: μόνο επιλογή αρχείου
        if (btnTakePhoto) btnTakePhoto.style.display = 'none';
        if (galleryBtnText) galleryBtnText.textContent = 'Επίλεξε από Αρχεία';
    }

    // "Βγάλε Φωτογραφία" → άνοιγμα κάμερας
    if (btnTakePhoto) {
        btnTakePhoto.addEventListener('click', () => {
            photoCameraInput.click();
        });
    }

    // "Επίλεξε από Συλλογή/Αρχεία" → άνοιγμα επιλογής αρχείου
    if (btnPickGallery) {
        btnPickGallery.addEventListener('click', () => {
            photoInput.click();
        });
    }

    // όταν επιλεγεί αρχείο: κράτα το + δείξε preview
    function handlePhotoSelected(file) {
        if (!file) return;

        selectedPhotoFile = file;

        // preview αμέσως
        const reader = new FileReader();
        reader.onload = (e) => {
            photoPreviewImg.src = e.target.result;
            photoPreviewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }

    // ακούμε και τα δύο inputs
    photoInput.addEventListener('change', () => {
        if (photoInput.files.length > 0) {
            handlePhotoSelected(photoInput.files[0]);
        }
    });

    photoCameraInput.addEventListener('change', () => {
        if (photoCameraInput.files.length > 0) {
            handlePhotoSelected(photoCameraInput.files[0]);
        }
    });

    // αφαίρεση φωτογραφίας
    if (btnRemovePhoto) {
        btnRemovePhoto.addEventListener('click', () => {
            selectedPhotoFile = null;
            photoInput.value = '';
            photoCameraInput.value = '';
            photoPreviewContainer.style.display = 'none';
            photoPreviewImg.src = '';
        });
    }

    // Συμπίεση/resize πριν το ανέβασμα.
    // Οι φωτο κινητού φτάνουν 5-15MB+ και ξεπερνούν το όριο του server —
    // τις φέρνουμε σε max 1200px / JPEG 0.7 (~100-300KB).
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

                // αναλογική σμίκρυνση αν ξεπερνά τα 1200px
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

                // export ως JPEG 0.7 — μεγάλη μείωση μεγέθους
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                resolve(compressedBase64);
            };
            img.onerror = () => reject(new Error('Αποτυχία φόρτωσης εικόνας'));
            img.src = reader.result;
        };
    });

    // υποβολή φόρμας: POST για νέα, PUT για επεξεργασία
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const editId = document.getElementById('edit-listing-id').value; // έχει τιμή μόνο σε επεξεργασία

        let photoBase64String = null;
        if (selectedPhotoFile) {
            photoBase64String = await getBase64(selectedPhotoFile);
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
            // editId → PUT /api/listings/:id, αλλιώς POST για νέα
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
                cancelEdit(); // καθαρισμός φόρμας
                fetchMyListings(); // ανανέωση λίστας
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

    // γεμίζει τη φόρμα με τα στοιχεία μιας αγγελίας για επεξεργασία
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

        // περνάμε σε λειτουργία επεξεργασίας
        document.getElementById('form-title').textContent = 'Επεξεργασία Αγγελίας';
        document.getElementById('submit-btn').textContent = 'Αποθήκευση Αλλαγών';
        document.getElementById('cancel-edit-btn').style.display = 'inline-block';

        // ενημέρωση pin στον χάρτη
        if (listing.latitude !== null && listing.longitude !== null) {
            initCookMap(parseFloat(listing.latitude), parseFloat(listing.longitude), 16);
        } else {
            initCookMap(38.2466, 21.7346, 13);
        }

        // scroll πάνω για να φανεί η φόρμα
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // ακύρωση επεξεργασίας — επαναφορά φόρμας σε "νέα αγγελία"
    window.cancelEdit = function() {
        form.reset();
        document.getElementById('edit-listing-id').value = '';
        document.getElementById('latitude').value = '';
        document.getElementById('longitude').value = '';
        document.getElementById('form-title').textContent = 'Δημιουργία Αγγελίας';
        document.getElementById('submit-btn').textContent = 'Ανέβασμα Αγγελίας';
        document.getElementById('cancel-edit-btn').style.display = 'none';
        messageDiv.textContent = '';

        // καθάρισμα φωτογραφίας
        selectedPhotoFile = null;
        photoInput.value = '';
        photoCameraInput.value = '';
        photoPreviewContainer.style.display = 'none';
        photoPreviewImg.src = '';

        if (cookMap) {
            initCookMap(38.2466, 21.7346, 13);
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
            if (response.ok) fetchMyListings(); // ανανέωση λίστας χωρίς reload
            else alert('Σφάλμα κατά τη διαγραφή');
        } catch (error) { alert('Πρόβλημα σύνδεσης.'); }
    };
});