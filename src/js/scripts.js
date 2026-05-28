// Stripe Payment Links — paste your live Payment Link URLs here
const STRIPE_LINKS = {
    monthly: 'https://donate.stripe.com/REPLACE_WITH_MONTHLY_LINK',
    once: 'https://donate.stripe.com/REPLACE_WITH_ONETIME_LINK'
};

// Point Leaflet's default marker images to the vendored copy
L.Icon.Default.imagePath = 'vendor/images/';

const map = L.map('map', { zoomControl: false }).setView([20, 0], 2);
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const searchAreaButton = document.getElementById('searchAreaButton');
const searchContainer = document.getElementById('searchContainer');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const locateButton = document.getElementById('locateButton');
const autocompleteResults = document.getElementById('autocompleteResults');
const loader = document.getElementById('loader');
const statusMessage = document.getElementById('statusMessage');
const closestWaterButton = document.getElementById('closestWaterButton');
const closestWaterName = document.getElementById('closestWaterName');
const closestWaterDistance = document.getElementById('closestWaterDistance');
const donationFrequencyButtons = Array.from(document.querySelectorAll('.donationFrequency'));
const amountButtons = Array.from(document.querySelectorAll('.amountButton'));
const donationOverlay = document.getElementById('donationOverlay');
const donationOpenButton = document.getElementById('donationOpenButton');
const donationCloseButton = document.getElementById('donationCloseButton');
const missionPanel = document.getElementById('missionPanel');
const missionToggle = document.getElementById('missionToggle');
const missionModal = document.getElementById('missionModal');
const missionClose = document.getElementById('missionClose');
const missionDonateBtn = document.getElementById('missionDonateBtn');
const waterSheet = document.getElementById('waterSheet');
const waterSheetContent = document.getElementById('waterSheetContent');
const waterSheetClose = document.getElementById('waterSheetClose');
const customDonationAmount = document.getElementById('customDonationAmount');
const donateButton = document.getElementById('donateButton');
const markerLayer = L.layerGroup().addTo(map);
const userLocationLayer = L.layerGroup().addTo(map);

let autocompleteItems = [];
let activeAutocompleteIndex = -1;
let autocompleteController = null;
let donationFrequency = 'monthly';
let donationAmount = 25;
let hasMapResults = false;
let userLocation = null;
let userMarker = null;
let accuracyCircle = null;
let locationWatchId = null;
let locationWatchTimeout = null;
let bestLocationAccuracy = Infinity;
let nearestWaterSite = null;
let waterSites = [];

const isMobile = () => window.matchMedia('(max-width: 720px)').matches;

const waterMarkerHtml = '<img src="images/water-marker.svg" alt="" aria-hidden="true">';

const waterIcon = L.divIcon({
    className: 'waterMarkerIcon',
    html: waterMarkerHtml,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
    popupAnchor: [0, -38]
});

const closestWaterIcon = L.divIcon({
    className: 'waterMarkerIcon closestWaterMarker',
    html: `<span class="closestWaterRing"></span>${waterMarkerHtml}`,
    iconSize: [46, 54],
    iconAnchor: [23, 54],
    popupAnchor: [0, -50]
});

const userLocationIcon = L.divIcon({
    className: 'userLocationMarker',
    html: '<span class="userLocationPulse"></span><span class="userLocationDot"></span>',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
});

function debounce(func, wait = 200) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function setLoading(isLoading) {
    loader.style.display = isLoading ? 'block' : 'none';
    searchButton.disabled = isLoading;
    locateButton.disabled = isLoading;
    searchAreaButton.disabled = isLoading;
}

function setStatus(message) {
    statusMessage.textContent = message;
}

