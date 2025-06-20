# Volume Master - Changelog

## Version 1.0.2 - Internationalization Update (2025-06-20)

### 🌍 Major Features Added
- **Multi-language Support**: Added full internationalization (i18n) support
- **9 Languages**: English, Russian, Spanish, French, German, Chinese (Simplified), Japanese, Portuguese, Italian

### 📁 New Files Added
- `_locales/` - Localization directory with 9 language packs
- `LOCALIZATION.md` - Complete guide for translators and developers
- `test-localization.html` - Testing page for localization verification

### 🔧 Technical Changes
- Updated `manifest.json` with `default_locale` and i18n message references
- Enhanced `popup.html` with `data-i18n` and `data-i18n-title` attributes
- Added `initializeI18n()` and `getMessage()` functions to `popup.js`
- Updated `background.js` to use localized strings

### 🌟 User Experience Improvements
- Automatic language detection based on browser locale
- Seamless fallback to English for unsupported languages
- Consistent UI translation across all interface elements
- Localized error messages and tooltips

### 🛠️ Developer Features
- Structured JSON message format for easy translation management
- Support for message placeholders and substitutions
- Clear documentation for adding new languages
- Testing utilities for localization verification

### 📋 Supported UI Elements
- Extension name and description
- All button labels and tooltips
- Audio enhancement mode names
- Error and status messages
- Tab switching confirmations
- Loading and applying indicators

---

## Previous Versions

### Version 1.0.1
- Initial release with volume control functionality
- Audio enhancement modes (Default, Voice, Bass)
- Up to 600% volume boost capability
- Dark mode support
- Audio tab management 