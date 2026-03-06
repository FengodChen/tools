/**
 * Video Editor - 在线视频编辑器
 * 基于 FFmpeg WASM 实现
 */

// Global state
const state = {
    ffmpeg: null,
    loaded: false,
    videoFile: null,
    videoInfo: null,
    audioFile: null,
    segments: [],
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    volume: 100,
    audioTracks: [],
    exportSettings: {
        format: 'mp4',
        quality: 'high',
        resolution: 'original'
    }
};

// DOM Elements
const elements = {};

// Initialize
 document.addEventListener('DOMContentLoaded', async () => {
    // Cache DOM elements
    cacheElements();
    
    // Initialize i18n
    await I18N.init();
    I18N.initLanguageSwitcher('.language-switcher-container');
    
    // Initialize FFmpeg
    await initFFmpeg();
    
    // Bind events
    bindEvents();
    
    // Update UI
    updateUI();
});

function cacheElements() {
    // Loading
    elements.loadingOverlay = document.getElementById('loadingOverlay');
    elements.loadingProgress = document.getElementById('loadingProgress');
    
    // Video
    elements.videoInput = document.getElementById('videoInput');
    elements.uploadBtn = document.getElementById('uploadBtn');
    elements.previewVideo = document.getElementById('previewVideo');
    elements.emptyState = document.getElementById('emptyState');
    elements.timelineContainer = document.getElementById('timelineContainer');
    
    // Timeline
    elements.timeline = document.getElementById('timeline');
    elements.timelineProgress = document.getElementById('timelineProgress');
    elements.timelinePlayhead = document.getElementById('timelinePlayhead');
    elements.timelineStartMarker = document.getElementById('timelineStartMarker');
    elements.timelineEndMarker = document.getElementById('timelineEndMarker');
    elements.playPauseBtn = document.getElementById('playPauseBtn');
    elements.playIcon = document.getElementById('playIcon');
    elements.pauseIcon = document.getElementById('pauseIcon');
    elements.currentTimeDisplay = document.getElementById('currentTimeDisplay');
    elements.durationDisplay = document.getElementById('durationDisplay');
    
    // Cut panel
    elements.startTime = document.getElementById('startTime');
    elements.endTime = document.getElementById('endTime');
    elements.setStartBtn = document.getElementById('setStartBtn');
    elements.setEndBtn = document.getElementById('setEndBtn');
    elements.previewCutBtn = document.getElementById('previewCutBtn');
    elements.applyCutBtn = document.getElementById('applyCutBtn');
    elements.segmentsList = document.getElementById('segmentsList');
    elements.clearSegmentsBtn = document.getElementById('clearSegmentsBtn');
    
    // Convert panel
    elements.outputFormat = document.getElementById('outputFormat');
    elements.videoQuality = document.getElementById('videoQuality');
    elements.outputResolution = document.getElementById('outputResolution');
    elements.gifOptions = document.getElementById('gifOptions');
    elements.gifFps = document.getElementById('gifFps');
    elements.gifFpsValue = document.getElementById('gifFpsValue');
    elements.gifWidth = document.getElementById('gifWidth');
    
    // Audio panel
    elements.volumeSlider = document.getElementById('volumeSlider');
    elements.volumeValue = document.getElementById('volumeValue');
    elements.muteAudio = document.getElementById('muteAudio');
    elements.audioInput = document.getElementById('audioInput');
    elements.addAudioBtn = document.getElementById('addAudioBtn');
    elements.addedTracks = document.getElementById('addedTracks');
    elements.audioTrackControls = document.getElementById('audioTrackControls');
    elements.audioOffset = document.getElementById('audioOffset');
    elements.trackVolume = document.getElementById('trackVolume');
    
    // Info and export
    elements.videoInfo = document.getElementById('videoInfo');
    elements.exportBtn = document.getElementById('exportBtn');
    
    // Processing
    elements.processingModal = document.getElementById('processingModal');
    elements.processingProgress = document.getElementById('processingProgress');
    elements.processingStatus = document.getElementById('processingStatus');
    
    // Toast
    elements.toast = document.getElementById('toast');
    elements.toastIcon = document.getElementById('toastIcon');
    elements.toastMessage = document.getElementById('toastMessage');
    
    // Tabs
    elements.toolTabs = document.querySelectorAll('.tool-tab');
    elements.toolPanels = document.querySelectorAll('.tool-panel');
}