function formatDistance(meters) {
    if (!Number.isFinite(meters)) return 'Distance unavailable';
    if (meters < 1000) return `${Math.round(meters)} m away`;
    return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km away`;
}

function setResultsMode(isActive) {
    hasMapResults = isActive;
    document.body.classList.toggle('has-map-results', isActive);
    document.body.classList.toggle('is-search-home', !isActive);
    if (isActive) closeMissionModal();
    closeWaterSheet();
}

// --- Mission modal ---

function openMissionModal() {
    missionModal.hidden = false;
    // Trigger animation on next paint
    requestAnimationFrame(() => missionModal.classList.add('is-open'));
    missionToggle.setAttribute('aria-expanded', 'true');
    missionModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('mission-open');
    missionClose.focus();
}

function closeMissionModal() {
    missionModal.classList.remove('is-open');
    missionToggle.setAttribute('aria-expanded', 'false');
    missionModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('mission-open');
    // Wait for transition before hiding
    missionModal.addEventListener('transitionend', () => {
        if (!missionModal.classList.contains('is-open')) missionModal.hidden = true;
    }, { once: true });
}

// --- Water bottom sheet ---
// sheetCloseToken: incremented by openWaterSheet to cancel any in-flight close
// animation (avoids race where Leaflet fires map click before marker click).
let sheetCloseToken = 0;

function openWaterSheet(html) {
    sheetCloseToken++;                          // cancel any pending close
    waterSheetContent.innerHTML = html;
    waterSheet.hidden = false;
    waterSheet.setAttribute('aria-hidden', 'false');
    // Force a reflow so the transition fires even if we're mid-close
    waterSheet.classList.remove('is-open');
    // eslint-disable-next-line no-unused-expressions
    waterSheet.offsetHeight;
    waterSheet.classList.add('is-open');
}

function closeWaterSheet() {
    if (waterSheet.hidden) return;
    const token = ++sheetCloseToken;
    waterSheet.classList.remove('is-open');
    waterSheet.setAttribute('aria-hidden', 'true');
    waterSheet.addEventListener('transitionend', () => {
        // Only hide if no openWaterSheet() was called since we started closing
        if (token === sheetCloseToken && !waterSheet.classList.contains('is-open')) {
            waterSheet.hidden = true;
            waterSheetContent.innerHTML = '';
        }
    }, { once: true });
}

function setAutocompleteOpen(isOpen) {
    autocompleteResults.classList.toggle('is-open', isOpen);
    searchInput.setAttribute('aria-expanded', String(isOpen));
}

function getElementPosition(element) {
    if (typeof element.lat === 'number' && typeof element.lon === 'number') {
        return { lat: element.lat, lon: element.lon };
    }
    if (element.center && typeof element.center.lat === 'number' && typeof element.center.lon === 'number') {
        return { lat: element.center.lat, lon: element.center.lon };
    }
    return null;
}

function getPositionLatLng(position) {
    return L.latLng(position.lat, position.lon);
}

function formatSiteName(tags) {
    // Use the OSM name if mapped
    if (tags.name) return tags.name;

    const type = tags.amenity === 'fountain' ? 'Fountain'
               : tags.man_made === 'water_tap' ? 'Water Tap'
               : 'Drinking Water';

    // Street address → "Fountain at 12 Oak St"
    if (tags['addr:street']) {
        const num = tags['addr:housenumber'];
        return `${type} ${num ? `at ${num} ${tags['addr:street']}` : `on ${tags['addr:street']}`}`;
    }
    // Operator branding → "Water Tap · Chicago Parks"
    if (tags.operator) return `${type} · ${tags.operator}`;
    // Structural location tag → "Fountain (entrance)"
    if (tags.location) return `${type} (${formatTagValue(tags.location)})`;
    // Neighbourhood or city → "Fountain in Wicker Park"
    const area = tags['addr:neighbourhood'] || tags['addr:suburb']
               || tags['addr:city']         || tags['addr:town']
               || tags['addr:village'];
    if (area) return `${type} in ${area}`;
    // Indoor hint
    if (tags.indoor === 'yes') return `Indoor ${type}`;

    return `Public ${type}`;
}

function getPopupSubtitle(tags) {
    // Return the most useful WHERE label for the card subtitle
    if (tags['addr:street']) {
        const num = tags['addr:housenumber'];
        const line1 = num ? `${num} ${tags['addr:street']}` : tags['addr:street'];
        const city = tags['addr:city'] || tags['addr:town'] || tags['addr:village'];
        return city ? `${line1}, ${city}` : line1;
    }
    const area = tags['addr:neighbourhood'] || tags['addr:suburb']
               || tags['addr:city']         || tags['addr:town']
               || tags['addr:village'];
    if (area) return area;
    if (tags.operator) return `Operated by ${tags.operator}`;
    if (tags.location) return formatTagValue(tags.location);
    if (tags.indoor === 'yes') return 'Indoor location';
    return getWaterType(tags);
}

function formatTagValue(value) {
    return String(value)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, character => character.toUpperCase());
}

function getWaterType(tags) {
    if (tags.man_made === 'water_tap') return 'Water tap';
    if (tags.amenity === 'fountain') return 'Fountain';
    if (tags.amenity === 'drinking_water') return 'Drinking water';
    return 'Public water';
}

function getAccessText(tags) {
    if (tags.access === 'private') return 'Private access';
    if (tags.access === 'customers') return 'Customers only';
    if (tags.access) return formatTagValue(tags.access);
    return 'Public access likely';
}

function getFeeText(tags) {
    if (tags.fee === 'yes') return 'May require payment';
    if (tags.fee === 'no') return 'Free';
    return 'No fee listed';
}

function getBottleText(tags) {
    if (tags.bottle === 'yes') return 'Bottle refill';
    if (tags.bottle === 'no') return 'Bottle refill unknown';
    return 'Refill info unknown';
}

function getPlaceDescription(tags) {
    const type = getWaterType(tags).toLowerCase();
    const access = getAccessText(tags).toLowerCase();
    const fee = getFeeText(tags).toLowerCase();
    const bottle = tags.bottle === 'yes' ? ' and suitable for bottle refills' : '';

    if (access.includes('private') || access.includes('customers')) {
        return `A ${type} source with ${access}${bottle}. Check access before relying on it.`;
    }
    if (fee.includes('payment')) {
        return `A ${type} source that may require payment${bottle}.`;
    }
    return `A free public ${type} source${bottle}.`;
}

function getPlaceContext(tags, position) {
    const addressParts = [
        [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
        tags['addr:neighbourhood'] || tags['addr:suburb'],
        tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
        tags['addr:state'] || tags['addr:province']
    ].filter(Boolean);

    if (addressParts.length) {
        return `Mapped near ${addressParts.join(', ')}.`;
    }
    if (tags.operator) {
        return `Mapped as operated by ${tags.operator}.`;
    }
    if (tags.location) {
        return `Mapped as ${formatTagValue(tags.location).toLowerCase()} at this spot.`;
    }
    return `Mapped at ${position.lat.toFixed(5)}, ${position.lon.toFixed(5)}.`;
}

function getOpenStreetMapElementUrl(element) {
    if (!element.type || !element.id) return 'https://www.openstreetmap.org/';
    return `https://www.openstreetmap.org/${element.type}/${element.id}`;
}

