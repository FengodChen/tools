use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TrackType {
    Video,
    Audio,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Clip {
    pub id: u32,
    #[serde(rename = "type")]
    pub clip_type: String,
    pub track: String,
    pub name: String,
    pub start_time: f64,
    pub end_time: f64,
    pub src_start: f64,
    pub src_end: f64,
    pub duration: f64,
    pub volume: f64,
    pub speed: f64,
    pub locked: bool,
    pub muted: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
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

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Track {
    pub id: String,
    pub track_type: TrackType,
    pub index: i32,
    pub visible: bool,
    pub locked: bool,
    pub muted: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CompositionLayer {
    pub clip_id: u32,
    pub track_id: String,
    pub track_index: i32,
    pub source_time: f64,
    pub opacity: f64,
    pub z_index: i32,
}

pub struct Timeline {
    pub clips: Vec<Clip>,
    pub tracks: Vec<Track>,
    next_clip_id: u32,
}

impl Timeline {
    pub fn new() -> Self {
        let mut tracks = Vec::new();
        
        // Default video tracks
        tracks.push(Track {
            id: "video1".to_string(),
            track_type: TrackType::Video,
            index: 0,
            visible: true,
            locked: false,
            muted: false,
        });
        tracks.push(Track {
            id: "video2".to_string(),
            track_type: TrackType::Video,
            index: 1,
            visible: true,
            locked: false,
            muted: false,
        });
        
        // Default audio tracks
        tracks.push(Track {
            id: "audio1".to_string(),
            track_type: TrackType::Audio,
            index: 2,
            visible: true,
            locked: false,
            muted: false,
        });
        tracks.push(Track {
            id: "audio2".to_string(),
            track_type: TrackType::Audio,
            index: 3,
            visible: true,
            locked: false,
            muted: false,
        });
        
        Self {
            clips: Vec::new(),
            tracks,
            next_clip_id: 1,
        }
    }

    pub fn add_clip(&mut self, mut clip: Clip) -> u32 {
        if clip.id == 0 {
            clip.id = self.next_clip_id;
            self.next_clip_id += 1;
        } else {
            self.next_clip_id = self.next_clip_id.max(clip.id + 1);
        }
        
        let id = clip.id;
        self.clips.push(clip);
        id
    }

    pub fn remove_clip(&mut self, clip_id: u32) {
        self.clips.retain(|c| c.id != clip_id);
    }

    pub fn update_clip(&mut self, updated_clip: Clip) {
        if let Some(clip) = self.clips.iter_mut().find(|c| c.id == updated_clip.id) {
            *clip = updated_clip;
        }
    }

    pub fn split_clip(&mut self, clip_id: u32, split_time: f64) -> Result<u32, String> {
        let clip_idx = self.clips.iter().position(|c| c.id == clip_id)
            .ok_or_else(|| "Clip not found".to_string())?;
        
        let clip = &self.clips[clip_idx];
        
        // Check if split point is within the clip
        if split_time <= clip.start_time || split_time >= clip.end_time {
            return Err("Split point must be within clip bounds".to_string());
        }
        
        let split_offset = split_time - clip.start_time;
        let src_split_point = clip.src_start + (split_offset * clip.speed);
        
        // Create second part
        let new_id = self.next_clip_id;
        self.next_clip_id += 1;
        
        let second_part = Clip {
            id: new_id,
            clip_type: clip.clip_type.clone(),
            track: clip.track.clone(),
            name: format!("{} (2)", clip.name),
            start_time: split_time,
            end_time: clip.end_time,
            src_start: src_split_point,
            src_end: clip.src_end,
            duration: clip.duration,
            volume: clip.volume,
            speed: clip.speed,
            locked: clip.locked,
            muted: clip.muted,
            transform: clip.transform.clone(),
        };
        
        // Update first part
        let first_part = &mut self.clips[clip_idx];
        first_part.end_time = split_time;
        first_part.src_end = src_split_point;
        
        // Add second part
        self.clips.push(second_part);
        
        Ok(new_id)
    }

    pub fn move_clip(&mut self, clip_id: u32, new_start: f64, new_track: Option<String>) -> Result<(), String> {
        let clip = self.clips.iter_mut().find(|c| c.id == clip_id)
            .ok_or_else(|| "Clip not found".to_string())?;
        
        if clip.locked {
            return Err("Clip is locked".to_string());
        }
        
        let duration = clip.end_time - clip.start_time;
        clip.start_time = new_start.max(0.0);
        clip.end_time = clip.start_time + duration;
        
        if let Some(track) = new_track {
            clip.track = track;
        }
        
        Ok(())
    }

    pub fn resize_clip(&mut self, clip_id: u32, new_start: Option<f64>, new_end: Option<f64>) -> Result<(), String> {
        let clip = self.clips.iter_mut().find(|c| c.id == clip_id)
            .ok_or_else(|| "Clip not found".to_string())?;
        
        if clip.locked {
            return Err("Clip is locked".to_string());
        }
        
        if let Some(start) = new_start {
            // Adjust src_start proportionally
            let time_shift = start - clip.start_time;
            clip.src_start = (clip.src_start + time_shift * clip.speed).max(0.0);
            clip.start_time = start;
        }
        
        if let Some(end) = new_end {
            clip.end_time = end;
        }
        
        // Ensure start < end
        if clip.start_time >= clip.end_time {
            clip.end_time = clip.start_time + 0.1;
        }
        
        Ok(())
    }

    /// Get all clips that intersect with the given time point
    pub fn get_clips_at_time(&self, time: f64) -> Vec<&Clip> {
        self.clips.iter()
            .filter(|c| time >= c.start_time && time < c.end_time && !c.muted)
            .collect()
    }

    /// Calculate the source time for a clip at a given global time
    pub fn calculate_source_time(&self, clip_id: u32, global_time: f64) -> Option<f64> {
        let clip = self.clips.iter().find(|c| c.id == clip_id)?;
        
        if global_time < clip.start_time || global_time >= clip.end_time {
            return None;
        }
        
        let offset = global_time - clip.start_time;
        let source_time = clip.src_start + (offset * clip.speed);
        
        Some(source_time.min(clip.src_end))
    }

    /// Get composition layers for rendering at a specific time
    /// Returns layers sorted by track order (bottom to top)
    pub fn get_composition_layers(&self, time: f64) -> Vec<CompositionLayer> {
        let mut layers = Vec::new();
        
        for clip in &self.clips {
            if clip.muted || time < clip.start_time || time >= clip.end_time {
                continue;
            }
            
            // Find track index
            if let Some(track) = self.tracks.iter().find(|t| t.id == clip.track) {
                if !track.visible {
                    continue;
                }
                
                let offset = time - clip.start_time;
                let source_time = clip.src_start + (offset * clip.speed);
                
                if source_time <= clip.src_end {
                    layers.push(CompositionLayer {
                        clip_id: clip.id,
                        track_id: clip.track.clone(),
                        track_index: track.index,
                        source_time,
                        opacity: clip.transform.as_ref().map(|t| t.opacity).unwrap_or(1.0),
                        z_index: track.index,
                    });
                }
            }
        }
        
        // Sort by track index (lower tracks rendered first)
        layers.sort_by_key(|l| l.z_index);
        
        layers
    }

    pub fn get_duration(&self) -> f64 {
        self.clips.iter()
            .map(|c| c.end_time)
            .fold(0.0, f64::max)
    }

    pub fn clear(&mut self) {
        self.clips.clear();
        self.next_clip_id = 1;
    }

    pub fn get_track_index(&self, track_id: &str) -> Option<i32> {
        self.tracks.iter().find(|t| t.id == track_id).map(|t| t.index)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_clip(id: u32, start: f64, end: f64) -> Clip {
        Clip {
            id,
            clip_type: "video".to_string(),
            track: "video1".to_string(),
            name: format!("Clip {}", id),
            start_time: start,
            end_time: end,
            src_start: 0.0,
            src_end: end - start,
            duration: end - start,
            volume: 100.0,
            speed: 1.0,
            locked: false,
            muted: false,
            transform: None,
        }
    }

    #[test]
    fn test_add_clip() {
        let mut timeline = Timeline::new();
        let clip = create_test_clip(0, 0.0, 10.0);
        let id = timeline.add_clip(clip);
        
        assert_eq!(id, 1);
        assert_eq!(timeline.clips.len(), 1);
    }

    #[test]
    fn test_split_clip() {
        let mut timeline = Timeline::new();
        let clip = create_test_clip(0, 0.0, 10.0);
        let id = timeline.add_clip(clip);
        
        let new_id = timeline.split_clip(id, 5.0).unwrap();
        
        assert_eq!(timeline.clips.len(), 2);
        assert_eq!(timeline.clips[0].end_time, 5.0);
        assert_eq!(timeline.clips[1].start_time, 5.0);
        assert_eq!(timeline.clips[1].id, new_id);
    }

    #[test]
    fn test_get_clips_at_time() {
        let mut timeline = Timeline::new();
        timeline.add_clip(create_test_clip(0, 0.0, 5.0));
        timeline.add_clip(create_test_clip(0, 3.0, 8.0));
        
        let clips = timeline.get_clips_at_time(4.0);
        assert_eq!(clips.len(), 2);
        
        let clips = timeline.get_clips_at_time(6.0);
        assert_eq!(clips.len(), 1);
    }

    #[test]
    fn test_calculate_source_time() {
        let mut timeline = Timeline::new();
        let mut clip = create_test_clip(0, 5.0, 15.0);
        clip.src_start = 10.0;
        clip.src_end = 20.0;
        let id = timeline.add_clip(clip);
        
        // At global time 5, we should be at source time 10
        assert_eq!(timeline.calculate_source_time(id, 5.0), Some(10.0));
        
        // At global time 10, we should be at source time 15
        assert_eq!(timeline.calculate_source_time(id, 10.0), Some(15.0));
    }
}
