# Heptabase to Obsidian Converter

A pure frontend web application to export your data from Heptabase to Obsidian format.

## Features

- 🎯 **Pure Frontend** - No server required, all processing happens in your browser
- 🔒 **Privacy First** - Your data never leaves your computer
- 📝 **Card Export** - Convert Heptabase cards to Markdown files with wiki links
- 🎨 **Canvas Export** - Convert Heptabase whiteboards to Obsidian Canvas format
- 🚀 **Fast & Easy** - Simple drag-and-drop interface

## Usage

1. Open `index.html` in your web browser
2. Upload your `All-Data.json` file from your Heptabase export folder
3. Configure the Cards Path (default: `Cards/`)
4. Click **Download Cards** to export all cards as Markdown files
5. Click **Download Canvas** to export all whiteboards as Obsidian Canvas files

## What Gets Converted

### Cards Export
- ✅ All non-trashed cards
- ✅ Card references (`{{card uuid}}`) converted to wiki links (`[[Card Title]]`)
- ✅ Forward slashes in titles replaced with exclamation marks
- ✅ Empty titles skipped automatically

### Canvas Export
- ✅ Whiteboard structure preserved
- ✅ Card positions and sizes
- ✅ Sections/groups with labels
- ✅ Connections between cards with direction detection
- ✅ Proper file references to exported cards

## Technical Details

- **No dependencies** - Uses vanilla JavaScript
- **JSZip** - For creating ZIP archives
- **Modern Web APIs** - FileReader, Blob, crypto.getRandomValues
- **Responsive Design** - Works on desktop and mobile

## Browser Requirements

- Modern browser with ES6 support (Chrome, Firefox, Safari, Edge)
- JavaScript enabled
- No internet connection required after initial page load

## File Structure

```
hepta-export-tool/
├── index.html    # Main application page
├── style.css     # Styling
├── app.js        # Application logic
└── README.md     # This file
```

## Development

To run locally:

1. Clone or download this folder
2. Open `index.html` in your browser
3. No build process required!

To deploy:
- Upload to any static hosting (GitHub Pages, Netlify, Vercel, etc.)
- Or use as a local HTML file

## Notes

- The Cards Path should be relative to your Obsidian vault root
- Default path is `Cards/` - adjust based on your folder structure
- Canvas files reference the card Markdown files, so export both for full functionality

## Acknowledgments

This project is inspired by and references [Heptabase-Export](https://github.com/link-ding/Heptabase-Export) by link-ding.

## License

Free to use and modify for personal or commercial purposes.

---

Made with ❤️ for Heptabase and Obsidian users
