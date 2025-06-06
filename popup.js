// Volume Master Popup Script - Vanilla JavaScript

class VolumePopup {
    constructor() {
        this.volume = 100;
        this.audioMode = 'default';
        this.isDarkMode = false;
        this.audioTabs = [];
        this.currentTabId = null;
        this.isLoading = true;
        this.error = null;
        this.isApplying = false;
        this.saveTimeout = null; // For debouncing saves
        this.updateTimeout = null; // For debouncing volume updates
        this.modeTimeout = null; // For debouncing mode changes
        
        this.init();
    }

    async init() {
        await this.loadSettings();
        await this.getAudioTabs();
        await this.getCurrentTab();
        this.setupEventListeners();
        this.updateUI();
        this.setupMessageListener();
        this.hideLoading();
    }

    setupEventListeners() {
        // Volume slider - with debouncing
        const volumeSlider = document.getElementById('volume-slider');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                this.volume = parseInt(e.target.value);
                this.updateVolumeDisplay();
                this.updateSliderAppearance();
                
                // Debounce volume application to prevent too many calls
                if (this.updateTimeout) {
                    clearTimeout(this.updateTimeout);
                }
                this.updateTimeout = setTimeout(() => {
                    this.updateVolume();
                }, 300); // Wait 300ms after user stops moving slider
            });

            // Save settings when user stops moving slider
            volumeSlider.addEventListener('change', () => {
                this.saveSettings();
            });
        }

        // Quick volume buttons
        const quickBtns = document.querySelectorAll('.quick-btn');
        quickBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const volume = parseInt(btn.dataset.volume);
                this.setVolumeQuick(volume);
            });
        });

        // Volume adjustment buttons
        const decreaseBtn = document.getElementById('decrease-volume');
        const increaseBtn = document.getElementById('increase-volume');
        if (decreaseBtn) decreaseBtn.addEventListener('click', () => this.decreaseVolume());
        if (increaseBtn) increaseBtn.addEventListener('click', () => this.increaseVolume());

        // Audio mode buttons
        const modeBtns = document.querySelectorAll('.mode-btn');
        modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.setAudioMode(mode);
            });
        });

        // Header controls
        const refreshBtn = document.getElementById('refresh-btn');
        const themeToggle = document.getElementById('theme-toggle');
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.refreshAudioTabs());
        if (themeToggle) themeToggle.addEventListener('click', () => this.toggleDarkMode());

        // Error close button
        const errorClose = document.getElementById('error-close');
        if (errorClose) errorClose.addEventListener('click', () => this.clearError());
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'audioTabsUpdated') {
                this.getAudioTabs();
            }
        });
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get(['volume', 'audioMode', 'isDarkMode']);
            this.volume = result.volume || 100;
            this.audioMode = result.audioMode || 'default';
            this.isDarkMode = result.isDarkMode || false;
            
            // Обновляем значок при загрузке настроек
            await this.updateExtensionBadge();
            
            if (this.isDarkMode) {
                document.body.classList.add('dark-mode');
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            this.showError('Failed to load settings');
        }
    }

    async saveSettings() {
        // Clear existing timeout
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        // Debounce saves to prevent quota issues
        this.saveTimeout = setTimeout(async () => {
            try {
                await chrome.storage.sync.set({
                    volume: this.volume,
                    audioMode: this.audioMode,
                    isDarkMode: this.isDarkMode
                });
                
                // Обновляем значок на иконке расширения
                await this.updateExtensionBadge();
                
                console.log('Volume Master: Settings saved successfully');
            } catch (error) {
                console.error('Error saving settings:', error);
                if (error.message.includes('MAX_WRITE_OPERATIONS')) {
                    console.warn('Chrome Storage quota reached, retrying in 10 seconds...');
                    setTimeout(() => this.saveSettings(), 10000);
                } else {
                    this.showError('Failed to save settings');
                }
            }
        }, 500); // Wait 500ms before saving
    }

    async updateExtensionBadge() {
        try {
            await chrome.runtime.sendMessage({
                action: 'updateBadge',
                volume: this.volume
            });
        } catch (error) {
            console.error('Error updating extension badge:', error);
        }
    }

    async getAudioTabs() {
        try {
            const response = await chrome.runtime.sendMessage({ 
                action: 'getAudioTabs' 
            });
            
            if (response && response.audioTabs) {
                this.audioTabs = response.audioTabs;
            } else {
                const tabs = await chrome.tabs.query({});
                this.audioTabs = tabs.filter(tab => 
                    tab.audible || (tab.mutedInfo && tab.mutedInfo.muted)
                );
            }
            this.updateTabsList();
        } catch (error) {
            console.error('Error getting audio tabs:', error);
            this.showError('Failed to get audio tabs');
            
            try {
                const tabs = await chrome.tabs.query({});
                this.audioTabs = tabs.filter(tab => 
                    tab.audible || (tab.mutedInfo && tab.mutedInfo.muted)
                );
                this.updateTabsList();
            } catch (fallbackError) {
                console.error('Fallback method also failed:', fallbackError);
            }
        }
    }

    async getCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTabId = tab.id;
        } catch (error) {
            console.error('Error getting current tab:', error);
        }
    }

    async updateVolume() {
        if (this.isApplying) return;
        
        this.showApplying(true);
        this.clearError();
        
        try {
            await this.saveSettings();
            
            if (this.currentTabId) {
                await this.applyVolumeToTab(this.currentTabId);
            }
            
            for (const tab of this.audioTabs) {
                if (tab.id !== this.currentTabId) {
                    await this.applyVolumeToTab(tab.id);
                }
            }
            
            this.updateUI();
        } catch (error) {
            console.error('Error updating volume:', error);
            this.showError('Failed to update volume');
        } finally {
            this.showApplying(false);
        }
    }

    async applyVolumeToTab(tabId) {
        try {
            // Проверяем что вкладка существует
            const tab = await chrome.tabs.get(tabId);
            if (!tab) {
                return { success: false, error: 'Tab not found' };
            }

            console.log(`Volume Master: Applying volume ${this.volume}% to tab ${tabId}`);

            // Убеждаемся что content script загружен
            const scriptLoaded = await this.ensureContentScriptLoaded(tabId);
            if (!scriptLoaded.success) {
                console.error('Content script loading failed:', scriptLoaded);
                return scriptLoaded;
            }

            // Отправляем команду на изменение громкости
            const response = await chrome.tabs.sendMessage(tabId, {
                action: 'setVolume',
                volume: this.volume / 100,
                audioMode: this.audioMode
            });

            console.log(`Volume Master: Response from tab ${tabId}:`, response);

            // Проверяем статус content script для отладки
            setTimeout(async () => {
                try {
                    const status = await chrome.tabs.sendMessage(tabId, { action: 'getStatus' });
                    console.log(`Volume Master: Status from tab ${tabId}:`, status);
                } catch (statusError) {
                    console.warn('Could not get status from content script:', statusError);
                }
            }, 1000);

            return { success: true, response };
        } catch (error) {
            console.error('Error applying volume to tab:', error);
            return { success: false, error: error.message };
        }
    }

    async ensureContentScriptLoaded(tabId) {
        try {
            console.log(`Volume Master: Ensuring content script is loaded in tab ${tabId}`);
            
            // Проверяем что content script уже загружен
            try {
                const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
                if (response && response.pong) {
                    console.log(`Volume Master: Content script already loaded in tab ${tabId}`);
                    return { success: true, alreadyLoaded: true };
                }
            } catch (pingError) {
                console.log(`Volume Master: Content script not responding in tab ${tabId}, will inject`);
            }

            // Загружаем content script
            console.log(`Volume Master: Injecting content script into tab ${tabId}`);
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            });

            // Ждем немного и проверяем еще раз
            await new Promise(resolve => setTimeout(resolve, 1000));

            const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
            if (response && response.pong) {
                console.log(`Volume Master: Content script successfully loaded in tab ${tabId}`);
                return { success: true, justLoaded: true };
            }

            console.error(`Volume Master: Content script failed to respond after injection in tab ${tabId}`);
            return { success: false, error: 'Failed to load content script' };
        } catch (error) {
            console.error('Error ensuring content script loaded:', error);
            return { success: false, error: error.message };
        }
    }

    async switchToTab(tabId) {
        try {
            this.showApplying(true);
            this.clearError();
            
            // Сначала получаем информацию о вкладке
            const tab = await chrome.tabs.get(tabId);
            
            // Активируем вкладку без переключения фокуса окна
            await chrome.tabs.update(tabId, { active: true });
            
            // Обновляем текущую вкладку
            this.currentTabId = tabId;
            
            // Применяем громкость к выбранной вкладке
            await this.applyVolumeToTab(tabId);
            
            // Обновляем UI чтобы показать активную вкладку
            this.updateTabsList();
            
            // Показываем краткое уведомление об успешном переключении
            this.showTabSwitchSuccess(tab.title);
            
            // НЕ переключаем окно автоматически, чтобы попап не закрывался
            console.log(`Volume Master: Switched to tab ${tabId} without changing window focus`);
            
        } catch (error) {
            console.error('Error switching to tab:', error);
            this.showError('Failed to switch tab');
        } finally {
            this.showApplying(false);
        }
    }

    async switchToTabWindow(tabId) {
        try {
            const tab = await chrome.tabs.get(tabId);
            
            // Переключаем на окно с выбранной вкладкой
            if (tab.windowId !== chrome.windows.WINDOW_ID_CURRENT) {
                await chrome.windows.update(tab.windowId, { focused: true });
                console.log(`Volume Master: Switched to window ${tab.windowId}`);
            }
            
        } catch (error) {
            console.error('Error switching to tab window:', error);
            this.showError('Failed to switch window');
        }
    }

    showTabSwitchSuccess(tabTitle) {
        // Показываем успешное переключение в консоли
        const shortTitle = this.formatTabTitle(tabTitle);
        console.log(`✅ Switched to: ${shortTitle}`);
    }

    async refreshAudioTabs() {
        this.showLoading();
        this.clearError();
        
        try {
            const response = await chrome.runtime.sendMessage({ 
                action: 'refreshAudioTabs' 
            });
            
            if (response && response.audioTabs) {
                this.audioTabs = response.audioTabs;
            } else {
                await this.getAudioTabs();
            }
        } catch (error) {
            console.error('Error refreshing audio tabs:', error);
            this.showError('Failed to refresh tabs');
            await this.getAudioTabs();
        } finally {
            this.hideLoading();
        }
    }

    // UI Methods
    updateUI() {
        this.updateVolumeDisplay();
        this.updateAudioModeDisplay();
        this.updateTabsList();
        this.updateSliderAppearance();
        this.updateThemeToggle();
    }

    updateVolumeDisplay() {
        const volumeIcon = document.getElementById('volume-icon');
        const volumeValue = document.getElementById('volume-value');
        const volumeSlider = document.getElementById('volume-slider');
        
        if (volumeIcon) volumeIcon.textContent = this.getVolumeIcon();
        if (volumeValue) {
            volumeValue.textContent = `${this.volume}%`;
            volumeValue.style.color = this.getVolumeColor();
        }
        if (volumeSlider) {
            volumeSlider.value = this.volume;
        }
    }

    updateAudioModeDisplay() {
        ['default', 'voice', 'bass'].forEach(mode => {
            const btn = document.getElementById(`mode-${mode}`);
            if (btn) {
                btn.classList.toggle('active', this.audioMode === mode);
            }
        });
    }

    updateTabsList() {
        const tabsCount = document.getElementById('tabs-count');
        const noTabs = document.getElementById('no-tabs');
        const tabsList = document.getElementById('tabs-list');
        
        if (tabsCount) tabsCount.textContent = this.audioTabs.length;
        
        if (this.audioTabs.length === 0) {
            if (noTabs) noTabs.style.display = 'block';
            if (tabsList) tabsList.style.display = 'none';
        } else {
            if (noTabs) noTabs.style.display = 'none';
            if (tabsList) {
                tabsList.style.display = 'block';
                tabsList.innerHTML = this.renderTabsList();
                
                // Add event listeners to tab items
                const tabItems = tabsList.querySelectorAll('.tab-item');
                tabItems.forEach(item => {
                    item.addEventListener('click', () => {
                        const tabId = parseInt(item.dataset.tabId);
                        this.switchToTab(tabId);
                    });
                });
            }
        }
    }

    renderTabsList() {
        return this.audioTabs.map(tab => `
            <div class="tab-item${tab.id === this.currentTabId ? ' current' : ''}" 
                 data-tab-id="${tab.id}">
                <div class="tab-favicon">
                    ${tab.favIconUrl ? 
                        `<img src="${tab.favIconUrl}" alt="${tab.title}">` : 
                        '<span>🌐</span>'
                    }
                </div>
                <div class="tab-info">
                    <div class="tab-title">${this.formatTabTitle(tab.title)}</div>
                    <div class="tab-url">${new URL(tab.url).hostname}</div>
                </div>
                <div class="tab-status">
                    <span class="tab-icon">${this.getTabIcon(tab)}</span>
                </div>
            </div>
        `).join('');
    }

    updateSliderAppearance() {
        const slider = document.getElementById('volume-slider');
        if (slider) {
            const percentage = ((this.volume - 0) / (600 - 0)) * 100;
            slider.style.setProperty('--value', `${percentage}%`);
            
            if (this.volume <= 100) {
                slider.style.setProperty('--slider-color', '#4285f4');
            } else if (this.volume <= 300) {
                slider.style.setProperty('--slider-color', '#ff9800');
            } else {
                slider.style.setProperty('--slider-color', '#f44336');
            }
        }
    }

    updateThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.textContent = this.isDarkMode ? '☀️' : '🌙';
        }
    }

    showLoading() {
        const loading = document.getElementById('loading');
        const mainContent = document.getElementById('main-content');
        if (loading) loading.style.display = 'flex';
        if (mainContent) mainContent.style.display = 'none';
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        const mainContent = document.getElementById('main-content');
        if (loading) loading.style.display = 'none';
        if (mainContent) mainContent.style.display = 'block';
    }

    showError(message) {
        const errorBanner = document.getElementById('error-banner');
        const errorText = document.getElementById('error-text');
        if (errorBanner && errorText) {
            errorText.textContent = `⚠️ ${message}`;
            errorBanner.style.display = 'flex';
        }
        this.error = message;
    }

    clearError() {
        const errorBanner = document.getElementById('error-banner');
        if (errorBanner) {
            errorBanner.style.display = 'none';
        }
        this.error = null;
    }

    showApplying(show) {
        const applyingIndicator = document.getElementById('applying-indicator');
        if (applyingIndicator) {
            applyingIndicator.style.display = show ? 'flex' : 'none';
        }
        this.isApplying = show;
    }

    // Helper Methods
    getVolumeIcon() {
        if (this.volume === 0) return '🔇';
        if (this.volume <= 50) return '🔈';
        if (this.volume <= 100) return '🔉';
        return '🔊';
    }

    getVolumeColor() {
        if (this.volume <= 100) return '#4285f4';
        if (this.volume <= 300) return '#ff9800';
        return '#f44336';
    }

    getTabIcon(tab) {
        if (tab.audible && !tab.muted) return '🔊';
        if (tab.muted) return '🔇';
        return '🔈';
    }

    formatTabTitle(title) {
        return title && title.length > 30 ? title.substring(0, 30) + '...' : title || 'Untitled';
    }

    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;
        document.body.classList.toggle('dark-mode', this.isDarkMode);
        this.updateThemeToggle();
        this.saveSettings();
    }

    setVolumeQuick(volume) {
        this.volume = volume;
        
        // Обновляем UI и слайдер
        this.updateVolumeDisplay();
        this.updateSliderValue();
        this.updateSliderAppearance();
        
        // Применяем новую громкость
        this.updateVolume();
    }

    updateSliderValue() {
        const volumeSlider = document.getElementById('volume-slider');
        if (volumeSlider) {
            volumeSlider.value = this.volume;
        }
    }

    increaseVolume() {
        const step = this.volume >= 100 ? 50 : 10;
        this.volume = Math.min(600, this.volume + step);
        
        // Обновляем UI и слайдер
        this.updateVolumeDisplay();
        this.updateSliderValue();
        this.updateSliderAppearance();
        
        // Применяем новую громкость
        this.updateVolume();
    }

    decreaseVolume() {
        const step = this.volume > 100 ? 50 : 10;
        this.volume = Math.max(0, this.volume - step);
        
        // Обновляем UI и слайдер
        this.updateVolumeDisplay();
        this.updateSliderValue();
        this.updateSliderAppearance();
        
        // Применяем новую громкость
        this.updateVolume();
    }

    setAudioMode(mode) {
        this.showModeApplying(true);
        this.audioMode = mode;
        
        // Immediately update UI
        this.updateAudioModeDisplay();
        
        // Apply changes with debouncing
        setTimeout(async () => {
            await this.updateVolume();
            this.showModeApplying(false);
        }, 100);
    }

    showModeApplying(show) {
        const modeApplyingIndicator = document.getElementById('mode-applying-indicator');
        if (modeApplyingIndicator) {
            modeApplyingIndicator.style.display = show ? 'flex' : 'none';
        }
    }
}

// Global popup instance
let popup;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    popup = new VolumePopup();
}); 