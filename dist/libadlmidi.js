var __typeError = (msg) => {
  throw TypeError(msg);
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

// src/libadlmidi.js
var Emulator = Object.freeze({
  /** Nuked OPL3 v1.8 - Most accurate, higher CPU usage */
  NUKED: 0,
  /** Nuked OPL3 v1.7.4 - Slightly older version */
  NUKED_174: 1,
  /** DosBox OPL3 - Good accuracy, lower CPU usage */
  DOSBOX: 2,
  /** Opal - Reality Adlib Tracker emulator */
  OPAL: 3,
  /** Java OPL3 - Port of emu8950 */
  JAVA: 4,
  /** ESFMu - ESFM chip emulator */
  ESFMU: 5,
  /** MAME OPL2 */
  MAME_OPL2: 6,
  /** YMFM OPL2 */
  YMFM_OPL2: 7,
  /** YMFM OPL3 */
  YMFM_OPL3: 8,
  /** Nuked OPL2 LLE - Transistor-level emulation */
  NUKED_OPL2_LLE: 9,
  /** Nuked OPL3 LLE - Transistor-level emulation */
  NUKED_OPL3_LLE: 10
});
var _ready, _messageHandlers, _AdlMidi_instances, handleMessage_fn, onceMessage_fn, send_fn;
var AdlMidi = class {
  /**
   * Create a new AdlMidi instance
   * @param {AudioContext} [context] - Optional AudioContext to use. Creates one if not provided.
   */
  constructor(context) {
    __privateAdd(this, _AdlMidi_instances);
    /** @type {boolean} */
    __privateAdd(this, _ready, false);
    /** @type {Map<string, Set<Function>>} */
    __privateAdd(this, _messageHandlers, /* @__PURE__ */ new Map());
    this.ctx = context || null;
    this.node = null;
  }
  /**
   * Get the AudioContext (may be null before init)
   * @returns {AudioContext | null}
   */
  get audioContext() {
    return this.ctx;
  }
  /**
   * Check if the synth is ready
   * @returns {boolean}
   */
  get ready() {
    return __privateGet(this, _ready);
  }
  /**
   * Initialize the synthesizer
   * @param {string} processorUrl - URL to the bundled processor JavaScript file
   * @param {string | null} [wasmUrl=null] - Optional URL to the .wasm file for split builds.
   *                             If not provided, assumes bundled version with embedded WASM.
   * @returns {Promise<void>}
   */
  async init(processorUrl, wasmUrl = null) {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: 44100 });
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    let wasmBinary = null;
    const effectiveWasmUrl = wasmUrl || processorUrl.replace(".processor.js", ".core.wasm");
    const response = await fetch(effectiveWasmUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM: ${response.status}`);
    }
    wasmBinary = await response.arrayBuffer();
    await this.ctx.audioWorklet.addModule(processorUrl);
    this.node = new AudioWorkletNode(this.ctx, "adl-midi-processor", {
      processorOptions: {
        sampleRate: this.ctx.sampleRate,
        wasmBinary
        // null for bundled, ArrayBuffer for split
      }
    });
    this.node.connect(this.ctx.destination);
    this.node.port.onmessage = (e) => __privateMethod(this, _AdlMidi_instances, handleMessage_fn).call(this, e.data);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for WASM initialization"));
      }, 1e4);
      __privateMethod(this, _AdlMidi_instances, onceMessage_fn).call(this, "ready", () => {
        clearTimeout(timeout);
        __privateSet(this, _ready, true);
        resolve();
      });
      __privateMethod(this, _AdlMidi_instances, onceMessage_fn).call(
        this,
        "error",
        /** @param {{message: string}} msg */
        (msg) => {
          clearTimeout(timeout);
          reject(new Error(msg.message));
        }
      );
    });
  }
  /**
   * Play a note
   * @param {number} channel - MIDI channel (0-15)
   * @param {number} note - MIDI note number (0-127)
   * @param {number} velocity - Note velocity (0-127)
   */
  noteOn(channel, note, velocity) {
    __privateMethod(this, _AdlMidi_instances, send_fn).call(this, { type: "noteOn", channel, note, velocity });
  }
  /**
   * Stop a note
   * @param {number} channel - MIDI channel (0-15)
   * @param {number} note - MIDI note number (0-127)
   */
  noteOff(channel, note) {
    __privateMethod(this, _AdlMidi_instances, send_fn).call(this, { type: "noteOff", channel, note });
  }
  /**
   * Set pitch bend
   * @param {number} channel - MIDI channel (0-15)
   * @param {number} value - Pitch bend value (0-16383, 8192 = center)
   */
  pitchBend(channel, value) {
    const lsb = value & 127;
    const msb = value >> 7 & 127;
    __privateMethod(this, _AdlMidi_instances, send_fn).call(this, { type: "pitchBend", channel, lsb, msb });
  }
  /**
   * Send a control change
   * @param {number} channel - MIDI channel (0-15)
   * @param {number} controller - Controller number (0-127)
   * @param {number} value - Controller value (0-127)
   */
  controlChange(channel, controller, value) {
    __privateMethod(this, _AdlMidi_instances, send_fn).call(this, { type: "controlChange", channel, controller, value });
  }
  /**
   * Change program (instrument)
   * @param {number} channel - MIDI channel (0-15)
   * @param {number} program - Program number (0-127)
   */
  programChange(channel, program) {
    __privateMethod(this, _AdlMidi_instances, send_fn).call(this, { type: "programChange", channel, program });
  }
  /**
   * Reset the real-time state (stops all notes, resets controllers)
   * @returns {void}
   */
  resetState() {
    __privateMethod(this, _AdlMidi_instances, send_fn).call(this, { type: "resetState" });
  }
  /**
   * Panic - stop all sounds immediately
   * @returns {void}
   */
  panic() {
    __privateMethod(this, _AdlMidi_instances, send_fn).call(this, { type: "panic" });
  }
  /**
   * Configure synth settings at runtime
   * @param {ConfigureSettings} settings - Settings object
   * @returns {Promise<void>}
   */
  async configure(settings) {
    return new Promise((resolve) => {
      __privateMethod(this, _AdlMidi_instances, onceMessage_fn).call(this, "configured", () => resolve());
      __privateMethod(this, _AdlMidi_instances, send_fn).call(this, { type: "configure", settings });
    });
  }
  /**
   * Load a custom bank file (WOPL format)
   * @param {ArrayBuffer} arrayBuffer - Bank file data
   * @returns {Promise<void>}
   */
  async loadBank(arrayBuffer) {
    return new Promise((resolve, reject) => {
      __privateMethod(this, _AdlMidi_instances, onceMessage_fn).call(
        this,
        "bankLoaded",
        /** @param {{success: boolean, error?: string}} msg */
        (msg) => {
          if (msg.success) {
            resolve();
          } else {
            reject(new Error(msg.error || "Failed to load bank"));
          }
        }
      );
      __privateMethod(this, _AdlMidi_instances, send_fn).call(this, { type: "loadBank", data: arrayBuffer });
    });
  }
  /**
   * Set the embedded bank by number
   * @param {number} bank - Bank number
   * @returns {Promise<void>}
   */
  async setBank(bank) {
    return new Promise((resolve, reject) => {
      __privateMethod(this, _AdlMidi_instances, onceMessage_fn).call(
        this,
        "bankSet",
        /** @param {{success: boolean}} msg */
        (msg) => {
          if (msg.success) {
            resolve();
          } else {
            reject(new Error(`Failed to set bank ${bank}`));
          }
        }
      );
      __privateMethod(this, _AdlMidi_instances, send_fn).call(this, { type: "setBank", bank });
    });
  }
  /**
   * Get an instrument from a bank for editing
   * @param {BankId} [bankId] - Bank identifier
   * @param {number} [programNumber] - Program/instrument number (0-127)
   * @returns {Promise<Instrument>} Instrument object with named properties
   */
  async getInstrument(bankId = { percussive: false, msb: 0, lsb: 0 }, programNumber = 0) {
    return new Promise((resolve, reject) => {
      __privateMethod(this, _AdlMidi_instances, onceMessage_fn).call(
        this,
        "instrumentLoaded",
        /** @param {{success: boolean, instrument: Instrument, error?: string}} msg */
        (msg) => {
          if (msg.success) {
            resolve(msg.instrument);
          } else {
            reject(new Error(msg.error || "Failed to get instrument"));
          }
        }
      );
      __privateMethod(this, _AdlMidi_instances, send_fn).call(this, { type: "getInstrument", bankId, programNumber });
    });
  }
  /**
   * Set an instrument in a bank
   * @param {BankId} bankId - Bank identifier
   * @param {number} programNumber - Program/instrument number (0-127)
   * @param {Instrument} instrument - Instrument object with operator parameters
   * @returns {Promise<void>}
   */
  async setInstrument(bankId = { percussive: false, msb: 0, lsb: 0 }, programNumber, instrument) {
    return new Promise((resolve, reject) => {
      __privateMethod(this, _AdlMidi_instances, onceMessage_fn).call(
        this,
        "instrumentSet",
        /** @param {{success: boolean, error?: string}} msg */
        (msg) => {
          if (msg.success) {
            resolve();
          } else {
            reject(new Error(msg.error || "Failed to set instrument"));
          }
        }
      );
      __privateMethod(this, _AdlMidi_instances, send_fn).call(this, { type: "setInstrument", bankId, programNumber, instrument });
    });
  }
  /**
   * Set the number of emulated OPL3 chips
   * @param {number} chips - Number of chips (1-100)
   */
  setNumChips(chips) {
    __privateMethod(this, _AdlMidi_instances, send_fn).call(this, { type: "setNumChips", chips });
  }
  /**
   * Set the volume model
   * @param {number} model - Volume model number
   */
  setVolumeModel(model) {
    __privateMethod(this, _AdlMidi_instances, send_fn).call(this, { type: "setVolumeModel", model });
  }
  /**
   * Enable/disable rhythm mode (percussion)
   * @param {boolean} enabled
   */
  setPercussionMode(enabled) {
    __privateMethod(this, _AdlMidi_instances, send_fn).call(this, { type: "setPercMode", enabled });
  }
  /**
   * Enable/disable deep vibrato
   * @param {boolean} enabled
   */
  setVibrato(enabled) {
    __privateMethod(this, _AdlMidi_instances, send_fn).call(this, { type: "setVibrato", enabled });
  }
  /**
   * Enable/disable deep tremolo
   * @param {boolean} enabled
   */
  setTremolo(enabled) {
    __privateMethod(this, _AdlMidi_instances, send_fn).call(this, { type: "setTremolo", enabled });
  }
  /**
   * Switch the OPL3 emulator core at runtime
   * 
   * Only emulators compiled into the current build profile are available:
   * - nuked profile: NUKED only
   * - dosbox profile: DOSBOX only  
   * - light profile: NUKED, DOSBOX
   * - full profile: NUKED, DOSBOX, OPAL, JAVA, ESFMU, YMFM_OPL2, YMFM_OPL3
   * 
   * @param {number} emulator - Emulator ID from the Emulator enum
   * @returns {Promise<void>} Resolves when emulator is switched, rejects if unavailable
   * @example
   * import { AdlMidi, Emulator } from 'libadlmidi-js';
   * await synth.switchEmulator(Emulator.DOSBOX);
   */
  async switchEmulator(emulator) {
    return new Promise((resolve, reject) => {
      __privateMethod(this, _AdlMidi_instances, onceMessage_fn).call(
        this,
        "emulatorSwitched",
        /** @param {{success: boolean, emulator: number}} msg */
        (msg) => {
          if (msg.success) {
            resolve();
          } else {
            reject(new Error(`Failed to switch to emulator ${emulator}. It may not be available in this build profile.`));
          }
        }
      );
      __privateMethod(this, _AdlMidi_instances, send_fn).call(this, { type: "switchEmulator", emulator });
    });
  }
  /**
   * Get the name of the currently active OPL3 emulator
   * @returns {Promise<string>} Human-readable emulator name (e.g., "Nuked OPL3 (v 1.8)")
   * @example
   * const name = await synth.getEmulatorName();
   * console.log(`Using: ${name}`);
   */
  async getEmulatorName() {
    return new Promise((resolve) => {
      __privateMethod(this, _AdlMidi_instances, onceMessage_fn).call(
        this,
        "emulatorName",
        /** @param {{name: string}} msg */
        (msg) => {
          resolve(msg.name);
        }
      );
      __privateMethod(this, _AdlMidi_instances, send_fn).call(this, { type: "getEmulatorName" });
    });
  }
  /**
   * Reset the synthesizer
   * @returns {void}
   */
  reset() {
    __privateMethod(this, _AdlMidi_instances, send_fn).call(this, { type: "reset" });
  }
  /**
   * Close the synthesizer and release resources
   * @returns {void}
   */
  close() {
    if (this.node) {
      this.node.disconnect();
      this.node = null;
    }
    this._ready = false;
  }
  /**
   * Suspend the AudioContext (save CPU when not in use)
   * @returns {Promise<void>}
   */
  async suspend() {
    if (this.ctx) {
      await this.ctx.suspend();
    }
  }
  /**
   * Resume the AudioContext
   * @returns {Promise<void>}
   */
  async resume() {
    if (this.ctx) {
      await this.ctx.resume();
    }
  }
};
_ready = new WeakMap();
_messageHandlers = new WeakMap();
_AdlMidi_instances = new WeakSet();
/**
 * Internal message handler
 * @param {{type: string}} msg - Message from processor
 */
handleMessage_fn = function(msg) {
  const handlers = __privateGet(this, _messageHandlers).get(msg.type);
  if (handlers) {
    handlers.forEach(
      /** @param {Function} handler */
      (handler) => handler(msg)
    );
  }
};
/**
 * Register a one-time message handler
 * @param {string} type - Message type
 * @param {Function} handler - Handler function
 */
onceMessage_fn = function(type, handler) {
  if (!__privateGet(this, _messageHandlers).has(type)) {
    __privateGet(this, _messageHandlers).set(type, /* @__PURE__ */ new Set());
  }
  const wrappedHandler = (msg) => {
    __privateGet(this, _messageHandlers).get(type)?.delete(wrappedHandler);
    handler(msg);
  };
  __privateGet(this, _messageHandlers).get(type)?.add(wrappedHandler);
};
/**
 * Send a message to the processor
 * @param {Object} msg - Message to send
 */
send_fn = function(msg) {
  if (this.node) {
    this.node.port.postMessage(msg);
  }
};
var libadlmidi_default = AdlMidi;
export {
  AdlMidi,
  Emulator,
  libadlmidi_default as default
};
//# sourceMappingURL=libadlmidi.js.map
