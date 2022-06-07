var translateApiKey = "AIzaSyDCw5dHsPt8L9Klt1xyzuZgA132QQLpb3Y";
var gtTimeInfo = {
  fetchStart: Date.now(),
  fetchEnd: Date.now(),
};
var serverParams = "";
var securityOrigin = "https://translate.googleapis.com/";
// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// This code is used in conjunction with the Google Translate Element script.
// It is executed in an isolated world of a page to translate it from one
// language to another.
// It should be included in the page before the Translate Element script.

// eslint-disable-next-line no-var
var cr = cr || {};

/**
 * An object to provide functions to interact with the Translate library.
 * @type {object}
 */
cr.googleTranslate = (function () {
  /**
   * The Translate Element library's instance.
   * @type {object}
   */
  let lib;

  /**
   * A flag representing if the Translate Element library is initialized.
   * @type {boolean}
   */
  let libReady = false;

  /**
   * Error definitions for |errorCode|. See chrome/common/translate_errors.h
   * to modify the definition.
   * @const
   */
  const ERROR = {
    NONE: 0,
    INITIALIZATION_ERROR: 2,
    UNSUPPORTED_LANGUAGE: 4,
    TRANSLATION_ERROR: 6,
    TRANSLATION_TIMEOUT: 7,
    UNEXPECTED_SCRIPT_ERROR: 8,
    BAD_ORIGIN: 9,
    SCRIPT_LOAD_ERROR: 10,
  };

  /**
   * Error code map from te.dom.DomTranslator.Error to |errorCode|.
   * See also go/dom_translator.js in google3.
   * @const
   */
  const TRANSLATE_ERROR_TO_ERROR_CODE_MAP = {
    0: ERROR["NONE"],
    1: ERROR["TRANSLATION_ERROR"],
    2: ERROR["UNSUPPORTED_LANGUAGE"],
  };

  /**
   * An error code happened in translate.js and the Translate Element library.
   */
  let errorCode = ERROR["NONE"];

  /**
   * A flag representing if the Translate Element has finished a translation.
   * @type {boolean}
   */
  let finished = false;

  /**
   * Counts how many times the checkLibReady function is called. The function
   * is called in every 100 msec and counted up to 6.
   * @type {number}
   */
  let checkReadyCount = 0;

  /**
   * Time in msec when this script is injected.
   * @type {number}
   */
  const injectedTime = performance.now();

  /**
   * Time in msec when the Translate Element library is loaded completely.
   * @type {number}
   */
  let loadedTime = 0.0;

  /**
   * Time in msec when the Translate Element library is initialized and ready
   * for performing translation.
   * @type {number}
   */
  let readyTime = 0.0;

  /**
   * Time in msec when the Translate Element library starts a translation.
   * @type {number}
   */
  let startTime = 0.0;

  /**
   * Time in msec when the Translate Element library ends a translation.
   * @type {number}
   */
  let endTime = 0.0;

  /**
   * Callback invoked when Translate Element's ready state is known.
   * Will only be invoked once to indicate successful or failed initialization.
   * In the failure case, errorCode() and error() will indicate the reason.
   * Only used on iOS.
   * @type {function}
   */
  let readyCallback;

  /**
   * Callback invoked when Translate Element's translation result is known.
   * Will only be invoked once to indicate successful or failed translation.
   * In the failure case, errorCode() and error() will indicate the reason.
   * Only used on iOS.
   * @type {function}
   */
  let resultCallback;

  /**
   * Callback invoked when Translate Element requests load of javascript files.
   * Currently main.js and element_main.js are expected to be loaded.
   * @type {function(string)}
   */
  let loadJavascriptCallback;

  function checkLibReady() {
    if (lib.isAvailable()) {
      readyTime = performance.now();
      libReady = true;
      invokeReadyCallback();
      return;
    }
    if (checkReadyCount++ > 5) {
      errorCode = ERROR["TRANSLATION_TIMEOUT"];
      invokeReadyCallback();
      return;
    }
    setTimeout(checkLibReady, 100);
  }

  function onTranslateProgress(progress, opt_finished, opt_error) {
    finished = opt_finished;
    // opt_error can be 'undefined'.
    if (typeof opt_error === "boolean" && opt_error) {
      // TODO(toyoshim): Remove boolean case once a server is updated.
      errorCode = ERROR["TRANSLATION_ERROR"];
      // We failed to translate, restore so the page is in a consistent state.
      lib.restore();
      invokeResultCallback();
    } else if (typeof opt_error === "number" && opt_error !== 0) {
      errorCode = TRANSLATE_ERROR_TO_ERROR_CODE_MAP[opt_error];
      lib.restore();
      invokeResultCallback();
    }
    // Translate works differently depending on the prescence of the native
    // IntersectionObserver APIs.
    // If it is available, translate will occur incrementally as the user
    // scrolls elements into view, and this method will be called continuously
    // with |opt_finished| always set as true.
    // On the other hand, if it is unavailable, the entire page will be
    // translated at once in a piece meal manner, and this method may still be
    // called several times, though only the last call will have |opt_finished|
    // set as true.
    if (finished) {
      endTime = performance.now();
      invokeResultCallback();
    }
  }

  function invokeReadyCallback() {
    if (readyCallback) {
      readyCallback();
      readyCallback = null;
    }
  }

  function invokeResultCallback() {
    if (resultCallback) {
      resultCallback();
      resultCallback = null;
    }
  }

  // Public API.
  return {
    /**
     * Setter for readyCallback. No op if already set.
     * @param {function} callback The function to be invoked.
     */
    set readyCallback(callback) {
      if (!readyCallback) {
        readyCallback = callback;
      }
    },

    /**
     * Setter for resultCallback. No op if already set.
     * @param {function} callback The function to be invoked.
     */
    set resultCallback(callback) {
      if (!resultCallback) {
        resultCallback = callback;
      }
    },

    /**
     * Setter for loadJavascriptCallback. No op if already set.
     * @param {function(string)} callback The function to be invoked.
     */
    set loadJavascriptCallback(callback) {
      if (!loadJavascriptCallback) {
        loadJavascriptCallback = callback;
      }
    },

    /**
     * Whether the library is ready.
     * The translate function should only be called when |libReady| is true.
     * @type {boolean}
     */
    get libReady() {
      return libReady;
    },

    /**
     * Whether the current translate has finished successfully.
     * @type {boolean}
     */
    get finished() {
      return finished;
    },

    /**
     * Whether an error occured initializing the library of translating the
     * page.
     * @type {boolean}
     */
    get error() {
      return errorCode !== ERROR["NONE"];
    },

    /**
     * Returns a number to represent error type.
     * @type {number}
     */
    get errorCode() {
      return errorCode;
    },

    /**
     * The language the page translated was in. Is valid only after the page
     * has been successfully translated and the original language specified to
     * the translate function was 'auto'. Is empty otherwise.
     * Some versions of Element library don't provide |getDetectedLanguage|
     * function. In that case, this function returns 'und'.
     * @type {boolean}
     */
    get sourceLang() {
      if (!libReady || !finished || errorCode !== ERROR["NONE"]) {
        return "";
      }
      if (!lib.getDetectedLanguage) {
        return "und";
      }
      // Defined as translate::kUnknownLanguageCode in C++.
      return lib.getDetectedLanguage();
    },

    /**
     * Time in msec from this script being injected to all server side scripts
     * being loaded.
     * @type {number}
     */
    get loadTime() {
      if (loadedTime === 0) {
        return 0;
      }
      return loadedTime - injectedTime;
    },

    /**
     * Time in msec from this script being injected to the Translate Element
     * library being ready.
     * @type {number}
     */
    get readyTime() {
      if (!libReady) {
        return 0;
      }
      return readyTime - injectedTime;
    },

    /**
     * Time in msec to perform translation.
     * @type {number}
     */
    get translationTime() {
      if (!finished) {
        return 0;
      }
      return endTime - startTime;
    },

    /**
     * Translate the page contents.  Note that the translation is asynchronous.
     * You need to regularly check the state of |finished| and |errorCode| to
     * know if the translation finished or if there was an error.
     * @param {string} originalLang The language the page is in.
     * @param {string} targetLang The language the page should be translated to.
     * @return {boolean} False if the translate library was not ready, in which
     *                   case the translation is not started.  True otherwise.
     */
    translate(originalLang, targetLang) {
      finished = false;
      errorCode = ERROR["NONE"];
      if (!libReady) {
        return false;
      }
      startTime = performance.now();
      try {
        lib.translatePage(originalLang, targetLang, onTranslateProgress);
      } catch (err) {
        console.error("Translate: " + err);
        errorCode = ERROR["UNEXPECTED_SCRIPT_ERROR"];
        invokeResultCallback();
        return false;
      }
      return true;
    },

    /**
     * Reverts the page contents to its original value, effectively reverting
     * any performed translation.  Does nothing if the page was not translated.
     */
    revert() {
      lib.restore();
    },

    /**
     * Called when an error is caught while executing script fetched in
     * translate_script.cc.
     */
    onTranslateElementError(error) {
      errorCode = ERROR["UNEXPECTED_SCRIPT_ERROR"];
      invokeReadyCallback();
    },

    /**
     * Entry point called by the Translate Element once it has been injected in
     * the page.
     */
    onTranslateElementLoad() {
      loadedTime = performance.now();
      try {
        lib = google.translate.TranslateService({
          // translateApiKey is predefined by translate_script.cc.
          key: translateApiKey,
          serverParams: serverParams,
          timeInfo: gtTimeInfo,
          useSecureConnection: true,
        });
        translateApiKey = undefined;
        serverParams = undefined;
        gtTimeInfo = undefined;
      } catch (err) {
        errorCode = ERROR["INITIALIZATION_ERROR"];
        translateApiKey = undefined;
        serverParams = undefined;
        gtTimeInfo = undefined;
        invokeReadyCallback();
        return;
      }
      // The TranslateService is not available immediately as it needs to start
      // Flash.  Let's wait until it is ready.
      checkLibReady();
    },

    /**
     * Entry point called by the Translate Element when it want to load an
     * external CSS resource into the page.
     * @param {string} url URL of an external CSS resource to load.
     */
    onLoadCSS(url) {
      const element = document.createElement("link");
      element.type = "text/css";
      element.rel = "stylesheet";
      element.charset = "UTF-8";
      element.href = url;
      document.head.appendChild(element);
    },

    /**
     * Entry point called by the Translate Element when it want to load and run
     * an external JavaScript on the page.
     * @param {string} url URL of an external JavaScript to load.
     */
    onLoadJavascript(url) {
      // securityOrigin is predefined by translate_script.cc.
      if (!url.startsWith(securityOrigin)) {
        console.error("Translate: " + url + " is not allowed to load.");
        errorCode = ERROR["BAD_ORIGIN"];
        return;
      }

      if (loadJavascriptCallback) {
        loadJavascriptCallback(url);
        return;
      }

      const xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.onreadystatechange = function () {
        if (this.readyState !== this.DONE) {
          return;
        }
        if (this.status !== 200) {
          errorCode = ERROR["SCRIPT_LOAD_ERROR"];
          return;
        }
        eval(this.responseText);
      };
      xhr.send();
    },
  };
})();
try {
  (function () {
    var gtConstEvalStartTime = new Date();
    /*

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/
    var d = "Translate",
      k = this || self;
    function l(a, c) {
      a = a.split(".");
      var b = k;
      a[0] in b ||
        "undefined" == typeof b.execScript ||
        b.execScript("var " + a[0]);
      for (var f; a.length && (f = a.shift()); )
        a.length || void 0 === c
          ? b[f] && b[f] !== Object.prototype[f]
            ? (b = b[f])
            : (b = b[f] = {})
          : (b[f] = c);
    }
    function m(a, c) {
      function b() {}
      b.prototype = c.prototype;
      a.ka = c.prototype;
      a.prototype = new b();
      a.prototype.constructor = a;
      a.ja = function (f, h, n) {
        for (
          var g = Array(arguments.length - 2), e = 2;
          e < arguments.length;
          e++
        )
          g[e - 2] = arguments[e];
        return c.prototype[h].apply(f, g);
      };
    }
    function p(a) {
      return a;
    }
    function q() {
      return "[msg_undefined]";
    }
    var r = {};
    (function () {
      if (
        void 0 == window.CLOSURE_DEFINES ||
        window.CLOSURE_DEFINES["te.msg.EMBED_MESSAGES"]
      ) {
        r = {
          Y: function () {
            return MSG_TRANSLATE;
          },
          m: function () {
            return MSG_CANCEL;
          },
          s: function () {
            return MSG_CLOSE;
          },
          K: function () {
            return MSGFUNC_PAGE_TRANSLATED_TO;
          },
          Z: function () {
            return MSGFUNC_TRANSLATED_TO;
          },
          B: function () {
            return MSG_GENERAL_ERROR;
          },
          D: function () {
            return MSG_LANGUAGE_UNSUPPORTED;
          },
          F: function () {
            return MSG_LEARN_MORE;
          },
          L: function () {
            return MSGFUNC_POWERED_BY;
          },
          ba: function () {
            return MSG_TRANSLATE_PRODUCT_NAME;
          },
          da: function () {
            return MSG_TRANSLATION_IN_PROGRESS;
          },
          aa: function () {
            return MSGFUNC_TRANSLATE_PAGE_TO;
          },
          ia: function () {
            return MSGFUNC_VIEW_PAGE_IN;
          },
          M: function () {
            return MSG_RESTORE;
          },
          U: function () {
            return MSG_SSL_INFO_LOCAL_FILE;
          },
          V: function () {
            return MSG_SSL_INFO_SECURE_PAGE;
          },
          T: function () {
            return MSG_SSL_INFO_INTRANET_PAGE;
          },
          N: function () {
            return MSG_SELECT_LANGUAGE;
          },
          fa: function () {
            return MSGFUNC_TURN_OFF_TRANSLATION;
          },
          ea: function () {
            return MSGFUNC_TURN_OFF_FOR;
          },
          l: function () {
            return MSG_ALWAYS_HIDE_AUTO_POPUP_BANNER;
          },
          I: function () {
            return MSG_ORIGINAL_TEXT;
          },
          J: function () {
            return MSG_ORIGINAL_TEXT_NO_COLON;
          },
          A: function () {
            return MSG_FILL_SUGGESTION;
          },
          W: function () {
            return MSG_SUBMIT_SUGGESTION;
          },
          S: function () {
            return MSG_SHOW_TRANSLATE_ALL;
          },
          R: function () {
            return MSG_SHOW_RESTORE_ALL;
          },
          O: function () {
            return MSG_SHOW_CANCEL_ALL;
          },
          ca: function () {
            return MSG_TRANSLATE_TO_MY_LANGUAGE;
          },
          $: function () {
            return MSGFUNC_TRANSLATE_EVERYTHING_TO;
          },
          P: function () {
            return MSG_SHOW_ORIGINAL_LANGUAGES;
          },
          H: function () {
            return MSG_OPTIONS;
          },
          ga: function () {
            return MSG_TURN_OFF_TRANSLATION_FOR_THIS_SITE;
          },
          G: function () {
            return MSG_MANAGE_TRANSLATION_FOR_THIS_SITE;
          },
          j: function () {
            return MSG_ALT_SUGGESTION;
          },
          h: function () {
            return MSG_ALT_ACTIVITY_HELPER_TEXT;
          },
          i: function () {
            return MSG_ALT_AND_CONTRIBUTE_ACTIVITY_HELPER_TEXT;
          },
          ha: function () {
            return MSG_USE_ALTERNATIVES;
          },
          v: function () {
            return MSG_DRAG_TIP;
          },
          o: function () {
            return MSG_CLICK_FOR_ALT;
          },
          u: function () {
            return MSG_DRAG_INSTUCTIONS;
          },
          X: function () {
            return MSG_SUGGESTION_SUBMITTED;
          },
          C: function () {
            return MSG_LANGUAGE_TRANSLATE_WIDGET;
          },
        };
        for (var a in r)
          if (r[a] !== Object.prototype[r[a]])
            try {
              r[a] = r[a].call(null);
            } catch (c) {
              r[a] = q;
            }
      } else
        (a = function (c) {
          return function () {
            return c;
          };
        }),
          (r = {
            Y: a(0),
            m: a(1),
            s: a(2),
            K: a(3),
            Z: a(4),
            B: a(5),
            D: a(45),
            F: a(6),
            L: a(7),
            ba: a(8),
            da: a(9),
            aa: a(10),
            ia: a(11),
            M: a(12),
            U: a(13),
            V: a(14),
            T: a(15),
            N: a(16),
            fa: a(17),
            ea: a(18),
            l: a(19),
            I: a(20),
            A: a(21),
            W: a(22),
            S: a(23),
            R: a(24),
            O: a(25),
            ca: a(26),
            $: a(27),
            P: a(28),
            H: a(29),
            ga: a(30),
            j: a(32),
            h: a(33),
            ha: a(34),
            v: a(35),
            o: a(36),
            u: a(37),
            X: a(38),
            G: a(39),
            i: a(40),
            J: a(41),
            C: a(46),
          });
    })();
    var t = {},
      MSG_TRANSLATE = d;
    t[0] = MSG_TRANSLATE;
    var MSG_CANCEL = "Cancel";
    t[1] = MSG_CANCEL;
    var MSG_CLOSE = "Close";
    t[2] = MSG_CLOSE;
    function MSGFUNC_PAGE_TRANSLATED_TO(a) {
      return "Google has automatically translated this page to: " + a;
    }
    t[3] = MSGFUNC_PAGE_TRANSLATED_TO;
    function MSGFUNC_TRANSLATED_TO(a) {
      return "Translated to: " + a;
    }
    t[4] = MSGFUNC_TRANSLATED_TO;
    var MSG_GENERAL_ERROR =
      "Error: The server could not complete your request. Try again later.";
    t[5] = MSG_GENERAL_ERROR;
    var MSG_LEARN_MORE = "Learn more";
    t[6] = MSG_LEARN_MORE;
    function MSGFUNC_POWERED_BY(a) {
      return "Powered by " + a;
    }
    t[7] = MSGFUNC_POWERED_BY;
    var MSG_TRANSLATE_PRODUCT_NAME = d;
    t[8] = MSG_TRANSLATE_PRODUCT_NAME;
    var MSG_TRANSLATION_IN_PROGRESS = "Translation in progress";
    t[9] = MSG_TRANSLATION_IN_PROGRESS;
    function MSGFUNC_TRANSLATE_PAGE_TO(a) {
      return "Translate this page to: " + (a + " using Google Translate?");
    }
    t[10] = MSGFUNC_TRANSLATE_PAGE_TO;
    function MSGFUNC_VIEW_PAGE_IN(a) {
      return "View this page in: " + a;
    }
    t[11] = MSGFUNC_VIEW_PAGE_IN;
    var MSG_RESTORE = "Show original";
    t[12] = MSG_RESTORE;
    var MSG_SSL_INFO_LOCAL_FILE =
      "The content of this local file will be sent to Google for translation using a secure connection.";
    t[13] = MSG_SSL_INFO_LOCAL_FILE;
    var MSG_SSL_INFO_SECURE_PAGE =
      "The content of this secure page will be sent to Google for translation using a secure connection.";
    t[14] = MSG_SSL_INFO_SECURE_PAGE;
    var MSG_SSL_INFO_INTRANET_PAGE =
      "The content of this intranet page will be sent to Google for translation using a secure connection.";
    t[15] = MSG_SSL_INFO_INTRANET_PAGE;
    var MSG_SELECT_LANGUAGE = "Select Language";
    t[16] = MSG_SELECT_LANGUAGE;
    function MSGFUNC_TURN_OFF_TRANSLATION(a) {
      return "Turn off " + (a + " translation");
    }
    t[17] = MSGFUNC_TURN_OFF_TRANSLATION;
    function MSGFUNC_TURN_OFF_FOR(a) {
      return "Turn off for: " + a;
    }
    t[18] = MSGFUNC_TURN_OFF_FOR;
    var MSG_ALWAYS_HIDE_AUTO_POPUP_BANNER = "Always hide";
    t[19] = MSG_ALWAYS_HIDE_AUTO_POPUP_BANNER;
    var MSG_ORIGINAL_TEXT = "Original text:";
    t[20] = MSG_ORIGINAL_TEXT;
    var MSG_FILL_SUGGESTION = "Contribute a better translation";
    t[21] = MSG_FILL_SUGGESTION;
    var MSG_SUBMIT_SUGGESTION = "Contribute";
    t[22] = MSG_SUBMIT_SUGGESTION;
    var MSG_SHOW_TRANSLATE_ALL = "Translate all";
    t[23] = MSG_SHOW_TRANSLATE_ALL;
    var MSG_SHOW_RESTORE_ALL = "Restore all";
    t[24] = MSG_SHOW_RESTORE_ALL;
    var MSG_SHOW_CANCEL_ALL = "Cancel all";
    t[25] = MSG_SHOW_CANCEL_ALL;
    var MSG_TRANSLATE_TO_MY_LANGUAGE = "Translate sections to my language";
    t[26] = MSG_TRANSLATE_TO_MY_LANGUAGE;
    function MSGFUNC_TRANSLATE_EVERYTHING_TO(a) {
      return "Translate everything to " + a;
    }
    t[27] = MSGFUNC_TRANSLATE_EVERYTHING_TO;
    var MSG_SHOW_ORIGINAL_LANGUAGES = "Show original languages";
    t[28] = MSG_SHOW_ORIGINAL_LANGUAGES;
    var MSG_OPTIONS = "Options";
    t[29] = MSG_OPTIONS;
    var MSG_TURN_OFF_TRANSLATION_FOR_THIS_SITE =
      "Turn off translation for this site";
    t[30] = MSG_TURN_OFF_TRANSLATION_FOR_THIS_SITE;
    t[31] = null;
    var MSG_ALT_SUGGESTION = "Show alternative translations";
    t[32] = MSG_ALT_SUGGESTION;
    var MSG_ALT_ACTIVITY_HELPER_TEXT =
      "Click on words above to get alternative translations";
    t[33] = MSG_ALT_ACTIVITY_HELPER_TEXT;
    var MSG_USE_ALTERNATIVES = "Use";
    t[34] = MSG_USE_ALTERNATIVES;
    var MSG_DRAG_TIP = "Drag with shift key to reorder";
    t[35] = MSG_DRAG_TIP;
    var MSG_CLICK_FOR_ALT = "Click for alternative translations";
    t[36] = MSG_CLICK_FOR_ALT;
    var MSG_DRAG_INSTUCTIONS =
      "Hold down the shift key, click, and drag the words above to reorder.";
    t[37] = MSG_DRAG_INSTUCTIONS;
    var MSG_SUGGESTION_SUBMITTED =
      "Thank you for contributing your translation suggestion to Google Translate.";
    t[38] = MSG_SUGGESTION_SUBMITTED;
    var MSG_MANAGE_TRANSLATION_FOR_THIS_SITE =
      "Manage translation for this site";
    t[39] = MSG_MANAGE_TRANSLATION_FOR_THIS_SITE;
    var MSG_ALT_AND_CONTRIBUTE_ACTIVITY_HELPER_TEXT =
      "Click a word for alternative translations, or double-click to edit directly";
    t[40] = MSG_ALT_AND_CONTRIBUTE_ACTIVITY_HELPER_TEXT;
    var MSG_ORIGINAL_TEXT_NO_COLON = "Original text";
    t[41] = MSG_ORIGINAL_TEXT_NO_COLON;
    t[42] = d;
    t[43] = d;
    t[44] = "Your correction has been submitted.";
    var MSG_LANGUAGE_UNSUPPORTED =
      "Error: The language of the webpage is not supported.";
    t[45] = MSG_LANGUAGE_UNSUPPORTED;
    var MSG_LANGUAGE_TRANSLATE_WIDGET = "Language Translate Widget";
    t[46] = MSG_LANGUAGE_TRANSLATE_WIDGET;
    function u(a) {
      if (Error.captureStackTrace) Error.captureStackTrace(this, u);
      else {
        var c = Error().stack;
        c && (this.stack = c);
      }
      a && (this.message = String(a));
    }
    m(u, Error);
    u.prototype.name = "CustomError";
    function v(a, c) {
      a = a.split("%s");
      for (var b = "", f = a.length - 1, h = 0; h < f; h++)
        b += a[h] + (h < c.length ? c[h] : "%s");
      u.call(this, b + a[f]);
    }
    m(v, u);
    v.prototype.name = "AssertionError";
    function w(a, c) {
      throw new v(
        "Failure" + (a ? ": " + a : ""),
        Array.prototype.slice.call(arguments, 1)
      );
    }
    var y;
    function z(a, c) {
      this.g = c === A ? a : "";
    }
    z.prototype.toString = function () {
      return this.g + "";
    };
    var A = {};
    var B = null,
      C = /^[\w+/_-]+[=]{0,2}$/;
    function D(a) {
      return a.querySelector
        ? (a = a.querySelector("script[nonce]")) &&
          (a = a.nonce || a.getAttribute("nonce")) &&
          C.test(a)
          ? a
          : ""
        : "";
    }
    function _exportMessages() {
      l("google.translate.m", t);
    }
    function E(a) {
      var c = document.getElementsByTagName("head")[0];
      c ||
        (c = document.body.parentNode.appendChild(
          document.createElement("head")
        ));
      c.appendChild(a);
    }
    function _loadJs(a) {
      var c = document;
      var b = "SCRIPT";
      "application/xhtml+xml" === c.contentType && (b = b.toLowerCase());
      b = c.createElement(b);
      b.type = "text/javascript";
      b.charset = "UTF-8";
      if (void 0 === y) {
        c = null;
        var f = k.trustedTypes;
        if (f && f.createPolicy) {
          try {
            c = f.createPolicy("goog#html", {
              createHTML: p,
              createScript: p,
              createScriptURL: p,
            });
          } catch (x) {
            k.console && k.console.error(x.message);
          }
          y = c;
        } else y = c;
      }
      a = (c = y) ? c.createScriptURL(a) : a;
      a = new z(a, A);
      a: {
        try {
          var h = b && b.ownerDocument,
            n = h && (h.defaultView || h.parentWindow);
          n = n || k;
          if (n.Element && n.Location) {
            var g = n;
            break a;
          }
        } catch (x) {}
        g = null;
      }
      if (
        g &&
        "undefined" != typeof g.HTMLScriptElement &&
        (!b ||
          (!(b instanceof g.HTMLScriptElement) &&
            (b instanceof g.Location || b instanceof g.Element)))
      ) {
        g = typeof b;
        if (("object" == g && null != b) || "function" == g)
          try {
            var e =
              b.constructor.displayName ||
              b.constructor.name ||
              Object.prototype.toString.call(b);
          } catch (x) {
            e = "<object could not be stringified>";
          }
        else e = void 0 === b ? "undefined" : null === b ? "null" : typeof b;
        w(
          "Argument is not a %s (or a non-Element, non-Location mock); got: %s",
          "HTMLScriptElement",
          e
        );
      }
      a instanceof z && a.constructor === z
        ? (e = a.g)
        : ((e = typeof a),
          w(
            "expected object of type TrustedResourceUrl, got '" +
              a +
              "' of type " +
              ("object" != e
                ? e
                : a
                ? Array.isArray(a)
                  ? "array"
                  : e
                : "null")
          ),
          (e = "type_error:TrustedResourceUrl"));
      b.src = e;
      (e = b.ownerDocument && b.ownerDocument.defaultView) && e != k
        ? (e = D(e.document))
        : (null === B && (B = D(k.document)), (e = B));
      e && b.setAttribute("nonce", e);
      E(b);
    }
    function _loadCss(a) {
      var c = document.createElement("link");
      c.type = "text/css";
      c.rel = "stylesheet";
      c.charset = "UTF-8";
      c.href = a;
      E(c);
    }
    function _isNS(a) {
      a = a.split(".");
      for (var c = window, b = 0; b < a.length; ++b)
        if (!(c = c[a[b]])) return !1;
      return !0;
    }
    function _setupNS(a) {
      a = a.split(".");
      for (var c = window, b = 0; b < a.length; ++b)
        c.hasOwnProperty
          ? c.hasOwnProperty(a[b])
            ? (c = c[a[b]])
            : (c = c[a[b]] = {})
          : (c = c[a[b]] || (c[a[b]] = {}));
      return c;
    }
    l("_exportMessages", _exportMessages);
    l("_loadJs", _loadJs);
    l("_loadCss", _loadCss);
    l("_isNS", _isNS);
    l("_setupNS", _setupNS);
    window.addEventListener &&
      "undefined" == typeof document.readyState &&
      window.addEventListener(
        "DOMContentLoaded",
        function () {
          document.readyState = "complete";
        },
        !1
      );
    if (_isNS("google.translate.Element")) {
      return;
    }
    (function () {
      var c = _setupNS("google.translate._const");
      c._cest = gtConstEvalStartTime;
      gtConstEvalStartTime = undefined;
      c._cl = "ko";
      c._cuc = "cr.googleTranslate.onTranslateElementLoad";
      c._cac = "";
      c._cam = "lib";
      c._cjlc = cr.googleTranslate.onLoadJavascript;
      c._ctkk = "450326.1007626474";
      var h = "translate.googleapis.com";
      var s =
        (true
          ? "https"
          : window.location.protocol == "https:"
          ? "https"
          : "http") + "://";
      var b = s + h;
      c._pah = h;
      c._pas = s;
      c._pbi = b + "/translate_static/img/te_bk.gif";
      c._pci = b + "/translate_static/img/te_ctrl3.gif";
      c._pli = b + "/translate_static/img/loading.gif";
      c._plla = h + "/translate_a/l";
      c._pmi = b + "/translate_static/img/mini_google.png";
      c._ps = b + "/translate_static/css/translateelement.css";
      c._puh = "translate.google.com";
      cr.googleTranslate.onLoadCSS(c._ps);
      c._cjlc(b + "/translate_static/js/element/main_ko.js");
    })();
  })();
} catch (error) {
  cr.googleTranslate.onTranslateElementError(error);
}