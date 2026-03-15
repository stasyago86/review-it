## Review It - Chrome Extension

This is a simple Chrome (Manifest V3) extension written in TypeScript. It shows a popup with:

- **Title**: "Generate a review:"
- **5-star rating**: 1 star = bad experience, 5 stars = great experience.
- **Hover effect**: stars get a subtle highlight on hover.
- **Selection behavior**: when a star is selected, that star and all stars below it "shine".
- **Free text box**: placeholder "Generate a review ...".
- **Buttons**: blue `Cancel` and `Finish` buttons.

### Development

1. **Install dependencies**

```bash
npm install
```

2. **Build TypeScript**

```bash
npm run build
```

This will compile files from `src` into `dist`.

### Load the extension in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** and choose this project folder.
5. The extension icon will appear in the toolbar. Click it to open the popup.

### OpenAI API key (for AI-generated reviews)

1. Right-click the extension icon → **Options** (or open `chrome://extensions` → Details → Extension options).
2. Enter your [OpenAI API key](https://platform.openai.com/api-keys) and click **Save**.
3. The key is stored locally in your browser and is only used to call the OpenAI API when you click **Finish**.

