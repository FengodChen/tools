use wasm_bindgen::prelude::*;
use web_sys::{HtmlCanvasElement, CanvasRenderingContext2d, ImageData};
use crate::timeline::Clip;

pub struct PreviewEngine {
    canvas: Option<HtmlCanvasElement>,
    context: Option<CanvasRenderingContext2d>,
    width: u32,
    height: u32,
    fps: f64,
}

impl PreviewEngine {
    pub fn new() -> Self {
        Self {
            canvas: None,
            context: None,
            width: 1920,
            height: 1080,
            fps: 30.0,
        }
    }

    pub fn set_canvas(&mut self, canvas: HtmlCanvasElement) {
        // Get 2D context
        if let Ok(Some(context)) = canvas.get_context("2d") {
            if let Ok(ctx) = context.dyn_into::<CanvasRenderingContext2d>() {
                self.context = Some(ctx);
            }
        }
        self.canvas = Some(canvas);
    }

    pub fn configure(&mut self, width: u32, height: u32, fps: f64) {
        self.width = width;
        self.height = height;
        self.fps = fps;
        
        // Update canvas size if available
        if let Some(canvas) = &self.canvas {
            canvas.set_width(width);
            canvas.set_height(height);
        }
    }

    /// Render a frame with the given active clips
    /// Note: Actual video frame extraction is done in JavaScript using video elements
    /// This method prepares the canvas and returns composition information
    pub fn render_frame(&self, _clips: &[&Clip], _time: f64) -> bool {
        let Some(ctx) = &self.context else {
            return false;
        };

        // Clear canvas
        ctx.clear_rect(0.0, 0.0, self.width as f64, self.height as f64);
        
        // Fill with black background
        ctx.set_fill_style_str("#000000");
        ctx.fill_rect(0.0, 0.0, self.width as f64, self.height as f64);

        // Sort clips by track (assuming lower track numbers are bottom layers)
        // This is a placeholder - actual rendering happens in JS
        
        true
    }

    pub fn get_canvas_dimensions(&self) -> (u32, u32) {
        (self.width, self.height)
    }

    pub fn get_fps(&self) -> f64 {
        self.fps
    }

    /// Calculate the frame number from time
    pub fn time_to_frame(&self, time: f64) -> u32 {
        (time * self.fps).round() as u32
    }

    /// Calculate time from frame number
    pub fn frame_to_time(&self, frame: u32) -> f64 {
        frame as f64 / self.fps
    }
}

/// Helper function to create ImageData from RGBA buffer
/// This can be called from JS to create frames for the preview
#[wasm_bindgen]
pub fn create_image_data(width: u32, height: u32, data: &[u8]) -> Result<ImageData, JsValue> {
    ImageData::new_with_u8_clamped_array_and_sh(
        wasm_bindgen::Clamped(data),
        width,
        height
    )
}

/// Calculate the exact pixel position for a time on the timeline
#[wasm_bindgen]
pub fn time_to_pixel(time: f64, pixels_per_second: f64) -> f64 {
    time * pixels_per_second
}

/// Calculate the time from a pixel position on the timeline
#[wasm_bindgen]
pub fn pixel_to_time(pixel: f64, pixels_per_second: f64) -> f64 {
    if pixels_per_second <= 0.0 {
        return 0.0;
    }
    pixel / pixels_per_second
}

/// Snap a time value to a grid
#[wasm_bindgen]
pub fn snap_time(time: f64, grid_interval: f64) -> f64 {
    if grid_interval <= 0.0 {
        return time;
    }
    (time / grid_interval).round() * grid_interval
}

/// Calculate frame-accurate time for smooth playback
/// Returns the time snapped to the nearest frame boundary
#[wasm_bindgen]
pub fn snap_to_frame(time: f64, fps: f64) -> f64 {
    if fps <= 0.0 {
        return time;
    }
    let frame = (time * fps).round();
    frame / fps
}

/// Blend two RGBA colors with alpha compositing
/// Returns [r, g, b, a] values 0-255
#[wasm_bindgen]
pub fn blend_colors(
    src_r: u8, src_g: u8, src_b: u8, src_a: u8,
    dst_r: u8, dst_g: u8, dst_b: u8, dst_a: u8
) -> Vec<u8> {
    let src_alpha = src_a as f64 / 255.0;
    let dst_alpha = dst_a as f64 / 255.0;
    
    // Premultiplied alpha compositing
    let out_alpha = src_alpha + dst_alpha * (1.0 - src_alpha);
    
    if out_alpha <= 0.0 {
        return vec![0, 0, 0, 0];
    }
    
    let out_r = ((src_r as f64 * src_alpha + dst_r as f64 * dst_alpha * (1.0 - src_alpha)) / out_alpha).round() as u8;
    let out_g = ((src_g as f64 * src_alpha + dst_g as f64 * dst_alpha * (1.0 - src_alpha)) / out_alpha).round() as u8;
    let out_b = ((src_b as f64 * src_alpha + dst_b as f64 * dst_alpha * (1.0 - src_alpha)) / out_alpha).round() as u8;
    let out_a = (out_alpha * 255.0).round() as u8;
    
    vec![out_r, out_g, out_b, out_a]
}

/// Calculate the optimal preview resolution based on container size
/// while maintaining aspect ratio
#[wasm_bindgen]
pub fn calculate_preview_dimensions(
    video_width: u32,
    video_height: u32,
    container_width: u32,
    container_height: u32,
) -> Vec<u32> {
    if video_width == 0 || video_height == 0 {
        return vec![container_width, container_height];
    }
    
    let video_aspect = video_width as f64 / video_height as f64;
    let container_aspect = container_width as f64 / container_height as f64;
    
    let (new_width, new_height) = if video_aspect > container_aspect {
        // Video is wider - fit to container width
        let w = container_width;
        let h = (container_width as f64 / video_aspect).round() as u32;
        (w, h)
    } else {
        // Video is taller - fit to container height
        let w = (container_height as f64 * video_aspect).round() as u32;
        let h = container_height;
        (w, h)
    };
    
    vec![new_width, new_height]
}
