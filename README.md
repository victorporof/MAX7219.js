MAX7219.js
==========

JavaScript abstraction for the MAX7219 display driver controller. Please read the datasheet for this chip [here](https://www.adafruit.com/datasheets/MAX7219.pdf).

## How to use
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

## Prerequisites

The `node-spi` library is required. Get it from [here](https://github.com/RussTheAerialist/node-spi), or via `npm install spi`.

You'll also need to make sure SPI devices are enabled (and you have a reasonably up-to-date Linux kernel). Here's how you can check this:

Ensure that the SPI driver is enabled:
```
$ dmesg | grep spi
[    3.769841] bcm2708_spi bcm2708_spi.0: master is unqueued, this is deprecated
[    3.793364] bcm2708_spi bcm2708_spi.0: SPI Controller at 0x20204000 (irq 80)
```
The devices are successfully installed in /dev:
```shell
$ ls -l /dev/spi*
crw------- 1 root root 153, 0 Jan  1  2000 /dev/spidev1.0
crw------- 1 root root 153, 1 Jan  1  2000 /dev/spidev2.0
```

### Enabling SPI on the BeagleBone Black

You're going to have to compile some device tree overlays. It's pretty easy, just follow the steps described [here](http://elinux.org/BeagleBone_Black_Enable_SPIDEV).

### Enabling SPI on the Raspberry PI

Easy as PI! Simply `sudo nano /etc/modprobe.d/raspi-blacklist.conf` and add a `#` character in front of the line `spi-bcm2708`. Use CTRL-X, then Y, then Return to save the file and exit. Reboot.

## API

* Constructor __**`MAX7219(device, count, callback)`**__

Initializes an instance of the controller abstraction. The `device` argument is a string specifying the SPI device on which the controller is wired. For example, `"/dev/spidev1.0"`. The optional `count` argument specifies the total number of chips when several MAX7219s are daisy-chained.

* __**`setActiveController(index)`**__

When daisy-chaining MAX7219s, specifies which chip is currently controlled. The `index` parameter is a number identifying the chip to control. By default, the chip at index 0 is controlled.

* __**`getActiveController(index)`**__

Returns which chip is currently controlled.

* __**`startup(callback)`**__

Sets this controller in normal operation mode. On initial power-up, all control registers are reset, the display is blanked, and the MAX7219 enters shutdown mode. This method sets the controller back in normal operation mode.

* __**`shutdown(callback)`**__

Sets this controller in shutdown mode. When the MAX7219 is in shutdown mode, the scan oscillator is halted, all segment current sources are pulled to ground, and the display is blanked.

* __**`startDisplayTest(callback)`**__

Sets this controller in display-test mode. Display-test mode turns all LEDs on by overriding, but not altering, all controls and digit registers (including the shutdown register).

* __**`stopDisplayTest(callback)`**__

Sets this controller back into the previous operation mode.

* __**`setDecodeMode(modes, callback)`**__

Sets this controller's decode mode, specifying how the segments controlled
by the MAX7219 are set on/off. When no-decode is selected, data bits correspond to the segments directly. When decode mode is selected, certain symbols (only `0`-`9`, `E`, `H`, `L`, `P`, and `-`) are encoded in a specific way. This is useful for BCD 7 segment displays. The `modes` argument is an array of decode/no-decode modes for each digit. E.g., to set decode mode for digits 0–3 and no-decode for 4–7, modes would be `[1, 1, 1, 1, 0, 0, 0, 0]`.

* __**`setDecodeNone(callback)`**__

Shortcut for specifying that all digits are in no-decode mode.

* __**`setDecodeAll(callback)`**__

Shortcut for specifying that all digits are in decode mode.

* __**`setDigitSegments(n, segments, callback)`**__

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

* __**`setDigitSegmentsByte(byte, callback)`**__

Same as `setDigitSegments`, but it takes a byte instead of an array of bits.

* __**`setDigitSymbol(n, symbol, callback)`**__

Sets the symbol displayed in a digit.
*For this to work properly, the digit should be in decode mode.* The first parameter, `n` is the digit number, from 0 up to and including 7. The `symbol` parameter is a string specifying the symbol do display: `"0"`..`"9"`, `"E"`, `"H"`, `"L"`, `"P"`, `"-"` or `" "`. The `dp` parameter is a boolean specifying whether the decimal point should be on or off.

* __**`clearDisplay(callback)`**__

Sets all segments for all digits off. This is a shortcut for manually calling `setDigitSegments` or `setDigitSymbol` with the appropriate params. If a decode mode wasn't specifically set beforehand, no-decode mode is assumed.

* __**`setDisplayIntensity(brightness, callback)`**__

Sets digital control of display brightness. The `brightnesss` parameter may be a number from 0 (dimmest) up to and including 15 (brightest).

* __**`setScanLimit(limit, callback)`**__

Sets how many digits are displayed, from 1 digit to 8 digits. The `limit` parameter specifies the number of digits displayed, counting from first to last. E.g., to display only the first digit, limit would be 1. Another e.g., to display only digits 0, 1 and 2, limit would be 3.

#### Callbacks

All methods that have a `callback` argument will invoke that function once the write to the SPI device finishes.

## EOF

Thanks for reading. Happy multiplexing.
