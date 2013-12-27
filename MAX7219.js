"use strict";

var fs = require("fs");
var SPI = require("spi");

/**
 * MAX7219 abstraction.
 * Please read the datasheet: https://www.adafruit.com/datasheets/MAX7219.pdf
 *
 * Example use:
 *  var disp = new MAX7219("/dev/spidev1.0");
 *  disp.setDecodeNone();
 *  disp.setScanLimit(8);
 *  disp.startup();
 *  disp.setDigitSegments(0, [0, 0, 1, 1, 0, 1, 1, 1]);
 *  disp.setDigitSegments(1, [0, 1, 0, 0, 1, 1, 1, 1]);
 *  disp.setDigitSegments(2, [0, 0, 0, 0, 1, 1, 1, 0]);
 *  disp.setDigitSegments(3, [0, 1, 1, 0, 0, 1, 1, 1]);
 *
 * Alternate use:
 *  var disp = new MAX7219("/dev/spidev1.0");
 *  disp.setDecodeAll();
 *  disp.setScanLimit(8);
 *  disp.startup();
 *  disp.setDigitSymbol(0, "H");
 *  disp.setDigitSymbol(1, "E");
 *  disp.setDigitSymbol(2, "L");
 *  disp.setDigitSymbol(3, "P");
 *
 * @param string device
 *        The SPI device on which the controller is wired.
 *        For example, "/dev/spidev1.0".
 * @param number count [optional]
 *        The total number of controllers when daisy-chained. Defaults to 1.
 */
function MAX7219(device, count) {
  this._activeController = 0;
  this._totalControllers = count || 1;
  this._buffer = new Buffer(this._totalControllers * 2);

  this._spi = new SPI.Spi(device, {
    mode: SPI.MODE.MODE_0,
    chipSelect: SPI.CS.low
  }, function(s) {
    s.open();
  });
}

/**
 * Controller registers, as specified in the datasheet.
 * Don't modify this.
 */
MAX7219._Registers = {
  NoOp: 0x00,
  Digit0: 0x01,
  Digit1: 0x02,
  Digit2: 0x03,
  Digit3: 0x04,
  Digit4: 0x05,
  Digit5: 0x06,
  Digit6: 0x07,
  Digit7: 0x08,
  DecodeMode: 0x09,
  Intensity: 0x0a,
  ScanLimit: 0x0b,
  Shutdown: 0x0c,
  DisplayTest: 0x0f
};

/**
 * Controller BCD code font, as specified in the datasheet.
 * Don't modify this.
 */
MAX7219._Font = {
  "0": 0x00,
  "1": 0x01,
  "2": 0x02,
  "3": 0x03,
  "4": 0x04,
  "5": 0x05,
  "6": 0x06,
  "7": 0x07,
  "8": 0x08,
  "9": 0x09,
  "-": 0x0a,
  "E": 0x0b,
  "H": 0x0c,
  "L": 0x0d,
  "P": 0x0e,
  " ": 0x0f
};

