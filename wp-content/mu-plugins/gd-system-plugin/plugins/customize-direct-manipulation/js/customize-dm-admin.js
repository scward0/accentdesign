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

var _api = require('./helpers/api');

var _api2 = _interopRequireDefault(_api);

var _jquery = require('./helpers/jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _messenger = require('./helpers/messenger');

var _focusListener = require('./modules/focus-listener');

var _focusListener2 = _interopRequireDefault(_focusListener);

var _recordEvent = require('./helpers/record-event');

var _options = require('./helpers/options');

var _options2 = _interopRequireDefault(_options);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = (0, _debug2.default)('cdm:admin');
var api = (0, _api2.default)();
var $ = (0, _jquery2.default)();

// do some focusing
api.bind('ready', function () {
	debug('admin is ready');

	(0, _focusListener2.default)('control-focus', function (id) {
		return api.control(id);
	});
	(0, _focusListener2.default)('focus-menu', function (id) {
		return api.section(id);
	});
	(0, _focusListener2.default)('focus-menu-location', function (id) {
		return api.control('nav_menu_locations[' + id + ']');
	});

	// disable core so we can enhance by making sure the controls panel opens
	// before trying to focus the widget
	(0, _messenger.off)('focus-widget-control', api.Widgets.focusWidgetFormControl);
	(0, _focusListener2.default)('focus-widget-control', function (id) {
		return api.Widgets.getWidgetFormControlForWidget(id);
	});

	// Toggle icons when customizer toggles preview mode
	$('.collapse-sidebar').on('click', function () {
		return (0, _messenger.send)('cdm-toggle-visible');
	});

	// Make the site title clickable
	$('.customize-info .site-title').on('click', function () {
		if (api.previewer) {
			api.previewer.trigger('control-focus', 'blogname');
		}
	});

	(0, _recordEvent.bindPreviewEventsListener)();
});

},{"./helpers/api":5,"./helpers/jquery":6,"./helpers/messenger":7,"./helpers/options":8,"./helpers/record-event":9,"./modules/focus-listener":13,"debug":1}],5:[function(require,module,exports){
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

},{"./window":11}],6:[function(require,module,exports){
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

},{"./window":11}],7:[function(require,module,exports){
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

},{"./api":5,"debug":1}],8:[function(require,module,exports){
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

},{"./window":11}],9:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.recordEvent = recordEvent;
exports.bindPreviewEventsListener = bindPreviewEventsListener;

var _window = require('./window');

var _window2 = _interopRequireDefault(_window);

var _messenger = require('./messenger');

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = (0, _debug2.default)('cdm:event');

function recordEvent(eventName) {
	var props = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

	debug('recording Tracks event ' + eventName + ' with props:', props);
}

function bindPreviewEventsListener() {
	(0, _messenger.on)('recordEvent', function (data) {
		if (!data.name || !data.props) {
			return;
		}
		recordEvent(data.name, data.props);
	});
}

},{"./messenger":7,"./window":11,"debug":1}],10:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.isPreviewing = isPreviewing;
exports.disablePreview = disablePreview;

var _jquery = require('./jquery');

var _jquery2 = _interopRequireDefault(_jquery);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var $ = (0, _jquery2.default)();

function isPreviewing() {
	// Get truth from DOM. Gross.
	return $('.wp-full-overlay').hasClass('preview-only');
}

function disablePreview() {
	$('.customize-controls-preview-toggle').click();
}

},{"./jquery":6}],11:[function(require,module,exports){
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

},{}],12:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = focusCallout;

var _jquery = require('../helpers/jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = (0, _debug2.default)('cdm:focus-callout');
var $ = (0, _jquery2.default)();

var timeout = void 0;

function addCallout(section, type) {
	// Highlight menu item controls
	if (section && section.container && type === 'menu') {
		var menuItems = section.container.find('.customize-control-nav_menu_item');
		if (menuItems.length) {
			debug('highlighting menu item', menuItems);
			return callout(menuItems);
		}
	}

	// Highlight header image "new" button
	if (section && section.btnNew && type === 'header_image') {
		var button = $(section.btnNew);
		if (button.length) {
			debug('highlighting "new" button', button);
			return callout(button);
		}
	}

	// Highlight widget
	if (section && section.container && type === 'widget') {
		debug('highlighting widget container');
		callout(section.container);
		// focus the first input, not the stupid toggle
		return section.container.find(':input').not('button').first().focus();
	}

	// Highlight whatever is focused
	var focused = $(':focus');
	if (focused.length) {
		debug('highlighting the focused element', focused);
		return callout(focused);
	}

	debug('could not find any focused element to highlight');
}

function callout($el) {
	$el.focus();
	$el.addClass('cdm-subtle-focus').on('animationend webkitAnimationEnd', function () {
		$el.off('animationend webkitAnimationEnd').removeClass('cdm-subtle-focus');
	});
}

function focusCallout(section, type) {
	clearTimeout(timeout);
	section.focus();
	setTimeout(function () {
		return addCallout(section, type);
	}, 410);
}

},{"../helpers/jquery":6,"debug":1}],13:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = addFocusListener;

var _messenger = require('../helpers/messenger');

var _smallScreenPreview = require('../helpers/small-screen-preview');

var _focusCallout = require('./focus-callout');

var _focusCallout2 = _interopRequireDefault(_focusCallout);

var _recordEvent = require('../helpers/record-event');

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = (0, _debug2.default)('cdm:focus-listener');
var eventMap = {
	'focus-widget-control': 'widget',
	'focus-menu': 'menu',
	'focus-menu-location': 'menu',
	'focus-beaver-builder': 'beaver_builder'
};

function addFocusListener(eventName, getControlCallback) {
	(0, _messenger.on)(eventName, makeHandler(eventName, getControlCallback));
}

function makeHandler(eventName, getControlCallback) {
	return function () {
		for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
			args[_key] = arguments[_key];
		}

		var eventTargetId = args[0];
		debug('received ' + eventName + ' event for target id ' + eventTargetId);
		var focusableControl = getControlCallback.apply(getControlCallback, args);
		if (!focusableControl) {
			debug('no control found for event ' + eventName + ' and args:', args);
			return;
		}

		var type = getEventType(eventName, eventTargetId);
		(0, _recordEvent.recordEvent)('wpcom_customize_direct_manipulation_click', { type: type });

		// If we are in the small screen preview mode, bring back the controls pane
		if ((0, _smallScreenPreview.isPreviewing)()) {
			debug('focusing controls pane');
			(0, _smallScreenPreview.disablePreview)();
		}

		(0, _focusCallout2.default)(focusableControl, type);
	};
}

