(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // is webkit? http://stackoverflow.com/a/16459606/376773
  return ('WebkitAppearance' in document.documentElement.style) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (window.console && (console.firebug || (console.exception && console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  return JSON.stringify(v);
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs() {
  var args = arguments;
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return args;

  var c = 'color: ' + this.color;
  args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
  return args;
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}
  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage(){
  try {
    return window.localStorage;
  } catch (e) {}
}

},{"./debug":2}],2:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lowercased letter, i.e. "n".
 */

exports.formatters = {};

/**
 * Previously assigned color.
 */

var prevColor = 0;

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 *
 * @return {Number}
 * @api private
 */

function selectColor() {
  return exports.colors[prevColor++ % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function debug(namespace) {

  // define the `disabled` version
  function disabled() {
  }
  disabled.enabled = false;

  // define the `enabled` version
  function enabled() {

    var self = enabled;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // add the `color` if not set
    if (null == self.useColors) self.useColors = exports.useColors();
    if (null == self.color && self.useColors) self.color = selectColor();

    var args = Array.prototype.slice.call(arguments);

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %o
      args = ['%o'].concat(args);
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    if ('function' === typeof exports.formatArgs) {
      args = exports.formatArgs.apply(self, args);
    }
    var logFn = enabled.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }
  enabled.enabled = true;

  var fn = exports.enabled(namespace) ? enabled : disabled;

  fn.namespace = namespace;

  return fn;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  var split = (namespaces || '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":3}],3:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} options
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options){
  options = options || {};
  if ('string' == typeof val) return parse(val);
  return options.long
    ? long(val)
    : short(val);
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = '' + str;
  if (str.length > 10000) return;
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(str);
  if (!match) return;
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function short(ms) {
  if (ms >= d) return Math.round(ms / d) + 'd';
  if (ms >= h) return Math.round(ms / h) + 'h';
  if (ms >= m) return Math.round(ms / m) + 'm';
  if (ms >= s) return Math.round(ms / s) + 's';
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function long(ms) {
  return plural(ms, d, 'day')
    || plural(ms, h, 'hour')
    || plural(ms, m, 'minute')
    || plural(ms, s, 'second')
    || ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) return;
  if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],4:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = getAPI;

var _window = require('./window');

var _window2 = _interopRequireDefault(_window);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function getAPI() {
	if (!(0, _window2.default)().wp || !(0, _window2.default)().wp.customize) {
		throw new Error('No WordPress customizer API found');
	}
	return (0, _window2.default)().wp.customize;
}

},{"./window":12}],5:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = addClickHandler;

var _jquery = require('../helpers/jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = (0, _debug2.default)('cdm:click-handler');
var $ = (0, _jquery2.default)();

function addClickHandler(clickTarget, handler) {
	debug('adding click handler to target', clickTarget);
	return $('body').on('click', clickTarget, handler);
}

},{"../helpers/jquery":7,"debug":1}],6:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.positionIcon = positionIcon;
exports.addClickHandlerToIcon = addClickHandlerToIcon;
exports.repositionIcons = repositionIcons;
exports.repositionAfterFontsLoad = repositionAfterFontsLoad;
exports.enableIconToggle = enableIconToggle;

var _window = require('../helpers/window');

var _window2 = _interopRequireDefault(_window);

var _jquery = require('../helpers/jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _messenger = require('../helpers/messenger');

var _underscore = require('../helpers/underscore');

var _underscore2 = _interopRequireDefault(_underscore);

var _clickHandler = require('../helpers/click-handler');

var _clickHandler2 = _interopRequireDefault(_clickHandler);

var _options = require('../helpers/options');

var _options2 = _interopRequireDefault(_options);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _ = (0, _underscore2.default)();
var debug = (0, _debug2.default)('cdm:icon-buttons');
var $ = (0, _jquery2.default)();

// Icons from: https://github.com/WordPress/dashicons/tree/master/svg
// Elements will default to using `editIcon` but if an element has the `icon`
// property set, it will use that as the key for one of these icons instead:
var icons = {
	headerIcon: '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="20" height="20" viewBox="0 0 20 20"><path d="M2.25 1h15.5c0.69 0 1.25 0.56 1.25 1.25v15.5c0 0.69-0.56 1.25-1.25 1.25h-15.5c-0.69 0-1.25-0.56-1.25-1.25v-15.5c0-0.69 0.56-1.25 1.25-1.25zM17 17v-14h-14v14h14zM10 6c0-1.1-0.9-2-2-2s-2 0.9-2 2 0.9 2 2 2 2-0.9 2-2zM13 11c0 0 0-6 3-6v10c0 0.55-0.45 1-1 1h-10c-0.55 0-1-0.45-1-1v-7c2 0 3 4 3 4s1-3 3-3 3 2 3 2z"></path></svg>',
	editIcon: '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="20" height="20" viewBox="0 0 20 20"><path d="M13.89 3.39l2.71 2.72c0.46 0.46 0.42 1.24 0.030 1.64l-8.010 8.020-5.56 1.16 1.16-5.58s7.6-7.63 7.99-8.030c0.39-0.39 1.22-0.39 1.68 0.070zM11.16 6.18l-5.59 5.61 1.11 1.11 5.54-5.65zM8.19 14.41l5.58-5.6-1.070-1.080-5.59 5.6z"></path></svg>',
	pageBuilderIcon: '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="20" height="20" viewBox="0 0 20 20"><path d="M19 16v-13c0-0.55-0.45-1-1-1h-15c-0.55 0-1 0.45-1 1v13c0 0.55 0.45 1 1 1h15c0.55 0 1-0.45 1-1zM4 4h13v4h-13v-4zM5 5v2h3v-2h-3zM9 5v2h3v-2h-3zM13 5v2h3v-2h-3zM4.5 10c0.28 0 0.5 0.22 0.5 0.5s-0.22 0.5-0.5 0.5-0.5-0.22-0.5-0.5 0.22-0.5 0.5-0.5zM6 10h4v1h-4v-1zM12 10h5v5h-5v-5zM4.5 12c0.28 0 0.5 0.22 0.5 0.5s-0.22 0.5-0.5 0.5-0.5-0.22-0.5-0.5 0.22-0.5 0.5-0.5zM6 12h4v1h-4v-1zM13 12v2h3v-2h-3zM4.5 14c0.28 0 0.5 0.22 0.5 0.5s-0.22 0.5-0.5 0.5-0.5-0.22-0.5-0.5 0.22-0.5 0.5-0.5zM6 14h4v1h-4v-1z"></path></svg>'
};

/**
 * Create (if necessary) and position an icon button relative to its target.
 *
 * See `makeFocusable` for the format of the `element` param.
 *
 * If positioning the icon was successful, this function returns a copy of the
 * element it was passed with the additional parameters `$target` and `$icon`
 * that are cached references to the DOM elements. If the positioning failed, it
 * just returns the element unchanged.
 *
 * @param {Object} element - The data to use when constructing the icon.
 * @return {Object} The element that was passed, with additional data included.
 */
function positionIcon(element) {
	var $target = getElementTarget(element);
	if (!$target.length) {
		debug('Could not find target element for icon ' + element.id + ' with selector ' + element.selector);
		return element;
	}
	var $icon = findOrCreateIcon(element);
	var css = getCalculatedCssForIcon(element, $target, $icon);
	debug('positioning icon for ' + element.id + ' with CSS ' + JSON.stringify(css));
	$icon.css(css);
	return _.extend({}, element, { $target: $target, $icon: $icon });
}

function addClickHandlerToIcon(element) {
	if (!element.$icon) {
		return element;
	}
	(0, _clickHandler2.default)('.' + getIconClassName(element.id), element.handler);
	return element;
}

var iconRepositioner = _.debounce(function (elements) {
	debug('repositioning ' + elements.length + ' icons');
	elements.map(positionIcon);
}, 350);

function repositionIcons(elements) {
	iconRepositioner(elements);
}

function repositionAfterFontsLoad(elements) {
	iconRepositioner(elements);

	if ((0, _window2.default)().document.fonts) {
		(0, _window2.default)().document.fonts.ready.then(iconRepositioner.bind(null, elements));
	}
}

/**
 * Toggle icons when customizer toggles preview mode.
 */
function enableIconToggle() {
	(0, _messenger.on)('cdm-toggle-visible', function () {
		return $('.cdm-icon').toggleClass('cdm-icon--hidden');
	});
}

function findOrCreateIcon(element) {
	if (element.$icon) {
		return element.$icon;
	}
	var $icon = $('.' + getIconClassName(element.id));
	if ($icon.length) {
		return $icon;
	}

	var $widget_location = getWidgetLocation(element.selector);

	var title = (0, _options2.default)().translations[element.type] || 'Click to edit the ' + element.title;

	return createAndAppendIcon(element.id, element.icon, title, $widget_location);
}

function getWidgetLocation(selector) {

	// Site info wrapper (below footer)
	if ($(selector).parents('.site-title-wrapper').length || $(selector).parents('.site-title').length) {

		return 'site-title-widget';
	}

	// Hero
	if ($(selector).hasClass('hero')) {

		return 'hero-widget';
	}

	// Page Builder (below footer)
	if (_Customizer_DM.beaver_builder) {

		return 'page-builder-widget';
	}

	// Footer Widget
	if ($(selector).parents('.footer-widget').length) {

		return 'footer-widget';
	}

	// Site info wrapper (below footer)
	if ($(selector).parents('.site-info-wrapper').length) {

		return 'site-info-wrapper-widget';
	}

	return 'default';
}

function getIconClassName(id) {
	return 'cdm-icon__' + id;
}

function getCalculatedCssForIcon(element, $target, $icon) {
	var position = element.position;
	var hiddenIconPos = 'rtl' === (0, _window2.default)().document.dir ? { right: -1000, left: 'auto' } : { left: -1000, right: 'auto' };

	if (!$target.is(':visible')) {
		debug('target is not visible when positioning ' + element.id + '. I will hide the icon. target:', $target);
		return hiddenIconPos;
	}
	var offset = $target.offset();
	var top = offset.top;
	var left = offset.left;
	var middle = $target.innerHeight() / 2;
	var iconMiddle = $icon.innerHeight() / 2;
	if (top < 0) {
		debug('target top offset ' + top + ' is unusually low when positioning ' + element.id + '. I will hide the icon. target:', $target);
		return hiddenIconPos;
	}
	if (middle < 0) {
		debug('target middle offset ' + middle + ' is unusually low when positioning ' + element.id + '. I will hide the icon. target:', $target);
		return hiddenIconPos;
	}
	if (top < 1) {
		debug('target top offset ' + top + ' is unusually low when positioning ' + element.id + '. I will adjust the icon downwards. target:', $target);
		top = 0;
	}
	if (middle < 1) {
		debug('target middle offset ' + middle + ' is unusually low when positioning ' + element.id + '. I will adjust the icon downwards. target:', $target);
		middle = 0;
		iconMiddle = 0;
	}
	if (position === 'middle') {
		return adjustCoordinates({ top: top + middle - iconMiddle, left: left, right: 'auto' });
	} else if (position === 'top-right') {
		return adjustCoordinates({ top: top, left: left + $target.width() + 70, right: 'auto' });
	}
	return adjustCoordinates({ top: top, left: left, right: 'auto' });
}

function adjustCoordinates(coords) {
	var minWidth = 35;
	// Try to avoid overlapping hamburger menus
	var maxWidth = (0, _window2.default)().innerWidth - 110;
	if (coords.left < minWidth) {
		coords.left = minWidth;
	}
	if (coords.left >= maxWidth) {
		coords.left = maxWidth;
	}
	return coords;
}

function createIcon(id, iconType, title, widget_location) {
	var iconClassName = getIconClassName(id);
	var scheme = (0, _options2.default)().icon_color;
	var theme = (0, _options2.default)().theme;

	switch (iconType) {
		case 'headerIcon':
			return $('<div class="cdm-icon cdm-icon--header-image ' + iconClassName + ' ' + scheme + ' ' + theme + ' ' + widget_location + '" title="' + title + '">' + icons.headerIcon + '</div>');
		case 'pageBuilderIcon':
			return $('<div class="cdm-icon cdm-icon--page-builder ' + iconClassName + ' ' + scheme + ' ' + theme + ' ' + widget_location + '" title="' + title + '">' + icons.pageBuilderIcon + '</div>');
		default:
			return $('<div class="cdm-icon cdm-icon--text ' + iconClassName + ' ' + scheme + ' ' + theme + ' ' + widget_location + '" title="' + title + '">' + icons.editIcon + '</div>');
	}
}

function createAndAppendIcon(id, iconType, title, widget_location) {
	var $icon = createIcon(id, iconType, title, widget_location);
	$((0, _window2.default)().document.body).append($icon);
	return $icon;
}

function getElementTarget(element) {
	if (element.$target && !element.$target.parent().length) {
		// target was removed from DOM, likely by partial refresh
		element.$target = null;
	}
	return element.$target || $(element.selector);
}

},{"../helpers/click-handler":5,"../helpers/jquery":7,"../helpers/messenger":8,"../helpers/options":9,"../helpers/underscore":10,"../helpers/window":12,"debug":1}],7:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = getJQuery;

var _window = require('./window');

var _window2 = _interopRequireDefault(_window);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function getJQuery() {
	return (0, _window2.default)().jQuery;
}

},{"./window":12}],8:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.send = send;
exports.on = on;
exports.off = off;

var _api = require('./api');

var _api2 = _interopRequireDefault(_api);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = (0, _debug2.default)('cdm:messenger');
var api = (0, _api2.default)();

function getPreview() {
	// wp-admin is previewer, frontend is preview. why? no idea.
	return typeof api.preview !== 'undefined' ? api.preview : api.previewer;
}

function send(id, data) {
	debug('send', id, data);
	return getPreview().send(id, data);
}

function on(id, callback) {
	debug('on', id, callback);
	return getPreview().bind(id, callback);
}

function off(id) {
	var callback = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

	debug('off', id, callback);
	if (callback) {
		return getPreview().unbind(id, callback);
	}
	// no callback? Get rid of all of 'em
	var topic = getPreview().topics[id];
	if (topic) {
		return topic.empty();
	}
}

},{"./api":4,"debug":1}],9:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = getOptions;

var _window = require('./window');

var _window2 = _interopRequireDefault(_window);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function getOptions() {
	return (0, _window2.default)()._Customizer_DM;
}

},{"./window":12}],10:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = getUnderscore;

var _window = require('./window');

var _window2 = _interopRequireDefault(_window);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function getUnderscore() {
	return (0, _window2.default)()._;
}

},{"./window":12}],11:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.getUserAgent = getUserAgent;
exports.isSafari = isSafari;
exports.isMobileSafari = isMobileSafari;

var _window = require('../helpers/window');

var _window2 = _interopRequireDefault(_window);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function getUserAgent() {
	return (0, _window2.default)().navigator.userAgent;
}

function isSafari() {
	return !!getUserAgent().match(/Version\/[\d\.]+.*Safari/);
}

function isMobileSafari() {
	return !!getUserAgent().match(/(iPod|iPhone|iPad)/);
}

},{"../helpers/window":12}],12:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.setWindow = setWindow;
exports.default = getWindow;
var windowObj = null;

function setWindow(obj) {
	windowObj = obj;
}

function getWindow() {
	if (!windowObj && !window) {
		throw new Error('No window object found.');
	}
	return windowObj || window;
}

},{}],13:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.modifyEditPostLinks = modifyEditPostLinks;
exports.disableEditPostLinks = disableEditPostLinks;

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _window = require('../helpers/window');

var _window2 = _interopRequireDefault(_window);