function popupIcon(name) {
    const icons = {
        access: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11V8a4 4 0 0 1 7.5-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="5" y="11" width="14" height="9" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 15v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        bottle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3h4v3l1.6 1.8c.6.7.9 1.5.9 2.4V19a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-8.8c0-.9.3-1.8.9-2.4L10 6V3Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 13h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v4l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        coin: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14.5 9.5c-.7-.5-1.5-.7-2.5-.7-1.3 0-2.2.6-2.2 1.5 0 2.3 4.9 1 4.9 3.7 0 1-.9 1.7-2.5 1.7-1 0-2-.3-2.8-.9M12 7.5v9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
        indoor: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11 12 4l8 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10v10h12V10" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
        info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v5M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2V6Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 4v14M15 6v14" stroke="currentColor" stroke-width="2"/></svg>',
        operator: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 20a7 7 0 0 1 14 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.5 7-12a7 7 0 1 0-14 0c0 6.5 7 12 7 12Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="9" r="2.3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
        type: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c3 3.3 5 6.1 5 9a5 5 0 0 1-10 0c0-2.9 2-5.7 5-9Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>'
    };
    return icons[name] || icons.info;
}

function buildPopupContent(element, tags, position) {
    const osmElementUrl = getOpenStreetMapElementUrl(element);
    const placeDescription = getPlaceDescription(tags);
    const placeContext = getPlaceContext(tags, position);
    const usefulDetails = [
        ['Type', getWaterType(tags), 'type'],
        ['Access', getAccessText(tags), 'access'],
        ['Fee', getFeeText(tags), 'coin'],
        ...(tags.bottle ? [['Bottle', getBottleText(tags), 'bottle']] : []),
        ...(tags.indoor ? [['Indoor', formatTagValue(tags.indoor), 'indoor']] : []),
        ...(tags.opening_hours ? [['Hours', tags.opening_hours, 'clock']] : []),
        ...(tags.operator ? [['Operator', tags.operator, 'operator']] : []),
    ];

    const detailRows = usefulDetails
        .map(([label, value, icon]) => `
            <div class="popupDetail">
                <span>${popupIcon(icon)}${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
            </div>
        `)
        .join('');

    return `
        <article class="waterPopup">
            <header class="popupHeader">
                <img src="images/water-pin-icon.svg" alt="" aria-hidden="true">
                <div>
                    <strong>${escapeHtml(formatSiteName(tags))}</strong>
                    <span>${escapeHtml(getPopupSubtitle(tags))}</span>
                </div>
            </header>
            <div class="popupSummary" aria-label="Water source summary">
                <p>${popupIcon('type')}<span>${escapeHtml(placeDescription)}</span></p>
                <p>${popupIcon('pin')}<span>${escapeHtml(placeContext)}</span></p>
            </div>
            <div class="popupHighlights" aria-label="Water source highlights">
                <span>${popupIcon('coin')}${escapeHtml(getFeeText(tags))}</span>
                <span>${popupIcon('access')}${escapeHtml(getAccessText(tags))}</span>
                ${tags.bottle ? `<span>${popupIcon('bottle')}${escapeHtml(getBottleText(tags))}</span>` : ''}
            </div>
            <div class="popupDetails">
                ${detailRows}
            </div>
            <p class="popupNote">${popupIcon('info')}<span>Community data from OpenStreetMap. Details may need local verification.</span></p>
            <div class="popupCoordinates">
                ${popupIcon('pin')}
                ${position.lat.toFixed(5)}, ${position.lon.toFixed(5)}
            </div>
            <div class="popupActions" aria-label="Water source actions">
                <a href="https://www.openstreetmap.org/?mlat=${position.lat}&mlon=${position.lon}#map=18/${position.lat}/${position.lon}" target="_blank" rel="noopener">
                    ${popupIcon('map')}View map
                </a>
                <a href="https://www.google.com/maps/dir/?api=1&destination=${position.lat},${position.lon}" target="_blank" rel="noopener">
                    <img src="images/directions-route.svg" alt="">Directions
                </a>
                <a href="${osmElementUrl}" target="_blank" rel="noopener">
                    ${popupIcon('pin')}OSM record
                </a>
            </div>
        </article>
    `;
}