function getEventType(eventName, eventTargetId) {
	return eventMap[eventName] ? eventMap[eventName] : eventTargetId;
}

},{"../helpers/messenger":7,"../helpers/record-event":9,"../helpers/small-screen-preview":10,"./focus-callout":12,"debug":1}]},{},[4])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZGVidWcvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9kZWJ1Zy9kZWJ1Zy5qcyIsIm5vZGVfbW9kdWxlcy9kZWJ1Zy9ub2RlX21vZHVsZXMvbXMvaW5kZXguanMiLCJzcmMvYWRtaW4uanMiLCJzcmMvaGVscGVycy9hcGkuanMiLCJzcmMvaGVscGVycy9qcXVlcnkuanMiLCJzcmMvaGVscGVycy9tZXNzZW5nZXIuanMiLCJzcmMvaGVscGVycy9vcHRpb25zLmpzIiwic3JjL2hlbHBlcnMvcmVjb3JkLWV2ZW50LmpzIiwic3JjL2hlbHBlcnMvc21hbGwtc2NyZWVuLXByZXZpZXcuanMiLCJzcmMvaGVscGVycy93aW5kb3cuanMiLCJzcmMvbW9kdWxlcy9mb2N1cy1jYWxsb3V0LmpzIiwic3JjL21vZHVsZXMvZm9jdXMtbGlzdGVuZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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QUF4QixDQUFmO0FBQ0E7O0FBRUQsU0FBUyxXQUFULENBQXNCLFNBQXRCLEVBQWlDLGtCQUFqQyxFQUFzRDtBQUNyRCxRQUFPLFlBQW9CO0FBQUEsb0NBQVAsSUFBTztBQUFQLE9BQU87QUFBQTs7QUFDMUIsTUFBTSxnQkFBZ0IsS0FBTSxDQUFOLENBQXRCO0FBQ0Esc0JBQW1CLFNBQW5CLDZCQUFvRCxhQUFwRDtBQUNBLE1BQU0sbUJBQW1CLG1CQUFtQixLQUFuQixDQUEwQixrQkFBMUIsRUFBOEMsSUFBOUMsQ0FBekI7QUFDQSxNQUFLLENBQUUsZ0JBQVAsRUFBMEI7QUFDekIseUNBQXFDLFNBQXJDLGlCQUE0RCxJQUE1RDtBQUNBO0FBQ0E7O0FBRUQsTUFBTSxPQUFPLGFBQWMsU0FBZCxFQUF5QixhQUF6QixDQUFiO0FBQ0EsZ0NBQWEsMkNBQWIsRUFBMEQsRUFBRSxVQUFGLEVBQTFEOztBQUVBO0FBQ0EsTUFBSyx1Q0FBTCxFQUFzQjtBQUNyQixTQUFPLHdCQUFQO0FBQ0E7QUFDQTs7QUFFRCw4QkFBYyxnQkFBZCxFQUFnQyxJQUFoQztBQUNBLEVBbkJEO0FBb0JBOztBQUVELFNBQVMsWUFBVCxDQUF1QixTQUF2QixFQUFrQyxhQUFsQyxFQUFrRDtBQUNqRCxRQUFPLFNBQVUsU0FBVixJQUF3QixTQUFVLFNBQVYsQ0FBeEIsR0FBZ0QsYUFBdkQ7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcbi8qKlxuICogVGhpcyBpcyB0aGUgd2ViIGJyb3dzZXIgaW1wbGVtZW50YXRpb24gb2YgYGRlYnVnKClgLlxuICpcbiAqIEV4cG9zZSBgZGVidWcoKWAgYXMgdGhlIG1vZHVsZS5cbiAqL1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2RlYnVnJyk7XG5leHBvcnRzLmxvZyA9IGxvZztcbmV4cG9ydHMuZm9ybWF0QXJncyA9IGZvcm1hdEFyZ3M7XG5leHBvcnRzLnNhdmUgPSBzYXZlO1xuZXhwb3J0cy5sb2FkID0gbG9hZDtcbmV4cG9ydHMudXNlQ29sb3JzID0gdXNlQ29sb3JzO1xuZXhwb3J0cy5zdG9yYWdlID0gJ3VuZGVmaW5lZCcgIT0gdHlwZW9mIGNocm9tZVxuICAgICAgICAgICAgICAgJiYgJ3VuZGVmaW5lZCcgIT0gdHlwZW9mIGNocm9tZS5zdG9yYWdlXG4gICAgICAgICAgICAgICAgICA/IGNocm9tZS5zdG9yYWdlLmxvY2FsXG4gICAgICAgICAgICAgICAgICA6IGxvY2Fsc3RvcmFnZSgpO1xuXG4vKipcbiAqIENvbG9ycy5cbiAqL1xuXG5leHBvcnRzLmNvbG9ycyA9IFtcbiAgJ2xpZ2h0c2VhZ3JlZW4nLFxuICAnZm9yZXN0Z3JlZW4nLFxuICAnZ29sZGVucm9kJyxcbiAgJ2RvZGdlcmJsdWUnLFxuICAnZGFya29yY2hpZCcsXG4gICdjcmltc29uJ1xuXTtcblxuLyoqXG4gKiBDdXJyZW50bHkgb25seSBXZWJLaXQtYmFzZWQgV2ViIEluc3BlY3RvcnMsIEZpcmVmb3ggPj0gdjMxLFxuICogYW5kIHRoZSBGaXJlYnVnIGV4dGVuc2lvbiAoYW55IEZpcmVmb3ggdmVyc2lvbikgYXJlIGtub3duXG4gKiB0byBzdXBwb3J0IFwiJWNcIiBDU1MgY3VzdG9taXphdGlvbnMuXG4gKlxuICogVE9ETzogYWRkIGEgYGxvY2FsU3RvcmFnZWAgdmFyaWFibGUgdG8gZXhwbGljaXRseSBlbmFibGUvZGlzYWJsZSBjb2xvcnNcbiAqL1xuXG5mdW5jdGlvbiB1c2VDb2xvcnMoKSB7XG4gIC8vIGlzIHdlYmtpdD8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMTY0NTk2MDYvMzc2NzczXG4gIHJldHVybiAoJ1dlYmtpdEFwcGVhcmFuY2UnIGluIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZSkgfHxcbiAgICAvLyBpcyBmaXJlYnVnPyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8zOTgxMjAvMzc2NzczXG4gICAgKHdpbmRvdy5jb25zb2xlICYmIChjb25zb2xlLmZpcmVidWcgfHwgKGNvbnNvbGUuZXhjZXB0aW9uICYmIGNvbnNvbGUudGFibGUpKSkgfHxcbiAgICAvLyBpcyBmaXJlZm94ID49IHYzMT9cbiAgICAvLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1Rvb2xzL1dlYl9Db25zb2xlI1N0eWxpbmdfbWVzc2FnZXNcbiAgICAobmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLm1hdGNoKC9maXJlZm94XFwvKFxcZCspLykgJiYgcGFyc2VJbnQoUmVnRXhwLiQxLCAxMCkgPj0gMzEpO1xufVxuXG4vKipcbiAqIE1hcCAlaiB0byBgSlNPTi5zdHJpbmdpZnkoKWAsIHNpbmNlIG5vIFdlYiBJbnNwZWN0b3JzIGRvIHRoYXQgYnkgZGVmYXVsdC5cbiAqL1xuXG5leHBvcnRzLmZvcm1hdHRlcnMuaiA9IGZ1bmN0aW9uKHYpIHtcbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHYpO1xufTtcblxuXG4vKipcbiAqIENvbG9yaXplIGxvZyBhcmd1bWVudHMgaWYgZW5hYmxlZC5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGZvcm1hdEFyZ3MoKSB7XG4gIHZhciBhcmdzID0gYXJndW1lbnRzO1xuICB2YXIgdXNlQ29sb3JzID0gdGhpcy51c2VDb2xvcnM7XG5cbiAgYXJnc1swXSA9ICh1c2VDb2xvcnMgPyAnJWMnIDogJycpXG4gICAgKyB0aGlzLm5hbWVzcGFjZVxuICAgICsgKHVzZUNvbG9ycyA/ICcgJWMnIDogJyAnKVxuICAgICsgYXJnc1swXVxuICAgICsgKHVzZUNvbG9ycyA/ICclYyAnIDogJyAnKVxuICAgICsgJysnICsgZXhwb3J0cy5odW1hbml6ZSh0aGlzLmRpZmYpO1xuXG4gIGlmICghdXNlQ29sb3JzKSByZXR1cm4gYXJncztcblxuICB2YXIgYyA9ICdjb2xvcjogJyArIHRoaXMuY29sb3I7XG4gIGFyZ3MgPSBbYXJnc1swXSwgYywgJ2NvbG9yOiBpbmhlcml0J10uY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3MsIDEpKTtcblxuICAvLyB0aGUgZmluYWwgXCIlY1wiIGlzIHNvbWV3aGF0IHRyaWNreSwgYmVjYXVzZSB0aGVyZSBjb3VsZCBiZSBvdGhlclxuICAvLyBhcmd1bWVudHMgcGFzc2VkIGVpdGhlciBiZWZvcmUgb3IgYWZ0ZXIgdGhlICVjLCBzbyB3ZSBuZWVkIHRvXG4gIC8vIGZpZ3VyZSBvdXQgdGhlIGNvcnJlY3QgaW5kZXggdG8gaW5zZXJ0IHRoZSBDU1MgaW50b1xuICB2YXIgaW5kZXggPSAwO1xuICB2YXIgbGFzdEMgPSAwO1xuICBhcmdzWzBdLnJlcGxhY2UoLyVbYS16JV0vZywgZnVuY3Rpb24obWF0Y2gpIHtcbiAgICBpZiAoJyUlJyA9PT0gbWF0Y2gpIHJldHVybjtcbiAgICBpbmRleCsrO1xuICAgIGlmICgnJWMnID09PSBtYXRjaCkge1xuICAgICAgLy8gd2Ugb25seSBhcmUgaW50ZXJlc3RlZCBpbiB0aGUgKmxhc3QqICVjXG4gICAgICAvLyAodGhlIHVzZXIgbWF5IGhhdmUgcHJvdmlkZWQgdGhlaXIgb3duKVxuICAgICAgbGFzdEMgPSBpbmRleDtcbiAgICB9XG4gIH0pO1xuXG4gIGFyZ3Muc3BsaWNlKGxhc3RDLCAwLCBjKTtcbiAgcmV0dXJuIGFyZ3M7XG59XG5cbi8qKlxuICogSW52b2tlcyBgY29uc29sZS5sb2coKWAgd2hlbiBhdmFpbGFibGUuXG4gKiBOby1vcCB3aGVuIGBjb25zb2xlLmxvZ2AgaXMgbm90IGEgXCJmdW5jdGlvblwiLlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gbG9nKCkge1xuICAvLyB0aGlzIGhhY2tlcnkgaXMgcmVxdWlyZWQgZm9yIElFOC85LCB3aGVyZVxuICAvLyB0aGUgYGNvbnNvbGUubG9nYCBmdW5jdGlvbiBkb2Vzbid0IGhhdmUgJ2FwcGx5J1xuICByZXR1cm4gJ29iamVjdCcgPT09IHR5cGVvZiBjb25zb2xlXG4gICAgJiYgY29uc29sZS5sb2dcbiAgICAmJiBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuY2FsbChjb25zb2xlLmxvZywgY29uc29sZSwgYXJndW1lbnRzKTtcbn1cblxuLyoqXG4gKiBTYXZlIGBuYW1lc3BhY2VzYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlc1xuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gc2F2ZShuYW1lc3BhY2VzKSB7XG4gIHRyeSB7XG4gICAgaWYgKG51bGwgPT0gbmFtZXNwYWNlcykge1xuICAgICAgZXhwb3J0cy5zdG9yYWdlLnJlbW92ZUl0ZW0oJ2RlYnVnJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGV4cG9ydHMuc3RvcmFnZS5kZWJ1ZyA9IG5hbWVzcGFjZXM7XG4gICAgfVxuICB9IGNhdGNoKGUpIHt9XG59XG5cbi8qKlxuICogTG9hZCBgbmFtZXNwYWNlc2AuXG4gKlxuICogQHJldHVybiB7U3RyaW5nfSByZXR1cm5zIHRoZSBwcmV2aW91c2x5IHBlcnNpc3RlZCBkZWJ1ZyBtb2Rlc1xuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gbG9hZCgpIHtcbiAgdmFyIHI7XG4gIHRyeSB7XG4gICAgciA9IGV4cG9ydHMuc3RvcmFnZS5kZWJ1ZztcbiAgfSBjYXRjaChlKSB7fVxuICByZXR1cm4gcjtcbn1cblxuLyoqXG4gKiBFbmFibGUgbmFtZXNwYWNlcyBsaXN0ZWQgaW4gYGxvY2FsU3RvcmFnZS5kZWJ1Z2AgaW5pdGlhbGx5LlxuICovXG5cbmV4cG9ydHMuZW5hYmxlKGxvYWQoKSk7XG5cbi8qKlxuICogTG9jYWxzdG9yYWdlIGF0dGVtcHRzIHRvIHJldHVybiB0aGUgbG9jYWxzdG9yYWdlLlxuICpcbiAqIFRoaXMgaXMgbmVjZXNzYXJ5IGJlY2F1c2Ugc2FmYXJpIHRocm93c1xuICogd2hlbiBhIHVzZXIgZGlzYWJsZXMgY29va2llcy9sb2NhbHN0b3JhZ2VcbiAqIGFuZCB5b3UgYXR0ZW1wdCB0byBhY2Nlc3MgaXQuXG4gKlxuICogQHJldHVybiB7TG9jYWxTdG9yYWdlfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gbG9jYWxzdG9yYWdlKCl7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHdpbmRvdy5sb2NhbFN0b3JhZ2U7XG4gIH0gY2F0Y2ggKGUpIHt9XG59XG4iLCJcbi8qKlxuICogVGhpcyBpcyB0aGUgY29tbW9uIGxvZ2ljIGZvciBib3RoIHRoZSBOb2RlLmpzIGFuZCB3ZWIgYnJvd3NlclxuICogaW1wbGVtZW50YXRpb25zIG9mIGBkZWJ1ZygpYC5cbiAqXG4gKiBFeHBvc2UgYGRlYnVnKClgIGFzIHRoZSBtb2R1bGUuXG4gKi9cblxuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gZGVidWc7XG5leHBvcnRzLmNvZXJjZSA9IGNvZXJjZTtcbmV4cG9ydHMuZGlzYWJsZSA9IGRpc2FibGU7XG5leHBvcnRzLmVuYWJsZSA9IGVuYWJsZTtcbmV4cG9ydHMuZW5hYmxlZCA9IGVuYWJsZWQ7XG5leHBvcnRzLmh1bWFuaXplID0gcmVxdWlyZSgnbXMnKTtcblxuLyoqXG4gKiBUaGUgY3VycmVudGx5IGFjdGl2ZSBkZWJ1ZyBtb2RlIG5hbWVzLCBhbmQgbmFtZXMgdG8gc2tpcC5cbiAqL1xuXG5leHBvcnRzLm5hbWVzID0gW107XG5leHBvcnRzLnNraXBzID0gW107XG5cbi8qKlxuICogTWFwIG9mIHNwZWNpYWwgXCIlblwiIGhhbmRsaW5nIGZ1bmN0aW9ucywgZm9yIHRoZSBkZWJ1ZyBcImZvcm1hdFwiIGFyZ3VtZW50LlxuICpcbiAqIFZhbGlkIGtleSBuYW1lcyBhcmUgYSBzaW5nbGUsIGxvd2VyY2FzZWQgbGV0dGVyLCBpLmUuIFwiblwiLlxuICovXG5cbmV4cG9ydHMuZm9ybWF0dGVycyA9IHt9O1xuXG4vKipcbiAqIFByZXZpb3VzbHkgYXNzaWduZWQgY29sb3IuXG4gKi9cblxudmFyIHByZXZDb2xvciA9IDA7XG5cbi8qKlxuICogUHJldmlvdXMgbG9nIHRpbWVzdGFtcC5cbiAqL1xuXG52YXIgcHJldlRpbWU7XG5cbi8qKlxuICogU2VsZWN0IGEgY29sb3IuXG4gKlxuICogQHJldHVybiB7TnVtYmVyfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gc2VsZWN0Q29sb3IoKSB7XG4gIHJldHVybiBleHBvcnRzLmNvbG9yc1twcmV2Q29sb3IrKyAlIGV4cG9ydHMuY29sb3JzLmxlbmd0aF07XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgZGVidWdnZXIgd2l0aCB0aGUgZ2l2ZW4gYG5hbWVzcGFjZWAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZVxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGRlYnVnKG5hbWVzcGFjZSkge1xuXG4gIC8vIGRlZmluZSB0aGUgYGRpc2FibGVkYCB2ZXJzaW9uXG4gIGZ1bmN0aW9uIGRpc2FibGVkKCkge1xuICB9XG4gIGRpc2FibGVkLmVuYWJsZWQgPSBmYWxzZTtcblxuICAvLyBkZWZpbmUgdGhlIGBlbmFibGVkYCB2ZXJzaW9uXG4gIGZ1bmN0aW9uIGVuYWJsZWQoKSB7XG5cbiAgICB2YXIgc2VsZiA9IGVuYWJsZWQ7XG5cbiAgICAvLyBzZXQgYGRpZmZgIHRpbWVzdGFtcFxuICAgIHZhciBjdXJyID0gK25ldyBEYXRlKCk7XG4gICAgdmFyIG1zID0gY3VyciAtIChwcmV2VGltZSB8fCBjdXJyKTtcbiAgICBzZWxmLmRpZmYgPSBtcztcbiAgICBzZWxmLnByZXYgPSBwcmV2VGltZTtcbiAgICBzZWxmLmN1cnIgPSBjdXJyO1xuICAgIHByZXZUaW1lID0gY3VycjtcblxuICAgIC8vIGFkZCB0aGUgYGNvbG9yYCBpZiBub3Qgc2V0XG4gICAgaWYgKG51bGwgPT0gc2VsZi51c2VDb2xvcnMpIHNlbGYudXNlQ29sb3JzID0gZXhwb3J0cy51c2VDb2xvcnMoKTtcbiAgICBpZiAobnVsbCA9PSBzZWxmLmNvbG9yICYmIHNlbGYudXNlQ29sb3JzKSBzZWxmLmNvbG9yID0gc2VsZWN0Q29sb3IoKTtcblxuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblxuICAgIGFyZ3NbMF0gPSBleHBvcnRzLmNvZXJjZShhcmdzWzBdKTtcblxuICAgIGlmICgnc3RyaW5nJyAhPT0gdHlwZW9mIGFyZ3NbMF0pIHtcbiAgICAgIC8vIGFueXRoaW5nIGVsc2UgbGV0J3MgaW5zcGVjdCB3aXRoICVvXG4gICAgICBhcmdzID0gWyclbyddLmNvbmNhdChhcmdzKTtcbiAgICB9XG5cbiAgICAvLyBhcHBseSBhbnkgYGZvcm1hdHRlcnNgIHRyYW5zZm9ybWF0aW9uc1xuICAgIHZhciBpbmRleCA9IDA7XG4gICAgYXJnc1swXSA9IGFyZ3NbMF0ucmVwbGFjZSgvJShbYS16JV0pL2csIGZ1bmN0aW9uKG1hdGNoLCBmb3JtYXQpIHtcbiAgICAgIC8vIGlmIHdlIGVuY291bnRlciBhbiBlc2NhcGVkICUgdGhlbiBkb24ndCBpbmNyZWFzZSB0aGUgYXJyYXkgaW5kZXhcbiAgICAgIGlmIChtYXRjaCA9PT0gJyUlJykgcmV0dXJuIG1hdGNoO1xuICAgICAgaW5kZXgrKztcbiAgICAgIHZhciBmb3JtYXR0ZXIgPSBleHBvcnRzLmZvcm1hdHRlcnNbZm9ybWF0XTtcbiAgICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgZm9ybWF0dGVyKSB7XG4gICAgICAgIHZhciB2YWwgPSBhcmdzW2luZGV4XTtcbiAgICAgICAgbWF0Y2ggPSBmb3JtYXR0ZXIuY2FsbChzZWxmLCB2YWwpO1xuXG4gICAgICAgIC8vIG5vdyB3ZSBuZWVkIHRvIHJlbW92ZSBgYXJnc1tpbmRleF1gIHNpbmNlIGl0J3MgaW5saW5lZCBpbiB0aGUgYGZvcm1hdGBcbiAgICAgICAgYXJncy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICBpbmRleC0tO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG1hdGNoO1xuICAgIH0pO1xuXG4gICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBleHBvcnRzLmZvcm1hdEFyZ3MpIHtcbiAgICAgIGFyZ3MgPSBleHBvcnRzLmZvcm1hdEFyZ3MuYXBwbHkoc2VsZiwgYXJncyk7XG4gICAgfVxuICAgIHZhciBsb2dGbiA9IGVuYWJsZWQubG9nIHx8IGV4cG9ydHMubG9nIHx8IGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSk7XG4gICAgbG9nRm4uYXBwbHkoc2VsZiwgYXJncyk7XG4gIH1cbiAgZW5hYmxlZC5lbmFibGVkID0gdHJ1ZTtcblxuICB2YXIgZm4gPSBleHBvcnRzLmVuYWJsZWQobmFtZXNwYWNlKSA/IGVuYWJsZWQgOiBkaXNhYmxlZDtcblxuICBmbi5uYW1lc3BhY2UgPSBuYW1lc3BhY2U7XG5cbiAgcmV0dXJuIGZuO1xufVxuXG4vKipcbiAqIEVuYWJsZXMgYSBkZWJ1ZyBtb2RlIGJ5IG5hbWVzcGFjZXMuIFRoaXMgY2FuIGluY2x1ZGUgbW9kZXNcbiAqIHNlcGFyYXRlZCBieSBhIGNvbG9uIGFuZCB3aWxkY2FyZHMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZXNcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZW5hYmxlKG5hbWVzcGFjZXMpIHtcbiAgZXhwb3J0cy5zYXZlKG5hbWVzcGFjZXMpO1xuXG4gIHZhciBzcGxpdCA9IChuYW1lc3BhY2VzIHx8ICcnKS5zcGxpdCgvW1xccyxdKy8pO1xuICB2YXIgbGVuID0gc3BsaXQubGVuZ3RoO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoIXNwbGl0W2ldKSBjb250aW51ZTsgLy8gaWdub3JlIGVtcHR5IHN0cmluZ3NcbiAgICBuYW1lc3BhY2VzID0gc3BsaXRbaV0ucmVwbGFjZSgvXFwqL2csICcuKj8nKTtcbiAgICBpZiAobmFtZXNwYWNlc1swXSA9PT0gJy0nKSB7XG4gICAgICBleHBvcnRzLnNraXBzLnB1c2gobmV3IFJlZ0V4cCgnXicgKyBuYW1lc3BhY2VzLnN1YnN0cigxKSArICckJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBleHBvcnRzLm5hbWVzLnB1c2gobmV3IFJlZ0V4cCgnXicgKyBuYW1lc3BhY2VzICsgJyQnKSk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogRGlzYWJsZSBkZWJ1ZyBvdXRwdXQuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBkaXNhYmxlKCkge1xuICBleHBvcnRzLmVuYWJsZSgnJyk7XG59XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIHRoZSBnaXZlbiBtb2RlIG5hbWUgaXMgZW5hYmxlZCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBlbmFibGVkKG5hbWUpIHtcbiAgdmFyIGksIGxlbjtcbiAgZm9yIChpID0gMCwgbGVuID0gZXhwb3J0cy5za2lwcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGlmIChleHBvcnRzLnNraXBzW2ldLnRlc3QobmFtZSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgZm9yIChpID0gMCwgbGVuID0gZXhwb3J0cy5uYW1lcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGlmIChleHBvcnRzLm5hbWVzW2ldLnRlc3QobmFtZSkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8qKlxuICogQ29lcmNlIGB2YWxgLlxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IHZhbFxuICogQHJldHVybiB7TWl4ZWR9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBjb2VyY2UodmFsKSB7XG4gIGlmICh2YWwgaW5zdGFuY2VvZiBFcnJvcikgcmV0dXJuIHZhbC5zdGFjayB8fCB2YWwubWVzc2FnZTtcbiAgcmV0dXJuIHZhbDtcbn1cbiIsIi8qKlxuICogSGVscGVycy5cbiAqL1xuXG52YXIgcyA9IDEwMDA7XG52YXIgbSA9IHMgKiA2MDtcbnZhciBoID0gbSAqIDYwO1xudmFyIGQgPSBoICogMjQ7XG52YXIgeSA9IGQgKiAzNjUuMjU7XG5cbi8qKlxuICogUGFyc2Ugb3IgZm9ybWF0IHRoZSBnaXZlbiBgdmFsYC5cbiAqXG4gKiBPcHRpb25zOlxuICpcbiAqICAtIGBsb25nYCB2ZXJib3NlIGZvcm1hdHRpbmcgW2ZhbHNlXVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfE51bWJlcn0gdmFsXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7U3RyaW5nfE51bWJlcn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih2YWwsIG9wdGlvbnMpe1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgaWYgKCdzdHJpbmcnID09IHR5cGVvZiB2YWwpIHJldHVybiBwYXJzZSh2YWwpO1xuICByZXR1cm4gb3B0aW9ucy5sb25nXG4gICAgPyBsb25nKHZhbClcbiAgICA6IHNob3J0KHZhbCk7XG59O1xuXG4vKipcbiAqIFBhcnNlIHRoZSBnaXZlbiBgc3RyYCBhbmQgcmV0dXJuIG1pbGxpc2Vjb25kcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtOdW1iZXJ9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBwYXJzZShzdHIpIHtcbiAgc3RyID0gJycgKyBzdHI7XG4gIGlmIChzdHIubGVuZ3RoID4gMTAwMDApIHJldHVybjtcbiAgdmFyIG1hdGNoID0gL14oKD86XFxkKyk/XFwuP1xcZCspICoobWlsbGlzZWNvbmRzP3xtc2Vjcz98bXN8c2Vjb25kcz98c2Vjcz98c3xtaW51dGVzP3xtaW5zP3xtfGhvdXJzP3xocnM/fGh8ZGF5cz98ZHx5ZWFycz98eXJzP3x5KT8kL2kuZXhlYyhzdHIpO1xuICBpZiAoIW1hdGNoKSByZXR1cm47XG4gIHZhciBuID0gcGFyc2VGbG9hdChtYXRjaFsxXSk7XG4gIHZhciB0eXBlID0gKG1hdGNoWzJdIHx8ICdtcycpLnRvTG93ZXJDYXNlKCk7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgJ3llYXJzJzpcbiAgICBjYXNlICd5ZWFyJzpcbiAgICBjYXNlICd5cnMnOlxuICAgIGNhc2UgJ3lyJzpcbiAgICBjYXNlICd5JzpcbiAgICAgIHJldHVybiBuICogeTtcbiAgICBjYXNlICdkYXlzJzpcbiAgICBjYXNlICdkYXknOlxuICAgIGNhc2UgJ2QnOlxuICAgICAgcmV0dXJuIG4gKiBkO1xuICAgIGNhc2UgJ2hvdXJzJzpcbiAgICBjYXNlICdob3VyJzpcbiAgICBjYXNlICdocnMnOlxuICAgIGNhc2UgJ2hyJzpcbiAgICBjYXNlICdoJzpcbiAgICAgIHJldHVybiBuICogaDtcbiAgICBjYXNlICdtaW51dGVzJzpcbiAgICBjYXNlICdtaW51dGUnOlxuICAgIGNhc2UgJ21pbnMnOlxuICAgIGNhc2UgJ21pbic6XG4gICAgY2FzZSAnbSc6XG4gICAgICByZXR1cm4gbiAqIG07XG4gICAgY2FzZSAnc2Vjb25kcyc6XG4gICAgY2FzZSAnc2Vjb25kJzpcbiAgICBjYXNlICdzZWNzJzpcbiAgICBjYXNlICdzZWMnOlxuICAgIGNhc2UgJ3MnOlxuICAgICAgcmV0dXJuIG4gKiBzO1xuICAgIGNhc2UgJ21pbGxpc2Vjb25kcyc6XG4gICAgY2FzZSAnbWlsbGlzZWNvbmQnOlxuICAgIGNhc2UgJ21zZWNzJzpcbiAgICBjYXNlICdtc2VjJzpcbiAgICBjYXNlICdtcyc6XG4gICAgICByZXR1cm4gbjtcbiAgfVxufVxuXG4vKipcbiAqIFNob3J0IGZvcm1hdCBmb3IgYG1zYC5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbXNcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNob3J0KG1zKSB7XG4gIGlmIChtcyA+PSBkKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGQpICsgJ2QnO1xuICBpZiAobXMgPj0gaCkgcmV0dXJuIE1hdGgucm91bmQobXMgLyBoKSArICdoJztcbiAgaWYgKG1zID49IG0pIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gbSkgKyAnbSc7XG4gIGlmIChtcyA+PSBzKSByZXR1cm4gTWF0aC5yb3VuZChtcyAvIHMpICsgJ3MnO1xuICByZXR1cm4gbXMgKyAnbXMnO1xufVxuXG4vKipcbiAqIExvbmcgZm9ybWF0IGZvciBgbXNgLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtc1xuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gbG9uZyhtcykge1xuICByZXR1cm4gcGx1cmFsKG1zLCBkLCAnZGF5JylcbiAgICB8fCBwbHVyYWwobXMsIGgsICdob3VyJylcbiAgICB8fCBwbHVyYWwobXMsIG0sICdtaW51dGUnKVxuICAgIHx8IHBsdXJhbChtcywgcywgJ3NlY29uZCcpXG4gICAgfHwgbXMgKyAnIG1zJztcbn1cblxuLyoqXG4gKiBQbHVyYWxpemF0aW9uIGhlbHBlci5cbiAqL1xuXG5mdW5jdGlvbiBwbHVyYWwobXMsIG4sIG5hbWUpIHtcbiAgaWYgKG1zIDwgbikgcmV0dXJuO1xuICBpZiAobXMgPCBuICogMS41KSByZXR1cm4gTWF0aC5mbG9vcihtcyAvIG4pICsgJyAnICsgbmFtZTtcbiAgcmV0dXJuIE1hdGguY2VpbChtcyAvIG4pICsgJyAnICsgbmFtZSArICdzJztcbn1cbiIsImltcG9ydCBnZXRBUEkgZnJvbSAnLi9oZWxwZXJzL2FwaSc7XG5pbXBvcnQgZ2V0SlF1ZXJ5IGZyb20gJy4vaGVscGVycy9qcXVlcnknO1xuaW1wb3J0IHsgb2ZmLCBzZW5kIH0gZnJvbSAnLi9oZWxwZXJzL21lc3Nlbmdlcic7XG5pbXBvcnQgYWRkRm9jdXNMaXN0ZW5lciBmcm9tICcuL21vZHVsZXMvZm9jdXMtbGlzdGVuZXInO1xuaW1wb3J0IHsgYmluZFByZXZpZXdFdmVudHNMaXN0ZW5lciB9IGZyb20gJy4vaGVscGVycy9yZWNvcmQtZXZlbnQnO1xuaW1wb3J0IGdldE9wdHMgZnJvbSAnLi9oZWxwZXJzL29wdGlvbnMnO1xuaW1wb3J0IGRlYnVnRmFjdG9yeSBmcm9tICdkZWJ1Zyc7XG5cbmNvbnN0IGRlYnVnID0gZGVidWdGYWN0b3J5KCAnY2RtOmFkbWluJyApO1xuY29uc3QgYXBpID0gZ2V0QVBJKCk7XG5jb25zdCAkID0gZ2V0SlF1ZXJ5KCk7XG5cbi8vIGRvIHNvbWUgZm9jdXNpbmdcbmFwaS5iaW5kKCAncmVhZHknLCAoKSA9PiB7XG5cdGRlYnVnKCAnYWRtaW4gaXMgcmVhZHknICk7XG5cblx0YWRkRm9jdXNMaXN0ZW5lciggJ2NvbnRyb2wtZm9jdXMnLCBpZCA9PiBhcGkuY29udHJvbCggaWQgKSApO1xuXHRhZGRGb2N1c0xpc3RlbmVyKCAnZm9jdXMtbWVudScsIGlkID0+IGFwaS5zZWN0aW9uKCBpZCApICk7XG5cdGFkZEZvY3VzTGlzdGVuZXIoICdmb2N1cy1tZW51LWxvY2F0aW9uJywgaWQgPT4gYXBpLmNvbnRyb2woIGBuYXZfbWVudV9sb2NhdGlvbnNbJHtpZH1dYCApICk7XG5cblx0Ly8gZGlzYWJsZSBjb3JlIHNvIHdlIGNhbiBlbmhhbmNlIGJ5IG1ha2luZyBzdXJlIHRoZSBjb250cm9scyBwYW5lbCBvcGVuc1xuXHQvLyBiZWZvcmUgdHJ5aW5nIHRvIGZvY3VzIHRoZSB3aWRnZXRcblx0b2ZmKCAnZm9jdXMtd2lkZ2V0LWNvbnRyb2wnLCBhcGkuV2lkZ2V0cy5mb2N1c1dpZGdldEZvcm1Db250cm9sICk7XG5cdGFkZEZvY3VzTGlzdGVuZXIoICdmb2N1cy13aWRnZXQtY29udHJvbCcsIGlkID0+IGFwaS5XaWRnZXRzLmdldFdpZGdldEZvcm1Db250cm9sRm9yV2lkZ2V0KCBpZCApICk7XG5cblx0Ly8gVG9nZ2xlIGljb25zIHdoZW4gY3VzdG9taXplciB0b2dnbGVzIHByZXZpZXcgbW9kZVxuXHQkKCAnLmNvbGxhcHNlLXNpZGViYXInICkub24oICdjbGljaycsICgpID0+IHNlbmQoICdjZG0tdG9nZ2xlLXZpc2libGUnICkgKTtcblxuXHQvLyBNYWtlIHRoZSBzaXRlIHRpdGxlIGNsaWNrYWJsZVxuXHQkKCAnLmN1c3RvbWl6ZS1pbmZvIC5zaXRlLXRpdGxlJyApLm9uKCAnY2xpY2snLCAoKSA9PiB7XG5cdFx0aWYgKCBhcGkucHJldmlld2VyICkge1xuXHRcdFx0YXBpLnByZXZpZXdlci50cmlnZ2VyKCAnY29udHJvbC1mb2N1cycsICdibG9nbmFtZScgKTtcblx0XHR9XG5cdH0gKTtcblxuXHRiaW5kUHJldmlld0V2ZW50c0xpc3RlbmVyKCk7XG5cbn0gKTtcbiIsImltcG9ydCBnZXRXaW5kb3cgZnJvbSAnLi93aW5kb3cnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBnZXRBUEkoKSB7XG5cdGlmICggISBnZXRXaW5kb3coKS53cCB8fCAhIGdldFdpbmRvdygpLndwLmN1c3RvbWl6ZSApIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoICdObyBXb3JkUHJlc3MgY3VzdG9taXplciBBUEkgZm91bmQnICk7XG5cdH1cblx0cmV0dXJuIGdldFdpbmRvdygpLndwLmN1c3RvbWl6ZTtcbn1cbiIsImltcG9ydCBnZXRXaW5kb3cgZnJvbSAnLi93aW5kb3cnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBnZXRKUXVlcnkoKSB7XG5cdHJldHVybiBnZXRXaW5kb3coKS5qUXVlcnk7XG59XG4iLCJpbXBvcnQgZ2V0QVBJIGZyb20gJy4vYXBpJztcbmltcG9ydCBkZWJ1Z0ZhY3RvcnkgZnJvbSAnZGVidWcnO1xuXG5jb25zdCBkZWJ1ZyA9IGRlYnVnRmFjdG9yeSggJ2NkbTptZXNzZW5nZXInICk7XG5jb25zdCBhcGkgPSBnZXRBUEkoKTtcblxuZnVuY3Rpb24gZ2V0UHJldmlldygpIHtcblx0Ly8gd3AtYWRtaW4gaXMgcHJldmlld2VyLCBmcm9udGVuZCBpcyBwcmV2aWV3LiB3aHk/IG5vIGlkZWEuXG5cdHJldHVybiB0eXBlb2YgYXBpLnByZXZpZXcgIT09ICd1bmRlZmluZWQnID8gYXBpLnByZXZpZXcgOiBhcGkucHJldmlld2VyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VuZCggaWQsIGRhdGEgKSB7XG5cdGRlYnVnKCAnc2VuZCcsIGlkLCBkYXRhICk7XG5cdHJldHVybiBnZXRQcmV2aWV3KCkuc2VuZCggaWQsIGRhdGEgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG9uKCBpZCwgY2FsbGJhY2sgKSB7XG5cdGRlYnVnKCAnb24nLCBpZCwgY2FsbGJhY2sgKTtcblx0cmV0dXJuIGdldFByZXZpZXcoKS5iaW5kKCBpZCwgY2FsbGJhY2sgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG9mZiggaWQsIGNhbGxiYWNrID0gZmFsc2UgKSB7XG5cdGRlYnVnKCAnb2ZmJywgaWQsIGNhbGxiYWNrICk7XG5cdGlmICggY2FsbGJhY2sgKSB7XG5cdFx0cmV0dXJuIGdldFByZXZpZXcoKS51bmJpbmQoIGlkLCBjYWxsYmFjayApO1xuXHR9XG5cdC8vIG5vIGNhbGxiYWNrPyBHZXQgcmlkIG9mIGFsbCBvZiAnZW1cblx0Y29uc3QgdG9waWMgPSBnZXRQcmV2aWV3KCkudG9waWNzWyBpZCBdO1xuXHRpZiAoIHRvcGljICkge1xuXHRcdHJldHVybiB0b3BpYy5lbXB0eSgpO1xuXHR9XG59XG4iLCJpbXBvcnQgZ2V0V2luZG93IGZyb20gJy4vd2luZG93JztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZ2V0T3B0aW9ucygpIHtcblx0cmV0dXJuIGdldFdpbmRvdygpLl9DdXN0b21pemVyX0RNO1xufVxuIiwiaW1wb3J0IGdldFdpbmRvdyBmcm9tICcuL3dpbmRvdyc7XG5pbXBvcnQgeyBvbiB9IGZyb20gJy4vbWVzc2VuZ2VyJztcbmltcG9ydCBkZWJ1Z0ZhY3RvcnkgZnJvbSAnZGVidWcnO1xuY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoICdjZG06ZXZlbnQnICk7XG5cbmV4cG9ydCBmdW5jdGlvbiByZWNvcmRFdmVudCggZXZlbnROYW1lLCBwcm9wcyA9IHt9ICkge1xuXHRkZWJ1ZyggYHJlY29yZGluZyBUcmFja3MgZXZlbnQgJHtldmVudE5hbWV9IHdpdGggcHJvcHM6YCwgcHJvcHMgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJpbmRQcmV2aWV3RXZlbnRzTGlzdGVuZXIoKSB7XG5cdG9uKCAncmVjb3JkRXZlbnQnLCBkYXRhID0+IHtcblx0XHRpZiAoICEgZGF0YS5uYW1lIHx8ICEgZGF0YS5wcm9wcyApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cmVjb3JkRXZlbnQoIGRhdGEubmFtZSwgZGF0YS5wcm9wcyApO1xuXHR9ICk7XG59XG4iLCJpbXBvcnQgZ2V0SlF1ZXJ5IGZyb20gJy4vanF1ZXJ5JztcblxuY29uc3QgJCA9IGdldEpRdWVyeSgpO1xuXG5leHBvcnQgZnVuY3Rpb24gaXNQcmV2aWV3aW5nKCkge1xuXHQvLyBHZXQgdHJ1dGggZnJvbSBET00uIEdyb3NzLlxuXHRyZXR1cm4gJCggJy53cC1mdWxsLW92ZXJsYXknICkuaGFzQ2xhc3MoICdwcmV2aWV3LW9ubHknICk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkaXNhYmxlUHJldmlldygpIHtcblx0JCggJy5jdXN0b21pemUtY29udHJvbHMtcHJldmlldy10b2dnbGUnICkuY2xpY2soKTtcbn1cbiIsImxldCB3aW5kb3dPYmogPSBudWxsO1xuXG5leHBvcnQgZnVuY3Rpb24gc2V0V2luZG93KCBvYmogKSB7XG5cdHdpbmRvd09iaiA9IG9iajtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZ2V0V2luZG93KCkge1xuXHRpZiAoICEgd2luZG93T2JqICYmICEgd2luZG93ICkge1xuXHRcdHRocm93IG5ldyBFcnJvciggJ05vIHdpbmRvdyBvYmplY3QgZm91bmQuJyApO1xuXHR9XG5cdHJldHVybiB3aW5kb3dPYmogfHwgd2luZG93O1xufVxuIiwiaW1wb3J0IGdldEpRdWVyeSBmcm9tICcuLi9oZWxwZXJzL2pxdWVyeSc7XG5pbXBvcnQgZGVidWdGYWN0b3J5IGZyb20gJ2RlYnVnJztcblxuY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoICdjZG06Zm9jdXMtY2FsbG91dCcgKTtcbmNvbnN0ICQgPSBnZXRKUXVlcnkoKTtcblxubGV0IHRpbWVvdXQ7XG5cbmZ1bmN0aW9uIGFkZENhbGxvdXQoIHNlY3Rpb24sIHR5cGUgKSB7XG5cdC8vIEhpZ2hsaWdodCBtZW51IGl0ZW0gY29udHJvbHNcblx0aWYgKCBzZWN0aW9uICYmIHNlY3Rpb24uY29udGFpbmVyICYmIHR5cGUgPT09ICdtZW51JyApIHtcblx0XHRjb25zdCBtZW51SXRlbXMgPSBzZWN0aW9uLmNvbnRhaW5lci5maW5kKCAnLmN1c3RvbWl6ZS1jb250cm9sLW5hdl9tZW51X2l0ZW0nICk7XG5cdFx0aWYgKCBtZW51SXRlbXMubGVuZ3RoICkge1xuXHRcdFx0ZGVidWcoICdoaWdobGlnaHRpbmcgbWVudSBpdGVtJywgbWVudUl0ZW1zICk7XG5cdFx0XHRyZXR1cm4gY2FsbG91dCggbWVudUl0ZW1zICk7XG5cdFx0fVxuXHR9XG5cblx0Ly8gSGlnaGxpZ2h0IGhlYWRlciBpbWFnZSBcIm5ld1wiIGJ1dHRvblxuXHRpZiAoIHNlY3Rpb24gJiYgc2VjdGlvbi5idG5OZXcgJiYgdHlwZSA9PT0gJ2hlYWRlcl9pbWFnZScgKSB7XG5cdFx0Y29uc3QgYnV0dG9uID0gJCggc2VjdGlvbi5idG5OZXcgKTtcblx0XHRpZiAoIGJ1dHRvbi5sZW5ndGggKSB7XG5cdFx0XHRkZWJ1ZyggJ2hpZ2hsaWdodGluZyBcIm5ld1wiIGJ1dHRvbicsIGJ1dHRvbiApO1xuXHRcdFx0cmV0dXJuIGNhbGxvdXQoIGJ1dHRvbiApO1xuXHRcdH1cblx0fVxuXG5cdC8vIEhpZ2hsaWdodCB3aWRnZXRcblx0aWYgKCBzZWN0aW9uICYmIHNlY3Rpb24uY29udGFpbmVyICYmIHR5cGUgPT09ICd3aWRnZXQnICkge1xuXHRcdGRlYnVnKCAnaGlnaGxpZ2h0aW5nIHdpZGdldCBjb250YWluZXInICk7XG5cdFx0Y2FsbG91dCggc2VjdGlvbi5jb250YWluZXIgKTtcblx0XHQvLyBmb2N1cyB0aGUgZmlyc3QgaW5wdXQsIG5vdCB0aGUgc3R1cGlkIHRvZ2dsZVxuXHRcdHJldHVybiBzZWN0aW9uLmNvbnRhaW5lci5maW5kKCAnOmlucHV0JyApLm5vdCggJ2J1dHRvbicgKS5maXJzdCgpLmZvY3VzKCk7XG5cdH1cblxuXHQvLyBIaWdobGlnaHQgd2hhdGV2ZXIgaXMgZm9jdXNlZFxuXHRjb25zdCBmb2N1c2VkID0gJCggJzpmb2N1cycgKTtcblx0aWYgKCBmb2N1c2VkLmxlbmd0aCApIHtcblx0XHRkZWJ1ZyggJ2hpZ2hsaWdodGluZyB0aGUgZm9jdXNlZCBlbGVtZW50JywgZm9jdXNlZCApO1xuXHRcdHJldHVybiBjYWxsb3V0KCBmb2N1c2VkICk7XG5cdH1cblxuXHRkZWJ1ZyggJ2NvdWxkIG5vdCBmaW5kIGFueSBmb2N1c2VkIGVsZW1lbnQgdG8gaGlnaGxpZ2h0JyApO1xufVxuXG5mdW5jdGlvbiBjYWxsb3V0KCAkZWwgKSB7XG5cdCRlbC5mb2N1cygpO1xuXHQkZWwuYWRkQ2xhc3MoICdjZG0tc3VidGxlLWZvY3VzJyApLm9uKCAnYW5pbWF0aW9uZW5kIHdlYmtpdEFuaW1hdGlvbkVuZCcsICgpID0+IHtcblx0XHQkZWwub2ZmKCAnYW5pbWF0aW9uZW5kIHdlYmtpdEFuaW1hdGlvbkVuZCcgKS5yZW1vdmVDbGFzcyggJ2NkbS1zdWJ0bGUtZm9jdXMnICk7XG5cdH0gKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZm9jdXNDYWxsb3V0KCBzZWN0aW9uLCB0eXBlICkge1xuXHRjbGVhclRpbWVvdXQoIHRpbWVvdXQgKTtcblx0c2VjdGlvbi5mb2N1cygpO1xuXHRzZXRUaW1lb3V0KCAoKSA9PiBhZGRDYWxsb3V0KCBzZWN0aW9uLCB0eXBlICksIDQxMCApO1xufVxuIiwiaW1wb3J0IHsgb24gfSBmcm9tICcuLi9oZWxwZXJzL21lc3Nlbmdlcic7XG5pbXBvcnQgeyBpc1ByZXZpZXdpbmcsIGRpc2FibGVQcmV2aWV3IH0gZnJvbSAnLi4vaGVscGVycy9zbWFsbC1zY3JlZW4tcHJldmlldyc7XG5pbXBvcnQgZm9jdXNDYWxsb3V0IGZyb20gJy4vZm9jdXMtY2FsbG91dCc7XG5pbXBvcnQgeyByZWNvcmRFdmVudCB9IGZyb20gJy4uL2hlbHBlcnMvcmVjb3JkLWV2ZW50JztcbmltcG9ydCBkZWJ1Z0ZhY3RvcnkgZnJvbSAnZGVidWcnO1xuXG5jb25zdCBkZWJ1ZyA9IGRlYnVnRmFjdG9yeSggJ2NkbTpmb2N1cy1saXN0ZW5lcicgKTtcbmNvbnN0IGV2ZW50TWFwID0ge1xuXHQnZm9jdXMtd2lkZ2V0LWNvbnRyb2wnOiAnd2lkZ2V0Jyxcblx0J2ZvY3VzLW1lbnUnOiAnbWVudScsXG5cdCdmb2N1cy1tZW51LWxvY2F0aW9uJzogJ21lbnUnLFxuXHQnZm9jdXMtYmVhdmVyLWJ1aWxkZXInOiAnYmVhdmVyX2J1aWxkZXInXG59O1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBhZGRGb2N1c0xpc3RlbmVyKCBldmVudE5hbWUsIGdldENvbnRyb2xDYWxsYmFjayApIHtcblx0b24oIGV2ZW50TmFtZSwgbWFrZUhhbmRsZXIoIGV2ZW50TmFtZSwgZ2V0Q29udHJvbENhbGxiYWNrICkgKTtcbn1cblxuZnVuY3Rpb24gbWFrZUhhbmRsZXIoIGV2ZW50TmFtZSwgZ2V0Q29udHJvbENhbGxiYWNrICkge1xuXHRyZXR1cm4gZnVuY3Rpb24oIC4uLmFyZ3MgKSB7XG5cdFx0Y29uc3QgZXZlbnRUYXJnZXRJZCA9IGFyZ3NbIDAgXTtcblx0XHRkZWJ1ZyggYHJlY2VpdmVkICR7ZXZlbnROYW1lfSBldmVudCBmb3IgdGFyZ2V0IGlkICR7ZXZlbnRUYXJnZXRJZH1gICk7XG5cdFx0Y29uc3QgZm9jdXNhYmxlQ29udHJvbCA9IGdldENvbnRyb2xDYWxsYmFjay5hcHBseSggZ2V0Q29udHJvbENhbGxiYWNrLCBhcmdzICk7XG5cdFx0aWYgKCAhIGZvY3VzYWJsZUNvbnRyb2wgKSB7XG5cdFx0XHRkZWJ1ZyggYG5vIGNvbnRyb2wgZm91bmQgZm9yIGV2ZW50ICR7ZXZlbnROYW1lfSBhbmQgYXJnczpgLCBhcmdzICk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdHlwZSA9IGdldEV2ZW50VHlwZSggZXZlbnROYW1lLCBldmVudFRhcmdldElkICk7XG5cdFx0cmVjb3JkRXZlbnQoICd3cGNvbV9jdXN0b21pemVfZGlyZWN0X21hbmlwdWxhdGlvbl9jbGljaycsIHsgdHlwZSB9ICk7XG5cblx0XHQvLyBJZiB3ZSBhcmUgaW4gdGhlIHNtYWxsIHNjcmVlbiBwcmV2aWV3IG1vZGUsIGJyaW5nIGJhY2sgdGhlIGNvbnRyb2xzIHBhbmVcblx0XHRpZiAoIGlzUHJldmlld2luZygpICkge1xuXHRcdFx0ZGVidWcoICdmb2N1c2luZyBjb250cm9scyBwYW5lJyApO1xuXHRcdFx0ZGlzYWJsZVByZXZpZXcoKTtcblx0XHR9XG5cblx0XHRmb2N1c0NhbGxvdXQoIGZvY3VzYWJsZUNvbnRyb2wsIHR5cGUgKTtcblx0fTtcbn1cblxuZnVuY3Rpb24gZ2V0RXZlbnRUeXBlKCBldmVudE5hbWUsIGV2ZW50VGFyZ2V0SWQgKSB7XG5cdHJldHVybiBldmVudE1hcFsgZXZlbnROYW1lIF0gPyBldmVudE1hcFsgZXZlbnROYW1lIF0gOiBldmVudFRhcmdldElkO1xufVxuIl19