var _jquery = require('../helpers/jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _messenger = require('../helpers/messenger');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var $ = (0, _jquery2.default)();
var debug = (0, _debug2.default)('cdm:edit-post-links');

function modifyEditPostLinks(selector) {
	debug('listening for clicks on post edit links with selector', selector);
	// We use mousedown because click has been blocked by some other JS
	$('body').on('mousedown', selector, function (event) {
		(0, _window2.default)().open(event.target.href);
		(0, _messenger.send)('recordEvent', {
			name: 'wpcom_customize_direct_manipulation_click',
			props: { type: 'post-edit' }
		});
	});
}

function disableEditPostLinks(selector) {
	debug('hiding post edit links with selector', selector);
	$(selector).hide();
}

},{"../helpers/jquery":7,"../helpers/messenger":8,"../helpers/window":12,"debug":1}],14:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = makeFocusable;

var _window = require('../helpers/window');

var _window2 = _interopRequireDefault(_window);

var _api = require('../helpers/api');

var _api2 = _interopRequireDefault(_api);

var _jquery = require('../helpers/jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _messenger = require('../helpers/messenger');

var _iconButtons = require('../helpers/icon-buttons');

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = (0, _debug2.default)('cdm:focusable');
var api = (0, _api2.default)();
var $ = (0, _jquery2.default)();

/**
 * Give DOM elements an icon button bound to click handlers
 *
 * Accepts an array of element objects of the form:
 *
 * {
 * 	id: A string to identify this element
 * 	selector: A CSS selector string to uniquely target the DOM element
 * 	type: A string to group the element, eg: 'widget'
 * 	position: (optional) A string for positioning the icon, one of 'top-left' (default), 'top-right', or 'middle' (vertically center)
 * 	icon (optional): A string specifying which icon to use. See options in icon-buttons.js
 * 	handler (optional): A callback function which will be called when the icon is clicked
 * }
 *
 * If no handler is specified, the default will be used, which will send
 * `control-focus` to the API with the element ID.
 *
 * @param {Array} elements - An array of element objects of the form above.
 */
function makeFocusable(elements) {
	var elementsWithIcons = elements.reduce(removeDuplicateReducer, []).map(_iconButtons.positionIcon).map(createHandler).map(_iconButtons.addClickHandlerToIcon);

	if (elementsWithIcons.length) {
		startIconMonitor(elementsWithIcons);
		(0, _iconButtons.enableIconToggle)();
	}
}

function makeRepositioner(elements, changeType) {
	return function () {
		debug('detected change:', changeType);
		(0, _iconButtons.repositionAfterFontsLoad)(elements);
	};
}

/**
 * Register a group of listeners to reposition icon buttons if the DOM changes.
 *
 * See `makeFocusable` for the format of the `elements` param.
 *
 * @param {Array} elements - The element objects.
 */
function startIconMonitor(elements) {
	// Reposition icons after any theme fonts load
	(0, _iconButtons.repositionAfterFontsLoad)(elements);

	// Reposition icons after a few seconds just in case (eg: infinite scroll or other scripts complete)
	setTimeout(makeRepositioner(elements, 'follow-up'), 2000);

	// Reposition icons after the window is resized
	$((0, _window2.default)()).resize(makeRepositioner(elements, 'resize'));

	// Reposition icons after the text of any element changes
	elements.filter(function (el) {
		return ['siteTitle', 'headerIcon'].indexOf(el.type) !== -1;
	}).map(function (el) {
		return api(el.id, function (value) {
			return value.bind(makeRepositioner(elements, 'title or header'));
		});
	});

	// Reposition icons after custom-fonts change the elements
	api('jetpack_fonts[selected_fonts]', function (value) {
		return value.bind(makeRepositioner(elements, 'custom-fonts'));
	});

	// When the widget partial refresh runs, reposition icons
	api.bind('widget-updated', makeRepositioner(elements, 'widgets'));

	// Reposition icons after any customizer setting is changed
	api.bind('change', makeRepositioner(elements, 'any setting'));

	var $document = $((0, _window2.default)().document);

	// Reposition after menus updated
	$document.on('customize-preview-menu-refreshed', makeRepositioner(elements, 'menus'));

	// Reposition after scrolling in case there are fixed position elements
	$document.on('scroll', makeRepositioner(elements, 'scroll'));

	// Reposition after page click (eg: hamburger menus)
	$document.on('click', makeRepositioner(elements, 'click'));

	// Reposition after any page changes (if the browser supports it)
	var page = (0, _window2.default)().document.querySelector('#page');
	if (page && MutationObserver) {
		var observer = new MutationObserver(makeRepositioner(elements, 'DOM mutation'));
		observer.observe(page, { attributes: true, childList: true, characterData: true });
	}
}

function createHandler(element) {
	element.handler = element.handler || makeDefaultHandler(element.id);
	return element;
}

function removeDuplicateReducer(prev, el) {
	if (prev.map(function (x) {
		return x.id;
	}).indexOf(el.id) !== -1) {
		debug('tried to add duplicate element for ' + el.id);
		return prev;
	}
	return prev.concat(el);
}

function makeDefaultHandler(id) {
	return function (event) {
		event.preventDefault();
		event.stopPropagation();
		debug('click detected on', id);
		(0, _messenger.send)('control-focus', id);
	};
}

},{"../helpers/api":4,"../helpers/icon-buttons":6,"../helpers/jquery":7,"../helpers/messenger":8,"../helpers/window":12,"debug":1}],15:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.getFooterElements = getFooterElements;
function getFooterElements() {
	return [{
		id: 'footercredit',
		selector: 'a[data-type="footer-credit"]',
		type: 'footerCredit',
		position: 'middle',
		title: 'footer credit'
	}];
}

},{}],16:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.getHeaderElements = getHeaderElements;

var _jquery = require('../helpers/jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = (0, _debug2.default)('cdm:header-focus');
var fallbackSelector = '.hero';
var $ = (0, _jquery2.default)();

function getHeaderElements() {
	return [getHeaderElement()];
}

function getHeaderElement() {
	var selector = getHeaderSelector();
	var position = selector === fallbackSelector ? 'top-right' : null;
	return { id: 'header_image', selector: selector, type: 'header', icon: 'headerIcon', position: position, title: 'header image' };
}

function getHeaderSelector() {
	var selector = getModifiedSelectors();
	if ($(selector).length > 0) {
		return selector;
	}
	debug('failed to find header image selector in page; using fallback');
	return fallbackSelector;
}

function getModifiedSelectors() {
	return ['.header-image a img', '.header-image img', '.site-branding a img', '.site-header-image img', '.header-image-link img', 'img.header-image', 'img.header-img', 'img.headerimage', 'img.custom-header', '.featured-header-image a img'].map(function (selector) {
		return selector + '[src]:not(\'.site-logo\'):not(\'.wp-post-image\'):not(\'.custom-logo\')';
	}).join();
}

},{"../helpers/jquery":7,"debug":1}],17:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.getMenuElements = getMenuElements;

var _messenger = require('../helpers/messenger');

var _options = require('../helpers/options.js');

var _options2 = _interopRequireDefault(_options);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var opts = (0, _options2.default)();

function getMenuElements() {
	return opts.menus.map(function (menu) {
		return {
			id: menu.id,
			selector: '.' + menu.id + ' li:first-child',
			type: 'menu',
			handler: makeHandler(menu.location),
			title: 'menu'
		};
	});
}

function makeHandler(id) {
	return function () {
		(0, _messenger.send)('focus-menu', id);
	};
}

},{"../helpers/messenger":8,"../helpers/options.js":9}],18:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.getPageBuilderElements = getPageBuilderElements;

var _window = require('../helpers/window');

var _window2 = _interopRequireDefault(_window);

var _jquery = require('../helpers/jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _messenger = require('../helpers/messenger');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = (0, _debug2.default)('cdm:page-builder-focus');
var $ = (0, _jquery2.default)();

function getPageBuilderElements() {
	var selector = '.site-main';
	var $el = $(selector);
	if (!$el.length) {
		debug('found no page builder for selector ' + selector);
		return [];
	}
	if (!_Customizer_DM.beaver_builder) {

		return [];
	}
	return $.makeArray($el).reduce(function (posts, post) {
		var url = getPageBuilderLink();
		return posts.concat({
			id: post.id,
			selector: selector,
			type: 'page_builder',
			position: 'top',
			handler: makeHandler(post.id, url),
			title: 'page_builder',
			icon: 'pageBuilderIcon'
		});
	}, []);
}

function getPageBuilderLink() {
	var url = _Customizer_DM.page_builder_link;
	if (!url) {
		debug('invalid edit link URL for page builder');
	}
	return url;
}

function makeHandler(id, url) {
	return function (event) {
		event.preventDefault();
		event.stopPropagation();
		debug('click detected on page builder');
		(0, _window2.default)().open(url);
		(0, _messenger.send)('recordEvent', {
			name: 'wpcom_customize_direct_manipulation_click',
			props: { type: 'page-builder-icon' }
		});
	};
}

},{"../helpers/jquery":7,"../helpers/messenger":8,"../helpers/window":12,"debug":1}],19:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.getWidgetElements = getWidgetElements;

var _api = require('../helpers/api');

var _api2 = _interopRequireDefault(_api);

var _messenger = require('../helpers/messenger');

