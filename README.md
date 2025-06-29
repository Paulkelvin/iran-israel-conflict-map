# Iran-Israel Conflict Events Visualization

An interactive web mapping application visualizing kinetic events from the 2025 Iran-Israel conflict using MapLibre GL JS and MapTiler basemaps.

## Live Demo
Access the live application at: [GitHub Pages URL]

## Features

- **Interactive Map**: Real-time visualization of conflict events with clustering and filtering
- **Timeline Animation**: Animated playback of events chronologically with speed controls
- **Multiple View Modes**: Points, heatmap, and boundary layer toggles
- **Date Range Filtering**: Filter events by specific date ranges
- **Responsive Design**: Optimized for desktop and mobile devices
- **Event Details**: Clickable popups with detailed event information
- **Geographic Boundaries**: Toggle Israel and Iran administrative boundaries

## Technical Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Mapping**: MapLibre GL JS (open-source alternative to Mapbox GL JS)
- **Basemaps**: MapTiler (satellite and street maps)
- **Data Format**: GeoJSON
- **Styling**: Custom CSS with responsive design
- **Deployment**: GitHub Pages

## Data Collection & Processing Documentation

### 1. Data Sources
This map visualizes kinetic events (e.g., airstrikes, drone attacks, missile strikes) from the 2025 Iran–Israel conflict. Data was sourced from both structured databases and unstructured news articles.

**Structured Sources:**
- Uppsala Conflict Data Program (UCDP-GED)

**Unstructured Sources (News Media):**
Events were extracted from reputable media reports, including:
- Al Jazeera
- Associated Press
- Reuters
- BBC News
- The Jerusalem Post
- Haaretz
- Fox News
- CNN
- The New York Times
- CBS News

### 2. AI-Assisted Event Extraction
To complement UCDP data and enrich detail, we extracted structured event data from textual news reports using a Large Language Model (LLM)-based method.

**URL Collection Methodology:**
News article URLs were systematically gathered using Google Advanced Search queries to ensure comprehensive coverage across major news outlets. Example search query:

```
(Iran OR Israel) AND (missile OR drone OR strike OR attack OR explosion) 
(site:reuters.com OR site:apnews.com OR site:aljazeera.com OR site:bbc.com OR site:jpost.com OR site:haaretz.com) 
after:2024-03-01
```

This methodology ensured:
- **Systematic Coverage**: All major news outlets were systematically searched
- **Relevant Keywords**: Focused on kinetic military events (missiles, drones, strikes, attacks, explosions)
- **Temporal Filtering**: Limited to events after March 1, 2024
- **Geographic Focus**: Targeted Iran-Israel conflict specifically
- **Source Diversity**: Multiple perspectives from different news organizations

**Approach:**
We used ChatGPT-4 (or Claude/Grok) with a consistent prompt for extracting structured data from news articles.

**Prompt Template:**
```
Act as a geopolitical data analyst. From the text at the following URL [Insert URL], extract all instances of missile attacks, drone strikes, or other kinetic military events related to the Iran-Israel conflict since [Start Date]. For each event, provide the following information in a structured JSON format:

{
  "events": [
    {
      "date": "YYYY-MM-DD",
      "location_description": "City, region, or specific landmark mentioned.",
      "country": "Israel or Iran",
      "target_type": "Categorize as 'Military Base', 'Nuclear Facility', 'Strategic Infrastructure', 'Urban Area', 'Civilian Area', or 'Unknown'.",
      "weapon_type": "e.g., 'Ballistic Missile', 'Cruise Missile', 'Drone', 'Airstrike'",
      "reported_impact": "Summarize any reported damage, casualties, or interceptions.",
      "source_url": "[Insert URL]"
    }
  ]
}
```

**Outcome:**
This method enabled structured, JSON-ready datasets from unstructured news content, increasing coverage and granularity of reported conflict events.

### 3. Data Cleaning & Geocoding