function addMarker(element) {
    const tags = element.tags || {};
    const position = getElementPosition(element);
    if (!position) return;

    const marker = L.marker([position.lat, position.lon], { icon: waterIcon })
        .addTo(markerLayer);

    function openSite() {
        const html = buildPopupContent(element, tags, position);
        if (isMobile()) {
            openWaterSheet(html);
        } else {
            if (!marker.getPopup()) {
                marker.bindPopup(html, {
                    maxWidth: 360,
                    // autoPan: false prevents Leaflet from panning the map
                    // every time the popup opens (the user just clicked the
                    // marker so it's already in view — no scroll needed).
                    autoPan: false
                });
            }
            marker.openPopup();
        }
    }

    // Stop the click from propagating to the map's click handler,
    // which would trigger closeWaterSheet() immediately after openSite().
    marker.on('click', (e) => { L.DomEvent.stopPropagation(e); openSite(); });

    waterSites.push({ element, marker, name: formatSiteName(tags), position, openSite });
    marker.on('add', () => updateClosestWaterSource());
}

function calculateMapRadius() {
    const bounds = map.getBounds();
    const center = map.getCenter();
    return center.distanceTo(bounds.getNorthEast());
}

function fetchDrinkingWaterSites(lat, lon) {
    const radius = Math.min(Math.round(calculateMapRadius()), 10000);
    const query = `[out:json][timeout:25];
        (
          node["amenity"="drinking_water"](around:${radius},${lat},${lon});
          way["amenity"="drinking_water"](around:${radius},${lat},${lon});
          node["drinking_water"="yes"](around:${radius},${lat},${lon});
          way["drinking_water"="yes"](around:${radius},${lat},${lon});
          node["man_made"="water_tap"](around:${radius},${lat},${lon});
          way["man_made"="water_tap"](around:${radius},${lat},${lon});
          node["amenity"="fountain"]["drinking_water"!="no"](around:${radius},${lat},${lon});
          way["amenity"="fountain"]["drinking_water"!="no"](around:${radius},${lat},${lon});
        );
        out center tags;`;

    setLoading(true);
    setStatus('Searching for free drinking water...');
    closestWaterButton.hidden = true;
    nearestWaterSite = null;
    searchAreaButton.style.display = 'none';
    markerLayer.clearLayers();
    waterSites = [];
    closeWaterSheet();

    fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ data: query })
    })
        .then(response => {
            if (!response.ok) throw new Error(`Overpass ${response.status}`);
            return response.json();
        })
        .then(data => {
            const resultCount = data.elements.length;
            if (resultCount) {
                setResultsMode(true);
                data.elements.forEach(addMarker);
                searchAreaButton.textContent = 'Refresh area';
                setStatus(`${resultCount} free drinking water location${resultCount === 1 ? '' : 's'} found.`);
                searchAreaButton.style.display = 'block';
                updateClosestWaterSource();
            } else {
                searchAreaButton.textContent = 'Search again';
                setStatus('No free drinking water locations found in this area.');
                searchAreaButton.style.display = hasMapResults ? 'block' : 'none';
            }
        })
        .catch(err => {
            console.error('Overpass error:', err);
            searchAreaButton.textContent = 'Try again';
            searchAreaButton.style.display = hasMapResults ? 'block' : 'none';
            setStatus('Water data is temporarily unavailable. Please try again.');
        })
        .finally(() => setLoading(false));
}

