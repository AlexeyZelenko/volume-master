// Volume Master Background Service Worker

class VolumeManagerService {
    constructor() {
        this.audioTabs = new Set();
        this.tabStates = new Map();
        this.currentVolume = 100; // Текущая громкость для значка
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeExistingTabs();
        this.loadVolumeSettings(); // Загружаем настройки громкости
        this.updateBadge(); // Инициализируем значок
    }

    setupEventListeners() {
        // Отслеживание изменений в состоянии вкладок
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdate(tabId, changeInfo, tab);
        });

        // Отслеживание удаления вкладок
        chrome.tabs.onRemoved.addListener((tabId) => {
            this.handleTabRemoval(tabId);
        });

        // Отслеживание активации вкладок
        chrome.tabs.onActivated.addListener((activeInfo) => {
            this.handleTabActivation(activeInfo);
        });

        // Обработка сообщений от popup и content scripts
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Асинхронный ответ
        });

        // Отслеживание изменений в хранилище для обновления значка
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes.volume) {
                this.currentVolume = changes.volume.newValue || 100;
                this.updateBadge();
            }
        });

        // Периодическая проверка аудио статуса
        this.startPeriodicCheck();
    }

    async initializeExistingTabs() {
        try {
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
                if (tab.audible || tab.mutedInfo?.muted) {
                    this.audioTabs.add(tab.id);
                    this.tabStates.set(tab.id, {
                        audible: tab.audible,
                        muted: tab.mutedInfo?.muted || false,
                        title: tab.title,
                        url: tab.url,
                        favIconUrl: tab.favIconUrl
                    });
                }
            }
        } catch (error) {
            console.error('Error initializing existing tabs:', error);
        }
    }

    handleTabUpdate(tabId, changeInfo, tab) {
        let tabStateChanged = false;
        
        // Проверяем изменения в аудио статусе
        if ('audible' in changeInfo || 'mutedInfo' in changeInfo) {
            const isAudioTab = tab.audible || (tab.mutedInfo && tab.mutedInfo.muted);
            
            if (isAudioTab && !this.audioTabs.has(tabId)) {
                // Новая аудио вкладка
                this.audioTabs.add(tabId);
                tabStateChanged = true;
                console.log(`New audio tab detected: ${tab.title}`);
            } else if (!isAudioTab && this.audioTabs.has(tabId)) {
                // Вкладка больше не воспроизводит аудио
                this.audioTabs.delete(tabId);
                this.tabStates.delete(tabId);
                tabStateChanged = true;
                console.log(`Audio tab removed: ${tab.title}`);
            }

            // Обновляем состояние вкладки
            if (isAudioTab) {
                this.tabStates.set(tabId, {
                    audible: tab.audible,
                    muted: tab.mutedInfo?.muted || false,
                    title: tab.title,
                    url: tab.url,
                    favIconUrl: tab.favIconUrl,
                    lastUpdated: Date.now()
                });
            }
        }

        // Уведомляем popup о изменениях если он открыт
        if (tabStateChanged) {
            this.notifyPopupOfChanges();
        }
    }

    handleTabRemoval(tabId) {
        if (this.audioTabs.has(tabId)) {
            this.audioTabs.delete(tabId);
            this.tabStates.delete(tabId);
            console.log(`Audio tab removed: ${tabId}`);
            this.notifyPopupOfChanges();
        }
    }

    handleTabActivation(activeInfo) {
        // Можно отслеживать переключения между аудио вкладками
        const { tabId } = activeInfo;
        if (this.audioTabs.has(tabId)) {
            console.log(`Switched to audio tab: ${tabId}`);
        }
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'getAudioTabs':
                    const audioTabs = await this.getAudioTabsInfo();
                    sendResponse({ audioTabs });
                    break;

                case 'applyVolumeToTab':
                    const result = await this.applyVolumeToTab(
                        message.tabId, 
                        message.volume, 
                        message.audioMode
                    );
                    sendResponse(result);
                    break;

                case 'ensureContentScript':
                    const scriptResult = await this.ensureContentScriptLoaded(message.tabId);
                    sendResponse(scriptResult);
                    break;

                case 'refreshAudioTabs':
                    await this.refreshAudioTabs();
                    const refreshedTabs = await this.getAudioTabsInfo();
                    sendResponse({ audioTabs: refreshedTabs });
                    break;

                case 'updateBadge':
                    if (message.volume !== undefined) {
                        this.currentVolume = message.volume;
                        this.updateBadge();
                    }
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ error: error.message });
        }
    }

    async getAudioTabsInfo() {
        const tabs = [];
        
        try {
            // Получаем актуальную информацию о вкладках
            const currentTabs = await chrome.tabs.query({});
            
            for (const tab of currentTabs) {
                if (tab.audible || (tab.mutedInfo && tab.mutedInfo.muted)) {
                    // Обновляем информацию
                    this.audioTabs.add(tab.id);
                    this.tabStates.set(tab.id, {
                        audible: tab.audible,
                        muted: tab.mutedInfo?.muted || false,
                        title: tab.title,
                        url: tab.url,
                        favIconUrl: tab.favIconUrl,
                        lastUpdated: Date.now()
                    });

                    tabs.push({
                        id: tab.id,
                        title: tab.title || chrome.i18n.getMessage('untitled'),
                        url: tab.url,
                        favIconUrl: tab.favIconUrl,
                        audible: tab.audible,
                        muted: tab.mutedInfo?.muted || false
                    });
                }
            }
            
            // Удаляем устаревшие записи
            for (const tabId of this.audioTabs) {
                if (!currentTabs.find(tab => tab.id === tabId)) {
                    this.audioTabs.delete(tabId);
                    this.tabStates.delete(tabId);
                }
            }
            
        } catch (error) {
            console.error('Error getting audio tabs info:', error);
        }

        return tabs;
    }

    async applyVolumeToTab(tabId, volume, audioMode) {
        try {
            // Проверяем что вкладка существует
            const tab = await chrome.tabs.get(tabId);
            if (!tab) {
                return { success: false, error: 'Tab not found' };
            }

            // Убеждаемся что content script загружен
            const scriptLoaded = await this.ensureContentScriptLoaded(tabId);
            if (!scriptLoaded.success) {
                return scriptLoaded;
            }

            // Отправляем команду на изменение громкости
            const response = await chrome.tabs.sendMessage(tabId, {
                action: 'setVolume',
                volume: volume,
                audioMode: audioMode
            });

            return { success: true, response };
        } catch (error) {
            console.error('Error applying volume to tab:', error);
            return { success: false, error: error.message };
        }
    }

    async ensureContentScriptLoaded(tabId) {
        try {
            // Проверяем что content script уже загружен
            try {
                const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
                if (response && response.pong) {
                    return { success: true, alreadyLoaded: true };
                }
            } catch (pingError) {
                // Content script не отвечает, нужно загрузить
            }

            // Загружаем content script
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            });

            // Ждем немного и проверяем еще раз
            await new Promise(resolve => setTimeout(resolve, 500));

            const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
            if (response && response.pong) {
                return { success: true, justLoaded: true };
            }

            return { success: false, error: 'Failed to load content script' };
        } catch (error) {
            console.error('Error ensuring content script loaded:', error);
            return { success: false, error: error.message };
        }
    }

    async refreshAudioTabs() {
        try {
            // Очищаем текущие данные
            this.audioTabs.clear();
            this.tabStates.clear();

            // Заново сканируем все вкладки
            await this.initializeExistingTabs();
        } catch (error) {
            console.error('Error refreshing audio tabs:', error);
        }
    }

    startPeriodicCheck() {
        // Проверяем статус аудио вкладок каждые 5 секунд
        setInterval(async () => {
            try {
                await this.getAudioTabsInfo();
            } catch (error) {
                console.error('Error in periodic check:', error);
            }
        }, 5000);
    }

    notifyPopupOfChanges() {
        // Отправляем сообщение popup'у если он открыт
        try {
            chrome.runtime.sendMessage({
                action: 'audioTabsUpdated'
            }).catch(() => {
                // Popup не открыт, игнорируем ошибку
            });
        } catch (error) {
            // Popup не открыт, игнорируем ошибку
        }
    }

    getStats() {
        return {
            audioTabsCount: this.audioTabs.size,
            tabStatesCount: this.tabStates.size,
            audioTabs: Array.from(this.audioTabs),
            tabStates: Object.fromEntries(this.tabStates)
        };
    }

    async loadVolumeSettings() {
        try {
            const result = await chrome.storage.sync.get(['volume']);
            this.currentVolume = result.volume || 100;
            this.updateBadge();
        } catch (error) {
            console.error('Error loading volume settings:', error);
        }
    }

    updateBadge() {
        try {
            const volumeText = this.currentVolume > 100 ? `${this.currentVolume}%` : `${this.currentVolume}`;
            
            // Устанавливаем текст значка
            chrome.action.setBadgeText({ text: volumeText });
            
            // Устанавливаем цвет фона в зависимости от громкости
            let badgeColor;
            if (this.currentVolume <= 100) {
                badgeColor = '#4285f4'; // Синий для нормальной громкости
            } else if (this.currentVolume <= 300) {
                badgeColor = '#ff9800'; // Оранжевый для повышенной
            } else {
                badgeColor = '#f44336'; // Красный для высокой
            }
            
            chrome.action.setBadgeBackgroundColor({ color: badgeColor });
            
            console.log(`Volume Master: Badge updated to ${volumeText}`);
        } catch (error) {
            console.error('Error updating badge:', error);
        }
    }
}