**Cleaning Actions:**
- Consolidated all structured and AI-extracted data into a master spreadsheet
- Removed duplicates using spreadsheet logic and manual review
- Standardized column names for compatibility (e.g., Date → date, Latitude → lat, etc.)
- All dates were formatted in ISO format (YYYY-MM-DD) for use in time filters
- Coordinate fields were validated to ensure they were numeric and correctly georeferenced

**Geocoding Method:**
- Geolocation for place names (when no coordinates were available) was completed using Python and the Nominatim geocoder (OpenStreetMap)
- A Python script automated the location-to-coordinate conversion and updated the dataset accordingly

**✅ Result:**
The final dataset is a GeoJSON file containing verified and structured conflict events with geographic coordinates, temporal data, and contextual metadata — ready for use in interactive visualizations and spatial analysis.

## Technical Implementation

### Map Configuration
- **Library**: MapLibre GL JS v3.6.0
- **Basemap Provider**: MapTiler (requires API key)
- **Projection**: Web Mercator (EPSG:3857)
- **Initial View**: Automatically fits to data bounds with padding
- **Min/Max Zoom**: 3-18 for optimal detail levels

### Data Structure
The application uses GeoJSON format with the following properties:
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [longitude, latitude]
  },
  "properties": {
    "Event_ID": "Unique identifier",
    "Date": "YYYY-MM-DD format",
    "Country": "Israel or Iran",
    "City/Region": "Location description",
    "Weapon_Type": "Type of weapon used",
    "Reported_Impact": "Damage/casualty summary",
    "Source_URL": "Source link"
  }
}
```

### Key Features Implementation

#### Timeline Animation
- **Technology**: JavaScript `setInterval()` with configurable speed
- **Speed Options**: 1x, 2x, 3x, 5x playback speeds
- **Controls**: Play/pause, reset, speed selector
- **Integration**: Synchronized with date filtering and map updates

#### Event Filtering
- **Date Range**: Client-side filtering using JavaScript Date objects
- **Country Filter**: Toggle visibility for Israel/Iran events
- **Real-time Updates**: Immediate map refresh on filter changes

#### Responsive Design
- **Mobile-First**: CSS Grid with responsive breakpoints
- **Touch Optimization**: Larger touch targets for mobile devices
- **Collapsible Controls**: Mobile-friendly control panel with toggle

#### Performance Optimizations
- **Data Loading**: Asynchronous GeoJSON loading
- **Clustering**: Automatic point clustering at lower zoom levels
- **Lazy Rendering**: Map layers loaded on-demand
- **Memory Management**: Proper cleanup of event listeners

## Setup Instructions

### Prerequisites
- Modern web browser with JavaScript enabled
- MapTiler API key (free tier available)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/Paulkelvin/iran-israel-conflict-map.git
   cd iran-israel-conflict-map
   ```

2. Add your MapTiler API key to `map.js`:
   ```javascript
   const MAPTILER_API_KEY = 'your_api_key_here';
   ```

3. Start a local web server:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Python 2
   python -m SimpleHTTPServer 8000
   
   # Node.js
   npx http-server
   ```

4. Open `http://localhost:8000` in your browser

### Data Files
- `Israel_Iran_Strikes_Data/Israel_Iran_Strikes.geojson` - Main event dataset
- `IranAdminstrative.json/IranBoundary.json` - Iran administrative boundaries
- `IsraelProvinces.json/IsraelBoundary.json` - Israel administrative boundaries

## Usage

### Basic Navigation
- **Pan**: Click and drag to move around the map
- **Zoom**: Use mouse wheel or zoom controls
- **Event Details**: Click on any point to view detailed information

### Timeline Controls
- **Play/Pause**: Start or stop the timeline animation
- **Reset**: Return to the beginning of the timeline
- **Speed**: Adjust playback speed (1x, 2x, 3x, 5x)
- **Slider**: Manually scrub through the timeline

