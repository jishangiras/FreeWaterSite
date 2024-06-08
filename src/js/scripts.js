// Utilities
function debounce(func, wait = 200) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function calculateMapRadius(center, northeast) {
    return center.distanceTo(northeast);
}

// Initialization
const map = L.map('map', { zoomControl: false }).setView([37.762, -122.3736], 12);
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

const searchAreaButton = document.getElementById('searchAreaButton');
const searchInput = document.getElementById('searchInput');
const autocompleteResults = document.getElementById('autocompleteResults');
const customIcon = L.icon({ iconUrl: 'images/pin-drop.png', iconSize: [18, 20], iconAnchor: [9, 20], popupAnchor: [0, -20] });

// Map event handlers
map.on('zoomend moveend', () => {
    searchAreaButton.textContent = 'Search this area';
    searchAreaButton.style.display = 'block';
});

// Geocoder and search functionality
const debouncedGeocode = debounce(searchText => {
    if (searchText.length > 2) {
        new L.Control.Geocoder.Nominatim().geocode(searchText, handleGeocodeResults);
    }
});

searchInput.addEventListener('input', () => {
    searchAreaButton.style.display = 'none';
    debouncedGeocode(searchInput.value);
});

searchAreaButton.addEventListener('click', () => {
    const center = map.getCenter();
    fetchDrinkingWaterSites(center.lat, center.lng);
});


function handleGeocodeResults(results) {
    autocompleteResults.innerHTML = '';
    results.forEach(result => {
        const div = document.createElement('div');
        div.className = 'autocomplete-result';
        div.textContent = result.name;
        div.onclick = () => {
            searchInput.value = result.name;
            map.setView([result.center.lat, result.center.lng], 14);
            fetchDrinkingWaterSites(result.center.lat, result.center.lng);
            autocompleteResults.innerHTML = '';
        };
        autocompleteResults.appendChild(div);
    });
}

// API interaction
function fetchDrinkingWaterSites(lat, lon) {
    const radius = calculateMapRadius(map.getCenter(), map.getBounds().getNorthEast());
    document.getElementById('loader').style.display = 'block';
    searchAreaButton.style.display = 'none';
    fetch(`https://overpass-api.de/api/interpreter`, {
        method: 'POST',
        body: `[out:json][timeout:25]; (node["amenity"="drinking_water"](around:${radius},${lat},${lon});); out body;`
    })
    .then(response => response.json())
    .then(data => {
        // Hide loader and possibly show search button
        document.getElementById('loader').style.display = 'none';
        searchAreaButton.style.display = 'block';
        if (data.elements.length) {
            data.elements.forEach(addMarker);
            searchAreaButton.textContent = `${data.elements.length} results found`;
        } else {
            searchAreaButton.textContent = 'No results found';
        }
    })
    .catch(err => console.error('Error querying Overpass API:', err));
}

// Marker management
function addMarker(element) {
    let popupContent = `<strong>${element.tags.name || 'Drinking Water Site'}</strong><br>${Object.keys(element.tags).map(key => `<strong>${key}:</strong> ${element.tags[key]}`).join('<br>')}`;
    popupContent += `<br/><b>Directions</b><br/><a href="https://www.openstreetmap.org/?mlat=${element.lat}&mlon=${element.lon}#map=18/${element.lat}/${element.lon}" target="_blank">
                        <img src="images/Open-street-map.png" alt="OSM" style="width: 20px; vertical-align: middle;">OpenStreetMap
                     </a><br/><a href="https://www.google.com/maps/dir/?api=1&destination=${element.lat},${element.lon}" target="_blank">
                        <img src="images/Google_Maps.png" alt="Google Maps" style="width: 15px; vertical-align: middle;">Google Maps
                     </a>`;
    L.marker([element.lat, element.lon], { icon: customIcon }).addTo(map).bindPopup(popupContent);
}