async function initFFmpeg() {
    try {
        const { FFmpeg } = FFmpegWASM;
        const { fetchFile } = FFmpegUtil;
        
        state.ffmpeg = new FFmpeg();
        state.fetchFile = fetchFile;
        
        // 监听日志和进度
        state.ffmpeg.on('log', ({ message }) => {
            console.log('FFmpeg:', message);
            if (message && message.includes('frame=')) {
                const match = message.match(/frame=\s*(\d+)/);
                if (match && state.videoInfo) {
                    const frame = parseInt(match[1]);
                    const totalFrames = state.videoInfo.duration * 30;
                    const percent = Math.min(Math.round((frame / totalFrames) * 100), 99);
                    updateLoadingProgress(percent);
                }
            }
        });
        
        state.ffmpeg.on('progress', ({ progress, time }) => {
            const percent = Math.round(progress * 100);
            updateLoadingProgress(percent);
        });
        
        console.log('Loading FFmpeg 0.12.x...');
        
        // 使用本地文件加载，避免跨域问题
        // 构建相对于当前页面的完整 URL
        updateLoadingProgress(50);
        
        const baseURL = new URL('.', window.location.href).href;
        
        await state.ffmpeg.load({
            coreURL: baseURL + 'ffmpeg/ffmpeg-core.js',
            wasmURL: baseURL + 'ffmpeg/ffmpeg-core.wasm'
        });
        
        state.loaded = true;
        updateLoadingProgress(100);
        
        setTimeout(() => {
            elements.loadingOverlay.classList.add('hidden');
        }, 500);
        
        console.log('FFmpeg loaded successfully');
    } catch (error) {
        console.error('Failed to load FFmpeg:', error);
        handleFFmpegError(error);
    }
}

function handleFFmpegError(error) {
    const isGitHubPages = window.location.hostname.includes('github.io');
    
    let helpText = '';
    if (isGitHubPages) {
        helpText = `
            <p class="text-xs text-slate-400 mb-2">GitHub Pages 提示：</p>
            <ul class="list-disc list-inside mb-3 space-y-1 text-slate-300 text-xs">
                <li>首次加载需要下载约 25MB 的 WASM 文件</li>
                <li>请确保网络连接稳定</li>
                <li>尝试刷新页面重试</li>
                <li>部分浏览器可能需要开启"跨域资源共享"</li>
            </ul>
        `;
    } else {
        helpText = `
            <p class="text-xs text-slate-400 mb-2">提示：</p>
            <ul class="list-disc list-inside mb-3 space-y-1 text-slate-300 text-xs">
                <li>首次加载需要下载约 25MB 的 WASM 文件</li>
                <li>检查网络连接</li>
                <li>尝试使用 Chrome/Edge 浏览器</li>
            </ul>
        `;
    }
    
    elements.loadingProgress.innerHTML = `
        <div class="text-yellow-400 mb-2">⚠️ FFmpeg 加载失败</div>
        <div class="text-sm text-slate-400 text-left max-w-md mx-auto">
            ${helpText}
            <p class="text-xs text-slate-500">错误: ${error.message || '加载超时'}</p>
        </div>
        <div class="flex gap-3 justify-center mt-4">
            <button onclick="location.reload()" class="px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded-lg text-white transition-colors text-sm">
                刷新重试
            </button>
            <button onclick="continueWithoutFFmpeg()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white transition-colors text-sm">
                仅预览模式
            </button>
        </div>
    `;
}

