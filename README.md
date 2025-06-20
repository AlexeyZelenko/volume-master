# 🔊 Volume Master - Chrome Extension

<div align="center">

![Volume Master](https://img.shields.io/badge/Chrome-Extension-4285f4?style=for-the-badge&logo=googlechrome&logoColor=white)
![Version](https://img.shields.io/badge/Version-2.0-success?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

**🎵 Chrome extension for precise tab volume control with audio amplification up to 600%**

[📥 Installation](#-installation) • [✨ Features](#-features) • [🚀 Usage](#-usage) • [🛠️ Development](#️-development)

</div>

---

## 📋 Description

Volume Master is a powerful Chrome extension that allows you to completely control the volume of each tab individually. The extension supports audio amplification up to 600% of the original level and offers various audio modes for optimal playback.

## ✨ Features

### 🎚️ Volume Control
- 📊 Precise Control: Volume slider from 0% to 600%
- ⚡ Quick Buttons: Instant volume setting (0%, 50%, 100%, 200%, 400%, 600%)
- 🎯 Step Adjustment: +/- buttons for fine-tuning
- 🔄 Real-time: Instant application of changes

### 🎵 Audio Modes
- 🔊 Default: Standard playback mode
- 🎤 Voice: Optimization for voice and speech
- 🎵 Bass: Low frequency enhancement for music

### 🖥️ Interface
- 🌙 Dark Theme: Toggle between light and dark themes
- 📱 Responsive Design: Beautiful and modern interface
- ⚡ Fast Performance: Optimized performance
- 🔄 Auto-update: Automatic refresh of audio tabs list

### 🗂️ Tab Management
- 📋 Audio Tabs List: Display of all tabs with active audio
- 🎯 Quick Switching: Click to navigate to desired tab
- 🔊 Audio Status: Audio state indicators for each tab
- 🔄 Refresh: Button to update tabs list

## 📥 Installation

### 🏪 From Chrome Web Store
1. Go to Chrome Web Store
2. Search for "Volume Master"
3. Click "Add to Chrome"
4. Confirm installation

### 🛠️ From Source Code
1. **📁 Download Repository**
   ```bash
   git clone https://github.com/your-username/volume-master.git
   cd volume-master
   ```

2. **🔧 Open Chrome Extensions**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"

3. **📦 Load Extension**
   - Click "Load unpacked extension"
   - Select the extension folder

## 🚀 Usage

### 📊 Main Functions

#### 🎚️ Volume Adjustment
1. **Slider**: Drag the slider to change volume
2. **Quick Buttons**: Click on desired volume percentage
3. **+/- Buttons**: Use for precise adjustment

#### 🎵 Audio Mode Selection
- **🔊 Default**: For regular browsing
- **🎤 Voice**: For video calls and podcasts  
- **🎵 Bass**: For music and movies

#### 🗂️ Working with Tabs
- **📋 View**: All audio tabs are displayed automatically
- **🎯 Switch**: Click on tab to navigate to it
- **🔄 Refresh**: Press refresh button to update the list

### 💡 Usage Tips

> **🎧 For Better Audio Quality**
> - Use "Voice" mode for video conferences
> - "Bass" mode is ideal for music and movies
> - Don't exceed 300% unless necessary

> **⚡ Quick Shortcuts**
> - Click on extension icon for quick access
> - Use quick buttons for instant setup
> - Switch themes with one click

## 🛠️ Development

### 📁 Project Structure
```
volume-master/
├── 📄 manifest.json      # Extension configuration
├── 🎨 popup.html         # Interface HTML
├── 💅 popup.css          # Interface styles
├── ⚡ popup.js           # Interface logic
├── 🔧 content.js         # Audio handling script
├── 🖼️ background.js      # Background script
└── 🖼️ icons/             # Extension icons
```

### 🔧 Technologies
- **HTML5** - Interface structure
- **CSS3** - Styles and animations
- **JavaScript (ES6+)** - Extension logic
- **Chrome Extension API** - Browser integration
- **Web Audio API** - Audio processing

### 🤝 Contributing
1. 🍴 Fork the repository
2. 🌿 Create a feature branch
3. 💾 Commit your changes
4. 📤 Submit a Pull Request

## 📊 Implementation Features

### 🎵 Web Audio API
- **🔊 Audio Amplification**: Up to 600% of original level
- **🎛️ Audio Effects**: Voice and bass filters
- **⚡ Performance**: Optimized audio processing

### 💾 Settings Storage
- **☁️ Chrome Storage**: Synchronization across devices
- **🔄 Auto-save**: Settings saved automatically
- **⚡ Debouncing**: Prevention of excessive operations

### 🎨 Interface
- **📱 Responsive**: Adaptive design
- **🌙 Dark Mode**: Dark theme support
- **⚡ Animations**: Smooth animations and transitions

## 🔧 Troubleshooting

### ❓ Frequently Asked Questions

**Q: Audio doesn't amplify above 100%?**
A: 🖱️ Make sure you've interacted with the page (clicked on it). Web Audio API requires user interaction.

**Q: Extension doesn't work on some sites?**
A: 🔒 Some sites block external scripts. This is a browser security limitation.

**Q: Settings don't save?**
A: 🔄 Check that Chrome extension settings synchronization is enabled.

## 📄 License

This project is distributed under the MIT License. See [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

Created with ❤️ to improve audio experience in Chrome

---

<div align="center">

**🌟 If this extension helped you, give it a star!**

![Made with Love](https://img.shields.io/badge/Made%20with-❤️-red?style=flat-square)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285f4?style=flat-square)

</div> 