MAX7219.prototype = {
  /**
   * When daisy-chaining MAX7219s, specifies which chip is currently controlled.
   *
   * @param number index
   *        The index of the chip to control.
   */
  setActiveController: function(index) {
    if (index < 0 || index >= this._totalControllers) {
      throw "Controller index is out of bounds";
    }
    this._activeController = index;
  },

  /**
   * Returns which chip is currently controlled.
   */
  getActiveController: function() {
    return this._activeController;
  },

  /**
   * Sets this controller in normal operation mode.
   *
   * On initial power-up, all control registers are reset, the display is
   * blanked, and the MAX7219 enters shutdown mode. This method sets
   * the controller back in normal operation mode.
   */
  startup: function() {
    this._shiftOut(MAX7219._Registers.Shutdown, 0x01);
  },

  /**
   * Sets this controller in shutdown mode.
   *
   * When the MAX7219 is in shutdown mode, the scan oscillator is halted, all
   * segment current sources are pulled to ground, and the display is blanked.
   */
  shutdown: function() {
    this._shiftOut(MAX7219._Registers.Shutdown, 0x00);
  },

  /**
   * Sets this controller in display-test mode.
   *
   * Display-test mode turns all LEDs on by overriding, but not altering, all
   * controls and digit registers (including the shutdown register).
   */
  startDisplayTest: function() {
    this._shiftOut(MAX7219._Registers.DisplayTest, 0x01);
  },

  /**
   * Sets this controller back into the previous operation mode.
   */
  stopDisplayTest: function() {
    this._shiftOut(MAX7219._Registers.DisplayTest, 0x00);
  },

  /**
   * Sets this controller's decode mode, specifying how the segments controlled
   * by the MAX7219 are set on/off.
   *
   * When no-decode is selected, data bits correspond to the segments directly.
   * When decode mode is selected, certain symbols (only 0-9, E, H, L, P, and -)
   * are encoded in a specific way. This is useful for BCD 7 segment displays.
   *
   * @param array modes
   *        An array of decode/no-decode modes for each digit.
   *        E.g., to set decode mode for digits 0–3 and no-decode for 4–7,
   *        modes would be [1,1,1,1,0,0,0,0].
   */
  setDecodeMode: function(modes) {
    if (modes.length != 8) {
      throw "Invalid decode mode array";
    }
    this._decodeModes = modes;
    this._shiftOut(MAX7219._Registers.DecodeMode, this.encodeByte(modes));
  },

  /**
   * Shortcut for specifying that all digits are in no-decode mode.
   */
  setDecodeNone: function() {
    this.setDecodeMode([0,0,0,0,0,0,0,0])
  },

  /**
   * Shortcut for specifying that all digits are in decode mode.
   */
  setDecodeAll: function() {
    this.setDecodeMode([1,1,1,1,1,1,1,1])
  },

  /**
   * Sets each segment in a digit on/off.
   * For this to work properly, the digit should be in no-decode mode.
   *
   * The segments are identified as follows:
   *    _a_
   *  f|   |b
   *   |_g_|
   *   |   |
   *  e|___|c  dp (decimal point)
   *     d    *
   *
   * @param number n
   *        The digit number, from 0 up to and including 7.
   * @param array segments
   *        A list specifying whether segments are on and off.
   *        E.g., to specify dp, c, d, e and g on, and a, b, f off,
   *        segments would be [1, 0, 0, 1, 1, 1, 0, 1], corresponding
   *        to the structure [dp, a, b, c, d, e, f, g].
   */
  setDigitSegments: function(n, segments) {
    if (n < 0 || n > 7) {
      throw "Invalid digit number";
    }
    if (segments.length != 8) {
      throw "Invalid segments array";
    }
    this.setDigitSegmentsByte(n, this.encodeByte(segments));
  },

  /**
   * Same as setDigitSegments, but it takes a byte instead of an array of bits.
   */
  setDigitSegmentsByte: function(n, byte) {
    this._shiftOut(MAX7219._Registers["Digit" + n], byte);
  },

  /**
   * Sets the symbol displayed in a digit.
   * For this to work properly, the digit should be in decode mode.
   *
   * @param number n
   *        The digit number, from 0 up to and including 7.
   * @param string symbol
   *        The symbol do display: "0".."9", "E", "H", "L", "P", "-" or " ".
   * @param boolean dp
   *        Specifies if the decimal point should be on or off.
   */
  setDigitSymbol: function(n, symbol, dp) {
    if (n < 0 || n > 7) {
      throw "Invalid digit number";
    }
    if (!(symbol in MAX7219._Font)) {
      throw "Invalid symbol string";
    }
    var byte = MAX7219._Font[symbol] | (dp ? (1 << 7) : 0);
    this._shiftOut(MAX7219._Registers["Digit" + n], byte);
  },

  /**
   * Sets all segments for all digits off.
   *
   * Shortcut for manually calling setDigitSegments or setDigitSymbol
   * with the appropriate params. If a decode mode wasn't specifically set
   * beforehand, no-decode mode is assumed.
   */
  clearDisplay: function() {
    if (!this._decodeModes) {
      this.setDecodeNone();
    }

    for (var i = 0; i < this._decodeModes.length; i++) {
      var mode = this._decodeModes[i];
      if (mode == 0) {
        this.setDigitSegmentsByte(i, 0x00);
      } else {
        this.setDigitSymbol(i, " ", false);
      }
    }
  },

  /**
   * Sets digital control of display brightness.
   *
   * @param number brightness
   *        The brightness from 0 (dimmest) up to and including 15 (brightest).
   */
  setDisplayIntensity: function(brightness) {
    if (brightness < 0 || brightness > 15) {
      throw "Invalid brightness number";
    }
    this._shiftOut(MAX7219._Registers.Intensity, brightness);
  },

  /**
   * Sets how many digits are displayed, from 1 digit to 8 digits.
   *
   * @param number limit
   *        The number of digits displayed, counting from first to last.
   *        E.g., to display only the first digit, limit would be 1.
   *        E.g., to display only digits 0, 1 and 2, limit would be 3.
   */
  setScanLimit: function(limit) {
    if (limit < 1 || limit > 8) {
      throw "Invalid scan limit number";
    }
    this._shiftOut(MAX7219._Registers.ScanLimit, limit - 1);
  },

  /**
   * Utility function. Returns a byte having the specified bits.
   *
   * @param array bits
   *        An array of 7 bits.
   * @return number
   *         The corresponding byte.
   *         E.g., [1,1,0,1,0,1,0,1] returns 213, or "11010101" in binary.
   */
  encodeByte: function(bits) {
    return bits[0] +
          (bits[1] << 1) +
          (bits[2] << 2) +
          (bits[3] << 3) +
          (bits[4] << 4) +
          (bits[5] << 5) +
          (bits[6] << 6) +
          (bits[7] << 7);
  },

  /**
   * Shifts two bytes to the SPI device.
   *
   * @param number firstByte
   *        The first byte, as a number.
   * @param number secondByte
   *        The second byte, as a number.
   */
  _shiftOut: function(firstByte, secondByte) {
    if (!this._spi) {
      throw "SPI device not initialized";
    }

    for (var i = 0; i < this._buffer.length; i += 2) {
      this._buffer[i] = MAX7219._Registers.NoOp;
      this._buffer[i + 1] = 0x00;
    }

    var offset = this._activeController * 2;
    this._buffer[offset] = firstByte;
    this._buffer[offset + 1] = secondByte;

    this._spi.write(this._buffer);
  }
};

module.exports = MAX7219;