// Инициализация сервиса
const volumeManager = new VolumeManagerService();

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
    try {
        switch (command) {
            case 'next-audio-tab':
                await switchToNextAudioTab();
                break;
            case 'prev-audio-tab':
                await switchToPrevAudioTab();
                break;
            case 'toggle-mute-all':
                await toggleMuteAllAudioTabs();
                break;
            case 'toggle-current-tab':
                await toggleCurrentTabMute();
                break;
        }
    } catch (error) {
        console.error('Error handling command:', command, error);
    }
});

// Quick audio tab switching functions
async function switchToNextAudioTab() {
    const audioTabs = await volumeManager.getAudioTabsInfo();
    if (audioTabs.length === 0) return;

    const currentTab = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTabId = currentTab[0]?.id;
    
    let currentIndex = audioTabs.findIndex(tab => tab.id === currentTabId);
    if (currentIndex === -1) currentIndex = 0;
    
    const nextIndex = (currentIndex + 1) % audioTabs.length;
    const nextTab = audioTabs[nextIndex];
    
    await chrome.tabs.update(nextTab.id, { active: true });
    await chrome.windows.update(nextTab.windowId, { focused: true });
    
    // Show notification
    try {
        await chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: chrome.i18n.getMessage('appName'),
            message: `Switched to: ${nextTab.title}`
        });
    } catch (error) {
        console.log('Notification not supported');
    }
}

