/* @ts-self-types="./video_editor_core.d.ts" */

export class VideoEditorEngine {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        VideoEditorEngineFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_videoeditorengine_free(ptr, 0);
    }
    /**
     * Add a clip to the timeline
     * @param {string} clip_json
     * @returns {number}
     */
    add_clip(clip_json) {
        const ptr0 = passStringToWasm0(clip_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.videoeditorengine_add_clip(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] >>> 0;
    }
    /**
     * Calculate which video frame should be shown for a clip at a given time
     * Returns the source time (in seconds) that should be displayed
     * @param {number} clip_id
     * @param {number} global_time
     * @returns {number | undefined}
     */
    calculate_source_time(clip_id, global_time) {
        const ret = wasm.videoeditorengine_calculate_source_time(this.__wbg_ptr, clip_id, global_time);
        return ret[0] === 0 ? undefined : ret[1];
    }
    /**
     * Clear the timeline
     */
    clear() {
        wasm.videoeditorengine_clear(this.__wbg_ptr);
    }
    /**
     * Configure preview settings
     * @param {number} width
     * @param {number} height
     * @param {number} fps
     */
    configure_preview(width, height, fps) {
        wasm.videoeditorengine_configure_preview(this.__wbg_ptr, width, height, fps);
    }
    /**
     * Get clips that are visible at a specific time
     * @param {number} time
     * @returns {string}
     */
    get_clips_at_time(time) {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.videoeditorengine_get_clips_at_time(this.__wbg_ptr, time);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Get all clips as JSON
     * @returns {string}
     */
    get_clips_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.videoeditorengine_get_clips_json(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Get the active video clips that should be rendered at the given time
     * Returns an array of {clip_id, track_index, source_time, opacity} for compositing
     * @param {number} time
     * @returns {string}
     */
    get_composition_layers(time) {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.videoeditorengine_get_composition_layers(this.__wbg_ptr, time);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Get the total duration of the timeline
     * @returns {number}
     */
    get_duration() {
        const ret = wasm.videoeditorengine_get_duration(this.__wbg_ptr);
        return ret;
    }
    /**
     * Move a clip to a new start time and/or track
     * @param {number} clip_id
     * @param {number} new_start
     * @param {string | null} [new_track]
     */
    move_clip(clip_id, new_start, new_track) {
        var ptr0 = isLikeNone(new_track) ? 0 : passStringToWasm0(new_track, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        const ret = wasm.videoeditorengine_move_clip(this.__wbg_ptr, clip_id, new_start, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    constructor() {
        const ret = wasm.videoeditorengine_new();
        this.__wbg_ptr = ret >>> 0;
        VideoEditorEngineFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Remove a clip from the timeline
     * @param {number} clip_id
     */
    remove_clip(clip_id) {
        wasm.videoeditorengine_remove_clip(this.__wbg_ptr, clip_id);
    }
    /**
     * Render a frame at the given time
     * Returns true if rendering was successful
     * @param {number} time
     * @returns {boolean}
     */
    render_frame(time) {
        const ret = wasm.videoeditorengine_render_frame(this.__wbg_ptr, time);
        return ret !== 0;
    }
    /**
     * Resize a clip (trim start or end)
     * @param {number} clip_id
     * @param {number | null} [new_start]
     * @param {number | null} [new_end]
     */
    resize_clip(clip_id, new_start, new_end) {
        const ret = wasm.videoeditorengine_resize_clip(this.__wbg_ptr, clip_id, !isLikeNone(new_start), isLikeNone(new_start) ? 0 : new_start, !isLikeNone(new_end), isLikeNone(new_end) ? 0 : new_end);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Set the preview canvas
     * @param {HTMLCanvasElement} canvas
     */
    set_preview_canvas(canvas) {
        wasm.videoeditorengine_set_preview_canvas(this.__wbg_ptr, canvas);
    }
    /**
     * Split a clip at a specific time
     * @param {number} clip_id
     * @param {number} split_time
     * @returns {number}
     */
    split_clip(clip_id, split_time) {
        const ret = wasm.videoeditorengine_split_clip(this.__wbg_ptr, clip_id, split_time);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] >>> 0;
    }
    /**
     * Update a clip's properties
     * @param {string} clip_json
     */
    update_clip(clip_json) {
        const ptr0 = passStringToWasm0(clip_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.videoeditorengine_update_clip(this.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
}
if (Symbol.dispose) VideoEditorEngine.prototype[Symbol.dispose] = VideoEditorEngine.prototype.free;

/**
 * Blend two RGBA colors with alpha compositing
 * Returns [r, g, b, a] values 0-255
 * @param {number} src_r
 * @param {number} src_g
 * @param {number} src_b
 * @param {number} src_a
 * @param {number} dst_r
 * @param {number} dst_g
 * @param {number} dst_b
 * @param {number} dst_a
 * @returns {Uint8Array}
 */
export function blend_colors(src_r, src_g, src_b, src_a, dst_r, dst_g, dst_b, dst_a) {
    const ret = wasm.blend_colors(src_r, src_g, src_b, src_a, dst_r, dst_g, dst_b, dst_a);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * Calculate the optimal preview resolution based on container size
 * while maintaining aspect ratio
 * @param {number} video_width
 * @param {number} video_height
 * @param {number} container_width
 * @param {number} container_height
 * @returns {Uint32Array}
 */
export function calculate_preview_dimensions(video_width, video_height, container_width, container_height) {
    const ret = wasm.calculate_preview_dimensions(video_width, video_height, container_width, container_height);
    var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
}

/**
 * Helper function to create ImageData from RGBA buffer
 * This can be called from JS to create frames for the preview
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} data
 * @returns {ImageData}
 */
export function create_image_data(width, height, data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.create_image_data(width, height, ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Calculate the time from a pixel position on the timeline
 * @param {number} pixel
 * @param {number} pixels_per_second
 * @returns {number}
 */
export function pixel_to_time(pixel, pixels_per_second) {
    const ret = wasm.pixel_to_time(pixel, pixels_per_second);
    return ret;
}

/**
 * Snap a time value to a grid
 * @param {number} time
 * @param {number} grid_interval
 * @returns {number}
 */
export function snap_time(time, grid_interval) {
    const ret = wasm.snap_time(time, grid_interval);
    return ret;
}

/**
 * Calculate frame-accurate time for smooth playback
 * Returns the time snapped to the nearest frame boundary
 * @param {number} time
 * @param {number} fps
 * @returns {number}
 */
export function snap_to_frame(time, fps) {
    const ret = wasm.snap_to_frame(time, fps);
    return ret;
}

/**
 * Initialize the WASM module
 */
export function start() {
    wasm.start();
}

/**
 * Calculate the exact pixel position for a time on the timeline
 * @param {number} time
 * @param {number} pixels_per_second
 * @returns {number}
 */
export function time_to_pixel(time, pixels_per_second) {
    const ret = wasm.time_to_pixel(time, pixels_per_second);
    return ret;
}

function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_6ddd609b62940d55: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_clearRect_ea4f3d34d76f4bc5: function(arg0, arg1, arg2, arg3, arg4) {
            arg0.clearRect(arg1, arg2, arg3, arg4);
        },
        __wbg_error_a6fa202b58aa1cd3: function(arg0, arg1) {
            let deferred0_0;
            let deferred0_1;
            try {
                deferred0_0 = arg0;
                deferred0_1 = arg1;
                console.error(getStringFromWasm0(arg0, arg1));
            } finally {
                wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
            }
        },
        __wbg_fillRect_4e5596ca954226e7: function(arg0, arg1, arg2, arg3, arg4) {
            arg0.fillRect(arg1, arg2, arg3, arg4);
        },
        __wbg_getContext_f04bf8f22dcb2d53: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.getContext(getStringFromWasm0(arg1, arg2));
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        }, arguments); },
        __wbg_instanceof_CanvasRenderingContext2d_08b9d193c22fa886: function(arg0) {
            let result;
            try {
                result = arg0 instanceof CanvasRenderingContext2D;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_new_227d7c05414eb861: function() {
            const ret = new Error();
            return ret;
        },
        __wbg_new_with_u8_clamped_array_and_sh_5d9be5b17e50951c: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = new ImageData(getClampedArrayU8FromWasm0(arg0, arg1), arg2 >>> 0, arg3 >>> 0);
            return ret;
        }, arguments); },
        __wbg_set_fillStyle_58417b6b548ae475: function(arg0, arg1, arg2) {
            arg0.fillStyle = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_height_b6548a01bdcb689a: function(arg0, arg1) {
            arg0.height = arg1 >>> 0;
        },
        __wbg_set_width_c0fcaa2da53cd540: function(arg0, arg1) {
            arg0.width = arg1 >>> 0;
        },
        __wbg_stack_3b0d974bbf31e44f: function(arg0, arg1) {
            const ret = arg1.stack;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbindgen_cast_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./video_editor_core_bg.js": import0,
    };
}

const VideoEditorEngineFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_videoeditorengine_free(ptr >>> 0, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function getArrayU32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

function getClampedArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ClampedArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

let cachedUint8ClampedArrayMemory0 = null;
function getUint8ClampedArrayMemory0() {
    if (cachedUint8ClampedArrayMemory0 === null || cachedUint8ClampedArrayMemory0.byteLength === 0) {
        cachedUint8ClampedArrayMemory0 = new Uint8ClampedArray(wasm.memory.buffer);
    }
    return cachedUint8ClampedArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    cachedUint8ClampedArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('video_editor_core_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
