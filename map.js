// MapLibre GL JS Map Implementation
// Israel-Iran Conflict Events Visualization

// Global variables
let map;
let conflictEvents = [];
let dateRange = { min: null, max: null };
let currentViewMode = 'points';
let popup = null;
let mapLoaded = false;
let clusterSource = null;

// Initialize the map when the page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
});

// Initialize MapLibre GL JS map
function initializeMap() {
    // You'll need to replace 'YOUR_MAPTILER_API_KEY' with your actual MapTiler API key
    const apiKey = '5wLARAKCAelcLZakveFi'; // Replace with your actual API key
    
    map = new maplibregl.Map({
        container: 'map',
        style: `https://api.maptiler.com/maps/streets/style.json?key=${apiKey}`,
        center: [51.5, 32.5], // Better center between Israel and Iran
        zoom: 6, // Closer zoom to study area
        maxZoom: 18,
        minZoom: 4
    });

    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Create popup for event details
    popup = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: false,
        maxWidth: '300px'
    });

    // Wait for map to load before adding data
    map.on('load', function() {
        console.log('Map loaded successfully');
        mapLoaded = true;
        loadData();
    });

    // Add error handling
    map.on('error', function(e) {
        console.error('Map error:', e);
        document.getElementById('event-info').innerHTML = '<p style="color: red;">Map error occurred. Please check the console for details.</p>';
    });
}

// Load GeoJSON data
async function loadData() {
    if (!mapLoaded) {
        console.log('Map not yet loaded, waiting...');
        return;
    }

    try {
        console.log('Starting to load data...');
        
        // Load conflict events data
        const response = await fetch('Israel_Iran_Strikes_Data/Israel_Iran_Strikes.geojson');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        conflictEvents = data.features;
        
        console.log(`Loaded ${conflictEvents.length} conflict events`);
        
        // Calculate date range
        calculateDateRange();
        
        // Load boundary data
        await loadBoundaryData();
        
        // Add data to map
        addDataToMap();
        
        // Setup event listeners after data is loaded
        setupEventListeners();
        
        console.log('Data loading completed successfully');
        
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('event-info').innerHTML = `<p style="color: red;">Error loading data: ${error.message}</p>`;
    }
}

// Load boundary data
async function loadBoundaryData() {
    try {
        console.log('Loading boundary data...');
        
        // Load Iran boundary
        const iranResponse = await fetch('IranAdminstrative.json/IranBoundary.json');
        if (!iranResponse.ok) {
            console.warn('Could not load Iran boundary data');
            return;
        }
        const iranData = await iranResponse.json();
        
        // Load Israel boundary
        const israelResponse = await fetch('IsraelProvinces.json/IsraelBoundary.json');
        if (!israelResponse.ok) {
            console.warn('Could not load Israel boundary data');
            return;
        }
        const israelData = await israelResponse.json();
        
        // Add boundary sources to map
        map.addSource('iran-boundary', {
            type: 'geojson',
            data: iranData
        });
        
        map.addSource('israel-boundary', {
            type: 'geojson',
            data: israelData
        });
        
        // Add boundary layers
        map.addLayer({
            id: 'iran-boundary-layer',
            type: 'line',
            source: 'iran-boundary',
            paint: {
                'line-color': '#4ecdc4',
                'line-width': 2,
                'line-opacity': 0.8
            }
        });
        
        map.addLayer({
            id: 'israel-boundary-layer',
            type: 'line',
            source: 'israel-boundary',
            paint: {
                'line-color': '#ff6b6b',
                'line-width': 2,
                'line-opacity': 0.8
            }
        });
        
        console.log('Boundary data loaded successfully');
        
    } catch (error) {
        console.error('Error loading boundary data:', error);
    }
}

// Calculate date range from data
function calculateDateRange() {
    const dates = conflictEvents
        .map(event => new Date(event.properties.Date))
        .filter(date => !isNaN(date.getTime()));
    
    if (dates.length > 0) {
        dateRange.min = new Date(Math.min(...dates));
        dateRange.max = new Date(Math.max(...dates));
        
        console.log(`Date range: ${dateRange.min.toDateString()} to ${dateRange.max.toDateString()}`);
        
        // Update timeline slider
        const slider = document.getElementById('timeline-slider');
        slider.min = 0;
        slider.max = dates.length - 1;
        slider.value = dates.length - 1;
        
        // Set date inputs
        document.getElementById('start-date').value = dateRange.min.toISOString().split('T')[0];
        document.getElementById('end-date').value = dateRange.max.toISOString().split('T')[0];
        
        updateDateDisplay();
    } else {
        console.warn('No valid dates found in data');
    }
}