### Filtering Options
- **Date Range**: Set start and end dates to filter events
- **Country Toggle**: Show/hide events by country
- **View Modes**: Switch between points and heatmap visualization
- **Boundary Layers**: Toggle country administrative boundaries

### Map Controls
- **Fit to Data**: Automatically zoom to show all visible events
- **Reset View**: Return to the default map view

## Data Quality & Limitations

### Strengths
- **Comprehensive Coverage**: Multiple data sources ensure broad event capture
- **Structured Format**: Consistent data schema enables reliable filtering
- **Geographic Accuracy**: Validated coordinates for precise mapping
- **Temporal Precision**: ISO-formatted dates support accurate timeline analysis
- **AI-Enhanced Extraction**: LLM-assisted data extraction increases coverage and detail

### Limitations
- **Reporting Bias**: Events may be underreported or selectively covered
- **Verification Challenges**: Some events may lack independent verification
- **Geographic Precision**: Some locations may be approximate
- **AI Extraction Accuracy**: LLM-extracted data requires manual validation

### Data Validation Process
- **Cross-Reference Verification**: Events verified against multiple sources
- **Coordinate Validation**: Geographic coordinates checked against known locations
- **Date Consistency**: Temporal data validated for logical consistency
- **Duplicate Detection**: Automated and manual duplicate removal
- **Source Attribution**: All events linked to original source URLs

## API Documentation

### MapLibre GL JS Integration
The application uses MapLibre GL JS for map rendering and interaction:

```javascript
// Map initialization
const map = new maplibregl.Map({
    container: 'map',
    style: `https://api.maptiler.com/maps/satellite/style.json?key=${MAPTILER_API_KEY}`,
    center: [35.2137, 31.7683], // Jerusalem coordinates
    zoom: 6,
    minZoom: 3,
    maxZoom: 18
});
```

### Event Handling
```javascript
// Click event for popup display
map.on('click', 'conflict-points', function(e) {
    const feature = e.features[0];
    showEventPopup(feature, e.lngLat);
});
```

### Data Filtering
```javascript
// Date range filtering
function filterEventsByDateRange(startDate, endDate) {
    const filteredEvents = conflictEvents.filter(event => {
        const eventDate = new Date(event.properties.Date);
        return eventDate >= startDate && eventDate <= endDate;
    });
    updateMapSource(filteredEvents);
}
```

## Troubleshooting

### Common Issues

**Map Not Loading**
- Check MapTiler API key is valid and has sufficient credits
- Ensure internet connection is stable
- Verify browser supports WebGL

**Data Not Displaying**
- Check browser console for JavaScript errors
- Verify GeoJSON files are accessible and properly formatted
- Ensure data files are in the correct directory structure

**Timeline Animation Issues**
- Clear browser cache and refresh page
- Check for JavaScript errors in console
- Verify date format in data is ISO standard (YYYY-MM-DD)

**Mobile Display Problems**
- Test on different mobile browsers
- Check responsive breakpoints in CSS
- Verify touch event handling

### Performance Optimization
- **Large Datasets**: Consider implementing data clustering for better performance
- **Memory Usage**: Monitor browser memory usage with large event datasets
- **Loading Speed**: Optimize GeoJSON file sizes and implement progressive loading

### Browser Compatibility
- **Chrome**: Full support (recommended)
- **Firefox**: Full support
- **Safari**: Full support
- **Edge**: Full support
- **Mobile Browsers**: Responsive design optimized for iOS Safari and Chrome Mobile

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Data Sources**: UCDP-GED, various news organizations
- **Mapping Technology**: MapLibre GL JS, MapTiler
- **Geocoding**: OpenStreetMap Nominatim
- **AI Assistance**: ChatGPT-4 for data extraction

## Contact

For questions or contributions, please open an issue on GitHub or contact the maintainer.

---

*This visualization is for educational and research purposes. Event data is sourced from publicly available information and should be used responsibly.* 