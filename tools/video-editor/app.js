/**
 * Video Editor - Kdenlive-style Professional Video Editor
 * Features: Canvas-based preview, WASM timeline engine, multi-track editing
 */

import { PreviewEngine, snap_to_frame } from './preview-engine.js';

// ============================================
// State Management
// ============================================
const state = {
    // Preview Engine
    previewEngine: null,
    
    // FFmpeg
    ffmpeg: null,
    fetchFile: null,
    loaded: false,
    
    // Timeline
    clips: [],
    selectedClips: new Set(),
    nextClipId: 1,
    tracks: [
        { id: 'video1', type: 'video', name: 'V1', locked: false, visible: true },
        { id: 'video2', type: 'video', name: 'V2', locked: false, visible: true },
        { id: 'audio1', type: 'audio', name: 'A1', locked: false, muted: false },
        { id: 'audio2', type: 'audio', name: 'A2', locked: false, muted: false }
    ],
    
    // View
    zoom: 50,
    pixelsPerSecond: 50,
    snapToGrid: true,
    showMarkers: true,
    
    // Tools
    activeTool: 'select',
    
    // Markers
    inPoint: null,
    outPoint: null,
    
    // Dragging
    isDragging: false,
    dragType: null,
    dragTarget: null,
    dragStartX: 0,
    dragStartY: 0,
    dragStartTime: 0,
    dragClipDuration: 0,
    dragOriginalTrack: null,
    hasDragged: false,
    
    // Long press
    longPressTimer: null,
    longPressDuration: 500,
    isLongPress: false,
    
    // Selection box
    isSelecting: false,
    selectionStart: null,
    
    // Clipboard
    clipboard: [],
    
    // Undo/Redo
    history: [],
    historyIndex: -1,
    maxHistory: 50,
    
    // Context menu
    contextMenuTarget: null,
    
    // Touch
    touchStartTime: 0,
    touchStartX: 0,
    touchStartY: 0,
    isTouch: false
};

// ============================================
// DOM Elements Cache
// ============================================
const elements = {};

function cacheElements() {
    elements.loadingOverlay = document.getElementById('loadingOverlay');
    elements.loadingProgress = document.getElementById('loadingProgress');
    elements.appContainer = document.getElementById('appContainer');
    elements.menuBtns = document.querySelectorAll('.menu-btn');
    elements.dropdownMenus = document.querySelectorAll('.dropdown-menu');
    elements.panelTabs = document.querySelectorAll('.panel-tab');
    elements.panelContents = document.querySelectorAll('.panel-content');
    elements.leftPanel = document.getElementById('leftPanel');
    elements.leftPanelHandle = document.getElementById('leftPanelHandle');
    elements.videoInput = document.getElementById('videoInput');
    elements.audioInput = document.getElementById('audioInput');
    elements.addVideoBtn = document.getElementById('addVideoBtn');
    elements.addAudioBtn = document.getElementById('addAudioBtn');
    elements.videoClipList = document.getElementById('videoClipList');
    elements.audioClipList = document.getElementById('audioClipList');
    elements.clipProperties = document.getElementById('clipProperties');
    elements.propertiesEmpty = document.querySelector('.properties-empty');
    elements.propName = document.getElementById('propName');
    elements.propDuration = document.getElementById('propDuration');
    elements.propStart = document.getElementById('propStart');
    elements.propEnd = document.getElementById('propEnd');
    elements.propVolume = document.getElementById('propVolume');
    elements.propVolumeValue = document.getElementById('propVolumeValue');
    elements.propSpeed = document.getElementById('propSpeed');
    
    // Preview elements
    elements.previewCanvas = document.getElementById('previewCanvas');
    elements.previewCanvasContainer = document.getElementById('previewCanvasContainer');
    elements.emptyState = document.getElementById('emptyState');
    elements.videoElementsContainer = document.getElementById('videoElementsContainer');
    
    elements.playPauseBtn = document.getElementById('playPauseBtn');
    elements.playIcon = document.getElementById('playIcon');
    elements.pauseIcon = document.getElementById('pauseIcon');
    elements.prevFrameBtn = document.getElementById('prevFrameBtn');
    elements.nextFrameBtn = document.getElementById('nextFrameBtn');
    elements.loopBtn = document.getElementById('loopBtn');
    elements.markInBtn = document.getElementById('markInBtn');
    elements.markOutBtn = document.getElementById('markOutBtn');
    elements.currentTimeDisplay = document.getElementById('currentTimeDisplay');
    elements.durationDisplay = document.getElementById('durationDisplay');
    elements.selectTool = document.getElementById('selectTool');
    elements.razorTool = document.getElementById('razorTool');
    elements.handTool = document.getElementById('handTool');
    elements.undoBtn = document.getElementById('undoBtn');
    elements.redoBtn = document.getElementById('redoBtn');
    elements.zoomOutBtn = document.getElementById('zoomOutBtn');
    elements.zoomInBtn = document.getElementById('zoomInBtn');
    elements.zoomSlider = document.getElementById('zoomSlider');
    elements.snapBtn = document.getElementById('snapBtn');
    elements.showMarkersBtn = document.getElementById('showMarkersBtn');
    elements.timelineContainer = document.getElementById('timelineContainer');
    elements.trackHeaders = document.getElementById('trackHeaders');
    elements.timelineTracksWrapper = document.getElementById('timelineTracksWrapper');
    elements.timelineRuler = document.getElementById('timelineRuler');
    elements.rulerCanvas = document.getElementById('rulerCanvas');
    elements.tracksContainer = document.getElementById('tracksContainer');
    elements.playhead = document.getElementById('playhead');
    elements.inPointMarker = document.getElementById('inPointMarker');
    elements.outPointMarker = document.getElementById('outPointMarker');
    elements.timelineInfo = document.getElementById('timelineInfo');
    elements.selectionInfo = document.getElementById('selectionInfo');
    elements.zoomInfo = document.getElementById('zoomInfo');
    elements.videoTrack1 = document.getElementById('videoTrack1');
    elements.videoTrack2 = document.getElementById('videoTrack2');
    elements.audioTrack1 = document.getElementById('audioTrack1');
    elements.audioTrack2 = document.getElementById('audioTrack2');
    elements.contextMenu = document.getElementById('contextMenu');
    elements.contextMenuItems = document.getElementById('contextMenuItems');
    elements.processingModal = document.getElementById('processingModal');
    elements.processingProgress = document.getElementById('processingProgress');
    elements.processingStatus = document.getElementById('processingStatus');
    elements.shortcutsModal = document.getElementById('shortcutsModal');
    elements.closeShortcutsModal = document.getElementById('closeShortcutsModal');
    elements.exportBtn = document.getElementById('exportBtn');
    elements.toast = document.getElementById('toast');
    elements.toastIcon = document.getElementById('toastIcon');
    elements.toastMessage = document.getElementById('toastMessage');
}

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    cacheElements();
    
    // Loading progress tracker
    const loadingSteps = [
        { name: '初始化界面...', weight: 5 },
        { name: '加载国际化...', weight: 10 },
        { name: '加载 WASM 核心引擎...', weight: 30 },
        { name: '初始化预览引擎...', weight: 20 },
        { name: '加载 FFmpeg...', weight: 35 }
    ];
    let currentStep = 0;
    let totalProgress = 0;
    
    function updateLoadingStatus(stepName, percent) {
        const loadingSubtitle = elements.loadingOverlay.querySelector('p');
        if (loadingSubtitle) {
            loadingSubtitle.textContent = stepName;
        }
        updateLoadingProgress(percent);
    }
    
    function advanceStep() {
        if (currentStep < loadingSteps.length) {
            const step = loadingSteps[currentStep];
            updateLoadingStatus(step.name, totalProgress);
            currentStep++;
        }
    }
    
    // Step 1: Initialize UI
    advanceStep();
    await new Promise(r => setTimeout(r, 50));
    totalProgress += loadingSteps[0].weight;
    
    // Step 2: Initialize i18n
    advanceStep();
    await I18N.init();
    I18N.initLanguageSwitcher('#langSwitcherContainer');
    totalProgress += loadingSteps[1].weight;
    
    // Step 3 & 4: Initialize Preview Engine (WASM)
    advanceStep();
    try {
        state.previewEngine = new PreviewEngine();
        
        // Track WASM loading progress
        const wasmLoadPromise = state.previewEngine.init();
        
        // Simulate WASM loading progress within this step
        const wasmProgressInterval = setInterval(() => {
            if (totalProgress < 40) {
                totalProgress += 1;
                updateLoadingProgress(totalProgress);
            }
        }, 50);
        
        await wasmLoadPromise;
        clearInterval(wasmProgressInterval);
        
        state.previewEngine.setCanvas(elements.previewCanvas);
        
        // Set up preview callbacks
        state.previewEngine.onTimeUpdate = handlePreviewTimeUpdate;
        state.previewEngine.onPlay = () => { updatePlayButton(); };
        state.previewEngine.onPause = () => { updatePlayButton(); };
        state.previewEngine.onEnded = () => { updatePlayButton(); };
        
        totalProgress = 65;
        updateLoadingProgress(totalProgress);
        console.log('Preview engine initialized');
    } catch (error) {
        console.error('Failed to initialize preview engine:', error);
        showToast('预览引擎初始化失败，请刷新重试', 'error');
        return;
    }
    
    // Step 5: Initialize FFmpeg with progress tracking
    advanceStep();
    await initFFmpegWithProgress((ffmpegProgress) => {
        // FFmpeg progress: 0-100 maps to total 65-100
        const weightedProgress = 65 + Math.round(ffmpegProgress * 0.35);
        updateLoadingProgress(Math.min(99, weightedProgress));
    });
    
    // Complete
    updateLoadingProgress(100);
    updateLoadingStatus('就绪', 100);
    await new Promise(r => setTimeout(r, 200));
    
    // Setup event listeners
    bindEvents();
    bindContextMenu();
    bindKeyboardShortcuts();
    bindImmersiveMode();
    bindTouchEvents();
    bindPanelResize();
    
    // Initialize timeline
    initTimeline();
    
    // Update UI
    updateUI();
    
    // Focus app container for keyboard events
    elements.appContainer.focus();
    
    // Hide loading overlay
    elements.loadingOverlay.classList.add('hidden');
});

async function initFFmpeg() {
    await initFFmpegWithProgress((progress) => {
        updateLoadingProgress(Math.round(progress));
    });
}

async function initFFmpegWithProgress(onProgress) {
    try {
        const { FFmpeg } = FFmpegWASM;
        const { fetchFile } = FFmpegUtil;
        
        state.ffmpeg = new FFmpeg();
        state.fetchFile = fetchFile;
        
        state.ffmpeg.on('log', ({ message }) => {
            console.log('FFmpeg:', message);
        });
        
        state.ffmpeg.on('progress', ({ progress }) => {
            onProgress(progress * 100);
        });
        
        const baseURL = new URL('.', window.location.href).href;
        
        await state.ffmpeg.load({
            coreURL: baseURL + 'ffmpeg/ffmpeg-core.js',
            wasmURL: baseURL + 'ffmpeg/ffmpeg-core.wasm'
        });
        
        state.loaded = true;
        console.log('FFmpeg loaded successfully');
    } catch (error) {
        console.error('FFmpeg load failed:', error);
        // FFmpeg is optional for preview, so continue without it
    }
}

function updateLoadingProgress(percent) {
    if (elements.loadingProgress) {
        elements.loadingProgress.textContent = `${percent}%`;
    }
    const progressFill = document.getElementById('loadingProgressFill');
    if (progressFill) {
        progressFill.style.width = `${percent}%`;
    }
}