function handleFFmpegError(error) {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isGitHubPages = window.location.hostname.includes('github.io');
    
    let helpText = '';
    
    if (isGitHubPages) {
        helpText = `
            <p class="mb-2 text-indigo-300">GitHub Pages 部署提示：</p>
            <ul class="list-disc list-inside mb-3 space-y-1 text-slate-300">
                <li>确保使用 HTTPS 访问（GitHub Pages 默认支持）</li>
                <li>刷新页面重试，CDN 可能需要时间加载</li>
                <li>尝试使用其他浏览器（推荐 Chrome/Edge）</li>
            </ul>
        `;
    } else if (isLocalhost) {
        helpText = `
            <p class="mb-2 text-indigo-300">本地开发环境解决方案：</p>
            <ul class="list-disc list-inside mb-3 space-y-1 text-slate-300">
                <li>使用 <code class="bg-slate-700 px-1 rounded">npx serve --cors -p 8080</code></li>
                <li>使用 Python: <code class="bg-slate-700 px-1 rounded">python3 -m http.server 8080</code></li>
                <li>使用 VS Code Live Server 插件（右下角 "Go Live"）</li>
            </ul>
            <p class="text-xs text-slate-500 mt-2">注意：直接在浏览器打开文件（file://）无法使用 FFmpeg</p>
        `;
    } else {
        helpText = `
            <p class="mb-2">解决方案：</p>
            <ul class="list-disc list-inside mb-3 space-y-1 text-slate-300">
                <li>确保使用 HTTPS 访问</li>
                <li>检查浏览器控制台获取详细错误信息</li>
                <li>尝试刷新页面或更换浏览器</li>
            </ul>
        `;
    }
    
    elements.loadingProgress.innerHTML = `
        <div class="text-yellow-400 mb-2">⚠️ FFmpeg 加载失败</div>
        <div class="text-sm text-slate-400 text-left max-w-md mx-auto">
            <p class="mb-2">视频处理引擎加载失败。单线程版本同样受到浏览器安全限制。</p>
            ${helpText}
            <p class="text-xs text-slate-500 mt-2">错误: ${error.message || 'Unknown error'}</p>
        </div>
        <div class="flex gap-3 justify-center mt-4">
            <button onclick="location.reload()" class="px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded-lg text-white transition-colors">
                刷新重试
            </button>
            <button onclick="continueWithoutFFmpeg()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white transition-colors">
                受限模式
            </button>
        </div>
    `;
}

