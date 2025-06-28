# Israel-Iran Conflict Events Visualization

An interactive web mapping application that visualizes conflict events and strikes between Israel and Iran using MapLibre GL JS and MapTiler basemaps.

## Features

- **Interactive Map**: Visualize conflict events on an interactive map
- **Timeline Slider**: Filter events by date range
- **Multiple View Modes**: Switch between points, heatmap, and clustering views
- **Event Details**: Click on points to view detailed event information
- **Boundary Layers**: Toggle Iran and Israel administrative boundaries
- **Responsive Design**: Works on desktop and mobile devices

## Project Structure

```
├── index.html              # Main HTML file
├── style.css               # CSS styling
├── map.js                  # JavaScript map functionality
├── README.md               # This file
├── Israel_Iran_Strikes_Data/
│   └── Israel_Iran_Strikes.geojson  # Conflict events data
├── IranAdminstrative.json/
│   └── IranBoundary.json            # Iran administrative boundaries
└── IsraelProvinces.json/
    └── IsraelBoundary.json          # Israel administrative boundaries
```

## Setup Instructions

### 1. Get a MapTiler API Key

1. Go to [MapTiler](https://www.maptiler.com/)
2. Create a free account
3. Get your API key from the dashboard
4. Replace `'YOUR_MAPTILER_API_KEY'` in `map.js` line 15 with your actual API key

### 2. Run the Application

Since this is a web application, you need to serve the files through a web server. Here are a few options:

#### Option A: Using Python (if you have Python installed)
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

#### Option B: Using Node.js (if you have Node.js installed)
```bash
# Install a simple HTTP server
npm install -g http-server

# Run the server
http-server
```

#### Option C: Using Live Server (VS Code extension)
1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

### 3. Access the Application

Open your web browser and navigate to:
- **Python**: `http://localhost:8000`
- **Node.js http-server**: `http://localhost:8080`
- **Live Server**: Usually `http://localhost:5500`

## Data Sources

The application uses the following data:

- **Conflict Events**: `Israel_Iran_Strikes.geojson` - Contains detailed information about conflict events including:
  - Event ID
  - Date
  - Country
  - City/Region
  - Weapon Type
  - Reported Impact
  - Source URL
  - Geographic coordinates

- **Boundary Data**: Administrative boundaries for Iran and Israel

## Features in Detail

### Timeline Slider
- Filter events by date range
- Shows the progression of events over time
- Updates the map in real-time as you adjust the slider

### View Modes
- **Points**: Individual event markers with color coding by country
- **Heatmap**: Density visualization of event clusters
- **Clusters**: Grouped events (placeholder for future implementation)

### Interactive Elements
- **Click on points**: View detailed event information in popup and info panel
- **Hover effects**: Visual feedback when hovering over points
- **Layer toggles**: Show/hide boundary layers

### Color Coding
- **Red**: Israel-related events
- **Teal**: Iran-related events
- **Blue**: Other events

## Browser Compatibility

This application works best in modern browsers that support:
- ES6 JavaScript features
- CSS Grid
- Fetch API
- MapLibre GL JS

Recommended browsers:
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Troubleshooting

### Map Not Loading
- Check that you've added your MapTiler API key
- Ensure you're running the application through a web server (not just opening the HTML file)
- Check the browser console for error messages

### Data Not Loading
- Verify that the GeoJSON files are in the correct directories
- Check that the file paths in `map.js` match your actual file structure
- Look for CORS errors in the browser console

### Styling Issues
- Make sure `style.css` is in the same directory as `index.html`
- Check that the CSS file is being loaded (inspect element in browser)

## Customization

### Adding New Data
To add new conflict events:
1. Update the `Israel_Iran_Strikes.geojson` file with new features
2. Ensure new features follow the same property structure
3. Refresh the application

### Changing Colors
Modify the color values in:
- `style.css` for legend colors
- `map.js` for map point colors

### Adding New Layers
To add additional data layers:
1. Add new GeoJSON files
2. Update the `loadBoundaryData()` function in `map.js`
3. Add corresponding layer controls to the HTML

## License

This project is for educational and research purposes. Please ensure you have proper permissions for any data used.

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify all file paths are correct
3. Ensure you're running through a web server
4. Check that your MapTiler API key is valid 