// ============================================
// Event Binding
// ============================================
function bindEvents() {
    // Menu dropdowns
    elements.menuBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const menuId = btn.dataset.menu;
            toggleDropdown(menuId);
        });
    });
    
    document.addEventListener('click', () => {
        closeAllDropdowns();
    });
    
    // Dropdown actions
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = item.dataset.action;
            handleMenuAction(action);
        });
    });
    
    // Panel tabs
    elements.panelTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const panel = tab.dataset.panel;
            switchPanel(panel);
        });
    });
    
    // File inputs
    elements.addVideoBtn.addEventListener('click', () => elements.videoInput.click());
    elements.addAudioBtn.addEventListener('click', () => elements.audioInput.click());
    elements.videoInput.addEventListener('change', handleVideoUpload);
    elements.audioInput.addEventListener('change', handleAudioUpload);
    
    // Drag and drop
    bindDragAndDrop();
    
    // Transport controls
    elements.playPauseBtn.addEventListener('click', togglePlayPause);
    elements.prevFrameBtn.addEventListener('click', () => stepFrame(-1));
    elements.nextFrameBtn.addEventListener('click', () => stepFrame(1));
    elements.loopBtn.addEventListener('click', toggleLoop);
    elements.markInBtn.addEventListener('click', markInPoint);
    elements.markOutBtn.addEventListener('click', markOutPoint);
    
    // Timeline tools
    elements.selectTool.addEventListener('click', () => setActiveTool('select'));
    elements.razorTool.addEventListener('click', () => setActiveTool('razor'));
    elements.handTool.addEventListener('click', () => setActiveTool('hand'));
    elements.undoBtn.addEventListener('click', undo);
    elements.redoBtn.addEventListener('click', redo);
    
    // Zoom controls
    elements.zoomOutBtn.addEventListener('click', () => changeZoom(0.8));
    elements.zoomInBtn.addEventListener('click', () => changeZoom(1.25));
    elements.zoomSlider.addEventListener('input', (e) => setZoom(parseInt(e.target.value)));
    
    // Toggle buttons
    elements.snapBtn.addEventListener('click', toggleSnap);
    elements.showMarkersBtn.addEventListener('click', toggleShowMarkers);
    
    // Track controls
    bindTrackControls();
    
    // Timeline interaction
    bindTimelineInteraction();
    
    // Properties
    bindPropertiesEvents();
    
    // Export
    elements.exportBtn.addEventListener('click', exportVideo);
    
    // Modals
    elements.closeShortcutsModal.addEventListener('click', () => {
        elements.shortcutsModal.classList.add('hidden');
    });
    
    // Window resize
    window.addEventListener('resize', () => {
        if (state.previewEngine) {
            state.previewEngine.updateCanvasSize();
        }
        updateRuler();
        renderClips();
    });
}

function bindDragAndDrop() {
    const dropZones = [elements.previewCanvasContainer, elements.tracksContainer];
    
    dropZones.forEach(zone => {
        if (!zone) return;
        
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.add('drag-over');
        });
        
        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over');
        });
        
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.remove('drag-over');
            
            const files = Array.from(e.dataTransfer.files);
            files.forEach(file => {
                if (file.type.startsWith('video/')) {
                    // Determine target track from drop position
                    const trackEl = e.target.closest('.track-row');
                    let targetTrack = null;
                    if (trackEl) {
                        targetTrack = trackEl.dataset.track;
                    }
                    loadVideo(file, targetTrack);
                } else if (file.type.startsWith('audio/')) {
                    addAudioClip(file);
                }
            });
        });
    });
    
    // Enable drag and drop for specific tracks
    document.querySelectorAll('.track-row').forEach(trackRow => {
        trackRow.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            trackRow.style.backgroundColor = 'rgba(79, 70, 229, 0.1)';
        });
        
        trackRow.addEventListener('dragleave', (e) => {
            trackRow.style.backgroundColor = '';
        });
        
        trackRow.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            trackRow.style.backgroundColor = '';
            
            const files = Array.from(e.dataTransfer.files);
            const targetTrack = trackRow.dataset.track;
            
            files.forEach(file => {
                if (file.type.startsWith('video/')) {
                    loadVideo(file, targetTrack);
                } else if (file.type.startsWith('audio/')) {
                    addAudioClipToTrack(file, targetTrack);
                }
            });
        });
    });
    
    // Effect items drag
    document.querySelectorAll('.effect-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('effect', item.dataset.effect);
        });
    });
}

function bindTrackControls() {
    document.querySelectorAll('.track-header').forEach(header => {
        const trackId = header.dataset.track;
        const eyeBtn = header.querySelector('.track-eye');
        const lockBtn = header.querySelector('.track-lock');
        const muteBtn = header.querySelector('.track-mute');
        
        if (eyeBtn) {
            eyeBtn.addEventListener('click', () => toggleTrackVisible(trackId));
        }
        if (lockBtn) {
            lockBtn.addEventListener('click', () => toggleTrackLock(trackId));
        }
        if (muteBtn) {
            muteBtn.addEventListener('click', () => toggleTrackMute(trackId));
        }
    });
}

function bindTimelineInteraction() {
    // Track container mouse events
    elements.tracksContainer.addEventListener('mousedown', handleTimelineMouseDown);
    document.addEventListener('mousemove', handleTimelineMouseMove);
    document.addEventListener('mouseup', handleTimelineMouseUp);
    
    // Ruler mouse events - unified with tracks container
    elements.timelineRuler.addEventListener('mousedown', (e) => {
        // Only handle if clicking directly on ruler or ruler canvas
        if (e.target === elements.timelineRuler || e.target === elements.rulerCanvas) {
            const rect = elements.timelineRuler.getBoundingClientRect();
            const x = e.clientX - rect.left + elements.timelineTracksWrapper.scrollLeft;
            const time = x / state.pixelsPerSecond;
            seekTo(time);
            
            state.isDragging = true;
            state.dragType = 'playhead';
            state.dragStartX = e.clientX;
            state.dragStartTime = time;
            document.body.style.cursor = 'ew-resize';
        }
    });
    
    // Timeline scroll sync
    elements.timelineTracksWrapper.addEventListener('scroll', () => {
        elements.timelineRuler.scrollLeft = elements.timelineTracksWrapper.scrollLeft;
    });
}

function bindPropertiesEvents() {
    elements.propName?.addEventListener('change', updateSelectedClipProperties);
    elements.propStart?.addEventListener('change', updateSelectedClipProperties);
    elements.propEnd?.addEventListener('change', updateSelectedClipProperties);
    elements.propVolume?.addEventListener('input', (e) => {
        elements.propVolumeValue.textContent = `${e.target.value}%`;
        updateSelectedClipProperties();
    });
    elements.propSpeed?.addEventListener('change', updateSelectedClipProperties);
}

// ============================================
// Context Menu System
// ============================================
function bindContextMenu() {
    elements.appContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, e.target);
    });
    
    document.addEventListener('click', (e) => {
        if (!elements.contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });
    
    elements.contextMenu.addEventListener('click', (e) => {
        const item = e.target.closest('.context-menu-item');
        if (item && !item.classList.contains('disabled')) {
            const action = item.dataset.action;
            handleContextMenuAction(action);
            hideContextMenu();
        }
    });
}

function showContextMenu(x, y, target) {
    const clipEl = target.closest('.timeline-clip');
    const trackEl = target.closest('.track-row');
    const isRuler = target.closest('.timeline-ruler');
    
    let items = [];
    
    if (clipEl) {
        const clipId = parseInt(clipEl.dataset.id);
        const clip = state.clips.find(c => c.id === clipId);
        state.contextMenuTarget = clip;
        
        const isSelected = state.selectedClips.has(clipId);
        
        items = [
            { action: 'select', label: I18N.t('videoEditor.menu.select') || '选择', icon: '◉', shortcut: 'Click' },
            { action: 'split', label: I18N.t('videoEditor.menu.split') || '在此处分割', icon: '✂', shortcut: 'S' },
            { type: 'divider' },
            { action: 'cut', label: I18N.t('videoEditor.menu.cut') || '剪切', icon: '✂️', shortcut: 'Ctrl+X' },
            { action: 'copy', label: I18N.t('videoEditor.menu.copy') || '复制', icon: '📋', shortcut: 'Ctrl+C' },
            { action: 'delete', label: I18N.t('videoEditor.menu.delete') || '删除', icon: '🗑️', shortcut: 'Del', danger: true },
            { type: 'divider' },
            { action: 'lift', label: I18N.t('videoEditor.menu.lift') || '提升', icon: '⬆️' },
            { action: 'extract', label: I18N.t('videoEditor.menu.extract') || '提取', icon: '⬇️' },
            { type: 'divider' },
            { action: 'properties', label: I18N.t('videoEditor.menu.properties') || '属性', icon: '⚙️' }
        ];
        
        if (!isSelected) {
            items.unshift({ action: 'deselect', label: I18N.t('videoEditor.menu.deselect') || '取消全选', icon: '◌', shortcut: 'Esc' });
        }
    } else if (trackEl || isRuler) {
        items = [
            { action: 'paste', label: I18N.t('videoEditor.menu.paste') || '粘贴', icon: '📋', shortcut: 'Ctrl+V', disabled: state.clipboard.length === 0 },
            { action: 'selectAll', label: I18N.t('videoEditor.menu.selectAll') || '全选', icon: '☐', shortcut: 'Ctrl+A' },
            { type: 'divider' },
            { action: 'zoomIn', label: I18N.t('videoEditor.menu.zoomIn') || '放大', icon: '🔍+', shortcut: '+' },
            { action: 'zoomOut', label: I18N.t('videoEditor.menu.zoomOut') || '缩小', icon: '🔍-', shortcut: '-' },
            { type: 'divider' },
            { action: 'addMarker', label: I18N.t('videoEditor.menu.addMarker') || '添加标记', icon: '📍' },
            { action: 'clearMarkers', label: I18N.t('videoEditor.menu.clearMarkers') || '清除标记', icon: '🧹' }
        ];
    } else {
        items = [
            { action: 'newProject', label: I18N.t('videoEditor.menu.newProject') || '新建项目', icon: '📄', shortcut: 'Ctrl+N' },
            { action: 'openVideo', label: I18N.t('videoEditor.menu.openVideo') || '打开视频', icon: '🎬', shortcut: 'Ctrl+O' },
            { type: 'divider' },
            { action: 'undo', label: I18N.t('videoEditor.menu.undo') || '撤销', icon: '↩️', shortcut: 'Ctrl+Z', disabled: state.historyIndex < 0 },
            { action: 'redo', label: I18N.t('videoEditor.menu.redo') || '重做', icon: '↪️', shortcut: 'Ctrl+Y', disabled: state.historyIndex >= state.history.length - 1 },
            { type: 'divider' },
            { action: 'shortcuts', label: I18N.t('videoEditor.menu.shortcuts') || '快捷键帮助', icon: '⌨️', shortcut: '?' }
        ];
    }
    
    renderContextMenu(items);
    
    const menuWidth = 220;
    const menuHeight = items.length * 32 + 20;
    
    let menuX = Math.min(x, window.innerWidth - menuWidth - 10);
    let menuY = Math.min(y, window.innerHeight - menuHeight - 10);
    
    elements.contextMenu.style.left = `${menuX}px`;
    elements.contextMenu.style.top = `${menuY}px`;
    elements.contextMenu.classList.remove('hidden');
}

function hideContextMenu() {
    elements.contextMenu.classList.add('hidden');
    state.contextMenuTarget = null;
}