// 允许用户在不使用 FFmpeg 的情况下继续浏览
window.continueWithoutFFmpeg = function() {
    elements.loadingOverlay.classList.add('hidden');
    showToast('视频处理功能不可用，仅支持播放预览和下载原视频', 'warning');
    
    // 修改导出按钮为下载原视频按钮
    elements.exportBtn.disabled = false;
    elements.exportBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    elements.exportBtn.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
        </svg>
        <span>${I18N.t('videoEditor.buttons.downloadOriginal') || '下载原视频'}</span>
    `;
    elements.exportBtn.onclick = downloadOriginalVideo;
};

function updateLoadingProgress(percent) {
    if (elements.loadingProgress) {
        elements.loadingProgress.textContent = `${percent}%`;
    }
}

function bindEvents() {
    // Upload
    elements.uploadBtn.addEventListener('click', () => elements.videoInput.click());
    elements.videoInput.addEventListener('change', handleVideoUpload);
    
    // Drag and drop
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        document.body.classList.add('drag-over');
    });
    
    document.addEventListener('dragleave', () => {
        document.body.classList.remove('drag-over');
    });
    
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        document.body.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('video/')) {
            loadVideo(files[0]);
        }
    });
    
    // Video playback
    elements.previewVideo.addEventListener('timeupdate', handleTimeUpdate);
    elements.previewVideo.addEventListener('loadedmetadata', handleMetadataLoaded);
    elements.previewVideo.addEventListener('ended', () => {
        state.isPlaying = false;
        updatePlayButton();
    });
    
    // Timeline
    elements.playPauseBtn.addEventListener('click', togglePlayPause);
    elements.timeline.addEventListener('click', handleTimelineClick);
    
    // Cut controls
    elements.setStartBtn.addEventListener('click', () => setMarker('start'));
    elements.setEndBtn.addEventListener('click', () => setMarker('end'));
    elements.previewCutBtn.addEventListener('click', previewCut);
    elements.applyCutBtn.addEventListener('click', applyCut);
    elements.clearSegmentsBtn.addEventListener('click', clearSegments);
    
    // Convert controls
    elements.outputFormat.addEventListener('change', handleFormatChange);
    elements.gifFps.addEventListener('input', (e) => {
        elements.gifFpsValue.textContent = `${e.target.value}fps`;
    });
    
    // Audio controls
    elements.volumeSlider.addEventListener('input', handleVolumeChange);
    elements.muteAudio.addEventListener('change', handleMuteChange);
    elements.addAudioBtn.addEventListener('click', () => elements.audioInput.click());
    elements.audioInput.addEventListener('change', handleAudioUpload);
    
    // Export
    elements.exportBtn.addEventListener('click', exportVideo);
    
    // Tabs
    elements.toolTabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
}

function handleVideoUpload(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('video/')) {
        loadVideo(file);
    }
}

function loadVideo(file) {
    state.videoFile = file;
    
    const url = URL.createObjectURL(file);
    elements.previewVideo.src = url;
    elements.previewVideo.classList.remove('hidden');
    elements.emptyState.classList.add('hidden');
    elements.timelineContainer.classList.remove('hidden');
    
    // Enable export button
    elements.exportBtn.disabled = false;
    elements.exportBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    
    // Extract video info
    extractVideoInfo(file);
    
    showToast(I18N.t('videoEditor.toast.videoLoaded') || '视频已加载', 'success');
}

function extractVideoInfo(file) {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
        state.videoInfo = {
            name: file.name,
            size: formatFileSize(file.size),
            duration: video.duration,
            width: video.videoWidth,
            height: video.videoHeight
        };
        
        updateVideoInfo();
    };
    
    video.src = URL.createObjectURL(file);
}

function updateVideoInfo() {
    if (!state.videoInfo) return;
    
    const info = state.videoInfo;
    elements.videoInfo.innerHTML = `
        <p><span class="label">${I18N.t('videoEditor.info.name') || '文件名'}</span><span class="value truncate max-w-32">${info.name}</span></p>
        <p><span class="label">${I18N.t('videoEditor.info.size') || '大小'}</span><span class="value">${info.size}</span></p>
        <p><span class="label">${I18N.t('videoEditor.info.duration') || '时长'}</span><span class="value">${formatTime(info.duration)}</span></p>
        <p><span class="label">${I18N.t('videoEditor.info.resolution') || '分辨率'}</span><span class="value">${info.width}x${info.height}</span></p>
    `;
}

function handleMetadataLoaded() {
    state.duration = elements.previewVideo.duration;
    elements.durationDisplay.textContent = formatTime(state.duration);
    elements.endTime.value = formatTime(state.duration);
    
    // Show timeline markers
    elements.timelineStartMarker.classList.remove('hidden');
    elements.timelineEndMarker.classList.remove('hidden');
    
    updateTimelineMarkers();
    generateThumbnails();
}

function handleTimeUpdate() {
    state.currentTime = elements.previewVideo.currentTime;
    elements.currentTimeDisplay.textContent = formatTime(state.currentTime);
    
    // Update timeline
    const percent = (state.currentTime / state.duration) * 100;
    elements.timelineProgress.style.width = `${percent}%`;
    elements.timelinePlayhead.style.left = `${percent}%`;
}

function togglePlayPause() {
    if (elements.previewVideo.paused) {
        elements.previewVideo.play();
        state.isPlaying = true;
    } else {
        elements.previewVideo.pause();
        state.isPlaying = false;
    }
    updatePlayButton();
}

function updatePlayButton() {
    if (state.isPlaying) {
        elements.playIcon.classList.add('hidden');
        elements.pauseIcon.classList.remove('hidden');
    } else {
        elements.playIcon.classList.remove('hidden');
        elements.pauseIcon.classList.add('hidden');
    }
}

function handleTimelineClick(e) {
    const rect = elements.timeline.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const time = percent * state.duration;
    
    elements.previewVideo.currentTime = time;
}

function setMarker(type) {
    const time = elements.previewVideo.currentTime;
    const formattedTime = formatTime(time);
    
    if (type === 'start') {
        elements.startTime.value = formattedTime;
        state.segments.start = time;
    } else {
        elements.endTime.value = formattedTime;
        state.segments.end = time;
    }
    
    updateTimelineMarkers();
}

function updateTimelineMarkers() {
    const startTime = timeToSeconds(elements.startTime.value) || 0;
    const endTime = timeToSeconds(elements.endTime.value) || state.duration;
    
    const startPercent = (startTime / state.duration) * 100;
    const endPercent = (endTime / state.duration) * 100;
    
    elements.timelineStartMarker.style.left = `${startPercent}%`;
    elements.timelineEndMarker.style.left = `${endPercent}%`;
}

function previewCut() {
    const startTime = timeToSeconds(elements.startTime.value);
    if (startTime > 0) {
        elements.previewVideo.currentTime = startTime;
    }
    elements.previewVideo.play();
    state.isPlaying = true;
    updatePlayButton();
    
    // Stop at end time
    const endTime = timeToSeconds(elements.endTime.value);
    const checkEnd = () => {
        if (elements.previewVideo.currentTime >= endTime) {
            elements.previewVideo.pause();
            state.isPlaying = false;
            updatePlayButton();
            elements.previewVideo.removeEventListener('timeupdate', checkEnd);
        }
    };
    elements.previewVideo.addEventListener('timeupdate', checkEnd);
}

function applyCut() {
    const startTime = timeToSeconds(elements.startTime.value);
    const endTime = timeToSeconds(elements.endTime.value);
    
    if (startTime >= endTime) {
        showToast(I18N.t('videoEditor.toast.invalidTime') || '开始时间必须小于结束时间', 'error');
        return;
    }
    
    const segment = {
        id: Date.now(),
        start: startTime,
        end: endTime,
        startFormatted: formatTime(startTime),
        endFormatted: formatTime(endTime)
    };
    
    if (!state.segments.list) {
        state.segments.list = [];
    }
    state.segments.list.push(segment);
    
    renderSegments();
    elements.clearSegmentsBtn.classList.remove('hidden');
    
    showToast(I18N.t('videoEditor.toast.segmentAdded') || '片段已添加', 'success');
}

function renderSegments() {
    if (!state.segments.list || state.segments.list.length === 0) {
        elements.segmentsList.innerHTML = `<p class="text-sm text-slate-400 italic">${I18N.t('videoEditor.cut.noSegments') || '暂无片段'}</p>`;
        return;
    }
    
    elements.segmentsList.innerHTML = state.segments.list.map(seg => `
        <div class="segment-item flex items-center justify-between" data-id="${seg.id}">
            <div>
                <div class="font-medium text-sm">${seg.startFormatted} - ${seg.endFormatted}</div>
                <div class="text-xs text-slate-400">${formatTime(seg.end - seg.start)}</div>
            </div>
            <button onclick="removeSegment(${seg.id})" class="text-red-500 hover:text-red-700 p-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
    `).join('');
}

function removeSegment(id) {
    state.segments.list = state.segments.list.filter(s => s.id !== id);
    renderSegments();
    
    if (state.segments.list.length === 0) {
        elements.clearSegmentsBtn.classList.add('hidden');
    }
}

function clearSegments() {
    state.segments.list = [];
    renderSegments();
    elements.clearSegmentsBtn.classList.add('hidden');
    showToast(I18N.t('videoEditor.toast.segmentsCleared') || '已清空所有片段', 'success');
}

function handleFormatChange(e) {
    const format = e.target.value;
    if (format === 'gif') {
        elements.gifOptions.classList.remove('hidden');
    } else {
        elements.gifOptions.classList.add('hidden');
    }
}

function handleVolumeChange(e) {
    const volume = e.target.value;
    elements.volumeValue.textContent = `${volume}%`;
    state.volume = volume;
    
    if (!elements.muteAudio.checked) {
        elements.previewVideo.volume = volume / 100;
    }
}

function handleMuteChange(e) {
    elements.previewVideo.muted = e.target.checked;
}

function handleAudioUpload(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('audio/')) {
        addAudioTrack(file);
    }
}

function addAudioTrack(file) {
    const track = {
        id: Date.now(),
        file: file,
        name: file.name,
        offset: 0,
        volume: 100
    };
    
    state.audioTracks.push(track);
    renderAudioTracks();
    elements.audioTrackControls.classList.remove('hidden');
    
    showToast(I18N.t('videoEditor.toast.audioAdded') || '音频已添加', 'success');
}

function renderAudioTracks() {
    if (state.audioTracks.length === 0) {
        elements.addedTracks.innerHTML = '';
        elements.audioTrackControls.classList.add('hidden');
        return;
    }
    
    elements.addedTracks.innerHTML = state.audioTracks.map(track => `
        <div class="audio-track-item" data-id="${track.id}">
            <div class="flex items-center justify-between">
                <div class="track-name truncate">${track.name}</div>
                <button onclick="removeAudioTrack(${track.id})" class="text-indigo-600 hover:text-indigo-800">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            <div class="track-info">${formatFileSize(track.file.size)}</div>
        </div>
    `).join('');
}

function removeAudioTrack(id) {
    state.audioTracks = state.audioTracks.filter(t => t.id !== id);
    renderAudioTracks();
}

async function exportVideo() {
    if (!state.videoFile) {
        showToast(I18N.t('videoEditor.toast.noVideo') || '请先上传视频', 'error');
        return;
    }
    
    if (!state.loaded || !state.ffmpeg) {
        showToast('FFmpeg 未加载，视频处理功能不可用。', 'error');
        return;
    }
    
    elements.processingModal.classList.remove('hidden');
    updateProcessingProgress(0);
    
    try {
        const fetchFile = state.fetchFile;
        
        const format = elements.outputFormat.value;
        const quality = elements.videoQuality.value;
        const resolution = elements.outputResolution.value;
        
        // Write input file (0.12.x API)
        await state.ffmpeg.writeFile('input.mp4', await fetchFile(state.videoFile));
        
        // Build FFmpeg command
        let args = ['-i', 'input.mp4'];
        
        // Add audio tracks if any
        if (state.audioTracks.length > 0) {
            for (let i = 0; i < state.audioTracks.length; i++) {
                const track = state.audioTracks[i];
                await state.ffmpeg.writeFile(`audio${i}.mp3`, await fetchFile(track.file));
                args.push('-i', `audio${i}.mp3`);
            }
        }
        
        // Video filters
        const filters = [];
        
        // Resolution filter
        if (resolution !== 'original') {
            const [width, height] = resolution.split('x');
            filters.push(`scale=${width}:${height}`);
        }
        
        // Quality settings
        let videoCodec = 'libx264';
        let crf = '23';
        
        if (quality === 'high') {
            crf = '18';
        } else if (quality === 'low') {
            crf = '28';
        }
        
        // Format specific settings
        let outputFile = `output.${format}`;
        
        if (format === 'gif') {
            const fps = elements.gifFps.value;
            const width = elements.gifWidth.value;
            filters.push(`fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=[s1]paletteuse`);
            args.push('-vf', filters.join(','));
        } else if (format === 'mp3') {
            args.push('-vn', '-acodec', 'libmp3lame', '-q:a', '2');
        } else {
            // Video format
            if (filters.length > 0) {
                args.push('-vf', filters.join(','));
            }
            
            if (format === 'webm') {
                videoCodec = 'libvpx-vp9';
            } else if (format === 'avi') {
                videoCodec = 'mpeg4';
            }
            
            args.push('-c:v', videoCodec, '-crf', crf);
            
            // Audio settings
            if (elements.muteAudio.checked) {
                args.push('-an');
            } else {
                args.push('-c:a', 'aac', '-b:a', '192k');
                
                // Volume adjustment
                if (state.volume !== 100) {
                    args.push('-af', `volume=${state.volume / 100}`);
                }
            }
        }
        
        // Cut segments if any
        if (state.segments.list && state.segments.list.length > 0) {
            const seg = state.segments.list[0];
            args.push('-ss', seg.start.toString(), '-t', (seg.end - seg.start).toString());
        }
        
        // Output
        args.push('-y', outputFile);
        
        console.log('FFmpeg args:', args);
        
        // Execute (0.12.x API)
        await state.ffmpeg.exec(args);
        
        // Read output file (0.12.x API)
        const data = await state.ffmpeg.readFile(outputFile);
        
        // Create download link
        const blob = new Blob([data.buffer], { type: getMimeType(format) });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `edited_video.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
        // Cleanup (0.12.x API)
        await state.ffmpeg.deleteFile('input.mp4');
        await state.ffmpeg.deleteFile(outputFile);
        for (let i = 0; i < state.audioTracks.length; i++) {
            try {
                await state.ffmpeg.deleteFile(`audio${i}.mp3`);
            } catch (e) {}
        }
        
        elements.processingModal.classList.add('hidden');
        showToast(I18N.t('videoEditor.toast.exportSuccess') || '导出成功', 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        elements.processingModal.classList.add('hidden');
        showToast(I18N.t('videoEditor.toast.exportError') || '导出失败: ' + error.message, 'error');
    }
}