function updateUserLocation(position) {
    const { latitude, longitude, accuracy } = position.coords;
    userLocation = L.latLng(latitude, longitude);
    bestLocationAccuracy = Math.min(bestLocationAccuracy, Number.isFinite(accuracy) ? accuracy : Infinity);

    if (!userMarker) {
        userMarker = L.marker(userLocation, {
            icon: userLocationIcon,
            keyboard: false,
            zIndexOffset: 1000
        }).addTo(userLocationLayer);
    } else {
        userMarker.setLatLng(userLocation);
    }

    const radius = Number.isFinite(accuracy) ? accuracy : 0;
    if (!accuracyCircle) {
        accuracyCircle = L.circle(userLocation, {
            radius,
            color: '#e4486f',
            fillColor: '#e4486f',
            fillOpacity: 0.08,
            opacity: 0.36,
            weight: 2,
            interactive: false
        }).addTo(userLocationLayer);
    } else {
        accuracyCircle.setLatLng(userLocation);
        accuracyCircle.setRadius(radius);
    }

    userMarker.bindTooltip(`Your location${radius ? ` • accuracy about ${formatDistance(radius).replace(' away', '')}` : ''}`, {
        direction: 'top',
        offset: [0, -12],
        opacity: 0.95
    });

    updateClosestWaterSource();
}

function updateClosestWaterSource() {
    waterSites.forEach(site => site.marker.setIcon(waterIcon));

    if (!userLocation || !waterSites.length) {
        closestWaterButton.hidden = true;
        nearestWaterSite = null;
        return;
    }

    nearestWaterSite = waterSites
        .map(site => ({
            ...site,
            distance: userLocation.distanceTo(getPositionLatLng(site.position))
        }))
        .sort((a, b) => a.distance - b.distance)[0];

    if (!nearestWaterSite) return;

    closestWaterName.textContent = nearestWaterSite.name;
    closestWaterDistance.textContent = formatDistance(nearestWaterSite.distance);
    closestWaterButton.setAttribute('aria-label', `${nearestWaterSite.name}, ${formatDistance(nearestWaterSite.distance)}. Open this water source on the map.`);
    closestWaterButton.hidden = false;
    nearestWaterSite.marker.setIcon(closestWaterIcon);
}