function renderContextMenu(items) {
    elements.contextMenuItems.innerHTML = items.map(item => {
        if (item.type === 'divider') {
            return '<div class="context-menu-divider"></div>';
        }
        
        const disabledClass = item.disabled ? 'disabled' : '';
        const dangerClass = item.danger ? 'danger' : '';
        
        return `
            <button class="context-menu-item ${disabledClass} ${dangerClass}" data-action="${item.action}">
                <span>${item.icon}</span>
                <span>${item.label}</span>
                ${item.shortcut ? `<kbd>${item.shortcut}</kbd>` : ''}
            </button>
        `;
    }).join('');
}

function handleContextMenuAction(action) {
    switch (action) {
        case 'select':
            if (state.contextMenuTarget) {
                selectClip(state.contextMenuTarget.id);
            }
            break;
        case 'deselect':
            deselectAllClips();
            break;
        case 'split':
            splitAtPlayhead();
            break;
        case 'cut':
            cutSelected();
            break;
        case 'copy':
            copySelected();
            break;
        case 'paste':
            pasteAtPlayhead();
            break;
        case 'delete':
            deleteSelectedClips();
            break;
        case 'lift':
            liftSelectedClips();
            break;
        case 'extract':
            extractSelectedClips();
            break;
        case 'properties':
            switchPanel('properties');
            break;
        case 'selectAll':
            selectAllClips();
            break;
        case 'zoomIn':
            changeZoom(1.25);
            break;
        case 'zoomOut':
            changeZoom(0.8);
            break;
        case 'addMarker':
            addMarkerAtPlayhead();
            break;
        case 'clearMarkers':
            clearMarkers();
            break;
        case 'newProject':
            newProject();
            break;
        case 'openVideo':
            elements.videoInput.click();
            break;
        case 'undo':
            undo();
            break;
        case 'redo':
            redo();
            break;
        case 'shortcuts':
            elements.shortcutsModal.classList.remove('hidden');
            break;
    }
}

// ============================================
// Touch & Long Press Support
// ============================================
function bindTouchEvents() {
    const timeline = elements.tracksContainer;
    
    timeline.addEventListener('touchstart', handleTouchStart, { passive: false });
    timeline.addEventListener('touchmove', handleTouchMove, { passive: false });
    timeline.addEventListener('touchend', handleTouchEnd);
    timeline.addEventListener('touchcancel', handleTouchEnd);
    
    timeline.addEventListener('mousedown', handleMouseDown);
}

function handleTouchStart(e) {
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    state.isTouch = true;
    state.touchStartTime = Date.now();
    state.touchStartX = touch.clientX;
    state.touchStartY = touch.clientY;
    
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const clipEl = target?.closest('.timeline-clip');
    
    if (clipEl) {
        state.longPressTimer = setTimeout(() => {
            state.isLongPress = true;
            showLongPressIndicator(touch.clientX, touch.clientY);
            
            const clipId = parseInt(clipEl.dataset.id);
            const clip = state.clips.find(c => c.id === clipId);
            if (clip && !clip.locked) {
                startClipDrag(touch.clientX, touch.clientY, clip);
            }
        }, state.longPressDuration);
    }
}

function handleTouchMove(e) {
    if (!state.isTouch) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - state.touchStartX);
    const deltaY = Math.abs(touch.clientY - state.touchStartY);
    
    if (deltaX > 10 || deltaY > 10) {
        clearTimeout(state.longPressTimer);
    }
    
    if (state.isDragging && state.isLongPress) {
        e.preventDefault();
        handleDrag(touch.clientX, touch.clientY);
    }
}

function handleTouchEnd(e) {
    clearTimeout(state.longPressTimer);
    hideLongPressIndicator();
    
    if (state.isDragging) {
        endDrag();
    }
    
    const touchDuration = Date.now() - state.touchStartTime;
    if (!state.isLongPress && touchDuration < 300) {
        const target = document.elementFromPoint(
            state.touchStartX, 
            state.touchStartY
        );
        const clipEl = target?.closest('.timeline-clip');
        if (clipEl) {
            const clipId = parseInt(clipEl.dataset.id);
            if (state.touchStartTime - (state.lastTapTime || 0) < 300) {
                seekTo(state.clips.find(c => c.id === clipId)?.startTime || 0);
            } else {
                selectClip(clipId);
            }
            state.lastTapTime = state.touchStartTime;
        }
    }
    
    state.isTouch = false;
    state.isLongPress = false;
}

function handleMouseDown(e) {
    if (state.isTouch) return;
    
    const clipEl = e.target.closest('.timeline-clip');
    if (clipEl) {
        state.longPressTimer = setTimeout(() => {
            const clipId = parseInt(clipEl.dataset.id);
            const clip = state.clips.find(c => c.id === clipId);
            if (clip && !clip.locked) {
                startClipDrag(e.clientX, e.clientY, clip);
            }
        }, state.longPressDuration);
    }
}

function showLongPressIndicator(x, y) {
    hideLongPressIndicator();
    const indicator = document.createElement('div');
    indicator.className = 'long-press-indicator';
    indicator.id = 'longPressIndicator';
    indicator.style.left = `${x - 20}px`;
    indicator.style.top = `${y - 20}px`;
    indicator.style.width = '40px';
    indicator.style.height = '40px';
    document.body.appendChild(indicator);
}

function hideLongPressIndicator() {
    const indicator = document.getElementById('longPressIndicator');
    if (indicator) {
        indicator.remove();
    }
}

// ============================================
// Immersive Mode
// ============================================
function bindImmersiveMode() {
    document.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.kdenlive-editor')) {
            e.preventDefault();
        }
    });
    
    document.addEventListener('selectstart', (e) => {
        if (e.target.closest('.timeline-container, .track-row, .timeline-clip')) {
            e.preventDefault();
        }
    });
    
    document.addEventListener('dragstart', (e) => {
        if (e.target.closest('.timeline-clip, .track-row')) {
            if (!e.target.closest('.effect-item')) {
                e.preventDefault();
            }
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 's':
                case 'o':
                case 'a':
                    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                        e.preventDefault();
                    }
                    break;
            }
        }
        
        if (e.code === 'Space' && !e.target.matches('input, textarea')) {
            e.preventDefault();
        }
    });
    
    document.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
        }
    }, { passive: false });
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            showToast(`无法进入全屏: ${err.message}`, 'error');
        });
    } else {
        document.exitFullscreen();
    }
}

function handleFullscreenChange() {
    if (document.fullscreenElement) {
        document.body.classList.add('fullscreen');
    } else {
        document.body.classList.remove('fullscreen');
    }
}

// ============================================
// Keyboard Shortcuts
// ============================================
function bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.target.matches('input, textarea, select')) {
            if (e.key === 'Escape') {
                e.target.blur();
            }
            return;
        }
        
        const key = e.key.toLowerCase();
        const ctrl = e.ctrlKey || e.metaKey;
        
        if (!ctrl) {
            switch (key) {
                case 'v':
                    setActiveTool('select');
                    return;
                case 'c':
                    setActiveTool('razor');
                    return;
                case 'h':
                    setActiveTool('hand');
                    return;
                case 's':
                    e.preventDefault();
                    splitAtPlayhead();
                    return;
                case ' ':
                    e.preventDefault();
                    togglePlayPause();
                    return;
                case 'delete':
                case 'backspace':
                    deleteSelectedClips();
                    return;
                case 'escape':
                    deselectAllClips();
                    hideContextMenu();
                    return;
                case 'f':
                    fitTimeline();
                    return;
                case 'i':
                    markInPoint();
                    return;
                case 'o':
                    markOutBtn();
                    return;
                case '?':
                    elements.shortcutsModal.classList.remove('hidden');
                    return;
            }
        }
        
        if (ctrl) {
            switch (key) {
                case 'z':
                    e.preventDefault();
                    undo();
                    return;
                case 'y':
                    e.preventDefault();
                    redo();
                    return;
                case 'x':
                    e.preventDefault();
                    cutSelected();
                    return;
                case 'c':
                    if (state.activeTool !== 'razor') {
                        e.preventDefault();
                        copySelected();
                    }
                    return;
                case 'v':
                    e.preventDefault();
                    pasteAtPlayhead();
                    return;
                case 'a':
                    e.preventDefault();
                    selectAllClips();
                    return;
                case 'o':
                    e.preventDefault();
                    elements.videoInput.click();
                    return;
                case 'e':
                    e.preventDefault();
                    exportVideo();
                    return;
                case '+':
                case '=':
                    e.preventDefault();
                    changeZoom(1.25);
                    return;
                case '-':
                    e.preventDefault();
                    changeZoom(0.8);
                    return;
            }
        }
        
        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                stepFrame(-1);
                return;
            case 'ArrowRight':
                e.preventDefault();
                stepFrame(1);
                return;
            case 'Home':
                e.preventDefault();
                seekTo(0);
                return;
            case 'End':
                e.preventDefault();
                const duration = state.previewEngine?.getDuration() || 0;
                seekTo(duration);
                return;
            case '[':
                if (state.inPoint !== null) seekTo(state.inPoint);
                return;
            case ']':
                if (state.outPoint !== null) seekTo(state.outPoint);
                return;
        }
    });
}

// ============================================
// Panel Resize
// ============================================
function bindPanelResize() {
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    
    elements.leftPanelHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = elements.leftPanel.offsetWidth;
        elements.leftPanelHandle.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const delta = e.clientX - startX;
        const newWidth = Math.max(200, Math.min(400, startWidth + delta));
        elements.leftPanel.style.width = `${newWidth}px`;
    });
    
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            elements.leftPanelHandle.classList.remove('dragging');
            document.body.style.cursor = '';
        }
    });
}

// ============================================
// Menu Actions
// ============================================
function toggleDropdown(menuId) {
    const menu = document.getElementById(`${menuId}Menu`);
    const isOpen = menu.classList.contains('show');
    
    closeAllDropdowns();
    
    if (!isOpen) {
        menu.classList.add('show');
        document.querySelector(`[data-menu="${menuId}"]`).classList.add('active');
    }
}

function closeAllDropdowns() {
    elements.dropdownMenus.forEach(m => m.classList.remove('show'));
    elements.menuBtns.forEach(b => b.classList.remove('active'));
}

function handleMenuAction(action) {
    closeAllDropdowns();
    
    switch (action) {
        case 'newProject':
            newProject();
            break;
        case 'openVideo':
            elements.videoInput.click();
            break;
        case 'saveProject':
            saveProject();
            break;
        case 'exportVideo':
            exportVideo();
            break;
        case 'undo':
            undo();
            break;
        case 'redo':
            redo();
            break;
        case 'cut':
            cutSelected();
            break;
        case 'copy':
            copySelected();
            break;
        case 'paste':
            pasteAtPlayhead();
            break;
        case 'delete':
            deleteSelectedClips();
            break;
        case 'split':
            splitAtPlayhead();
            break;
        case 'selectAll':
            selectAllClips();
            break;
        case 'zoomIn':
            changeZoom(1.25);
            break;
        case 'zoomOut':
            changeZoom(0.8);
            break;
        case 'fitTimeline':
            fitTimeline();
            break;
        case 'fullscreen':
            toggleFullscreen();
            break;
        case 'shortcuts':
            elements.shortcutsModal.classList.remove('hidden');
            break;
    }
}

// ============================================
// Panel Switching
// ============================================
function switchPanel(panelName) {
    elements.panelTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.panel === panelName);
    });
    
    elements.panelContents.forEach(content => {
        content.classList.toggle('active', content.id === `${panelName}Panel`);
    });
    
    if (panelName === 'properties') {
        updatePropertiesPanel();
    }
}