function updateProcessingProgress(percent) {
    elements.processingProgress.style.width = `${percent}%`;
    elements.processingStatus.textContent = `${percent}%`;
}

function switchTab(tabName) {
    // Update tab buttons
    elements.toolTabs.forEach(tab => {
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active', 'text-indigo-600', 'border-b-2', 'border-indigo-600');
            tab.classList.remove('text-slate-500');
        } else {
            tab.classList.remove('active', 'text-indigo-600', 'border-b-2', 'border-indigo-600');
            tab.classList.add('text-slate-500');
        }
    });
    
    // Update panels
    elements.toolPanels.forEach(panel => {
        panel.classList.add('hidden');
    });
    document.getElementById(`${tabName}Panel`).classList.remove('hidden');
}

function generateThumbnails() {
    // Simple thumbnail generation using canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const video = elements.previewVideo;
    
    canvas.width = 120;
    canvas.height = 68;
    
    const thumbnailCount = 10;
    const interval = state.duration / thumbnailCount;
    
    elements.timelineThumbnails.innerHTML = '';
    
    for (let i = 0; i < thumbnailCount; i++) {
        const time = i * interval;
        const thumb = document.createElement('div');
        thumb.className = 'timeline-thumbnail';
        thumb.style.width = `${100 / thumbnailCount}%`;
        thumb.dataset.time = time;
        elements.timelineThumbnails.appendChild(thumb);
    }
}

// Utility functions
function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00:00';
    
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function timeToSeconds(timeStr) {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    return parseFloat(timeStr) || 0;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getMimeType(format) {
    const mimeTypes = {
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'gif': 'image/gif',
        'mp3': 'audio/mpeg'
    };
    return mimeTypes[format] || 'video/mp4';
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
    
    elements.toast.classList.remove('hidden', 'translate-x-full');
    elements.toast.classList.add('translate-x-0');
    
    setTimeout(() => {
        elements.toast.classList.add('translate-x-full');
        elements.toast.classList.remove('translate-x-0');
        
        setTimeout(() => {
            elements.toast.classList.add('hidden');
        }, 300);
    }, 3000);
}

function updateUI() {
    // Initial UI update if needed
}

// 备用下载功能（不使用 FFmpeg）
function downloadOriginalVideo() {
    if (!state.videoFile) {
        showToast('没有可下载的视频', 'error');
        return;
    }
    
    const url = URL.createObjectURL(state.videoFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = state.videoFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('原视频已下载', 'success');
}

// Make functions available globally for onclick handlers
window.removeSegment = removeSegment;
window.removeAudioTrack = removeAudioTrack;
