MAX7219.js
==========

JavaScript abstraction for the MAX7219 display driver controller.

Please read the datasheet for this chip [here](https://www.adafruit.com/datasheets/MAX7219.pdf).

#### Example
The "digits and segments" language isn't dissolved away by the API, to make your life easier when wiring the controller. Obviously, you can think of them as "cathodes and anodes" respectively when using this library. Multiplexing and persistence of vision is handled by the MAX7219, you only need to turn anodes on or off. Here's a quick example:
```javascript
var disp = new MAX7219("/dev/spidev1.0");
disp.setDecodeNone();
disp.setScanLimit(8);
disp.startup();
disp.setDigitSegments(0, [0, 0, 1, 1, 0, 1, 1, 1]);
disp.setDigitSegments(1, [0, 1, 0, 0, 1, 1, 1, 1]);
disp.setDigitSegments(2, [0, 0, 0, 0, 1, 1, 1, 0]);
disp.setDigitSegments(3, [0, 1, 1, 0, 0, 1, 1, 1]);
```

Alternatively, using the BCD code font decoding is supported. Here's how to set it up:
```javascript
var disp = new MAX7219("/dev/spidev1.0");
disp.setDecodeAll();
disp.setScanLimit(8);
disp.startup();
disp.setDigitSymbol(0, "H");
disp.setDigitSymbol(1, "E");
disp.setDigitSymbol(2, "L");
disp.setDigitSymbol(3, "P");
```

#### API

* Constructor __**`MAX7219(device)`**__

Initializes an instance of the controller abstraction. The `device` argument is a string specifying the SPI device on which the controller is wired. For example, `"/dev/spidev1.0"`.

* __**`startup()`**__

Sets this controller in normal operation mode. On initial power-up, all control registers are reset, the display is blanked, and the MAX7219 enters shutdown mode. This method sets the controller back in normal operation mode.

* __**`shutdown()`**__

Sets this controller in shutdown mode. When the MAX7219 is in shutdown mode, the scan oscillator is halted, all segment current sources are pulled to ground, and the display is blanked.

* __**`startDisplayTest()`**__

Sets this controller in display-test mode. Display-test mode turns all LEDs on by overriding, but not altering, all controls and digit registers (including the shutdown register).

* __**`stopDisplayTest()`**__

Sets this controller back into the previous operation mode.

* __**`setDecodeMode(modes)`**__

Sets this controller's decode mode, specifying how the segments controlled
by the MAX7219 are set on/off. When no-decode is selected, data bits correspond to the segments directly. When decode mode is selected, certain symbols (only `0`-`9`, `E`, `H`, `L`, `P`, and `-`) are encoded in a specific way. This is useful for BCD 7 segment displays. The `modes` argument is an array of decode/no-decode modes for each digit. E.g., to set decode mode for digits 0–3 and no-decode for 4–7, modes would be `[1, 1, 1, 1, 0, 0, 0, 0]`.

* __**`setDecodeNone()`**__

Shortcut for specifying that all digits are in no-decode mode.

* __**`setDecodeAll()`**__

Shortcut for specifying that all digits are in decode mode.

* __**`setDigitSegments(n, segments)`**__

Sets each segment in a digit on/off.
*For this to work properly, the digit should be in no-decode mode.* The segments are identified as follows:
```
   _a_
 f|   |b
  |_g_|
  |   |
 e|___|c  dp (decimal point)
    d    *
```
The first parameter, `n`, is the digit number, from 0 up to and including 7. The `segments` parameter is a list specifying whether segments are on and off. E.g., to specify `dp`, `c`, `d`, `e` and `g` on, and `a`, `b`, `f` off, segments would be `[1, 0, 0, 1, 1, 1, 0, 1]`, corresponding to the structure `[dp, a, b, c, d, e, f, g]`.

* __**`setDigitSegmentsByte(byte)`**__

Same as `setDigitSegments`, but it takes a byte instead of an array of bits.

* __**`setDigitSymbol(n, symbol)`**__

Sets the symbol displayed in a digit.
*For this to work properly, the digit should be in decode mode.* The first parameter, `n` is the digit number, from 0 up to and including 7. The `symbol` parameter is a string specifying the symbol do display: `"0"`..`"9"`, `"E"`, `"H"`, `"L"`, `"P"`, `"-"` or `" "`. The `dp` parameter is a boolean specifying whether the decimal point should be on or off.

* __**`setDisplayIntensity(brightness)`**__

Sets digital control of display brightness. The `brightness` parameter may be a number from 0 (dimmest) up to and including 15 (brightest).

* __**`setScanLimit(limit)`**__

Sets how many digits are displayed, from 1 digit to 8 digits. The `limit` parameter specifies the number of digits displayed, counting from first to last. E.g., to display only the first digit, limit would be 1. Another e.g., to display only digits 0, 1 and 2, limit would be 3.

* __**`sendNoOpCode(limit)`**__

The no-op register is used when cascading MAX7219s. This method sends one no-op code.