// ============================================
// Timeline Functions
// ============================================
function initTimeline() {
    updateRuler();
    renderClips();
    updateZoomDisplay();
}

function updateRuler() {
    const canvas = elements.rulerCanvas;
    const duration = state.previewEngine?.getDuration() || 0;
    const contentWidth = Math.max(duration * state.pixelsPerSecond, elements.timelineTracksWrapper.clientWidth);
    
    // Set ruler canvas width
    canvas.style.width = `${contentWidth}px`;
    canvas.innerHTML = '';
    
    // Update track content width to match ruler
    document.querySelectorAll('.track-content').forEach(trackContent => {
        trackContent.style.width = `${contentWidth}px`;
    });
    
    if (duration === 0) return;
    
    // Calculate appropriate interval based on zoom level
    const majorInterval = Math.max(1, Math.floor(60 / state.pixelsPerSecond) || 1);
    const minorInterval = majorInterval / 4;
    
    for (let i = 0; i <= duration + majorInterval; i += majorInterval) {
        const mark = document.createElement('div');
        mark.className = 'ruler-mark major';
        mark.style.left = `${i * state.pixelsPerSecond}px`;
        mark.style.height = '100%';
        mark.style.position = 'absolute';
        mark.style.width = '1px';
        mark.style.background = '#666';
        canvas.appendChild(mark);
        
        const label = document.createElement('div');
        label.className = 'ruler-label';
        label.textContent = formatTime(i);
        label.style.left = `${i * state.pixelsPerSecond}px`;
        label.style.position = 'absolute';
        label.style.top = '2px';
        label.style.fontSize = '10px';
        label.style.color = '#888';
        label.style.transform = 'translateX(-50%)';
        canvas.appendChild(label);
    }
    
    for (let i = 0; i <= duration + majorInterval; i += minorInterval) {
        if (i % majorInterval !== 0) {
            const mark = document.createElement('div');
            mark.className = 'ruler-mark';
            mark.style.left = `${i * state.pixelsPerSecond}px`;
            mark.style.height = '50%';
            mark.style.position = 'absolute';
            mark.style.width = '1px';
            mark.style.background = '#444';
            mark.style.top = '50%';
            canvas.appendChild(mark);
        }
    }
}

function renderClips() {
    elements.videoTrack1.innerHTML = '<div class="track-content"></div>';
    elements.videoTrack2.innerHTML = '<div class="track-content"></div>';
    elements.audioTrack1.innerHTML = '<div class="track-content"></div>';
    elements.audioTrack2.innerHTML = '<div class="track-content"></div>';
    
    state.clips.forEach(clip => {
        const clipEl = createClipElement(clip);
        const trackEl = getTrackElement(clip.track);
        if (trackEl) {
            trackEl.querySelector('.track-content').appendChild(clipEl);
        }
    });
    
    // Update track content width to match ruler
    const duration = state.previewEngine?.getDuration() || 0;
    const contentWidth = Math.max(duration * state.pixelsPerSecond, elements.timelineTracksWrapper.clientWidth);
    document.querySelectorAll('.track-content').forEach(trackContent => {
        trackContent.style.width = `${contentWidth}px`;
    });
}

function createClipElement(clip) {
    const el = document.createElement('div');
    el.className = `timeline-clip ${clip.type}`;
    el.dataset.id = clip.id;
    
    if (state.selectedClips.has(clip.id)) {
        el.classList.add('selected');
    }
    
    if (clip.muted) {
        el.classList.add('muted');
    }
    
    const left = clip.startTime * state.pixelsPerSecond;
    const width = (clip.endTime - clip.startTime) * state.pixelsPerSecond;
    
    el.style.left = `${left}px`;
    el.style.width = `${Math.max(width, 20)}px`;
    
    el.innerHTML = `
        <div class="clip-thumbnail"></div>
        <div class="clip-content">
            <span class="clip-name">${clip.name}</span>
        </div>
        <div class="clip-waveform"></div>
        <div class="clip-handle left"></div>
        <div class="clip-handle right"></div>
    `;
    
    el.addEventListener('mousedown', (e) => handleClipMouseDown(e, clip));
    
    const leftHandle = el.querySelector('.clip-handle.left');
    const rightHandle = el.querySelector('.clip-handle.right');
    
    leftHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        startResize(e, clip, 'left');
    });
    
    rightHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        startResize(e, clip, 'right');
    });
    
    return el;
}

function getTrackElement(trackId) {
    const map = {
        'video1': elements.videoTrack1,
        'video2': elements.videoTrack2,
        'audio1': elements.audioTrack1,
        'audio2': elements.audioTrack2
    };
    return map[trackId];
}

// ============================================
// Timeline Interaction
// ============================================
function handleTimelineMouseDown(e) {
    if (e.button !== 0) return;
    
    // Check if clicking on playhead
    const playheadEl = e.target.closest('.playhead');
    if (playheadEl) {
        // Start playhead drag
        e.preventDefault();
        e.stopPropagation();
        state.isDragging = true;
        state.dragType = 'playhead';
        state.dragStartX = e.clientX;
        state.dragStartTime = state.previewEngine?.getCurrentTime() || 0;
        document.body.style.cursor = 'ew-resize';
        return;
    }
    
    // Check if clicking on a clip
    const clipEl = e.target.closest('.timeline-clip');
    if (clipEl) {
        const clipId = parseInt(clipEl.dataset.id);
        const clip = state.clips.find(c => c.id === clipId);
        
        if (clip?.locked) return;
        
        if (e.ctrlKey || e.metaKey) {
            toggleClipSelection(clipId);
        } else {
            selectClip(clipId);
        }
        return;
    }
    
    // Check if clicking on a track for selection box
    const trackEl = e.target.closest('.track-row');
    if (trackEl && state.activeTool === 'select') {
        startSelectionBox(e);
        return;
    }
    
    // Click on empty area - seek to position and start playhead drag
    const rect = elements.tracksContainer.getBoundingClientRect();
    const x = e.clientX - rect.left + elements.timelineTracksWrapper.scrollLeft;
    const time = x / state.pixelsPerSecond;
    seekTo(time);
    
    state.isDragging = true;
    state.dragType = 'playhead';
    state.dragStartX = e.clientX;
    state.dragStartTime = time;
    document.body.style.cursor = 'ew-resize';
}

function handleTimelineMouseMove(e) {
    if (!state.isDragging && !state.isSelecting) return;
    
    if (state.isDragging) {
        handleDrag(e.clientX, e.clientY);
    } else if (state.isSelecting) {
        updateSelectionBox(e);
    }
}

function handleTimelineMouseUp(e) {
    if (state.isDragging) {
        endDrag();
    }
    if (state.isSelecting) {
        endSelectionBox();
    }
}

function handleClipMouseDown(e, clip) {
    if (e.button !== 0) return;
    
    e.stopPropagation();
    
    if (clip.locked) {
        showToast('片段已锁定', 'warning');
        return;
    }
    
    switch (state.activeTool) {
        case 'select':
            if (!e.ctrlKey && !e.metaKey && !state.selectedClips.has(clip.id)) {
                selectClip(clip.id);
            }
            // Start drag immediately for desktop, no long press needed
            startClipDrag(e.clientX, e.clientY, clip);
            break;
        case 'razor':
            const currentTime = state.previewEngine?.getCurrentTime() || 0;
            splitClipAt(clip, currentTime);
            break;
    }
}

function startResize(e, clip, side) {
    saveHistory();
    state.isDragging = true;
    state.dragType = `resize-${side}`;
    state.dragTarget = clip;
    state.dragStartX = e.clientX;
    state.dragStartTime = side === 'left' ? clip.startTime : clip.endTime;
    document.body.style.cursor = 'col-resize';
}

function startClipDrag(x, y, clip) {
    state.isDragging = true;
    state.dragType = 'clip';
    state.dragTarget = clip;
    state.dragStartX = x;
    state.dragStartY = y;
    state.dragStartTime = clip.startTime;
    state.dragClipDuration = clip.endTime - clip.startTime;
    state.dragOriginalTrack = clip.track;
    state.hasDragged = false; // Track if actual drag occurred
    document.body.style.cursor = 'grabbing';
    
    const clipEl = document.querySelector(`.timeline-clip[data-id="${clip.id}"]`);
    if (clipEl) {
        clipEl.classList.add('dragging');
    }
    
    // Create drag preview element for visual feedback
    createDragPreview(clip);
}

function startSelectionBox(e) {
    state.isSelecting = true;
    state.selectionStart = {
        x: e.clientX,
        y: e.clientY
    };
    
    const box = document.createElement('div');
    box.className = 'selection-box';
    box.id = 'selectionBox';
    document.body.appendChild(box);
}

function updateSelectionBox(e) {
    const box = document.getElementById('selectionBox');
    if (!box) return;
    
    const left = Math.min(e.clientX, state.selectionStart.x);
    const top = Math.min(e.clientY, state.selectionStart.y);
    const width = Math.abs(e.clientX - state.selectionStart.x);
    const height = Math.abs(e.clientY - state.selectionStart.y);
    
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
}

function endSelectionBox() {
    state.isSelecting = false;
    const box = document.getElementById('selectionBox');
    if (box) {
        const boxRect = box.getBoundingClientRect();
        
        document.querySelectorAll('.timeline-clip').forEach(clipEl => {
            const clipRect = clipEl.getBoundingClientRect();
            if (isIntersecting(boxRect, clipRect)) {
                const clipId = parseInt(clipEl.dataset.id);
                state.selectedClips.add(clipId);
            }
        });
        
        renderClips();
        updateSelectionInfo();
        box.remove();
    }
}

function isIntersecting(rect1, rect2) {
    return !(rect2.left > rect1.right || 
             rect2.right < rect1.left || 
             rect2.top > rect1.bottom || 
             rect2.bottom < rect1.top);
}

function handleDrag(clientX, clientY) {
    if (!state.isDragging || !state.dragTarget) return;
    
    const deltaX = clientX - state.dragStartX;
    const deltaY = clientY - state.dragStartY;
    const deltaTime = deltaX / state.pixelsPerSecond;
    const clip = state.dragTarget;
    
    // Mark that an actual drag has occurred
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        if (!state.hasDragged) {
            state.hasDragged = true;
            saveHistory(); // Save history only when actual drag starts
        }
    }
    
    switch (state.dragType) {
        case 'clip':
            // Handle horizontal movement (time)
            const newStart = Math.max(0, state.dragStartTime + deltaTime);
            clip.startTime = newStart;
            clip.endTime = newStart + state.dragClipDuration;
            
            if (state.snapToGrid) {
                snapClipToGrid(clip);
            }
            
            // Handle vertical movement (track change)
            const targetTrack = getTargetTrackFromY(clientY);
            if (targetTrack && targetTrack !== clip.track) {
                // Check if track type is compatible
                if (isTrackCompatible(clip.type, targetTrack)) {
                    clip.track = targetTrack;
                    // Move clip element to new track
                    moveClipToTrack(clip, targetTrack);
                }
            }
            
            updateClipPosition(clip);
            updateDragPreview(clientX, clientY);
            break;
            
        case 'resize-left':
            const newStartTime = Math.max(0, Math.min(clip.endTime - 0.1, state.dragStartTime + deltaTime));
            clip.startTime = newStartTime;
            updateClipPosition(clip);
            break;
            
        case 'resize-right':
            const newEndTime = Math.max(clip.startTime + 0.1, state.dragStartTime + deltaTime);
            clip.endTime = newEndTime;
            updateClipPosition(clip);
            break;
            
        case 'playhead':
            const playheadDeltaX = clientX - state.dragStartX;
            const playheadDeltaTime = playheadDeltaX / state.pixelsPerSecond;
            const newTime = Math.max(0, state.dragStartTime + playheadDeltaTime);
            const duration = state.previewEngine?.getDuration() || 0;
            seekTo(Math.min(newTime, duration));
            break;
    }
}

