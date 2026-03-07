/**
 * Video Preview Engine
 * Custom video preview using Canvas + WASM for frame-accurate rendering
 */

import init, { VideoEditorEngine, snap_to_frame, time_to_pixel, pixel_to_time } from './wasm-pkg/video_editor_core.js';

export class PreviewEngine {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.wasmEngine = null;
        this.videoElements = new Map(); // clipId -> HTMLVideoElement
        this.audioElements = new Map(); // clipId -> HTMLAudioElement
        
        // Playback state
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.fps = 30;
        this.frameDuration = 1 / 30;
        
        // Animation frame
        this.animationFrameId = null;
        this.lastFrameTime = 0;
        
        // Settings
        this.loop = false;
        this.volume = 1.0;
        
        // Callbacks
        this.onTimeUpdate = null;
        this.onPlay = null;
        this.onPause = null;
        this.onEnded = null;
        
        // Video dimensions
        this.videoWidth = 1920;
        this.videoHeight = 1080;
        this.displayWidth = 1920;
        this.displayHeight = 1080;
        
        // Cache for composition layers to reduce WASM calls
        this._layersCache = null;
        this._layersCacheTime = -1;
        this._layersCacheThreshold = 0.001; // Cache valid within 1ms
    }

    /**
     * Initialize the WASM module and preview engine
     */
    async init() {
        try {
            await init();
            this.wasmEngine = new VideoEditorEngine();
            console.log('WASM Video Editor Engine loaded');
        } catch (error) {
            console.error('Failed to initialize WASM:', error);
            throw error;
        }
    }

    /**
     * Set the preview canvas element
     */
    setCanvas(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', {
            alpha: false,
            desynchronized: true // Optimize for video playback
        });
        
        // Set initial canvas size
        this.updateCanvasSize();
        
        // Configure WASM preview
        if (this.wasmEngine) {
            this.wasmEngine.set_preview_canvas(canvas);
        }
    }

    /**
     * Update canvas display size based on container
     */
    updateCanvasSize() {
        if (!this.canvas) return;
        
        const container = this.canvas.parentElement;
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        const containerWidth = rect.width;
        const containerHeight = rect.height;
        
        // Calculate display dimensions maintaining aspect ratio
        const videoAspect = this.videoWidth / this.videoHeight;
        const containerAspect = containerWidth / containerHeight;
        
        if (videoAspect > containerAspect) {
            this.displayWidth = containerWidth;
            this.displayHeight = containerWidth / videoAspect;
        } else {
            this.displayWidth = containerHeight * videoAspect;
            this.displayHeight = containerHeight;
        }
        
        // Set canvas internal resolution
        this.canvas.width = this.videoWidth;
        this.canvas.height = this.videoHeight;
        
        // Set display size via CSS
        this.canvas.style.width = `${this.displayWidth}px`;
        this.canvas.style.height = `${this.displayHeight}px`;
    }

    /**
     * Register a video clip for preview
     */
    registerVideoClip(clip) {
        if (clip.type !== 'video' || !clip.file) return;
        
        const video = document.createElement('video');
        video.src = URL.createObjectURL(clip.file);
        video.preload = 'auto';
        video.muted = true; // We handle audio separately
        video.playsInline = true;
        
        // Store reference
        this.videoElements.set(clip.id, video);
        
        // Wait for metadata to get video dimensions
        video.addEventListener('loadedmetadata', () => {
            if (this.videoWidth === 1920 && this.videoHeight === 1080) {
                // Use first video's dimensions as project dimensions
                this.videoWidth = video.videoWidth;
                this.videoHeight = video.videoHeight;
                this.fps = 30; // Default to 30fps
                this.frameDuration = 1 / this.fps;
                this.updateCanvasSize();
                
                if (this.wasmEngine) {
                    this.wasmEngine.configure_preview(this.videoWidth, this.videoHeight, this.fps);
                }
            }
        });
    }

    /**
     * Register an audio clip for preview
     */
    registerAudioClip(clip) {
        if (clip.type !== 'audio' || !clip.file) return;
        
        const audio = document.createElement('audio');
        audio.src = URL.createObjectURL(clip.file);
        audio.preload = 'auto';
        
        this.audioElements.set(clip.id, audio);
    }

    /**
     * Unregister a clip
     */
    unregisterClip(clipId) {
        const video = this.videoElements.get(clipId);
        if (video) {
            URL.revokeObjectURL(video.src);
            video.remove();
            this.videoElements.delete(clipId);
        }
        
        const audio = this.audioElements.get(clipId);
        if (audio) {
            URL.revokeObjectURL(audio.src);
            audio.remove();
            this.audioElements.delete(clipId);
        }
    }

    /**
     * Add a clip to the timeline via WASM
     */
    addClip(clip) {
        if (!this.wasmEngine) return;
        
        const clipData = {
            id: clip.id,
            type: clip.type,
            track: clip.track,
            name: clip.name,
            start_time: clip.startTime,
            end_time: clip.endTime,
            src_start: clip.srcStart || 0,
            src_end: clip.srcEnd || clip.duration,
            duration: clip.duration,
            volume: clip.volume || 100,
            speed: clip.speed || 1,
            locked: clip.locked || false,
            muted: clip.muted || false
        };
        
        try {
            this.wasmEngine.add_clip(JSON.stringify(clipData));
        } catch (e) {
            console.error('Failed to add clip to WASM:', e);
        }
        
        // Register media element
        if (clip.type === 'video') {
            this.registerVideoClip(clip);
        } else if (clip.type === 'audio') {
            this.registerAudioClip(clip);
        }
        
        // Update duration and clear cache
        this.updateDuration();
        this.clearLayersCache();
    }

    /**
     * Remove a clip from the timeline
     */
    removeClip(clipId) {
        if (!this.wasmEngine) return;
        
        this.wasmEngine.remove_clip(clipId);
        this.unregisterClip(clipId);
        this.updateDuration();
        this.clearLayersCache();
    }

    /**
     * Update a clip's properties
     */
    updateClip(clip) {
        if (!this.wasmEngine) return;
        
        const clipData = {
            id: clip.id,
            type: clip.type,
            track: clip.track,
            name: clip.name,
            start_time: clip.startTime,
            end_time: clip.endTime,
            src_start: clip.srcStart || 0,
            src_end: clip.srcEnd || clip.duration,
            duration: clip.duration,
            volume: clip.volume || 100,
            speed: clip.speed || 1,
            locked: clip.locked || false,
            muted: clip.muted || false
        };
        
        try {
            this.wasmEngine.update_clip(JSON.stringify(clipData));
        } catch (e) {
            console.error('Failed to update clip in WASM:', e);
        }
        
        this.updateDuration();
        this.clearLayersCache();
    }

    /**
     * Move a clip to a new position
     */
    moveClip(clipId, newStart, newTrack) {
        if (!this.wasmEngine) return;
        
        try {
            this.wasmEngine.move_clip(clipId, newStart, newTrack);
        } catch (e) {
            console.error('Failed to move clip:', e);
        }
        
        this.updateDuration();
        this.clearLayersCache();
    }

    /**
     * Resize/trim a clip
     */
    resizeClip(clipId, newStart, newEnd) {
        if (!this.wasmEngine) return;
        
        try {
            this.wasmEngine.resize_clip(clipId, newStart, newEnd);
        } catch (e) {
            console.error('Failed to resize clip:', e);
        }
        
        this.updateDuration();
        this.clearLayersCache();
    }

    /**
     * Split a clip at the given time
     */
    splitClip(clipId, splitTime, file = null, type = 'video') {
        if (!this.wasmEngine) return null;
        
        try {
            const newClipId = this.wasmEngine.split_clip(clipId, splitTime);
            
            // Register media element for the new clip
            if (newClipId && file) {
                const newClip = {
                    id: newClipId,
                    type: type,
                    file: file
                };
                if (type === 'video') {
                    this.registerVideoClip(newClip);
                } else if (type === 'audio') {
                    this.registerAudioClip(newClip);
                }
            }
            
            this.clearLayersCache();
            return newClipId;
        } catch (e) {
            console.error('Failed to split clip:', e);
            return null;
        }
    }

    /**
     * Get composition layers at a specific time
     * Uses caching to reduce WASM calls during playback
     */
    getCompositionLayers(time) {
        if (!this.wasmEngine) return [];
        
        // Check cache - use cached result if time is very close
        if (this._layersCache && Math.abs(time - this._layersCacheTime) < this._layersCacheThreshold) {
            return this._layersCache;
        }
        
        try {
            const json = this.wasmEngine.get_composition_layers(time);
            const layers = JSON.parse(json);
            
            // Update cache
            this._layersCache = layers;
            this._layersCacheTime = time;
            
            return layers;
        } catch (e) {
            console.error('Failed to get composition layers:', e);
            return [];
        }
    }
    
    /**
     * Clear the composition layers cache
     */
    clearLayersCache() {
        this._layersCache = null;
        this._layersCacheTime = -1;
    }

    /**
     * Calculate source time for a clip at global time
     */
    calculateSourceTime(clipId, globalTime) {
        if (!this.wasmEngine) return null;
        
        return this.wasmEngine.calculate_source_time(clipId, globalTime);
    }

    /**
     * Clear all clips
     */
    clear() {
        if (!this.wasmEngine) return;
        
        this.wasmEngine.clear();
        
        // Clean up video elements
        this.videoElements.forEach((video, clipId) => {
            URL.revokeObjectURL(video.src);
            video.remove();
        });
        this.videoElements.clear();
        
        // Clean up audio elements
        this.audioElements.forEach((audio, clipId) => {
            URL.revokeObjectURL(audio.src);
            audio.remove();
        });
        this.audioElements.clear();
        
        this.duration = 0;
        this.clearLayersCache();
    }

    /**
     * Update the total duration based on clips
     */
    updateDuration() {
        if (!this.wasmEngine) return;
        
        this.duration = this.wasmEngine.get_duration();
    }

    /**
     * Seek to a specific time
     */
    seekTo(time) {
        this.currentTime = Math.max(0, Math.min(time, this.duration));
        
        // Snap to frame boundary for frame-accurate seeking
        this.currentTime = snap_to_frame(this.currentTime, this.fps);
        
        // Pre-seek all video elements that might be needed at this time
        // Use a small threshold to avoid unnecessary seeks during playback
        const layers = this.getCompositionLayers(this.currentTime);
        for (const layer of layers) {
            if (layer.track_index >= 2) continue; // Skip audio tracks
            
            const video = this.videoElements.get(layer.clip_id);
            if (video && video.readyState >= 2) {
                const sourceTime = layer.source_time;
                // For paused/seeking state, we want precise positioning
                const threshold = this.isPlaying ? 1.0 : 0.05;
                if (Math.abs(video.currentTime - sourceTime) > threshold && !video.seeking) {
                    video.currentTime = sourceTime;
                }
            }
        }
        
        // Render the frame
        this.renderFrame();
        
        // Notify listeners
        if (this.onTimeUpdate) {
            this.onTimeUpdate(this.currentTime);
        }
    }

    /**
     * Start playback
     */
    play() {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        this.lastFrameTime = performance.now();
        
        // Initial sync and render - force seek to ensure we're at the right position
        this.syncAndRender(true);
        
        // Sync and play audio elements
        this.syncAudioPlayback();
        
        // Start render loop
        this.renderLoop();
        
        if (this.onPlay) {
            this.onPlay();
        }
    }

    /**
     * Pause playback
     */
    pause() {
        if (!this.isPlaying) return;
        
        this.isPlaying = false;
        
        // Cancel animation frame
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Pause all audio
        this.audioElements.forEach(audio => {
            audio.pause();
        });
        
        if (this.onPause) {
            this.onPause();
        }
    }

    /**
     * Toggle play/pause
     */
    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    /**
     * Step one frame forward or backward
     */
    stepFrame(direction) {
        const newTime = this.currentTime + (direction * this.frameDuration);
        this.seekTo(newTime);
    }

    /**
     * Main render loop for playback
     */
    renderLoop() {
        if (!this.isPlaying) return;
        
        const now = performance.now();
        const deltaTime = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;
        
        // Advance time
        this.currentTime += deltaTime;
        
        // Check for end of timeline
        if (this.currentTime >= this.duration) {
            if (this.loop) {
                this.currentTime = 0;
                // Restart videos from beginning
                this.syncAndRender(true);
            } else {
                this.currentTime = this.duration;
                this.pause();
                if (this.onEnded) {
                    this.onEnded();
                }
                return;
            }
        }
        
        // Sync videos and render - single call to get composition layers
        // Use requestVideoFrameCallback for active video if available
        this.syncAndRenderWithFrameCallback();
        
        // Sync audio
        this.syncAudioPlayback();
        
        // Notify listeners
        if (this.onTimeUpdate) {
            this.onTimeUpdate(this.currentTime);
        }
        
        // Continue loop at display refresh rate
        this.animationFrameId = requestAnimationFrame(() => this.renderLoop());
    }
    
    /**
     * Sync videos and render with requestVideoFrameCallback if available
     */
    syncAndRenderWithFrameCallback() {
        const layers = this.getCompositionLayers(this.currentTime);
        
        // Find the active video layer - V1 (upper track) takes priority over V2 (lower track)
        // Track 0 (V1) is above Track 1 (V2), so it should be checked first
        let activeVideoLayer = null;
        let activeVideo = null;
        
        for (const layer of layers) {
            if (layer.track_index === 0) {
                activeVideoLayer = layer;
                break;
            }
        }
        if (!activeVideoLayer) {
            for (const layer of layers) {
                if (layer.track_index === 1) {
                    activeVideoLayer = layer;
                    break;
                }
            }
        }
        
        // Collect active video clip IDs for pausing inactive videos
        const activeVideoClipIds = new Set();
        for (const layer of layers) {
            if (layer.track_index < 2) { // Video tracks only
                activeVideoClipIds.add(layer.clip_id);
            }
        }
        
        // Pause video elements that are no longer active
        this.videoElements.forEach((video, clipId) => {
            if (!activeVideoClipIds.has(clipId) && !video.paused) {
                video.pause();
            }
        });
        
        // Sync all video elements and find active one for rendering
        for (const layer of layers) {
            if (layer.track_index >= 2) continue; // Skip audio tracks
            
            const video = this.videoElements.get(layer.clip_id);
            if (!video || video.readyState < 2) continue;
            
            const targetTime = layer.source_time;
            const timeDiff = Math.abs(video.currentTime - targetTime);
            
            // Seek to target time if difference is significant
            if (timeDiff > 0.1 && !video.seeking) {
                video.currentTime = targetTime;
            }
            
            // Ensure active video is playing for smooth frame updates
            if (layer === activeVideoLayer) {
                activeVideo = video;
                if (video.paused) {
                    video.play().catch(() => {});
                }
            }
        }
        
        // Render the active video
        if (activeVideo) {
            if (activeVideo.seeking) {
                // If seeking, don't render yet - keep last frame
                return;
            }
            
            // Draw immediately - requestVideoFrameCallback can cause issues
            // when switching between clips on different tracks
            this.drawVideoFrame(activeVideo, activeVideoLayer.opacity);
        } else {
            // No video to display - clear to black
            this.clearCanvas();
        }
    }
    
    /**
     * Sync videos to timeline and render frame - combines sync and render for efficiency
     * @param {boolean} forceSeek - Force seek even for small differences
     */
    syncAndRender(forceSeek = false) {
        const layers = this.getCompositionLayers(this.currentTime);
        
        // Find the active video layer - V1 (upper track) takes priority over V2 (lower track)
        // Track 0 (V1) is above Track 1 (V2), so it should be checked first
        let activeVideoLayer = null;
        let activeVideo = null;
        
        for (const layer of layers) {
            if (layer.track_index === 0) {
                activeVideoLayer = layer;
                break;
            }
        }
        if (!activeVideoLayer) {
            for (const layer of layers) {
                if (layer.track_index === 1) {
                    activeVideoLayer = layer;
                    break;
                }
            }
        }
        
        // Collect active video clip IDs for pausing inactive videos
        const activeVideoClipIds = new Set();
        for (const layer of layers) {
            if (layer.track_index < 2) { // Video tracks only
                activeVideoClipIds.add(layer.clip_id);
            }
        }
        
        // Pause video elements that are no longer active
        this.videoElements.forEach((video, clipId) => {
            if (!activeVideoClipIds.has(clipId) && !video.paused) {
                video.pause();
            }
        });
        
        // Sync all video elements and find active one for rendering
        for (const layer of layers) {
            if (layer.track_index >= 2) continue; // Skip audio tracks
            
            const video = this.videoElements.get(layer.clip_id);
            if (!video || video.readyState < 2) continue;
            
            const targetTime = layer.source_time;
            const timeDiff = Math.abs(video.currentTime - targetTime);
            
            // Only seek if:
            // 1. Force seek is requested
            // 2. Time difference is large (> 1 second for smooth playback)
            // 3. Video is not currently seeking
            const shouldSeek = forceSeek || (timeDiff > 1.0 && !video.seeking);
            
            if (shouldSeek) {
                video.currentTime = targetTime;
            }
            
            // Track the active video for rendering
            if (layer === activeVideoLayer) {
                activeVideo = video;
            }
        }
        
        // Render the active video
        if (activeVideo && !activeVideo.seeking) {
            this.drawVideoFrame(activeVideo, activeVideoLayer.opacity);
        } else if (!activeVideoLayer) {
            // No video to display - only clear if we haven't drawn anything yet
            // or if we need to clear the previous content
            this.clearCanvas();
        }
        // If video is seeking, keep the last frame (don't clear)
    }
    
    /**
     * Draw video frame to canvas
     */
    drawVideoFrame(video, opacity = 1.0) {
        if (!this.ctx || !this.canvas) return;
        if (video.seeking) return; // Skip if still seeking
        
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        try {
            ctx.globalAlpha = opacity;
            ctx.drawImage(video, 0, 0, width, height);
            ctx.globalAlpha = 1.0;
        } catch (e) {
            // Video frame not ready, keep previous frame
        }
    }
    
    /**
     * Clear canvas to black
     */
    clearCanvas() {
        if (!this.ctx || !this.canvas) return;
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Render a single frame at current time (for paused/scrubbing state)
     */
    renderFrame() {
        if (!this.ctx || !this.canvas) return;
        
        const layers = this.getCompositionLayers(this.currentTime);
        
        // Find the active video layer - V1 (upper track) takes priority over V2 (lower track)
        // Track 0 (V1) is above Track 1 (V2), so it should be checked first
        let activeVideoLayer = null;
        for (const layer of layers) {
            if (layer.track_index === 0) {
                activeVideoLayer = layer;
                break;
            }
        }
        if (!activeVideoLayer) {
            for (const layer of layers) {
                if (layer.track_index === 1) {
                    activeVideoLayer = layer;
                    break;
                }
            }
        }
        
        // Collect active video clip IDs for pausing inactive videos
        const activeVideoClipIds = new Set();
        for (const layer of layers) {
            if (layer.track_index < 2) { // Video tracks only
                activeVideoClipIds.add(layer.clip_id);
            }
        }
        
        // Pause video elements that are no longer active
        this.videoElements.forEach((video, clipId) => {
            if (!activeVideoClipIds.has(clipId) && !video.paused) {
                video.pause();
            }
        });
        
        if (activeVideoLayer) {
            const video = this.videoElements.get(activeVideoLayer.clip_id);
            if (video && video.readyState >= 2) {
                const sourceTime = activeVideoLayer.source_time;
                
                // During scrubbing/paused, we want precise positioning
                // So use smaller threshold
                const timeDiff = Math.abs(video.currentTime - sourceTime);
                if (timeDiff > 0.05 && !video.seeking) {
                    video.currentTime = sourceTime;
                }
                
                // Draw frame if ready
                if (!video.seeking) {
                    this.drawVideoFrame(video, activeVideoLayer.opacity);
                } else {
                    // If seeking, wait a bit and try again
                    setTimeout(() => this.renderFrame(), 50);
                }
                return;
            }
        }
        
        // No active video layer - clear to black
        this.clearCanvas();
    }

    /**
     * Sync audio playback with current time
     */
    syncAudioPlayback() {
        const layers = this.getCompositionLayers(this.currentTime);
        
        // Find active audio layers
        const activeAudioLayers = [];
        for (const layer of layers) {
            if (layer.track_index >= 2) { // Audio tracks
                activeAudioLayers.push(layer);
            }
        }
        
        const activeAudioClipIds = new Set(activeAudioLayers.map(l => l.clip_id));
        
        // Update audio elements
        this.audioElements.forEach((audio, clipId) => {
            if (activeAudioClipIds.has(clipId)) {
                // Find the layer for this audio clip
                const layer = activeAudioLayers.find(l => l.clip_id === clipId);
                if (layer) {
                    const sourceTime = layer.source_time;
                    // Only seek if time difference is significant
                    if (Math.abs(audio.currentTime - sourceTime) > 0.2) {
                        audio.currentTime = sourceTime;
                    }
                    if (audio.paused) {
                        audio.play().catch(() => {});
                    }
                }
            } else {
                if (!audio.paused) {
                    audio.pause();
                }
            }
        });
    }

    /**
     * Set loop mode
     */
    setLoop(enabled) {
        this.loop = enabled;
    }

    /**
     * Set volume
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        this.audioElements.forEach(audio => {
            audio.volume = this.volume;
        });
    }

    /**
     * Get current time
     */
    getCurrentTime() {
        return this.currentTime;
    }

    /**
     * Get total duration
     */
    getDuration() {
        return this.duration;
    }

    /**
     * Get all clips from WASM
     */
    getClips() {
        if (!this.wasmEngine) return [];
        
        try {
            const json = this.wasmEngine.get_clips_json();
            return JSON.parse(json);
        } catch (e) {
            console.error('Failed to get clips:', e);
            return [];
        }
    }

    /**
     * Destroy the engine and clean up resources
     */
    destroy() {
        this.pause();
        this.clear();
        
        if (this.wasmEngine) {
            this.wasmEngine.free();
            this.wasmEngine = null;
        }
    }
}

// Export helper functions
export { snap_to_frame, time_to_pixel, pixel_to_time };