async function switchToPrevAudioTab() {
    const audioTabs = await volumeManager.getAudioTabsInfo();
    if (audioTabs.length === 0) return;

    const currentTab = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTabId = currentTab[0]?.id;
    
    let currentIndex = audioTabs.findIndex(tab => tab.id === currentTabId);
    if (currentIndex === -1) currentIndex = 0;
    
    const prevIndex = currentIndex === 0 ? audioTabs.length - 1 : currentIndex - 1;
    const prevTab = audioTabs[prevIndex];
    
    await chrome.tabs.update(prevTab.id, { active: true });
    await chrome.windows.update(prevTab.windowId, { focused: true });
    
    // Show notification
    try {
        await chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: chrome.i18n.getMessage('appName'),
            message: `Switched to: ${prevTab.title}`
        });
    } catch (error) {
        console.log('Notification not supported');
    }
}

async function toggleMuteAllAudioTabs() {
    const audioTabs = await volumeManager.getAudioTabsInfo();
    if (audioTabs.length === 0) return;

    const allMuted = audioTabs.every(tab => tab.muted);
    
    const promises = audioTabs.map(tab => 
        chrome.tabs.update(tab.id, { muted: !allMuted })
    );
    
    await Promise.all(promises);
    
    // Show notification
    try {
        await chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: chrome.i18n.getMessage('appName'),
            message: allMuted ? 
                chrome.i18n.getMessage('allTabsUnmuted') : 
                chrome.i18n.getMessage('allTabsMuted')
        });
    } catch (error) {
        console.log('Notification not supported');
    }
}

async function toggleCurrentTabMute() {
    try {
        const currentTab = await chrome.tabs.query({ active: true, currentWindow: true });
        if (currentTab.length === 0) return;

        const tab = currentTab[0];
        const isCurrentlyMuted = tab.mutedInfo?.muted || false;
        
        // Toggle mute state
        await chrome.tabs.update(tab.id, { muted: !isCurrentlyMuted });
        
        // Show notification
        try {
            await chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: chrome.i18n.getMessage('appName'),
                message: isCurrentlyMuted ? 
                    `${chrome.i18n.getMessage('tabUnmuted')}: ${tab.title}` : 
                    `${chrome.i18n.getMessage('tabMuted')}: ${tab.title}`
            });
        } catch (error) {
            console.log('Notification not supported');
        }
    } catch (error) {
        console.error('Error toggling current tab mute:', error);
    }
}

// Экспорт для отладки
self.volumeMaster = volumeManager; 