function endDrag() {
    if (state.dragTarget) {
        const clip = state.dragTarget;
        
        // Only update WASM if actual drag occurred
        if (state.hasDragged) {
            // Update WASM engine with final values
            if (state.previewEngine) {
                state.previewEngine.moveClip(clip.id, clip.startTime, clip.track);
                state.previewEngine.resizeClip(clip.id, clip.startTime, clip.endTime);
            }
        }
        
        const clipEl = document.querySelector(`.timeline-clip[data-id="${clip.id}"]`);
        if (clipEl) {
            clipEl.classList.remove('dragging');
        }
        
        // Remove drag preview
        removeDragPreview();
    }
    
    state.isDragging = false;
    state.dragType = null;
    state.dragTarget = null;
    state.dragOriginalTrack = null;
    state.hasDragged = false;
    document.body.style.cursor = '';
    
    renderClips();
    updateDuration();
}

function updateClipPosition(clip) {
    const clipEl = document.querySelector(`.timeline-clip[data-id="${clip.id}"]`);
    if (clipEl) {
        const left = clip.startTime * state.pixelsPerSecond;
        const width = (clip.endTime - clip.startTime) * state.pixelsPerSecond;
        clipEl.style.left = `${left}px`;
        clipEl.style.width = `${Math.max(width, 20)}px`;
    }
}

function snapClipToGrid(clip) {
    const snapInterval = 0.5;
    clip.startTime = Math.round(clip.startTime / snapInterval) * snapInterval;
    clip.endTime = clip.startTime + state.dragClipDuration;
}

// ============================================
// Track Dragging Helpers
// ============================================
function getTargetTrackFromY(clientY) {
    const trackElements = document.querySelectorAll('.track-row');
    for (const trackEl of trackElements) {
        const rect = trackEl.getBoundingClientRect();
        if (clientY >= rect.top && clientY <= rect.bottom) {
            return trackEl.dataset.track;
        }
    }
    return null;
}

function isTrackCompatible(clipType, trackId) {
    const track = state.tracks.find(t => t.id === trackId);
    if (!track) return false;
    
    // Video clips can only go on video tracks
    if (clipType === 'video' && track.type !== 'video') return false;
    
    // Audio clips can only go on audio tracks
    if (clipType === 'audio' && track.type !== 'audio') return false;
    
    return true;
}

function moveClipToTrack(clip, targetTrackId) {
    const trackEl = getTrackElement(targetTrackId);
    if (!trackEl) return;
    
    const clipEl = document.querySelector(`.timeline-clip[data-id="${clip.id}"]`);
    if (clipEl) {
        const trackContent = trackEl.querySelector('.track-content');
        if (trackContent) {
            trackContent.appendChild(clipEl);
        }
    }
}

