# ACNH Item Database Search Website

A professional web application to search and explore data from the Animal Crossing: New Horizons community spreadsheet using the official Google Sheets API.

## Features

- **Google Sheets API Integration**: Direct, reliable access to spreadsheet data
- **Automatic Sheet Detection**: Dynamically loads all available sheets/tabs
- **Real-time Search**: Search across all fields in the loaded data
- **All Columns Loaded**: No data truncation - gets every column properly
- **Fast & Reliable**: No CORS issues, no CSV uploads needed
- **Responsive Design**: Works on desktop and mobile devices
- **Clean Interface**: Modern, beautiful design with smooth UX

## Quick Start

If your host provides `config/default-api-key.js` (see below), the site auto-loads that key. Otherwise, you’ll be prompted to enter one.

1. **Open the website**: Double-click `index.html`
2. **Enter or accept the API key**:
   - If the key is pre-configured, sheets load automatically
   - If not, enter your Google Sheets API key when prompted
3. **Select a sheet**:
   - The dropdown will automatically populate with all available sheets
   - Choose any sheet (Housewares, Villagers, Recipes, etc.)
4. **Search**:
   - Type anything in the search box
   - Press Enter or click Search
   - Results filter instantly!

### Provide a default API key (server-only)
1. Copy `config/default-api-key.example.js` to `config/default-api-key.js`.
2. Replace `<your-api-key-here>` with your Google Sheets API key.
3. Keep `config/default-api-key.js` out of git (already in `.gitignore`) and only deploy it to your hosting target.

### Use your own API key via the UI
If you want to use your own Google Sheets API key (or override the default):

1. Click the **?? API Settings** button (bottom-right corner)
2. Enter your Google Sheets API key
3. Click "Save API Key"

To get a free API key:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Click **APIs & Services**   **Library**
4. Search for "Google Sheets API" and click **Enable**
5. Go to **APIs & Services**   **Credentials**
6. Click **Create Credentials**   **API Key**
7. Copy your API key
## How It Works

- **Google Sheets API v4**: Uses the official Google API for reliable access
- **No CORS Issues**: Direct API calls work perfectly from the browser
- **No CSV Uploads**: Data loads automatically with one click
- **Complete Data**: Fetches columns A through ZZ (all columns included)
- **Dynamic Sheets**: Automatically discovers all tabs in the spreadsheet
- **Local Storage**: API key saved securely in your browser

## Files

- `index.html` - Main HTML structure with API key configuration
- `styles.css` - Modern, responsive styling
- `script.js` - Google Sheets API v4 integration
- `config/default-api-key.example.js` - Template for optional default API key (copy to `config/default-api-key.js` on your host)
- `README.md` - This file
- `INSTRUCTIONS.md` - Detailed usage guide

## API Key Security

API key handling:
- ? Default keys live in `config/default-api-key.js` on your host (git-ignored, not in the repo)
- ? User-saved keys are stored only in your browser's localStorage
- ? Never sent to any third-party servers
- ? Only used to access the public ACNH spreadsheet
- ? Can be changed/removed anytime via the Settings button

## Spreadsheet Information

- **Spreadsheet ID**: `13d_LAJPlxMa_DubPTuirkIV4DERBMXbrWQsmSh8ReK4`
- **Source**: [ACNH Community Spreadsheet](https://docs.google.com/spreadsheets/d/13d_LAJPlxMa_DubPTuirkIV4DERBMXbrWQsmSh8ReK4/edit)
- **Content**: Complete Animal Crossing: New Horizons database
- **Maintained by**: Community volunteers

## Available Sheets

The spreadsheet contains many tabs including:
- Housewares
- Miscellaneous
- Wall-mounted
- Ceiling Decor
- Villagers
- Recipes
- Creatures
- Fossils
- Art
- Clothing
- Tools
- And many more!

The dropdown menu will show all available sheets automatically.

## Troubleshooting

### API Key Issues
**Problem**: "Invalid API key" error
- Make sure you enabled the Google Sheets API
- Check that you copied the entire key
- Verify the key hasn't expired (they don't expire by default)

### No Sheets Loading
**Problem**: Dropdown says "Error loading sheets"
- Check your internet connection
- Verify the API key is correct
- Make sure the spreadsheet is publicly accessible

### Data Not Loading
**Problem**: "Failed to fetch sheet data"
- Select a valid sheet from the dropdown
- Check that the sheet isn't empty
- Verify your API key has the Sheets API enabled

### Settings Button
Click the **⚙️ Settings** button (bottom-right) to:
- Change your API key
- View/edit saved API key
- Reset the application

## Hosting Options

### Local Use (Easiest)
Just open `index.html` in your browser!

### Local Web Server
```bash
# Using Python 3
python -m http.server 8000

# Using Node.js
npx http-server

# Then open http://localhost:8000
```

### Deploy Online
Deploy to any static hosting:
- **GitHub Pages**: Free hosting for GitHub repos
- **Netlify**: Drag-and-drop deployment
- **Vercel**: Free with automatic builds
- **Cloudflare Pages**: Fast global CDN

No backend needed - it's pure client-side!

## Advanced Features

### Search Tips
- Search is case-insensitive
- Searches across ALL columns
- Partial matches work (e.g., "red" finds "red sofa")
- Use the Clear button to reset

### Performance
- First load fetches sheet metadata (fast)
- Data loads on-demand (only when you click Load Data)
- Large sheets may take a few seconds
- Search is instant (client-side filtering)

### Customization

**Change the spreadsheet**:
Edit `script.js` line 2:
```javascript
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
```

**Modify column range**:
Edit `script.js` line 175:
```javascript
const range = encodeURIComponent(`${sheetName}!A:ZZ`); // Change ZZ to more/fewer columns
```

**Customize styling**:
Edit `styles.css` to change colors, fonts, layout, etc.

## Technical Details

- **Google Sheets API v4**: Official API with full feature support
- **No Backend**: Pure client-side JavaScript application
- **No Dependencies**: Vanilla JavaScript, no frameworks
- **Local Storage**: API key persisted across sessions
- **Modern JavaScript**: ES6+ features (async/await, arrow functions, etc.)
- **Responsive CSS**: Flexbox and media queries

## API Usage Limits

Google Sheets API free tier:
- **100 requests per 100 seconds per user**
- **500 requests per 100 seconds per project**

For personal use, you'll never hit these limits. Each action uses 1-2 requests:
- Loading sheets list: 1 request
- Loading data: 1 request
- Searching: 0 requests (client-side)

## Credits

- **Data source**: [ACNH Community Spreadsheet](https://docs.google.com/spreadsheets/d/13d_LAJPlxMa_DubPTuirkIV4DERBMXbrWQsmSh8ReK4/edit)
- **Game**: Animal Crossing: New Horizons by Nintendo
- **Spreadsheet maintained by**: ACNH community volunteers
- **API**: Google Sheets API v4

## License

This tool is provided as-is for accessing public community data. The ACNH spreadsheet data belongs to its respective maintainers.

## Support

Having issues? Common solutions:
1. Check that your API key is valid
2. Make sure Google Sheets API is enabled
3. Verify you have internet connection
4. Try a different browser
5. Check browser console (F12) for errors

Enjoy exploring the ACNH database! 🎮🌴
