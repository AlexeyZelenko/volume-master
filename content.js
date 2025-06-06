// Volume Master Content Script
class VolumeController {
    constructor() {
        this.audioContext = null;
        this.gainNode = null;
        this.audioElements = [];
        this.originalVolumes = new Map();
        this.audioSources = new Map();
        this.audioNodes = new Map();
        this.isInitialized = false;
        this.currentVolume = 1.0;
        this.currentMode = 'default';
        this.isFirstInteraction = false;
        
        this.init();
    }

    init() {
        console.log('Volume Master: Initializing content script');
        this.setupMessageListener();
        this.setupUserInteractionListener();
        this.findAudioElements();
        this.observeNewAudioElements();
        this.loadStoredSettings();
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('Volume Master: Received message', request);
            switch (request.action) {
                case 'setVolume':
                    this.setVolume(request.volume, request.audioMode);
                    sendResponse({ success: true });
                    break;
                case 'ping':
                    sendResponse({ pong: true });
                    break;
                case 'getStatus':
                    sendResponse(this.getStatus());
                    break;
                default:
                    sendResponse({ error: 'Unknown action' });
            }
            return true;
        });
    }

    setupUserInteractionListener() {
        // Ждем первого взаимодействия пользователя для инициализации AudioContext
        const handleFirstInteraction = async () => {
            if (!this.isFirstInteraction) {
                this.isFirstInteraction = true;
                console.log('Volume Master: First user interaction detected');
                await this.initWebAudioAPI();
                
                // Повторно применяем настройки после первого взаимодействия
                if (this.currentVolume !== 1.0 || this.currentMode !== 'default') {
                    this.applyToAllElements();
                }
            }
        };

        ['click', 'keydown', 'touchstart'].forEach(event => {
            document.addEventListener(event, handleFirstInteraction, { once: true, passive: true });
        });
    }

    async loadStoredSettings() {
        try {
            const result = await chrome.storage.sync.get(['volume', 'audioMode']);
            const volume = (result.volume || 100) / 100;
            const audioMode = result.audioMode || 'default';
            
            console.log('Volume Master: Loaded settings', { volume, audioMode });
            
            if (volume !== 1.0 || audioMode !== 'default') {
                this.setVolume(volume, audioMode);
            }
        } catch (error) {
            console.error('Volume Master: Error loading stored settings:', error);
        }
    }

    findAudioElements() {
        // Найти все аудио и видео элементы
        const mediaElements = document.querySelectorAll('audio, video');
        let newElements = 0;
        
        mediaElements.forEach(element => {
            if (!this.audioElements.includes(element)) {
                this.audioElements.push(element);
                newElements++;
                
                if (!this.originalVolumes.has(element)) {
                    this.originalVolumes.set(element, element.volume || 1.0);
                }
                
                // Применяем текущие настройки к новому элементу
                if (this.currentVolume !== 1.0 || this.currentMode !== 'default') {
                    this.applyVolumeToElement(element);
                }
            }
        });

        if (newElements > 0) {
            console.log(`Volume Master: Found ${newElements} new audio elements`);
        }
    }

    observeNewAudioElements() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const mediaElements = node.querySelectorAll ? 
                            node.querySelectorAll('audio, video') : [];
                        
                        if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') {
                            this.handleNewAudioElement(node);
                        }
                        
                        mediaElements.forEach(element => {
                            this.handleNewAudioElement(element);
                        });
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    handleNewAudioElement(element) {
        if (!this.audioElements.includes(element)) {
            console.log('Volume Master: New audio element detected');
            this.audioElements.push(element);
            this.originalVolumes.set(element, element.volume || 1.0);
            
            // Применяем настройки сразу или ждем загрузки
            if (element.readyState >= 1) {
                this.applyVolumeToElement(element);
            } else {
                element.addEventListener('loadedmetadata', () => {
                    this.applyVolumeToElement(element);
                }, { once: true });
            }
        }
    }

    async initWebAudioAPI() {
        if (this.isInitialized) return true;

        try {
            console.log('Volume Master: Initializing Web Audio API');
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Возобновляем контекст если он приостановлен
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            this.isInitialized = true;
            console.log('Volume Master: Web Audio API initialized successfully');
            return true;
        } catch (error) {
            console.error('Volume Master: Error initializing Web Audio API:', error);
            return false;
        }
    }

    setVolume(volume, audioMode = 'default') {
        console.log(`Volume Master: Setting volume to ${volume * 100}% with mode ${audioMode}`);
        this.currentVolume = volume;
        this.currentMode = audioMode;
        
        this.applyToAllElements();
    }

    applyToAllElements() {
        // Найти новые элементы сначала
        this.findAudioElements();
        
        // Применить к существующим элементам
        this.audioElements.forEach(element => {
            this.applyVolumeToElement(element);
        });
    }

    async applyVolumeToElement(element) {
        if (!element || !this.originalVolumes.has(element)) return;

        try {
            const originalVolume = this.originalVolumes.get(element);
            
            // Если громкость <= 100% и режим по умолчанию, используем стандартное свойство volume
            if (this.currentVolume <= 1.0 && this.currentMode === 'default') {
                console.log(`Volume Master: Applying standard volume ${this.currentVolume} to element`);
                element.volume = Math.max(0, Math.min(1, originalVolume * this.currentVolume));
                
                // Удаляем Web Audio API если он был применен
                this.removeWebAudioFromElement(element);
            } else {
                // Для boost'а > 100% или эффектов используем Web Audio API
                console.log(`Volume Master: Applying Web Audio boost ${this.currentVolume} to element`);
                await this.applyWebAudioBoost(element);
            }
        } catch (error) {
            console.error('Volume Master: Error applying volume to element:', error);
        }
    }

    removeWebAudioFromElement(element) {
        if (this.audioSources.has(element)) {
            try {
                const source = this.audioSources.get(element);
                source.disconnect();
                this.audioSources.delete(element);
                this.audioNodes.delete(element);
                element.volumeBoostApplied = false;
                console.log('Volume Master: Removed Web Audio from element');
            } catch (error) {
                console.error('Volume Master: Error removing Web Audio from element:', error);
            }
        }
    }

    async applyWebAudioBoost(element) {
        try {
            // Инициализируем Web Audio API если нужно
            const initialized = await this.initWebAudioAPI();
            if (!initialized || !this.audioContext) {
                console.warn('Volume Master: Web Audio API not available, falling back to standard volume');
                element.volume = Math.min(1, this.currentVolume);
                return;
            }
            
            // Проверяем, что элемент уже обработан
            if (element.volumeBoostApplied && this.audioSources.has(element)) {
                const nodeData = this.audioNodes.get(element);
                if (nodeData && nodeData.nodes.length > 0) {
                    // Обновляем существующий gain node
                    const gainNode = nodeData.nodes[0]; // Первый node всегда gain
                    if (gainNode.gain) {
                        gainNode.gain.value = this.currentVolume;
                        console.log(`Volume Master: Updated existing gain to ${this.currentVolume}`);
                        
                        // Только обновляем эффекты если режим изменился
                        if (nodeData.mode !== this.currentMode) {
                            console.log('Volume Master: Audio mode changed, updating effects smoothly...');
                            await this.updateAudioEffectsSmooth(element, nodeData);
                        }
                        return;
                    }
                }
            }

            // Создаем новое соединение только если элемент не был обработан ранее
            console.log('Volume Master: Creating new Web Audio boost connection');
            
            // Удаляем старое соединение если есть
            this.removeWebAudioFromElement(element);

            // Создаем источник аудио (только если элемент еще не подключен)
            let source;
            try {
                source = this.audioContext.createMediaElementSource(element);
                console.log('Volume Master: Created MediaElementSource successfully');
            } catch (error) {
                if (error.message.includes('already connected')) {
                    console.warn('Volume Master: Element already connected to audio context, trying to reuse...');
                    // Пытаемся найти существующий source
                    if (this.audioSources.has(element)) {
                        source = this.audioSources.get(element);
                    } else {
                        console.error('Volume Master: Cannot create or reuse MediaElementSource');
                        element.volume = Math.min(1, this.currentVolume);
                        return;
                    }
                } else {
                    throw error;
                }
            }
            
            this.audioSources.set(element, source);
            
            // Создаем цепочку узлов
            await this.createAudioNodeChain(element, source);
            
            console.log(`Volume Master: Successfully applied Web Audio boost ${this.currentVolume}`);
            
        } catch (error) {
            console.error('Volume Master: Error applying Web Audio boost:', error);
            console.error('Error details:', error.message);
            
            // Cleanup при ошибке
            this.removeWebAudioFromElement(element);
            
            // Fallback к стандартной громкости
            element.volume = Math.min(1, this.currentVolume);
        }
    }

    async createAudioNodeChain(element, source) {
        try {
            let currentNode = source;
            const nodes = [];

            // Узел усиления громкости (главный gain node)
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = this.currentVolume;
            nodes.push(gainNode);

            // Применяем аудио эффекты
            const effectNodes = this.createAudioEffectNodes();
            nodes.push(...effectNodes);

            // Соединяем узлы в цепочку
            nodes.forEach((node, index) => {
                try {
                    currentNode.connect(node);
                    currentNode = node;
                } catch (connectError) {
                    console.error('Volume Master: Error connecting audio nodes:', connectError);
                    throw connectError;
                }
            });

            // Подключаем к выходу
            try {
                currentNode.connect(this.audioContext.destination);
            } catch (connectError) {
                console.error('Volume Master: Error connecting to destination:', connectError);
                throw connectError;
            }
            
            // Сохраняем ссылки с информацией о режиме
            this.audioNodes.set(element, { 
                source, 
                nodes, 
                mode: this.currentMode 
            });
            element.volumeBoostApplied = true;
            
            // Устанавливаем оригинальную громкость элемента в максимум
            element.volume = 1.0;
            
        } catch (error) {
            console.error('Volume Master: Error creating audio node chain:', error);
            throw error;
        }
    }

    async updateAudioEffectsSmooth(element, nodeData) {
        try {
            console.log('Volume Master: Smoothly updating audio effects for mode change');
            
            // Сохраняем источник и gain node (они не изменяются)
            const source = nodeData.source;
            const gainNode = nodeData.nodes[0];
            
            // Получаем текущие узлы эффектов (все кроме первого gain узла)
            const currentEffectNodes = nodeData.nodes.slice(1);
            
            // Создаем новые узлы эффектов
            const newEffectNodes = this.createAudioEffectNodes();
            
            // Временно создаем второй gain node для плавного перехода
            const tempGainNode = this.audioContext.createGain();
            tempGainNode.gain.value = this.currentVolume;
            
            // Подключаем новую цепочку через временный gain node
            let currentNode = tempGainNode;
            newEffectNodes.forEach(node => {
                currentNode.connect(node);
                currentNode = node;
            });
            
            // Подключаем к выходу
            if (newEffectNodes.length > 0) {
                currentNode.connect(this.audioContext.destination);
            } else {
                tempGainNode.connect(this.audioContext.destination);
            }
            
            // Подключаем источник к новой цепочке
            source.connect(tempGainNode);
            
            // Плавно переходим от старой цепочки к новой
            const currentTime = this.audioContext.currentTime;
            const fadeTime = 0.05; // 50ms для плавного перехода
            
            // Уменьшаем громкость старой цепочки
            gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
            gainNode.gain.linearRampToValueAtTime(0, currentTime + fadeTime);
            
            // Увеличиваем громкость новой цепочки
            tempGainNode.gain.setValueAtTime(0, currentTime);
            tempGainNode.gain.linearRampToValueAtTime(this.currentVolume, currentTime + fadeTime);
            
            // После перехода отключаем старую цепочку и обновляем ссылки
            setTimeout(() => {
                try {
                    // Отключаем старые узлы эффектов
                    currentEffectNodes.forEach(node => {
                        try {
                            node.disconnect();
                        } catch (error) {
                            // Игнорируем ошибки отключения
                        }
                    });
                    
                    // Отключаем старый gain node
                    gainNode.disconnect();
                    
                    // Обновляем gain node на новый
                    const newNodes = [tempGainNode, ...newEffectNodes];
                    
                    // Обновляем сохраненные данные
                    this.audioNodes.set(element, { 
                        source, 
                        nodes: newNodes, 
                        mode: this.currentMode 
                    });
                    
                    console.log('Volume Master: Smooth audio effects transition completed');
                    
                } catch (error) {
                    console.error('Volume Master: Error during smooth transition cleanup:', error);
                }
            }, fadeTime * 1000 + 10); // Небольшая задержка после fade
            
        } catch (error) {
            console.error('Volume Master: Error in smooth audio effects update:', error);
            // В случае ошибки делаем обычное переподключение
            await this.updateAudioEffects(element, nodeData);
        }
    }

    async updateAudioEffects(element, nodeData) {
        try {
            console.log('Volume Master: Updating audio effects for mode change (fallback method)');
            
            // Сохраняем источник и gain node
            const source = nodeData.source;
            const gainNode = nodeData.nodes[0];
            
            // Отключаем все узлы эффектов
            const effectNodes = nodeData.nodes.slice(1);
            effectNodes.forEach(node => {
                try {
                    node.disconnect();
                } catch (error) {
                    console.warn('Volume Master: Error disconnecting effect node:', error);
                }
            });
            
            // Отключаем gain от старых эффектов
            gainNode.disconnect();
            
            // Создаем новые эффекты
            const newEffectNodes = this.createAudioEffectNodes();
            const allNodes = [gainNode, ...newEffectNodes];
            
            // Переподключаем цепочку
            let currentNode = source;
            allNodes.forEach((node, index) => {
                if (index === 0) {
                    // Подключаем source к gain node
                    currentNode.connect(node);
                } else {
                    // Подключаем предыдущий узел к текущему
                    allNodes[index - 1].connect(node);
                }
                currentNode = node;
            });
            
            // Подключаем последний узел к выходу
            currentNode.connect(this.audioContext.destination);
            
            // Обновляем сохраненные данные
            this.audioNodes.set(element, { 
                source, 
                nodes: allNodes, 
                mode: this.currentMode 
            });
            
            console.log('Volume Master: Audio effects updated successfully (fallback)');
            
        } catch (error) {
            console.error('Volume Master: Error updating audio effects (fallback):', error);
            // В случае ошибки пересоздаем все соединение
            this.removeWebAudioFromElement(element);
            await this.applyWebAudioBoost(element);
        }
    }

    createAudioEffectNodes() {
        const nodes = [];

        if (!this.audioContext) return nodes;

        if (this.currentMode === 'voice') {
            // Voice boost - усиление средних частот (речь)
            const voiceFilter = this.audioContext.createBiquadFilter();
            voiceFilter.type = 'peaking';
            voiceFilter.frequency.value = 2000; // 2kHz - основная область речи
            voiceFilter.Q.value = 2;
            voiceFilter.gain.value = 8; // +8dB усиление
            nodes.push(voiceFilter);

            // Дополнительное усиление для ясности речи
            const clarityFilter = this.audioContext.createBiquadFilter();
            clarityFilter.type = 'highshelf';
            clarityFilter.frequency.value = 4000; // 4kHz и выше
            clarityFilter.gain.value = 4; // +4dB
            nodes.push(clarityFilter);

        } else if (this.currentMode === 'bass') {
            // Bass boost - усиление низких частот
            const bassFilter = this.audioContext.createBiquadFilter();
            bassFilter.type = 'lowshelf';
            bassFilter.frequency.value = 150; // 150Hz и ниже
            bassFilter.gain.value = 10; // +10dB усиление басов
            nodes.push(bassFilter);

            // Дополнительное усиление для глубоких басов
            const subBassFilter = this.audioContext.createBiquadFilter();
            subBassFilter.type = 'peaking';
            subBassFilter.frequency.value = 60; // 60Hz
            subBassFilter.Q.value = 2;
            subBassFilter.gain.value = 6; // +6dB
            nodes.push(subBassFilter);
        }

        return nodes;
    }

    // Метод для отслеживания новых аудио элементов на динамических сайтах
    reinitialize() {
        console.log('Volume Master: Reinitializing');
        
        // Отключаем старые Web Audio соединения
        this.audioSources.forEach((source, element) => {
            this.removeWebAudioFromElement(element);
        });
        
        this.audioElements = [];
        this.originalVolumes.clear();
        
        this.findAudioElements();
        this.setVolume(this.currentVolume, this.currentMode);
    }

    // Метод для получения информации о текущем состоянии
    getStatus() {
        return {
            volume: this.currentVolume,
            mode: this.currentMode,
            elementsCount: this.audioElements.length,
            webAudioActive: this.audioSources.size > 0,
            audioContextState: this.audioContext ? this.audioContext.state : 'not initialized',
            isFirstInteraction: this.isFirstInteraction
        };
    }
}

// Инициализация контроллера громкости
console.log('Volume Master: Loading content script');
const volumeController = new VolumeController();

// Переинициализация при изменении URL (для SPA)
let currentUrl = location.href;
new MutationObserver(() => {
    if (location.href !== currentUrl) {
        currentUrl = location.href;
        console.log('Volume Master: URL changed, reinitializing');
        setTimeout(() => {
            volumeController.reinitialize();
        }, 1000); // Задержка для загрузки нового контента
    }
}).observe(document, { subtree: true, childList: true });

// Экспорт для отладки
window.volumeMaster = volumeController;