// Add data to map
function addDataToMap() {
    console.log('Adding data to map...');
    
    // Add conflict events source
    map.addSource('conflict-events', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: conflictEvents
        }
    });
    
    // Add points layer
    map.addLayer({
        id: 'conflict-points',
        type: 'circle',
        source: 'conflict-events',
        paint: {
            'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                5, 4,
                10, 8
            ],
            'circle-color': [
                'case',
                ['==', ['get', 'Country'], 'Israel'], '#ff6b6b',
                ['==', ['get', 'Country'], 'Iran'], '#4ecdc4',
                '#45b7d1'
            ],
            'circle-opacity': 0.8,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff'
        }
    });
    
    // Add heatmap layer (initially hidden)
    map.addLayer({
        id: 'conflict-heatmap',
        type: 'heatmap',
        source: 'conflict-events',
        paint: {
            'heatmap-weight': 1,
            'heatmap-intensity': 1,
            'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0, 'rgba(0, 0, 255, 0)',
                0.2, '#4ecdc4',
                0.4, '#45b7d1',
                0.6, '#ff6b6b',
                0.8, '#ff4757',
                1, '#ff3838'
            ],
            'heatmap-radius': 30,
            'heatmap-opacity': 0.8
        }
    }, 'conflict-points');
    
    // Initially hide heatmap
    map.setLayoutProperty('conflict-heatmap', 'visibility', 'none');
    
    // Add click event for points
    map.on('click', 'conflict-points', function(e) {
        const feature = e.features[0];
        showEventPopup(feature, e.lngLat);
    });
    
    // Change cursor on hover
    map.on('mouseenter', 'conflict-points', function() {
        map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', 'conflict-points', function() {
        map.getCanvas().style.cursor = '';
    });
    
    console.log('Data layers added to map successfully');
}

// Show event popup
function showEventPopup(feature, lngLat) {
    const properties = feature.properties;
    
    const popupContent = `
        <div class="popup-title">${properties.Event_ID || 'Event'}</div>
        <div class="popup-detail"><strong>Date:</strong> ${properties.Date || 'Unknown'}</div>
        <div class="popup-detail"><strong>Country:</strong> ${properties.Country || 'Unknown'}</div>
        <div class="popup-detail"><strong>Location:</strong> ${properties['City/Region'] || 'Unknown'}</div>
        <div class="popup-detail"><strong>Weapon Type:</strong> ${properties.Weapon_Type || 'Unknown'}</div>
        <div class="popup-detail"><strong>Impact:</strong> ${properties.Reported_Impact || 'Unknown'}</div>
        ${properties.Source_URL ? `<div class="popup-detail"><strong>Source:</strong> <a href="${properties.Source_URL}" target="_blank">View Source</a></div>` : ''}
    `;
    
    popup.setLngLat(lngLat)
        .setHTML(popupContent)
        .addTo(map);
    
    // Update info panel
    updateInfoPanel(properties);
}

// Update info panel
function updateInfoPanel(properties) {
    const infoPanel = document.getElementById('event-info');
    infoPanel.innerHTML = `
        <p><strong>Event ID:</strong> ${properties.Event_ID || 'Unknown'}</p>
        <p><strong>Date:</strong> ${properties.Date || 'Unknown'}</p>
        <p><strong>Country:</strong> ${properties.Country || 'Unknown'}</p>
        <p><strong>Location:</strong> ${properties['City/Region'] || 'Unknown'}</p>
        <p><strong>Weapon Type:</strong> ${properties.Weapon_Type || 'Unknown'}</p>
        <p><strong>Reported Impact:</strong> ${properties.Reported_Impact || 'Unknown'}</p>
        ${properties.Source_URL ? `<p><strong>Source:</strong> <a href="${properties.Source_URL}" target="_blank">View Source</a></p>` : ''}
    `;
}

