/* tslint:disable */
/* eslint-disable */

export class VideoEditorEngine {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Add a clip to the timeline
     */
    add_clip(clip_json: string): number;
    /**
     * Calculate which video frame should be shown for a clip at a given time
     * Returns the source time (in seconds) that should be displayed
     */
    calculate_source_time(clip_id: number, global_time: number): number | undefined;
    /**
     * Clear the timeline
     */
    clear(): void;
    /**
     * Configure preview settings
     */
    configure_preview(width: number, height: number, fps: number): void;
    /**
     * Get clips that are visible at a specific time
     */
    get_clips_at_time(time: number): string;
    /**
     * Get all clips as JSON
     */
    get_clips_json(): string;
    /**
     * Get the active video clips that should be rendered at the given time
     * Returns an array of {clip_id, track_index, source_time, opacity} for compositing
     */
    get_composition_layers(time: number): string;
    /**
     * Get the total duration of the timeline
     */
    get_duration(): number;
    /**
     * Move a clip to a new start time and/or track
     */
    move_clip(clip_id: number, new_start: number, new_track?: string | null): void;
    constructor();
    /**
     * Remove a clip from the timeline
     */
    remove_clip(clip_id: number): void;
    /**
     * Render a frame at the given time
     * Returns true if rendering was successful
     */
    render_frame(time: number): boolean;
    /**
     * Resize a clip (trim start or end)
     */
    resize_clip(clip_id: number, new_start?: number | null, new_end?: number | null): void;
    /**
     * Set the preview canvas
     */
    set_preview_canvas(canvas: HTMLCanvasElement): void;
    /**
     * Split a clip at a specific time
     */
    split_clip(clip_id: number, split_time: number): number;
    /**
     * Update a clip's properties
     */
    update_clip(clip_json: string): void;
}

/**
 * Blend two RGBA colors with alpha compositing
 * Returns [r, g, b, a] values 0-255
 */
export function blend_colors(src_r: number, src_g: number, src_b: number, src_a: number, dst_r: number, dst_g: number, dst_b: number, dst_a: number): Uint8Array;

/**
 * Calculate the optimal preview resolution based on container size
 * while maintaining aspect ratio
 */
export function calculate_preview_dimensions(video_width: number, video_height: number, container_width: number, container_height: number): Uint32Array;

/**
 * Helper function to create ImageData from RGBA buffer
 * This can be called from JS to create frames for the preview
 */
export function create_image_data(width: number, height: number, data: Uint8Array): ImageData;

/**
 * Calculate the time from a pixel position on the timeline
 */
export function pixel_to_time(pixel: number, pixels_per_second: number): number;

/**
 * Snap a time value to a grid
 */
export function snap_time(time: number, grid_interval: number): number;

/**
 * Calculate frame-accurate time for smooth playback
 * Returns the time snapped to the nearest frame boundary
 */
export function snap_to_frame(time: number, fps: number): number;

/**
 * Initialize the WASM module
 */
export function start(): void;

/**
 * Calculate the exact pixel position for a time on the timeline
 */
export function time_to_pixel(time: number, pixels_per_second: number): number;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_videoeditorengine_free: (a: number, b: number) => void;
    readonly videoeditorengine_add_clip: (a: number, b: number, c: number) => [number, number, number];
    readonly videoeditorengine_calculate_source_time: (a: number, b: number, c: number) => [number, number];
    readonly videoeditorengine_clear: (a: number) => void;
    readonly videoeditorengine_configure_preview: (a: number, b: number, c: number, d: number) => void;
    readonly videoeditorengine_get_clips_at_time: (a: number, b: number) => [number, number];
    readonly videoeditorengine_get_clips_json: (a: number) => [number, number];
    readonly videoeditorengine_get_composition_layers: (a: number, b: number) => [number, number];
    readonly videoeditorengine_get_duration: (a: number) => number;
    readonly videoeditorengine_move_clip: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly videoeditorengine_new: () => number;
    readonly videoeditorengine_remove_clip: (a: number, b: number) => void;
    readonly videoeditorengine_render_frame: (a: number, b: number) => number;
    readonly videoeditorengine_resize_clip: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly videoeditorengine_set_preview_canvas: (a: number, b: any) => void;
    readonly videoeditorengine_split_clip: (a: number, b: number, c: number) => [number, number, number];
    readonly videoeditorengine_update_clip: (a: number, b: number, c: number) => [number, number];
    readonly start: () => void;
    readonly blend_colors: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number];
    readonly calculate_preview_dimensions: (a: number, b: number, c: number, d: number) => [number, number];
    readonly create_image_data: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly pixel_to_time: (a: number, b: number) => number;
    readonly snap_time: (a: number, b: number) => number;
    readonly snap_to_frame: (a: number, b: number) => number;
    readonly time_to_pixel: (a: number, b: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