var _jquery = require('../helpers/jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = (0, _debug2.default)('cdm:widgets');
var api = (0, _api2.default)();
var $ = (0, _jquery2.default)();

function getWidgetElements() {
	return getWidgetSelectors().map(getWidgetsForSelector).reduce(function (widgets, id) {
		return widgets.concat(id);
	}, []) // flatten the arrays
	.map(function (id) {
		return {
			id: id,
			selector: getWidgetSelectorForId(id),
			type: 'widget',
			handler: makeHandlerForId(id),
			title: 'widget'
		};
	});
}

function getWidgetSelectors() {
	return api.WidgetCustomizerPreview.widgetSelectors;
}

function getWidgetsForSelector(selector) {
	var $el = $(selector);
	if (!$el.length) {
		debug('found no widgets for selector', selector);
		return [];
	}
	debug('found widgets for selector', selector, $el);
	return $.makeArray($el.map(function (i, w) {
		return w.id;
	}));
}

function getWidgetSelectorForId(id) {
	return '#' + id;
}

function makeHandlerForId(id) {
	return function (event) {
		event.preventDefault();
		event.stopPropagation();
		debug('click detected on', id);
		(0, _messenger.send)('focus-widget-control', id);
	};
}

},{"../helpers/api":4,"../helpers/jquery":7,"../helpers/messenger":8,"debug":1}],20:[function(require,module,exports){
'use strict';

var _window = require('./helpers/window');

var _window2 = _interopRequireDefault(_window);

var _api = require('./helpers/api');

var _api2 = _interopRequireDefault(_api);

var _jquery = require('./helpers/jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _options = require('./helpers/options');

var _options2 = _interopRequireDefault(_options);

var _userAgent = require('./helpers/user-agent');

var _focusable = require('./modules/focusable');

var _focusable2 = _interopRequireDefault(_focusable);

var _editPostLinks = require('./modules/edit-post-links');

var _headerFocus = require('./modules/header-focus');

var _widgetFocus = require('./modules/widget-focus');

var _menuFocus = require('./modules/menu-focus');

var _pageBuilderFocus = require('./modules/page-builder-focus');

var _footerFocus = require('./modules/footer-focus');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// import { getPostElements } from './modules/post-focus';
var options = (0, _options2.default)();
var api = (0, _api2.default)();
var $ = (0, _jquery2.default)();

function startDirectManipulation() {
	var basicElements = [{ id: 'blogname', selector: '.site-title a, #site-title a', type: 'siteTitle', position: 'middle', title: 'site title' }];
	var headers = options.headerImageSupport ? (0, _headerFocus.getHeaderElements)() : [];
	var widgets = (0, _widgetFocus.getWidgetElements)();
	var menus = (0, _menuFocus.getMenuElements)();
	var footers = (0, _footerFocus.getFooterElements)();
	var pb_elements = (0, _pageBuilderFocus.getPageBuilderElements)();

	(0, _focusable2.default)(basicElements.concat(headers, widgets, menus, footers, pb_elements));

	if (-1 === options.disabledModules.indexOf('edit-post-links')) {
		if ((0, _userAgent.isSafari)() && !(0, _userAgent.isMobileSafari)()) {
			(0, _editPostLinks.disableEditPostLinks)('.post-edit-link, [href^="https://wordpress.com/post"], [href^="https://wordpress.com/page"]');
		} else {
			(0, _editPostLinks.modifyEditPostLinks)('.post-edit-link, [href^="https://wordpress.com/post"], [href^="https://wordpress.com/page"]');
		}
	}
}

api.bind('preview-ready', function () {
	// the widget customizer doesn't run until document.ready, so let's run later
	$((0, _window2.default)().document).ready(function () {
		return setTimeout(startDirectManipulation, 100);
	});
});

},{"./helpers/api":4,"./helpers/jquery":7,"./helpers/options":9,"./helpers/user-agent":11,"./helpers/window":12,"./modules/edit-post-links":13,"./modules/focusable":14,"./modules/footer-focus":15,"./modules/header-focus":16,"./modules/menu-focus":17,"./modules/page-builder-focus":18,"./modules/widget-focus":19}]},{},[20])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZGVidWcvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9kZWJ1Zy9kZWJ1Zy5qcyIsIm5vZGVfbW9kdWxlcy9kZWJ1Zy9ub2RlX21vZHVsZXMvbXMvaW5kZXguanMiLCJzcmMvaGVscGVycy9hcGkuanMiLCJzcmMvaGVscGVycy9jbGljay1oYW5kbGVyLmpzIiwic3JjL2hlbHBlcnMvaWNvbi1idXR0b25zLmpzIiwic3JjL2hlbHBlcnMvanF1ZXJ5LmpzIiwic3JjL2hlbHBlcnMvbWVzc2VuZ2VyLmpzIiwic3JjL2hlbHBlcnMvb3B0aW9ucy5qcyIsInNyYy9oZWxwZXJzL3VuZGVyc2NvcmUuanMiLCJzcmMvaGVscGVycy91c2VyLWFnZW50LmpzIiwic3JjL2hlbHBlcnMvd2luZG93LmpzIiwic3JjL21vZHVsZXMvZWRpdC1wb3N0LWxpbmtzLmpzIiwic3JjL21vZHVsZXMvZm9jdXNhYmxlLmpzIiwic3JjL21vZHVsZXMvZm9vdGVyLWZvY3VzLmpzIiwic3JjL21vZHVsZXMvaGVhZGVyLWZvY3VzLmpzIiwic3JjL21vZHVsZXMvbWVudS1mb2N1cy5qcyIsInNyYy9tb2R1bGVzL3BhZ2UtYnVpbGRlci1mb2N1cy5qcyIsInNyYy9tb2R1bGVzL3dpZGdldC1mb2N1cy5qcyIsInNyYy9wcmV2aWV3LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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QUFjLCtDQUFwQjs7QUFFQSwwQkFBZSxjQUFjLE1BQWQsQ0FBc0IsT0FBdEIsRUFBK0IsT0FBL0IsRUFBd0MsS0FBeEMsRUFBK0MsT0FBL0MsRUFBd0QsV0FBeEQsQ0FBZjs7QUFFQSxLQUFLLENBQUMsQ0FBRCxLQUFPLFFBQVEsZUFBUixDQUF3QixPQUF4QixDQUFpQyxpQkFBakMsQ0FBWixFQUFtRTtBQUNsRSxNQUFLLDhCQUFjLENBQUUsZ0NBQXJCLEVBQXdDO0FBQ3ZDLDRDQUFzQiw2RkFBdEI7QUFDQSxHQUZELE1BRU87QUFDTiwyQ0FBcUIsNkZBQXJCO0FBQ0E7QUFDRDtBQUNEOztBQUVELElBQUksSUFBSixDQUFVLGVBQVYsRUFBMkIsWUFBTTtBQUNoQztBQUNBLEdBQUcsd0JBQVksUUFBZixFQUEwQixLQUExQixDQUFpQztBQUFBLFNBQU0sV0FBWSx1QkFBWixFQUFxQyxHQUFyQyxDQUFOO0FBQUEsRUFBakM7QUFDQSxDQUhEIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlxuLyoqXG4gKiBUaGlzIGlzIHRoZSB3ZWIgYnJvd3NlciBpbXBsZW1lbnRhdGlvbiBvZiBgZGVidWcoKWAuXG4gKlxuICogRXhwb3NlIGBkZWJ1ZygpYCBhcyB0aGUgbW9kdWxlLlxuICovXG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vZGVidWcnKTtcbmV4cG9ydHMubG9nID0gbG9nO1xuZXhwb3J0cy5mb3JtYXRBcmdzID0gZm9ybWF0QXJncztcbmV4cG9ydHMuc2F2ZSA9IHNhdmU7XG5leHBvcnRzLmxvYWQgPSBsb2FkO1xuZXhwb3J0cy51c2VDb2xvcnMgPSB1c2VDb2xvcnM7XG5leHBvcnRzLnN0b3JhZ2UgPSAndW5kZWZpbmVkJyAhPSB0eXBlb2YgY2hyb21lXG4gICAgICAgICAgICAgICAmJiAndW5kZWZpbmVkJyAhPSB0eXBlb2YgY2hyb21lLnN0b3JhZ2VcbiAgICAgICAgICAgICAgICAgID8gY2hyb21lLnN0b3JhZ2UubG9jYWxcbiAgICAgICAgICAgICAgICAgIDogbG9jYWxzdG9yYWdlKCk7XG5cbi8qKlxuICogQ29sb3JzLlxuICovXG5cbmV4cG9ydHMuY29sb3JzID0gW1xuICAnbGlnaHRzZWFncmVlbicsXG4gICdmb3Jlc3RncmVlbicsXG4gICdnb2xkZW5yb2QnLFxuICAnZG9kZ2VyYmx1ZScsXG4gICdkYXJrb3JjaGlkJyxcbiAgJ2NyaW1zb24nXG5dO1xuXG4vKipcbiAqIEN1cnJlbnRseSBvbmx5IFdlYktpdC1iYXNlZCBXZWIgSW5zcGVjdG9ycywgRmlyZWZveCA+PSB2MzEsXG4gKiBhbmQgdGhlIEZpcmVidWcgZXh0ZW5zaW9uIChhbnkgRmlyZWZveCB2ZXJzaW9uKSBhcmUga25vd25cbiAqIHRvIHN1cHBvcnQgXCIlY1wiIENTUyBjdXN0b21pemF0aW9ucy5cbiAqXG4gKiBUT0RPOiBhZGQgYSBgbG9jYWxTdG9yYWdlYCB2YXJpYWJsZSB0byBleHBsaWNpdGx5IGVuYWJsZS9kaXNhYmxlIGNvbG9yc1xuICovXG5cbmZ1bmN0aW9uIHVzZUNvbG9ycygpIHtcbiAgLy8gaXMgd2Via2l0PyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xNjQ1OTYwNi8zNzY3NzNcbiAgcmV0dXJuICgnV2Via2l0QXBwZWFyYW5jZScgaW4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlKSB8fFxuICAgIC8vIGlzIGZpcmVidWc/IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzM5ODEyMC8zNzY3NzNcbiAgICAod2luZG93LmNvbnNvbGUgJiYgKGNvbnNvbGUuZmlyZWJ1ZyB8fCAoY29uc29sZS5leGNlcHRpb24gJiYgY29uc29sZS50YWJsZSkpKSB8fFxuICAgIC8vIGlzIGZpcmVmb3ggPj0gdjMxP1xuICAgIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvVG9vbHMvV2ViX0NvbnNvbGUjU3R5bGluZ19tZXNzYWdlc1xuICAgIChuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkubWF0Y2goL2ZpcmVmb3hcXC8oXFxkKykvKSAmJiBwYXJzZUludChSZWdFeHAuJDEsIDEwKSA+PSAzMSk7XG59XG5cbi8qKlxuICogTWFwICVqIHRvIGBKU09OLnN0cmluZ2lmeSgpYCwgc2luY2Ugbm8gV2ViIEluc3BlY3RvcnMgZG8gdGhhdCBieSBkZWZhdWx0LlxuICovXG5cbmV4cG9ydHMuZm9ybWF0dGVycy5qID0gZnVuY3Rpb24odikge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodik7XG59O1xuXG5cbi8qKlxuICogQ29sb3JpemUgbG9nIGFyZ3VtZW50cyBpZiBlbmFibGVkLlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZm9ybWF0QXJncygpIHtcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gIHZhciB1c2VDb2xvcnMgPSB0aGlzLnVzZUNvbG9ycztcblxuICBhcmdzWzBdID0gKHVzZUNvbG9ycyA/ICclYycgOiAnJylcbiAgICArIHRoaXMubmFtZXNwYWNlXG4gICAgKyAodXNlQ29sb3JzID8gJyAlYycgOiAnICcpXG4gICAgKyBhcmdzWzBdXG4gICAgKyAodXNlQ29sb3JzID8gJyVjICcgOiAnICcpXG4gICAgKyAnKycgKyBleHBvcnRzLmh1bWFuaXplKHRoaXMuZGlmZik7XG5cbiAgaWYgKCF1c2VDb2xvcnMpIHJldHVybiBhcmdzO1xuXG4gIHZhciBjID0gJ2NvbG9yOiAnICsgdGhpcy5jb2xvcjtcbiAgYXJncyA9IFthcmdzWzBdLCBjLCAnY29sb3I6IGluaGVyaXQnXS5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJncywgMSkpO1xuXG4gIC8vIHRoZSBmaW5hbCBcIiVjXCIgaXMgc29tZXdoYXQgdHJpY2t5LCBiZWNhdXNlIHRoZXJlIGNvdWxkIGJlIG90aGVyXG4gIC8vIGFyZ3VtZW50cyBwYXNzZWQgZWl0aGVyIGJlZm9yZSBvciBhZnRlciB0aGUgJWMsIHNvIHdlIG5lZWQgdG9cbiAgLy8gZmlndXJlIG91dCB0aGUgY29ycmVjdCBpbmRleCB0byBpbnNlcnQgdGhlIENTUyBpbnRvXG4gIHZhciBpbmRleCA9IDA7XG4gIHZhciBsYXN0QyA9IDA7XG4gIGFyZ3NbMF0ucmVwbGFjZSgvJVthLXolXS9nLCBmdW5jdGlvbihtYXRjaCkge1xuICAgIGlmICgnJSUnID09PSBtYXRjaCkgcmV0dXJuO1xuICAgIGluZGV4Kys7XG4gICAgaWYgKCclYycgPT09IG1hdGNoKSB7XG4gICAgICAvLyB3ZSBvbmx5IGFyZSBpbnRlcmVzdGVkIGluIHRoZSAqbGFzdCogJWNcbiAgICAgIC8vICh0aGUgdXNlciBtYXkgaGF2ZSBwcm92aWRlZCB0aGVpciBvd24pXG4gICAgICBsYXN0QyA9IGluZGV4O1xuICAgIH1cbiAgfSk7XG5cbiAgYXJncy5zcGxpY2UobGFzdEMsIDAsIGMpO1xuICByZXR1cm4gYXJncztcbn1cblxuLyoqXG4gKiBJbnZva2VzIGBjb25zb2xlLmxvZygpYCB3aGVuIGF2YWlsYWJsZS5cbiAqIE5vLW9wIHdoZW4gYGNvbnNvbGUubG9nYCBpcyBub3QgYSBcImZ1bmN0aW9uXCIuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBsb2coKSB7XG4gIC8vIHRoaXMgaGFja2VyeSBpcyByZXF1aXJlZCBmb3IgSUU4LzksIHdoZXJlXG4gIC8vIHRoZSBgY29uc29sZS5sb2dgIGZ1bmN0aW9uIGRvZXNuJ3QgaGF2ZSAnYXBwbHknXG4gIHJldHVybiAnb2JqZWN0JyA9PT0gdHlwZW9mIGNvbnNvbGVcbiAgICAmJiBjb25zb2xlLmxvZ1xuICAgICYmIEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseS5jYWxsKGNvbnNvbGUubG9nLCBjb25zb2xlLCBhcmd1bWVudHMpO1xufVxuXG4vKipcbiAqIFNhdmUgYG5hbWVzcGFjZXNgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VzXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzYXZlKG5hbWVzcGFjZXMpIHtcbiAgdHJ5IHtcbiAgICBpZiAobnVsbCA9PSBuYW1lc3BhY2VzKSB7XG4gICAgICBleHBvcnRzLnN0b3JhZ2UucmVtb3ZlSXRlbSgnZGVidWcnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXhwb3J0cy5zdG9yYWdlLmRlYnVnID0gbmFtZXNwYWNlcztcbiAgICB9XG4gIH0gY2F0Y2goZSkge31cbn1cblxuLyoqXG4gKiBMb2FkIGBuYW1lc3BhY2VzYC5cbiAqXG4gKiBAcmV0dXJuIHtTdHJpbmd9IHJldHVybnMgdGhlIHByZXZpb3VzbHkgcGVyc2lzdGVkIGRlYnVnIG1vZGVzXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb2FkKCkge1xuICB2YXIgcjtcbiAgdHJ5IHtcbiAgICByID0gZXhwb3J0cy5zdG9yYWdlLmRlYnVnO1xuICB9IGNhdGNoKGUpIHt9XG4gIHJldHVybiByO1xufVxuXG4vKipcbiAqIEVuYWJsZSBuYW1lc3BhY2VzIGxpc3RlZCBpbiBgbG9jYWxTdG9yYWdlLmRlYnVnYCBpbml0aWFsbHkuXG4gKi9cblxuZXhwb3J0cy5lbmFibGUobG9hZCgpKTtcblxuLyoqXG4gKiBMb2NhbHN0b3JhZ2UgYXR0ZW1wdHMgdG8gcmV0dXJuIHRoZSBsb2NhbHN0b3JhZ2UuXG4gKlxuICogVGhpcyBpcyBuZWNlc3NhcnkgYmVjYXVzZSBzYWZhcmkgdGhyb3dzXG4gKiB3aGVuIGEgdXNlciBkaXNhYmxlcyBjb29raWVzL2xvY2Fsc3RvcmFnZVxuICogYW5kIHlvdSBhdHRlbXB0IHRvIGFjY2VzcyBpdC5cbiAqXG4gKiBAcmV0dXJuIHtMb2NhbFN0b3JhZ2V9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb2NhbHN0b3JhZ2UoKXtcbiAgdHJ5IHtcbiAgICByZXR1cm4gd2luZG93LmxvY2FsU3RvcmFnZTtcbiAgfSBjYXRjaCAoZSkge31cbn1cbiIsIlxuLyoqXG4gKiBUaGlzIGlzIHRoZSBjb21tb24gbG9naWMgZm9yIGJvdGggdGhlIE5vZGUuanMgYW5kIHdlYiBicm93c2VyXG4gKiBpbXBsZW1lbnRhdGlvbnMgb2YgYGRlYnVnKClgLlxuICpcbiAqIEV4cG9zZSBgZGVidWcoKWAgYXMgdGhlIG1vZHVsZS5cbiAqL1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBkZWJ1ZztcbmV4cG9ydHMuY29lcmNlID0gY29lcmNlO1xuZXhwb3J0cy5kaXNhYmxlID0gZGlzYWJsZTtcbmV4cG9ydHMuZW5hYmxlID0gZW5hYmxlO1xuZXhwb3J0cy5lbmFibGVkID0gZW5hYmxlZDtcbmV4cG9ydHMuaHVtYW5pemUgPSByZXF1aXJlKCdtcycpO1xuXG4vKipcbiAqIFRoZSBjdXJyZW50bHkgYWN0aXZlIGRlYnVnIG1vZGUgbmFtZXMsIGFuZCBuYW1lcyB0byBza2lwLlxuICovXG5cbmV4cG9ydHMubmFtZXMgPSBbXTtcbmV4cG9ydHMuc2tpcHMgPSBbXTtcblxuLyoqXG4gKiBNYXAgb2Ygc3BlY2lhbCBcIiVuXCIgaGFuZGxpbmcgZnVuY3Rpb25zLCBmb3IgdGhlIGRlYnVnIFwiZm9ybWF0XCIgYXJndW1lbnQuXG4gKlxuICogVmFsaWQga2V5IG5hbWVzIGFyZSBhIHNpbmdsZSwgbG93ZXJjYXNlZCBsZXR0ZXIsIGkuZS4gXCJuXCIuXG4gKi9cblxuZXhwb3J0cy5mb3JtYXR0ZXJzID0ge307XG5cbi8qKlxuICogUHJldmlvdXNseSBhc3NpZ25lZCBjb2xvci5cbiAqL1xuXG52YXIgcHJldkNvbG9yID0gMDtcblxuLyoqXG4gKiBQcmV2aW91cyBsb2cgdGltZXN0YW1wLlxuICovXG5cbnZhciBwcmV2VGltZTtcblxuLyoqXG4gKiBTZWxlY3QgYSBjb2xvci5cbiAqXG4gKiBAcmV0dXJuIHtOdW1iZXJ9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzZWxlY3RDb2xvcigpIHtcbiAgcmV0dXJuIGV4cG9ydHMuY29sb3JzW3ByZXZDb2xvcisrICUgZXhwb3J0cy5jb2xvcnMubGVuZ3RoXTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBkZWJ1Z2dlciB3aXRoIHRoZSBnaXZlbiBgbmFtZXNwYWNlYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZGVidWcobmFtZXNwYWNlKSB7XG5cbiAgLy8gZGVmaW5lIHRoZSBgZGlzYWJsZWRgIHZlcnNpb25cbiAgZnVuY3Rpb24gZGlzYWJsZWQoKSB7XG4gIH1cbiAgZGlzYWJsZWQuZW5hYmxlZCA9IGZhbHNlO1xuXG4gIC8vIGRlZmluZSB0aGUgYGVuYWJsZWRgIHZlcnNpb25cbiAgZnVuY3Rpb24gZW5hYmxlZCgpIHtcblxuICAgIHZhciBzZWxmID0gZW5hYmxlZDtcblxuICAgIC8vIHNldCBgZGlmZmAgdGltZXN0YW1wXG4gICAgdmFyIGN1cnIgPSArbmV3IERhdGUoKTtcbiAgICB2YXIgbXMgPSBjdXJyIC0gKHByZXZUaW1lIHx8IGN1cnIpO1xuICAgIHNlbGYuZGlmZiA9IG1zO1xuICAgIHNlbGYucHJldiA9IHByZXZUaW1lO1xuICAgIHNlbGYuY3VyciA9IGN1cnI7XG4gICAgcHJldlRpbWUgPSBjdXJyO1xuXG4gICAgLy8gYWRkIHRoZSBgY29sb3JgIGlmIG5vdCBzZXRcbiAgICBpZiAobnVsbCA9PSBzZWxmLnVzZUNvbG9ycykgc2VsZi51c2VDb2xvcnMgPSBleHBvcnRzLnVzZUNvbG9ycygpO1xuICAgIGlmIChudWxsID09IHNlbGYuY29sb3IgJiYgc2VsZi51c2VDb2xvcnMpIHNlbGYuY29sb3IgPSBzZWxlY3RDb2xvcigpO1xuXG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gICAgYXJnc1swXSA9IGV4cG9ydHMuY29lcmNlKGFyZ3NbMF0pO1xuXG4gICAgaWYgKCdzdHJpbmcnICE9PSB0eXBlb2YgYXJnc1swXSkge1xuICAgICAgLy8gYW55dGhpbmcgZWxzZSBsZXQncyBpbnNwZWN0IHdpdGggJW9cbiAgICAgIGFyZ3MgPSBbJyVvJ10uY29uY2F0KGFyZ3MpO1xuICAgIH1cblxuICAgIC8vIGFwcGx5IGFueSBgZm9ybWF0dGVyc2AgdHJhbnNmb3JtYXRpb25zXG4gICAgdmFyIGluZGV4ID0gMDtcbiAgICBhcmdzWzBdID0gYXJnc1swXS5yZXBsYWNlKC8lKFthLXolXSkvZywgZnVuY3Rpb24obWF0Y2gsIGZvcm1hdCkge1xuICAgICAgLy8gaWYgd2UgZW5jb3VudGVyIGFuIGVzY2FwZWQgJSB0aGVuIGRvbid0IGluY3JlYXNlIHRoZSBhcnJheSBpbmRleFxuICAgICAgaWYgKG1hdGNoID09PSAnJSUnKSByZXR1cm4gbWF0Y2g7XG4gICAgICBpbmRleCsrO1xuICAgICAgdmFyIGZvcm1hdHRlciA9IGV4cG9ydHMuZm9ybWF0dGVyc1tmb3JtYXRdO1xuICAgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBmb3JtYXR0ZXIpIHtcbiAgICAgICAgdmFyIHZhbCA9IGFyZ3NbaW5kZXhdO1xuICAgICAgICBtYXRjaCA9IGZvcm1hdHRlci5jYWxsKHNlbGYsIHZhbCk7XG5cbiAgICAgICAgLy8gbm93IHdlIG5lZWQgdG8gcmVtb3ZlIGBhcmdzW2luZGV4XWAgc2luY2UgaXQncyBpbmxpbmVkIGluIHRoZSBgZm9ybWF0YFxuICAgICAgICBhcmdzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIGluZGV4LS07XG4gICAgICB9XG4gICAgICByZXR1cm4gbWF0Y2g7XG4gICAgfSk7XG5cbiAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGV4cG9ydHMuZm9ybWF0QXJncykge1xuICAgICAgYXJncyA9IGV4cG9ydHMuZm9ybWF0QXJncy5hcHBseShzZWxmLCBhcmdzKTtcbiAgICB9XG4gICAgdmFyIGxvZ0ZuID0gZW5hYmxlZC5sb2cgfHwgZXhwb3J0cy5sb2cgfHwgY29uc29sZS5sb2cuYmluZChjb25zb2xlKTtcbiAgICBsb2dGbi5hcHBseShzZWxmLCBhcmdzKTtcbiAgfVxuICBlbmFibGVkLmVuYWJsZWQgPSB0cnVlO1xuXG4gIHZhciBmbiA9IGV4cG9ydHMuZW5hYmxlZChuYW1lc3BhY2UpID8gZW5hYmxlZCA6IGRpc2FibGVkO1xuXG4gIGZuLm5hbWVzcGFjZSA9IG5hbWVzcGFjZTtcblxuICByZXR1cm4gZm47XG59XG5cbi8qKlxuICogRW5hYmxlcyBhIGRlYnVnIG1vZGUgYnkgbmFtZXNwYWNlcy4gVGhpcyBjYW4gaW5jbHVkZSBtb2Rlc1xuICogc2VwYXJhdGVkIGJ5IGEgY29sb24gYW5kIHdpbGRjYXJkcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBlbmFibGUobmFtZXNwYWNlcykge1xuICBleHBvcnRzLnNhdmUobmFtZXNwYWNlcyk7XG5cbiAgdmFyIHNwbGl0ID0gKG5hbWVzcGFjZXMgfHwgJycpLnNwbGl0KC9bXFxzLF0rLyk7XG4gIHZhciBsZW4gPSBzcGxpdC5sZW5ndGg7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIGlmICghc3BsaXRbaV0pIGNvbnRpbnVlOyAvLyBpZ25vcmUgZW1wdHkgc3RyaW5nc1xuICAgIG5hbWVzcGFjZXMgPSBzcGxpdFtpXS5yZXBsYWNlKC9cXCovZywgJy4qPycpO1xuICAgIGlmIChuYW1lc3BhY2VzWzBdID09PSAnLScpIHtcbiAgICAgIGV4cG9ydHMuc2tpcHMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMuc3Vic3RyKDEpICsgJyQnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGV4cG9ydHMubmFtZXMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMgKyAnJCcpKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBEaXNhYmxlIGRlYnVnIG91dHB1dC5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGRpc2FibGUoKSB7XG4gIGV4cG9ydHMuZW5hYmxlKCcnKTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIGdpdmVuIG1vZGUgbmFtZSBpcyBlbmFibGVkLCBmYWxzZSBvdGhlcndpc2UuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGVuYWJsZWQobmFtZSkge1xuICB2YXIgaSwgbGVuO1xuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLnNraXBzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMuc2tpcHNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLm5hbWVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMubmFtZXNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBDb2VyY2UgYHZhbGAuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gdmFsXG4gKiBAcmV0dXJuIHtNaXhlZH1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGNvZXJjZSh2YWwpIHtcbiAgaWYgKHZhbCBpbnN0YW5jZW9mIEVycm9yKSByZXR1cm4gdmFsLnN0YWNrIHx8IHZhbC5tZXNzYWdlO1xuICByZXR1cm4gdmFsO1xufVxuIiwiLyoqXG4gKiBIZWxwZXJzLlxuICovXG5cbnZhciBzID0gMTAwMDtcbnZhciBtID0gcyAqIDYwO1xudmFyIGggPSBtICogNjA7XG52YXIgZCA9IGggKiAyNDtcbnZhciB5ID0gZCAqIDM2NS4yNTtcblxuLyoqXG4gKiBQYXJzZSBvciBmb3JtYXQgdGhlIGdpdmVuIGB2YWxgLlxuICpcbiAqIE9wdGlvbnM6XG4gKlxuICogIC0gYGxvbmdgIHZlcmJvc2UgZm9ybWF0dGluZyBbZmFsc2VdXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8TnVtYmVyfSB2YWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtTdHJpbmd8TnVtYmVyfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHZhbCwgb3B0aW9ucyl7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICBpZiAoJ3N0cmluZycgPT0gdHlwZW9mIHZhbCkgcmV0dXJuIHBhcnNlKHZhbCk7XG4gIHJldHVybiBvcHRpb25zLmxvbmdcbiAgICA/IGxvbmcodmFsKVxuICAgIDogc2hvcnQodmFsKTtcbn07XG5cbi8qKlxuICogUGFyc2UgdGhlIGdpdmVuIGBzdHJgIGFuZCByZXR1cm4gbWlsbGlzZWNvbmRzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHBhcnNlKHN0cikge1xuICBzdHIgPSAnJyArIHN0cjtcbiAgaWYgKHN0ci5sZW5ndGggPiAxMDAwMCkgcmV0dXJuO1xuICB2YXIgbWF0Y2ggPSAvXigoPzpcXGQrKT9cXC4/XFxkKykgKihtaWxsaXNlY29uZHM/fG1zZWNzP3xtc3xzZWNvbmRzP3xzZWNzP3xzfG1pbnV0ZXM/fG1pbnM/fG18aG91cnM/fGhycz98aHxkYXlzP3xkfHllYXJzP3x5cnM/fHkpPyQvaS5leGVjKHN0cik7XG4gIGlmICghbWF0Y2gpIHJldHVybjtcbiAgdmFyIG4gPSBwYXJzZUZsb2F0KG1hdGNoWzFdKTtcbiAgdmFyIHR5cGUgPSAobWF0Y2hbMl0gfHwgJ21zJykudG9Mb3dlckNhc2UoKTtcbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSAneWVhcnMnOlxuICAgIGNhc2UgJ3llYXInOlxuICAgIGNhc2UgJ3lycyc6XG4gICAgY2FzZSAneXInOlxuICAgIGNhc2UgJ3knOlxuICAgICAgcmV0dXJuIG4gKiB5O1xuICAgIGNhc2UgJ2RheXMnOlxuICAgIGNhc2UgJ2RheSc6XG4gICAgY2FzZSAnZCc6XG4gICAgICByZXR1cm4gbiAqIGQ7XG4gICAgY2FzZSAnaG91cnMnOlxuICAgIGNhc2UgJ2hvdXInOlxuICAgIGNhc2UgJ2hycyc6XG4gICAgY2FzZSAnaHInOlxuICAgIGNhc2UgJ2gnOlxuICAgICAgcmV0dXJuIG4gKiBoO1xuICAgIGNhc2UgJ21pbnV0ZXMnOlxuICAgIGNhc2UgJ21pbnV0ZSc6XG4gICAgY2FzZSAnbWlucyc6XG4gICAgY2FzZSAnbWluJzpcbiAgICBjYXNlICdtJzpcbiAgICAgIHJldHVybiBuICogbTtcbiAgICBjYXNlICdzZWNvbmRzJzpcbiAgICBjYXNlICdzZWNvbmQnOlxuICAgIGNhc2UgJ3NlY3MnOlxuICAgIGNhc2UgJ3NlYyc6XG4gICAgY2FzZSAncyc6XG4gICAgICByZXR1cm4gbiAqIHM7XG4gICAgY2FzZSAnbWlsbGlzZWNvbmRzJzpcbiAgICBjYXNlICdtaWxsaXNlY29uZCc6XG4gICAgY2FzZSAnbXNlY3MnOlxuICAgIGNhc2UgJ21zZWMnOlxuICAgIGNhc2UgJ21zJzpcbiAgICAgIHJldHVybiBuO1xuICB9XG59XG5cbi8qKlxuICogU2hvcnQgZm9ybWF0IGZvciBgbXNgLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtc1xuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gc2hvcnQobXMpIHtcbiAgaWYgKG1zID49IGQpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gZCkgKyAnZCc7XG4gIGlmIChtcyA+PSBoKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGgpICsgJ2gnO1xuICBpZiAobXMgPj0gbSkgcmV0dXJuIE1hdGgucm91bmQobXMgLyBtKSArICdtJztcbiAgaWYgKG1zID49IHMpIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gcykgKyAncyc7XG4gIHJldHVybiBtcyArICdtcyc7XG59XG5cbi8qKlxuICogTG9uZyBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb25nKG1zKSB7XG4gIHJldHVybiBwbHVyYWwobXMsIGQsICdkYXknKVxuICAgIHx8IHBsdXJhbChtcywgaCwgJ2hvdXInKVxuICAgIHx8IHBsdXJhbChtcywgbSwgJ21pbnV0ZScpXG4gICAgfHwgcGx1cmFsKG1zLCBzLCAnc2Vjb25kJylcbiAgICB8fCBtcyArICcgbXMnO1xufVxuXG4vKipcbiAqIFBsdXJhbGl6YXRpb24gaGVscGVyLlxuICovXG5cbmZ1bmN0aW9uIHBsdXJhbChtcywgbiwgbmFtZSkge1xuICBpZiAobXMgPCBuKSByZXR1cm47XG4gIGlmIChtcyA8IG4gKiAxLjUpIHJldHVybiBNYXRoLmZsb29yKG1zIC8gbikgKyAnICcgKyBuYW1lO1xuICByZXR1cm4gTWF0aC5jZWlsKG1zIC8gbikgKyAnICcgKyBuYW1lICsgJ3MnO1xufVxuIiwiaW1wb3J0IGdldFdpbmRvdyBmcm9tICcuL3dpbmRvdyc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGdldEFQSSgpIHtcblx0aWYgKCAhIGdldFdpbmRvdygpLndwIHx8ICEgZ2V0V2luZG93KCkud3AuY3VzdG9taXplICkge1xuXHRcdHRocm93IG5ldyBFcnJvciggJ05vIFdvcmRQcmVzcyBjdXN0b21pemVyIEFQSSBmb3VuZCcgKTtcblx0fVxuXHRyZXR1cm4gZ2V0V2luZG93KCkud3AuY3VzdG9taXplO1xufVxuIiwiaW1wb3J0IGdldEpRdWVyeSBmcm9tICcuLi9oZWxwZXJzL2pxdWVyeSc7XG5pbXBvcnQgZGVidWdGYWN0b3J5IGZyb20gJ2RlYnVnJztcblxuY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoICdjZG06Y2xpY2staGFuZGxlcicgKTtcbmNvbnN0ICQgPSBnZXRKUXVlcnkoKTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gYWRkQ2xpY2tIYW5kbGVyKCBjbGlja1RhcmdldCwgaGFuZGxlciApIHtcblx0ZGVidWcoICdhZGRpbmcgY2xpY2sgaGFuZGxlciB0byB0YXJnZXQnLCBjbGlja1RhcmdldCApO1xuXHRyZXR1cm4gJCggJ2JvZHknICkub24oICdjbGljaycsIGNsaWNrVGFyZ2V0LCBoYW5kbGVyICk7XG59XG4iLCJpbXBvcnQgZ2V0V2luZG93IGZyb20gJy4uL2hlbHBlcnMvd2luZG93JztcbmltcG9ydCBnZXRKUXVlcnkgZnJvbSAnLi4vaGVscGVycy9qcXVlcnknO1xuaW1wb3J0IHsgb24gfSBmcm9tICcuLi9oZWxwZXJzL21lc3Nlbmdlcic7XG5pbXBvcnQgZ2V0VW5kZXJzY29yZSBmcm9tICcuLi9oZWxwZXJzL3VuZGVyc2NvcmUnO1xuaW1wb3J0IGFkZENsaWNrSGFuZGxlciBmcm9tICcuLi9oZWxwZXJzL2NsaWNrLWhhbmRsZXInO1xuaW1wb3J0IGdldE9wdGlvbnMgZnJvbSAnLi4vaGVscGVycy9vcHRpb25zJztcbmltcG9ydCBkZWJ1Z0ZhY3RvcnkgZnJvbSAnZGVidWcnO1xuXG5jb25zdCBfID0gZ2V0VW5kZXJzY29yZSgpO1xuY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoICdjZG06aWNvbi1idXR0b25zJyApO1xuY29uc3QgJCA9IGdldEpRdWVyeSgpO1xuXG4vLyBJY29ucyBmcm9tOiBodHRwczovL2dpdGh1Yi5jb20vV29yZFByZXNzL2Rhc2hpY29ucy90cmVlL21hc3Rlci9zdmdcbi8vIEVsZW1lbnRzIHdpbGwgZGVmYXVsdCB0byB1c2luZyBgZWRpdEljb25gIGJ1dCBpZiBhbiBlbGVtZW50IGhhcyB0aGUgYGljb25gXG4vLyBwcm9wZXJ0eSBzZXQsIGl0IHdpbGwgdXNlIHRoYXQgYXMgdGhlIGtleSBmb3Igb25lIG9mIHRoZXNlIGljb25zIGluc3RlYWQ6XG5jb25zdCBpY29ucyA9IHtcblx0aGVhZGVySWNvbjogJzxzdmcgdmVyc2lvbj1cIjEuMVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB4bWxuczp4bGluaz1cImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIiB3aWR0aD1cIjIwXCIgaGVpZ2h0PVwiMjBcIiB2aWV3Qm94PVwiMCAwIDIwIDIwXCI+PHBhdGggZD1cIk0yLjI1IDFoMTUuNWMwLjY5IDAgMS4yNSAwLjU2IDEuMjUgMS4yNXYxNS41YzAgMC42OS0wLjU2IDEuMjUtMS4yNSAxLjI1aC0xNS41Yy0wLjY5IDAtMS4yNS0wLjU2LTEuMjUtMS4yNXYtMTUuNWMwLTAuNjkgMC41Ni0xLjI1IDEuMjUtMS4yNXpNMTcgMTd2LTE0aC0xNHYxNGgxNHpNMTAgNmMwLTEuMS0wLjktMi0yLTJzLTIgMC45LTIgMiAwLjkgMiAyIDIgMi0wLjkgMi0yek0xMyAxMWMwIDAgMC02IDMtNnYxMGMwIDAuNTUtMC40NSAxLTEgMWgtMTBjLTAuNTUgMC0xLTAuNDUtMS0xdi03YzIgMCAzIDQgMyA0czEtMyAzLTMgMyAyIDMgMnpcIj48L3BhdGg+PC9zdmc+Jyxcblx0ZWRpdEljb246ICc8c3ZnIHZlcnNpb249XCIxLjFcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgeG1sbnM6eGxpbms9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCIgd2lkdGg9XCIyMFwiIGhlaWdodD1cIjIwXCIgdmlld0JveD1cIjAgMCAyMCAyMFwiPjxwYXRoIGQ9XCJNMTMuODkgMy4zOWwyLjcxIDIuNzJjMC40NiAwLjQ2IDAuNDIgMS4yNCAwLjAzMCAxLjY0bC04LjAxMCA4LjAyMC01LjU2IDEuMTYgMS4xNi01LjU4czcuNi03LjYzIDcuOTktOC4wMzBjMC4zOS0wLjM5IDEuMjItMC4zOSAxLjY4IDAuMDcwek0xMS4xNiA2LjE4bC01LjU5IDUuNjEgMS4xMSAxLjExIDUuNTQtNS42NXpNOC4xOSAxNC40MWw1LjU4LTUuNi0xLjA3MC0xLjA4MC01LjU5IDUuNnpcIj48L3BhdGg+PC9zdmc+Jyxcblx0cGFnZUJ1aWxkZXJJY29uOiAnPHN2ZyB2ZXJzaW9uPVwiMS4xXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHhtbG5zOnhsaW5rPVwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGlua1wiIHdpZHRoPVwiMjBcIiBoZWlnaHQ9XCIyMFwiIHZpZXdCb3g9XCIwIDAgMjAgMjBcIj48cGF0aCBkPVwiTTE5IDE2di0xM2MwLTAuNTUtMC40NS0xLTEtMWgtMTVjLTAuNTUgMC0xIDAuNDUtMSAxdjEzYzAgMC41NSAwLjQ1IDEgMSAxaDE1YzAuNTUgMCAxLTAuNDUgMS0xek00IDRoMTN2NGgtMTN2LTR6TTUgNXYyaDN2LTJoLTN6TTkgNXYyaDN2LTJoLTN6TTEzIDV2Mmgzdi0yaC0zek00LjUgMTBjMC4yOCAwIDAuNSAwLjIyIDAuNSAwLjVzLTAuMjIgMC41LTAuNSAwLjUtMC41LTAuMjItMC41LTAuNSAwLjIyLTAuNSAwLjUtMC41ek02IDEwaDR2MWgtNHYtMXpNMTIgMTBoNXY1aC01di01ek00LjUgMTJjMC4yOCAwIDAuNSAwLjIyIDAuNSAwLjVzLTAuMjIgMC41LTAuNSAwLjUtMC41LTAuMjItMC41LTAuNSAwLjIyLTAuNSAwLjUtMC41ek02IDEyaDR2MWgtNHYtMXpNMTMgMTJ2Mmgzdi0yaC0zek00LjUgMTRjMC4yOCAwIDAuNSAwLjIyIDAuNSAwLjVzLTAuMjIgMC41LTAuNSAwLjUtMC41LTAuMjItMC41LTAuNSAwLjIyLTAuNSAwLjUtMC41ek02IDE0aDR2MWgtNHYtMXpcIj48L3BhdGg+PC9zdmc+J1xufTtcblxuLyoqXG4gKiBDcmVhdGUgKGlmIG5lY2Vzc2FyeSkgYW5kIHBvc2l0aW9uIGFuIGljb24gYnV0dG9uIHJlbGF0aXZlIHRvIGl0cyB0YXJnZXQuXG4gKlxuICogU2VlIGBtYWtlRm9jdXNhYmxlYCBmb3IgdGhlIGZvcm1hdCBvZiB0aGUgYGVsZW1lbnRgIHBhcmFtLlxuICpcbiAqIElmIHBvc2l0aW9uaW5nIHRoZSBpY29uIHdhcyBzdWNjZXNzZnVsLCB0aGlzIGZ1bmN0aW9uIHJldHVybnMgYSBjb3B5IG9mIHRoZVxuICogZWxlbWVudCBpdCB3YXMgcGFzc2VkIHdpdGggdGhlIGFkZGl0aW9uYWwgcGFyYW1ldGVycyBgJHRhcmdldGAgYW5kIGAkaWNvbmBcbiAqIHRoYXQgYXJlIGNhY2hlZCByZWZlcmVuY2VzIHRvIHRoZSBET00gZWxlbWVudHMuIElmIHRoZSBwb3NpdGlvbmluZyBmYWlsZWQsIGl0XG4gKiBqdXN0IHJldHVybnMgdGhlIGVsZW1lbnQgdW5jaGFuZ2VkLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBlbGVtZW50IC0gVGhlIGRhdGEgdG8gdXNlIHdoZW4gY29uc3RydWN0aW5nIHRoZSBpY29uLlxuICogQHJldHVybiB7T2JqZWN0fSBUaGUgZWxlbWVudCB0aGF0IHdhcyBwYXNzZWQsIHdpdGggYWRkaXRpb25hbCBkYXRhIGluY2x1ZGVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcG9zaXRpb25JY29uKCBlbGVtZW50ICkge1xuXHRjb25zdCAkdGFyZ2V0ID0gZ2V0RWxlbWVudFRhcmdldCggZWxlbWVudCApO1xuXHRpZiAoICEgJHRhcmdldC5sZW5ndGggKSB7XG5cdFx0ZGVidWcoIGBDb3VsZCBub3QgZmluZCB0YXJnZXQgZWxlbWVudCBmb3IgaWNvbiAke2VsZW1lbnQuaWR9IHdpdGggc2VsZWN0b3IgJHtlbGVtZW50LnNlbGVjdG9yfWAgKTtcblx0XHRyZXR1cm4gZWxlbWVudDtcblx0fVxuXHRjb25zdCAkaWNvbiA9IGZpbmRPckNyZWF0ZUljb24oIGVsZW1lbnQgKTtcblx0Y29uc3QgY3NzID0gZ2V0Q2FsY3VsYXRlZENzc0Zvckljb24oIGVsZW1lbnQsICR0YXJnZXQsICRpY29uICk7XG5cdGRlYnVnKCBgcG9zaXRpb25pbmcgaWNvbiBmb3IgJHtlbGVtZW50LmlkfSB3aXRoIENTUyAke0pTT04uc3RyaW5naWZ5KCBjc3MgKX1gICk7XG5cdCRpY29uLmNzcyggY3NzICk7XG5cdHJldHVybiBfLmV4dGVuZCgge30sIGVsZW1lbnQsIHsgJHRhcmdldCwgJGljb24gfSApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYWRkQ2xpY2tIYW5kbGVyVG9JY29uKCBlbGVtZW50ICkge1xuXHRpZiAoICEgZWxlbWVudC4kaWNvbiApIHtcblx0XHRyZXR1cm4gZWxlbWVudDtcblx0fVxuXHRhZGRDbGlja0hhbmRsZXIoIGAuJHtnZXRJY29uQ2xhc3NOYW1lKCBlbGVtZW50LmlkICl9YCwgZWxlbWVudC5oYW5kbGVyICk7XG5cdHJldHVybiBlbGVtZW50O1xufVxuXG5jb25zdCBpY29uUmVwb3NpdGlvbmVyID0gXy5kZWJvdW5jZSggZWxlbWVudHMgPT4ge1xuXHRkZWJ1ZyggYHJlcG9zaXRpb25pbmcgJHtlbGVtZW50cy5sZW5ndGh9IGljb25zYCApO1xuXHRlbGVtZW50cy5tYXAoIHBvc2l0aW9uSWNvbiApO1xufSwgMzUwICk7XG5cbmV4cG9ydCBmdW5jdGlvbiByZXBvc2l0aW9uSWNvbnMoIGVsZW1lbnRzICkge1xuXHRpY29uUmVwb3NpdGlvbmVyKCBlbGVtZW50cyApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVwb3NpdGlvbkFmdGVyRm9udHNMb2FkKCBlbGVtZW50cyApIHtcblx0aWNvblJlcG9zaXRpb25lciggZWxlbWVudHMgKTtcblxuXHRpZiAoIGdldFdpbmRvdygpLmRvY3VtZW50LmZvbnRzICkge1xuXHRcdGdldFdpbmRvdygpLmRvY3VtZW50LmZvbnRzLnJlYWR5LnRoZW4oIGljb25SZXBvc2l0aW9uZXIuYmluZCggbnVsbCwgZWxlbWVudHMgKSApO1xuXHR9XG59XG5cbi8qKlxuICogVG9nZ2xlIGljb25zIHdoZW4gY3VzdG9taXplciB0b2dnbGVzIHByZXZpZXcgbW9kZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVuYWJsZUljb25Ub2dnbGUoKSB7XG5cdG9uKCAnY2RtLXRvZ2dsZS12aXNpYmxlJywgKCkgPT4gJCggJy5jZG0taWNvbicgKS50b2dnbGVDbGFzcyggJ2NkbS1pY29uLS1oaWRkZW4nICkgKTtcbn1cblxuZnVuY3Rpb24gZmluZE9yQ3JlYXRlSWNvbiggZWxlbWVudCApIHtcblx0aWYgKCBlbGVtZW50LiRpY29uICkge1xuXHRcdHJldHVybiBlbGVtZW50LiRpY29uO1xuXHR9XG5cdGNvbnN0ICRpY29uID0gJCggYC4ke2dldEljb25DbGFzc05hbWUoIGVsZW1lbnQuaWQgKX1gICk7XG5cdGlmICggJGljb24ubGVuZ3RoICkge1xuXHRcdHJldHVybiAkaWNvbjtcblx0fVxuXG5cdGNvbnN0ICR3aWRnZXRfbG9jYXRpb24gPSBnZXRXaWRnZXRMb2NhdGlvbiggZWxlbWVudC5zZWxlY3RvciApO1xuXG5cdGNvbnN0IHRpdGxlID0gZ2V0T3B0aW9ucygpLnRyYW5zbGF0aW9uc1sgZWxlbWVudC50eXBlIF0gfHwgYENsaWNrIHRvIGVkaXQgdGhlICR7ZWxlbWVudC50aXRsZX1gO1xuXG5cdHJldHVybiBjcmVhdGVBbmRBcHBlbmRJY29uKCBlbGVtZW50LmlkLCBlbGVtZW50Lmljb24sIHRpdGxlLCAkd2lkZ2V0X2xvY2F0aW9uICk7XG59XG5cbmZ1bmN0aW9uIGdldFdpZGdldExvY2F0aW9uKCBzZWxlY3RvciApIHtcblxuXHQvLyBTaXRlIGluZm8gd3JhcHBlciAoYmVsb3cgZm9vdGVyKVxuXHRpZiAoICQoIHNlbGVjdG9yICkucGFyZW50cyggJy5zaXRlLXRpdGxlLXdyYXBwZXInICkubGVuZ3RoIHx8ICQoIHNlbGVjdG9yICkucGFyZW50cyggJy5zaXRlLXRpdGxlJyApLmxlbmd0aCApIHtcblxuXHRcdHJldHVybiAnc2l0ZS10aXRsZS13aWRnZXQnO1xuXG5cdH1cblxuXHQvLyBIZXJvXG5cdGlmICggJCggc2VsZWN0b3IgKS5oYXNDbGFzcyggJ2hlcm8nICkgKSB7XG5cblx0XHRyZXR1cm4gJ2hlcm8td2lkZ2V0JztcblxuXHR9XG5cblx0Ly8gUGFnZSBCdWlsZGVyIChiZWxvdyBmb290ZXIpXG5cdGlmICggX0N1c3RvbWl6ZXJfRE0uYmVhdmVyX2J1aWxkZXIgKSB7XG5cblx0XHRyZXR1cm4gJ3BhZ2UtYnVpbGRlci13aWRnZXQnO1xuXG5cdH1cblxuXHQvLyBGb290ZXIgV2lkZ2V0XG5cdGlmICggJCggc2VsZWN0b3IgKS5wYXJlbnRzKCAnLmZvb3Rlci13aWRnZXQnICkubGVuZ3RoICkge1xuXG5cdFx0cmV0dXJuICdmb290ZXItd2lkZ2V0JztcblxuXHR9XG5cblx0Ly8gU2l0ZSBpbmZvIHdyYXBwZXIgKGJlbG93IGZvb3Rlcilcblx0aWYgKCAkKCBzZWxlY3RvciApLnBhcmVudHMoICcuc2l0ZS1pbmZvLXdyYXBwZXInICkubGVuZ3RoICkge1xuXG5cdFx0cmV0dXJuICdzaXRlLWluZm8td3JhcHBlci13aWRnZXQnO1xuXG5cdH1cblxuXHRyZXR1cm4gJ2RlZmF1bHQnO1xuXG59XG5cbmZ1bmN0aW9uIGdldEljb25DbGFzc05hbWUoIGlkICkge1xuXHRyZXR1cm4gYGNkbS1pY29uX18ke2lkfWA7XG59XG5cbmZ1bmN0aW9uIGdldENhbGN1bGF0ZWRDc3NGb3JJY29uKCBlbGVtZW50LCAkdGFyZ2V0LCAkaWNvbiApIHtcblx0Y29uc3QgcG9zaXRpb24gPSBlbGVtZW50LnBvc2l0aW9uO1xuXHRjb25zdCBoaWRkZW5JY29uUG9zID0gKCAncnRsJyA9PT0gZ2V0V2luZG93KCkuZG9jdW1lbnQuZGlyICkgPyB7IHJpZ2h0OiAtMTAwMCwgbGVmdDogJ2F1dG8nIH0gOiB7IGxlZnQ6IC0xMDAwLCByaWdodDogJ2F1dG8nIH07XG5cblx0aWYgKCAhICR0YXJnZXQuaXMoICc6dmlzaWJsZScgKSApIHtcblx0XHRkZWJ1ZyggYHRhcmdldCBpcyBub3QgdmlzaWJsZSB3aGVuIHBvc2l0aW9uaW5nICR7ZWxlbWVudC5pZH0uIEkgd2lsbCBoaWRlIHRoZSBpY29uLiB0YXJnZXQ6YCwgJHRhcmdldCApO1xuXHRcdHJldHVybiBoaWRkZW5JY29uUG9zO1xuXHR9XG5cdGNvbnN0IG9mZnNldCA9ICR0YXJnZXQub2Zmc2V0KCk7XG5cdGxldCB0b3AgPSBvZmZzZXQudG9wO1xuXHRjb25zdCBsZWZ0ID0gb2Zmc2V0LmxlZnQ7XG5cdGxldCBtaWRkbGUgPSAkdGFyZ2V0LmlubmVySGVpZ2h0KCkgLyAyO1xuXHRsZXQgaWNvbk1pZGRsZSA9ICRpY29uLmlubmVySGVpZ2h0KCkgLyAyO1xuXHRpZiAoIHRvcCA8IDAgKSB7XG5cdFx0ZGVidWcoIGB0YXJnZXQgdG9wIG9mZnNldCAke3RvcH0gaXMgdW51c3VhbGx5IGxvdyB3aGVuIHBvc2l0aW9uaW5nICR7ZWxlbWVudC5pZH0uIEkgd2lsbCBoaWRlIHRoZSBpY29uLiB0YXJnZXQ6YCwgJHRhcmdldCApO1xuXHRcdHJldHVybiBoaWRkZW5JY29uUG9zO1xuXHR9XG5cdGlmICggbWlkZGxlIDwgMCApIHtcblx0XHRkZWJ1ZyggYHRhcmdldCBtaWRkbGUgb2Zmc2V0ICR7bWlkZGxlfSBpcyB1bnVzdWFsbHkgbG93IHdoZW4gcG9zaXRpb25pbmcgJHtlbGVtZW50LmlkfS4gSSB3aWxsIGhpZGUgdGhlIGljb24uIHRhcmdldDpgLCAkdGFyZ2V0ICk7XG5cdFx0cmV0dXJuIGhpZGRlbkljb25Qb3M7XG5cdH1cblx0aWYgKCB0b3AgPCAxICkge1xuXHRcdGRlYnVnKCBgdGFyZ2V0IHRvcCBvZmZzZXQgJHt0b3B9IGlzIHVudXN1YWxseSBsb3cgd2hlbiBwb3NpdGlvbmluZyAke2VsZW1lbnQuaWR9LiBJIHdpbGwgYWRqdXN0IHRoZSBpY29uIGRvd253YXJkcy4gdGFyZ2V0OmAsICR0YXJnZXQgKTtcblx0XHR0b3AgPSAwO1xuXHR9XG5cdGlmICggbWlkZGxlIDwgMSApIHtcblx0XHRkZWJ1ZyggYHRhcmdldCBtaWRkbGUgb2Zmc2V0ICR7bWlkZGxlfSBpcyB1bnVzdWFsbHkgbG93IHdoZW4gcG9zaXRpb25pbmcgJHtlbGVtZW50LmlkfS4gSSB3aWxsIGFkanVzdCB0aGUgaWNvbiBkb3dud2FyZHMuIHRhcmdldDpgLCAkdGFyZ2V0ICk7XG5cdFx0bWlkZGxlID0gMDtcblx0XHRpY29uTWlkZGxlID0gMDtcblx0fVxuXHRpZiAoIHBvc2l0aW9uID09PSAnbWlkZGxlJyApIHtcblx0XHRyZXR1cm4gYWRqdXN0Q29vcmRpbmF0ZXMoIHsgdG9wOiB0b3AgKyBtaWRkbGUgLSBpY29uTWlkZGxlLCBsZWZ0LCByaWdodDogJ2F1dG8nIH0gKTtcblx0fSBlbHNlIGlmICggcG9zaXRpb24gPT09ICd0b3AtcmlnaHQnICkge1xuXHRcdHJldHVybiBhZGp1c3RDb29yZGluYXRlcyggeyB0b3AsIGxlZnQ6IGxlZnQgKyAkdGFyZ2V0LndpZHRoKCkgKyA3MCwgcmlnaHQ6ICdhdXRvJyB9ICk7XG5cdH1cblx0cmV0dXJuIGFkanVzdENvb3JkaW5hdGVzKCB7IHRvcCwgbGVmdCwgcmlnaHQ6ICdhdXRvJyB9ICk7XG59XG5cbmZ1bmN0aW9uIGFkanVzdENvb3JkaW5hdGVzKCBjb29yZHMgKSB7XG5cdGNvbnN0IG1pbldpZHRoID0gMzU7XG5cdC8vIFRyeSB0byBhdm9pZCBvdmVybGFwcGluZyBoYW1idXJnZXIgbWVudXNcblx0Y29uc3QgbWF4V2lkdGggPSBnZXRXaW5kb3coKS5pbm5lcldpZHRoIC0gMTEwO1xuXHRpZiAoIGNvb3Jkcy5sZWZ0IDwgbWluV2lkdGggKSB7XG5cdFx0Y29vcmRzLmxlZnQgPSBtaW5XaWR0aDtcblx0fVxuXHRpZiAoIGNvb3Jkcy5sZWZ0ID49IG1heFdpZHRoICkge1xuXHRcdGNvb3Jkcy5sZWZ0ID0gbWF4V2lkdGg7XG5cdH1cblx0cmV0dXJuIGNvb3Jkcztcbn1cblxuZnVuY3Rpb24gY3JlYXRlSWNvbiggaWQsIGljb25UeXBlLCB0aXRsZSwgd2lkZ2V0X2xvY2F0aW9uICkge1xuXHRjb25zdCBpY29uQ2xhc3NOYW1lID0gZ2V0SWNvbkNsYXNzTmFtZSggaWQgKTtcblx0Y29uc3Qgc2NoZW1lID0gZ2V0T3B0aW9ucygpLmljb25fY29sb3I7XG5cdGNvbnN0IHRoZW1lID0gZ2V0T3B0aW9ucygpLnRoZW1lO1xuXG5cdHN3aXRjaCAoIGljb25UeXBlICkge1xuXHRcdGNhc2UgJ2hlYWRlckljb24nOlxuXHRcdFx0cmV0dXJuICQoIGA8ZGl2IGNsYXNzPVwiY2RtLWljb24gY2RtLWljb24tLWhlYWRlci1pbWFnZSAke2ljb25DbGFzc05hbWV9ICR7c2NoZW1lfSAke3RoZW1lfSAke3dpZGdldF9sb2NhdGlvbn1cIiB0aXRsZT1cIiR7dGl0bGV9XCI+JHtpY29ucy5oZWFkZXJJY29ufTwvZGl2PmAgKTtcblx0XHRjYXNlICdwYWdlQnVpbGRlckljb24nOlxuXHRcdFx0cmV0dXJuICQoIGA8ZGl2IGNsYXNzPVwiY2RtLWljb24gY2RtLWljb24tLXBhZ2UtYnVpbGRlciAke2ljb25DbGFzc05hbWV9ICR7c2NoZW1lfSAke3RoZW1lfSAke3dpZGdldF9sb2NhdGlvbn1cIiB0aXRsZT1cIiR7dGl0bGV9XCI+JHtpY29ucy5wYWdlQnVpbGRlckljb259PC9kaXY+YCApO1xuXHRcdGRlZmF1bHQ6XG5cdFx0XHRyZXR1cm4gJCggYDxkaXYgY2xhc3M9XCJjZG0taWNvbiBjZG0taWNvbi0tdGV4dCAke2ljb25DbGFzc05hbWV9ICR7c2NoZW1lfSAke3RoZW1lfSAke3dpZGdldF9sb2NhdGlvbn1cIiB0aXRsZT1cIiR7dGl0bGV9XCI+JHtpY29ucy5lZGl0SWNvbn08L2Rpdj5gICk7XG5cdH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlQW5kQXBwZW5kSWNvbiggaWQsIGljb25UeXBlLCB0aXRsZSwgd2lkZ2V0X2xvY2F0aW9uICkge1xuXHRjb25zdCAkaWNvbiA9IGNyZWF0ZUljb24oIGlkLCBpY29uVHlwZSwgdGl0bGUsIHdpZGdldF9sb2NhdGlvbiApO1xuXHQkKCBnZXRXaW5kb3coKS5kb2N1bWVudC5ib2R5ICkuYXBwZW5kKCAkaWNvbiApO1xuXHRyZXR1cm4gJGljb247XG59XG5cbmZ1bmN0aW9uIGdldEVsZW1lbnRUYXJnZXQoIGVsZW1lbnQgKSB7XG5cdGlmICggZWxlbWVudC4kdGFyZ2V0ICYmICEgZWxlbWVudC4kdGFyZ2V0LnBhcmVudCgpLmxlbmd0aCApIHtcblx0XHQvLyB0YXJnZXQgd2FzIHJlbW92ZWQgZnJvbSBET00sIGxpa2VseSBieSBwYXJ0aWFsIHJlZnJlc2hcblx0XHRlbGVtZW50LiR0YXJnZXQgPSBudWxsO1xuXHR9XG5cdHJldHVybiBlbGVtZW50LiR0YXJnZXQgfHwgJCggZWxlbWVudC5zZWxlY3RvciApO1xufVxuIiwiaW1wb3J0IGdldFdpbmRvdyBmcm9tICcuL3dpbmRvdyc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGdldEpRdWVyeSgpIHtcblx0cmV0dXJuIGdldFdpbmRvdygpLmpRdWVyeTtcbn1cbiIsImltcG9ydCBnZXRBUEkgZnJvbSAnLi9hcGknO1xuaW1wb3J0IGRlYnVnRmFjdG9yeSBmcm9tICdkZWJ1Zyc7XG5cbmNvbnN0IGRlYnVnID0gZGVidWdGYWN0b3J5KCAnY2RtOm1lc3NlbmdlcicgKTtcbmNvbnN0IGFwaSA9IGdldEFQSSgpO1xuXG5mdW5jdGlvbiBnZXRQcmV2aWV3KCkge1xuXHQvLyB3cC1hZG1pbiBpcyBwcmV2aWV3ZXIsIGZyb250ZW5kIGlzIHByZXZpZXcuIHdoeT8gbm8gaWRlYS5cblx0cmV0dXJuIHR5cGVvZiBhcGkucHJldmlldyAhPT0gJ3VuZGVmaW5lZCcgPyBhcGkucHJldmlldyA6IGFwaS5wcmV2aWV3ZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZW5kKCBpZCwgZGF0YSApIHtcblx0ZGVidWcoICdzZW5kJywgaWQsIGRhdGEgKTtcblx0cmV0dXJuIGdldFByZXZpZXcoKS5zZW5kKCBpZCwgZGF0YSApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gb24oIGlkLCBjYWxsYmFjayApIHtcblx0ZGVidWcoICdvbicsIGlkLCBjYWxsYmFjayApO1xuXHRyZXR1cm4gZ2V0UHJldmlldygpLmJpbmQoIGlkLCBjYWxsYmFjayApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gb2ZmKCBpZCwgY2FsbGJhY2sgPSBmYWxzZSApIHtcblx0ZGVidWcoICdvZmYnLCBpZCwgY2FsbGJhY2sgKTtcblx0aWYgKCBjYWxsYmFjayApIHtcblx0XHRyZXR1cm4gZ2V0UHJldmlldygpLnVuYmluZCggaWQsIGNhbGxiYWNrICk7XG5cdH1cblx0Ly8gbm8gY2FsbGJhY2s/IEdldCByaWQgb2YgYWxsIG9mICdlbVxuXHRjb25zdCB0b3BpYyA9IGdldFByZXZpZXcoKS50b3BpY3NbIGlkIF07XG5cdGlmICggdG9waWMgKSB7XG5cdFx0cmV0dXJuIHRvcGljLmVtcHR5KCk7XG5cdH1cbn1cbiIsImltcG9ydCBnZXRXaW5kb3cgZnJvbSAnLi93aW5kb3cnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBnZXRPcHRpb25zKCkge1xuXHRyZXR1cm4gZ2V0V2luZG93KCkuX0N1c3RvbWl6ZXJfRE07XG59XG4iLCJpbXBvcnQgZ2V0V2luZG93IGZyb20gJy4vd2luZG93JztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZ2V0VW5kZXJzY29yZSgpIHtcblx0cmV0dXJuIGdldFdpbmRvdygpLl87XG59XG4iLCJpbXBvcnQgZ2V0V2luZG93IGZyb20gJy4uL2hlbHBlcnMvd2luZG93JztcblxuZXhwb3J0IGZ1bmN0aW9uIGdldFVzZXJBZ2VudCgpIHtcblx0cmV0dXJuIGdldFdpbmRvdygpLm5hdmlnYXRvci51c2VyQWdlbnQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1NhZmFyaSgpIHtcblx0cmV0dXJuICggISEgZ2V0VXNlckFnZW50KCkubWF0Y2goIC9WZXJzaW9uXFwvW1xcZFxcLl0rLipTYWZhcmkvICkgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzTW9iaWxlU2FmYXJpKCkge1xuXHRyZXR1cm4gKCAhISBnZXRVc2VyQWdlbnQoKS5tYXRjaCggLyhpUG9kfGlQaG9uZXxpUGFkKS8gKSApO1xufVxuIiwibGV0IHdpbmRvd09iaiA9IG51bGw7XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRXaW5kb3coIG9iaiApIHtcblx0d2luZG93T2JqID0gb2JqO1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBnZXRXaW5kb3coKSB7XG5cdGlmICggISB3aW5kb3dPYmogJiYgISB3aW5kb3cgKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCAnTm8gd2luZG93IG9iamVjdCBmb3VuZC4nICk7XG5cdH1cblx0cmV0dXJuIHdpbmRvd09iaiB8fCB3aW5kb3c7XG59XG4iLCJpbXBvcnQgZGVidWdGYWN0b3J5IGZyb20gJ2RlYnVnJztcbmltcG9ydCBnZXRXaW5kb3cgZnJvbSAnLi4vaGVscGVycy93aW5kb3cnO1xuaW1wb3J0IGdldEpRdWVyeSBmcm9tICcuLi9oZWxwZXJzL2pxdWVyeSc7XG5pbXBvcnQgeyBzZW5kIH0gZnJvbSAnLi4vaGVscGVycy9tZXNzZW5nZXInO1xuXG5jb25zdCAkID0gZ2V0SlF1ZXJ5KCk7XG5jb25zdCBkZWJ1ZyA9IGRlYnVnRmFjdG9yeSggJ2NkbTplZGl0LXBvc3QtbGlua3MnICk7XG5cbmV4cG9ydCBmdW5jdGlvbiBtb2RpZnlFZGl0UG9zdExpbmtzKCBzZWxlY3RvciApIHtcblx0ZGVidWcoICdsaXN0ZW5pbmcgZm9yIGNsaWNrcyBvbiBwb3N0IGVkaXQgbGlua3Mgd2l0aCBzZWxlY3RvcicsIHNlbGVjdG9yICk7XG5cdC8vIFdlIHVzZSBtb3VzZWRvd24gYmVjYXVzZSBjbGljayBoYXMgYmVlbiBibG9ja2VkIGJ5IHNvbWUgb3RoZXIgSlNcblx0JCggJ2JvZHknICkub24oICdtb3VzZWRvd24nLCBzZWxlY3RvciwgZXZlbnQgPT4ge1xuXHRcdGdldFdpbmRvdygpLm9wZW4oIGV2ZW50LnRhcmdldC5ocmVmICk7XG5cdFx0c2VuZCggJ3JlY29yZEV2ZW50Jywge1xuXHRcdFx0bmFtZTogJ3dwY29tX2N1c3RvbWl6ZV9kaXJlY3RfbWFuaXB1bGF0aW9uX2NsaWNrJyxcblx0XHRcdHByb3BzOiB7IHR5cGU6ICdwb3N0LWVkaXQnIH1cblx0XHR9ICk7XG5cdH0gKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRpc2FibGVFZGl0UG9zdExpbmtzKCBzZWxlY3RvciApIHtcblx0ZGVidWcoICdoaWRpbmcgcG9zdCBlZGl0IGxpbmtzIHdpdGggc2VsZWN0b3InLCBzZWxlY3RvciApO1xuXHQkKCBzZWxlY3RvciApLmhpZGUoKTtcbn1cbiIsImltcG9ydCBnZXRXaW5kb3cgZnJvbSAnLi4vaGVscGVycy93aW5kb3cnO1xuaW1wb3J0IGdldEFQSSBmcm9tICcuLi9oZWxwZXJzL2FwaSc7XG5pbXBvcnQgZ2V0SlF1ZXJ5IGZyb20gJy4uL2hlbHBlcnMvanF1ZXJ5JztcbmltcG9ydCB7IHNlbmQgfSBmcm9tICcuLi9oZWxwZXJzL21lc3Nlbmdlcic7XG5pbXBvcnQgeyBwb3NpdGlvbkljb24sIGFkZENsaWNrSGFuZGxlclRvSWNvbiwgcmVwb3NpdGlvbkFmdGVyRm9udHNMb2FkLCBlbmFibGVJY29uVG9nZ2xlIH0gZnJvbSAnLi4vaGVscGVycy9pY29uLWJ1dHRvbnMnO1xuaW1wb3J0IGRlYnVnRmFjdG9yeSBmcm9tICdkZWJ1Zyc7XG5cbmNvbnN0IGRlYnVnID0gZGVidWdGYWN0b3J5KCAnY2RtOmZvY3VzYWJsZScgKTtcbmNvbnN0IGFwaSA9IGdldEFQSSgpO1xuY29uc3QgJCA9IGdldEpRdWVyeSgpO1xuXG4vKipcbiAqIEdpdmUgRE9NIGVsZW1lbnRzIGFuIGljb24gYnV0dG9uIGJvdW5kIHRvIGNsaWNrIGhhbmRsZXJzXG4gKlxuICogQWNjZXB0cyBhbiBhcnJheSBvZiBlbGVtZW50IG9iamVjdHMgb2YgdGhlIGZvcm06XG4gKlxuICoge1xuICogXHRpZDogQSBzdHJpbmcgdG8gaWRlbnRpZnkgdGhpcyBlbGVtZW50XG4gKiBcdHNlbGVjdG9yOiBBIENTUyBzZWxlY3RvciBzdHJpbmcgdG8gdW5pcXVlbHkgdGFyZ2V0IHRoZSBET00gZWxlbWVudFxuICogXHR0eXBlOiBBIHN0cmluZyB0byBncm91cCB0aGUgZWxlbWVudCwgZWc6ICd3aWRnZXQnXG4gKiBcdHBvc2l0aW9uOiAob3B0aW9uYWwpIEEgc3RyaW5nIGZvciBwb3NpdGlvbmluZyB0aGUgaWNvbiwgb25lIG9mICd0b3AtbGVmdCcgKGRlZmF1bHQpLCAndG9wLXJpZ2h0Jywgb3IgJ21pZGRsZScgKHZlcnRpY2FsbHkgY2VudGVyKVxuICogXHRpY29uIChvcHRpb25hbCk6IEEgc3RyaW5nIHNwZWNpZnlpbmcgd2hpY2ggaWNvbiB0byB1c2UuIFNlZSBvcHRpb25zIGluIGljb24tYnV0dG9ucy5qc1xuICogXHRoYW5kbGVyIChvcHRpb25hbCk6IEEgY2FsbGJhY2sgZnVuY3Rpb24gd2hpY2ggd2lsbCBiZSBjYWxsZWQgd2hlbiB0aGUgaWNvbiBpcyBjbGlja2VkXG4gKiB9XG4gKlxuICogSWYgbm8gaGFuZGxlciBpcyBzcGVjaWZpZWQsIHRoZSBkZWZhdWx0IHdpbGwgYmUgdXNlZCwgd2hpY2ggd2lsbCBzZW5kXG4gKiBgY29udHJvbC1mb2N1c2AgdG8gdGhlIEFQSSB3aXRoIHRoZSBlbGVtZW50IElELlxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IGVsZW1lbnRzIC0gQW4gYXJyYXkgb2YgZWxlbWVudCBvYmplY3RzIG9mIHRoZSBmb3JtIGFib3ZlLlxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBtYWtlRm9jdXNhYmxlKCBlbGVtZW50cyApIHtcblx0Y29uc3QgZWxlbWVudHNXaXRoSWNvbnMgPSBlbGVtZW50c1xuXHQucmVkdWNlKCByZW1vdmVEdXBsaWNhdGVSZWR1Y2VyLCBbXSApXG5cdC5tYXAoIHBvc2l0aW9uSWNvbiApXG5cdC5tYXAoIGNyZWF0ZUhhbmRsZXIgKVxuXHQubWFwKCBhZGRDbGlja0hhbmRsZXJUb0ljb24gKTtcblxuXHRpZiAoIGVsZW1lbnRzV2l0aEljb25zLmxlbmd0aCApIHtcblx0XHRzdGFydEljb25Nb25pdG9yKCBlbGVtZW50c1dpdGhJY29ucyApO1xuXHRcdGVuYWJsZUljb25Ub2dnbGUoKTtcblx0fVxufVxuXG5mdW5jdGlvbiBtYWtlUmVwb3NpdGlvbmVyKCBlbGVtZW50cywgY2hhbmdlVHlwZSApIHtcblx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdGRlYnVnKCAnZGV0ZWN0ZWQgY2hhbmdlOicsIGNoYW5nZVR5cGUgKTtcblx0XHRyZXBvc2l0aW9uQWZ0ZXJGb250c0xvYWQoIGVsZW1lbnRzICk7XG5cdH07XG59XG5cbi8qKlxuICogUmVnaXN0ZXIgYSBncm91cCBvZiBsaXN0ZW5lcnMgdG8gcmVwb3NpdGlvbiBpY29uIGJ1dHRvbnMgaWYgdGhlIERPTSBjaGFuZ2VzLlxuICpcbiAqIFNlZSBgbWFrZUZvY3VzYWJsZWAgZm9yIHRoZSBmb3JtYXQgb2YgdGhlIGBlbGVtZW50c2AgcGFyYW0uXG4gKlxuICogQHBhcmFtIHtBcnJheX0gZWxlbWVudHMgLSBUaGUgZWxlbWVudCBvYmplY3RzLlxuICovXG5mdW5jdGlvbiBzdGFydEljb25Nb25pdG9yKCBlbGVtZW50cyApIHtcblx0Ly8gUmVwb3NpdGlvbiBpY29ucyBhZnRlciBhbnkgdGhlbWUgZm9udHMgbG9hZFxuXHRyZXBvc2l0aW9uQWZ0ZXJGb250c0xvYWQoIGVsZW1lbnRzICk7XG5cblx0Ly8gUmVwb3NpdGlvbiBpY29ucyBhZnRlciBhIGZldyBzZWNvbmRzIGp1c3QgaW4gY2FzZSAoZWc6IGluZmluaXRlIHNjcm9sbCBvciBvdGhlciBzY3JpcHRzIGNvbXBsZXRlKVxuXHRzZXRUaW1lb3V0KCBtYWtlUmVwb3NpdGlvbmVyKCBlbGVtZW50cywgJ2ZvbGxvdy11cCcgKSwgMjAwMCApO1xuXG5cdC8vIFJlcG9zaXRpb24gaWNvbnMgYWZ0ZXIgdGhlIHdpbmRvdyBpcyByZXNpemVkXG5cdCQoIGdldFdpbmRvdygpICkucmVzaXplKCBtYWtlUmVwb3NpdGlvbmVyKCBlbGVtZW50cywgJ3Jlc2l6ZScgKSApO1xuXG5cdC8vIFJlcG9zaXRpb24gaWNvbnMgYWZ0ZXIgdGhlIHRleHQgb2YgYW55IGVsZW1lbnQgY2hhbmdlc1xuXHRlbGVtZW50cy5maWx0ZXIoIGVsID0+IFsgJ3NpdGVUaXRsZScsICdoZWFkZXJJY29uJyBdLmluZGV4T2YoIGVsLnR5cGUgKSAhPT0gLTEgKVxuXHQubWFwKCBlbCA9PiBhcGkoIGVsLmlkLCB2YWx1ZSA9PiB2YWx1ZS5iaW5kKCBtYWtlUmVwb3NpdGlvbmVyKCBlbGVtZW50cywgJ3RpdGxlIG9yIGhlYWRlcicgKSApICkgKTtcblxuXHQvLyBSZXBvc2l0aW9uIGljb25zIGFmdGVyIGN1c3RvbS1mb250cyBjaGFuZ2UgdGhlIGVsZW1lbnRzXG5cdGFwaSggJ2pldHBhY2tfZm9udHNbc2VsZWN0ZWRfZm9udHNdJywgdmFsdWUgPT4gdmFsdWUuYmluZCggbWFrZVJlcG9zaXRpb25lciggZWxlbWVudHMsICdjdXN0b20tZm9udHMnICkgKSApO1xuXG5cdC8vIFdoZW4gdGhlIHdpZGdldCBwYXJ0aWFsIHJlZnJlc2ggcnVucywgcmVwb3NpdGlvbiBpY29uc1xuXHRhcGkuYmluZCggJ3dpZGdldC11cGRhdGVkJywgbWFrZVJlcG9zaXRpb25lciggZWxlbWVudHMsICd3aWRnZXRzJyApICk7XG5cblx0Ly8gUmVwb3NpdGlvbiBpY29ucyBhZnRlciBhbnkgY3VzdG9taXplciBzZXR0aW5nIGlzIGNoYW5nZWRcblx0YXBpLmJpbmQoICdjaGFuZ2UnLCBtYWtlUmVwb3NpdGlvbmVyKCBlbGVtZW50cywgJ2FueSBzZXR0aW5nJyApICk7XG5cblx0Y29uc3QgJGRvY3VtZW50ID0gJCggZ2V0V2luZG93KCkuZG9jdW1lbnQgKTtcblxuXHQvLyBSZXBvc2l0aW9uIGFmdGVyIG1lbnVzIHVwZGF0ZWRcblx0JGRvY3VtZW50Lm9uKCAnY3VzdG9taXplLXByZXZpZXctbWVudS1yZWZyZXNoZWQnLCBtYWtlUmVwb3NpdGlvbmVyKCBlbGVtZW50cywgJ21lbnVzJyApICk7XG5cblx0Ly8gUmVwb3NpdGlvbiBhZnRlciBzY3JvbGxpbmcgaW4gY2FzZSB0aGVyZSBhcmUgZml4ZWQgcG9zaXRpb24gZWxlbWVudHNcblx0JGRvY3VtZW50Lm9uKCAnc2Nyb2xsJywgbWFrZVJlcG9zaXRpb25lciggZWxlbWVudHMsICdzY3JvbGwnICkgKTtcblxuXHQvLyBSZXBvc2l0aW9uIGFmdGVyIHBhZ2UgY2xpY2sgKGVnOiBoYW1idXJnZXIgbWVudXMpXG5cdCRkb2N1bWVudC5vbiggJ2NsaWNrJywgbWFrZVJlcG9zaXRpb25lciggZWxlbWVudHMsICdjbGljaycgKSApO1xuXG5cdC8vIFJlcG9zaXRpb24gYWZ0ZXIgYW55IHBhZ2UgY2hhbmdlcyAoaWYgdGhlIGJyb3dzZXIgc3VwcG9ydHMgaXQpXG5cdGNvbnN0IHBhZ2UgPSBnZXRXaW5kb3coKS5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnI3BhZ2UnICk7XG5cdGlmICggcGFnZSAmJiBNdXRhdGlvbk9ic2VydmVyICkge1xuXHRcdGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoIG1ha2VSZXBvc2l0aW9uZXIoIGVsZW1lbnRzLCAnRE9NIG11dGF0aW9uJyApICk7XG5cdFx0b2JzZXJ2ZXIub2JzZXJ2ZSggcGFnZSwgeyBhdHRyaWJ1dGVzOiB0cnVlLCBjaGlsZExpc3Q6IHRydWUsIGNoYXJhY3RlckRhdGE6IHRydWUgfSApO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUhhbmRsZXIoIGVsZW1lbnQgKSB7XG5cdGVsZW1lbnQuaGFuZGxlciA9IGVsZW1lbnQuaGFuZGxlciB8fCBtYWtlRGVmYXVsdEhhbmRsZXIoIGVsZW1lbnQuaWQgKTtcblx0cmV0dXJuIGVsZW1lbnQ7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZUR1cGxpY2F0ZVJlZHVjZXIoIHByZXYsIGVsICkge1xuXHRpZiAoIHByZXYubWFwKCB4ID0+IHguaWQgKS5pbmRleE9mKCBlbC5pZCApICE9PSAtMSApIHtcblx0XHRkZWJ1ZyggYHRyaWVkIHRvIGFkZCBkdXBsaWNhdGUgZWxlbWVudCBmb3IgJHtlbC5pZH1gICk7XG5cdFx0cmV0dXJuIHByZXY7XG5cdH1cblx0cmV0dXJuIHByZXYuY29uY2F0KCBlbCApO1xufVxuXG5mdW5jdGlvbiBtYWtlRGVmYXVsdEhhbmRsZXIoIGlkICkge1xuXHRyZXR1cm4gZnVuY3Rpb24oIGV2ZW50ICkge1xuXHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0ZGVidWcoICdjbGljayBkZXRlY3RlZCBvbicsIGlkICk7XG5cdFx0c2VuZCggJ2NvbnRyb2wtZm9jdXMnLCBpZCApO1xuXHR9O1xufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIGdldEZvb3RlckVsZW1lbnRzKCkge1xuXHRyZXR1cm4gW1xuXHRcdHtcblx0XHRcdGlkOiAnZm9vdGVyY3JlZGl0Jyxcblx0XHRcdHNlbGVjdG9yOiAnYVtkYXRhLXR5cGU9XCJmb290ZXItY3JlZGl0XCJdJyxcblx0XHRcdHR5cGU6ICdmb290ZXJDcmVkaXQnLFxuXHRcdFx0cG9zaXRpb246ICdtaWRkbGUnLFxuXHRcdFx0dGl0bGU6ICdmb290ZXIgY3JlZGl0Jyxcblx0XHR9XG5cdF07XG59XG4iLCJpbXBvcnQgZ2V0SlF1ZXJ5IGZyb20gJy4uL2hlbHBlcnMvanF1ZXJ5JztcbmltcG9ydCBkZWJ1Z0ZhY3RvcnkgZnJvbSAnZGVidWcnO1xuXG5jb25zdCBkZWJ1ZyA9IGRlYnVnRmFjdG9yeSggJ2NkbTpoZWFkZXItZm9jdXMnICk7XG5jb25zdCBmYWxsYmFja1NlbGVjdG9yID0gJy5oZXJvJztcbmNvbnN0ICQgPSBnZXRKUXVlcnkoKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldEhlYWRlckVsZW1lbnRzKCkge1xuXHRyZXR1cm4gWyBnZXRIZWFkZXJFbGVtZW50KCkgXTtcbn1cblxuZnVuY3Rpb24gZ2V0SGVhZGVyRWxlbWVudCgpIHtcblx0Y29uc3Qgc2VsZWN0b3IgPSBnZXRIZWFkZXJTZWxlY3RvcigpO1xuXHRjb25zdCBwb3NpdGlvbiA9ICggc2VsZWN0b3IgPT09IGZhbGxiYWNrU2VsZWN0b3IgKSA/ICd0b3AtcmlnaHQnIDogbnVsbDtcblx0cmV0dXJuIHsgaWQ6ICdoZWFkZXJfaW1hZ2UnLCBzZWxlY3RvciwgdHlwZTogJ2hlYWRlcicsIGljb246ICdoZWFkZXJJY29uJywgcG9zaXRpb24sIHRpdGxlOiAnaGVhZGVyIGltYWdlJywgfTtcbn1cblxuZnVuY3Rpb24gZ2V0SGVhZGVyU2VsZWN0b3IoKSB7XG5cdGNvbnN0IHNlbGVjdG9yID0gZ2V0TW9kaWZpZWRTZWxlY3RvcnMoKTtcblx0aWYgKCAkKCBzZWxlY3RvciApLmxlbmd0aCA+IDAgKSB7XG5cdFx0cmV0dXJuIHNlbGVjdG9yO1xuXHR9XG5cdGRlYnVnKCAnZmFpbGVkIHRvIGZpbmQgaGVhZGVyIGltYWdlIHNlbGVjdG9yIGluIHBhZ2U7IHVzaW5nIGZhbGxiYWNrJyApO1xuXHRyZXR1cm4gZmFsbGJhY2tTZWxlY3Rvcjtcbn1cblxuZnVuY3Rpb24gZ2V0TW9kaWZpZWRTZWxlY3RvcnMoKSB7XG5cdHJldHVybiBbXG5cdFx0Jy5oZWFkZXItaW1hZ2UgYSBpbWcnLFxuXHRcdCcuaGVhZGVyLWltYWdlIGltZycsXG5cdFx0Jy5zaXRlLWJyYW5kaW5nIGEgaW1nJyxcblx0XHQnLnNpdGUtaGVhZGVyLWltYWdlIGltZycsXG5cdFx0Jy5oZWFkZXItaW1hZ2UtbGluayBpbWcnLFxuXHRcdCdpbWcuaGVhZGVyLWltYWdlJyxcblx0XHQnaW1nLmhlYWRlci1pbWcnLFxuXHRcdCdpbWcuaGVhZGVyaW1hZ2UnLFxuXHRcdCdpbWcuY3VzdG9tLWhlYWRlcicsXG5cdFx0Jy5mZWF0dXJlZC1oZWFkZXItaW1hZ2UgYSBpbWcnXG5cdF0ubWFwKCBzZWxlY3RvciA9PiBzZWxlY3RvciArICdbc3JjXTpub3QoXFwnLnNpdGUtbG9nb1xcJyk6bm90KFxcJy53cC1wb3N0LWltYWdlXFwnKTpub3QoXFwnLmN1c3RvbS1sb2dvXFwnKScgKS5qb2luKCk7XG59XG4iLCJpbXBvcnQgeyBzZW5kIH0gZnJvbSAnLi4vaGVscGVycy9tZXNzZW5nZXInO1xuaW1wb3J0IGdldE9wdGlvbnMgZnJvbSAnLi4vaGVscGVycy9vcHRpb25zLmpzJztcblxuY29uc3Qgb3B0cyA9IGdldE9wdGlvbnMoKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldE1lbnVFbGVtZW50cygpIHtcblx0cmV0dXJuIG9wdHMubWVudXMubWFwKCBtZW51ID0+IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aWQ6IG1lbnUuaWQsXG5cdFx0XHRzZWxlY3RvcjogYC4ke21lbnUuaWR9IGxpOmZpcnN0LWNoaWxkYCxcblx0XHRcdHR5cGU6ICdtZW51Jyxcblx0XHRcdGhhbmRsZXI6IG1ha2VIYW5kbGVyKCBtZW51LmxvY2F0aW9uICksXG5cdFx0XHR0aXRsZTogJ21lbnUnLFxuXHRcdH07XG5cdH0gKTtcbn1cblxuZnVuY3Rpb24gbWFrZUhhbmRsZXIoIGlkICkge1xuXHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0c2VuZCggJ2ZvY3VzLW1lbnUnLCBpZCApO1xuXHR9O1xufVxuIiwiaW1wb3J0IGdldFdpbmRvdyBmcm9tICcuLi9oZWxwZXJzL3dpbmRvdyc7XG5pbXBvcnQgZ2V0SlF1ZXJ5IGZyb20gJy4uL2hlbHBlcnMvanF1ZXJ5JztcbmltcG9ydCBkZWJ1Z0ZhY3RvcnkgZnJvbSAnZGVidWcnO1xuaW1wb3J0IHsgc2VuZCB9IGZyb20gJy4uL2hlbHBlcnMvbWVzc2VuZ2VyJztcblxuY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoICdjZG06cGFnZS1idWlsZGVyLWZvY3VzJyApO1xuY29uc3QgJCA9IGdldEpRdWVyeSgpO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UGFnZUJ1aWxkZXJFbGVtZW50cygpIHtcblx0Y29uc3Qgc2VsZWN0b3IgPSAnLnNpdGUtbWFpbic7XG5cdGNvbnN0ICRlbCA9ICQoIHNlbGVjdG9yICk7XG5cdGlmICggISAkZWwubGVuZ3RoICkge1xuXHRcdGRlYnVnKCBgZm91bmQgbm8gcGFnZSBidWlsZGVyIGZvciBzZWxlY3RvciAke3NlbGVjdG9yfWAgKTtcblx0XHRyZXR1cm4gW107XG5cdH1cblx0aWYgKCAhIF9DdXN0b21pemVyX0RNLmJlYXZlcl9idWlsZGVyICkge1xuXG5cdFx0cmV0dXJuIFtdO1xuXG5cdH1cblx0cmV0dXJuICQubWFrZUFycmF5KCAkZWwgKVxuXHQucmVkdWNlKCAoIHBvc3RzLCBwb3N0ICkgPT4ge1xuXHRcdGNvbnN0IHVybCA9IGdldFBhZ2VCdWlsZGVyTGluaygpO1xuXHRcdHJldHVybiBwb3N0cy5jb25jYXQoIHtcblx0XHRcdGlkOiBwb3N0LmlkLFxuXHRcdFx0c2VsZWN0b3I6IHNlbGVjdG9yLFxuXHRcdFx0dHlwZTogJ3BhZ2VfYnVpbGRlcicsXG5cdFx0XHRwb3NpdGlvbjogJ3RvcCcsXG5cdFx0XHRoYW5kbGVyOiBtYWtlSGFuZGxlciggcG9zdC5pZCwgdXJsICksXG5cdFx0XHR0aXRsZTogJ3BhZ2VfYnVpbGRlcicsXG5cdFx0XHRpY29uOiAncGFnZUJ1aWxkZXJJY29uJyxcblx0XHR9ICk7XG5cdH0sIFtdICk7XG59XG5cbmZ1bmN0aW9uIGdldFBhZ2VCdWlsZGVyTGluaygpIHtcblx0Y29uc3QgdXJsID0gX0N1c3RvbWl6ZXJfRE0ucGFnZV9idWlsZGVyX2xpbms7XG5cdGlmICggISB1cmwgKSB7XG5cdFx0ZGVidWcoIGBpbnZhbGlkIGVkaXQgbGluayBVUkwgZm9yIHBhZ2UgYnVpbGRlcmAgKTtcblx0fVxuXHRyZXR1cm4gdXJsO1xufVxuXG5mdW5jdGlvbiBtYWtlSGFuZGxlciggaWQsIHVybCApIHtcblx0cmV0dXJuIGZ1bmN0aW9uKCBldmVudCApIHtcblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdGRlYnVnKCBgY2xpY2sgZGV0ZWN0ZWQgb24gcGFnZSBidWlsZGVyYCApO1xuXHRcdGdldFdpbmRvdygpLm9wZW4oIHVybCApO1xuXHRcdHNlbmQoICdyZWNvcmRFdmVudCcsIHtcblx0XHRcdG5hbWU6ICd3cGNvbV9jdXN0b21pemVfZGlyZWN0X21hbmlwdWxhdGlvbl9jbGljaycsXG5cdFx0XHRwcm9wczogeyB0eXBlOiAncGFnZS1idWlsZGVyLWljb24nIH1cblx0XHR9ICk7XG5cdH07XG59XG4iLCJpbXBvcnQgZ2V0QVBJIGZyb20gJy4uL2hlbHBlcnMvYXBpJztcbmltcG9ydCB7IHNlbmQgfSBmcm9tICcuLi9oZWxwZXJzL21lc3Nlbmdlcic7XG5pbXBvcnQgZ2V0SlF1ZXJ5IGZyb20gJy4uL2hlbHBlcnMvanF1ZXJ5JztcbmltcG9ydCBkZWJ1Z0ZhY3RvcnkgZnJvbSAnZGVidWcnO1xuXG5jb25zdCBkZWJ1ZyA9IGRlYnVnRmFjdG9yeSggJ2NkbTp3aWRnZXRzJyApO1xuY29uc3QgYXBpID0gZ2V0QVBJKCk7XG5jb25zdCAkID0gZ2V0SlF1ZXJ5KCk7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRXaWRnZXRFbGVtZW50cygpIHtcblx0cmV0dXJuIGdldFdpZGdldFNlbGVjdG9ycygpXG5cdC5tYXAoIGdldFdpZGdldHNGb3JTZWxlY3RvciApXG5cdC5yZWR1Y2UoICggd2lkZ2V0cywgaWQgKSA9PiB3aWRnZXRzLmNvbmNhdCggaWQgKSwgW10gKSAvLyBmbGF0dGVuIHRoZSBhcnJheXNcblx0Lm1hcCggaWQgPT4gKCB7XG5cdFx0aWQsXG5cdFx0c2VsZWN0b3I6IGdldFdpZGdldFNlbGVjdG9yRm9ySWQoIGlkICksXG5cdFx0dHlwZTogJ3dpZGdldCcsXG5cdFx0aGFuZGxlcjogbWFrZUhhbmRsZXJGb3JJZCggaWQgKSxcblx0XHR0aXRsZTogJ3dpZGdldCcsXG5cdH0gKSApO1xufVxuXG5mdW5jdGlvbiBnZXRXaWRnZXRTZWxlY3RvcnMoKSB7XG5cdHJldHVybiBhcGkuV2lkZ2V0Q3VzdG9taXplclByZXZpZXcud2lkZ2V0U2VsZWN0b3JzO1xufVxuXG5mdW5jdGlvbiBnZXRXaWRnZXRzRm9yU2VsZWN0b3IoIHNlbGVjdG9yICkge1xuXHRjb25zdCAkZWwgPSAkKCBzZWxlY3RvciApO1xuXHRpZiAoICEgJGVsLmxlbmd0aCApIHtcblx0XHRkZWJ1ZyggJ2ZvdW5kIG5vIHdpZGdldHMgZm9yIHNlbGVjdG9yJywgc2VsZWN0b3IgKTtcblx0XHRyZXR1cm4gW107XG5cdH1cblx0ZGVidWcoICdmb3VuZCB3aWRnZXRzIGZvciBzZWxlY3RvcicsIHNlbGVjdG9yLCAkZWwgKTtcblx0cmV0dXJuICQubWFrZUFycmF5KCAkZWwubWFwKCAoIGksIHcgKSA9PiB3LmlkICkgKTtcbn1cblxuZnVuY3Rpb24gZ2V0V2lkZ2V0U2VsZWN0b3JGb3JJZCggaWQgKSB7XG5cdHJldHVybiBgIyR7aWR9YDtcbn1cblxuZnVuY3Rpb24gbWFrZUhhbmRsZXJGb3JJZCggaWQgKSB7XG5cdHJldHVybiBmdW5jdGlvbiggZXZlbnQgKSB7XG5cdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRkZWJ1ZyggJ2NsaWNrIGRldGVjdGVkIG9uJywgaWQgKTtcblx0XHRzZW5kKCAnZm9jdXMtd2lkZ2V0LWNvbnRyb2wnLCBpZCApO1xuXHR9O1xufVxuIiwiaW1wb3J0IGdldFdpbmRvdyBmcm9tICcuL2hlbHBlcnMvd2luZG93JztcbmltcG9ydCBnZXRBUEkgZnJvbSAnLi9oZWxwZXJzL2FwaSc7XG5pbXBvcnQgZ2V0SlF1ZXJ5IGZyb20gJy4vaGVscGVycy9qcXVlcnknO1xuaW1wb3J0IGdldE9wdGlvbnMgZnJvbSAnLi9oZWxwZXJzL29wdGlvbnMnO1xuaW1wb3J0IHsgaXNTYWZhcmksIGlzTW9iaWxlU2FmYXJpIH0gZnJvbSAnLi9oZWxwZXJzL3VzZXItYWdlbnQnO1xuaW1wb3J0IG1ha2VGb2N1c2FibGUgZnJvbSAnLi9tb2R1bGVzL2ZvY3VzYWJsZSc7XG5pbXBvcnQgeyBtb2RpZnlFZGl0UG9zdExpbmtzLCBkaXNhYmxlRWRpdFBvc3RMaW5rcyB9IGZyb20gJy4vbW9kdWxlcy9lZGl0LXBvc3QtbGlua3MnO1xuaW1wb3J0IHsgZ2V0SGVhZGVyRWxlbWVudHMgfSBmcm9tICcuL21vZHVsZXMvaGVhZGVyLWZvY3VzJztcbmltcG9ydCB7IGdldFdpZGdldEVsZW1lbnRzIH0gZnJvbSAnLi9tb2R1bGVzL3dpZGdldC1mb2N1cyc7XG5pbXBvcnQgeyBnZXRNZW51RWxlbWVudHMgfSBmcm9tICcuL21vZHVsZXMvbWVudS1mb2N1cyc7XG4vLyBpbXBvcnQgeyBnZXRQb3N0RWxlbWVudHMgfSBmcm9tICcuL21vZHVsZXMvcG9zdC1mb2N1cyc7XG5pbXBvcnQgeyBnZXRQYWdlQnVpbGRlckVsZW1lbnRzIH0gZnJvbSAnLi9tb2R1bGVzL3BhZ2UtYnVpbGRlci1mb2N1cyc7XG5pbXBvcnQgeyBnZXRGb290ZXJFbGVtZW50cyB9IGZyb20gJy4vbW9kdWxlcy9mb290ZXItZm9jdXMnO1xuXG5jb25zdCBvcHRpb25zID0gZ2V0T3B0aW9ucygpO1xuY29uc3QgYXBpID0gZ2V0QVBJKCk7XG5jb25zdCAkID0gZ2V0SlF1ZXJ5KCk7XG5cbmZ1bmN0aW9uIHN0YXJ0RGlyZWN0TWFuaXB1bGF0aW9uKCkge1xuXHRjb25zdCBiYXNpY0VsZW1lbnRzID0gW1xuXHRcdHsgaWQ6ICdibG9nbmFtZScsIHNlbGVjdG9yOiAnLnNpdGUtdGl0bGUgYSwgI3NpdGUtdGl0bGUgYScsIHR5cGU6ICdzaXRlVGl0bGUnLCBwb3NpdGlvbjogJ21pZGRsZScsIHRpdGxlOiAnc2l0ZSB0aXRsZScgfSxcblx0XTtcblx0Y29uc3QgaGVhZGVycyA9ICggb3B0aW9ucy5oZWFkZXJJbWFnZVN1cHBvcnQgKSA/IGdldEhlYWRlckVsZW1lbnRzKCkgOiBbXTtcblx0Y29uc3Qgd2lkZ2V0cyA9IGdldFdpZGdldEVsZW1lbnRzKCk7XG5cdGNvbnN0IG1lbnVzID0gZ2V0TWVudUVsZW1lbnRzKCk7XG5cdGNvbnN0IGZvb3RlcnMgPSBnZXRGb290ZXJFbGVtZW50cygpO1xuXHRjb25zdCBwYl9lbGVtZW50cyA9IGdldFBhZ2VCdWlsZGVyRWxlbWVudHMoKTtcblxuXHRtYWtlRm9jdXNhYmxlKCBiYXNpY0VsZW1lbnRzLmNvbmNhdCggaGVhZGVycywgd2lkZ2V0cywgbWVudXMsIGZvb3RlcnMsIHBiX2VsZW1lbnRzICkgKTtcblxuXHRpZiAoIC0xID09PSBvcHRpb25zLmRpc2FibGVkTW9kdWxlcy5pbmRleE9mKCAnZWRpdC1wb3N0LWxpbmtzJyApICkge1xuXHRcdGlmICggaXNTYWZhcmkoKSAmJiAhIGlzTW9iaWxlU2FmYXJpKCkgKSB7XG5cdFx0XHRkaXNhYmxlRWRpdFBvc3RMaW5rcyggJy5wb3N0LWVkaXQtbGluaywgW2hyZWZePVwiaHR0cHM6Ly93b3JkcHJlc3MuY29tL3Bvc3RcIl0sIFtocmVmXj1cImh0dHBzOi8vd29yZHByZXNzLmNvbS9wYWdlXCJdJyApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRtb2RpZnlFZGl0UG9zdExpbmtzKCAnLnBvc3QtZWRpdC1saW5rLCBbaHJlZl49XCJodHRwczovL3dvcmRwcmVzcy5jb20vcG9zdFwiXSwgW2hyZWZePVwiaHR0cHM6Ly93b3JkcHJlc3MuY29tL3BhZ2VcIl0nICk7XG5cdFx0fVxuXHR9XG59XG5cbmFwaS5iaW5kKCAncHJldmlldy1yZWFkeScsICgpID0+IHtcblx0Ly8gdGhlIHdpZGdldCBjdXN0b21pemVyIGRvZXNuJ3QgcnVuIHVudGlsIGRvY3VtZW50LnJlYWR5LCBzbyBsZXQncyBydW4gbGF0ZXJcblx0JCggZ2V0V2luZG93KCkuZG9jdW1lbnQgKS5yZWFkeSggKCkgPT4gc2V0VGltZW91dCggc3RhcnREaXJlY3RNYW5pcHVsYXRpb24sIDEwMCApICk7XG59ICk7XG4iXX0=