// Setup event listeners for controls
function setupEventListeners() {
    // Timeline slider
    const timelineSlider = document.getElementById('timeline-slider');
    timelineSlider.addEventListener('input', function() {
        filterEventsByDate(this.value);
    });
    
    // Date range inputs
    document.getElementById('apply-date-btn').addEventListener('click', function() {
        filterEventsByDateRange();
    });
    
    // View mode buttons
    document.getElementById('points-btn').addEventListener('click', function() {
        setViewMode('points');
    });
    
    document.getElementById('heatmap-btn').addEventListener('click', function() {
        setViewMode('heatmap');
    });
    
    document.getElementById('clusters-btn').addEventListener('click', function() {
        setViewMode('clusters');
    });
    
    // Boundary toggles
    document.getElementById('iran-boundary').addEventListener('change', function() {
        toggleBoundaryLayer('iran-boundary-layer', this.checked);
    });
    
    document.getElementById('israel-boundary').addEventListener('change', function() {
        toggleBoundaryLayer('israel-boundary-layer', this.checked);
    });
    
    // Map control buttons
    document.getElementById('reset-view-btn').addEventListener('click', function() {
        resetMapView();
    });
    
    document.getElementById('fit-bounds-btn').addEventListener('click', function() {
        fitMapToData();
    });
}

// Filter events by date range
function filterEventsByDateRange() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    
    if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return;
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const filteredEvents = conflictEvents.filter(event => {
        const eventDate = new Date(event.properties.Date);
        return eventDate >= start && eventDate <= end;
    });
    
    // Update map source
    map.getSource('conflict-events').setData({
        type: 'FeatureCollection',
        features: filteredEvents
    });
    
    updateDateDisplay(`${startDate} to ${endDate}`);
    console.log(`Filtered to ${filteredEvents.length} events`);
}

// Filter events by date
function filterEventsByDate(sliderValue) {
    if (!dateRange.min || !dateRange.max) return;
    
    const totalDays = Math.floor((dateRange.max - dateRange.min) / (1000 * 60 * 60 * 24));
    const selectedDays = Math.floor((sliderValue / 100) * totalDays);
    const cutoffDate = new Date(dateRange.min.getTime() + (selectedDays * 24 * 60 * 60 * 1000));
    
    const filteredEvents = conflictEvents.filter(event => {
        const eventDate = new Date(event.properties.Date);
        return eventDate <= cutoffDate;
    });
    
    // Update map source
    map.getSource('conflict-events').setData({
        type: 'FeatureCollection',
        features: filteredEvents
    });
    
    updateDateDisplay(cutoffDate);
}

// Update date display
function updateDateDisplay(date = null) {
    const dateDisplay = document.getElementById('date-display');
    if (date) {
        if (typeof date === 'string') {
            dateDisplay.textContent = date;
        } else {
            dateDisplay.textContent = date.toLocaleDateString();
        }
    } else {
        dateDisplay.textContent = 'All Dates';
    }
}

// Set view mode
function setViewMode(mode) {
    currentViewMode = mode;
    
    // Update button states
    document.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${mode}-btn`).classList.add('active');
    
    // Update layer visibility
    switch (mode) {
        case 'points':
            map.setLayoutProperty('conflict-points', 'visibility', 'visible');
            map.setLayoutProperty('conflict-heatmap', 'visibility', 'none');
            break;
        case 'heatmap':
            map.setLayoutProperty('conflict-points', 'visibility', 'none');
            map.setLayoutProperty('conflict-heatmap', 'visibility', 'visible');
            break;
        case 'clusters':
            // For clustering, we'll implement a simple approach
            // This creates larger circles for areas with many events
            map.setLayoutProperty('conflict-points', 'visibility', 'visible');
            map.setLayoutProperty('conflict-heatmap', 'visibility', 'none');
            
            // Update point size to show clustering effect
            map.setPaintProperty('conflict-points', 'circle-radius', [
                'interpolate',
                ['linear'],
                ['zoom'],
                5, 6,
                10, 12
            ]);
            break;
    }
}

// Reset map view
function resetMapView() {
    map.flyTo({
        center: [51.5, 32.5],
        zoom: 6,
        duration: 2000
    });
}

// Fit map to data bounds
function fitMapToData() {
    if (conflictEvents.length === 0) return;
    
    const bounds = new maplibregl.LngLatBounds();
    conflictEvents.forEach(event => {
        bounds.extend(event.geometry.coordinates);
    });
    
    map.fitBounds(bounds, {
        padding: 50,
        duration: 2000
    });
}

// Toggle boundary layer visibility
function toggleBoundaryLayer(layerId, visible) {
    if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    }
}

// Utility function to format dates
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
} 