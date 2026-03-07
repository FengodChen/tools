mod utils;
mod timeline;
mod preview;

use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use timeline::{Timeline, Clip};
use preview::PreviewEngine;



#[wasm_bindgen]
pub struct VideoEditorEngine {
    timeline: Timeline,
    preview: PreviewEngine,
}

#[wasm_bindgen]
impl VideoEditorEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        utils::set_panic_hook();
        
        Self {
            timeline: Timeline::new(),
            preview: PreviewEngine::new(),
        }
    }

    /// Add a clip to the timeline
    pub fn add_clip(&mut self, clip_json: &str) -> Result<u32, JsValue> {
        let clip: Clip = serde_json::from_str(clip_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse clip: {}", e)))?;
        
        let id = self.timeline.add_clip(clip);
        Ok(id)
    }

    /// Remove a clip from the timeline
    pub fn remove_clip(&mut self, clip_id: u32) {
        self.timeline.remove_clip(clip_id);
    }

    /// Update a clip's properties
    pub fn update_clip(&mut self, clip_json: &str) -> Result<(), JsValue> {
        let clip: Clip = serde_json::from_str(clip_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse clip: {}", e)))?;
        
        self.timeline.update_clip(clip);
        Ok(())
    }

    /// Split a clip at a specific time
    pub fn split_clip(&mut self, clip_id: u32, split_time: f64) -> Result<u32, JsValue> {
        self.timeline.split_clip(clip_id, split_time)
            .map_err(|e| JsValue::from_str(&e))
    }

    /// Move a clip to a new start time and/or track
    pub fn move_clip(&mut self, clip_id: u32, new_start: f64, new_track: Option<String>) -> Result<(), JsValue> {
        self.timeline.move_clip(clip_id, new_start, new_track)
            .map_err(|e| JsValue::from_str(&e))
    }

    /// Resize a clip (trim start or end)
    pub fn resize_clip(&mut self, clip_id: u32, new_start: Option<f64>, new_end: Option<f64>) -> Result<(), JsValue> {
        self.timeline.resize_clip(clip_id, new_start, new_end)
            .map_err(|e| JsValue::from_str(&e))
    }

    /// Get all clips as JSON
    pub fn get_clips_json(&self) -> String {
        serde_json::to_string(&self.timeline.clips).unwrap_or_else(|_| "[]".to_string())
    }

    /// Get clips that are visible at a specific time
    pub fn get_clips_at_time(&self, time: f64) -> String {
        let clips = self.timeline.get_clips_at_time(time);
        serde_json::to_string(&clips).unwrap_or_else(|_| "[]".to_string())
    }

    /// Calculate which video frame should be shown for a clip at a given time
    /// Returns the source time (in seconds) that should be displayed
    pub fn calculate_source_time(&self, clip_id: u32, global_time: f64) -> Option<f64> {
        self.timeline.calculate_source_time(clip_id, global_time)
    }

    /// Get the total duration of the timeline
    pub fn get_duration(&self) -> f64 {
        self.timeline.get_duration()
    }

    /// Set the preview canvas
    pub fn set_preview_canvas(&mut self, canvas: web_sys::HtmlCanvasElement) {
        self.preview.set_canvas(canvas);
    }

    /// Configure preview settings
    pub fn configure_preview(&mut self, width: u32, height: u32, fps: f64) {
        self.preview.configure(width, height, fps);
    }

    /// Render a frame at the given time
    /// Returns true if rendering was successful
    pub fn render_frame(&self, time: f64) -> bool {
        let active_clips = self.timeline.get_clips_at_time(time);
        self.preview.render_frame(&active_clips, time)
    }

    /// Clear the timeline
    pub fn clear(&mut self) {
        self.timeline.clear();
    }

    /// Get the active video clips that should be rendered at the given time
    /// Returns an array of {clip_id, track_index, source_time, opacity} for compositing
    pub fn get_composition_layers(&self, time: f64) -> String {
        let layers = self.timeline.get_composition_layers(time);
        serde_json::to_string(&layers).unwrap_or_else(|_| "[]".to_string())
    }
}

/// Video frame information for rendering
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FrameInfo {
    pub clip_id: u32,
    pub track_id: String,
    pub track_index: i32,
    pub source_time: f64,
    pub opacity: f64,
    pub transform: Option<VideoTransform>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct VideoTransform {
    pub x: f64,
    pub y: f64,
    pub scale_x: f64,
    pub scale_y: f64,
    pub rotation: f64,
    pub opacity: f64,
}

/// Initialize the WASM module
#[wasm_bindgen(start)]
pub fn start() {
    utils::set_panic_hook();
}