closestWaterButton.addEventListener('click', () => {
    if (!nearestWaterSite) return;
    const { lat, lon } = nearestWaterSite.position;
    map.flyTo([lat, lon], Math.max(map.getZoom(), 17), { duration: 0.8 });
    nearestWaterSite.openSite();
});

map.on('zoomend moveend', () => {
    if (!hasMapResults) return;
    searchAreaButton.style.display = 'block';
    searchAreaButton.textContent = 'Search this area';
});

map.on('click', () => closeWaterSheet());

searchAreaButton.addEventListener('click', () => {
    const center = map.getCenter();
    fetchDrinkingWaterSites(center.lat, center.lng);
});

// --- Autocomplete (fetch + AbortController, no JSONP) ---

function clearAutocomplete() {
    autocompleteItems = [];
    activeAutocompleteIndex = -1;
    autocompleteResults.innerHTML = '';
    setAutocompleteOpen(false);
}

function updateActiveAutocomplete() {
    Array.from(autocompleteResults.querySelectorAll('.autocomplete-result')).forEach((el, i) => {
        const isActive = i === activeAutocompleteIndex;
        el.classList.toggle('is-active', isActive);
        el.setAttribute('aria-selected', String(isActive));
    });
}

function chooseAutocomplete(index) {
    const result = autocompleteItems[index];
    if (!result) return;
    clearAutocomplete();
    searchInput.value = result.title;
    searchInput.blur();
    map.setView([result.lat, result.lon], result.zoom);
    fetchDrinkingWaterSites(result.lat, result.lon);
}

function renderAutocomplete(results) {
    autocompleteItems = results.slice(0, 6);
    activeAutocompleteIndex = autocompleteItems.length ? 0 : -1;
    autocompleteResults.innerHTML = '';

    if (!autocompleteItems.length) {
        const empty = document.createElement('div');
        empty.className = 'autocomplete-empty';
        empty.textContent = 'No matching places found';
        autocompleteResults.appendChild(empty);
        setAutocompleteOpen(true);
        return;
    }

    autocompleteItems.forEach((result, index) => {
        const div = document.createElement('div');
        div.className = 'autocomplete-result';
        div.setAttribute('role', 'option');
        div.setAttribute('aria-selected', String(index === activeAutocompleteIndex));
        div.innerHTML = `
            <span class="autocomplete-title">${escapeHtml(result.title)}</span>
            <span class="autocomplete-meta">${escapeHtml(result.category)} · ${escapeHtml(result.subtitle)}</span>
        `;
        div.addEventListener('mousedown', event => {
            event.preventDefault();
            chooseAutocomplete(index);
        });
        autocompleteResults.appendChild(div);
    });

    setAutocompleteOpen(true);
    updateActiveAutocomplete();
}

function getAddressPart(address, keys) {
    return keys.map(k => address[k]).find(Boolean);
}

function getSuggestionTitle(place) {
    const address = place.address || {};
    return place.namedetails?.name ||
        place.name ||
        getAddressPart(address, ['city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood', 'road', 'county']) ||
        place.display_name.split(',')[0];
}

function getSuggestionSubtitle(place, title) {
    const address = place.address || {};
    const parts = [
        getAddressPart(address, ['suburb', 'neighbourhood', 'city_district', 'city', 'town', 'village']),
        getAddressPart(address, ['state', 'province', 'region']),
        address.country
    ].filter(Boolean);
    return [...new Set(parts.filter(p => p !== title))].join(', ') || place.display_name;
}

function getSuggestionCategory(place) {
    const osmClass = place.class || '';
    const type = place.type || '';
    if (osmClass === 'place') {
        if (['city', 'town', 'village', 'hamlet', 'municipality'].includes(type)) return 'City';
        if (['suburb', 'neighbourhood', 'quarter'].includes(type)) return 'Area';
        return 'Place';
    }
    if (['tourism', 'historic'].includes(osmClass)) return 'Landmark';
    if (['leisure', 'natural'].includes(osmClass)) return 'Park';
    if (osmClass === 'amenity') return 'Amenity';
    if (osmClass === 'highway') return 'Address';
    if (osmClass === 'building') return 'Building';
    return type ? type.replace(/_/g, ' ') : 'Location';
}