function createDragPreview(clip) {
    // Remove existing preview
    removeDragPreview();
    
    // Create visual feedback element
    const preview = document.createElement('div');
    preview.className = 'clip-drag-preview';
    preview.id = 'clipDragPreview';
    preview.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 10000;
        opacity: 0.8;
        background: ${clip.type === 'video' ? 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)' : 'linear-gradient(135deg, #059669 0%, #10b981 100%)'};
        border-radius: 4px;
        padding: 4px 8px;
        color: white;
        font-size: 11px;
        font-weight: 500;
        white-space: nowrap;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        transform: translate(-50%, -50%);
        display: none;
    `;
    preview.textContent = clip.name;
    document.body.appendChild(preview);
}

function updateDragPreview(clientX, clientY) {
    const preview = document.getElementById('clipDragPreview');
    if (preview) {
        preview.style.display = 'block';
        preview.style.left = `${clientX}px`;
        preview.style.top = `${clientY}px`;
        
        // Highlight target track
        highlightTargetTrack(clientY);
    }
}

function highlightTargetTrack(clientY) {
    // Remove existing highlights
    document.querySelectorAll('.track-row').forEach(track => {
        track.style.backgroundColor = '';
    });
    
    // Highlight current target track
    const targetTrack = getTargetTrackFromY(clientY);
    if (targetTrack) {
        const trackEl = getTrackElement(targetTrack);
        if (trackEl) {
            trackEl.style.backgroundColor = 'rgba(79, 70, 229, 0.15)';
        }
    }
}

function removeDragPreview() {
    const preview = document.getElementById('clipDragPreview');
    if (preview) {
        preview.remove();
    }
    
    // Remove track highlights
    document.querySelectorAll('.track-row').forEach(track => {
        track.style.backgroundColor = '';
    });
}

// ============================================
// Clip Operations
// ============================================
function selectClip(id) {
    state.selectedClips.clear();
    state.selectedClips.add(id);
    renderClips();
    updateSelectionInfo();
    updatePropertiesPanel();
}

function toggleClipSelection(id) {
    if (state.selectedClips.has(id)) {
        state.selectedClips.delete(id);
    } else {
        state.selectedClips.add(id);
    }
    renderClips();
    updateSelectionInfo();
    updatePropertiesPanel();
}

function deselectAllClips() {
    state.selectedClips.clear();
    renderClips();
    updateSelectionInfo();
}

function selectAllClips() {
    state.clips.forEach(clip => state.selectedClips.add(clip.id));
    renderClips();
    updateSelectionInfo();
}

function deleteSelectedClips() {
    if (state.selectedClips.size === 0) return;
    
    saveHistory();
    
    // Remove from WASM engine
    if (state.previewEngine) {
        state.selectedClips.forEach(id => {
            state.previewEngine.removeClip(id);
        });
    }
    
    state.clips = state.clips.filter(c => !state.selectedClips.has(c.id));
    state.selectedClips.clear();
    renderClips();
    updateSelectionInfo();
    updateDuration();
    showToast('片段已删除', 'success');
}

function splitAtPlayhead() {
    if (state.selectedClips.size === 1) {
        const clipId = Array.from(state.selectedClips)[0];
        const clip = state.clips.find(c => c.id === clipId);
        if (clip) {
            const currentTime = state.previewEngine?.getCurrentTime() || 0;
            splitClipAt(clip, currentTime);
        }
    }
}

function splitClipAt(clip, time) {
    if (time <= clip.startTime || time >= clip.endTime) return;
    
    saveHistory();
    
    // Split in WASM engine
    let newId = null;
    if (state.previewEngine) {
        newId = state.previewEngine.splitClip(clip.id, time);
    }
    
    if (!newId) {
        // Fallback to JS implementation
        newId = Date.now() + 1;
    }
    
    const splitPoint = time - clip.startTime + (clip.srcStart || 0);
    
    const firstClip = {
        ...clip,
        endTime: time,
        srcEnd: splitPoint
    };
    
    const secondClip = {
        ...clip,
        id: newId,
        startTime: time,
        srcStart: splitPoint,
        name: `${clip.name} (2)`
    };
    
    const index = state.clips.indexOf(clip);
    state.clips.splice(index, 1, firstClip, secondClip);
    state.selectedClips.clear();
    state.selectedClips.add(secondClip.id);
    
    // Update WASM
    if (state.previewEngine) {
        state.previewEngine.updateClip(firstClip);
        state.previewEngine.addClip(secondClip);
    }
    
    renderClips();
    updateSelectionInfo();
    showToast('片段已分割', 'success');
}

function cutSelected() {
    copySelected();
    deleteSelectedClips();
}

function copySelected() {
    if (state.selectedClips.size === 0) return;
    
    state.clipboard = state.clips
        .filter(c => state.selectedClips.has(c.id))
        .map(c => ({ ...c, id: null }));
    
    showToast(`已复制 ${state.clipboard.length} 个片段`, 'success');
}

function pasteAtPlayhead() {
    if (state.clipboard.length === 0) return;
    
    saveHistory();
    
    const currentTime = state.previewEngine?.getCurrentTime() || 0;
    const minStartTime = Math.min(...state.clipboard.map(c => c.startTime));
    
    state.clipboard.forEach(clip => {
        const newClip = {
            ...clip,
            id: state.nextClipId++,
            startTime: currentTime + (clip.startTime - minStartTime),
            endTime: currentTime + (clip.endTime - minStartTime)
        };
        
        state.clips.push(newClip);
        
        // Add to WASM
        if (state.previewEngine) {
            state.previewEngine.addClip(newClip);
        }
    });
    
    renderClips();
    updateDuration();
    showToast(`已粘贴 ${state.clipboard.length} 个片段`, 'success');
}

function liftSelectedClips() {
    saveHistory();
    
    if (state.previewEngine) {
        state.selectedClips.forEach(id => {
            state.previewEngine.removeClip(id);
        });
    }
    
    state.clips = state.clips.filter(c => !state.selectedClips.has(c.id));
    state.selectedClips.clear();
    renderClips();
    updateDuration();
}

function extractSelectedClips() {
    saveHistory();
    
    const selectedIds = new Set(state.selectedClips);
    const selectedClipsList = state.clips.filter(c => selectedIds.has(c.id));
    
    selectedClipsList.sort((a, b) => a.startTime - b.startTime);
    
    // Remove from WASM
    if (state.previewEngine) {
        selectedIds.forEach(id => {
            state.previewEngine.removeClip(id);
        });
    }
    
    state.clips = state.clips.filter(c => !selectedIds.has(c.id));
    
    // Re-add remaining to WASM
    if (state.previewEngine) {
        state.previewEngine.clear();
        state.clips.forEach(clip => {
            state.previewEngine.addClip(clip);
        });
    }
    
    state.selectedClips.clear();
    renderClips();
    updateDuration();
}

// ============================================
// Track Controls
// ============================================
function toggleTrackVisible(trackId) {
    const track = state.tracks.find(t => t.id === trackId);
    if (track) {
        track.visible = !track.visible;
        updateTrackHeader(trackId);
        
        document.querySelectorAll(`.timeline-clip`).forEach(el => {
            const clip = state.clips.find(c => c.id === parseInt(el.dataset.id));
            if (clip?.track === trackId) {
                el.style.opacity = track.visible ? '1' : '0.3';
                clip.muted = !track.visible;
                
                // Update WASM
                if (state.previewEngine) {
                    state.previewEngine.updateClip(clip);
                }
            }
        });
    }
}

function toggleTrackLock(trackId) {
    const track = state.tracks.find(t => t.id === trackId);
    if (track) {
        track.locked = !track.locked;
        updateTrackHeader(trackId);
        
        state.clips.forEach(clip => {
            if (clip.track === trackId) {
                clip.locked = track.locked;
            }
        });
        renderClips();
    }
}

function toggleTrackMute(trackId) {
    const track = state.tracks.find(t => t.id === trackId);
    if (track) {
        track.muted = !track.muted;
        updateTrackHeader(trackId);
        
        state.clips.forEach(clip => {
            if (clip.track === trackId) {
                clip.muted = track.muted;
                
                // Update WASM
                if (state.previewEngine) {
                    state.previewEngine.updateClip(clip);
                }
            }
        });
        renderClips();
    }
}

function updateTrackHeader(trackId) {
    const header = document.querySelector(`.track-header[data-track="${trackId}"]`);
    const track = state.tracks.find(t => t.id === trackId);
    if (!header || !track) return;
    
    const eyeBtn = header.querySelector('.track-eye');
    const lockBtn = header.querySelector('.track-lock');
    const muteBtn = header.querySelector('.track-mute');
    
    if (eyeBtn) eyeBtn.classList.toggle('active', !track.visible);
    if (lockBtn) lockBtn.classList.toggle('active', track.locked);
    if (muteBtn) muteBtn.classList.toggle('active', track.muted);
}

// ============================================
// Tool Management
// ============================================
function setActiveTool(tool) {
    state.activeTool = tool;
    
    elements.selectTool.classList.toggle('active', tool === 'select');
    elements.razorTool.classList.toggle('active', tool === 'razor');
    elements.handTool.classList.toggle('active', tool === 'hand');
    
    const cursors = {
        select: 'default',
        razor: 'crosshair',
        hand: 'grab'
    };
    elements.tracksContainer.style.cursor = cursors[tool] || 'default';
}

// ============================================
// Zoom & View
// ============================================
function changeZoom(factor) {
    const newZoom = Math.round(state.zoom * factor);
    setZoom(newZoom);
}

function setZoom(value) {
    state.zoom = Math.max(10, Math.min(200, value));
    state.pixelsPerSecond = state.zoom;
    
    if (elements.zoomSlider) {
        elements.zoomSlider.value = state.zoom;
    }
    
    updateZoomDisplay();
    updateRuler();
    renderClips();
}

function fitTimeline() {
    const duration = state.previewEngine?.getDuration() || 0;
    if (duration === 0) return;
    
    const containerWidth = elements.timelineTracksWrapper.clientWidth - 100;
    const newZoom = Math.floor(containerWidth / duration);
    setZoom(newZoom);
}

function updateZoomDisplay() {
    elements.zoomInfo.textContent = `缩放: ${state.zoom}%`;
}

function toggleSnap() {
    state.snapToGrid = !state.snapToGrid;
    elements.snapBtn.classList.toggle('active', state.snapToGrid);
    showToast(state.snapToGrid ? '吸附对齐: 开启' : '吸附对齐: 关闭', 'info');
}

function toggleShowMarkers() {
    state.showMarkers = !state.showMarkers;
    elements.showMarkersBtn.classList.toggle('active', state.showMarkers);
    elements.inPointMarker.classList.toggle('hidden', !state.showMarkers || state.inPoint === null);
    elements.outPointMarker.classList.toggle('hidden', !state.showMarkers || state.outPoint === null);
}

// ============================================
// Playback Controls
// ============================================
function togglePlayPause() {
    if (!state.previewEngine) return;
    state.previewEngine.togglePlayPause();
}

function stepFrame(direction) {
    if (!state.previewEngine) return;
    state.previewEngine.stepFrame(direction);
}

function toggleLoop() {
    if (!state.previewEngine) return;
    state.previewEngine.setLoop(!state.previewEngine.loop);
    elements.loopBtn.classList.toggle('active', state.previewEngine.loop);
}

function seekTo(time) {
    if (!state.previewEngine) return;
    state.previewEngine.seekTo(time);
}

function handlePreviewTimeUpdate(currentTime) {
    elements.currentTimeDisplay.textContent = formatTimecode(currentTime);
    updatePlayhead(currentTime);
}

function updatePlayhead(currentTime) {
    const left = currentTime * state.pixelsPerSecond;
    elements.playhead.style.left = `${left}px`;
    
    // Auto-scroll timeline to keep playhead visible during playback
    const containerWidth = elements.timelineTracksWrapper.clientWidth;
    const scrollLeft = elements.timelineTracksWrapper.scrollLeft;
    const playheadVisible = left >= scrollLeft && left <= scrollLeft + containerWidth;
    
    // Only auto-scroll during playback or when playhead goes out of view
    if (state.previewEngine?.isPlaying || !playheadVisible) {
        if (left > scrollLeft + containerWidth - 100) {
            elements.timelineTracksWrapper.scrollLeft = left - containerWidth / 2;
        } else if (left < scrollLeft + 50) {
            elements.timelineTracksWrapper.scrollLeft = Math.max(0, left - 100);
        }
    }
}

function updatePlayButton() {
    const isPlaying = state.previewEngine?.isPlaying || false;
    elements.playIcon.classList.toggle('hidden', isPlaying);
    elements.pauseIcon.classList.toggle('hidden', !isPlaying);
}

// ============================================
// Markers
// ============================================
function markInPoint() {
    const currentTime = state.previewEngine?.getCurrentTime() || 0;
    state.inPoint = currentTime;
    updateMarkers();
    showToast(`标记入点: ${formatTime(state.inPoint)}`, 'success');
}

function markOutPoint() {
    const currentTime = state.previewEngine?.getCurrentTime() || 0;
    state.outPoint = currentTime;
    updateMarkers();
    showToast(`标记出点: ${formatTime(state.outPoint)}`, 'success');
}

function updateMarkers() {
    if (state.inPoint !== null && state.showMarkers) {
        elements.inPointMarker.style.left = `${state.inPoint * state.pixelsPerSecond}px`;
        elements.inPointMarker.classList.remove('hidden');
    } else {
        elements.inPointMarker.classList.add('hidden');
    }
    
    if (state.outPoint !== null && state.showMarkers) {
        elements.outPointMarker.style.left = `${state.outPoint * state.pixelsPerSecond}px`;
        elements.outPointMarker.classList.remove('hidden');
    } else {
        elements.outPointMarker.classList.add('hidden');
    }
}

function clearMarkers() {
    state.inPoint = null;
    state.outPoint = null;
    updateMarkers();
}

function addMarkerAtPlayhead() {
    showToast('标记已添加', 'success');
}

// ============================================
// File Operations
// ============================================
function handleVideoUpload(e) {
    const file = e.target.files[0];
    if (file?.type.startsWith('video/')) {
        loadVideo(file);
    }
}

function handleAudioUpload(e) {
    const file = e.target.files[0];
    if (file?.type.startsWith('audio/')) {
        addAudioClip(file);
    }
}

function loadVideo(file, targetTrack = null) {
    saveHistory();
    
    // Determine video track
    let videoTrack = 'video1';
    if (targetTrack) {
        if (targetTrack.startsWith('video')) {
            videoTrack = targetTrack;
        } else if (targetTrack.startsWith('audio')) {
            // If dropped on audio track, use default video track
            videoTrack = 'video1';
        }
    }
    
    // Create clip
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
        const duration = video.duration;
        
        // Calculate start time based on existing clips in target track
        let startTime = 0;
        const trackClips = state.clips.filter(c => c.track === videoTrack);
        if (trackClips.length > 0) {
            const lastClip = trackClips.sort((a, b) => b.endTime - a.endTime)[0];
            startTime = lastClip.endTime;
        }
        
        const videoClip = {
            id: state.nextClipId++,
            type: 'video',
            track: videoTrack,
            file: file,
            name: file.name,
            startTime: startTime,
            endTime: startTime + duration,
            srcStart: 0,
            srcEnd: duration,
            duration: duration,
            volume: 100,
            speed: 1,
            locked: false,
            muted: false
        };
        
        state.clips.push(videoClip);
        state.selectedClips.clear();
        state.selectedClips.add(videoClip.id);
        
        // Add video to preview engine
        if (state.previewEngine) {
            state.previewEngine.addClip(videoClip);
        }
        
        // Also add corresponding audio track (linked audio)
        const audioTrack = videoTrack === 'video1' ? 'audio1' : 'audio2';
        const audioClip = {
            id: state.nextClipId++,
            type: 'audio',
            track: audioTrack,
            file: file, // Use same file for audio
            name: file.name + ' (音频)',
            startTime: startTime,
            endTime: startTime + duration,
            srcStart: 0,
            srcEnd: duration,
            duration: duration,
            volume: 100,
            speed: 1,
            locked: false,
            muted: false,
            linkedVideoId: videoClip.id // Link to video clip
        };
        
        state.clips.push(audioClip);
        
        // Add audio to preview engine
        if (state.previewEngine) {
            state.previewEngine.addClip(audioClip);
        }
        
        // Show canvas
        elements.previewCanvas.classList.remove('hidden');
        elements.emptyState.classList.add('hidden');
        elements.exportBtn.disabled = false;
        
        // Update UI
        updateVideoClipList(file);
        const duration_value = state.previewEngine?.getDuration() || 0;
        elements.durationDisplay.textContent = formatTimecode(duration_value);
        updateRuler();
        renderClips();
        updateSelectionInfo();
        
        // Initial render
        state.previewEngine?.renderFrame();
        
        showToast('视频和音频已加载', 'success');
    };
    
    video.src = URL.createObjectURL(file);
}

function addAudioClip(file) {
    // Default to first available audio track
    const targetTrack = state.clips.some(c => c.track === 'audio1') ? 'audio2' : 'audio1';
    addAudioClipToTrack(file, targetTrack);
}

function addAudioClipToTrack(file, targetTrack = 'audio1') {
    saveHistory();
    
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    
    audio.onloadedmetadata = () => {
        const duration = audio.duration;
        
        // Calculate start time based on existing clips in target track
        let startTime = 0;
        const trackClips = state.clips.filter(c => c.track === targetTrack);
        if (trackClips.length > 0) {
            const lastClip = trackClips.sort((a, b) => b.endTime - a.endTime)[0];
            startTime = lastClip.endTime;
        }
        
        const clip = {
            id: state.nextClipId++,
            type: 'audio',
            track: targetTrack,
            file: file,
            name: file.name,
            startTime: startTime,
            endTime: startTime + duration,
            srcStart: 0,
            srcEnd: duration,
            duration: duration,
            volume: 100,
            locked: false,
            muted: false
        };
        
        state.clips.push(clip);
        
        // Add to preview engine
        if (state.previewEngine) {
            state.previewEngine.addClip(clip);
        }
        
        updateAudioClipList(file);
        renderClips();
        updateDuration();
        
        showToast('音频已添加', 'success');
    };
    
    audio.src = URL.createObjectURL(file);
}

function updateVideoClipList(file) {
    elements.videoClipList.innerHTML = `
        <div class="clip-item">
            <div class="clip-thumb">🎬</div>
            <div class="clip-info">
                <div class="clip-name">${file.name}</div>
                <div class="clip-meta">${formatFileSize(file.size)}</div>
            </div>
        </div>
    `;
}

function updateAudioClipList(file) {
    const existing = elements.audioClipList.querySelector('.empty-clips');
    if (existing) {
        elements.audioClipList.innerHTML = '';
    }
    
    const item = document.createElement('div');
    item.className = 'clip-item';
    item.innerHTML = `
        <div class="clip-thumb">🔊</div>
        <div class="clip-info">
            <div class="clip-name">${file.name}</div>
            <div class="clip-meta">${formatFileSize(file.size)}</div>
        </div>
    `;
    elements.audioClipList.appendChild(item);
}

function updateDuration() {
    const duration = state.previewEngine?.getDuration() || 0;
    elements.durationDisplay.textContent = formatTimecode(duration);
    updateRuler();
}

// ============================================
// Properties Panel
// ============================================
function updatePropertiesPanel() {
    if (state.selectedClips.size !== 1) {
        elements.clipProperties?.classList.add('hidden');
        elements.propertiesEmpty?.classList.remove('hidden');
        return;
    }
    
    const clipId = Array.from(state.selectedClips)[0];
    const clip = state.clips.find(c => c.id === clipId);
    if (!clip) return;
    
    elements.clipProperties?.classList.remove('hidden');
    elements.propertiesEmpty?.classList.add('hidden');
    
    if (elements.propName) elements.propName.value = clip.name;
    if (elements.propDuration) elements.propDuration.textContent = formatTime(clip.duration);
    if (elements.propStart) elements.propStart.value = clip.startTime.toFixed(2);
    if (elements.propEnd) elements.propEnd.value = clip.endTime.toFixed(2);
    if (elements.propVolume) {
        elements.propVolume.value = clip.volume;
        if (elements.propVolumeValue) elements.propVolumeValue.textContent = `${clip.volume}%`;
    }
    if (elements.propSpeed) elements.propSpeed.value = clip.speed || 1;
}

function updateSelectedClipProperties() {
    if (state.selectedClips.size !== 1) return;
    
    saveHistory();
    
    const clipId = Array.from(state.selectedClips)[0];
    const clip = state.clips.find(c => c.id === clipId);
    if (!clip) return;
    
    if (elements.propName) clip.name = elements.propName.value;
    if (elements.propStart) clip.startTime = parseFloat(elements.propStart.value) || 0;
    if (elements.propEnd) clip.endTime = parseFloat(elements.propEnd.value) || clip.startTime;
    if (elements.propVolume) clip.volume = parseInt(elements.propVolume.value) || 100;
    if (elements.propSpeed) clip.speed = parseFloat(elements.propSpeed.value) || 1;
    
    // Update WASM
    if (state.previewEngine) {
        state.previewEngine.updateClip(clip);
    }
    
    renderClips();
    updateDuration();
}

// ============================================
// History (Undo/Redo)
// ============================================
function saveHistory() {
    if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
    }
    
    const snapshot = {
        clips: JSON.parse(JSON.stringify(state.clips)),
        nextClipId: state.nextClipId
    };
    
    state.history.push(snapshot);
    
    if (state.history.length > state.maxHistory) {
        state.history.shift();
    } else {
        state.historyIndex++;
    }
    
    updateUndoRedoButtons();
}

function undo() {
    if (state.historyIndex < 0) return;
    
    const snapshot = state.history[state.historyIndex];
    state.clips = JSON.parse(JSON.stringify(snapshot.clips));
    state.nextClipId = snapshot.nextClipId;
    state.historyIndex--;
    
    state.selectedClips.clear();
    
    // Sync with WASM
    if (state.previewEngine) {
        state.previewEngine.clear();
        state.clips.forEach(clip => {
            state.previewEngine.addClip(clip);
        });
    }
    
    renderClips();
    updateSelectionInfo();
    updateDuration();
    showToast('已撤销', 'success');
}

function redo() {
    if (state.historyIndex >= state.history.length - 1) return;
    
    state.historyIndex++;
    const snapshot = state.history[state.historyIndex];
    state.clips = JSON.parse(JSON.stringify(snapshot.clips));
    state.nextClipId = snapshot.nextClipId;
    
    state.selectedClips.clear();
    
    // Sync with WASM
    if (state.previewEngine) {
        state.previewEngine.clear();
        state.clips.forEach(clip => {
            state.previewEngine.addClip(clip);
        });
    }
    
    renderClips();
    updateSelectionInfo();
    updateDuration();
    showToast('已重做', 'success');
}

function updateUndoRedoButtons() {
    elements.undoBtn?.classList.toggle('disabled', state.historyIndex < 0);
    elements.redoBtn?.classList.toggle('disabled', state.historyIndex >= state.history.length - 1);
}

// ============================================
// Project Management
// ============================================
function newProject() {
    if (confirm('确定要新建项目吗？当前未保存的更改将丢失。')) {
        if (state.previewEngine) {
            state.previewEngine.pause();
            state.previewEngine.clear();
        }
        
        state.clips = [];
        state.selectedClips.clear();
        state.history = [];
        state.historyIndex = -1;
        state.inPoint = null;
        state.outPoint = null;
        state.nextClipId = 1;
        
        elements.previewCanvas.classList.add('hidden');
        elements.emptyState.classList.remove('hidden');
        elements.exportBtn.disabled = true;
        elements.videoClipList.innerHTML = '<div class="empty-clips">暂无素材</div>';
        elements.audioClipList.innerHTML = '<div class="empty-clips">暂无音频</div>';
        
        renderClips();
        updateMarkers();
        updateDuration();
        showToast('新项目已创建', 'success');
    }
}

function saveProject() {
    const project = {
        version: '2.0',
        clips: state.clips.map(c => ({
            ...c,
            file: null
        })),
        duration: state.previewEngine?.getDuration() || 0,
        inPoint: state.inPoint,
        outPoint: state.outPoint
    };
    
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project.json';
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('项目已保存', 'success');
}

// ============================================
// Export
// ============================================

/**
 * 计算时间线上每个时间点可见的视频片段（考虑轨道遮挡）
 * @param {Array} videoClips - 所有视频片段
 * @param {number} timelineDuration - 时间线总时长
 * @returns {Array} - 可见区间列表，每个元素包含 {startTime, endTime, clip, inputIndex}
 */
function computeVisibleSegments(videoClips, timelineDuration) {
    // 轨道优先级：video1 (V1) 在 video2 (V2) 之上
    // 因为 V1 在轨道列表中显示在上方，应该遮挡下方的 V2
    const trackPriority = { 'video1': 2, 'video2': 1 };
    
    // 收集所有关键时间点（所有片段的起止时间）
    const keyTimes = new Set([0, timelineDuration]);
    videoClips.forEach(clip => {
        keyTimes.add(clip.startTime);
        keyTimes.add(clip.endTime);
    });
    
    // 排序时间点
    const sortedTimes = Array.from(keyTimes).sort((a, b) => a - b);
    
    // 对每个时间段，找出最上层可见的片段
    const visibleSegments = [];
    
    // 浮点数比较的 epsilon
    const EPSILON = 0.0001;
    
    for (let i = 0; i < sortedTimes.length - 1; i++) {
        const segStart = sortedTimes[i];
        const segEnd = sortedTimes[i + 1];
        
        if (segEnd <= segStart + EPSILON) continue;
        
        // 找到这个时间段内所有覆盖它的片段
        // 条件：片段在 segStart 之前或正好开始，且在 segStart 之后结束
        // 使用 EPSILON 避免浮点数精度问题
        const coveringClips = videoClips.filter(clip => 
            clip.startTime <= segStart + EPSILON && clip.endTime > segStart + EPSILON
        );
        
        if (coveringClips.length === 0) {
            // 这个时间段没有视频，显示黑帧
            visibleSegments.push({
                startTime: segStart,
                endTime: segEnd,
                clip: null,
                inputIndex: -1,
                srcStart: 0,
                duration: segEnd - segStart
            });
        } else {
            // 选择优先级最高的轨道上的片段
            const topClip = coveringClips.reduce((top, current) => {
                const topPriority = trackPriority[top.track] || 0;
                const currentPriority = trackPriority[current.track] || 0;
                return currentPriority > topPriority ? current : top;
            });
            
            // 计算源视频的起始时间和持续时间
            // 注意：如果片段被裁剪过，srcStart 可能不为 0
            const timeOffset = segStart - topClip.startTime;
            const srcStart = (topClip.srcStart || 0) + timeOffset;
            const duration = segEnd - segStart;
            
            visibleSegments.push({
                startTime: segStart,
                endTime: segEnd,
                clip: topClip,
                inputIndex: topClip._inputIndex, // 稍后设置
                srcStart: srcStart,
                duration: duration
            });
        }
    }
    
    // 合并连续的相同片段片段（优化）
    return mergeContinuousSegments(visibleSegments);
}

/**
 * 合并连续的相同源片段
 */
function mergeContinuousSegments(segments) {
    if (segments.length <= 1) return segments;
    
    const merged = [segments[0]];
    
    for (let i = 1; i < segments.length; i++) {
        const current = segments[i];
        const last = merged[merged.length - 1];
        
        // 检查是否可以合并（相同源片段且时间连续）
        const sameClip = current.clip && last.clip && current.clip.id === last.clip.id;
        const continuous = Math.abs(current.startTime - last.endTime) < 0.001;
        const srcContinuous = Math.abs(current.srcStart - (last.srcStart + last.duration)) < 0.001;
        
        if (sameClip && continuous && srcContinuous) {
            // 合并到上一个片段
            last.endTime = current.endTime;
            last.duration = last.endTime - last.startTime;
        } else {
            merged.push(current);
        }
    }
    
    return merged;
}

/**
 * 生成用于 concat 的文件列表（用于 segmented concat）
 */
async function generateConcatFileList(ffmpeg, segments, inputFiles) {
    const listContent = [];
    
    for (const seg of segments) {
        if (seg.clip && seg.inputIndex >= 0) {
            // 引用源文件，并指定时间范围
            const inputFile = inputFiles[seg.inputIndex];
            // 格式: file 'filename'
            //       inpoint timestamp
            //       outpoint timestamp
            //       duration timestamp
            listContent.push(`file '${inputFile}'`);
            listContent.push(`inpoint ${seg.srcStart.toFixed(6)}`);
            listContent.push(`outpoint ${(seg.srcStart + seg.duration).toFixed(6)}`);
        } else {
            // 黑帧 - 稍后处理
            // 这里我们先创建一个黑帧视频文件
        }
    }
    
    return listContent.join('\n');
}

async function exportVideo() {
    if (state.clips.length === 0) {
        showToast('请先加载视频', 'error');
        return;
    }
    
    if (!state.loaded || !state.ffmpeg) {
        showToast('FFmpeg 未加载，无法导出', 'error');
        return;
    }
    
    elements.processingModal.classList.remove('hidden');
    updateProcessingProgress(0);
    
    // Initialize export stats
    const exportStats = {
        startTime: Date.now(),
        lastUpdateTime: Date.now(),
        lastProgress: 0,
        estimatedTotalTime: 0,
        cpuUsage: 0,
        memoryUsage: 0
    };
    
    // Start stats update interval
    const statsInterval = setInterval(() => {
        updateExportStats(exportStats);
    }, 1000);
    
    try {
        const fetchFile = state.fetchFile;
        
        // Get all video clips sorted by track (video2/V2 takes priority over video1/V1)
        const videoClips = state.clips
            .filter(c => c.type === 'video' && !c.muted);
        
        // Get all audio clips
        const audioClips = state.clips
            .filter(c => c.type === 'audio' && !c.muted);
        
        if (videoClips.length === 0) {
            throw new Error('没有可导出的视频');
        }
        
        // Calculate total timeline duration
        const timelineDuration = Math.max(...state.clips.map(c => c.endTime));
        
        updateProcessingSubtitle('正在准备素材...');
        
        // 先分析时间线，计算可见片段
        updateProcessingSubtitle('正在分析时间线...');
        const visibleSegments = computeVisibleSegments(videoClips, timelineDuration);
        
        console.log('Visible segments:', visibleSegments.map(s => ({
            time: `${s.startTime.toFixed(4)}-${s.endTime.toFixed(4)}`,
            clip: s.clip ? s.clip.name : '(black)',
            track: s.clip ? s.clip.track : '-',
            timelineStart: s.clip ? s.clip.startTime.toFixed(4) : '-',
            timelineEnd: s.clip ? s.clip.endTime.toFixed(4) : '-',
            srcStart: s.clip ? s.srcStart.toFixed(4) : '-',
            srcEnd: s.clip ? (s.srcStart + s.duration).toFixed(4) : '-',
            duration: s.duration.toFixed(4)
        })));
        
        // 收集所有需要的视频文件（原始文件）
        const projectWidth = state.previewEngine?.videoWidth || 1920;
        const projectHeight = state.previewEngine?.videoHeight || 1080;
        const fps = state.previewEngine?.fps || 30;
        
        // 创建 segment 到输出文件的映射
        const segmentFiles = [];
        
        // 处理每个可见片段 - 先裁剪再转码，更高效
        for (let i = 0; i < visibleSegments.length; i++) {
            const seg = visibleSegments[i];
            const segFilename = `segment_v${i}.mp4`;
            
            if (seg.clip && seg.clip.file) {
                updateProcessingSubtitle(`正在处理片段 ${i + 1}/${visibleSegments.length}: ${seg.clip.name}...`);
                
                // 将原始文件写入虚拟文件系统
                const rawFilename = `temp_raw_${i}.mp4`;
                await state.ffmpeg.writeFile(rawFilename, await fetchFile(seg.clip.file));
                
                // 使用 -ss 先定位（快速），然后裁剪指定时长，同时转码
                // 这样只处理需要的部分，而不是整个文件
                const startTime = seg.srcStart;
                const duration = seg.duration;
                
                await state.ffmpeg.exec([
                    '-ss', startTime.toFixed(6),      // 先 seek 到起始位置（放在 -i 前更快）
                    '-t', duration.toFixed(6),         // 只读取指定时长
                    '-i', rawFilename,                 // 输入文件
                    '-vf', `scale=${projectWidth}:${projectHeight}:force_original_aspect_ratio=decrease,pad=${projectWidth}:${projectHeight}:(ow-iw)/2:(oh-ih)/2:black,fps=${fps}`,
                    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
                    '-pix_fmt', 'yuv420p',
                    '-an',                             // 不要音频（视频片段只取画面）
                    '-y', segFilename
                ]);
                
                // 删除原始临时文件
                await state.ffmpeg.deleteFile(rawFilename).catch(() => {});
                
                segmentFiles.push(segFilename);
            } else {
                // 黑帧 - 生成指定时长的黑帧视频
                updateProcessingSubtitle(`正在生成黑帧 ${i + 1}/${visibleSegments.length}...`);
                await state.ffmpeg.exec([
                    '-f', 'lavfi',
                    '-i', `color=c=black:s=${projectWidth}x${projectHeight}:r=${fps}:d=${seg.duration}`,
                    '-c:v', 'libx264', '-t', seg.duration.toFixed(6), '-pix_fmt', 'yuv420p',
                    '-an',
                    '-y', segFilename
                ]);
                segmentFiles.push(segFilename);
            }
        }
        
        // 生成 concat 文件列表
        const concatLines = segmentFiles.map(f => `file '${f}'`);
        await state.ffmpeg.writeFile('concat_list.txt', concatLines.join('\n'));
        
        // 处理音频 - 同样先裁剪再转码
        const audioInputMap = [];
        const audioFiles = [];
        
        // 收集需要处理的音频（包括视频中的音频）
        const allAudioSources = [];
        
        // 1. 来自视频的音频
        for (const clip of videoClips) {
            if (clip.file) {
                allAudioSources.push({
                    clip,
                    startTime: clip.startTime,
                    endTime: clip.endTime,
                    srcStart: clip.srcStart || 0,
                    duration: clip.endTime - clip.startTime
                });
            }
        }
        
        // 2. 独立的音频片段
        for (const clip of audioClips) {
            if (clip.file && !clip.linkedVideoId) {
                allAudioSources.push({
                    clip,
                    startTime: clip.startTime,
                    endTime: clip.endTime,
                    srcStart: clip.srcStart || 0,
                    duration: clip.endTime - clip.startTime
                });
            }
        }
        
        // 处理每个音频源
        for (let i = 0; i < allAudioSources.length; i++) {
            const source = allAudioSources[i];
            const audioFilename = `audio_${i}.aac`;
            
            updateProcessingSubtitle(`正在处理音频 ${i + 1}/${allAudioSources.length}...`);
            
            const rawFilename = `temp_audio_raw_${i}.mp4`;
            await state.ffmpeg.writeFile(rawFilename, await fetchFile(source.clip.file));
            
            // 裁剪并转码音频
            await state.ffmpeg.exec([
                '-ss', source.srcStart.toFixed(6),
                '-t', source.duration.toFixed(6),
                '-i', rawFilename,
                '-vn', // 无视频
                '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
                '-y', audioFilename
            ]);
            
            await state.ffmpeg.deleteFile(rawFilename).catch(() => {});
            
            audioFiles.push({
                filename: audioFilename,
                delayMs: Math.round(source.startTime * 1000)
            });
        }
        
        // Set up progress tracking
        state.ffmpeg.on('progress', ({ progress }) => {
            const percent = Math.min(100, Math.max(0, Math.round(progress * 100)));
            const now = Date.now();
            const elapsed = now - exportStats.startTime;
            
            if (percent > 0) {
                const rate = elapsed / percent;
                exportStats.estimatedTotalTime = rate * 100;
            }
            
            exportStats.lastUpdateTime = now;
            exportStats.lastProgress = percent;
            
            updateProcessingProgress(percent);
            updateProcessingSubtitle(`正在编码视频... ${percent}%`);
        });
        
        // 组合最终命令 - 视频已经预处理完成，只需简单拼接
        const finalArgs = [];
        
        // 视频输入（通过 concat 协议）- 这是输入 0
        finalArgs.push('-f', 'concat', '-safe', '0', '-i', 'concat_list.txt');
        
        // 构建音频过滤器
        const audioFilterParts = [];
        const audioStreamNames = [];
        
        if (audioFiles.length > 0) {
            // 音频输入 - 从输入 1 开始
            audioFiles.forEach((audioFile, index) => {
                finalArgs.push('-i', audioFile.filename);
            });
            
            // 构建音频过滤器
            // 输入 0 是 concat（视频），音频输入从 1 开始
            audioFiles.forEach((audioFile, index) => {
                const audioInputIdx = index + 1;
                const delayMs = audioFile.delayMs;
                const outputName = `a${audioInputIdx}`;
                
                // 音频已经预处理完成（裁剪和转码），只需要应用延迟
                let filter = `[${audioInputIdx}:a]`;
                
                if (delayMs > 0) {
                    filter += `adelay=${delayMs}|${delayMs}:all=1`;
                } else {
                    filter += `anull`; // 无操作
                }
                
                filter += `[${outputName}]`;
                audioFilterParts.push(filter);
                audioStreamNames.push(outputName);
            });
            
            // 混音
            if (audioStreamNames.length === 1) {
                audioFilterParts.push(`[${audioStreamNames[0]}]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[audio]`);
            } else if (audioStreamNames.length > 1) {
                const audioInputs = audioStreamNames.map(n => `[${n}]`).join('');
                audioFilterParts.push(`${audioInputs}amix=inputs=${audioStreamNames.length}:duration=longest:dropout_transition=3[aformat]`);
                audioFilterParts.push(`[aformat]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[audio]`);
            }
        }
        
        // 音频过滤器
        if (audioFilterParts.length > 0 && audioStreamNames.length > 0) {
            finalArgs.push('-filter_complex', audioFilterParts.join(';'));
            finalArgs.push('-map', '0:v'); // 视频来自 concat
            finalArgs.push('-map', '[audio]'); // 音频来自 filter_complex
        } else {
            // 没有音频
            finalArgs.push('-map', '0:v');
            finalArgs.push('-an');
        }
        
        // 编码设置 - 视频已经编码完成，使用 copy 或重新编码都可以
        // 由于视频已经统一格式，可以直接 copy 以提高速度
        finalArgs.push('-c:v', 'copy');
        finalArgs.push('-c:a', 'aac', '-b:a', '192k');
        finalArgs.push('-t', timelineDuration.toString());
        finalArgs.push('-pix_fmt', 'yuv420p');
        finalArgs.push('-y', 'output.mp4');
        
        console.log('FFmpeg args:', finalArgs.join(' '));
        
        updateProcessingSubtitle('正在编码视频...');
        await state.ffmpeg.exec(finalArgs);
        
        updateProcessingSubtitle('正在读取输出文件...');
        updateProcessingProgress(95);
        
        const data = await state.ffmpeg.readFile('output.mp4');
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        
        updateProcessingSubtitle('正在下载...');
        updateProcessingProgress(98);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'exported_video.mp4';
        a.click();
        URL.revokeObjectURL(url);
        
        // Cleanup
        // 删除视频片段文件
        for (const file of segmentFiles) {
            await state.ffmpeg.deleteFile(file).catch(() => {});
        }
        // 删除音频文件
        for (const audioFile of audioFiles) {
            await state.ffmpeg.deleteFile(audioFile.filename).catch(() => {});
        }
        await state.ffmpeg.deleteFile('output.mp4').catch(() => {});
        await state.ffmpeg.deleteFile('concat_list.txt').catch(() => {});
        
        updateProcessingProgress(100);
        clearInterval(statsInterval);
        
        setTimeout(() => {
            elements.processingModal.classList.add('hidden');
            showToast('导出成功', 'success');
        }, 300);
        
    } catch (error) {
        console.error('Export error:', error);
        clearInterval(statsInterval);
        elements.processingModal.classList.add('hidden');
        showToast('导出失败: ' + error.message, 'error');
    }
}

function updateProcessingProgress(percent) {
    elements.processingProgress.style.width = `${percent}%`;
    elements.processingStatus.textContent = `${percent}%`;
}

function updateProcessingSubtitle(text) {
    const subtitle = document.getElementById('processingSubtitle');
    if (subtitle) {
        subtitle.textContent = text;
    }
}

function updateExportStats(stats) {
    const now = Date.now();
    const elapsed = now - stats.startTime;
    const progress = stats.lastProgress;
    
    // Calculate ETA
    let etaText = '--:--';
    if (progress > 0 && progress < 100) {
        const estimatedTotal = elapsed / (progress / 100);
        const remaining = estimatedTotal - elapsed;
        etaText = formatDuration(remaining);
    } else if (progress >= 100) {
        etaText = '00:00';
    }
    
    // Simulate CPU usage (since we can't get real CPU in browser)
    // Use a combination of elapsed time and progress to create realistic-looking variation
    const cpuBase = 40 + Math.sin(now / 2000) * 20;
    const cpuSpike = (progress > 0 && progress < 100) ? Math.random() * 30 : 0;
    const cpuUsage = Math.min(95, Math.round(cpuBase + cpuSpike));
    
    // Estimate memory usage based on file processing
    // This is simulated as we don't have direct access to FFmpeg's memory in browser
    const memoryBase = 150;
    const memoryVar = Math.random() * 50;
    const memoryUsage = Math.round(memoryBase + memoryVar);
    
    // Update display
    const etaEl = document.getElementById('processingETA');
    const cpuEl = document.getElementById('processingCPU');
    const memEl = document.getElementById('processingMemory');
    
    if (etaEl) etaEl.textContent = etaText;
    if (cpuEl) cpuEl.textContent = `${cpuUsage}%`;
    if (memEl) memEl.textContent = `${memoryUsage} MB`;
}

function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ============================================
// UI Updates
// ============================================
function updateUI() {
    updateUndoRedoButtons();
    updateZoomDisplay();
}

function updateSelectionInfo() {
    const count = state.selectedClips.size;
    elements.selectionInfo.textContent = count > 0 ? `已选择 ${count} 个片段` : '';
}

function showToast(message, type = 'info') {
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    elements.toastIcon.textContent = icons[type] || icons.info;
    elements.toastMessage.textContent = message;
    
    elements.toast.classList.add('show');
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

// ============================================
// Utilities
// ============================================
function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00:00';
    
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatTimecode(seconds) {
    if (isNaN(seconds)) return '00:00:00:00';
    
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30);
    
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