function getSuggestionZoom(place) {
    if (place.class === 'place') {
        if (['city', 'town', 'municipality'].includes(place.type)) return 12;
        if (['village', 'suburb', 'neighbourhood', 'quarter'].includes(place.type)) return 14;
    }
    if (['tourism', 'historic', 'amenity', 'leisure', 'building'].includes(place.class)) return 16;
    return 14;
}

function normalizeSuggestions(places) {
    const seen = new Set();
    return places
        .map(place => {
            const lat = Number(place.lat);
            const lon = Number(place.lon);
            const title = getSuggestionTitle(place);
            return { lat, lon, title, subtitle: getSuggestionSubtitle(place, title), category: getSuggestionCategory(place), zoom: getSuggestionZoom(place) };
        })
        .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.title)
        .filter(p => {
            const key = `${p.title}|${p.subtitle}|${p.lat.toFixed(3)}|${p.lon.toFixed(3)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function fetchLocationSuggestions(searchText) {
    if (autocompleteController) autocompleteController.abort();
    autocompleteController = new AbortController();

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.search = new URLSearchParams({
        q: searchText,
        format: 'jsonv2',
        addressdetails: '1',
        namedetails: '1',
        extratags: '1',
        layer: 'address,poi,natural,manmade',
        limit: '8',
        'accept-language': navigator.language || 'en'
    }).toString();

    return fetch(url.toString(), { signal: autocompleteController.signal })
        .then(r => r.json())
        .finally(() => { autocompleteController = null; });
}

function geocodeSearch(searchText, autoSelect = false) {
    const trimmed = searchText.trim();
    if (trimmed.length < 3) {
        clearAutocomplete();
        if (autoSelect) setStatus('Enter a location to search.');
        return;
    }

    fetchLocationSuggestions(trimmed)
        .then(places => {
            const results = normalizeSuggestions(places);
            if (autoSelect) {
                if (results.length) {
                    autocompleteItems = results;
                    chooseAutocomplete(0);
                } else {
                    clearAutocomplete();
                    setStatus('No matching places found. Try a more specific location.');
                }
                return;
            }
            renderAutocomplete(results);
        })
        .catch(err => {
            if (err.name === 'AbortError') return;
            console.error('Nominatim error:', err);
            clearAutocomplete();
            setStatus('Location suggestions unavailable. Try again in a moment.');
        });
}

const debouncedGeocode = debounce(searchText => geocodeSearch(searchText), 250);

searchInput.addEventListener('input', function() {
    searchAreaButton.style.display = 'none';
    debouncedGeocode(this.value);
});

searchInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
        event.preventDefault();
        if (activeAutocompleteIndex >= 0) {
            chooseAutocomplete(activeAutocompleteIndex);
        } else {
            geocodeSearch(searchInput.value, true);
        }
    }
    if (event.key === 'ArrowDown' && autocompleteItems.length) {
        event.preventDefault();
        activeAutocompleteIndex = (activeAutocompleteIndex + 1) % autocompleteItems.length;
        updateActiveAutocomplete();
    }
    if (event.key === 'ArrowUp' && autocompleteItems.length) {
        event.preventDefault();
        activeAutocompleteIndex = (activeAutocompleteIndex - 1 + autocompleteItems.length) % autocompleteItems.length;
        updateActiveAutocomplete();
    }
    if (event.key === 'Escape') clearAutocomplete();
});

searchInput.addEventListener('blur', () => window.setTimeout(clearAutocomplete, 120));

searchContainer.addEventListener('submit', event => {
    event.preventDefault();
    if (activeAutocompleteIndex >= 0) {
        chooseAutocomplete(activeAutocompleteIndex);
    } else {
        geocodeSearch(searchInput.value, true);
    }
});

function locateUser() {
    if (!navigator.geolocation) {
        setStatus('Geolocation is not supported by this browser.');
        return;
    }
    setLoading(true);
    setStatus('Allow location access to show your position and nearest free water.');
    bestLocationAccuracy = Infinity;
    navigator.geolocation.getCurrentPosition(
        position => {
            const { latitude, longitude } = position.coords;
            updateUserLocation(position);
            map.setView([latitude, longitude], 15);
            fetchDrinkingWaterSites(latitude, longitude);
            startLocationWatch();
        },
        () => {
            setLoading(false);
            setStatus('Location access was denied. Search for a place instead.');
        },
        {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 0
        }
    );
}

function stopLocationWatch() {
    if (locationWatchId !== null) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
    }
    if (locationWatchTimeout) {
        window.clearTimeout(locationWatchTimeout);
        locationWatchTimeout = null;
    }
}

function startLocationWatch() {
    stopLocationWatch();
    if (!navigator.geolocation.watchPosition) return;

    locationWatchId = navigator.geolocation.watchPosition(
        position => {
            const accuracy = Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : Infinity;
            const isMeaningfullyBetter = accuracy + 8 < bestLocationAccuracy;
            if (isMeaningfullyBetter) {
                updateUserLocation(position);
                if (accuracy <= 30) stopLocationWatch();
            }
        },
        () => stopLocationWatch(),
        {
            enableHighAccuracy: true,
            timeout: 18000,
            maximumAge: 0
        }
    );

    locationWatchTimeout = window.setTimeout(stopLocationWatch, 18000);
}

locateButton.addEventListener('click', locateUser);

// --- Donation modal ---

function trapFocus(event) {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(donationOverlay.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

function openDonationDialog() {
    donationOverlay.hidden = false;
    document.body.classList.add('donation-is-open');
    donationCloseButton.focus();
    donationOverlay.addEventListener('keydown', trapFocus);
}

function closeDonationDialog() {
    donationOverlay.hidden = true;
    document.body.classList.remove('donation-is-open');
    donationOverlay.removeEventListener('keydown', trapFocus);
    donationOpenButton.focus();
}

donationOpenButton.addEventListener('click', openDonationDialog);
donationCloseButton.addEventListener('click', closeDonationDialog);

waterSheetClose.addEventListener('click', closeWaterSheet);

missionToggle.addEventListener('click', openMissionModal);
missionClose.addEventListener('click', closeMissionModal);
missionModal.addEventListener('click', e => { if (e.target === missionModal) closeMissionModal(); });
missionDonateBtn.addEventListener('click', () => { closeMissionModal(); openDonationDialog(); });

donationOverlay.addEventListener('click', event => {
    if (event.target === donationOverlay) closeDonationDialog();
});

document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!waterSheet.hidden) { closeWaterSheet(); return; }
    if (!missionModal.hidden) { closeMissionModal(); return; }
    if (!donationOverlay.hidden) closeDonationDialog();
});

function updateDonateButton() {
    const label = donationFrequency === 'monthly' ? 'Monthly' : 'One-time';
    donateButton.textContent = `Donate $${donationAmount} ${label}`;
}

function checkoutWithStripe() {
    const link = STRIPE_LINKS[donationFrequency];
    if (!link || link.includes('REPLACE_WITH')) {
        console.warn('Stripe Payment Link not configured for frequency:', donationFrequency);
        return;
    }
    if (typeof gtag === 'function') {
        gtag('event', 'donate_click', { frequency: donationFrequency, amount: donationAmount });
    }
    window.open(link, '_blank', 'noopener');
}

donationFrequencyButtons.forEach(button => {
    button.addEventListener('click', () => {
        donationFrequency = button.dataset.frequency;
        donationFrequencyButtons.forEach(item => item.classList.toggle('is-active', item === button));
        updateDonateButton();
    });
});

amountButtons.forEach(button => {
    button.addEventListener('click', () => {
        donationAmount = Number(button.dataset.amount);
        customDonationAmount.value = '';
        amountButtons.forEach(item => item.classList.toggle('is-selected', item === button));
        updateDonateButton();
    });
});

customDonationAmount.addEventListener('input', () => {
    const val = Number(customDonationAmount.value);
    if (val > 0) {
        donationAmount = val;
        amountButtons.forEach(item => item.classList.remove('is-selected'));
        updateDonateButton();
    }
});

donateButton.addEventListener('click', checkoutWithStripe);

window.addEventListener('load', () => map.invalidateSize());
