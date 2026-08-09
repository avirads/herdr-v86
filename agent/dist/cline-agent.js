var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn2, res) => function __init() {
  return fn2 && (res = (0, fn2[__getOwnPropNames(fn2)[0]])(fn2 = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to2, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to2, key) && key !== except)
        __defProp(to2, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to2;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/process/browser.js
var require_browser = __commonJS({
  "node_modules/process/browser.js"(exports, module) {
    init_process_shim();
    var process2 = module.exports = {};
    var cachedSetTimeout;
    var cachedClearTimeout;
    function defaultSetTimout() {
      throw new Error("setTimeout has not been defined");
    }
    function defaultClearTimeout() {
      throw new Error("clearTimeout has not been defined");
    }
    (function() {
      try {
        if (typeof setTimeout === "function") {
          cachedSetTimeout = setTimeout;
        } else {
          cachedSetTimeout = defaultSetTimout;
        }
      } catch (e) {
        cachedSetTimeout = defaultSetTimout;
      }
      try {
        if (typeof clearTimeout === "function") {
          cachedClearTimeout = clearTimeout;
        } else {
          cachedClearTimeout = defaultClearTimeout;
        }
      } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
      }
    })();
    function runTimeout(fun) {
      if (cachedSetTimeout === setTimeout) {
        return setTimeout(fun, 0);
      }
      if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
      }
      try {
        return cachedSetTimeout(fun, 0);
      } catch (e) {
        try {
          return cachedSetTimeout.call(null, fun, 0);
        } catch (e2) {
          return cachedSetTimeout.call(this, fun, 0);
        }
      }
    }
    function runClearTimeout(marker) {
      if (cachedClearTimeout === clearTimeout) {
        return clearTimeout(marker);
      }
      if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
      }
      try {
        return cachedClearTimeout(marker);
      } catch (e) {
        try {
          return cachedClearTimeout.call(null, marker);
        } catch (e2) {
          return cachedClearTimeout.call(this, marker);
        }
      }
    }
    var queue = [];
    var draining = false;
    var currentQueue;
    var queueIndex = -1;
    function cleanUpNextTick() {
      if (!draining || !currentQueue) {
        return;
      }
      draining = false;
      if (currentQueue.length) {
        queue = currentQueue.concat(queue);
      } else {
        queueIndex = -1;
      }
      if (queue.length) {
        drainQueue();
      }
    }
    function drainQueue() {
      if (draining) {
        return;
      }
      var timeout = runTimeout(cleanUpNextTick);
      draining = true;
      var len = queue.length;
      while (len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
          if (currentQueue) {
            currentQueue[queueIndex].run();
          }
        }
        queueIndex = -1;
        len = queue.length;
      }
      currentQueue = null;
      draining = false;
      runClearTimeout(timeout);
    }
    process2.nextTick = function(fun) {
      var args = new Array(arguments.length - 1);
      if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
          args[i - 1] = arguments[i];
        }
      }
      queue.push(new Item(fun, args));
      if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
      }
    };
    function Item(fun, array) {
      this.fun = fun;
      this.array = array;
    }
    Item.prototype.run = function() {
      this.fun.apply(null, this.array);
    };
    process2.title = "browser";
    process2.browser = true;
    process2.env = {};
    process2.argv = [];
    process2.version = "";
    process2.versions = {};
    function noop() {
    }
    process2.on = noop;
    process2.addListener = noop;
    process2.once = noop;
    process2.off = noop;
    process2.removeListener = noop;
    process2.removeAllListeners = noop;
    process2.emit = noop;
    process2.prependListener = noop;
    process2.prependOnceListener = noop;
    process2.listeners = function(name) {
      return [];
    };
    process2.binding = function(name) {
      throw new Error("process.binding is not supported");
    };
    process2.cwd = function() {
      return "/";
    };
    process2.chdir = function(dir) {
      throw new Error("process.chdir is not supported");
    };
    process2.umask = function() {
      return 0;
    };
  }
});

// src/process-shim.js
var import_browser;
var init_process_shim = __esm({
  "src/process-shim.js"() {
    import_browser = __toESM(require_browser(), 1);
  }
});

// src/cline-browser.js
init_process_shim();

// node_modules/@cline/agents/dist/index.js
init_process_shim();

// src/cline-llms-shim.js
init_process_shim();
function createGateway() {
  throw new Error("VMVM supplies Cline with its browser model; provider factory is unavailable");
}
function classifyProviderError() {
  return "unknown";
}

// node_modules/@cline/agents/node_modules/nanoid/index.browser.js
init_process_shim();

// node_modules/@cline/agents/node_modules/nanoid/url-alphabet/index.js
init_process_shim();
var urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

// node_modules/@cline/agents/node_modules/nanoid/index.browser.js
var nanoid = (size = 21) => {
  let id2 = "";
  let bytes = crypto.getRandomValues(new Uint8Array(size |= 0));
  while (size--) {
    id2 += urlAlphabet[bytes[size] & 63];
  }
  return id2;
};

// node_modules/@cline/agents/dist/index.js
var hc = Object.defineProperty;
var $c = (e) => e;
function yc(e, n) {
  this[e] = $c.bind(null, n);
}
var Q = (e, n) => {
  for (var r in n) hc(e, r, { get: n[r], enumerable: true, configurable: true, set: yc.bind(n, r) });
};
var s = {};
Q(s, { xor: () => Sd, xid: () => Kl, void: () => yd, uuidv7: () => Ll, uuidv6: () => Zl, uuidv4: () => Rl, uuid: () => Cl, util: () => E, url: () => Ml, uppercase: () => Pt, unknown: () => me, union: () => mn, undefined: () => hd, ulid: () => Vl, uint64: () => gd, uint32: () => md, tuple: () => Yi, trim: () => Mt, treeifyError: () => ka, transform: () => pn, toUpperCase: () => Ft, toLowerCase: () => Bt, toJSONSchema: () => pl, templateLiteral: () => Zd, symbol: () => vd, superRefine: () => xr, success: () => Pd, stringbool: () => Wd, stringFormat: () => ad, string: () => je, strictObject: () => Id, startsWith: () => Ct, slugify: () => Jt, size: () => He, setErrorMap: () => Gp, set: () => Nd, safeParseAsync: () => xl, safeParse: () => Sl, safeEncodeAsync: () => Al, safeEncode: () => zl, safeDecodeAsync: () => Dl, safeDecode: () => Ul, registry: () => ni, regexes: () => ie, regex: () => At, refine: () => Sr, record: () => Qi, readonly: () => yr, property: () => Ei, promise: () => Ld, prettifyError: () => wa, preprocess: () => Kd, prefault: () => cr, positive: () => Ii, pipe: () => St, partialRecord: () => Ed, parseAsync: () => wl, parse: () => Il, overwrite: () => te, optional: () => Re, object: () => kd, number: () => ji, nullish: () => Dd, nullable: () => Ze, null: () => Mi, normalize: () => Lt, nonpositive: () => Si, nonoptional: () => mr, nonnegative: () => xi, never: () => dn, negative: () => wi, nativeEnum: () => zd, nanoid: () => Jl, nan: () => jd, multipleOf: () => Ie, minSize: () => oe, minLength: () => ce, mime: () => Zt, meta: () => Jd, maxSize: () => Te, maxLength: () => Xe, map: () => Td, mac: () => Xl, lte: () => W, lt: () => re, lowercase: () => Dt, looseRecord: () => Od, looseObject: () => wd, locales: () => ei, literal: () => Ud, length: () => Ye, lazy: () => kr, ksuid: () => ql, keyof: () => _d, jwt: () => rd, json: () => Vd, iso: () => Ni, ipv6: () => Yl, ipv4: () => Hl, invertCodec: () => Rd, intersection: () => Hi, int64: () => pd, int32: () => cd, int: () => wt, instanceof: () => Gd, includes: () => jt, httpUrl: () => Bl, hostname: () => od, hex: () => sd, hash: () => ud, guid: () => jl, gte: () => Z, gt: () => ae, globalRegistry: () => G, getErrorMap: () => Wp, function: () => xt, fromJSONSchema: () => Hp, formatError: () => Un, float64: () => dd, float32: () => ld, flattenError: () => zn, file: () => Ad, exactOptional: () => or, enum: () => fn, endsWith: () => Rt, encodeAsync: () => Tl, encode: () => El, emoji: () => Fl, email: () => Pl, e164: () => id, discriminatedUnion: () => xd, describe: () => Fd, decodeAsync: () => Nl, decode: () => Ol, date: () => bd, custom: () => Bd, cuid2: () => Wl, cuid: () => Gl, core: () => oa, config: () => j, coerce: () => Hd, codec: () => Cd, clone: () => V, cidrv6: () => ed, cidrv4: () => Ql, check: () => Md, catch: () => gr, boolean: () => Ci, bigint: () => fd, base64url: () => nd, base64: () => td, array: () => ot, any: () => $d, _function: () => xt, _default: () => lr, _ZodString: () => Gt, ZodXor: () => Vi, ZodXID: () => Yt, ZodVoid: () => Gi, ZodUnknown: () => Fi, ZodUnion: () => ut, ZodUndefined: () => Zi, ZodUUID: () => H, ZodURL: () => nt, ZodULID: () => Xt, ZodType: () => w, ZodTuple: () => Xi, ZodTransform: () => rr, ZodTemplateLiteral: () => br, ZodSymbol: () => Ri, ZodSuccess: () => fr, ZodStringFormat: () => U, ZodString: () => tt, ZodSet: () => tr, ZodRecord: () => Ee, ZodRealError: () => B, ZodReadonly: () => $r, ZodPromise: () => Ir, ZodPreprocess: () => hr, ZodPrefault: () => dr, ZodPipe: () => lt, ZodOptional: () => gn, ZodObject: () => st, ZodNumberFormat: () => ge, ZodNumber: () => it, ZodNullable: () => sr, ZodNull: () => Li, ZodNonOptional: () => vn, ZodNever: () => Ji, ZodNanoID: () => Kt, ZodNaN: () => vr, ZodMap: () => er, ZodMAC: () => Pi, ZodLiteral: () => nr, ZodLazy: () => _r, ZodKSUID: () => Qt, ZodJWT: () => un, ZodIssueCode: () => Jp, ZodIntersection: () => qi, ZodISOTime: () => Ai, ZodISODuration: () => Di, ZodISODateTime: () => zi, ZodISODate: () => Ui, ZodIPv6: () => tn, ZodIPv4: () => en, ZodGUID: () => Ce, ZodFunction: () => wr, ZodFirstPartyTypeKind: () => xn, ZodFile: () => ir, ZodExactOptional: () => ar, ZodError: () => Fp, ZodEnum: () => Oe, ZodEmoji: () => Vt, ZodEmail: () => Wt, ZodE164: () => sn, ZodDiscriminatedUnion: () => Ki, ZodDefault: () => ur, ZodDate: () => cn, ZodCustomStringFormat: () => Ne, ZodCustom: () => ct, ZodCodec: () => dt, ZodCatch: () => pr, ZodCUID2: () => Ht, ZodCUID: () => qt, ZodCIDRv6: () => rn, ZodCIDRv4: () => nn, ZodBoolean: () => rt, ZodBigIntFormat: () => ln, ZodBigInt: () => at, ZodBase64URL: () => on, ZodBase64: () => an, ZodArray: () => Wi, ZodAny: () => Bi, TimePrecision: () => Vs, NEVER: () => sa, $output: () => Bs, $input: () => Fs, $brand: () => ua });
var oa = {};
Q(oa, { version: () => So, util: () => E, treeifyError: () => ka, toJSONSchema: () => pl, toDotPath: () => Ia, safeParseAsync: () => xa, safeParse: () => Sa, safeEncodeAsync: () => Xc, safeEncode: () => qc, safeDecodeAsync: () => Yc, safeDecode: () => Hc, registry: () => ni, regexes: () => ie, process: () => T, prettifyError: () => wa, parseAsync: () => In, parse: () => kn, meta: () => Ou, locales: () => ei, isValidJWT: () => Ho, isValidBase64URL: () => Vo, isValidBase64: () => Wn, initializeContext: () => we, globalRegistry: () => G, globalConfig: () => De, formatError: () => Un, flattenError: () => zn, finalize: () => xe, extractDefs: () => Se, encodeAsync: () => Vc, encode: () => Gc, describe: () => Eu, decodeAsync: () => Kc, decode: () => Wc, createToJSONSchemaMethod: () => Nu, createStandardJSONSchemaMethod: () => Pe, config: () => j, clone: () => V, _xor: () => yp, _xid: () => fi, _void: () => hu, _uuidv7: () => si, _uuidv6: () => oi, _uuidv4: () => ai, _uuid: () => ri, _url: () => Ut, _uppercase: () => Pt, _unknown: () => gu, _union: () => $p, _undefined: () => mu, _ulid: () => mi, _uint64: () => du, _uint32: () => ru, _tuple: () => kp, _trim: () => Mt, _transform: () => Tp, _toUpperCase: () => Ft, _toLowerCase: () => Bt, _templateLiteral: () => Rp, _symbol: () => cu, _superRefine: () => Su, _success: () => Dp, _stringbool: () => Tu, _stringFormat: () => Qe, _string: () => Js, _startsWith: () => Ct, _slugify: () => Jt, _size: () => He, _set: () => Sp, _safeParseAsync: () => Ge, _safeParse: () => Je, _safeEncodeAsync: () => Zn, _safeEncode: () => Cn, _safeDecodeAsync: () => Ln, _safeDecode: () => Rn, _regex: () => At, _refine: () => wu, _record: () => Ip, _readonly: () => Cp, _property: () => Ei, _promise: () => Lp, _positive: () => Ii, _pipe: () => jp, _parseAsync: () => Fe, _parse: () => Be, _overwrite: () => te, _optional: () => Np, _number: () => Ys, _nullable: () => zp, _null: () => fu, _normalize: () => Lt, _nonpositive: () => Si, _nonoptional: () => Ap, _nonnegative: () => xi, _never: () => vu, _negative: () => wi, _nativeEnum: () => Ep, _nanoid: () => li, _nan: () => bu, _multipleOf: () => Ie, _minSize: () => oe, _minLength: () => ce, _min: () => Z, _mime: () => Zt, _maxSize: () => Te, _maxLength: () => Xe, _max: () => W, _map: () => wp, _mac: () => Ws, _lte: () => W, _lt: () => re, _lowercase: () => Dt, _literal: () => Op, _length: () => Ye, _lazy: () => Zp, _ksuid: () => pi, _jwt: () => ki, _isoTime: () => Hs, _isoDuration: () => Xs, _isoDateTime: () => Ks, _isoDate: () => qs, _ipv6: () => vi, _ipv4: () => gi, _intersection: () => _p, _int64: () => lu, _int32: () => iu, _int: () => eu, _includes: () => jt, _guid: () => It, _gte: () => Z, _gt: () => ae, _float64: () => nu, _float32: () => tu, _file: () => ku, _enum: () => xp, _endsWith: () => Rt, _encodeAsync: () => Pn, _encode: () => An, _emoji: () => ui, _email: () => ii, _e164: () => _i, _discriminatedUnion: () => bp, _default: () => Up, _decodeAsync: () => jn, _decode: () => Dn, _date: () => $u, _custom: () => Iu, _cuid2: () => ci, _cuid: () => di, _coercedString: () => Gs, _coercedNumber: () => Qs, _coercedDate: () => yu, _coercedBoolean: () => ou, _coercedBigint: () => uu, _cidrv6: () => $i, _cidrv4: () => hi, _check: () => xu, _catch: () => Pp, _boolean: () => au, _bigint: () => su, _base64url: () => bi, _base64: () => yi, _array: () => _u, _any: () => pu, TimePrecision: () => Vs, NEVER: () => sa, JSONSchemaGenerator: () => gl, JSONSchema: () => Bp, Doc: () => Gn, $output: () => Bs, $input: () => Fs, $constructor: () => m, $brand: () => ua, $ZodXor: () => ps, $ZodXID: () => Po, $ZodVoid: () => ss, $ZodUnknown: () => as, $ZodUnion: () => zt, $ZodUndefined: () => ns, $ZodUUID: () => Eo, $ZodURL: () => To, $ZodULID: () => Do, $ZodType: () => I, $ZodTuple: () => Hn, $ZodTransform: () => Is, $ZodTemplateLiteral: () => Ds, $ZodSymbol: () => ts, $ZodSuccess: () => Ts, $ZodStringFormat: () => z, $ZodString: () => qe, $ZodSet: () => ys, $ZodRegistry: () => ti, $ZodRecord: () => hs, $ZodRealError: () => M, $ZodReadonly: () => As, $ZodPromise: () => js, $ZodPreprocess: () => Us, $ZodPrefault: () => Es, $ZodPipe: () => Yn, $ZodOptional: () => Xn, $ZodObjectJIT: () => fs, $ZodObject: () => ms, $ZodNumberFormat: () => Qo, $ZodNumber: () => Vn, $ZodNullable: () => Ss, $ZodNull: () => is, $ZodNonOptional: () => Os, $ZodNever: () => os, $ZodNanoID: () => zo, $ZodNaN: () => zs, $ZodMap: () => $s, $ZodMAC: () => Fo, $ZodLiteral: () => _s, $ZodLazy: () => Cs, $ZodKSUID: () => jo, $ZodJWT: () => Xo, $ZodIntersection: () => vs, $ZodISOTime: () => Zo, $ZodISODuration: () => Lo, $ZodISODateTime: () => Co, $ZodISODate: () => Ro, $ZodIPv6: () => Bo, $ZodIPv4: () => Mo, $ZodGUID: () => xo, $ZodFunction: () => Ps, $ZodFile: () => ks, $ZodExactOptional: () => ws, $ZodError: () => Nn, $ZodEnum: () => bs, $ZodEncodeError: () => Le, $ZodEmoji: () => No, $ZodEmail: () => Oo, $ZodE164: () => qo, $ZodDiscriminatedUnion: () => gs, $ZodDefault: () => xs, $ZodDate: () => us, $ZodCustomStringFormat: () => Yo, $ZodCustom: () => Rs, $ZodCodec: () => Qn, $ZodCheckUpperCase: () => $o, $ZodCheckStringFormat: () => Ke, $ZodCheckStartsWith: () => bo, $ZodCheckSizeEquals: () => mo, $ZodCheckRegex: () => vo, $ZodCheckProperty: () => ko, $ZodCheckOverwrite: () => wo, $ZodCheckNumberFormat: () => so, $ZodCheckMultipleOf: () => oo, $ZodCheckMinSize: () => co, $ZodCheckMinLength: () => po, $ZodCheckMimeType: () => Io, $ZodCheckMaxSize: () => lo, $ZodCheckMaxLength: () => fo, $ZodCheckLowerCase: () => ho, $ZodCheckLessThan: () => Fn, $ZodCheckLengthEquals: () => go, $ZodCheckIncludes: () => yo, $ZodCheckGreaterThan: () => Jn, $ZodCheckEndsWith: () => _o, $ZodCheckBigIntFormat: () => uo, $ZodCheck: () => D, $ZodCatch: () => Ns, $ZodCUID2: () => Ao, $ZodCUID: () => Uo, $ZodCIDRv6: () => Go, $ZodCIDRv4: () => Jo, $ZodBoolean: () => Kn, $ZodBigIntFormat: () => es, $ZodBigInt: () => qn, $ZodBase64URL: () => Ko, $ZodBase64: () => Wo, $ZodAsyncError: () => ne, $ZodArray: () => ls, $ZodAny: () => rs });
var Pr;
var sa = Object.freeze({ status: "aborted" });
function m(e, n, r) {
  function a(u, l) {
    if (!u._zod) Object.defineProperty(u, "_zod", { value: { def: l, constr: o, traits: /* @__PURE__ */ new Set() }, enumerable: false });
    if (u._zod.traits.has(e)) return;
    u._zod.traits.add(e), n(u, l);
    let d = o.prototype, c = Object.keys(d);
    for (let p = 0; p < c.length; p++) {
      let f = c[p];
      if (!(f in u)) u[f] = d[f].bind(u);
    }
  }
  let t = r?.Parent ?? Object;
  class i extends t {
  }
  Object.defineProperty(i, "name", { value: e });
  function o(u) {
    var l;
    let d = r?.Parent ? new i() : this;
    a(d, u), (l = d._zod).deferred ?? (l.deferred = []);
    for (let c of d._zod.deferred) c();
    return d;
  }
  return Object.defineProperty(o, "init", { value: a }), Object.defineProperty(o, Symbol.hasInstance, { value: (u) => {
    if (r?.Parent && u instanceof r.Parent) return true;
    return u?._zod?.traits?.has(e);
  } }), Object.defineProperty(o, "name", { value: e }), o;
}
var ua = Symbol("zod_brand");
var ne = class extends Error {
  constructor() {
    super("Encountered Promise during synchronous parse. Use .parseAsync() instead.");
  }
};
var Le = class extends Error {
  constructor(e) {
    super(`Encountered unidirectional transform during encode: ${e}`);
    this.name = "ZodEncodeError";
  }
};
(Pr = globalThis).__zod_globalConfig ?? (Pr.__zod_globalConfig = {});
var De = globalThis.__zod_globalConfig;
function j(e) {
  if (e) Object.assign(De, e);
  return De;
}
var E = {};
Q(E, { unwrapMessage: () => Ue, uint8ArrayToHex: () => Jc, uint8ArrayToBase64url: () => Bc, uint8ArrayToBase64: () => ya, stringifyPrimitive: () => b, slugify: () => da, shallowClone: () => ma, safeExtend: () => jc, required: () => Zc, randomString: () => Tc, propertyKeyTypes: () => bt, promiseAllObject: () => Oc, primitiveTypes: () => fa, prefixIssues: () => J, pick: () => Ac, partial: () => Rc, parsedType: () => _, optionalKeys: () => pa, omit: () => Dc, objectClone: () => Sc, numKeys: () => Nc, nullish: () => pe, normalizeParams: () => v, mergeDefs: () => ee, merge: () => Cc, jsonStringifyReplacer: () => yt, joinValues: () => g, issue: () => _t, isPlainObject: () => de, isObject: () => _e, hexToUint8Array: () => Fc, getSizableOrigin: () => Tt, getParsedType: () => zc, getLengthableOrigin: () => Nt, getEnumValues: () => On, getElementAtPath: () => Ec, floatSafeRemainder: () => la, finalizeIssue: () => L, extend: () => Pc, explicitlyAborted: () => ha, escapeRegex: () => Y, esc: () => _n, defineLazy: () => O, createTransparentProxy: () => Uc, cloneDef: () => xc, clone: () => V, cleanRegex: () => Ot, cleanEnum: () => Lc, captureStackTrace: () => Tn, cached: () => Me, base64urlToUint8Array: () => Mc, base64ToUint8Array: () => $a, assignProp: () => se, assertNotEqual: () => _c, assertNever: () => Ic, assertIs: () => kc, assertEqual: () => bc, assert: () => wc, allowsEval: () => ca, aborted: () => le, NUMBER_FORMAT_RANGES: () => ga, Class: () => ba, BIGINT_FORMAT_RANGES: () => va });
function bc(e) {
  return e;
}
function _c(e) {
  return e;
}
function kc(e) {
}
function Ic(e) {
  throw Error("Unexpected value in exhaustive check");
}
function wc(e) {
}
function On(e) {
  let n = Object.values(e).filter((r) => typeof r === "number");
  return Object.entries(e).filter(([r, a]) => n.indexOf(+r) === -1).map(([r, a]) => a);
}
function g(e, n = "|") {
  return e.map((r) => b(r)).join(n);
}
function yt(e, n) {
  if (typeof n === "bigint") return n.toString();
  return n;
}
function Me(e) {
  return { get value() {
    {
      let n = e();
      return Object.defineProperty(this, "value", { value: n }), n;
    }
    throw Error("cached value already set");
  } };
}
function pe(e) {
  return e === null || e === void 0;
}
function Ot(e) {
  let n = e.startsWith("^") ? 1 : 0, r = e.endsWith("$") ? e.length - 1 : e.length;
  return e.slice(n, r);
}
function la(e, n) {
  let r = e / n, a = Math.round(r), t = Number.EPSILON * Math.max(Math.abs(r), 1);
  if (Math.abs(r - a) < t) return 0;
  return r - a;
}
var jr = Symbol("evaluating");
function O(e, n, r) {
  let a = void 0;
  Object.defineProperty(e, n, { get() {
    if (a === jr) return;
    if (a === void 0) a = jr, a = r();
    return a;
  }, set(t) {
    Object.defineProperty(e, n, { value: t });
  }, configurable: true });
}
function Sc(e) {
  return Object.create(Object.getPrototypeOf(e), Object.getOwnPropertyDescriptors(e));
}
function se(e, n, r) {
  Object.defineProperty(e, n, { value: r, writable: true, enumerable: true, configurable: true });
}
function ee(...e) {
  let n = {};
  for (let r of e) {
    let a = Object.getOwnPropertyDescriptors(r);
    Object.assign(n, a);
  }
  return Object.defineProperties({}, n);
}
function xc(e) {
  return ee(e._zod.def);
}
function Ec(e, n) {
  if (!n) return e;
  return n.reduce((r, a) => r?.[a], e);
}
function Oc(e) {
  let n = Object.keys(e), r = n.map((a) => e[a]);
  return Promise.all(r).then((a) => {
    let t = {};
    for (let i = 0; i < n.length; i++) t[n[i]] = a[i];
    return t;
  });
}
function Tc(e = 10) {
  let n = "";
  for (let r = 0; r < e; r++) n += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];
  return n;
}
function _n(e) {
  return JSON.stringify(e);
}
function da(e) {
  return e.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
var Tn = "captureStackTrace" in Error ? Error.captureStackTrace : (...e) => {
};
function _e(e) {
  return typeof e === "object" && e !== null && !Array.isArray(e);
}
var ca = Me(() => {
  if (De.jitless) return false;
  if (typeof navigator < "u" && navigator?.userAgent?.includes("Cloudflare")) return false;
  try {
    return Function(""), true;
  } catch (e) {
    return false;
  }
});
function de(e) {
  if (_e(e) === false) return false;
  let n = e.constructor;
  if (n === void 0) return true;
  if (typeof n !== "function") return true;
  let r = n.prototype;
  if (_e(r) === false) return false;
  if (Object.prototype.hasOwnProperty.call(r, "isPrototypeOf") === false) return false;
  return true;
}
function ma(e) {
  if (de(e)) return { ...e };
  if (Array.isArray(e)) return [...e];
  if (e instanceof Map) return new Map(e);
  if (e instanceof Set) return new Set(e);
  return e;
}
function Nc(e) {
  let n = 0;
  for (let r in e) if (Object.prototype.hasOwnProperty.call(e, r)) n++;
  return n;
}
var zc = (e) => {
  let n = typeof e;
  switch (n) {
    case "undefined":
      return "undefined";
    case "string":
      return "string";
    case "number":
      return Number.isNaN(e) ? "nan" : "number";
    case "boolean":
      return "boolean";
    case "function":
      return "function";
    case "bigint":
      return "bigint";
    case "symbol":
      return "symbol";
    case "object":
      if (Array.isArray(e)) return "array";
      if (e === null) return "null";
      if (e.then && typeof e.then === "function" && e.catch && typeof e.catch === "function") return "promise";
      if (typeof Map < "u" && e instanceof Map) return "map";
      if (typeof Set < "u" && e instanceof Set) return "set";
      if (typeof Date < "u" && e instanceof Date) return "date";
      if (typeof File < "u" && e instanceof File) return "file";
      return "object";
    default:
      throw Error(`Unknown data type: ${n}`);
  }
};
var bt = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
var fa = /* @__PURE__ */ new Set(["string", "number", "bigint", "boolean", "symbol", "undefined"]);
function Y(e) {
  return e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function V(e, n, r) {
  let a = new e._zod.constr(n ?? e._zod.def);
  if (!n || r?.parent) a._zod.parent = e;
  return a;
}
function v(e) {
  let n = e;
  if (!n) return {};
  if (typeof n === "string") return { error: () => n };
  if (n?.message !== void 0) {
    if (n?.error !== void 0) throw Error("Cannot specify both `message` and `error` params");
    n.error = n.message;
  }
  if (delete n.message, typeof n.error === "string") return { ...n, error: () => n.error };
  return n;
}
function Uc(e) {
  let n;
  return new Proxy({}, { get(r, a, t) {
    return n ?? (n = e()), Reflect.get(n, a, t);
  }, set(r, a, t, i) {
    return n ?? (n = e()), Reflect.set(n, a, t, i);
  }, has(r, a) {
    return n ?? (n = e()), Reflect.has(n, a);
  }, deleteProperty(r, a) {
    return n ?? (n = e()), Reflect.deleteProperty(n, a);
  }, ownKeys(r) {
    return n ?? (n = e()), Reflect.ownKeys(n);
  }, getOwnPropertyDescriptor(r, a) {
    return n ?? (n = e()), Reflect.getOwnPropertyDescriptor(n, a);
  }, defineProperty(r, a, t) {
    return n ?? (n = e()), Reflect.defineProperty(n, a, t);
  } });
}
function b(e) {
  if (typeof e === "bigint") return e.toString() + "n";
  if (typeof e === "string") return `"${e}"`;
  return `${e}`;
}
function pa(e) {
  return Object.keys(e).filter((n) => {
    return e[n]._zod.optin === "optional" && e[n]._zod.optout === "optional";
  });
}
var ga = { safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER], int32: [-2147483648, 2147483647], uint32: [0, 4294967295], float32: [-34028234663852886e22, 34028234663852886e22], float64: [-Number.MAX_VALUE, Number.MAX_VALUE] };
var va = { int64: [BigInt("-9223372036854775808"), BigInt("9223372036854775807")], uint64: [BigInt(0), BigInt("18446744073709551615")] };
function Ac(e, n) {
  let r = e._zod.def, a = r.checks;
  if (a && a.length > 0) throw Error(".pick() cannot be used on object schemas containing refinements");
  let t = ee(e._zod.def, { get shape() {
    let i = {};
    for (let o in n) {
      if (!(o in r.shape)) throw Error(`Unrecognized key: "${o}"`);
      if (!n[o]) continue;
      i[o] = r.shape[o];
    }
    return se(this, "shape", i), i;
  }, checks: [] });
  return V(e, t);
}
function Dc(e, n) {
  let r = e._zod.def, a = r.checks;
  if (a && a.length > 0) throw Error(".omit() cannot be used on object schemas containing refinements");
  let t = ee(e._zod.def, { get shape() {
    let i = { ...e._zod.def.shape };
    for (let o in n) {
      if (!(o in r.shape)) throw Error(`Unrecognized key: "${o}"`);
      if (!n[o]) continue;
      delete i[o];
    }
    return se(this, "shape", i), i;
  }, checks: [] });
  return V(e, t);
}
function Pc(e, n) {
  if (!de(n)) throw Error("Invalid input to extend: expected a plain object");
  let r = e._zod.def.checks;
  if (r && r.length > 0) {
    let t = e._zod.def.shape;
    for (let i in n) if (Object.getOwnPropertyDescriptor(t, i) !== void 0) throw Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
  }
  let a = ee(e._zod.def, { get shape() {
    let t = { ...e._zod.def.shape, ...n };
    return se(this, "shape", t), t;
  } });
  return V(e, a);
}
function jc(e, n) {
  if (!de(n)) throw Error("Invalid input to safeExtend: expected a plain object");
  let r = ee(e._zod.def, { get shape() {
    let a = { ...e._zod.def.shape, ...n };
    return se(this, "shape", a), a;
  } });
  return V(e, r);
}
function Cc(e, n) {
  if (e._zod.def.checks?.length) throw Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
  let r = ee(e._zod.def, { get shape() {
    let a = { ...e._zod.def.shape, ...n._zod.def.shape };
    return se(this, "shape", a), a;
  }, get catchall() {
    return n._zod.def.catchall;
  }, checks: n._zod.def.checks ?? [] });
  return V(e, r);
}
function Rc(e, n, r) {
  let a = n._zod.def.checks;
  if (a && a.length > 0) throw Error(".partial() cannot be used on object schemas containing refinements");
  let t = ee(n._zod.def, { get shape() {
    let i = n._zod.def.shape, o = { ...i };
    if (r) for (let u in r) {
      if (!(u in i)) throw Error(`Unrecognized key: "${u}"`);
      if (!r[u]) continue;
      o[u] = e ? new e({ type: "optional", innerType: i[u] }) : i[u];
    }
    else for (let u in i) o[u] = e ? new e({ type: "optional", innerType: i[u] }) : i[u];
    return se(this, "shape", o), o;
  }, checks: [] });
  return V(n, t);
}
function Zc(e, n, r) {
  let a = ee(n._zod.def, { get shape() {
    let t = n._zod.def.shape, i = { ...t };
    if (r) for (let o in r) {
      if (!(o in i)) throw Error(`Unrecognized key: "${o}"`);
      if (!r[o]) continue;
      i[o] = new e({ type: "nonoptional", innerType: t[o] });
    }
    else for (let o in t) i[o] = new e({ type: "nonoptional", innerType: t[o] });
    return se(this, "shape", i), i;
  } });
  return V(n, a);
}
function le(e, n = 0) {
  if (e.aborted === true) return true;
  for (let r = n; r < e.issues.length; r++) if (e.issues[r]?.continue !== true) return true;
  return false;
}
function ha(e, n = 0) {
  if (e.aborted === true) return true;
  for (let r = n; r < e.issues.length; r++) if (e.issues[r]?.continue === false) return true;
  return false;
}
function J(e, n) {
  return n.map((r) => {
    var a;
    return (a = r).path ?? (a.path = []), r.path.unshift(e), r;
  });
}
function Ue(e) {
  return typeof e === "string" ? e : e?.message;
}
function L(e, n, r) {
  let a = e.message ? e.message : Ue(e.inst?._zod.def?.error?.(e)) ?? Ue(n?.error?.(e)) ?? Ue(r.customError?.(e)) ?? Ue(r.localeError?.(e)) ?? "Invalid input", { inst: t, continue: i, input: o, ...u } = e;
  if (u.path ?? (u.path = []), u.message = a, n?.reportInput) u.input = o;
  return u;
}
function Tt(e) {
  if (e instanceof Set) return "set";
  if (e instanceof Map) return "map";
  if (e instanceof File) return "file";
  return "unknown";
}
function Nt(e) {
  if (Array.isArray(e)) return "array";
  if (typeof e === "string") return "string";
  return "unknown";
}
function _(e) {
  let n = typeof e;
  switch (n) {
    case "number":
      return Number.isNaN(e) ? "nan" : "number";
    case "object": {
      if (e === null) return "null";
      if (Array.isArray(e)) return "array";
      let r = e;
      if (r && Object.getPrototypeOf(r) !== Object.prototype && "constructor" in r && r.constructor) return r.constructor.name;
    }
  }
  return n;
}
function _t(...e) {
  let [n, r, a] = e;
  if (typeof n === "string") return { message: n, code: "custom", input: r, inst: a };
  return { ...n };
}
function Lc(e) {
  return Object.entries(e).filter(([n, r]) => {
    return Number.isNaN(Number.parseInt(n, 10));
  }).map((n) => n[1]);
}
function $a(e) {
  let n = atob(e), r = new Uint8Array(n.length);
  for (let a = 0; a < n.length; a++) r[a] = n.charCodeAt(a);
  return r;
}
function ya(e) {
  let n = "";
  for (let r = 0; r < e.length; r++) n += String.fromCharCode(e[r]);
  return btoa(n);
}
function Mc(e) {
  let n = e.replace(/-/g, "+").replace(/_/g, "/"), r = "=".repeat((4 - n.length % 4) % 4);
  return $a(n + r);
}
function Bc(e) {
  return ya(e).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function Fc(e) {
  let n = e.replace(/^0x/, "");
  if (n.length % 2 !== 0) throw Error("Invalid hex string length");
  let r = new Uint8Array(n.length / 2);
  for (let a = 0; a < n.length; a += 2) r[a / 2] = Number.parseInt(n.slice(a, a + 2), 16);
  return r;
}
function Jc(e) {
  return Array.from(e).map((n) => n.toString(16).padStart(2, "0")).join("");
}
var ba = class {
  constructor(...e) {
  }
};
var _a = (e, n) => {
  e.name = "$ZodError", Object.defineProperty(e, "_zod", { value: e._zod, enumerable: false }), Object.defineProperty(e, "issues", { value: n, enumerable: false }), e.message = JSON.stringify(n, yt, 2), Object.defineProperty(e, "toString", { value: () => e.message, enumerable: false });
};
var Nn = m("$ZodError", _a);
var M = m("$ZodError", _a, { Parent: Error });
function zn(e, n = (r) => r.message) {
  let r = {}, a = [];
  for (let t of e.issues) if (t.path.length > 0) r[t.path[0]] = r[t.path[0]] || [], r[t.path[0]].push(n(t));
  else a.push(n(t));
  return { formErrors: a, fieldErrors: r };
}
function Un(e, n = (r) => r.message) {
  let r = { _errors: [] }, a = (t, i = []) => {
    for (let o of t.issues) if (o.code === "invalid_union" && o.errors.length) o.errors.map((u) => a({ issues: u }, [...i, ...o.path]));
    else if (o.code === "invalid_key") a({ issues: o.issues }, [...i, ...o.path]);
    else if (o.code === "invalid_element") a({ issues: o.issues }, [...i, ...o.path]);
    else {
      let u = [...i, ...o.path];
      if (u.length === 0) r._errors.push(n(o));
      else {
        let l = r, d = 0;
        while (d < u.length) {
          let c = u[d];
          if (d !== u.length - 1) l[c] = l[c] || { _errors: [] };
          else l[c] = l[c] || { _errors: [] }, l[c]._errors.push(n(o));
          l = l[c], d++;
        }
      }
    }
  };
  return a(e), r;
}
function ka(e, n = (r) => r.message) {
  let r = { errors: [] }, a = (t, i = []) => {
    var o, u;
    for (let l of t.issues) if (l.code === "invalid_union" && l.errors.length) l.errors.map((d) => a({ issues: d }, [...i, ...l.path]));
    else if (l.code === "invalid_key") a({ issues: l.issues }, [...i, ...l.path]);
    else if (l.code === "invalid_element") a({ issues: l.issues }, [...i, ...l.path]);
    else {
      let d = [...i, ...l.path];
      if (d.length === 0) {
        r.errors.push(n(l));
        continue;
      }
      let c = r, p = 0;
      while (p < d.length) {
        let f = d[p], $ = p === d.length - 1;
        if (typeof f === "string") c.properties ?? (c.properties = {}), (o = c.properties)[f] ?? (o[f] = { errors: [] }), c = c.properties[f];
        else c.items ?? (c.items = []), (u = c.items)[f] ?? (u[f] = { errors: [] }), c = c.items[f];
        if ($) c.errors.push(n(l));
        p++;
      }
    }
  };
  return a(e), r;
}
function Ia(e) {
  let n = [], r = e.map((a) => typeof a === "object" ? a.key : a);
  for (let a of r) if (typeof a === "number") n.push(`[${a}]`);
  else if (typeof a === "symbol") n.push(`[${JSON.stringify(String(a))}]`);
  else if (/[^\w$]/.test(a)) n.push(`[${JSON.stringify(a)}]`);
  else {
    if (n.length) n.push(".");
    n.push(a);
  }
  return n.join("");
}
function wa(e) {
  let n = [], r = [...e.issues].sort((a, t) => (a.path ?? []).length - (t.path ?? []).length);
  for (let a of r) if (n.push(`\u2716 ${a.message}`), a.path?.length) n.push(`  \u2192 at ${Ia(a.path)}`);
  return n.join(`
`);
}
var Be = (e) => (n, r, a, t) => {
  let i = a ? { ...a, async: false } : { async: false }, o = n._zod.run({ value: r, issues: [] }, i);
  if (o instanceof Promise) throw new ne();
  if (o.issues.length) {
    let u = new (t?.Err ?? e)(o.issues.map((l) => L(l, i, j())));
    throw Tn(u, t?.callee), u;
  }
  return o.value;
};
var kn = Be(M);
var Fe = (e) => async (n, r, a, t) => {
  let i = a ? { ...a, async: true } : { async: true }, o = n._zod.run({ value: r, issues: [] }, i);
  if (o instanceof Promise) o = await o;
  if (o.issues.length) {
    let u = new (t?.Err ?? e)(o.issues.map((l) => L(l, i, j())));
    throw Tn(u, t?.callee), u;
  }
  return o.value;
};
var In = Fe(M);
var Je = (e) => (n, r, a) => {
  let t = a ? { ...a, async: false } : { async: false }, i = n._zod.run({ value: r, issues: [] }, t);
  if (i instanceof Promise) throw new ne();
  return i.issues.length ? { success: false, error: new (e ?? Nn)(i.issues.map((o) => L(o, t, j()))) } : { success: true, data: i.value };
};
var Sa = Je(M);
var Ge = (e) => async (n, r, a) => {
  let t = a ? { ...a, async: true } : { async: true }, i = n._zod.run({ value: r, issues: [] }, t);
  if (i instanceof Promise) i = await i;
  return i.issues.length ? { success: false, error: new e(i.issues.map((o) => L(o, t, j()))) } : { success: true, data: i.value };
};
var xa = Ge(M);
var An = (e) => (n, r, a) => {
  let t = a ? { ...a, direction: "backward" } : { direction: "backward" };
  return Be(e)(n, r, t);
};
var Gc = An(M);
var Dn = (e) => (n, r, a) => {
  return Be(e)(n, r, a);
};
var Wc = Dn(M);
var Pn = (e) => async (n, r, a) => {
  let t = a ? { ...a, direction: "backward" } : { direction: "backward" };
  return Fe(e)(n, r, t);
};
var Vc = Pn(M);
var jn = (e) => async (n, r, a) => {
  return Fe(e)(n, r, a);
};
var Kc = jn(M);
var Cn = (e) => (n, r, a) => {
  let t = a ? { ...a, direction: "backward" } : { direction: "backward" };
  return Je(e)(n, r, t);
};
var qc = Cn(M);
var Rn = (e) => (n, r, a) => {
  return Je(e)(n, r, a);
};
var Hc = Rn(M);
var Zn = (e) => async (n, r, a) => {
  let t = a ? { ...a, direction: "backward" } : { direction: "backward" };
  return Ge(e)(n, r, t);
};
var Xc = Zn(M);
var Ln = (e) => async (n, r, a) => {
  return Ge(e)(n, r, a);
};
var Yc = Ln(M);
var ie = {};
Q(ie, { xid: () => Na, uuid7: () => nm, uuid6: () => tm, uuid4: () => em, uuid: () => ke, uppercase: () => ro, unicodeEmail: () => ja, undefined: () => no, ulid: () => Ta, time: () => qa, string: () => Xa, sha512_hex: () => Im, sha512_base64url: () => Sm, sha512_base64: () => wm, sha384_hex: () => bm, sha384_base64url: () => km, sha384_base64: () => _m, sha256_hex: () => hm, sha256_base64url: () => ym, sha256_base64: () => $m, sha1_hex: () => pm, sha1_base64url: () => vm, sha1_base64: () => gm, rfc5322Email: () => rm, number: () => Bn, null: () => to, nanoid: () => Ua, md5_hex: () => cm, md5_base64url: () => fm, md5_base64: () => mm, mac: () => La, lowercase: () => io, ksuid: () => za, ipv6: () => Za, ipv4: () => Ra, integer: () => Qa, idnEmail: () => am, httpProtocol: () => Ja, html5Email: () => im, hostname: () => um, hex: () => dm, guid: () => Da, extendedDuration: () => Qc, emoji: () => Ca, email: () => Pa, e164: () => Ga, duration: () => Aa, domain: () => lm, datetime: () => Ha, date: () => Va, cuid2: () => Oa, cuid: () => Ea, cidrv6: () => Ba, cidrv4: () => Ma, browserEmail: () => om, boolean: () => eo, bigint: () => Ya, base64url: () => Mn, base64: () => Fa });
var Ea = /^[cC][0-9a-z]{6,}$/;
var Oa = /^[0-9a-z]+$/;
var Ta = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
var Na = /^[0-9a-vA-V]{20}$/;
var za = /^[A-Za-z0-9]{27}$/;
var Ua = /^[a-zA-Z0-9_-]{21}$/;
var Aa = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
var Qc = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var Da = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
var ke = (e) => {
  if (!e) return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
  return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${e}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
};
var em = ke(4);
var tm = ke(6);
var nm = ke(7);
var Pa = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
var im = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
var rm = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
var ja = /^[^\s@"]{1,64}@[^\s@]{1,255}$/u;
var am = ja;
var om = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
var sm = "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$";
function Ca() {
  return new RegExp(sm, "u");
}
var Ra = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var Za = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
var La = (e) => {
  let n = Y(e ?? ":");
  return new RegExp(`^(?:[0-9A-F]{2}${n}){5}[0-9A-F]{2}$|^(?:[0-9a-f]{2}${n}){5}[0-9a-f]{2}$`);
};
var Ma = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
var Ba = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var Fa = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
var Mn = /^[A-Za-z0-9_-]*$/;
var um = /^(?=.{1,253}\.?$)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[-0-9a-zA-Z]{0,61}[0-9a-zA-Z])?)*\.?$/;
var lm = /^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
var Ja = /^https?$/;
var Ga = /^\+[1-9]\d{6,14}$/;
var Wa = "(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))";
var Va = new RegExp(`^${Wa}$`);
function Ka(e) {
  return typeof e.precision === "number" ? e.precision === -1 ? "(?:[01]\\d|2[0-3]):[0-5]\\d" : e.precision === 0 ? "(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d" : `(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d\\.\\d{${e.precision}}` : "(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?";
}
function qa(e) {
  return new RegExp(`^${Ka(e)}$`);
}
function Ha(e) {
  let n = Ka({ precision: e.precision }), r = ["Z"];
  if (e.local) r.push("");
  if (e.offset) r.push("([+-](?:[01]\\d|2[0-3]):[0-5]\\d)");
  let a = `${n}(?:${r.join("|")})`;
  return new RegExp(`^${Wa}T(?:${a})$`);
}
var Xa = (e) => {
  let n = e ? `[\\s\\S]{${e?.minimum ?? 0},${e?.maximum ?? ""}}` : "[\\s\\S]*";
  return new RegExp(`^${n}$`);
};
var Ya = /^-?\d+n?$/;
var Qa = /^-?\d+$/;
var Bn = /^-?\d+(?:\.\d+)?$/;
var eo = /^(?:true|false)$/i;
var to = /^null$/i;
var no = /^undefined$/i;
var io = /^[^A-Z]*$/;
var ro = /^[^a-z]*$/;
var dm = /^[0-9a-fA-F]*$/;
function We(e, n) {
  return new RegExp(`^[A-Za-z0-9+/]{${e}}${n}$`);
}
function Ve(e) {
  return new RegExp(`^[A-Za-z0-9_-]{${e}}$`);
}
var cm = /^[0-9a-fA-F]{32}$/;
var mm = We(22, "==");
var fm = Ve(22);
var pm = /^[0-9a-fA-F]{40}$/;
var gm = We(27, "=");
var vm = Ve(27);
var hm = /^[0-9a-fA-F]{64}$/;
var $m = We(43, "=");
var ym = Ve(43);
var bm = /^[0-9a-fA-F]{96}$/;
var _m = We(64, "");
var km = Ve(64);
var Im = /^[0-9a-fA-F]{128}$/;
var wm = We(86, "==");
var Sm = Ve(86);
var D = m("$ZodCheck", (e, n) => {
  var r;
  e._zod ?? (e._zod = {}), e._zod.def = n, (r = e._zod).onattach ?? (r.onattach = []);
});
var ao = { number: "number", bigint: "bigint", object: "date" };
var Fn = m("$ZodCheckLessThan", (e, n) => {
  D.init(e, n);
  let r = ao[typeof n.value];
  e._zod.onattach.push((a) => {
    let t = a._zod.bag, i = (n.inclusive ? t.maximum : t.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
    if (n.value < i) if (n.inclusive) t.maximum = n.value;
    else t.exclusiveMaximum = n.value;
  }), e._zod.check = (a) => {
    if (n.inclusive ? a.value <= n.value : a.value < n.value) return;
    a.issues.push({ origin: r, code: "too_big", maximum: typeof n.value === "object" ? n.value.getTime() : n.value, input: a.value, inclusive: n.inclusive, inst: e, continue: !n.abort });
  };
});
var Jn = m("$ZodCheckGreaterThan", (e, n) => {
  D.init(e, n);
  let r = ao[typeof n.value];
  e._zod.onattach.push((a) => {
    let t = a._zod.bag, i = (n.inclusive ? t.minimum : t.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
    if (n.value > i) if (n.inclusive) t.minimum = n.value;
    else t.exclusiveMinimum = n.value;
  }), e._zod.check = (a) => {
    if (n.inclusive ? a.value >= n.value : a.value > n.value) return;
    a.issues.push({ origin: r, code: "too_small", minimum: typeof n.value === "object" ? n.value.getTime() : n.value, input: a.value, inclusive: n.inclusive, inst: e, continue: !n.abort });
  };
});
var oo = m("$ZodCheckMultipleOf", (e, n) => {
  D.init(e, n), e._zod.onattach.push((r) => {
    var a;
    (a = r._zod.bag).multipleOf ?? (a.multipleOf = n.value);
  }), e._zod.check = (r) => {
    if (typeof r.value !== typeof n.value) throw Error("Cannot mix number and bigint in multiple_of check.");
    if (typeof r.value === "bigint" ? r.value % n.value === BigInt(0) : la(r.value, n.value) === 0) return;
    r.issues.push({ origin: typeof r.value, code: "not_multiple_of", divisor: n.value, input: r.value, inst: e, continue: !n.abort });
  };
});
var so = m("$ZodCheckNumberFormat", (e, n) => {
  D.init(e, n), n.format = n.format || "float64";
  let r = n.format?.includes("int"), a = r ? "int" : "number", [t, i] = ga[n.format];
  e._zod.onattach.push((o) => {
    let u = o._zod.bag;
    if (u.format = n.format, u.minimum = t, u.maximum = i, r) u.pattern = Qa;
  }), e._zod.check = (o) => {
    let u = o.value;
    if (r) {
      if (!Number.isInteger(u)) {
        o.issues.push({ expected: a, format: n.format, code: "invalid_type", continue: false, input: u, inst: e });
        return;
      }
      if (!Number.isSafeInteger(u)) {
        if (u > 0) o.issues.push({ input: u, code: "too_big", maximum: Number.MAX_SAFE_INTEGER, note: "Integers must be within the safe integer range.", inst: e, origin: a, inclusive: true, continue: !n.abort });
        else o.issues.push({ input: u, code: "too_small", minimum: Number.MIN_SAFE_INTEGER, note: "Integers must be within the safe integer range.", inst: e, origin: a, inclusive: true, continue: !n.abort });
        return;
      }
    }
    if (u < t) o.issues.push({ origin: "number", input: u, code: "too_small", minimum: t, inclusive: true, inst: e, continue: !n.abort });
    if (u > i) o.issues.push({ origin: "number", input: u, code: "too_big", maximum: i, inclusive: true, inst: e, continue: !n.abort });
  };
});
var uo = m("$ZodCheckBigIntFormat", (e, n) => {
  D.init(e, n);
  let [r, a] = va[n.format];
  e._zod.onattach.push((t) => {
    let i = t._zod.bag;
    i.format = n.format, i.minimum = r, i.maximum = a;
  }), e._zod.check = (t) => {
    let i = t.value;
    if (i < r) t.issues.push({ origin: "bigint", input: i, code: "too_small", minimum: r, inclusive: true, inst: e, continue: !n.abort });
    if (i > a) t.issues.push({ origin: "bigint", input: i, code: "too_big", maximum: a, inclusive: true, inst: e, continue: !n.abort });
  };
});
var lo = m("$ZodCheckMaxSize", (e, n) => {
  var r;
  D.init(e, n), (r = e._zod.def).when ?? (r.when = (a) => {
    let t = a.value;
    return !pe(t) && t.size !== void 0;
  }), e._zod.onattach.push((a) => {
    let t = a._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
    if (n.maximum < t) a._zod.bag.maximum = n.maximum;
  }), e._zod.check = (a) => {
    let t = a.value;
    if (t.size <= n.maximum) return;
    a.issues.push({ origin: Tt(t), code: "too_big", maximum: n.maximum, inclusive: true, input: t, inst: e, continue: !n.abort });
  };
});
var co = m("$ZodCheckMinSize", (e, n) => {
  var r;
  D.init(e, n), (r = e._zod.def).when ?? (r.when = (a) => {
    let t = a.value;
    return !pe(t) && t.size !== void 0;
  }), e._zod.onattach.push((a) => {
    let t = a._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
    if (n.minimum > t) a._zod.bag.minimum = n.minimum;
  }), e._zod.check = (a) => {
    let t = a.value;
    if (t.size >= n.minimum) return;
    a.issues.push({ origin: Tt(t), code: "too_small", minimum: n.minimum, inclusive: true, input: t, inst: e, continue: !n.abort });
  };
});
var mo = m("$ZodCheckSizeEquals", (e, n) => {
  var r;
  D.init(e, n), (r = e._zod.def).when ?? (r.when = (a) => {
    let t = a.value;
    return !pe(t) && t.size !== void 0;
  }), e._zod.onattach.push((a) => {
    let t = a._zod.bag;
    t.minimum = n.size, t.maximum = n.size, t.size = n.size;
  }), e._zod.check = (a) => {
    let t = a.value, i = t.size;
    if (i === n.size) return;
    let o = i > n.size;
    a.issues.push({ origin: Tt(t), ...o ? { code: "too_big", maximum: n.size } : { code: "too_small", minimum: n.size }, inclusive: true, exact: true, input: a.value, inst: e, continue: !n.abort });
  };
});
var fo = m("$ZodCheckMaxLength", (e, n) => {
  var r;
  D.init(e, n), (r = e._zod.def).when ?? (r.when = (a) => {
    let t = a.value;
    return !pe(t) && t.length !== void 0;
  }), e._zod.onattach.push((a) => {
    let t = a._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
    if (n.maximum < t) a._zod.bag.maximum = n.maximum;
  }), e._zod.check = (a) => {
    let t = a.value;
    if (t.length <= n.maximum) return;
    let i = Nt(t);
    a.issues.push({ origin: i, code: "too_big", maximum: n.maximum, inclusive: true, input: t, inst: e, continue: !n.abort });
  };
});
var po = m("$ZodCheckMinLength", (e, n) => {
  var r;
  D.init(e, n), (r = e._zod.def).when ?? (r.when = (a) => {
    let t = a.value;
    return !pe(t) && t.length !== void 0;
  }), e._zod.onattach.push((a) => {
    let t = a._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
    if (n.minimum > t) a._zod.bag.minimum = n.minimum;
  }), e._zod.check = (a) => {
    let t = a.value;
    if (t.length >= n.minimum) return;
    let i = Nt(t);
    a.issues.push({ origin: i, code: "too_small", minimum: n.minimum, inclusive: true, input: t, inst: e, continue: !n.abort });
  };
});
var go = m("$ZodCheckLengthEquals", (e, n) => {
  var r;
  D.init(e, n), (r = e._zod.def).when ?? (r.when = (a) => {
    let t = a.value;
    return !pe(t) && t.length !== void 0;
  }), e._zod.onattach.push((a) => {
    let t = a._zod.bag;
    t.minimum = n.length, t.maximum = n.length, t.length = n.length;
  }), e._zod.check = (a) => {
    let t = a.value, i = t.length;
    if (i === n.length) return;
    let o = Nt(t), u = i > n.length;
    a.issues.push({ origin: o, ...u ? { code: "too_big", maximum: n.length } : { code: "too_small", minimum: n.length }, inclusive: true, exact: true, input: a.value, inst: e, continue: !n.abort });
  };
});
var Ke = m("$ZodCheckStringFormat", (e, n) => {
  var r, a;
  if (D.init(e, n), e._zod.onattach.push((t) => {
    let i = t._zod.bag;
    if (i.format = n.format, n.pattern) i.patterns ?? (i.patterns = /* @__PURE__ */ new Set()), i.patterns.add(n.pattern);
  }), n.pattern) (r = e._zod).check ?? (r.check = (t) => {
    if (n.pattern.lastIndex = 0, n.pattern.test(t.value)) return;
    t.issues.push({ origin: "string", code: "invalid_format", format: n.format, input: t.value, ...n.pattern ? { pattern: n.pattern.toString() } : {}, inst: e, continue: !n.abort });
  });
  else (a = e._zod).check ?? (a.check = () => {
  });
});
var vo = m("$ZodCheckRegex", (e, n) => {
  Ke.init(e, n), e._zod.check = (r) => {
    if (n.pattern.lastIndex = 0, n.pattern.test(r.value)) return;
    r.issues.push({ origin: "string", code: "invalid_format", format: "regex", input: r.value, pattern: n.pattern.toString(), inst: e, continue: !n.abort });
  };
});
var ho = m("$ZodCheckLowerCase", (e, n) => {
  n.pattern ?? (n.pattern = io), Ke.init(e, n);
});
var $o = m("$ZodCheckUpperCase", (e, n) => {
  n.pattern ?? (n.pattern = ro), Ke.init(e, n);
});
var yo = m("$ZodCheckIncludes", (e, n) => {
  D.init(e, n);
  let r = Y(n.includes), a = new RegExp(typeof n.position === "number" ? `^.{${n.position}}${r}` : r);
  n.pattern = a, e._zod.onattach.push((t) => {
    let i = t._zod.bag;
    i.patterns ?? (i.patterns = /* @__PURE__ */ new Set()), i.patterns.add(a);
  }), e._zod.check = (t) => {
    if (t.value.includes(n.includes, n.position)) return;
    t.issues.push({ origin: "string", code: "invalid_format", format: "includes", includes: n.includes, input: t.value, inst: e, continue: !n.abort });
  };
});
var bo = m("$ZodCheckStartsWith", (e, n) => {
  D.init(e, n);
  let r = new RegExp(`^${Y(n.prefix)}.*`);
  n.pattern ?? (n.pattern = r), e._zod.onattach.push((a) => {
    let t = a._zod.bag;
    t.patterns ?? (t.patterns = /* @__PURE__ */ new Set()), t.patterns.add(r);
  }), e._zod.check = (a) => {
    if (a.value.startsWith(n.prefix)) return;
    a.issues.push({ origin: "string", code: "invalid_format", format: "starts_with", prefix: n.prefix, input: a.value, inst: e, continue: !n.abort });
  };
});
var _o = m("$ZodCheckEndsWith", (e, n) => {
  D.init(e, n);
  let r = new RegExp(`.*${Y(n.suffix)}$`);
  n.pattern ?? (n.pattern = r), e._zod.onattach.push((a) => {
    let t = a._zod.bag;
    t.patterns ?? (t.patterns = /* @__PURE__ */ new Set()), t.patterns.add(r);
  }), e._zod.check = (a) => {
    if (a.value.endsWith(n.suffix)) return;
    a.issues.push({ origin: "string", code: "invalid_format", format: "ends_with", suffix: n.suffix, input: a.value, inst: e, continue: !n.abort });
  };
});
function Cr(e, n, r) {
  if (e.issues.length) n.issues.push(...J(r, e.issues));
}
var ko = m("$ZodCheckProperty", (e, n) => {
  D.init(e, n), e._zod.check = (r) => {
    let a = n.schema._zod.run({ value: r.value[n.property], issues: [] }, {});
    if (a instanceof Promise) return a.then((t) => Cr(t, r, n.property));
    Cr(a, r, n.property);
    return;
  };
});
var Io = m("$ZodCheckMimeType", (e, n) => {
  D.init(e, n);
  let r = new Set(n.mime);
  e._zod.onattach.push((a) => {
    a._zod.bag.mime = n.mime;
  }), e._zod.check = (a) => {
    if (r.has(a.value.type)) return;
    a.issues.push({ code: "invalid_value", values: n.mime, input: a.value.type, inst: e, continue: !n.abort });
  };
});
var wo = m("$ZodCheckOverwrite", (e, n) => {
  D.init(e, n), e._zod.check = (r) => {
    r.value = n.tx(r.value);
  };
});
var Gn = class {
  constructor(e = []) {
    if (this.content = [], this.indent = 0, this) this.args = e;
  }
  indented(e) {
    this.indent += 1, e(this), this.indent -= 1;
  }
  write(e) {
    if (typeof e === "function") {
      e(this, { execution: "sync" }), e(this, { execution: "async" });
      return;
    }
    let n = e.split(`
`).filter((t) => t), r = Math.min(...n.map((t) => t.length - t.trimStart().length)), a = n.map((t) => t.slice(r)).map((t) => " ".repeat(this.indent * 2) + t);
    for (let t of a) this.content.push(t);
  }
  compile() {
    let e = Function, n = this?.args, r = [...(this?.content ?? [""]).map((a) => `  ${a}`)];
    return new e(...n, r.join(`
`));
  }
};
var So = { major: 4, minor: 4, patch: 3 };
var I = m("$ZodType", (e, n) => {
  var r;
  e ?? (e = {}), e._zod.def = n, e._zod.bag = e._zod.bag || {}, e._zod.version = So;
  let a = [...e._zod.def.checks ?? []];
  if (e._zod.traits.has("$ZodCheck")) a.unshift(e);
  for (let t of a) for (let i of t._zod.onattach) i(e);
  if (a.length === 0) (r = e._zod).deferred ?? (r.deferred = []), e._zod.deferred?.push(() => {
    e._zod.run = e._zod.parse;
  });
  else {
    let t = (o, u, l) => {
      let d = le(o), c;
      for (let p of u) {
        if (p._zod.def.when) {
          if (ha(o)) continue;
          if (!p._zod.def.when(o)) continue;
        } else if (d) continue;
        let f = o.issues.length, $ = p._zod.check(o);
        if ($ instanceof Promise && l?.async === false) throw new ne();
        if (c || $ instanceof Promise) c = (c ?? Promise.resolve()).then(async () => {
          if (await $, o.issues.length === f) return;
          if (!d) d = le(o, f);
        });
        else {
          if (o.issues.length === f) continue;
          if (!d) d = le(o, f);
        }
      }
      if (c) return c.then(() => {
        return o;
      });
      return o;
    }, i = (o, u, l) => {
      if (le(o)) return o.aborted = true, o;
      let d = t(u, a, l);
      if (d instanceof Promise) {
        if (l.async === false) throw new ne();
        return d.then((c) => e._zod.parse(c, l));
      }
      return e._zod.parse(d, l);
    };
    e._zod.run = (o, u) => {
      if (u.skipChecks) return e._zod.parse(o, u);
      if (u.direction === "backward") {
        let d = e._zod.parse({ value: o.value, issues: [] }, { ...u, skipChecks: true });
        if (d instanceof Promise) return d.then((c) => {
          return i(c, o, u);
        });
        return i(d, o, u);
      }
      let l = e._zod.parse(o, u);
      if (l instanceof Promise) {
        if (u.async === false) throw new ne();
        return l.then((d) => t(d, a, u));
      }
      return t(l, a, u);
    };
  }
  O(e, "~standard", () => ({ validate: (t) => {
    try {
      let i = Sa(e, t);
      return i.success ? { value: i.data } : { issues: i.error?.issues };
    } catch (i) {
      return xa(e, t).then((o) => o.success ? { value: o.data } : { issues: o.error?.issues });
    }
  }, vendor: "zod", version: 1 }));
});
var qe = m("$ZodString", (e, n) => {
  I.init(e, n), e._zod.pattern = [...e?._zod.bag?.patterns ?? []].pop() ?? Xa(e._zod.bag), e._zod.parse = (r, a) => {
    if (n.coerce) try {
      r.value = String(r.value);
    } catch (t) {
    }
    if (typeof r.value === "string") return r;
    return r.issues.push({ expected: "string", code: "invalid_type", input: r.value, inst: e }), r;
  };
});
var z = m("$ZodStringFormat", (e, n) => {
  Ke.init(e, n), qe.init(e, n);
});
var xo = m("$ZodGUID", (e, n) => {
  n.pattern ?? (n.pattern = Da), z.init(e, n);
});
var Eo = m("$ZodUUID", (e, n) => {
  if (n.version) {
    let r = { v1: 1, v2: 2, v3: 3, v4: 4, v5: 5, v6: 6, v7: 7, v8: 8 }[n.version];
    if (r === void 0) throw Error(`Invalid UUID version: "${n.version}"`);
    n.pattern ?? (n.pattern = ke(r));
  } else n.pattern ?? (n.pattern = ke());
  z.init(e, n);
});
var Oo = m("$ZodEmail", (e, n) => {
  n.pattern ?? (n.pattern = Pa), z.init(e, n);
});
var To = m("$ZodURL", (e, n) => {
  z.init(e, n), e._zod.check = (r) => {
    try {
      let a = r.value.trim();
      if (!n.normalize && n.protocol?.source === Ja.source) {
        if (!/^https?:\/\//i.test(a)) {
          r.issues.push({ code: "invalid_format", format: "url", note: "Invalid URL format", input: r.value, inst: e, continue: !n.abort });
          return;
        }
      }
      let t = new URL(a);
      if (n.hostname) {
        if (n.hostname.lastIndex = 0, !n.hostname.test(t.hostname)) r.issues.push({ code: "invalid_format", format: "url", note: "Invalid hostname", pattern: n.hostname.source, input: r.value, inst: e, continue: !n.abort });
      }
      if (n.protocol) {
        if (n.protocol.lastIndex = 0, !n.protocol.test(t.protocol.endsWith(":") ? t.protocol.slice(0, -1) : t.protocol)) r.issues.push({ code: "invalid_format", format: "url", note: "Invalid protocol", pattern: n.protocol.source, input: r.value, inst: e, continue: !n.abort });
      }
      if (n.normalize) r.value = t.href;
      else r.value = a;
      return;
    } catch (a) {
      r.issues.push({ code: "invalid_format", format: "url", input: r.value, inst: e, continue: !n.abort });
    }
  };
});
var No = m("$ZodEmoji", (e, n) => {
  n.pattern ?? (n.pattern = Ca()), z.init(e, n);
});
var zo = m("$ZodNanoID", (e, n) => {
  n.pattern ?? (n.pattern = Ua), z.init(e, n);
});
var Uo = m("$ZodCUID", (e, n) => {
  n.pattern ?? (n.pattern = Ea), z.init(e, n);
});
var Ao = m("$ZodCUID2", (e, n) => {
  n.pattern ?? (n.pattern = Oa), z.init(e, n);
});
var Do = m("$ZodULID", (e, n) => {
  n.pattern ?? (n.pattern = Ta), z.init(e, n);
});
var Po = m("$ZodXID", (e, n) => {
  n.pattern ?? (n.pattern = Na), z.init(e, n);
});
var jo = m("$ZodKSUID", (e, n) => {
  n.pattern ?? (n.pattern = za), z.init(e, n);
});
var Co = m("$ZodISODateTime", (e, n) => {
  n.pattern ?? (n.pattern = Ha(n)), z.init(e, n);
});
var Ro = m("$ZodISODate", (e, n) => {
  n.pattern ?? (n.pattern = Va), z.init(e, n);
});
var Zo = m("$ZodISOTime", (e, n) => {
  n.pattern ?? (n.pattern = qa(n)), z.init(e, n);
});
var Lo = m("$ZodISODuration", (e, n) => {
  n.pattern ?? (n.pattern = Aa), z.init(e, n);
});
var Mo = m("$ZodIPv4", (e, n) => {
  n.pattern ?? (n.pattern = Ra), z.init(e, n), e._zod.bag.format = "ipv4";
});
var Bo = m("$ZodIPv6", (e, n) => {
  n.pattern ?? (n.pattern = Za), z.init(e, n), e._zod.bag.format = "ipv6", e._zod.check = (r) => {
    try {
      new URL(`http://[${r.value}]`);
    } catch {
      r.issues.push({ code: "invalid_format", format: "ipv6", input: r.value, inst: e, continue: !n.abort });
    }
  };
});
var Fo = m("$ZodMAC", (e, n) => {
  n.pattern ?? (n.pattern = La(n.delimiter)), z.init(e, n), e._zod.bag.format = "mac";
});
var Jo = m("$ZodCIDRv4", (e, n) => {
  n.pattern ?? (n.pattern = Ma), z.init(e, n);
});
var Go = m("$ZodCIDRv6", (e, n) => {
  n.pattern ?? (n.pattern = Ba), z.init(e, n), e._zod.check = (r) => {
    let a = r.value.split("/");
    try {
      if (a.length !== 2) throw Error();
      let [t, i] = a;
      if (!i) throw Error();
      let o = Number(i);
      if (`${o}` !== i) throw Error();
      if (o < 0 || o > 128) throw Error();
      new URL(`http://[${t}]`);
    } catch {
      r.issues.push({ code: "invalid_format", format: "cidrv6", input: r.value, inst: e, continue: !n.abort });
    }
  };
});
function Wn(e) {
  if (e === "") return true;
  if (/\s/.test(e)) return false;
  if (e.length % 4 !== 0) return false;
  try {
    return atob(e), true;
  } catch {
    return false;
  }
}
var Wo = m("$ZodBase64", (e, n) => {
  n.pattern ?? (n.pattern = Fa), z.init(e, n), e._zod.bag.contentEncoding = "base64", e._zod.check = (r) => {
    if (Wn(r.value)) return;
    r.issues.push({ code: "invalid_format", format: "base64", input: r.value, inst: e, continue: !n.abort });
  };
});
function Vo(e) {
  if (!Mn.test(e)) return false;
  let n = e.replace(/[-_]/g, (a) => a === "-" ? "+" : "/"), r = n.padEnd(Math.ceil(n.length / 4) * 4, "=");
  return Wn(r);
}
var Ko = m("$ZodBase64URL", (e, n) => {
  n.pattern ?? (n.pattern = Mn), z.init(e, n), e._zod.bag.contentEncoding = "base64url", e._zod.check = (r) => {
    if (Vo(r.value)) return;
    r.issues.push({ code: "invalid_format", format: "base64url", input: r.value, inst: e, continue: !n.abort });
  };
});
var qo = m("$ZodE164", (e, n) => {
  n.pattern ?? (n.pattern = Ga), z.init(e, n);
});
function Ho(e, n = null) {
  try {
    let r = e.split(".");
    if (r.length !== 3) return false;
    let [a] = r;
    if (!a) return false;
    let t = JSON.parse(atob(a));
    if ("typ" in t && t?.typ !== "JWT") return false;
    if (!t.alg) return false;
    if (n && (!("alg" in t) || t.alg !== n)) return false;
    return true;
  } catch {
    return false;
  }
}
var Xo = m("$ZodJWT", (e, n) => {
  z.init(e, n), e._zod.check = (r) => {
    if (Ho(r.value, n.alg)) return;
    r.issues.push({ code: "invalid_format", format: "jwt", input: r.value, inst: e, continue: !n.abort });
  };
});
var Yo = m("$ZodCustomStringFormat", (e, n) => {
  z.init(e, n), e._zod.check = (r) => {
    if (n.fn(r.value)) return;
    r.issues.push({ code: "invalid_format", format: n.format, input: r.value, inst: e, continue: !n.abort });
  };
});
var Vn = m("$ZodNumber", (e, n) => {
  I.init(e, n), e._zod.pattern = e._zod.bag.pattern ?? Bn, e._zod.parse = (r, a) => {
    if (n.coerce) try {
      r.value = Number(r.value);
    } catch (o) {
    }
    let t = r.value;
    if (typeof t === "number" && !Number.isNaN(t) && Number.isFinite(t)) return r;
    let i = typeof t === "number" ? Number.isNaN(t) ? "NaN" : !Number.isFinite(t) ? "Infinity" : void 0 : void 0;
    return r.issues.push({ expected: "number", code: "invalid_type", input: t, inst: e, ...i ? { received: i } : {} }), r;
  };
});
var Qo = m("$ZodNumberFormat", (e, n) => {
  so.init(e, n), Vn.init(e, n);
});
var Kn = m("$ZodBoolean", (e, n) => {
  I.init(e, n), e._zod.pattern = eo, e._zod.parse = (r, a) => {
    if (n.coerce) try {
      r.value = Boolean(r.value);
    } catch (i) {
    }
    let t = r.value;
    if (typeof t === "boolean") return r;
    return r.issues.push({ expected: "boolean", code: "invalid_type", input: t, inst: e }), r;
  };
});
var qn = m("$ZodBigInt", (e, n) => {
  I.init(e, n), e._zod.pattern = Ya, e._zod.parse = (r, a) => {
    if (n.coerce) try {
      r.value = BigInt(r.value);
    } catch (t) {
    }
    if (typeof r.value === "bigint") return r;
    return r.issues.push({ expected: "bigint", code: "invalid_type", input: r.value, inst: e }), r;
  };
});
var es = m("$ZodBigIntFormat", (e, n) => {
  uo.init(e, n), qn.init(e, n);
});
var ts = m("$ZodSymbol", (e, n) => {
  I.init(e, n), e._zod.parse = (r, a) => {
    let t = r.value;
    if (typeof t === "symbol") return r;
    return r.issues.push({ expected: "symbol", code: "invalid_type", input: t, inst: e }), r;
  };
});
var ns = m("$ZodUndefined", (e, n) => {
  I.init(e, n), e._zod.pattern = no, e._zod.values = /* @__PURE__ */ new Set([void 0]), e._zod.parse = (r, a) => {
    let t = r.value;
    if (typeof t > "u") return r;
    return r.issues.push({ expected: "undefined", code: "invalid_type", input: t, inst: e }), r;
  };
});
var is = m("$ZodNull", (e, n) => {
  I.init(e, n), e._zod.pattern = to, e._zod.values = /* @__PURE__ */ new Set([null]), e._zod.parse = (r, a) => {
    let t = r.value;
    if (t === null) return r;
    return r.issues.push({ expected: "null", code: "invalid_type", input: t, inst: e }), r;
  };
});
var rs = m("$ZodAny", (e, n) => {
  I.init(e, n), e._zod.parse = (r) => r;
});
var as = m("$ZodUnknown", (e, n) => {
  I.init(e, n), e._zod.parse = (r) => r;
});
var os = m("$ZodNever", (e, n) => {
  I.init(e, n), e._zod.parse = (r, a) => {
    return r.issues.push({ expected: "never", code: "invalid_type", input: r.value, inst: e }), r;
  };
});
var ss = m("$ZodVoid", (e, n) => {
  I.init(e, n), e._zod.parse = (r, a) => {
    let t = r.value;
    if (typeof t > "u") return r;
    return r.issues.push({ expected: "void", code: "invalid_type", input: t, inst: e }), r;
  };
});
var us = m("$ZodDate", (e, n) => {
  I.init(e, n), e._zod.parse = (r, a) => {
    if (n.coerce) try {
      r.value = new Date(r.value);
    } catch (o) {
    }
    let t = r.value, i = t instanceof Date;
    if (i && !Number.isNaN(t.getTime())) return r;
    return r.issues.push({ expected: "date", code: "invalid_type", input: t, ...i ? { received: "Invalid Date" } : {}, inst: e }), r;
  };
});
function Rr(e, n, r) {
  if (e.issues.length) n.issues.push(...J(r, e.issues));
  n.value[r] = e.value;
}
var ls = m("$ZodArray", (e, n) => {
  I.init(e, n), e._zod.parse = (r, a) => {
    let t = r.value;
    if (!Array.isArray(t)) return r.issues.push({ expected: "array", code: "invalid_type", input: t, inst: e }), r;
    r.value = Array(t.length);
    let i = [];
    for (let o = 0; o < t.length; o++) {
      let u = t[o], l = n.element._zod.run({ value: u, issues: [] }, a);
      if (l instanceof Promise) i.push(l.then((d) => Rr(d, r, o)));
      else Rr(l, r, o);
    }
    if (i.length) return Promise.all(i).then(() => r);
    return r;
  };
});
function kt(e, n, r, a, t, i) {
  let o = r in a;
  if (e.issues.length) {
    if (t && i && !o) return;
    n.issues.push(...J(r, e.issues));
  }
  if (!o && !t) {
    if (!e.issues.length) n.issues.push({ code: "invalid_type", expected: "nonoptional", input: void 0, path: [r] });
    return;
  }
  if (e.value === void 0) {
    if (o) n.value[r] = void 0;
  } else n.value[r] = e.value;
}
function ds(e) {
  let n = Object.keys(e.shape);
  for (let a of n) if (!e.shape?.[a]?._zod?.traits?.has("$ZodType")) throw Error(`Invalid element at key "${a}": expected a Zod schema`);
  let r = pa(e.shape);
  return { ...e, keys: n, keySet: new Set(n), numKeys: n.length, optionalKeys: new Set(r) };
}
function cs(e, n, r, a, t, i) {
  let o = [], u = t.keySet, l = t.catchall._zod, d = l.def.type, c = l.optin === "optional", p = l.optout === "optional";
  for (let f in n) {
    if (f === "__proto__") continue;
    if (u.has(f)) continue;
    if (d === "never") {
      o.push(f);
      continue;
    }
    let $ = l.run({ value: n[f], issues: [] }, a);
    if ($ instanceof Promise) e.push($.then((x) => kt(x, r, f, n, c, p)));
    else kt($, r, f, n, c, p);
  }
  if (o.length) r.issues.push({ code: "unrecognized_keys", keys: o, input: n, inst: i });
  if (!e.length) return r;
  return Promise.all(e).then(() => {
    return r;
  });
}
var ms = m("$ZodObject", (e, n) => {
  if (I.init(e, n), !Object.getOwnPropertyDescriptor(n, "shape")?.get) {
    let o = n.shape;
    Object.defineProperty(n, "shape", { get: () => {
      let u = { ...o };
      return Object.defineProperty(n, "shape", { value: u }), u;
    } });
  }
  let r = Me(() => ds(n));
  O(e._zod, "propValues", () => {
    let o = n.shape, u = {};
    for (let l in o) {
      let d = o[l]._zod;
      if (d.values) {
        u[l] ?? (u[l] = /* @__PURE__ */ new Set());
        for (let c of d.values) u[l].add(c);
      }
    }
    return u;
  });
  let a = _e, t = n.catchall, i;
  e._zod.parse = (o, u) => {
    i ?? (i = r.value);
    let l = o.value;
    if (!a(l)) return o.issues.push({ expected: "object", code: "invalid_type", input: l, inst: e }), o;
    o.value = {};
    let d = [], c = i.shape;
    for (let p of i.keys) {
      let f = c[p], $ = f._zod.optin === "optional", x = f._zod.optout === "optional", N = f._zod.run({ value: l[p], issues: [] }, u);
      if (N instanceof Promise) d.push(N.then((X) => kt(X, o, p, l, $, x)));
      else kt(N, o, p, l, $, x);
    }
    if (!t) return d.length ? Promise.all(d).then(() => o) : o;
    return cs(d, l, o, u, r.value, e);
  };
});
var fs = m("$ZodObjectJIT", (e, n) => {
  ms.init(e, n);
  let r = e._zod.parse, a = Me(() => ds(n)), t = (p) => {
    let f = new Gn(["shape", "payload", "ctx"]), $ = a.value, x = (k) => {
      let S = _n(k);
      return `shape[${S}]._zod.run({ value: input[${S}], issues: [] }, ctx)`;
    };
    f.write("const input = payload.value;");
    let N = /* @__PURE__ */ Object.create(null), X = 0;
    for (let k of $.keys) N[k] = `key_${X++}`;
    f.write("const newResult = {};");
    for (let k of $.keys) {
      let S = N[k], P = _n(k), Ar = p[k], Dr = Ar?._zod?.optin === "optional", vc = Ar?._zod?.optout === "optional";
      if (f.write(`const ${S} = ${x(k)};`), Dr && vc) f.write(`
        if (${S}.issues.length) {
          if (${P} in input) {
            payload.issues = payload.issues.concat(${S}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${P}, ...iss.path] : [${P}]
            })));
          }
        }
        
        if (${S}.value === undefined) {
          if (${P} in input) {
            newResult[${P}] = undefined;
          }
        } else {
          newResult[${P}] = ${S}.value;
        }
        
      `);
      else if (!Dr) f.write(`
        const ${S}_present = ${P} in input;
        if (${S}.issues.length) {
          payload.issues = payload.issues.concat(${S}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${P}, ...iss.path] : [${P}]
          })));
        }
        if (!${S}_present && !${S}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${P}]
          });
        }

        if (${S}_present) {
          if (${S}.value === undefined) {
            newResult[${P}] = undefined;
          } else {
            newResult[${P}] = ${S}.value;
          }
        }

      `);
      else f.write(`
        if (${S}.issues.length) {
          payload.issues = payload.issues.concat(${S}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${P}, ...iss.path] : [${P}]
          })));
        }
        
        if (${S}.value === undefined) {
          if (${P} in input) {
            newResult[${P}] = undefined;
          }
        } else {
          newResult[${P}] = ${S}.value;
        }
        
      `);
    }
    f.write("payload.value = newResult;"), f.write("return payload;");
    let y = f.compile();
    return (k, S) => y(p, k, S);
  }, i, o = _e, u = !De.jitless, l = u && ca.value, d = n.catchall, c;
  e._zod.parse = (p, f) => {
    c ?? (c = a.value);
    let $ = p.value;
    if (!o($)) return p.issues.push({ expected: "object", code: "invalid_type", input: $, inst: e }), p;
    if (u && l && f?.async === false && f.jitless !== true) {
      if (!i) i = t(n.shape);
      if (p = i(p, f), !d) return p;
      return cs([], $, p, f, c, e);
    }
    return r(p, f);
  };
});
function Zr(e, n, r, a) {
  for (let i of e) if (i.issues.length === 0) return n.value = i.value, n;
  let t = e.filter((i) => !le(i));
  if (t.length === 1) return n.value = t[0].value, t[0];
  return n.issues.push({ code: "invalid_union", input: n.value, inst: r, errors: e.map((i) => i.issues.map((o) => L(o, a, j()))) }), n;
}
var zt = m("$ZodUnion", (e, n) => {
  I.init(e, n), O(e._zod, "optin", () => n.options.some((a) => a._zod.optin === "optional") ? "optional" : void 0), O(e._zod, "optout", () => n.options.some((a) => a._zod.optout === "optional") ? "optional" : void 0), O(e._zod, "values", () => {
    if (n.options.every((a) => a._zod.values)) return new Set(n.options.flatMap((a) => Array.from(a._zod.values)));
    return;
  }), O(e._zod, "pattern", () => {
    if (n.options.every((a) => a._zod.pattern)) {
      let a = n.options.map((t) => t._zod.pattern);
      return new RegExp(`^(${a.map((t) => Ot(t.source)).join("|")})$`);
    }
    return;
  });
  let r = n.options.length === 1 ? n.options[0]._zod.run : null;
  e._zod.parse = (a, t) => {
    if (r) return r(a, t);
    let i = false, o = [];
    for (let u of n.options) {
      let l = u._zod.run({ value: a.value, issues: [] }, t);
      if (l instanceof Promise) o.push(l), i = true;
      else {
        if (l.issues.length === 0) return l;
        o.push(l);
      }
    }
    if (!i) return Zr(o, a, e, t);
    return Promise.all(o).then((u) => {
      return Zr(u, a, e, t);
    });
  };
});
function Lr(e, n, r, a) {
  let t = e.filter((i) => i.issues.length === 0);
  if (t.length === 1) return n.value = t[0].value, n;
  if (t.length === 0) n.issues.push({ code: "invalid_union", input: n.value, inst: r, errors: e.map((i) => i.issues.map((o) => L(o, a, j()))) });
  else n.issues.push({ code: "invalid_union", input: n.value, inst: r, errors: [], inclusive: false });
  return n;
}
var ps = m("$ZodXor", (e, n) => {
  zt.init(e, n), n.inclusive = false;
  let r = n.options.length === 1 ? n.options[0]._zod.run : null;
  e._zod.parse = (a, t) => {
    if (r) return r(a, t);
    let i = false, o = [];
    for (let u of n.options) {
      let l = u._zod.run({ value: a.value, issues: [] }, t);
      if (l instanceof Promise) o.push(l), i = true;
      else o.push(l);
    }
    if (!i) return Lr(o, a, e, t);
    return Promise.all(o).then((u) => {
      return Lr(u, a, e, t);
    });
  };
});
var gs = m("$ZodDiscriminatedUnion", (e, n) => {
  n.inclusive = false, zt.init(e, n);
  let r = e._zod.parse;
  O(e._zod, "propValues", () => {
    let t = {};
    for (let i of n.options) {
      let o = i._zod.propValues;
      if (!o || Object.keys(o).length === 0) throw Error(`Invalid discriminated union option at index "${n.options.indexOf(i)}"`);
      for (let [u, l] of Object.entries(o)) {
        if (!t[u]) t[u] = /* @__PURE__ */ new Set();
        for (let d of l) t[u].add(d);
      }
    }
    return t;
  });
  let a = Me(() => {
    let t = n.options, i = /* @__PURE__ */ new Map();
    for (let o of t) {
      let u = o._zod.propValues?.[n.discriminator];
      if (!u || u.size === 0) throw Error(`Invalid discriminated union option at index "${n.options.indexOf(o)}"`);
      for (let l of u) {
        if (i.has(l)) throw Error(`Duplicate discriminator value "${String(l)}"`);
        i.set(l, o);
      }
    }
    return i;
  });
  e._zod.parse = (t, i) => {
    let o = t.value;
    if (!_e(o)) return t.issues.push({ code: "invalid_type", expected: "object", input: o, inst: e }), t;
    let u = a.value.get(o?.[n.discriminator]);
    if (u) return u._zod.run(t, i);
    if (n.unionFallback || i.direction === "backward") return r(t, i);
    return t.issues.push({ code: "invalid_union", errors: [], note: "No matching discriminator", discriminator: n.discriminator, options: Array.from(a.value.keys()), input: o, path: [n.discriminator], inst: e }), t;
  };
});
var vs = m("$ZodIntersection", (e, n) => {
  I.init(e, n), e._zod.parse = (r, a) => {
    let t = r.value, i = n.left._zod.run({ value: t, issues: [] }, a), o = n.right._zod.run({ value: t, issues: [] }, a);
    if (i instanceof Promise || o instanceof Promise) return Promise.all([i, o]).then(([u, l]) => {
      return Mr(r, u, l);
    });
    return Mr(r, i, o);
  };
});
function wn(e, n) {
  if (e === n) return { valid: true, data: e };
  if (e instanceof Date && n instanceof Date && +e === +n) return { valid: true, data: e };
  if (de(e) && de(n)) {
    let r = Object.keys(n), a = Object.keys(e).filter((i) => r.indexOf(i) !== -1), t = { ...e, ...n };
    for (let i of a) {
      let o = wn(e[i], n[i]);
      if (!o.valid) return { valid: false, mergeErrorPath: [i, ...o.mergeErrorPath] };
      t[i] = o.data;
    }
    return { valid: true, data: t };
  }
  if (Array.isArray(e) && Array.isArray(n)) {
    if (e.length !== n.length) return { valid: false, mergeErrorPath: [] };
    let r = [];
    for (let a = 0; a < e.length; a++) {
      let t = e[a], i = n[a], o = wn(t, i);
      if (!o.valid) return { valid: false, mergeErrorPath: [a, ...o.mergeErrorPath] };
      r.push(o.data);
    }
    return { valid: true, data: r };
  }
  return { valid: false, mergeErrorPath: [] };
}
function Mr(e, n, r) {
  let a = /* @__PURE__ */ new Map(), t;
  for (let u of n.issues) if (u.code === "unrecognized_keys") {
    t ?? (t = u);
    for (let l of u.keys) {
      if (!a.has(l)) a.set(l, {});
      a.get(l).l = true;
    }
  } else e.issues.push(u);
  for (let u of r.issues) if (u.code === "unrecognized_keys") for (let l of u.keys) {
    if (!a.has(l)) a.set(l, {});
    a.get(l).r = true;
  }
  else e.issues.push(u);
  let i = [...a].filter(([, u]) => u.l && u.r).map(([u]) => u);
  if (i.length && t) e.issues.push({ ...t, keys: i });
  if (le(e)) return e;
  let o = wn(n.value, r.value);
  if (!o.valid) throw Error(`Unmergable intersection. Error path: ${JSON.stringify(o.mergeErrorPath)}`);
  return e.value = o.data, e;
}
var Hn = m("$ZodTuple", (e, n) => {
  I.init(e, n);
  let r = n.items;
  e._zod.parse = (a, t) => {
    let i = a.value;
    if (!Array.isArray(i)) return a.issues.push({ input: i, inst: e, expected: "tuple", code: "invalid_type" }), a;
    a.value = [];
    let o = [], u = Br(r, "optin"), l = Br(r, "optout");
    if (!n.rest) {
      if (i.length < u) return a.issues.push({ code: "too_small", minimum: u, inclusive: true, input: i, inst: e, origin: "array" }), a;
      if (i.length > r.length) a.issues.push({ code: "too_big", maximum: r.length, inclusive: true, input: i, inst: e, origin: "array" });
    }
    let d = Array(r.length);
    for (let c = 0; c < r.length; c++) {
      let p = r[c]._zod.run({ value: i[c], issues: [] }, t);
      if (p instanceof Promise) o.push(p.then((f) => {
        d[c] = f;
      }));
      else d[c] = p;
    }
    if (n.rest) {
      let c = r.length - 1, p = i.slice(r.length);
      for (let f of p) {
        c++;
        let $ = n.rest._zod.run({ value: f, issues: [] }, t);
        if ($ instanceof Promise) o.push($.then((x) => Fr(x, a, c)));
        else Fr($, a, c);
      }
    }
    if (o.length) return Promise.all(o).then(() => Jr(d, a, r, i, l));
    return Jr(d, a, r, i, l);
  };
});
function Br(e, n) {
  for (let r = e.length - 1; r >= 0; r--) if (e[r]._zod[n] !== "optional") return r + 1;
  return 0;
}
function Fr(e, n, r) {
  if (e.issues.length) n.issues.push(...J(r, e.issues));
  n.value[r] = e.value;
}
function Jr(e, n, r, a, t) {
  for (let i = 0; i < r.length; i++) {
    let o = e[i], u = i < a.length;
    if (o.issues.length) {
      if (!u && i >= t) {
        n.value.length = i;
        break;
      }
      n.issues.push(...J(i, o.issues));
    }
    n.value[i] = o.value;
  }
  for (let i = n.value.length - 1; i >= a.length; i--) if (r[i]._zod.optout === "optional" && n.value[i] === void 0) n.value.length = i;
  else break;
  return n;
}
var hs = m("$ZodRecord", (e, n) => {
  I.init(e, n), e._zod.parse = (r, a) => {
    let t = r.value;
    if (!de(t)) return r.issues.push({ expected: "record", code: "invalid_type", input: t, inst: e }), r;
    let i = [], o = n.keyType._zod.values;
    if (o) {
      r.value = {};
      let u = /* @__PURE__ */ new Set();
      for (let d of o) if (typeof d === "string" || typeof d === "number" || typeof d === "symbol") {
        u.add(typeof d === "number" ? d.toString() : d);
        let c = n.keyType._zod.run({ value: d, issues: [] }, a);
        if (c instanceof Promise) throw Error("Async schemas not supported in object keys currently");
        if (c.issues.length) {
          r.issues.push({ code: "invalid_key", origin: "record", issues: c.issues.map(($) => L($, a, j())), input: d, path: [d], inst: e });
          continue;
        }
        let p = c.value, f = n.valueType._zod.run({ value: t[d], issues: [] }, a);
        if (f instanceof Promise) i.push(f.then(($) => {
          if ($.issues.length) r.issues.push(...J(d, $.issues));
          r.value[p] = $.value;
        }));
        else {
          if (f.issues.length) r.issues.push(...J(d, f.issues));
          r.value[p] = f.value;
        }
      }
      let l;
      for (let d in t) if (!u.has(d)) l = l ?? [], l.push(d);
      if (l && l.length > 0) r.issues.push({ code: "unrecognized_keys", input: t, inst: e, keys: l });
    } else {
      r.value = {};
      for (let u of Reflect.ownKeys(t)) {
        if (u === "__proto__") continue;
        if (!Object.prototype.propertyIsEnumerable.call(t, u)) continue;
        let l = n.keyType._zod.run({ value: u, issues: [] }, a);
        if (l instanceof Promise) throw Error("Async schemas not supported in object keys currently");
        if (typeof u === "string" && Bn.test(u) && l.issues.length) {
          let c = n.keyType._zod.run({ value: Number(u), issues: [] }, a);
          if (c instanceof Promise) throw Error("Async schemas not supported in object keys currently");
          if (c.issues.length === 0) l = c;
        }
        if (l.issues.length) {
          if (n.mode === "loose") r.value[u] = t[u];
          else r.issues.push({ code: "invalid_key", origin: "record", issues: l.issues.map((c) => L(c, a, j())), input: u, path: [u], inst: e });
          continue;
        }
        let d = n.valueType._zod.run({ value: t[u], issues: [] }, a);
        if (d instanceof Promise) i.push(d.then((c) => {
          if (c.issues.length) r.issues.push(...J(u, c.issues));
          r.value[l.value] = c.value;
        }));
        else {
          if (d.issues.length) r.issues.push(...J(u, d.issues));
          r.value[l.value] = d.value;
        }
      }
    }
    if (i.length) return Promise.all(i).then(() => r);
    return r;
  };
});
var $s = m("$ZodMap", (e, n) => {
  I.init(e, n), e._zod.parse = (r, a) => {
    let t = r.value;
    if (!(t instanceof Map)) return r.issues.push({ expected: "map", code: "invalid_type", input: t, inst: e }), r;
    let i = [];
    r.value = /* @__PURE__ */ new Map();
    for (let [o, u] of t) {
      let l = n.keyType._zod.run({ value: o, issues: [] }, a), d = n.valueType._zod.run({ value: u, issues: [] }, a);
      if (l instanceof Promise || d instanceof Promise) i.push(Promise.all([l, d]).then(([c, p]) => {
        Gr(c, p, r, o, t, e, a);
      }));
      else Gr(l, d, r, o, t, e, a);
    }
    if (i.length) return Promise.all(i).then(() => r);
    return r;
  };
});
function Gr(e, n, r, a, t, i, o) {
  if (e.issues.length) if (bt.has(typeof a)) r.issues.push(...J(a, e.issues));
  else r.issues.push({ code: "invalid_key", origin: "map", input: t, inst: i, issues: e.issues.map((u) => L(u, o, j())) });
  if (n.issues.length) if (bt.has(typeof a)) r.issues.push(...J(a, n.issues));
  else r.issues.push({ origin: "map", code: "invalid_element", input: t, inst: i, key: a, issues: n.issues.map((u) => L(u, o, j())) });
  r.value.set(e.value, n.value);
}
var ys = m("$ZodSet", (e, n) => {
  I.init(e, n), e._zod.parse = (r, a) => {
    let t = r.value;
    if (!(t instanceof Set)) return r.issues.push({ input: t, inst: e, expected: "set", code: "invalid_type" }), r;
    let i = [];
    r.value = /* @__PURE__ */ new Set();
    for (let o of t) {
      let u = n.valueType._zod.run({ value: o, issues: [] }, a);
      if (u instanceof Promise) i.push(u.then((l) => Wr(l, r)));
      else Wr(u, r);
    }
    if (i.length) return Promise.all(i).then(() => r);
    return r;
  };
});
function Wr(e, n) {
  if (e.issues.length) n.issues.push(...e.issues);
  n.value.add(e.value);
}
var bs = m("$ZodEnum", (e, n) => {
  I.init(e, n);
  let r = On(n.entries), a = new Set(r);
  e._zod.values = a, e._zod.pattern = new RegExp(`^(${r.filter((t) => bt.has(typeof t)).map((t) => typeof t === "string" ? Y(t) : t.toString()).join("|")})$`), e._zod.parse = (t, i) => {
    let o = t.value;
    if (a.has(o)) return t;
    return t.issues.push({ code: "invalid_value", values: r, input: o, inst: e }), t;
  };
});
var _s = m("$ZodLiteral", (e, n) => {
  if (I.init(e, n), n.values.length === 0) throw Error("Cannot create literal schema with no valid values");
  let r = new Set(n.values);
  e._zod.values = r, e._zod.pattern = new RegExp(`^(${n.values.map((a) => typeof a === "string" ? Y(a) : a ? Y(a.toString()) : String(a)).join("|")})$`), e._zod.parse = (a, t) => {
    let i = a.value;
    if (r.has(i)) return a;
    return a.issues.push({ code: "invalid_value", values: n.values, input: i, inst: e }), a;
  };
});
var ks = m("$ZodFile", (e, n) => {
  I.init(e, n), e._zod.parse = (r, a) => {
    let t = r.value;
    if (t instanceof File) return r;
    return r.issues.push({ expected: "file", code: "invalid_type", input: t, inst: e }), r;
  };
});
var Is = m("$ZodTransform", (e, n) => {
  I.init(e, n), e._zod.optin = "optional", e._zod.parse = (r, a) => {
    if (a.direction === "backward") throw new Le(e.constructor.name);
    let t = n.transform(r.value, r);
    if (a.async) return (t instanceof Promise ? t : Promise.resolve(t)).then((i) => {
      return r.value = i, r.fallback = true, r;
    });
    if (t instanceof Promise) throw new ne();
    return r.value = t, r.fallback = true, r;
  };
});
function Vr(e, n) {
  if (n === void 0 && (e.issues.length || e.fallback)) return { issues: [], value: void 0 };
  return e;
}
var Xn = m("$ZodOptional", (e, n) => {
  I.init(e, n), e._zod.optin = "optional", e._zod.optout = "optional", O(e._zod, "values", () => {
    return n.innerType._zod.values ? /* @__PURE__ */ new Set([...n.innerType._zod.values, void 0]) : void 0;
  }), O(e._zod, "pattern", () => {
    let r = n.innerType._zod.pattern;
    return r ? new RegExp(`^(${Ot(r.source)})?$`) : void 0;
  }), e._zod.parse = (r, a) => {
    if (n.innerType._zod.optin === "optional") {
      let t = r.value, i = n.innerType._zod.run(r, a);
      if (i instanceof Promise) return i.then((o) => Vr(o, t));
      return Vr(i, t);
    }
    if (r.value === void 0) return r;
    return n.innerType._zod.run(r, a);
  };
});
var ws = m("$ZodExactOptional", (e, n) => {
  Xn.init(e, n), O(e._zod, "values", () => n.innerType._zod.values), O(e._zod, "pattern", () => n.innerType._zod.pattern), e._zod.parse = (r, a) => {
    return n.innerType._zod.run(r, a);
  };
});
var Ss = m("$ZodNullable", (e, n) => {
  I.init(e, n), O(e._zod, "optin", () => n.innerType._zod.optin), O(e._zod, "optout", () => n.innerType._zod.optout), O(e._zod, "pattern", () => {
    let r = n.innerType._zod.pattern;
    return r ? new RegExp(`^(${Ot(r.source)}|null)$`) : void 0;
  }), O(e._zod, "values", () => {
    return n.innerType._zod.values ? /* @__PURE__ */ new Set([...n.innerType._zod.values, null]) : void 0;
  }), e._zod.parse = (r, a) => {
    if (r.value === null) return r;
    return n.innerType._zod.run(r, a);
  };
});
var xs = m("$ZodDefault", (e, n) => {
  I.init(e, n), e._zod.optin = "optional", O(e._zod, "values", () => n.innerType._zod.values), e._zod.parse = (r, a) => {
    if (a.direction === "backward") return n.innerType._zod.run(r, a);
    if (r.value === void 0) return r.value = n.defaultValue, r;
    let t = n.innerType._zod.run(r, a);
    if (t instanceof Promise) return t.then((i) => Kr(i, n));
    return Kr(t, n);
  };
});
function Kr(e, n) {
  if (e.value === void 0) e.value = n.defaultValue;
  return e;
}
var Es = m("$ZodPrefault", (e, n) => {
  I.init(e, n), e._zod.optin = "optional", O(e._zod, "values", () => n.innerType._zod.values), e._zod.parse = (r, a) => {
    if (a.direction === "backward") return n.innerType._zod.run(r, a);
    if (r.value === void 0) r.value = n.defaultValue;
    return n.innerType._zod.run(r, a);
  };
});
var Os = m("$ZodNonOptional", (e, n) => {
  I.init(e, n), O(e._zod, "values", () => {
    let r = n.innerType._zod.values;
    return r ? new Set([...r].filter((a) => a !== void 0)) : void 0;
  }), e._zod.parse = (r, a) => {
    let t = n.innerType._zod.run(r, a);
    if (t instanceof Promise) return t.then((i) => qr(i, e));
    return qr(t, e);
  };
});
function qr(e, n) {
  if (!e.issues.length && e.value === void 0) e.issues.push({ code: "invalid_type", expected: "nonoptional", input: e.value, inst: n });
  return e;
}
var Ts = m("$ZodSuccess", (e, n) => {
  I.init(e, n), e._zod.parse = (r, a) => {
    if (a.direction === "backward") throw new Le("ZodSuccess");
    let t = n.innerType._zod.run(r, a);
    if (t instanceof Promise) return t.then((i) => {
      return r.value = i.issues.length === 0, r;
    });
    return r.value = t.issues.length === 0, r;
  };
});
var Ns = m("$ZodCatch", (e, n) => {
  I.init(e, n), e._zod.optin = "optional", O(e._zod, "optout", () => n.innerType._zod.optout), O(e._zod, "values", () => n.innerType._zod.values), e._zod.parse = (r, a) => {
    if (a.direction === "backward") return n.innerType._zod.run(r, a);
    let t = n.innerType._zod.run(r, a);
    if (t instanceof Promise) return t.then((i) => {
      if (r.value = i.value, i.issues.length) r.value = n.catchValue({ ...r, error: { issues: i.issues.map((o) => L(o, a, j())) }, input: r.value }), r.issues = [], r.fallback = true;
      return r;
    });
    if (r.value = t.value, t.issues.length) r.value = n.catchValue({ ...r, error: { issues: t.issues.map((i) => L(i, a, j())) }, input: r.value }), r.issues = [], r.fallback = true;
    return r;
  };
});
var zs = m("$ZodNaN", (e, n) => {
  I.init(e, n), e._zod.parse = (r, a) => {
    if (typeof r.value !== "number" || !Number.isNaN(r.value)) return r.issues.push({ input: r.value, inst: e, expected: "nan", code: "invalid_type" }), r;
    return r;
  };
});
var Yn = m("$ZodPipe", (e, n) => {
  I.init(e, n), O(e._zod, "values", () => n.in._zod.values), O(e._zod, "optin", () => n.in._zod.optin), O(e._zod, "optout", () => n.out._zod.optout), O(e._zod, "propValues", () => n.in._zod.propValues), e._zod.parse = (r, a) => {
    if (a.direction === "backward") {
      let i = n.out._zod.run(r, a);
      if (i instanceof Promise) return i.then((o) => vt(o, n.in, a));
      return vt(i, n.in, a);
    }
    let t = n.in._zod.run(r, a);
    if (t instanceof Promise) return t.then((i) => vt(i, n.out, a));
    return vt(t, n.out, a);
  };
});
function vt(e, n, r) {
  if (e.issues.length) return e.aborted = true, e;
  return n._zod.run({ value: e.value, issues: e.issues, fallback: e.fallback }, r);
}
var Qn = m("$ZodCodec", (e, n) => {
  I.init(e, n), O(e._zod, "values", () => n.in._zod.values), O(e._zod, "optin", () => n.in._zod.optin), O(e._zod, "optout", () => n.out._zod.optout), O(e._zod, "propValues", () => n.in._zod.propValues), e._zod.parse = (r, a) => {
    if ((a.direction || "forward") === "forward") {
      let t = n.in._zod.run(r, a);
      if (t instanceof Promise) return t.then((i) => ht(i, n, a));
      return ht(t, n, a);
    } else {
      let t = n.out._zod.run(r, a);
      if (t instanceof Promise) return t.then((i) => ht(i, n, a));
      return ht(t, n, a);
    }
  };
});
function ht(e, n, r) {
  if (e.issues.length) return e.aborted = true, e;
  if ((r.direction || "forward") === "forward") {
    let a = n.transform(e.value, e);
    if (a instanceof Promise) return a.then((t) => $t(e, t, n.out, r));
    return $t(e, a, n.out, r);
  } else {
    let a = n.reverseTransform(e.value, e);
    if (a instanceof Promise) return a.then((t) => $t(e, t, n.in, r));
    return $t(e, a, n.in, r);
  }
}
function $t(e, n, r, a) {
  if (e.issues.length) return e.aborted = true, e;
  return r._zod.run({ value: n, issues: e.issues }, a);
}
var Us = m("$ZodPreprocess", (e, n) => {
  Yn.init(e, n);
});
var As = m("$ZodReadonly", (e, n) => {
  I.init(e, n), O(e._zod, "propValues", () => n.innerType._zod.propValues), O(e._zod, "values", () => n.innerType._zod.values), O(e._zod, "optin", () => n.innerType?._zod?.optin), O(e._zod, "optout", () => n.innerType?._zod?.optout), e._zod.parse = (r, a) => {
    if (a.direction === "backward") return n.innerType._zod.run(r, a);
    let t = n.innerType._zod.run(r, a);
    if (t instanceof Promise) return t.then(Hr);
    return Hr(t);
  };
});
function Hr(e) {
  return e.value = Object.freeze(e.value), e;
}
var Ds = m("$ZodTemplateLiteral", (e, n) => {
  I.init(e, n);
  let r = [];
  for (let a of n.parts) if (typeof a === "object" && a !== null) {
    if (!a._zod.pattern) throw Error(`Invalid template literal part, no pattern found: ${[...a._zod.traits].shift()}`);
    let t = a._zod.pattern instanceof RegExp ? a._zod.pattern.source : a._zod.pattern;
    if (!t) throw Error(`Invalid template literal part: ${a._zod.traits}`);
    let i = t.startsWith("^") ? 1 : 0, o = t.endsWith("$") ? t.length - 1 : t.length;
    r.push(t.slice(i, o));
  } else if (a === null || fa.has(typeof a)) r.push(Y(`${a}`));
  else throw Error(`Invalid template literal part: ${a}`);
  e._zod.pattern = new RegExp(`^${r.join("")}$`), e._zod.parse = (a, t) => {
    if (typeof a.value !== "string") return a.issues.push({ input: a.value, inst: e, expected: "string", code: "invalid_type" }), a;
    if (e._zod.pattern.lastIndex = 0, !e._zod.pattern.test(a.value)) return a.issues.push({ input: a.value, inst: e, code: "invalid_format", format: n.format ?? "template_literal", pattern: e._zod.pattern.source }), a;
    return a;
  };
});
var Ps = m("$ZodFunction", (e, n) => {
  return I.init(e, n), e._def = n, e._zod.def = n, e.implement = (r) => {
    if (typeof r !== "function") throw Error("implement() must be called with a function");
    return function(...a) {
      let t = e._def.input ? kn(e._def.input, a) : a, i = Reflect.apply(r, this, t);
      if (e._def.output) return kn(e._def.output, i);
      return i;
    };
  }, e.implementAsync = (r) => {
    if (typeof r !== "function") throw Error("implementAsync() must be called with a function");
    return async function(...a) {
      let t = e._def.input ? await In(e._def.input, a) : a, i = await Reflect.apply(r, this, t);
      if (e._def.output) return await In(e._def.output, i);
      return i;
    };
  }, e._zod.parse = (r, a) => {
    if (typeof r.value !== "function") return r.issues.push({ code: "invalid_type", expected: "function", input: r.value, inst: e }), r;
    if (e._def.output && e._def.output._zod.def.type === "promise") r.value = e.implementAsync(r.value);
    else r.value = e.implement(r.value);
    return r;
  }, e.input = (...r) => {
    let a = e.constructor;
    if (Array.isArray(r[0])) return new a({ type: "function", input: new Hn({ type: "tuple", items: r[0], rest: r[1] }), output: e._def.output });
    return new a({ type: "function", input: r[0], output: e._def.output });
  }, e.output = (r) => {
    return new e.constructor({ type: "function", input: e._def.input, output: r });
  }, e;
});
var js = m("$ZodPromise", (e, n) => {
  I.init(e, n), e._zod.parse = (r, a) => {
    return Promise.resolve(r.value).then((t) => n.innerType._zod.run({ value: t, issues: [] }, a));
  };
});
var Cs = m("$ZodLazy", (e, n) => {
  I.init(e, n), O(e._zod, "innerType", () => {
    let r = n;
    if (!r._cachedInner) r._cachedInner = n.getter();
    return r._cachedInner;
  }), O(e._zod, "pattern", () => e._zod.innerType?._zod?.pattern), O(e._zod, "propValues", () => e._zod.innerType?._zod?.propValues), O(e._zod, "optin", () => e._zod.innerType?._zod?.optin ?? void 0), O(e._zod, "optout", () => e._zod.innerType?._zod?.optout ?? void 0), e._zod.parse = (r, a) => {
    return e._zod.innerType._zod.run(r, a);
  };
});
var Rs = m("$ZodCustom", (e, n) => {
  D.init(e, n), I.init(e, n), e._zod.parse = (r, a) => {
    return r;
  }, e._zod.check = (r) => {
    let a = r.value, t = n.fn(a);
    if (t instanceof Promise) return t.then((i) => Xr(i, r, a, e));
    Xr(t, r, a, e);
    return;
  };
});
function Xr(e, n, r, a) {
  if (!e) {
    let t = { code: "custom", input: r, inst: a, path: [...a._zod.def.path ?? []], continue: !a._zod.def.abort };
    if (a._zod.def.params) t.params = a._zod.def.params;
    n.issues.push(_t(t));
  }
}
var ei = {};
Q(ei, { zhTW: () => gp, zhCN: () => fp, yo: () => hp, vi: () => cp, uz: () => lp, ur: () => sp, uk: () => Ms, ua: () => ap, tr: () => ip, th: () => tp, ta: () => Qf, sv: () => Xf, sl: () => qf, ru: () => Vf, ro: () => Gf, pt: () => Ff, ps: () => Zf, pl: () => Mf, ota: () => Cf, no: () => Pf, nl: () => Af, ms: () => zf, mk: () => Tf, lt: () => Ef, ko: () => Sf, km: () => Ls, kh: () => If, ka: () => _f, ja: () => yf, it: () => hf, is: () => gf, id: () => ff, hy: () => cf, hu: () => lf, hr: () => sf, he: () => af, frCA: () => nf, fr: () => ef, fi: () => Ym, fa: () => Hm, es: () => Km, eo: () => Wm, en: () => Zs, el: () => Fm, de: () => Mm, da: () => Zm, cs: () => Cm, ca: () => Pm, bg: () => Am, be: () => zm, az: () => Tm, ar: () => Em });
var xm = () => {
  let e = { string: { unit: "\u062D\u0631\u0641", verb: "\u0623\u0646 \u064A\u062D\u0648\u064A" }, file: { unit: "\u0628\u0627\u064A\u062A", verb: "\u0623\u0646 \u064A\u062D\u0648\u064A" }, array: { unit: "\u0639\u0646\u0635\u0631", verb: "\u0623\u0646 \u064A\u062D\u0648\u064A" }, set: { unit: "\u0639\u0646\u0635\u0631", verb: "\u0623\u0646 \u064A\u062D\u0648\u064A" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "\u0645\u062F\u062E\u0644", email: "\u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A", url: "\u0631\u0627\u0628\u0637", emoji: "\u0625\u064A\u0645\u0648\u062C\u064A", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "\u062A\u0627\u0631\u064A\u062E \u0648\u0648\u0642\u062A \u0628\u0645\u0639\u064A\u0627\u0631 ISO", date: "\u062A\u0627\u0631\u064A\u062E \u0628\u0645\u0639\u064A\u0627\u0631 ISO", time: "\u0648\u0642\u062A \u0628\u0645\u0639\u064A\u0627\u0631 ISO", duration: "\u0645\u062F\u0629 \u0628\u0645\u0639\u064A\u0627\u0631 ISO", ipv4: "\u0639\u0646\u0648\u0627\u0646 IPv4", ipv6: "\u0639\u0646\u0648\u0627\u0646 IPv6", cidrv4: "\u0645\u062F\u0649 \u0639\u0646\u0627\u0648\u064A\u0646 \u0628\u0635\u064A\u063A\u0629 IPv4", cidrv6: "\u0645\u062F\u0649 \u0639\u0646\u0627\u0648\u064A\u0646 \u0628\u0635\u064A\u063A\u0629 IPv6", base64: "\u0646\u064E\u0635 \u0628\u062A\u0631\u0645\u064A\u0632 base64-encoded", base64url: "\u0646\u064E\u0635 \u0628\u062A\u0631\u0645\u064A\u0632 base64url-encoded", json_string: "\u0646\u064E\u0635 \u0639\u0644\u0649 \u0647\u064A\u0626\u0629 JSON", e164: "\u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0628\u0645\u0639\u064A\u0627\u0631 E.164", jwt: "JWT", template_literal: "\u0645\u062F\u062E\u0644" }, a = { nan: "NaN" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `\u0645\u062F\u062E\u0644\u0627\u062A \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644\u0629: \u064A\u0641\u062A\u0631\u0636 \u0625\u062F\u062E\u0627\u0644 instanceof ${t.expected}\u060C \u0648\u0644\u0643\u0646 \u062A\u0645 \u0625\u062F\u062E\u0627\u0644 ${u}`;
        return `\u0645\u062F\u062E\u0644\u0627\u062A \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644\u0629: \u064A\u0641\u062A\u0631\u0636 \u0625\u062F\u062E\u0627\u0644 ${i}\u060C \u0648\u0644\u0643\u0646 \u062A\u0645 \u0625\u062F\u062E\u0627\u0644 ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `\u0645\u062F\u062E\u0644\u0627\u062A \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644\u0629: \u064A\u0641\u062A\u0631\u0636 \u0625\u062F\u062E\u0627\u0644 ${b(t.values[0])}`;
        return `\u0627\u062E\u062A\u064A\u0627\u0631 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062A\u0648\u0642\u0639 \u0627\u0646\u062A\u0642\u0627\u0621 \u0623\u062D\u062F \u0647\u0630\u0647 \u0627\u0644\u062E\u064A\u0627\u0631\u0627\u062A: ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return ` \u0623\u0643\u0628\u0631 \u0645\u0646 \u0627\u0644\u0644\u0627\u0632\u0645: \u064A\u0641\u062A\u0631\u0636 \u0623\u0646 \u062A\u0643\u0648\u0646 ${t.origin ?? "\u0627\u0644\u0642\u064A\u0645\u0629"} ${i} ${t.maximum.toString()} ${o.unit ?? "\u0639\u0646\u0635\u0631"}`;
        return `\u0623\u0643\u0628\u0631 \u0645\u0646 \u0627\u0644\u0644\u0627\u0632\u0645: \u064A\u0641\u062A\u0631\u0636 \u0623\u0646 \u062A\u0643\u0648\u0646 ${t.origin ?? "\u0627\u0644\u0642\u064A\u0645\u0629"} ${i} ${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `\u0623\u0635\u063A\u0631 \u0645\u0646 \u0627\u0644\u0644\u0627\u0632\u0645: \u064A\u0641\u062A\u0631\u0636 \u0644\u0640 ${t.origin} \u0623\u0646 \u064A\u0643\u0648\u0646 ${i} ${t.minimum.toString()} ${o.unit}`;
        return `\u0623\u0635\u063A\u0631 \u0645\u0646 \u0627\u0644\u0644\u0627\u0632\u0645: \u064A\u0641\u062A\u0631\u0636 \u0644\u0640 ${t.origin} \u0623\u0646 \u064A\u0643\u0648\u0646 ${i} ${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `\u0646\u064E\u0635 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062C\u0628 \u0623\u0646 \u064A\u0628\u062F\u0623 \u0628\u0640 "${t.prefix}"`;
        if (i.format === "ends_with") return `\u0646\u064E\u0635 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062C\u0628 \u0623\u0646 \u064A\u0646\u062A\u0647\u064A \u0628\u0640 "${i.suffix}"`;
        if (i.format === "includes") return `\u0646\u064E\u0635 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062C\u0628 \u0623\u0646 \u064A\u062A\u0636\u0645\u0651\u064E\u0646 "${i.includes}"`;
        if (i.format === "regex") return `\u0646\u064E\u0635 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062C\u0628 \u0623\u0646 \u064A\u0637\u0627\u0628\u0642 \u0627\u0644\u0646\u0645\u0637 ${i.pattern}`;
        return `${r[i.format] ?? t.format} \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644`;
      }
      case "not_multiple_of":
        return `\u0631\u0642\u0645 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0645\u0646 \u0645\u0636\u0627\u0639\u0641\u0627\u062A ${t.divisor}`;
      case "unrecognized_keys":
        return `\u0645\u0639\u0631\u0641${t.keys.length > 1 ? "\u0627\u062A" : ""} \u063A\u0631\u064A\u0628${t.keys.length > 1 ? "\u0629" : ""}: ${g(t.keys, "\u060C ")}`;
      case "invalid_key":
        return `\u0645\u0639\u0631\u0641 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644 \u0641\u064A ${t.origin}`;
      case "invalid_union":
        return "\u0645\u062F\u062E\u0644 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644";
      case "invalid_element":
        return `\u0645\u062F\u062E\u0644 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644 \u0641\u064A ${t.origin}`;
      default:
        return "\u0645\u062F\u062E\u0644 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644";
    }
  };
};
function Em() {
  return { localeError: xm() };
}
var Om = () => {
  let e = { string: { unit: "simvol", verb: "olmal\u0131d\u0131r" }, file: { unit: "bayt", verb: "olmal\u0131d\u0131r" }, array: { unit: "element", verb: "olmal\u0131d\u0131r" }, set: { unit: "element", verb: "olmal\u0131d\u0131r" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "input", email: "email address", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO datetime", date: "ISO date", time: "ISO time", duration: "ISO duration", ipv4: "IPv4 address", ipv6: "IPv6 address", cidrv4: "IPv4 range", cidrv6: "IPv6 range", base64: "base64-encoded string", base64url: "base64url-encoded string", json_string: "JSON string", e164: "E.164 number", jwt: "JWT", template_literal: "input" }, a = { nan: "NaN" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Yanl\u0131\u015F d\u0259y\u0259r: g\xF6zl\u0259nil\u0259n instanceof ${t.expected}, daxil olan ${u}`;
        return `Yanl\u0131\u015F d\u0259y\u0259r: g\xF6zl\u0259nil\u0259n ${i}, daxil olan ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Yanl\u0131\u015F d\u0259y\u0259r: g\xF6zl\u0259nil\u0259n ${b(t.values[0])}`;
        return `Yanl\u0131\u015F se\xE7im: a\u015Fa\u011F\u0131dak\u0131lardan biri olmal\u0131d\u0131r: ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `\xC7ox b\xF6y\xFCk: g\xF6zl\u0259nil\u0259n ${t.origin ?? "d\u0259y\u0259r"} ${i}${t.maximum.toString()} ${o.unit ?? "element"}`;
        return `\xC7ox b\xF6y\xFCk: g\xF6zl\u0259nil\u0259n ${t.origin ?? "d\u0259y\u0259r"} ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `\xC7ox ki\xE7ik: g\xF6zl\u0259nil\u0259n ${t.origin} ${i}${t.minimum.toString()} ${o.unit}`;
        return `\xC7ox ki\xE7ik: g\xF6zl\u0259nil\u0259n ${t.origin} ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `Yanl\u0131\u015F m\u0259tn: "${i.prefix}" il\u0259 ba\u015Flamal\u0131d\u0131r`;
        if (i.format === "ends_with") return `Yanl\u0131\u015F m\u0259tn: "${i.suffix}" il\u0259 bitm\u0259lidir`;
        if (i.format === "includes") return `Yanl\u0131\u015F m\u0259tn: "${i.includes}" daxil olmal\u0131d\u0131r`;
        if (i.format === "regex") return `Yanl\u0131\u015F m\u0259tn: ${i.pattern} \u015Fablonuna uy\u011Fun olmal\u0131d\u0131r`;
        return `Yanl\u0131\u015F ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `Yanl\u0131\u015F \u0259d\u0259d: ${t.divisor} il\u0259 b\xF6l\xFCn\u0259 bil\u0259n olmal\u0131d\u0131r`;
      case "unrecognized_keys":
        return `Tan\u0131nmayan a\xE7ar${t.keys.length > 1 ? "lar" : ""}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `${t.origin} daxilind\u0259 yanl\u0131\u015F a\xE7ar`;
      case "invalid_union":
        return "Yanl\u0131\u015F d\u0259y\u0259r";
      case "invalid_element":
        return `${t.origin} daxilind\u0259 yanl\u0131\u015F d\u0259y\u0259r`;
      default:
        return "Yanl\u0131\u015F d\u0259y\u0259r";
    }
  };
};
function Tm() {
  return { localeError: Om() };
}
function Yr(e, n, r, a) {
  let t = Math.abs(e), i = t % 10, o = t % 100;
  if (o >= 11 && o <= 19) return a;
  if (i === 1) return n;
  if (i >= 2 && i <= 4) return r;
  return a;
}
var Nm = () => {
  let e = { string: { unit: { one: "\u0441\u0456\u043C\u0432\u0430\u043B", few: "\u0441\u0456\u043C\u0432\u0430\u043B\u044B", many: "\u0441\u0456\u043C\u0432\u0430\u043B\u0430\u045E" }, verb: "\u043C\u0435\u0446\u044C" }, array: { unit: { one: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442", few: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u044B", many: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430\u045E" }, verb: "\u043C\u0435\u0446\u044C" }, set: { unit: { one: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442", few: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u044B", many: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430\u045E" }, verb: "\u043C\u0435\u0446\u044C" }, file: { unit: { one: "\u0431\u0430\u0439\u0442", few: "\u0431\u0430\u0439\u0442\u044B", many: "\u0431\u0430\u0439\u0442\u0430\u045E" }, verb: "\u043C\u0435\u0446\u044C" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "\u0443\u0432\u043E\u0434", email: "email \u0430\u0434\u0440\u0430\u0441", url: "URL", emoji: "\u044D\u043C\u043E\u0434\u0437\u0456", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO \u0434\u0430\u0442\u0430 \u0456 \u0447\u0430\u0441", date: "ISO \u0434\u0430\u0442\u0430", time: "ISO \u0447\u0430\u0441", duration: "ISO \u043F\u0440\u0430\u0446\u044F\u0433\u043B\u0430\u0441\u0446\u044C", ipv4: "IPv4 \u0430\u0434\u0440\u0430\u0441", ipv6: "IPv6 \u0430\u0434\u0440\u0430\u0441", cidrv4: "IPv4 \u0434\u044B\u044F\u043F\u0430\u0437\u043E\u043D", cidrv6: "IPv6 \u0434\u044B\u044F\u043F\u0430\u0437\u043E\u043D", base64: "\u0440\u0430\u0434\u043E\u043A \u0443 \u0444\u0430\u0440\u043C\u0430\u0446\u0435 base64", base64url: "\u0440\u0430\u0434\u043E\u043A \u0443 \u0444\u0430\u0440\u043C\u0430\u0446\u0435 base64url", json_string: "JSON \u0440\u0430\u0434\u043E\u043A", e164: "\u043D\u0443\u043C\u0430\u0440 E.164", jwt: "JWT", template_literal: "\u0443\u0432\u043E\u0434" }, a = { nan: "NaN", number: "\u043B\u0456\u043A", array: "\u043C\u0430\u0441\u0456\u045E" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u045E\u0432\u043E\u0434: \u0447\u0430\u043A\u0430\u045E\u0441\u044F instanceof ${t.expected}, \u0430\u0442\u0440\u044B\u043C\u0430\u043D\u0430 ${u}`;
        return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u045E\u0432\u043E\u0434: \u0447\u0430\u043A\u0430\u045E\u0441\u044F ${i}, \u0430\u0442\u0440\u044B\u043C\u0430\u043D\u0430 ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u045E\u0432\u043E\u0434: \u0447\u0430\u043A\u0430\u043B\u0430\u0441\u044F ${b(t.values[0])}`;
        return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u0432\u0430\u0440\u044B\u044F\u043D\u0442: \u0447\u0430\u043A\u0430\u045E\u0441\u044F \u0430\u0434\u0437\u0456\u043D \u0437 ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) {
          let u = Number(t.maximum), l = Yr(u, o.unit.one, o.unit.few, o.unit.many);
          return `\u0417\u0430\u043D\u0430\u0434\u0442\u0430 \u0432\u044F\u043B\u0456\u043A\u0456: \u0447\u0430\u043A\u0430\u043B\u0430\u0441\u044F, \u0448\u0442\u043E ${t.origin ?? "\u0437\u043D\u0430\u0447\u044D\u043D\u043D\u0435"} \u043F\u0430\u0432\u0456\u043D\u043D\u0430 ${o.verb} ${i}${t.maximum.toString()} ${l}`;
        }
        return `\u0417\u0430\u043D\u0430\u0434\u0442\u0430 \u0432\u044F\u043B\u0456\u043A\u0456: \u0447\u0430\u043A\u0430\u043B\u0430\u0441\u044F, \u0448\u0442\u043E ${t.origin ?? "\u0437\u043D\u0430\u0447\u044D\u043D\u043D\u0435"} \u043F\u0430\u0432\u0456\u043D\u043D\u0430 \u0431\u044B\u0446\u044C ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) {
          let u = Number(t.minimum), l = Yr(u, o.unit.one, o.unit.few, o.unit.many);
          return `\u0417\u0430\u043D\u0430\u0434\u0442\u0430 \u043C\u0430\u043B\u044B: \u0447\u0430\u043A\u0430\u043B\u0430\u0441\u044F, \u0448\u0442\u043E ${t.origin} \u043F\u0430\u0432\u0456\u043D\u043D\u0430 ${o.verb} ${i}${t.minimum.toString()} ${l}`;
        }
        return `\u0417\u0430\u043D\u0430\u0434\u0442\u0430 \u043C\u0430\u043B\u044B: \u0447\u0430\u043A\u0430\u043B\u0430\u0441\u044F, \u0448\u0442\u043E ${t.origin} \u043F\u0430\u0432\u0456\u043D\u043D\u0430 \u0431\u044B\u0446\u044C ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u0440\u0430\u0434\u043E\u043A: \u043F\u0430\u0432\u0456\u043D\u0435\u043D \u043F\u0430\u0447\u044B\u043D\u0430\u0446\u0446\u0430 \u0437 "${i.prefix}"`;
        if (i.format === "ends_with") return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u0440\u0430\u0434\u043E\u043A: \u043F\u0430\u0432\u0456\u043D\u0435\u043D \u0437\u0430\u043A\u0430\u043D\u0447\u0432\u0430\u0446\u0446\u0430 \u043D\u0430 "${i.suffix}"`;
        if (i.format === "includes") return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u0440\u0430\u0434\u043E\u043A: \u043F\u0430\u0432\u0456\u043D\u0435\u043D \u0437\u043C\u044F\u0448\u0447\u0430\u0446\u044C "${i.includes}"`;
        if (i.format === "regex") return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u0440\u0430\u0434\u043E\u043A: \u043F\u0430\u0432\u0456\u043D\u0435\u043D \u0430\u0434\u043F\u0430\u0432\u044F\u0434\u0430\u0446\u044C \u0448\u0430\u0431\u043B\u043E\u043D\u0443 ${i.pattern}`;
        return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u043B\u0456\u043A: \u043F\u0430\u0432\u0456\u043D\u0435\u043D \u0431\u044B\u0446\u044C \u043A\u0440\u0430\u0442\u043D\u044B\u043C ${t.divisor}`;
      case "unrecognized_keys":
        return `\u041D\u0435\u0440\u0430\u0441\u043F\u0430\u0437\u043D\u0430\u043D\u044B ${t.keys.length > 1 ? "\u043A\u043B\u044E\u0447\u044B" : "\u043A\u043B\u044E\u0447"}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u043A\u043B\u044E\u0447 \u0443 ${t.origin}`;
      case "invalid_union":
        return "\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u045E\u0432\u043E\u0434";
      case "invalid_element":
        return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u0430\u0435 \u0437\u043D\u0430\u0447\u044D\u043D\u043D\u0435 \u045E ${t.origin}`;
      default:
        return "\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u045E\u0432\u043E\u0434";
    }
  };
};
function zm() {
  return { localeError: Nm() };
}
var Um = () => {
  let e = { string: { unit: "\u0441\u0438\u043C\u0432\u043E\u043B\u0430", verb: "\u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430" }, file: { unit: "\u0431\u0430\u0439\u0442\u0430", verb: "\u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430" }, array: { unit: "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0430", verb: "\u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430" }, set: { unit: "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0430", verb: "\u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "\u0432\u0445\u043E\u0434", email: "\u0438\u043C\u0435\u0439\u043B \u0430\u0434\u0440\u0435\u0441", url: "URL", emoji: "\u0435\u043C\u043E\u0434\u0436\u0438", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO \u0432\u0440\u0435\u043C\u0435", date: "ISO \u0434\u0430\u0442\u0430", time: "ISO \u0432\u0440\u0435\u043C\u0435", duration: "ISO \u043F\u0440\u043E\u0434\u044A\u043B\u0436\u0438\u0442\u0435\u043B\u043D\u043E\u0441\u0442", ipv4: "IPv4 \u0430\u0434\u0440\u0435\u0441", ipv6: "IPv6 \u0430\u0434\u0440\u0435\u0441", cidrv4: "IPv4 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D", cidrv6: "IPv6 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D", base64: "base64-\u043A\u043E\u0434\u0438\u0440\u0430\u043D \u043D\u0438\u0437", base64url: "base64url-\u043A\u043E\u0434\u0438\u0440\u0430\u043D \u043D\u0438\u0437", json_string: "JSON \u043D\u0438\u0437", e164: "E.164 \u043D\u043E\u043C\u0435\u0440", jwt: "JWT", template_literal: "\u0432\u0445\u043E\u0434" }, a = { nan: "NaN", number: "\u0447\u0438\u0441\u043B\u043E", array: "\u043C\u0430\u0441\u0438\u0432" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u0432\u0445\u043E\u0434: \u043E\u0447\u0430\u043A\u0432\u0430\u043D instanceof ${t.expected}, \u043F\u043E\u043B\u0443\u0447\u0435\u043D ${u}`;
        return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u0432\u0445\u043E\u0434: \u043E\u0447\u0430\u043A\u0432\u0430\u043D ${i}, \u043F\u043E\u043B\u0443\u0447\u0435\u043D ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u0432\u0445\u043E\u0434: \u043E\u0447\u0430\u043A\u0432\u0430\u043D ${b(t.values[0])}`;
        return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u0430 \u043E\u043F\u0446\u0438\u044F: \u043E\u0447\u0430\u043A\u0432\u0430\u043D\u043E \u0435\u0434\u043D\u043E \u043E\u0442 ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `\u0422\u0432\u044A\u0440\u0434\u0435 \u0433\u043E\u043B\u044F\u043C\u043E: \u043E\u0447\u0430\u043A\u0432\u0430 \u0441\u0435 ${t.origin ?? "\u0441\u0442\u043E\u0439\u043D\u043E\u0441\u0442"} \u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430 ${i}${t.maximum.toString()} ${o.unit ?? "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0430"}`;
        return `\u0422\u0432\u044A\u0440\u0434\u0435 \u0433\u043E\u043B\u044F\u043C\u043E: \u043E\u0447\u0430\u043A\u0432\u0430 \u0441\u0435 ${t.origin ?? "\u0441\u0442\u043E\u0439\u043D\u043E\u0441\u0442"} \u0434\u0430 \u0431\u044A\u0434\u0435 ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `\u0422\u0432\u044A\u0440\u0434\u0435 \u043C\u0430\u043B\u043A\u043E: \u043E\u0447\u0430\u043A\u0432\u0430 \u0441\u0435 ${t.origin} \u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430 ${i}${t.minimum.toString()} ${o.unit}`;
        return `\u0422\u0432\u044A\u0440\u0434\u0435 \u043C\u0430\u043B\u043A\u043E: \u043E\u0447\u0430\u043A\u0432\u0430 \u0441\u0435 ${t.origin} \u0434\u0430 \u0431\u044A\u0434\u0435 ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043D\u0438\u0437: \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0437\u0430\u043F\u043E\u0447\u0432\u0430 \u0441 "${i.prefix}"`;
        if (i.format === "ends_with") return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043D\u0438\u0437: \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0437\u0430\u0432\u044A\u0440\u0448\u0432\u0430 \u0441 "${i.suffix}"`;
        if (i.format === "includes") return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043D\u0438\u0437: \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0432\u043A\u043B\u044E\u0447\u0432\u0430 "${i.includes}"`;
        if (i.format === "regex") return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043D\u0438\u0437: \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0441\u044A\u0432\u043F\u0430\u0434\u0430 \u0441 ${i.pattern}`;
        let o = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D";
        if (i.format === "emoji") o = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u043E";
        if (i.format === "datetime") o = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u043E";
        if (i.format === "date") o = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u0430";
        if (i.format === "time") o = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u043E";
        if (i.format === "duration") o = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u0430";
        return `${o} ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u043E \u0447\u0438\u0441\u043B\u043E: \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0431\u044A\u0434\u0435 \u043A\u0440\u0430\u0442\u043D\u043E \u043D\u0430 ${t.divisor}`;
      case "unrecognized_keys":
        return `\u041D\u0435\u0440\u0430\u0437\u043F\u043E\u0437\u043D\u0430\u0442${t.keys.length > 1 ? "\u0438" : ""} \u043A\u043B\u044E\u0447${t.keys.length > 1 ? "\u043E\u0432\u0435" : ""}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043A\u043B\u044E\u0447 \u0432 ${t.origin}`;
      case "invalid_union":
        return "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u0432\u0445\u043E\u0434";
      case "invalid_element":
        return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u0430 \u0441\u0442\u043E\u0439\u043D\u043E\u0441\u0442 \u0432 ${t.origin}`;
      default:
        return "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u0432\u0445\u043E\u0434";
    }
  };
};
function Am() {
  return { localeError: Um() };
}
var Dm = () => {
  let e = { string: { unit: "car\xE0cters", verb: "contenir" }, file: { unit: "bytes", verb: "contenir" }, array: { unit: "elements", verb: "contenir" }, set: { unit: "elements", verb: "contenir" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "entrada", email: "adre\xE7a electr\xF2nica", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "data i hora ISO", date: "data ISO", time: "hora ISO", duration: "durada ISO", ipv4: "adre\xE7a IPv4", ipv6: "adre\xE7a IPv6", cidrv4: "rang IPv4", cidrv6: "rang IPv6", base64: "cadena codificada en base64", base64url: "cadena codificada en base64url", json_string: "cadena JSON", e164: "n\xFAmero E.164", jwt: "JWT", template_literal: "entrada" }, a = { nan: "NaN" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Tipus inv\xE0lid: s'esperava instanceof ${t.expected}, s'ha rebut ${u}`;
        return `Tipus inv\xE0lid: s'esperava ${i}, s'ha rebut ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Valor inv\xE0lid: s'esperava ${b(t.values[0])}`;
        return `Opci\xF3 inv\xE0lida: s'esperava una de ${g(t.values, " o ")}`;
      case "too_big": {
        let i = t.inclusive ? "com a m\xE0xim" : "menys de", o = n(t.origin);
        if (o) return `Massa gran: s'esperava que ${t.origin ?? "el valor"} contingu\xE9s ${i} ${t.maximum.toString()} ${o.unit ?? "elements"}`;
        return `Massa gran: s'esperava que ${t.origin ?? "el valor"} fos ${i} ${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? "com a m\xEDnim" : "m\xE9s de", o = n(t.origin);
        if (o) return `Massa petit: s'esperava que ${t.origin} contingu\xE9s ${i} ${t.minimum.toString()} ${o.unit}`;
        return `Massa petit: s'esperava que ${t.origin} fos ${i} ${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `Format inv\xE0lid: ha de comen\xE7ar amb "${i.prefix}"`;
        if (i.format === "ends_with") return `Format inv\xE0lid: ha d'acabar amb "${i.suffix}"`;
        if (i.format === "includes") return `Format inv\xE0lid: ha d'incloure "${i.includes}"`;
        if (i.format === "regex") return `Format inv\xE0lid: ha de coincidir amb el patr\xF3 ${i.pattern}`;
        return `Format inv\xE0lid per a ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `N\xFAmero inv\xE0lid: ha de ser m\xFAltiple de ${t.divisor}`;
      case "unrecognized_keys":
        return `Clau${t.keys.length > 1 ? "s" : ""} no reconeguda${t.keys.length > 1 ? "s" : ""}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `Clau inv\xE0lida a ${t.origin}`;
      case "invalid_union":
        return "Entrada inv\xE0lida";
      case "invalid_element":
        return `Element inv\xE0lid a ${t.origin}`;
      default:
        return "Entrada inv\xE0lida";
    }
  };
};
function Pm() {
  return { localeError: Dm() };
}
var jm = () => {
  let e = { string: { unit: "znak\u016F", verb: "m\xEDt" }, file: { unit: "bajt\u016F", verb: "m\xEDt" }, array: { unit: "prvk\u016F", verb: "m\xEDt" }, set: { unit: "prvk\u016F", verb: "m\xEDt" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "regul\xE1rn\xED v\xFDraz", email: "e-mailov\xE1 adresa", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "datum a \u010Das ve form\xE1tu ISO", date: "datum ve form\xE1tu ISO", time: "\u010Das ve form\xE1tu ISO", duration: "doba trv\xE1n\xED ISO", ipv4: "IPv4 adresa", ipv6: "IPv6 adresa", cidrv4: "rozsah IPv4", cidrv6: "rozsah IPv6", base64: "\u0159et\u011Bzec zak\xF3dovan\xFD ve form\xE1tu base64", base64url: "\u0159et\u011Bzec zak\xF3dovan\xFD ve form\xE1tu base64url", json_string: "\u0159et\u011Bzec ve form\xE1tu JSON", e164: "\u010D\xEDslo E.164", jwt: "JWT", template_literal: "vstup" }, a = { nan: "NaN", number: "\u010D\xEDslo", string: "\u0159et\u011Bzec", function: "funkce", array: "pole" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Neplatn\xFD vstup: o\u010Dek\xE1v\xE1no instanceof ${t.expected}, obdr\u017Eeno ${u}`;
        return `Neplatn\xFD vstup: o\u010Dek\xE1v\xE1no ${i}, obdr\u017Eeno ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Neplatn\xFD vstup: o\u010Dek\xE1v\xE1no ${b(t.values[0])}`;
        return `Neplatn\xE1 mo\u017Enost: o\u010Dek\xE1v\xE1na jedna z hodnot ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `Hodnota je p\u0159\xEDli\u0161 velk\xE1: ${t.origin ?? "hodnota"} mus\xED m\xEDt ${i}${t.maximum.toString()} ${o.unit ?? "prvk\u016F"}`;
        return `Hodnota je p\u0159\xEDli\u0161 velk\xE1: ${t.origin ?? "hodnota"} mus\xED b\xFDt ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `Hodnota je p\u0159\xEDli\u0161 mal\xE1: ${t.origin ?? "hodnota"} mus\xED m\xEDt ${i}${t.minimum.toString()} ${o.unit ?? "prvk\u016F"}`;
        return `Hodnota je p\u0159\xEDli\u0161 mal\xE1: ${t.origin ?? "hodnota"} mus\xED b\xFDt ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `Neplatn\xFD \u0159et\u011Bzec: mus\xED za\u010D\xEDnat na "${i.prefix}"`;
        if (i.format === "ends_with") return `Neplatn\xFD \u0159et\u011Bzec: mus\xED kon\u010Dit na "${i.suffix}"`;
        if (i.format === "includes") return `Neplatn\xFD \u0159et\u011Bzec: mus\xED obsahovat "${i.includes}"`;
        if (i.format === "regex") return `Neplatn\xFD \u0159et\u011Bzec: mus\xED odpov\xEDdat vzoru ${i.pattern}`;
        return `Neplatn\xFD form\xE1t ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `Neplatn\xE9 \u010D\xEDslo: mus\xED b\xFDt n\xE1sobkem ${t.divisor}`;
      case "unrecognized_keys":
        return `Nezn\xE1m\xE9 kl\xED\u010De: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `Neplatn\xFD kl\xED\u010D v ${t.origin}`;
      case "invalid_union":
        return "Neplatn\xFD vstup";
      case "invalid_element":
        return `Neplatn\xE1 hodnota v ${t.origin}`;
      default:
        return "Neplatn\xFD vstup";
    }
  };
};
function Cm() {
  return { localeError: jm() };
}
var Rm = () => {
  let e = { string: { unit: "tegn", verb: "havde" }, file: { unit: "bytes", verb: "havde" }, array: { unit: "elementer", verb: "indeholdt" }, set: { unit: "elementer", verb: "indeholdt" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "input", email: "e-mailadresse", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO dato- og klokkesl\xE6t", date: "ISO-dato", time: "ISO-klokkesl\xE6t", duration: "ISO-varighed", ipv4: "IPv4-omr\xE5de", ipv6: "IPv6-omr\xE5de", cidrv4: "IPv4-spektrum", cidrv6: "IPv6-spektrum", base64: "base64-kodet streng", base64url: "base64url-kodet streng", json_string: "JSON-streng", e164: "E.164-nummer", jwt: "JWT", template_literal: "input" }, a = { nan: "NaN", string: "streng", number: "tal", boolean: "boolean", array: "liste", object: "objekt", set: "s\xE6t", file: "fil" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Ugyldigt input: forventede instanceof ${t.expected}, fik ${u}`;
        return `Ugyldigt input: forventede ${i}, fik ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Ugyldig v\xE6rdi: forventede ${b(t.values[0])}`;
        return `Ugyldigt valg: forventede en af f\xF8lgende ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin), u = a[t.origin] ?? t.origin;
        if (o) return `For stor: forventede ${u ?? "value"} ${o.verb} ${i} ${t.maximum.toString()} ${o.unit ?? "elementer"}`;
        return `For stor: forventede ${u ?? "value"} havde ${i} ${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin), u = a[t.origin] ?? t.origin;
        if (o) return `For lille: forventede ${u} ${o.verb} ${i} ${t.minimum.toString()} ${o.unit}`;
        return `For lille: forventede ${u} havde ${i} ${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `Ugyldig streng: skal starte med "${i.prefix}"`;
        if (i.format === "ends_with") return `Ugyldig streng: skal ende med "${i.suffix}"`;
        if (i.format === "includes") return `Ugyldig streng: skal indeholde "${i.includes}"`;
        if (i.format === "regex") return `Ugyldig streng: skal matche m\xF8nsteret ${i.pattern}`;
        return `Ugyldig ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `Ugyldigt tal: skal v\xE6re deleligt med ${t.divisor}`;
      case "unrecognized_keys":
        return `${t.keys.length > 1 ? "Ukendte n\xF8gler" : "Ukendt n\xF8gle"}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `Ugyldig n\xF8gle i ${t.origin}`;
      case "invalid_union":
        return "Ugyldigt input: matcher ingen af de tilladte typer";
      case "invalid_element":
        return `Ugyldig v\xE6rdi i ${t.origin}`;
      default:
        return "Ugyldigt input";
    }
  };
};
function Zm() {
  return { localeError: Rm() };
}
var Lm = () => {
  let e = { string: { unit: "Zeichen", verb: "zu haben" }, file: { unit: "Bytes", verb: "zu haben" }, array: { unit: "Elemente", verb: "zu haben" }, set: { unit: "Elemente", verb: "zu haben" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "Eingabe", email: "E-Mail-Adresse", url: "URL", emoji: "Emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO-Datum und -Uhrzeit", date: "ISO-Datum", time: "ISO-Uhrzeit", duration: "ISO-Dauer", ipv4: "IPv4-Adresse", ipv6: "IPv6-Adresse", cidrv4: "IPv4-Bereich", cidrv6: "IPv6-Bereich", base64: "Base64-codierter String", base64url: "Base64-URL-codierter String", json_string: "JSON-String", e164: "E.164-Nummer", jwt: "JWT", template_literal: "Eingabe" }, a = { nan: "NaN", number: "Zahl", array: "Array" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Ung\xFCltige Eingabe: erwartet instanceof ${t.expected}, erhalten ${u}`;
        return `Ung\xFCltige Eingabe: erwartet ${i}, erhalten ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Ung\xFCltige Eingabe: erwartet ${b(t.values[0])}`;
        return `Ung\xFCltige Option: erwartet eine von ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `Zu gro\xDF: erwartet, dass ${t.origin ?? "Wert"} ${i}${t.maximum.toString()} ${o.unit ?? "Elemente"} hat`;
        return `Zu gro\xDF: erwartet, dass ${t.origin ?? "Wert"} ${i}${t.maximum.toString()} ist`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `Zu klein: erwartet, dass ${t.origin} ${i}${t.minimum.toString()} ${o.unit} hat`;
        return `Zu klein: erwartet, dass ${t.origin} ${i}${t.minimum.toString()} ist`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `Ung\xFCltiger String: muss mit "${i.prefix}" beginnen`;
        if (i.format === "ends_with") return `Ung\xFCltiger String: muss mit "${i.suffix}" enden`;
        if (i.format === "includes") return `Ung\xFCltiger String: muss "${i.includes}" enthalten`;
        if (i.format === "regex") return `Ung\xFCltiger String: muss dem Muster ${i.pattern} entsprechen`;
        return `Ung\xFCltig: ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `Ung\xFCltige Zahl: muss ein Vielfaches von ${t.divisor} sein`;
      case "unrecognized_keys":
        return `${t.keys.length > 1 ? "Unbekannte Schl\xFCssel" : "Unbekannter Schl\xFCssel"}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `Ung\xFCltiger Schl\xFCssel in ${t.origin}`;
      case "invalid_union":
        return "Ung\xFCltige Eingabe";
      case "invalid_element":
        return `Ung\xFCltiger Wert in ${t.origin}`;
      default:
        return "Ung\xFCltige Eingabe";
    }
  };
};
function Mm() {
  return { localeError: Lm() };
}
var Bm = () => {
  let e = { string: { unit: "\u03C7\u03B1\u03C1\u03B1\u03BA\u03C4\u03AE\u03C1\u03B5\u03C2", verb: "\u03BD\u03B1 \u03AD\u03C7\u03B5\u03B9" }, file: { unit: "bytes", verb: "\u03BD\u03B1 \u03AD\u03C7\u03B5\u03B9" }, array: { unit: "\u03C3\u03C4\u03BF\u03B9\u03C7\u03B5\u03AF\u03B1", verb: "\u03BD\u03B1 \u03AD\u03C7\u03B5\u03B9" }, set: { unit: "\u03C3\u03C4\u03BF\u03B9\u03C7\u03B5\u03AF\u03B1", verb: "\u03BD\u03B1 \u03AD\u03C7\u03B5\u03B9" }, map: { unit: "\u03BA\u03B1\u03C4\u03B1\u03C7\u03C9\u03C1\u03AE\u03C3\u03B5\u03B9\u03C2", verb: "\u03BD\u03B1 \u03AD\u03C7\u03B5\u03B9" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "\u03B5\u03AF\u03C3\u03BF\u03B4\u03BF\u03C2", email: "\u03B4\u03B9\u03B5\u03CD\u03B8\u03C5\u03BD\u03C3\u03B7 email", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO \u03B7\u03BC\u03B5\u03C1\u03BF\u03BC\u03B7\u03BD\u03AF\u03B1 \u03BA\u03B1\u03B9 \u03CE\u03C1\u03B1", date: "ISO \u03B7\u03BC\u03B5\u03C1\u03BF\u03BC\u03B7\u03BD\u03AF\u03B1", time: "ISO \u03CE\u03C1\u03B1", duration: "ISO \u03B4\u03B9\u03AC\u03C1\u03BA\u03B5\u03B9\u03B1", ipv4: "\u03B4\u03B9\u03B5\u03CD\u03B8\u03C5\u03BD\u03C3\u03B7 IPv4", ipv6: "\u03B4\u03B9\u03B5\u03CD\u03B8\u03C5\u03BD\u03C3\u03B7 IPv6", mac: "\u03B4\u03B9\u03B5\u03CD\u03B8\u03C5\u03BD\u03C3\u03B7 MAC", cidrv4: "\u03B5\u03CD\u03C1\u03BF\u03C2 IPv4", cidrv6: "\u03B5\u03CD\u03C1\u03BF\u03C2 IPv6", base64: "\u03C3\u03C5\u03BC\u03B2\u03BF\u03BB\u03BF\u03C3\u03B5\u03B9\u03C1\u03AC \u03BA\u03C9\u03B4\u03B9\u03BA\u03BF\u03C0\u03BF\u03B9\u03B7\u03BC\u03AD\u03BD\u03B7 \u03C3\u03B5 base64", base64url: "\u03C3\u03C5\u03BC\u03B2\u03BF\u03BB\u03BF\u03C3\u03B5\u03B9\u03C1\u03AC \u03BA\u03C9\u03B4\u03B9\u03BA\u03BF\u03C0\u03BF\u03B9\u03B7\u03BC\u03AD\u03BD\u03B7 \u03C3\u03B5 base64url", json_string: "\u03C3\u03C5\u03BC\u03B2\u03BF\u03BB\u03BF\u03C3\u03B5\u03B9\u03C1\u03AC JSON", e164: "\u03B1\u03C1\u03B9\u03B8\u03BC\u03CC\u03C2 E.164", jwt: "JWT", template_literal: "\u03B5\u03AF\u03C3\u03BF\u03B4\u03BF\u03C2" }, a = { nan: "NaN" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (typeof t.expected === "string" && /^[A-Z]/.test(t.expected)) return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03B5\u03AF\u03C3\u03BF\u03B4\u03BF\u03C2: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD instanceof ${t.expected}, \u03BB\u03AE\u03C6\u03B8\u03B7\u03BA\u03B5 ${u}`;
        return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03B5\u03AF\u03C3\u03BF\u03B4\u03BF\u03C2: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD ${i}, \u03BB\u03AE\u03C6\u03B8\u03B7\u03BA\u03B5 ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03B5\u03AF\u03C3\u03BF\u03B4\u03BF\u03C2: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD ${b(t.values[0])}`;
        return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03B5\u03C0\u03B9\u03BB\u03BF\u03B3\u03AE: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD \u03AD\u03BD\u03B1 \u03B1\u03C0\u03CC ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `\u03A0\u03BF\u03BB\u03CD \u03BC\u03B5\u03B3\u03AC\u03BB\u03BF: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD ${t.origin ?? "\u03C4\u03B9\u03BC\u03AE"} \u03BD\u03B1 \u03AD\u03C7\u03B5\u03B9 ${i}${t.maximum.toString()} ${o.unit ?? "\u03C3\u03C4\u03BF\u03B9\u03C7\u03B5\u03AF\u03B1"}`;
        return `\u03A0\u03BF\u03BB\u03CD \u03BC\u03B5\u03B3\u03AC\u03BB\u03BF: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD ${t.origin ?? "\u03C4\u03B9\u03BC\u03AE"} \u03BD\u03B1 \u03B5\u03AF\u03BD\u03B1\u03B9 ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `\u03A0\u03BF\u03BB\u03CD \u03BC\u03B9\u03BA\u03C1\u03CC: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD ${t.origin} \u03BD\u03B1 \u03AD\u03C7\u03B5\u03B9 ${i}${t.minimum.toString()} ${o.unit}`;
        return `\u03A0\u03BF\u03BB\u03CD \u03BC\u03B9\u03BA\u03C1\u03CC: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD ${t.origin} \u03BD\u03B1 \u03B5\u03AF\u03BD\u03B1\u03B9 ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03C3\u03C5\u03BC\u03B2\u03BF\u03BB\u03BF\u03C3\u03B5\u03B9\u03C1\u03AC: \u03C0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03BE\u03B5\u03BA\u03B9\u03BD\u03AC \u03BC\u03B5 "${i.prefix}"`;
        if (i.format === "ends_with") return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03C3\u03C5\u03BC\u03B2\u03BF\u03BB\u03BF\u03C3\u03B5\u03B9\u03C1\u03AC: \u03C0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03C4\u03B5\u03BB\u03B5\u03B9\u03CE\u03BD\u03B5\u03B9 \u03BC\u03B5 "${i.suffix}"`;
        if (i.format === "includes") return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03C3\u03C5\u03BC\u03B2\u03BF\u03BB\u03BF\u03C3\u03B5\u03B9\u03C1\u03AC: \u03C0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03C0\u03B5\u03C1\u03B9\u03AD\u03C7\u03B5\u03B9 "${i.includes}"`;
        if (i.format === "regex") return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03C3\u03C5\u03BC\u03B2\u03BF\u03BB\u03BF\u03C3\u03B5\u03B9\u03C1\u03AC: \u03C0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03C4\u03B1\u03B9\u03C1\u03B9\u03AC\u03B6\u03B5\u03B9 \u03BC\u03B5 \u03C4\u03BF \u03BC\u03BF\u03C4\u03AF\u03B2\u03BF ${i.pattern}`;
        return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03BF: ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03BF\u03C2 \u03B1\u03C1\u03B9\u03B8\u03BC\u03CC\u03C2: \u03C0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03B5\u03AF\u03BD\u03B1\u03B9 \u03C0\u03BF\u03BB\u03BB\u03B1\u03C0\u03BB\u03AC\u03C3\u03B9\u03BF \u03C4\u03BF\u03C5 ${t.divisor}`;
      case "unrecognized_keys":
        return `\u0386\u03B3\u03BD\u03C9\u03C3\u03C4${t.keys.length > 1 ? "\u03B1" : "\u03BF"} \u03BA\u03BB\u03B5\u03B9\u03B4${t.keys.length > 1 ? "\u03B9\u03AC" : "\u03AF"}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03BF \u03BA\u03BB\u03B5\u03B9\u03B4\u03AF \u03C3\u03C4\u03BF ${t.origin}`;
      case "invalid_union":
        return "\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03B5\u03AF\u03C3\u03BF\u03B4\u03BF\u03C2";
      case "invalid_element":
        return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03C4\u03B9\u03BC\u03AE \u03C3\u03C4\u03BF ${t.origin}`;
      default:
        return "\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03B5\u03AF\u03C3\u03BF\u03B4\u03BF\u03C2";
    }
  };
};
function Fm() {
  return { localeError: Bm() };
}
var Jm = () => {
  let e = { string: { unit: "characters", verb: "to have" }, file: { unit: "bytes", verb: "to have" }, array: { unit: "items", verb: "to have" }, set: { unit: "items", verb: "to have" }, map: { unit: "entries", verb: "to have" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "input", email: "email address", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO datetime", date: "ISO date", time: "ISO time", duration: "ISO duration", ipv4: "IPv4 address", ipv6: "IPv6 address", mac: "MAC address", cidrv4: "IPv4 range", cidrv6: "IPv6 range", base64: "base64-encoded string", base64url: "base64url-encoded string", json_string: "JSON string", e164: "E.164 number", jwt: "JWT", template_literal: "input" }, a = { nan: "NaN" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        return `Invalid input: expected ${i}, received ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Invalid input: expected ${b(t.values[0])}`;
        return `Invalid option: expected one of ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `Too big: expected ${t.origin ?? "value"} to have ${i}${t.maximum.toString()} ${o.unit ?? "elements"}`;
        return `Too big: expected ${t.origin ?? "value"} to be ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `Too small: expected ${t.origin} to have ${i}${t.minimum.toString()} ${o.unit}`;
        return `Too small: expected ${t.origin} to be ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `Invalid string: must start with "${i.prefix}"`;
        if (i.format === "ends_with") return `Invalid string: must end with "${i.suffix}"`;
        if (i.format === "includes") return `Invalid string: must include "${i.includes}"`;
        if (i.format === "regex") return `Invalid string: must match pattern ${i.pattern}`;
        return `Invalid ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `Invalid number: must be a multiple of ${t.divisor}`;
      case "unrecognized_keys":
        return `Unrecognized key${t.keys.length > 1 ? "s" : ""}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `Invalid key in ${t.origin}`;
      case "invalid_union":
        if (t.options && Array.isArray(t.options) && t.options.length > 0) return `Invalid discriminator value. Expected ${t.options.map((i) => `'${i}'`).join(" | ")}`;
        return "Invalid input";
      case "invalid_element":
        return `Invalid value in ${t.origin}`;
      default:
        return "Invalid input";
    }
  };
};
function Zs() {
  return { localeError: Jm() };
}
var Gm = () => {
  let e = { string: { unit: "karaktrojn", verb: "havi" }, file: { unit: "bajtojn", verb: "havi" }, array: { unit: "elementojn", verb: "havi" }, set: { unit: "elementojn", verb: "havi" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "enigo", email: "retadreso", url: "URL", emoji: "emo\u011Dio", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO-datotempo", date: "ISO-dato", time: "ISO-tempo", duration: "ISO-da\u016Dro", ipv4: "IPv4-adreso", ipv6: "IPv6-adreso", cidrv4: "IPv4-rango", cidrv6: "IPv6-rango", base64: "64-ume kodita karaktraro", base64url: "URL-64-ume kodita karaktraro", json_string: "JSON-karaktraro", e164: "E.164-nombro", jwt: "JWT", template_literal: "enigo" }, a = { nan: "NaN", number: "nombro", array: "tabelo", null: "senvalora" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Nevalida enigo: atendi\u011Dis instanceof ${t.expected}, ricevi\u011Dis ${u}`;
        return `Nevalida enigo: atendi\u011Dis ${i}, ricevi\u011Dis ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Nevalida enigo: atendi\u011Dis ${b(t.values[0])}`;
        return `Nevalida opcio: atendi\u011Dis unu el ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `Tro granda: atendi\u011Dis ke ${t.origin ?? "valoro"} havu ${i}${t.maximum.toString()} ${o.unit ?? "elementojn"}`;
        return `Tro granda: atendi\u011Dis ke ${t.origin ?? "valoro"} havu ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `Tro malgranda: atendi\u011Dis ke ${t.origin} havu ${i}${t.minimum.toString()} ${o.unit}`;
        return `Tro malgranda: atendi\u011Dis ke ${t.origin} estu ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `Nevalida karaktraro: devas komenci\u011Di per "${i.prefix}"`;
        if (i.format === "ends_with") return `Nevalida karaktraro: devas fini\u011Di per "${i.suffix}"`;
        if (i.format === "includes") return `Nevalida karaktraro: devas inkluzivi "${i.includes}"`;
        if (i.format === "regex") return `Nevalida karaktraro: devas kongrui kun la modelo ${i.pattern}`;
        return `Nevalida ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `Nevalida nombro: devas esti oblo de ${t.divisor}`;
      case "unrecognized_keys":
        return `Nekonata${t.keys.length > 1 ? "j" : ""} \u015Dlosilo${t.keys.length > 1 ? "j" : ""}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `Nevalida \u015Dlosilo en ${t.origin}`;
      case "invalid_union":
        return "Nevalida enigo";
      case "invalid_element":
        return `Nevalida valoro en ${t.origin}`;
      default:
        return "Nevalida enigo";
    }
  };
};
function Wm() {
  return { localeError: Gm() };
}
var Vm = () => {
  let e = { string: { unit: "caracteres", verb: "tener" }, file: { unit: "bytes", verb: "tener" }, array: { unit: "elementos", verb: "tener" }, set: { unit: "elementos", verb: "tener" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "entrada", email: "direcci\xF3n de correo electr\xF3nico", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "fecha y hora ISO", date: "fecha ISO", time: "hora ISO", duration: "duraci\xF3n ISO", ipv4: "direcci\xF3n IPv4", ipv6: "direcci\xF3n IPv6", cidrv4: "rango IPv4", cidrv6: "rango IPv6", base64: "cadena codificada en base64", base64url: "URL codificada en base64", json_string: "cadena JSON", e164: "n\xFAmero E.164", jwt: "JWT", template_literal: "entrada" }, a = { nan: "NaN", string: "texto", number: "n\xFAmero", boolean: "booleano", array: "arreglo", object: "objeto", set: "conjunto", file: "archivo", date: "fecha", bigint: "n\xFAmero grande", symbol: "s\xEDmbolo", undefined: "indefinido", null: "nulo", function: "funci\xF3n", map: "mapa", record: "registro", tuple: "tupla", enum: "enumeraci\xF3n", union: "uni\xF3n", literal: "literal", promise: "promesa", void: "vac\xEDo", never: "nunca", unknown: "desconocido", any: "cualquiera" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Entrada inv\xE1lida: se esperaba instanceof ${t.expected}, recibido ${u}`;
        return `Entrada inv\xE1lida: se esperaba ${i}, recibido ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Entrada inv\xE1lida: se esperaba ${b(t.values[0])}`;
        return `Opci\xF3n inv\xE1lida: se esperaba una de ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin), u = a[t.origin] ?? t.origin;
        if (o) return `Demasiado grande: se esperaba que ${u ?? "valor"} tuviera ${i}${t.maximum.toString()} ${o.unit ?? "elementos"}`;
        return `Demasiado grande: se esperaba que ${u ?? "valor"} fuera ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin), u = a[t.origin] ?? t.origin;
        if (o) return `Demasiado peque\xF1o: se esperaba que ${u} tuviera ${i}${t.minimum.toString()} ${o.unit}`;
        return `Demasiado peque\xF1o: se esperaba que ${u} fuera ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `Cadena inv\xE1lida: debe comenzar con "${i.prefix}"`;
        if (i.format === "ends_with") return `Cadena inv\xE1lida: debe terminar en "${i.suffix}"`;
        if (i.format === "includes") return `Cadena inv\xE1lida: debe incluir "${i.includes}"`;
        if (i.format === "regex") return `Cadena inv\xE1lida: debe coincidir con el patr\xF3n ${i.pattern}`;
        return `Inv\xE1lido ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `N\xFAmero inv\xE1lido: debe ser m\xFAltiplo de ${t.divisor}`;
      case "unrecognized_keys":
        return `Llave${t.keys.length > 1 ? "s" : ""} desconocida${t.keys.length > 1 ? "s" : ""}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `Llave inv\xE1lida en ${a[t.origin] ?? t.origin}`;
      case "invalid_union":
        return "Entrada inv\xE1lida";
      case "invalid_element":
        return `Valor inv\xE1lido en ${a[t.origin] ?? t.origin}`;
      default:
        return "Entrada inv\xE1lida";
    }
  };
};
function Km() {
  return { localeError: Vm() };
}
var qm = () => {
  let e = { string: { unit: "\u06A9\u0627\u0631\u0627\u06A9\u062A\u0631", verb: "\u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F" }, file: { unit: "\u0628\u0627\u06CC\u062A", verb: "\u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F" }, array: { unit: "\u0622\u06CC\u062A\u0645", verb: "\u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F" }, set: { unit: "\u0622\u06CC\u062A\u0645", verb: "\u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "\u0648\u0631\u0648\u062F\u06CC", email: "\u0622\u062F\u0631\u0633 \u0627\u06CC\u0645\u06CC\u0644", url: "URL", emoji: "\u0627\u06CC\u0645\u0648\u062C\u06CC", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "\u062A\u0627\u0631\u06CC\u062E \u0648 \u0632\u0645\u0627\u0646 \u0627\u06CC\u0632\u0648", date: "\u062A\u0627\u0631\u06CC\u062E \u0627\u06CC\u0632\u0648", time: "\u0632\u0645\u0627\u0646 \u0627\u06CC\u0632\u0648", duration: "\u0645\u062F\u062A \u0632\u0645\u0627\u0646 \u0627\u06CC\u0632\u0648", ipv4: "IPv4 \u0622\u062F\u0631\u0633", ipv6: "IPv6 \u0622\u062F\u0631\u0633", cidrv4: "IPv4 \u062F\u0627\u0645\u0646\u0647", cidrv6: "IPv6 \u062F\u0627\u0645\u0646\u0647", base64: "base64-encoded \u0631\u0634\u062A\u0647", base64url: "base64url-encoded \u0631\u0634\u062A\u0647", json_string: "JSON \u0631\u0634\u062A\u0647", e164: "E.164 \u0639\u062F\u062F", jwt: "JWT", template_literal: "\u0648\u0631\u0648\u062F\u06CC" }, a = { nan: "NaN", number: "\u0639\u062F\u062F", array: "\u0622\u0631\u0627\u06CC\u0647" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `\u0648\u0631\u0648\u062F\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0645\u06CC\u200C\u0628\u0627\u06CC\u0633\u062A instanceof ${t.expected} \u0645\u06CC\u200C\u0628\u0648\u062F\u060C ${u} \u062F\u0631\u06CC\u0627\u0641\u062A \u0634\u062F`;
        return `\u0648\u0631\u0648\u062F\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0645\u06CC\u200C\u0628\u0627\u06CC\u0633\u062A ${i} \u0645\u06CC\u200C\u0628\u0648\u062F\u060C ${u} \u062F\u0631\u06CC\u0627\u0641\u062A \u0634\u062F`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `\u0648\u0631\u0648\u062F\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0645\u06CC\u200C\u0628\u0627\u06CC\u0633\u062A ${b(t.values[0])} \u0645\u06CC\u200C\u0628\u0648\u062F`;
        return `\u06AF\u0632\u06CC\u0646\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0645\u06CC\u200C\u0628\u0627\u06CC\u0633\u062A \u06CC\u06A9\u06CC \u0627\u0632 ${g(t.values, "|")} \u0645\u06CC\u200C\u0628\u0648\u062F`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `\u062E\u06CC\u0644\u06CC \u0628\u0632\u0631\u06AF: ${t.origin ?? "\u0645\u0642\u062F\u0627\u0631"} \u0628\u0627\u06CC\u062F ${i}${t.maximum.toString()} ${o.unit ?? "\u0639\u0646\u0635\u0631"} \u0628\u0627\u0634\u062F`;
        return `\u062E\u06CC\u0644\u06CC \u0628\u0632\u0631\u06AF: ${t.origin ?? "\u0645\u0642\u062F\u0627\u0631"} \u0628\u0627\u06CC\u062F ${i}${t.maximum.toString()} \u0628\u0627\u0634\u062F`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `\u062E\u06CC\u0644\u06CC \u06A9\u0648\u0686\u06A9: ${t.origin} \u0628\u0627\u06CC\u062F ${i}${t.minimum.toString()} ${o.unit} \u0628\u0627\u0634\u062F`;
        return `\u062E\u06CC\u0644\u06CC \u06A9\u0648\u0686\u06A9: ${t.origin} \u0628\u0627\u06CC\u062F ${i}${t.minimum.toString()} \u0628\u0627\u0634\u062F`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `\u0631\u0634\u062A\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0628\u0627\u06CC\u062F \u0628\u0627 "${i.prefix}" \u0634\u0631\u0648\u0639 \u0634\u0648\u062F`;
        if (i.format === "ends_with") return `\u0631\u0634\u062A\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0628\u0627\u06CC\u062F \u0628\u0627 "${i.suffix}" \u062A\u0645\u0627\u0645 \u0634\u0648\u062F`;
        if (i.format === "includes") return `\u0631\u0634\u062A\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0628\u0627\u06CC\u062F \u0634\u0627\u0645\u0644 "${i.includes}" \u0628\u0627\u0634\u062F`;
        if (i.format === "regex") return `\u0631\u0634\u062A\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0628\u0627\u06CC\u062F \u0628\u0627 \u0627\u0644\u06AF\u0648\u06CC ${i.pattern} \u0645\u0637\u0627\u0628\u0642\u062A \u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F`;
        return `${r[i.format] ?? t.format} \u0646\u0627\u0645\u0639\u062A\u0628\u0631`;
      }
      case "not_multiple_of":
        return `\u0639\u062F\u062F \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0628\u0627\u06CC\u062F \u0645\u0636\u0631\u0628 ${t.divisor} \u0628\u0627\u0634\u062F`;
      case "unrecognized_keys":
        return `\u06A9\u0644\u06CC\u062F${t.keys.length > 1 ? "\u0647\u0627\u06CC" : ""} \u0646\u0627\u0634\u0646\u0627\u0633: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `\u06A9\u0644\u06CC\u062F \u0646\u0627\u0634\u0646\u0627\u0633 \u062F\u0631 ${t.origin}`;
      case "invalid_union":
        return "\u0648\u0631\u0648\u062F\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631";
      case "invalid_element":
        return `\u0645\u0642\u062F\u0627\u0631 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u062F\u0631 ${t.origin}`;
      default:
        return "\u0648\u0631\u0648\u062F\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631";
    }
  };
};
function Hm() {
  return { localeError: qm() };
}
var Xm = () => {
  let e = { string: { unit: "merkki\xE4", subject: "merkkijonon" }, file: { unit: "tavua", subject: "tiedoston" }, array: { unit: "alkiota", subject: "listan" }, set: { unit: "alkiota", subject: "joukon" }, number: { unit: "", subject: "luvun" }, bigint: { unit: "", subject: "suuren kokonaisluvun" }, int: { unit: "", subject: "kokonaisluvun" }, date: { unit: "", subject: "p\xE4iv\xE4m\xE4\xE4r\xE4n" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "s\xE4\xE4nn\xF6llinen lauseke", email: "s\xE4hk\xF6postiosoite", url: "URL-osoite", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO-aikaleima", date: "ISO-p\xE4iv\xE4m\xE4\xE4r\xE4", time: "ISO-aika", duration: "ISO-kesto", ipv4: "IPv4-osoite", ipv6: "IPv6-osoite", cidrv4: "IPv4-alue", cidrv6: "IPv6-alue", base64: "base64-koodattu merkkijono", base64url: "base64url-koodattu merkkijono", json_string: "JSON-merkkijono", e164: "E.164-luku", jwt: "JWT", template_literal: "templaattimerkkijono" }, a = { nan: "NaN" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Virheellinen tyyppi: odotettiin instanceof ${t.expected}, oli ${u}`;
        return `Virheellinen tyyppi: odotettiin ${i}, oli ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Virheellinen sy\xF6te: t\xE4ytyy olla ${b(t.values[0])}`;
        return `Virheellinen valinta: t\xE4ytyy olla yksi seuraavista: ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `Liian suuri: ${o.subject} t\xE4ytyy olla ${i}${t.maximum.toString()} ${o.unit}`.trim();
        return `Liian suuri: arvon t\xE4ytyy olla ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `Liian pieni: ${o.subject} t\xE4ytyy olla ${i}${t.minimum.toString()} ${o.unit}`.trim();
        return `Liian pieni: arvon t\xE4ytyy olla ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `Virheellinen sy\xF6te: t\xE4ytyy alkaa "${i.prefix}"`;
        if (i.format === "ends_with") return `Virheellinen sy\xF6te: t\xE4ytyy loppua "${i.suffix}"`;
        if (i.format === "includes") return `Virheellinen sy\xF6te: t\xE4ytyy sis\xE4lt\xE4\xE4 "${i.includes}"`;
        if (i.format === "regex") return `Virheellinen sy\xF6te: t\xE4ytyy vastata s\xE4\xE4nn\xF6llist\xE4 lauseketta ${i.pattern}`;
        return `Virheellinen ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `Virheellinen luku: t\xE4ytyy olla luvun ${t.divisor} monikerta`;
      case "unrecognized_keys":
        return `${t.keys.length > 1 ? "Tuntemattomat avaimet" : "Tuntematon avain"}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return "Virheellinen avain tietueessa";
      case "invalid_union":
        return "Virheellinen unioni";
      case "invalid_element":
        return "Virheellinen arvo joukossa";
      default:
        return "Virheellinen sy\xF6te";
    }
  };
};
function Ym() {
  return { localeError: Xm() };
}
var Qm = () => {
  let e = { string: { unit: "caract\xE8res", verb: "avoir" }, file: { unit: "octets", verb: "avoir" }, array: { unit: "\xE9l\xE9ments", verb: "avoir" }, set: { unit: "\xE9l\xE9ments", verb: "avoir" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "entr\xE9e", email: "adresse e-mail", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "date et heure ISO", date: "date ISO", time: "heure ISO", duration: "dur\xE9e ISO", ipv4: "adresse IPv4", ipv6: "adresse IPv6", cidrv4: "plage IPv4", cidrv6: "plage IPv6", base64: "cha\xEEne encod\xE9e en base64", base64url: "cha\xEEne encod\xE9e en base64url", json_string: "cha\xEEne JSON", e164: "num\xE9ro E.164", jwt: "JWT", template_literal: "entr\xE9e" }, a = { string: "cha\xEEne", number: "nombre", int: "entier", boolean: "bool\xE9en", bigint: "grand entier", symbol: "symbole", undefined: "ind\xE9fini", null: "null", never: "jamais", void: "vide", date: "date", array: "tableau", object: "objet", tuple: "tuple", record: "enregistrement", map: "carte", set: "ensemble", file: "fichier", nonoptional: "non-optionnel", nan: "NaN", function: "fonction" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Entr\xE9e invalide : instanceof ${t.expected} attendu, ${u} re\xE7u`;
        return `Entr\xE9e invalide : ${i} attendu, ${u} re\xE7u`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Entr\xE9e invalide : ${b(t.values[0])} attendu`;
        return `Option invalide : une valeur parmi ${g(t.values, "|")} attendue`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `Trop grand : ${a[t.origin] ?? "valeur"} doit ${o.verb} ${i}${t.maximum.toString()} ${o.unit ?? "\xE9l\xE9ment(s)"}`;
        return `Trop grand : ${a[t.origin] ?? "valeur"} doit \xEAtre ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `Trop petit : ${a[t.origin] ?? "valeur"} doit ${o.verb} ${i}${t.minimum.toString()} ${o.unit}`;
        return `Trop petit : ${a[t.origin] ?? "valeur"} doit \xEAtre ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `Cha\xEEne invalide : doit commencer par "${i.prefix}"`;
        if (i.format === "ends_with") return `Cha\xEEne invalide : doit se terminer par "${i.suffix}"`;
        if (i.format === "includes") return `Cha\xEEne invalide : doit inclure "${i.includes}"`;
        if (i.format === "regex") return `Cha\xEEne invalide : doit correspondre au mod\xE8le ${i.pattern}`;
        return `${r[i.format] ?? t.format} invalide`;
      }
      case "not_multiple_of":
        return `Nombre invalide : doit \xEAtre un multiple de ${t.divisor}`;
      case "unrecognized_keys":
        return `Cl\xE9${t.keys.length > 1 ? "s" : ""} non reconnue${t.keys.length > 1 ? "s" : ""} : ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `Cl\xE9 invalide dans ${t.origin}`;
      case "invalid_union":
        return "Entr\xE9e invalide";
      case "invalid_element":
        return `Valeur invalide dans ${t.origin}`;
      default:
        return "Entr\xE9e invalide";
    }
  };
};
function ef() {
  return { localeError: Qm() };
}
var tf = () => {
  let e = { string: { unit: "caract\xE8res", verb: "avoir" }, file: { unit: "octets", verb: "avoir" }, array: { unit: "\xE9l\xE9ments", verb: "avoir" }, set: { unit: "\xE9l\xE9ments", verb: "avoir" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "entr\xE9e", email: "adresse courriel", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "date-heure ISO", date: "date ISO", time: "heure ISO", duration: "dur\xE9e ISO", ipv4: "adresse IPv4", ipv6: "adresse IPv6", cidrv4: "plage IPv4", cidrv6: "plage IPv6", base64: "cha\xEEne encod\xE9e en base64", base64url: "cha\xEEne encod\xE9e en base64url", json_string: "cha\xEEne JSON", e164: "num\xE9ro E.164", jwt: "JWT", template_literal: "entr\xE9e" }, a = { nan: "NaN" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Entr\xE9e invalide : attendu instanceof ${t.expected}, re\xE7u ${u}`;
        return `Entr\xE9e invalide : attendu ${i}, re\xE7u ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Entr\xE9e invalide : attendu ${b(t.values[0])}`;
        return `Option invalide : attendu l'une des valeurs suivantes ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "\u2264" : "<", o = n(t.origin);
        if (o) return `Trop grand : attendu que ${t.origin ?? "la valeur"} ait ${i}${t.maximum.toString()} ${o.unit}`;
        return `Trop grand : attendu que ${t.origin ?? "la valeur"} soit ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? "\u2265" : ">", o = n(t.origin);
        if (o) return `Trop petit : attendu que ${t.origin} ait ${i}${t.minimum.toString()} ${o.unit}`;
        return `Trop petit : attendu que ${t.origin} soit ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `Cha\xEEne invalide : doit commencer par "${i.prefix}"`;
        if (i.format === "ends_with") return `Cha\xEEne invalide : doit se terminer par "${i.suffix}"`;
        if (i.format === "includes") return `Cha\xEEne invalide : doit inclure "${i.includes}"`;
        if (i.format === "regex") return `Cha\xEEne invalide : doit correspondre au motif ${i.pattern}`;
        return `${r[i.format] ?? t.format} invalide`;
      }
      case "not_multiple_of":
        return `Nombre invalide : doit \xEAtre un multiple de ${t.divisor}`;
      case "unrecognized_keys":
        return `Cl\xE9${t.keys.length > 1 ? "s" : ""} non reconnue${t.keys.length > 1 ? "s" : ""} : ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `Cl\xE9 invalide dans ${t.origin}`;
      case "invalid_union":
        return "Entr\xE9e invalide";
      case "invalid_element":
        return `Valeur invalide dans ${t.origin}`;
      default:
        return "Entr\xE9e invalide";
    }
  };
};
function nf() {
  return { localeError: tf() };
}
var rf = () => {
  let e = { string: { label: "\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA", gender: "f" }, number: { label: "\u05DE\u05E1\u05E4\u05E8", gender: "m" }, boolean: { label: "\u05E2\u05E8\u05DA \u05D1\u05D5\u05DC\u05D9\u05D0\u05E0\u05D9", gender: "m" }, bigint: { label: "BigInt", gender: "m" }, date: { label: "\u05EA\u05D0\u05E8\u05D9\u05DA", gender: "m" }, array: { label: "\u05DE\u05E2\u05E8\u05DA", gender: "m" }, object: { label: "\u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8", gender: "m" }, null: { label: "\u05E2\u05E8\u05DA \u05E8\u05D9\u05E7 (null)", gender: "m" }, undefined: { label: "\u05E2\u05E8\u05DA \u05DC\u05D0 \u05DE\u05D5\u05D2\u05D3\u05E8 (undefined)", gender: "m" }, symbol: { label: "\u05E1\u05D9\u05DE\u05D1\u05D5\u05DC (Symbol)", gender: "m" }, function: { label: "\u05E4\u05D5\u05E0\u05E7\u05E6\u05D9\u05D4", gender: "f" }, map: { label: "\u05DE\u05E4\u05D4 (Map)", gender: "f" }, set: { label: "\u05E7\u05D1\u05D5\u05E6\u05D4 (Set)", gender: "f" }, file: { label: "\u05E7\u05D5\u05D1\u05E5", gender: "m" }, promise: { label: "Promise", gender: "m" }, NaN: { label: "NaN", gender: "m" }, unknown: { label: "\u05E2\u05E8\u05DA \u05DC\u05D0 \u05D9\u05D3\u05D5\u05E2", gender: "m" }, value: { label: "\u05E2\u05E8\u05DA", gender: "m" } }, n = { string: { unit: "\u05EA\u05D5\u05D5\u05D9\u05DD", shortLabel: "\u05E7\u05E6\u05E8", longLabel: "\u05D0\u05E8\u05D5\u05DA" }, file: { unit: "\u05D1\u05D9\u05D9\u05D8\u05D9\u05DD", shortLabel: "\u05E7\u05D8\u05DF", longLabel: "\u05D2\u05D3\u05D5\u05DC" }, array: { unit: "\u05E4\u05E8\u05D9\u05D8\u05D9\u05DD", shortLabel: "\u05E7\u05D8\u05DF", longLabel: "\u05D2\u05D3\u05D5\u05DC" }, set: { unit: "\u05E4\u05E8\u05D9\u05D8\u05D9\u05DD", shortLabel: "\u05E7\u05D8\u05DF", longLabel: "\u05D2\u05D3\u05D5\u05DC" }, number: { unit: "", shortLabel: "\u05E7\u05D8\u05DF", longLabel: "\u05D2\u05D3\u05D5\u05DC" } }, r = (d) => d ? e[d] : void 0, a = (d) => {
    let c = r(d);
    if (c) return c.label;
    return d ?? e.unknown.label;
  }, t = (d) => `\u05D4${a(d)}`, i = (d) => {
    return (r(d)?.gender ?? "m") === "f" ? "\u05E6\u05E8\u05D9\u05DB\u05D4 \u05DC\u05D4\u05D9\u05D5\u05EA" : "\u05E6\u05E8\u05D9\u05DA \u05DC\u05D4\u05D9\u05D5\u05EA";
  }, o = (d) => {
    if (!d) return null;
    return n[d] ?? null;
  }, u = { regex: { label: "\u05E7\u05DC\u05D8", gender: "m" }, email: { label: "\u05DB\u05EA\u05D5\u05D1\u05EA \u05D0\u05D9\u05DE\u05D9\u05D9\u05DC", gender: "f" }, url: { label: "\u05DB\u05EA\u05D5\u05D1\u05EA \u05E8\u05E9\u05EA", gender: "f" }, emoji: { label: "\u05D0\u05D9\u05DE\u05D5\u05D2'\u05D9", gender: "m" }, uuid: { label: "UUID", gender: "m" }, nanoid: { label: "nanoid", gender: "m" }, guid: { label: "GUID", gender: "m" }, cuid: { label: "cuid", gender: "m" }, cuid2: { label: "cuid2", gender: "m" }, ulid: { label: "ULID", gender: "m" }, xid: { label: "XID", gender: "m" }, ksuid: { label: "KSUID", gender: "m" }, datetime: { label: "\u05EA\u05D0\u05E8\u05D9\u05DA \u05D5\u05D6\u05DE\u05DF ISO", gender: "m" }, date: { label: "\u05EA\u05D0\u05E8\u05D9\u05DA ISO", gender: "m" }, time: { label: "\u05D6\u05DE\u05DF ISO", gender: "m" }, duration: { label: "\u05DE\u05E9\u05DA \u05D6\u05DE\u05DF ISO", gender: "m" }, ipv4: { label: "\u05DB\u05EA\u05D5\u05D1\u05EA IPv4", gender: "f" }, ipv6: { label: "\u05DB\u05EA\u05D5\u05D1\u05EA IPv6", gender: "f" }, cidrv4: { label: "\u05D8\u05D5\u05D5\u05D7 IPv4", gender: "m" }, cidrv6: { label: "\u05D8\u05D5\u05D5\u05D7 IPv6", gender: "m" }, base64: { label: "\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D1\u05D1\u05E1\u05D9\u05E1 64", gender: "f" }, base64url: { label: "\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D1\u05D1\u05E1\u05D9\u05E1 64 \u05DC\u05DB\u05EA\u05D5\u05D1\u05D5\u05EA \u05E8\u05E9\u05EA", gender: "f" }, json_string: { label: "\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA JSON", gender: "f" }, e164: { label: "\u05DE\u05E1\u05E4\u05E8 E.164", gender: "m" }, jwt: { label: "JWT", gender: "m" }, ends_with: { label: "\u05E7\u05DC\u05D8", gender: "m" }, includes: { label: "\u05E7\u05DC\u05D8", gender: "m" }, lowercase: { label: "\u05E7\u05DC\u05D8", gender: "m" }, starts_with: { label: "\u05E7\u05DC\u05D8", gender: "m" }, uppercase: { label: "\u05E7\u05DC\u05D8", gender: "m" } }, l = { nan: "NaN" };
  return (d) => {
    switch (d.code) {
      case "invalid_type": {
        let c = d.expected, p = l[c ?? ""] ?? a(c), f = _(d.input), $ = l[f] ?? e[f]?.label ?? f;
        if (/^[A-Z]/.test(d.expected)) return `\u05E7\u05DC\u05D8 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05E6\u05E8\u05D9\u05DA \u05DC\u05D4\u05D9\u05D5\u05EA instanceof ${d.expected}, \u05D4\u05EA\u05E7\u05D1\u05DC ${$}`;
        return `\u05E7\u05DC\u05D8 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05E6\u05E8\u05D9\u05DA \u05DC\u05D4\u05D9\u05D5\u05EA ${p}, \u05D4\u05EA\u05E7\u05D1\u05DC ${$}`;
      }
      case "invalid_value": {
        if (d.values.length === 1) return `\u05E2\u05E8\u05DA \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05D4\u05E2\u05E8\u05DA \u05D7\u05D9\u05D9\u05D1 \u05DC\u05D4\u05D9\u05D5\u05EA ${b(d.values[0])}`;
        let c = d.values.map((f) => b(f));
        if (d.values.length === 2) return `\u05E2\u05E8\u05DA \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05D4\u05D0\u05E4\u05E9\u05E8\u05D5\u05D9\u05D5\u05EA \u05D4\u05DE\u05EA\u05D0\u05D9\u05DE\u05D5\u05EA \u05D4\u05DF ${c[0]} \u05D0\u05D5 ${c[1]}`;
        let p = c[c.length - 1];
        return `\u05E2\u05E8\u05DA \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05D4\u05D0\u05E4\u05E9\u05E8\u05D5\u05D9\u05D5\u05EA \u05D4\u05DE\u05EA\u05D0\u05D9\u05DE\u05D5\u05EA \u05D4\u05DF ${c.slice(0, -1).join(", ")} \u05D0\u05D5 ${p}`;
      }
      case "too_big": {
        let c = o(d.origin), p = t(d.origin ?? "value");
        if (d.origin === "string") return `${c?.longLabel ?? "\u05D0\u05E8\u05D5\u05DA"} \u05DE\u05D3\u05D9: ${p} \u05E6\u05E8\u05D9\u05DB\u05D4 \u05DC\u05D4\u05DB\u05D9\u05DC ${d.maximum.toString()} ${c?.unit ?? ""} ${d.inclusive ? "\u05D0\u05D5 \u05E4\u05D7\u05D5\u05EA" : "\u05DC\u05DB\u05DC \u05D4\u05D9\u05D5\u05EA\u05E8"}`.trim();
        if (d.origin === "number") {
          let x = d.inclusive ? `\u05E7\u05D8\u05DF \u05D0\u05D5 \u05E9\u05D5\u05D5\u05D4 \u05DC-${d.maximum}` : `\u05E7\u05D8\u05DF \u05DE-${d.maximum}`;
          return `\u05D2\u05D3\u05D5\u05DC \u05DE\u05D3\u05D9: ${p} \u05E6\u05E8\u05D9\u05DA \u05DC\u05D4\u05D9\u05D5\u05EA ${x}`;
        }
        if (d.origin === "array" || d.origin === "set") {
          let x = d.origin === "set" ? "\u05E6\u05E8\u05D9\u05DB\u05D4" : "\u05E6\u05E8\u05D9\u05DA", N = d.inclusive ? `${d.maximum} ${c?.unit ?? ""} \u05D0\u05D5 \u05E4\u05D7\u05D5\u05EA` : `\u05E4\u05D7\u05D5\u05EA \u05DE-${d.maximum} ${c?.unit ?? ""}`;
          return `\u05D2\u05D3\u05D5\u05DC \u05DE\u05D3\u05D9: ${p} ${x} \u05DC\u05D4\u05DB\u05D9\u05DC ${N}`.trim();
        }
        let f = d.inclusive ? "<=" : "<", $ = i(d.origin ?? "value");
        if (c?.unit) return `${c.longLabel} \u05DE\u05D3\u05D9: ${p} ${$} ${f}${d.maximum.toString()} ${c.unit}`;
        return `${c?.longLabel ?? "\u05D2\u05D3\u05D5\u05DC"} \u05DE\u05D3\u05D9: ${p} ${$} ${f}${d.maximum.toString()}`;
      }
      case "too_small": {
        let c = o(d.origin), p = t(d.origin ?? "value");
        if (d.origin === "string") return `${c?.shortLabel ?? "\u05E7\u05E6\u05E8"} \u05DE\u05D3\u05D9: ${p} \u05E6\u05E8\u05D9\u05DB\u05D4 \u05DC\u05D4\u05DB\u05D9\u05DC ${d.minimum.toString()} ${c?.unit ?? ""} ${d.inclusive ? "\u05D0\u05D5 \u05D9\u05D5\u05EA\u05E8" : "\u05DC\u05E4\u05D7\u05D5\u05EA"}`.trim();
        if (d.origin === "number") {
          let x = d.inclusive ? `\u05D2\u05D3\u05D5\u05DC \u05D0\u05D5 \u05E9\u05D5\u05D5\u05D4 \u05DC-${d.minimum}` : `\u05D2\u05D3\u05D5\u05DC \u05DE-${d.minimum}`;
          return `\u05E7\u05D8\u05DF \u05DE\u05D3\u05D9: ${p} \u05E6\u05E8\u05D9\u05DA \u05DC\u05D4\u05D9\u05D5\u05EA ${x}`;
        }
        if (d.origin === "array" || d.origin === "set") {
          let x = d.origin === "set" ? "\u05E6\u05E8\u05D9\u05DB\u05D4" : "\u05E6\u05E8\u05D9\u05DA";
          if (d.minimum === 1 && d.inclusive) {
            let X = d.origin === "set" ? "\u05DC\u05E4\u05D7\u05D5\u05EA \u05E4\u05E8\u05D9\u05D8 \u05D0\u05D7\u05D3" : "\u05DC\u05E4\u05D7\u05D5\u05EA \u05E4\u05E8\u05D9\u05D8 \u05D0\u05D7\u05D3";
            return `\u05E7\u05D8\u05DF \u05DE\u05D3\u05D9: ${p} ${x} \u05DC\u05D4\u05DB\u05D9\u05DC ${X}`;
          }
          let N = d.inclusive ? `${d.minimum} ${c?.unit ?? ""} \u05D0\u05D5 \u05D9\u05D5\u05EA\u05E8` : `\u05D9\u05D5\u05EA\u05E8 \u05DE-${d.minimum} ${c?.unit ?? ""}`;
          return `\u05E7\u05D8\u05DF \u05DE\u05D3\u05D9: ${p} ${x} \u05DC\u05D4\u05DB\u05D9\u05DC ${N}`.trim();
        }
        let f = d.inclusive ? ">=" : ">", $ = i(d.origin ?? "value");
        if (c?.unit) return `${c.shortLabel} \u05DE\u05D3\u05D9: ${p} ${$} ${f}${d.minimum.toString()} ${c.unit}`;
        return `${c?.shortLabel ?? "\u05E7\u05D8\u05DF"} \u05DE\u05D3\u05D9: ${p} ${$} ${f}${d.minimum.toString()}`;
      }
      case "invalid_format": {
        let c = d;
        if (c.format === "starts_with") return `\u05D4\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D7\u05D9\u05D9\u05D1\u05EA \u05DC\u05D4\u05EA\u05D7\u05D9\u05DC \u05D1 "${c.prefix}"`;
        if (c.format === "ends_with") return `\u05D4\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D7\u05D9\u05D9\u05D1\u05EA \u05DC\u05D4\u05E1\u05EA\u05D9\u05D9\u05DD \u05D1 "${c.suffix}"`;
        if (c.format === "includes") return `\u05D4\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D7\u05D9\u05D9\u05D1\u05EA \u05DC\u05DB\u05DC\u05D5\u05DC "${c.includes}"`;
        if (c.format === "regex") return `\u05D4\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D7\u05D9\u05D9\u05D1\u05EA \u05DC\u05D4\u05EA\u05D0\u05D9\u05DD \u05DC\u05EA\u05D1\u05E0\u05D9\u05EA ${c.pattern}`;
        let p = u[c.format], f = p?.label ?? c.format, $ = (p?.gender ?? "m") === "f" ? "\u05EA\u05E7\u05D9\u05E0\u05D4" : "\u05EA\u05E7\u05D9\u05DF";
        return `${f} \u05DC\u05D0 ${$}`;
      }
      case "not_multiple_of":
        return `\u05DE\u05E1\u05E4\u05E8 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05D7\u05D9\u05D9\u05D1 \u05DC\u05D4\u05D9\u05D5\u05EA \u05DE\u05DB\u05E4\u05DC\u05D4 \u05E9\u05DC ${d.divisor}`;
      case "unrecognized_keys":
        return `\u05DE\u05E4\u05EA\u05D7${d.keys.length > 1 ? "\u05D5\u05EA" : ""} \u05DC\u05D0 \u05DE\u05D6\u05D5\u05D4${d.keys.length > 1 ? "\u05D9\u05DD" : "\u05D4"}: ${g(d.keys, ", ")}`;
      case "invalid_key":
        return "\u05E9\u05D3\u05D4 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF \u05D1\u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8";
      case "invalid_union":
        return "\u05E7\u05DC\u05D8 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF";
      case "invalid_element":
        return `\u05E2\u05E8\u05DA \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF \u05D1${t(d.origin ?? "array")}`;
      default:
        return "\u05E7\u05DC\u05D8 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF";
    }
  };
};
function af() {
  return { localeError: rf() };
}
var of = () => {
  let e = { string: { unit: "znakova", verb: "imati" }, file: { unit: "bajtova", verb: "imati" }, array: { unit: "stavki", verb: "imati" }, set: { unit: "stavki", verb: "imati" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "unos", email: "email adresa", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO datum i vrijeme", date: "ISO datum", time: "ISO vrijeme", duration: "ISO trajanje", ipv4: "IPv4 adresa", ipv6: "IPv6 adresa", cidrv4: "IPv4 raspon", cidrv6: "IPv6 raspon", base64: "base64 kodirani tekst", base64url: "base64url kodirani tekst", json_string: "JSON tekst", e164: "E.164 broj", jwt: "JWT", template_literal: "unos" }, a = { nan: "NaN", string: "tekst", number: "broj", boolean: "boolean", array: "niz", object: "objekt", set: "skup", file: "datoteka", date: "datum", bigint: "bigint", symbol: "simbol", undefined: "undefined", null: "null", function: "funkcija", map: "mapa" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Neispravan unos: o\u010Dekuje se instanceof ${t.expected}, a primljeno je ${u}`;
        return `Neispravan unos: o\u010Dekuje se ${i}, a primljeno je ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Neispravna vrijednost: o\u010Dekivano ${b(t.values[0])}`;
        return `Neispravna opcija: o\u010Dekivano jedno od ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin), u = a[t.origin] ?? t.origin;
        if (o) return `Preveliko: o\u010Dekivano da ${u ?? "vrijednost"} ima ${i}${t.maximum.toString()} ${o.unit ?? "elemenata"}`;
        return `Preveliko: o\u010Dekivano da ${u ?? "vrijednost"} bude ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin), u = a[t.origin] ?? t.origin;
        if (o) return `Premalo: o\u010Dekivano da ${u} ima ${i}${t.minimum.toString()} ${o.unit}`;
        return `Premalo: o\u010Dekivano da ${u} bude ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `Neispravan tekst: mora zapo\u010Dinjati s "${i.prefix}"`;
        if (i.format === "ends_with") return `Neispravan tekst: mora zavr\u0161avati s "${i.suffix}"`;
        if (i.format === "includes") return `Neispravan tekst: mora sadr\u017Eavati "${i.includes}"`;
        if (i.format === "regex") return `Neispravan tekst: mora odgovarati uzorku ${i.pattern}`;
        return `Neispravna ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `Neispravan broj: mora biti vi\u0161ekratnik od ${t.divisor}`;
      case "unrecognized_keys":
        return `Neprepoznat${t.keys.length > 1 ? "i klju\u010Devi" : " klju\u010D"}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `Neispravan klju\u010D u ${a[t.origin] ?? t.origin}`;
      case "invalid_union":
        return "Neispravan unos";
      case "invalid_element":
        return `Neispravna vrijednost u ${a[t.origin] ?? t.origin}`;
      default:
        return "Neispravan unos";
    }
  };
};
function sf() {
  return { localeError: of() };
}
var uf = () => {
  let e = { string: { unit: "karakter", verb: "legyen" }, file: { unit: "byte", verb: "legyen" }, array: { unit: "elem", verb: "legyen" }, set: { unit: "elem", verb: "legyen" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "bemenet", email: "email c\xEDm", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO id\u0151b\xE9lyeg", date: "ISO d\xE1tum", time: "ISO id\u0151", duration: "ISO id\u0151intervallum", ipv4: "IPv4 c\xEDm", ipv6: "IPv6 c\xEDm", cidrv4: "IPv4 tartom\xE1ny", cidrv6: "IPv6 tartom\xE1ny", base64: "base64-k\xF3dolt string", base64url: "base64url-k\xF3dolt string", json_string: "JSON string", e164: "E.164 sz\xE1m", jwt: "JWT", template_literal: "bemenet" }, a = { nan: "NaN", number: "sz\xE1m", array: "t\xF6mb" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `\xC9rv\xE9nytelen bemenet: a v\xE1rt \xE9rt\xE9k instanceof ${t.expected}, a kapott \xE9rt\xE9k ${u}`;
        return `\xC9rv\xE9nytelen bemenet: a v\xE1rt \xE9rt\xE9k ${i}, a kapott \xE9rt\xE9k ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `\xC9rv\xE9nytelen bemenet: a v\xE1rt \xE9rt\xE9k ${b(t.values[0])}`;
        return `\xC9rv\xE9nytelen opci\xF3: valamelyik \xE9rt\xE9k v\xE1rt ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `T\xFAl nagy: ${t.origin ?? "\xE9rt\xE9k"} m\xE9rete t\xFAl nagy ${i}${t.maximum.toString()} ${o.unit ?? "elem"}`;
        return `T\xFAl nagy: a bemeneti \xE9rt\xE9k ${t.origin ?? "\xE9rt\xE9k"} t\xFAl nagy: ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `T\xFAl kicsi: a bemeneti \xE9rt\xE9k ${t.origin} m\xE9rete t\xFAl kicsi ${i}${t.minimum.toString()} ${o.unit}`;
        return `T\xFAl kicsi: a bemeneti \xE9rt\xE9k ${t.origin} t\xFAl kicsi ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `\xC9rv\xE9nytelen string: "${i.prefix}" \xE9rt\xE9kkel kell kezd\u0151dnie`;
        if (i.format === "ends_with") return `\xC9rv\xE9nytelen string: "${i.suffix}" \xE9rt\xE9kkel kell v\xE9gz\u0151dnie`;
        if (i.format === "includes") return `\xC9rv\xE9nytelen string: "${i.includes}" \xE9rt\xE9ket kell tartalmaznia`;
        if (i.format === "regex") return `\xC9rv\xE9nytelen string: ${i.pattern} mint\xE1nak kell megfelelnie`;
        return `\xC9rv\xE9nytelen ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `\xC9rv\xE9nytelen sz\xE1m: ${t.divisor} t\xF6bbsz\xF6r\xF6s\xE9nek kell lennie`;
      case "unrecognized_keys":
        return `Ismeretlen kulcs${t.keys.length > 1 ? "s" : ""}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `\xC9rv\xE9nytelen kulcs ${t.origin}`;
      case "invalid_union":
        return "\xC9rv\xE9nytelen bemenet";
      case "invalid_element":
        return `\xC9rv\xE9nytelen \xE9rt\xE9k: ${t.origin}`;
      default:
        return "\xC9rv\xE9nytelen bemenet";
    }
  };
};
function lf() {
  return { localeError: uf() };
}
function Qr(e, n, r) {
  return Math.abs(e) === 1 ? n : r;
}
function he(e) {
  if (!e) return "";
  let n = ["\u0561", "\u0565", "\u0568", "\u056B", "\u0578", "\u0578\u0582", "\u0585"], r = e[e.length - 1];
  return e + (n.includes(r) ? "\u0576" : "\u0568");
}
var df = () => {
  let e = { string: { unit: { one: "\u0576\u0577\u0561\u0576", many: "\u0576\u0577\u0561\u0576\u0576\u0565\u0580" }, verb: "\u0578\u0582\u0576\u0565\u0576\u0561\u056C" }, file: { unit: { one: "\u0562\u0561\u0575\u0569", many: "\u0562\u0561\u0575\u0569\u0565\u0580" }, verb: "\u0578\u0582\u0576\u0565\u0576\u0561\u056C" }, array: { unit: { one: "\u057F\u0561\u0580\u0580", many: "\u057F\u0561\u0580\u0580\u0565\u0580" }, verb: "\u0578\u0582\u0576\u0565\u0576\u0561\u056C" }, set: { unit: { one: "\u057F\u0561\u0580\u0580", many: "\u057F\u0561\u0580\u0580\u0565\u0580" }, verb: "\u0578\u0582\u0576\u0565\u0576\u0561\u056C" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "\u0574\u0578\u0582\u057F\u0584", email: "\u0567\u056C. \u0570\u0561\u057D\u0581\u0565", url: "URL", emoji: "\u0567\u0574\u0578\u057B\u056B", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO \u0561\u0574\u057D\u0561\u0569\u056B\u057E \u0587 \u056A\u0561\u0574", date: "ISO \u0561\u0574\u057D\u0561\u0569\u056B\u057E", time: "ISO \u056A\u0561\u0574", duration: "ISO \u057F\u0587\u0578\u0572\u0578\u0582\u0569\u0575\u0578\u0582\u0576", ipv4: "IPv4 \u0570\u0561\u057D\u0581\u0565", ipv6: "IPv6 \u0570\u0561\u057D\u0581\u0565", cidrv4: "IPv4 \u0574\u056B\u057B\u0561\u056F\u0561\u0575\u0584", cidrv6: "IPv6 \u0574\u056B\u057B\u0561\u056F\u0561\u0575\u0584", base64: "base64 \u0571\u0587\u0561\u0579\u0561\u0583\u0578\u057E \u057F\u0578\u0572", base64url: "base64url \u0571\u0587\u0561\u0579\u0561\u0583\u0578\u057E \u057F\u0578\u0572", json_string: "JSON \u057F\u0578\u0572", e164: "E.164 \u0570\u0561\u0574\u0561\u0580", jwt: "JWT", template_literal: "\u0574\u0578\u0582\u057F\u0584" }, a = { nan: "NaN", number: "\u0569\u056B\u057E", array: "\u0566\u0561\u0576\u0563\u057E\u0561\u056E" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `\u054D\u056D\u0561\u056C \u0574\u0578\u0582\u057F\u0584\u0561\u0563\u0580\u0578\u0582\u0574\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567\u0580 instanceof ${t.expected}, \u057D\u057F\u0561\u0581\u057E\u0565\u056C \u0567 ${u}`;
        return `\u054D\u056D\u0561\u056C \u0574\u0578\u0582\u057F\u0584\u0561\u0563\u0580\u0578\u0582\u0574\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567\u0580 ${i}, \u057D\u057F\u0561\u0581\u057E\u0565\u056C \u0567 ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `\u054D\u056D\u0561\u056C \u0574\u0578\u0582\u057F\u0584\u0561\u0563\u0580\u0578\u0582\u0574\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567\u0580 ${b(t.values[1])}`;
        return `\u054D\u056D\u0561\u056C \u057F\u0561\u0580\u0562\u0565\u0580\u0561\u056F\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567\u0580 \u0570\u0565\u057F\u0587\u0575\u0561\u056C\u0576\u0565\u0580\u056B\u0581 \u0574\u0565\u056F\u0568\u055D ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) {
          let u = Number(t.maximum), l = Qr(u, o.unit.one, o.unit.many);
          return `\u0549\u0561\u0583\u0561\u0566\u0561\u0576\u0581 \u0574\u0565\u056E \u0561\u0580\u056A\u0565\u0584\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567, \u0578\u0580 ${he(t.origin ?? "\u0561\u0580\u056A\u0565\u0584")} \u056F\u0578\u0582\u0576\u0565\u0576\u0561 ${i}${t.maximum.toString()} ${l}`;
        }
        return `\u0549\u0561\u0583\u0561\u0566\u0561\u0576\u0581 \u0574\u0565\u056E \u0561\u0580\u056A\u0565\u0584\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567, \u0578\u0580 ${he(t.origin ?? "\u0561\u0580\u056A\u0565\u0584")} \u056C\u056B\u0576\u056B ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) {
          let u = Number(t.minimum), l = Qr(u, o.unit.one, o.unit.many);
          return `\u0549\u0561\u0583\u0561\u0566\u0561\u0576\u0581 \u0583\u0578\u0584\u0580 \u0561\u0580\u056A\u0565\u0584\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567, \u0578\u0580 ${he(t.origin)} \u056F\u0578\u0582\u0576\u0565\u0576\u0561 ${i}${t.minimum.toString()} ${l}`;
        }
        return `\u0549\u0561\u0583\u0561\u0566\u0561\u0576\u0581 \u0583\u0578\u0584\u0580 \u0561\u0580\u056A\u0565\u0584\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567, \u0578\u0580 ${he(t.origin)} \u056C\u056B\u0576\u056B ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `\u054D\u056D\u0561\u056C \u057F\u0578\u0572\u2024 \u057A\u0565\u057F\u0584 \u0567 \u057D\u056F\u057D\u057E\u056B "${i.prefix}"-\u0578\u057E`;
        if (i.format === "ends_with") return `\u054D\u056D\u0561\u056C \u057F\u0578\u0572\u2024 \u057A\u0565\u057F\u0584 \u0567 \u0561\u057E\u0561\u0580\u057F\u057E\u056B "${i.suffix}"-\u0578\u057E`;
        if (i.format === "includes") return `\u054D\u056D\u0561\u056C \u057F\u0578\u0572\u2024 \u057A\u0565\u057F\u0584 \u0567 \u057A\u0561\u0580\u0578\u0582\u0576\u0561\u056F\u056B "${i.includes}"`;
        if (i.format === "regex") return `\u054D\u056D\u0561\u056C \u057F\u0578\u0572\u2024 \u057A\u0565\u057F\u0584 \u0567 \u0570\u0561\u0574\u0561\u057A\u0561\u057F\u0561\u057D\u056D\u0561\u0576\u056B ${i.pattern} \u0571\u0587\u0561\u0579\u0561\u0583\u056B\u0576`;
        return `\u054D\u056D\u0561\u056C ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `\u054D\u056D\u0561\u056C \u0569\u056B\u057E\u2024 \u057A\u0565\u057F\u0584 \u0567 \u0562\u0561\u0566\u0574\u0561\u057A\u0561\u057F\u056B\u056F \u056C\u056B\u0576\u056B ${t.divisor}-\u056B`;
      case "unrecognized_keys":
        return `\u0549\u0573\u0561\u0576\u0561\u0579\u057E\u0561\u056E \u0562\u0561\u0576\u0561\u056C\u056B${t.keys.length > 1 ? "\u0576\u0565\u0580" : ""}. ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `\u054D\u056D\u0561\u056C \u0562\u0561\u0576\u0561\u056C\u056B ${he(t.origin)}-\u0578\u0582\u0574`;
      case "invalid_union":
        return "\u054D\u056D\u0561\u056C \u0574\u0578\u0582\u057F\u0584\u0561\u0563\u0580\u0578\u0582\u0574";
      case "invalid_element":
        return `\u054D\u056D\u0561\u056C \u0561\u0580\u056A\u0565\u0584 ${he(t.origin)}-\u0578\u0582\u0574`;
      default:
        return "\u054D\u056D\u0561\u056C \u0574\u0578\u0582\u057F\u0584\u0561\u0563\u0580\u0578\u0582\u0574";
    }
  };
};
function cf() {
  return { localeError: df() };
}
var mf = () => {
  let e = { string: { unit: "karakter", verb: "memiliki" }, file: { unit: "byte", verb: "memiliki" }, array: { unit: "item", verb: "memiliki" }, set: { unit: "item", verb: "memiliki" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "input", email: "alamat email", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "tanggal dan waktu format ISO", date: "tanggal format ISO", time: "jam format ISO", duration: "durasi format ISO", ipv4: "alamat IPv4", ipv6: "alamat IPv6", cidrv4: "rentang alamat IPv4", cidrv6: "rentang alamat IPv6", base64: "string dengan enkode base64", base64url: "string dengan enkode base64url", json_string: "string JSON", e164: "angka E.164", jwt: "JWT", template_literal: "input" }, a = { nan: "NaN" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Input tidak valid: diharapkan instanceof ${t.expected}, diterima ${u}`;
        return `Input tidak valid: diharapkan ${i}, diterima ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Input tidak valid: diharapkan ${b(t.values[0])}`;
        return `Pilihan tidak valid: diharapkan salah satu dari ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `Terlalu besar: diharapkan ${t.origin ?? "value"} memiliki ${i}${t.maximum.toString()} ${o.unit ?? "elemen"}`;
        return `Terlalu besar: diharapkan ${t.origin ?? "value"} menjadi ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `Terlalu kecil: diharapkan ${t.origin} memiliki ${i}${t.minimum.toString()} ${o.unit}`;
        return `Terlalu kecil: diharapkan ${t.origin} menjadi ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `String tidak valid: harus dimulai dengan "${i.prefix}"`;
        if (i.format === "ends_with") return `String tidak valid: harus berakhir dengan "${i.suffix}"`;
        if (i.format === "includes") return `String tidak valid: harus menyertakan "${i.includes}"`;
        if (i.format === "regex") return `String tidak valid: harus sesuai pola ${i.pattern}`;
        return `${r[i.format] ?? t.format} tidak valid`;
      }
      case "not_multiple_of":
        return `Angka tidak valid: harus kelipatan dari ${t.divisor}`;
      case "unrecognized_keys":
        return `Kunci tidak dikenali ${t.keys.length > 1 ? "s" : ""}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `Kunci tidak valid di ${t.origin}`;
      case "invalid_union":
        return "Input tidak valid";
      case "invalid_element":
        return `Nilai tidak valid di ${t.origin}`;
      default:
        return "Input tidak valid";
    }
  };
};
function ff() {
  return { localeError: mf() };
}
var pf = () => {
  let e = { string: { unit: "stafi", verb: "a\xF0 hafa" }, file: { unit: "b\xE6ti", verb: "a\xF0 hafa" }, array: { unit: "hluti", verb: "a\xF0 hafa" }, set: { unit: "hluti", verb: "a\xF0 hafa" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "gildi", email: "netfang", url: "vefsl\xF3\xF0", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO dagsetning og t\xEDmi", date: "ISO dagsetning", time: "ISO t\xEDmi", duration: "ISO t\xEDmalengd", ipv4: "IPv4 address", ipv6: "IPv6 address", cidrv4: "IPv4 range", cidrv6: "IPv6 range", base64: "base64-encoded strengur", base64url: "base64url-encoded strengur", json_string: "JSON strengur", e164: "E.164 t\xF6lugildi", jwt: "JWT", template_literal: "gildi" }, a = { nan: "NaN", number: "n\xFAmer", array: "fylki" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Rangt gildi: \xDE\xFA sl\xF3st inn ${u} \xFEar sem \xE1 a\xF0 vera instanceof ${t.expected}`;
        return `Rangt gildi: \xDE\xFA sl\xF3st inn ${u} \xFEar sem \xE1 a\xF0 vera ${i}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Rangt gildi: gert r\xE1\xF0 fyrir ${b(t.values[0])}`;
        return `\xD3gilt val: m\xE1 vera eitt af eftirfarandi ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `Of st\xF3rt: gert er r\xE1\xF0 fyrir a\xF0 ${t.origin ?? "gildi"} hafi ${i}${t.maximum.toString()} ${o.unit ?? "hluti"}`;
        return `Of st\xF3rt: gert er r\xE1\xF0 fyrir a\xF0 ${t.origin ?? "gildi"} s\xE9 ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `Of l\xEDti\xF0: gert er r\xE1\xF0 fyrir a\xF0 ${t.origin} hafi ${i}${t.minimum.toString()} ${o.unit}`;
        return `Of l\xEDti\xF0: gert er r\xE1\xF0 fyrir a\xF0 ${t.origin} s\xE9 ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `\xD3gildur strengur: ver\xF0ur a\xF0 byrja \xE1 "${i.prefix}"`;
        if (i.format === "ends_with") return `\xD3gildur strengur: ver\xF0ur a\xF0 enda \xE1 "${i.suffix}"`;
        if (i.format === "includes") return `\xD3gildur strengur: ver\xF0ur a\xF0 innihalda "${i.includes}"`;
        if (i.format === "regex") return `\xD3gildur strengur: ver\xF0ur a\xF0 fylgja mynstri ${i.pattern}`;
        return `Rangt ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `R\xF6ng tala: ver\xF0ur a\xF0 vera margfeldi af ${t.divisor}`;
      case "unrecognized_keys":
        return `\xD3\xFEekkt ${t.keys.length > 1 ? "ir lyklar" : "ur lykill"}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `Rangur lykill \xED ${t.origin}`;
      case "invalid_union":
        return "Rangt gildi";
      case "invalid_element":
        return `Rangt gildi \xED ${t.origin}`;
      default:
        return "Rangt gildi";
    }
  };
};
function gf() {
  return { localeError: pf() };
}
var vf = () => {
  let e = { string: { unit: "caratteri", verb: "avere" }, file: { unit: "byte", verb: "avere" }, array: { unit: "elementi", verb: "avere" }, set: { unit: "elementi", verb: "avere" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "input", email: "indirizzo email", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "data e ora ISO", date: "data ISO", time: "ora ISO", duration: "durata ISO", ipv4: "indirizzo IPv4", ipv6: "indirizzo IPv6", cidrv4: "intervallo IPv4", cidrv6: "intervallo IPv6", base64: "stringa codificata in base64", base64url: "URL codificata in base64", json_string: "stringa JSON", e164: "numero E.164", jwt: "JWT", template_literal: "input" }, a = { nan: "NaN", number: "numero", array: "vettore" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Input non valido: atteso instanceof ${t.expected}, ricevuto ${u}`;
        return `Input non valido: atteso ${i}, ricevuto ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Input non valido: atteso ${b(t.values[0])}`;
        return `Opzione non valida: atteso uno tra ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `Troppo grande: ${t.origin ?? "valore"} deve avere ${i}${t.maximum.toString()} ${o.unit ?? "elementi"}`;
        return `Troppo grande: ${t.origin ?? "valore"} deve essere ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `Troppo piccolo: ${t.origin} deve avere ${i}${t.minimum.toString()} ${o.unit}`;
        return `Troppo piccolo: ${t.origin} deve essere ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `Stringa non valida: deve iniziare con "${i.prefix}"`;
        if (i.format === "ends_with") return `Stringa non valida: deve terminare con "${i.suffix}"`;
        if (i.format === "includes") return `Stringa non valida: deve includere "${i.includes}"`;
        if (i.format === "regex") return `Stringa non valida: deve corrispondere al pattern ${i.pattern}`;
        return `Input non valido: ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `Numero non valido: deve essere un multiplo di ${t.divisor}`;
      case "unrecognized_keys":
        return `Chiav${t.keys.length > 1 ? "i" : "e"} non riconosciut${t.keys.length > 1 ? "e" : "a"}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `Chiave non valida in ${t.origin}`;
      case "invalid_union":
        return "Input non valido";
      case "invalid_element":
        return `Valore non valido in ${t.origin}`;
      default:
        return "Input non valido";
    }
  };
};
function hf() {
  return { localeError: vf() };
}
var $f = () => {
  let e = { string: { unit: "\u6587\u5B57", verb: "\u3067\u3042\u308B" }, file: { unit: "\u30D0\u30A4\u30C8", verb: "\u3067\u3042\u308B" }, array: { unit: "\u8981\u7D20", verb: "\u3067\u3042\u308B" }, set: { unit: "\u8981\u7D20", verb: "\u3067\u3042\u308B" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "\u5165\u529B\u5024", email: "\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9", url: "URL", emoji: "\u7D75\u6587\u5B57", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO\u65E5\u6642", date: "ISO\u65E5\u4ED8", time: "ISO\u6642\u523B", duration: "ISO\u671F\u9593", ipv4: "IPv4\u30A2\u30C9\u30EC\u30B9", ipv6: "IPv6\u30A2\u30C9\u30EC\u30B9", cidrv4: "IPv4\u7BC4\u56F2", cidrv6: "IPv6\u7BC4\u56F2", base64: "base64\u30A8\u30F3\u30B3\u30FC\u30C9\u6587\u5B57\u5217", base64url: "base64url\u30A8\u30F3\u30B3\u30FC\u30C9\u6587\u5B57\u5217", json_string: "JSON\u6587\u5B57\u5217", e164: "E.164\u756A\u53F7", jwt: "JWT", template_literal: "\u5165\u529B\u5024" }, a = { nan: "NaN", number: "\u6570\u5024", array: "\u914D\u5217" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `\u7121\u52B9\u306A\u5165\u529B: instanceof ${t.expected}\u304C\u671F\u5F85\u3055\u308C\u307E\u3057\u305F\u304C\u3001${u}\u304C\u5165\u529B\u3055\u308C\u307E\u3057\u305F`;
        return `\u7121\u52B9\u306A\u5165\u529B: ${i}\u304C\u671F\u5F85\u3055\u308C\u307E\u3057\u305F\u304C\u3001${u}\u304C\u5165\u529B\u3055\u308C\u307E\u3057\u305F`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `\u7121\u52B9\u306A\u5165\u529B: ${b(t.values[0])}\u304C\u671F\u5F85\u3055\u308C\u307E\u3057\u305F`;
        return `\u7121\u52B9\u306A\u9078\u629E: ${g(t.values, "\u3001")}\u306E\u3044\u305A\u308C\u304B\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
      case "too_big": {
        let i = t.inclusive ? "\u4EE5\u4E0B\u3067\u3042\u308B" : "\u3088\u308A\u5C0F\u3055\u3044", o = n(t.origin);
        if (o) return `\u5927\u304D\u3059\u304E\u308B\u5024: ${t.origin ?? "\u5024"}\u306F${t.maximum.toString()}${o.unit ?? "\u8981\u7D20"}${i}\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
        return `\u5927\u304D\u3059\u304E\u308B\u5024: ${t.origin ?? "\u5024"}\u306F${t.maximum.toString()}${i}\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
      }
      case "too_small": {
        let i = t.inclusive ? "\u4EE5\u4E0A\u3067\u3042\u308B" : "\u3088\u308A\u5927\u304D\u3044", o = n(t.origin);
        if (o) return `\u5C0F\u3055\u3059\u304E\u308B\u5024: ${t.origin}\u306F${t.minimum.toString()}${o.unit}${i}\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
        return `\u5C0F\u3055\u3059\u304E\u308B\u5024: ${t.origin}\u306F${t.minimum.toString()}${i}\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `\u7121\u52B9\u306A\u6587\u5B57\u5217: "${i.prefix}"\u3067\u59CB\u307E\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
        if (i.format === "ends_with") return `\u7121\u52B9\u306A\u6587\u5B57\u5217: "${i.suffix}"\u3067\u7D42\u308F\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
        if (i.format === "includes") return `\u7121\u52B9\u306A\u6587\u5B57\u5217: "${i.includes}"\u3092\u542B\u3080\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
        if (i.format === "regex") return `\u7121\u52B9\u306A\u6587\u5B57\u5217: \u30D1\u30BF\u30FC\u30F3${i.pattern}\u306B\u4E00\u81F4\u3059\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
        return `\u7121\u52B9\u306A${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `\u7121\u52B9\u306A\u6570\u5024: ${t.divisor}\u306E\u500D\u6570\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
      case "unrecognized_keys":
        return `\u8A8D\u8B58\u3055\u308C\u3066\u3044\u306A\u3044\u30AD\u30FC${t.keys.length > 1 ? "\u7FA4" : ""}: ${g(t.keys, "\u3001")}`;
      case "invalid_key":
        return `${t.origin}\u5185\u306E\u7121\u52B9\u306A\u30AD\u30FC`;
      case "invalid_union":
        return "\u7121\u52B9\u306A\u5165\u529B";
      case "invalid_element":
        return `${t.origin}\u5185\u306E\u7121\u52B9\u306A\u5024`;
      default:
        return "\u7121\u52B9\u306A\u5165\u529B";
    }
  };
};
function yf() {
  return { localeError: $f() };
}
var bf = () => {
  let e = { string: { unit: "\u10E1\u10D8\u10DB\u10D1\u10DD\u10DA\u10DD", verb: "\u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D8\u10EA\u10D0\u10D5\u10D3\u10D4\u10E1" }, file: { unit: "\u10D1\u10D0\u10D8\u10E2\u10D8", verb: "\u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D8\u10EA\u10D0\u10D5\u10D3\u10D4\u10E1" }, array: { unit: "\u10D4\u10DA\u10D4\u10DB\u10D4\u10DC\u10E2\u10D8", verb: "\u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D8\u10EA\u10D0\u10D5\u10D3\u10D4\u10E1" }, set: { unit: "\u10D4\u10DA\u10D4\u10DB\u10D4\u10DC\u10E2\u10D8", verb: "\u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D8\u10EA\u10D0\u10D5\u10D3\u10D4\u10E1" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "\u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0", email: "\u10D4\u10DA-\u10E4\u10DD\u10E1\u10E2\u10D8\u10E1 \u10DB\u10D8\u10E1\u10D0\u10DB\u10D0\u10E0\u10D7\u10D8", url: "URL", emoji: "\u10D4\u10DB\u10DD\u10EF\u10D8", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "\u10D7\u10D0\u10E0\u10D8\u10E6\u10D8-\u10D3\u10E0\u10DD", date: "\u10D7\u10D0\u10E0\u10D8\u10E6\u10D8", time: "\u10D3\u10E0\u10DD", duration: "\u10EE\u10D0\u10DC\u10D2\u10E0\u10EB\u10DA\u10D8\u10D5\u10DD\u10D1\u10D0", ipv4: "IPv4 \u10DB\u10D8\u10E1\u10D0\u10DB\u10D0\u10E0\u10D7\u10D8", ipv6: "IPv6 \u10DB\u10D8\u10E1\u10D0\u10DB\u10D0\u10E0\u10D7\u10D8", cidrv4: "IPv4 \u10D3\u10D8\u10D0\u10DE\u10D0\u10D6\u10DD\u10DC\u10D8", cidrv6: "IPv6 \u10D3\u10D8\u10D0\u10DE\u10D0\u10D6\u10DD\u10DC\u10D8", base64: "base64-\u10D9\u10DD\u10D3\u10D8\u10E0\u10D4\u10D1\u10E3\u10DA\u10D8 \u10D5\u10D4\u10DA\u10D8", base64url: "base64url-\u10D9\u10DD\u10D3\u10D8\u10E0\u10D4\u10D1\u10E3\u10DA\u10D8 \u10D5\u10D4\u10DA\u10D8", json_string: "JSON \u10D5\u10D4\u10DA\u10D8", e164: "E.164 \u10DC\u10DD\u10DB\u10D4\u10E0\u10D8", jwt: "JWT", template_literal: "\u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0" }, a = { nan: "NaN", number: "\u10E0\u10D8\u10EA\u10EE\u10D5\u10D8", string: "\u10D5\u10D4\u10DA\u10D8", boolean: "\u10D1\u10E3\u10DA\u10D4\u10D0\u10DC\u10D8", function: "\u10E4\u10E3\u10DC\u10E5\u10EA\u10D8\u10D0", array: "\u10DB\u10D0\u10E1\u10D8\u10D5\u10D8" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 instanceof ${t.expected}, \u10DB\u10D8\u10E6\u10D4\u10D1\u10E3\u10DA\u10D8 ${u}`;
        return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${i}, \u10DB\u10D8\u10E6\u10D4\u10D1\u10E3\u10DA\u10D8 ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${b(t.values[0])}`;
        return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10D5\u10D0\u10E0\u10D8\u10D0\u10DC\u10E2\u10D8: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8\u10D0 \u10D4\u10E0\u10D7-\u10D4\u10E0\u10D7\u10D8 ${g(t.values, "|")}-\u10D3\u10D0\u10DC`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `\u10D6\u10D4\u10D3\u10DB\u10D4\u10E2\u10D0\u10D3 \u10D3\u10D8\u10D3\u10D8: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${t.origin ?? "\u10DB\u10DC\u10D8\u10E8\u10D5\u10DC\u10D4\u10DA\u10DD\u10D1\u10D0"} ${o.verb} ${i}${t.maximum.toString()} ${o.unit}`;
        return `\u10D6\u10D4\u10D3\u10DB\u10D4\u10E2\u10D0\u10D3 \u10D3\u10D8\u10D3\u10D8: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${t.origin ?? "\u10DB\u10DC\u10D8\u10E8\u10D5\u10DC\u10D4\u10DA\u10DD\u10D1\u10D0"} \u10D8\u10E7\u10DD\u10E1 ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `\u10D6\u10D4\u10D3\u10DB\u10D4\u10E2\u10D0\u10D3 \u10DE\u10D0\u10E2\u10D0\u10E0\u10D0: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${t.origin} ${o.verb} ${i}${t.minimum.toString()} ${o.unit}`;
        return `\u10D6\u10D4\u10D3\u10DB\u10D4\u10E2\u10D0\u10D3 \u10DE\u10D0\u10E2\u10D0\u10E0\u10D0: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${t.origin} \u10D8\u10E7\u10DD\u10E1 ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10D5\u10D4\u10DA\u10D8: \u10E3\u10DC\u10D3\u10D0 \u10D8\u10EC\u10E7\u10D4\u10D1\u10DD\u10D3\u10D4\u10E1 "${i.prefix}"-\u10D8\u10D7`;
        if (i.format === "ends_with") return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10D5\u10D4\u10DA\u10D8: \u10E3\u10DC\u10D3\u10D0 \u10DB\u10D7\u10D0\u10D5\u10E0\u10D3\u10D4\u10D1\u10DD\u10D3\u10D4\u10E1 "${i.suffix}"-\u10D8\u10D7`;
        if (i.format === "includes") return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10D5\u10D4\u10DA\u10D8: \u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D8\u10EA\u10D0\u10D5\u10D3\u10D4\u10E1 "${i.includes}"-\u10E1`;
        if (i.format === "regex") return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10D5\u10D4\u10DA\u10D8: \u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D4\u10E1\u10D0\u10D1\u10D0\u10DB\u10D4\u10D1\u10DD\u10D3\u10D4\u10E1 \u10E8\u10D0\u10D1\u10DA\u10DD\u10DC\u10E1 ${i.pattern}`;
        return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E0\u10D8\u10EA\u10EE\u10D5\u10D8: \u10E3\u10DC\u10D3\u10D0 \u10D8\u10E7\u10DD\u10E1 ${t.divisor}-\u10D8\u10E1 \u10EF\u10D4\u10E0\u10D0\u10D3\u10D8`;
      case "unrecognized_keys":
        return `\u10E3\u10EA\u10DC\u10DD\u10D1\u10D8 \u10D2\u10D0\u10E1\u10D0\u10E6\u10D4\u10D1${t.keys.length > 1 ? "\u10D4\u10D1\u10D8" : "\u10D8"}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10D2\u10D0\u10E1\u10D0\u10E6\u10D4\u10D1\u10D8 ${t.origin}-\u10E8\u10D8`;
      case "invalid_union":
        return "\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0";
      case "invalid_element":
        return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10DB\u10DC\u10D8\u10E8\u10D5\u10DC\u10D4\u10DA\u10DD\u10D1\u10D0 ${t.origin}-\u10E8\u10D8`;
      default:
        return "\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0";
    }
  };
};
function _f() {
  return { localeError: bf() };
}
var kf = () => {
  let e = { string: { unit: "\u178F\u17BD\u17A2\u1780\u17D2\u179F\u179A", verb: "\u1782\u17BD\u179A\u1798\u17B6\u1793" }, file: { unit: "\u1794\u17C3", verb: "\u1782\u17BD\u179A\u1798\u17B6\u1793" }, array: { unit: "\u1792\u17B6\u178F\u17BB", verb: "\u1782\u17BD\u179A\u1798\u17B6\u1793" }, set: { unit: "\u1792\u17B6\u178F\u17BB", verb: "\u1782\u17BD\u179A\u1798\u17B6\u1793" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1794\u1789\u17D2\u1785\u17BC\u179B", email: "\u17A2\u17B6\u179F\u1799\u178A\u17D2\u178B\u17B6\u1793\u17A2\u17CA\u17B8\u1798\u17C2\u179B", url: "URL", emoji: "\u179F\u1789\u17D2\u1789\u17B6\u17A2\u17B6\u179A\u1798\u17D2\u1798\u178E\u17CD", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "\u1780\u17B6\u179B\u1794\u179A\u17B7\u1785\u17D2\u1786\u17C1\u1791 \u1793\u17B7\u1784\u1798\u17C9\u17C4\u1784 ISO", date: "\u1780\u17B6\u179B\u1794\u179A\u17B7\u1785\u17D2\u1786\u17C1\u1791 ISO", time: "\u1798\u17C9\u17C4\u1784 ISO", duration: "\u179A\u1799\u17C8\u1796\u17C1\u179B ISO", ipv4: "\u17A2\u17B6\u179F\u1799\u178A\u17D2\u178B\u17B6\u1793 IPv4", ipv6: "\u17A2\u17B6\u179F\u1799\u178A\u17D2\u178B\u17B6\u1793 IPv6", cidrv4: "\u178A\u17C2\u1793\u17A2\u17B6\u179F\u1799\u178A\u17D2\u178B\u17B6\u1793 IPv4", cidrv6: "\u178A\u17C2\u1793\u17A2\u17B6\u179F\u1799\u178A\u17D2\u178B\u17B6\u1793 IPv6", base64: "\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u17A2\u17CA\u17B7\u1780\u17BC\u178A base64", base64url: "\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u17A2\u17CA\u17B7\u1780\u17BC\u178A base64url", json_string: "\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A JSON", e164: "\u179B\u17C1\u1781 E.164", jwt: "JWT", template_literal: "\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1794\u1789\u17D2\u1785\u17BC\u179B" }, a = { nan: "NaN", number: "\u179B\u17C1\u1781", array: "\u17A2\u17B6\u179A\u17C1 (Array)", null: "\u1782\u17D2\u1798\u17B6\u1793\u178F\u1798\u17D2\u179B\u17C3 (null)" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1794\u1789\u17D2\u1785\u17BC\u179B\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A instanceof ${t.expected} \u1794\u17C9\u17BB\u1793\u17D2\u178F\u17C2\u1791\u1791\u17BD\u179B\u1794\u17B6\u1793 ${u}`;
        return `\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1794\u1789\u17D2\u1785\u17BC\u179B\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${i} \u1794\u17C9\u17BB\u1793\u17D2\u178F\u17C2\u1791\u1791\u17BD\u179B\u1794\u17B6\u1793 ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1794\u1789\u17D2\u1785\u17BC\u179B\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${b(t.values[0])}`;
        return `\u1787\u1798\u17D2\u179A\u17BE\u179F\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1787\u17B6\u1798\u17BD\u1799\u1780\u17D2\u1793\u17BB\u1784\u1785\u17C6\u178E\u17C4\u1798 ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `\u1792\u17C6\u1796\u17C1\u1780\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${t.origin ?? "\u178F\u1798\u17D2\u179B\u17C3"} ${i} ${t.maximum.toString()} ${o.unit ?? "\u1792\u17B6\u178F\u17BB"}`;
        return `\u1792\u17C6\u1796\u17C1\u1780\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${t.origin ?? "\u178F\u1798\u17D2\u179B\u17C3"} ${i} ${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `\u178F\u17BC\u1785\u1796\u17C1\u1780\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${t.origin} ${i} ${t.minimum.toString()} ${o.unit}`;
        return `\u178F\u17BC\u1785\u1796\u17C1\u1780\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${t.origin} ${i} ${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1785\u17B6\u1794\u17CB\u1795\u17D2\u178F\u17BE\u1798\u178A\u17C4\u1799 "${i.prefix}"`;
        if (i.format === "ends_with") return `\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1794\u1789\u17D2\u1785\u1794\u17CB\u178A\u17C4\u1799 "${i.suffix}"`;
        if (i.format === "includes") return `\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1798\u17B6\u1793 "${i.includes}"`;
        if (i.format === "regex") return `\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u178F\u17C2\u1795\u17D2\u1782\u17BC\u1795\u17D2\u1782\u1784\u1793\u17B9\u1784\u1791\u1798\u17D2\u179A\u1784\u17CB\u178A\u17C2\u179B\u1794\u17B6\u1793\u1780\u17C6\u178E\u178F\u17CB ${i.pattern}`;
        return `\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `\u179B\u17C1\u1781\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u178F\u17C2\u1787\u17B6\u1796\u17A0\u17BB\u1782\u17BB\u178E\u1793\u17C3 ${t.divisor}`;
      case "unrecognized_keys":
        return `\u179A\u1780\u1783\u17BE\u1789\u179F\u17C4\u1798\u17B7\u1793\u179F\u17D2\u1782\u17B6\u179B\u17CB\u17D6 ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `\u179F\u17C4\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u1793\u17C5\u1780\u17D2\u1793\u17BB\u1784 ${t.origin}`;
      case "invalid_union":
        return "\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C";
      case "invalid_element":
        return `\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u1793\u17C5\u1780\u17D2\u1793\u17BB\u1784 ${t.origin}`;
      default:
        return "\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C";
    }
  };
};
function Ls() {
  return { localeError: kf() };
}
function If() {
  return Ls();
}
var wf = () => {
  let e = { string: { unit: "\uBB38\uC790", verb: "to have" }, file: { unit: "\uBC14\uC774\uD2B8", verb: "to have" }, array: { unit: "\uAC1C", verb: "to have" }, set: { unit: "\uAC1C", verb: "to have" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "\uC785\uB825", email: "\uC774\uBA54\uC77C \uC8FC\uC18C", url: "URL", emoji: "\uC774\uBAA8\uC9C0", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO \uB0A0\uC9DC\uC2DC\uAC04", date: "ISO \uB0A0\uC9DC", time: "ISO \uC2DC\uAC04", duration: "ISO \uAE30\uAC04", ipv4: "IPv4 \uC8FC\uC18C", ipv6: "IPv6 \uC8FC\uC18C", cidrv4: "IPv4 \uBC94\uC704", cidrv6: "IPv6 \uBC94\uC704", base64: "base64 \uC778\uCF54\uB529 \uBB38\uC790\uC5F4", base64url: "base64url \uC778\uCF54\uB529 \uBB38\uC790\uC5F4", json_string: "JSON \uBB38\uC790\uC5F4", e164: "E.164 \uBC88\uD638", jwt: "JWT", template_literal: "\uC785\uB825" }, a = { nan: "NaN" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `\uC798\uBABB\uB41C \uC785\uB825: \uC608\uC0C1 \uD0C0\uC785\uC740 instanceof ${t.expected}, \uBC1B\uC740 \uD0C0\uC785\uC740 ${u}\uC785\uB2C8\uB2E4`;
        return `\uC798\uBABB\uB41C \uC785\uB825: \uC608\uC0C1 \uD0C0\uC785\uC740 ${i}, \uBC1B\uC740 \uD0C0\uC785\uC740 ${u}\uC785\uB2C8\uB2E4`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `\uC798\uBABB\uB41C \uC785\uB825: \uAC12\uC740 ${b(t.values[0])} \uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4`;
        return `\uC798\uBABB\uB41C \uC635\uC158: ${g(t.values, "\uB610\uB294 ")} \uC911 \uD558\uB098\uC5EC\uC57C \uD569\uB2C8\uB2E4`;
      case "too_big": {
        let i = t.inclusive ? "\uC774\uD558" : "\uBBF8\uB9CC", o = i === "\uBBF8\uB9CC" ? "\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" : "\uC5EC\uC57C \uD569\uB2C8\uB2E4", u = n(t.origin), l = u?.unit ?? "\uC694\uC18C";
        if (u) return `${t.origin ?? "\uAC12"}\uC774 \uB108\uBB34 \uD07D\uB2C8\uB2E4: ${t.maximum.toString()}${l} ${i}${o}`;
        return `${t.origin ?? "\uAC12"}\uC774 \uB108\uBB34 \uD07D\uB2C8\uB2E4: ${t.maximum.toString()} ${i}${o}`;
      }
      case "too_small": {
        let i = t.inclusive ? "\uC774\uC0C1" : "\uCD08\uACFC", o = i === "\uC774\uC0C1" ? "\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" : "\uC5EC\uC57C \uD569\uB2C8\uB2E4", u = n(t.origin), l = u?.unit ?? "\uC694\uC18C";
        if (u) return `${t.origin ?? "\uAC12"}\uC774 \uB108\uBB34 \uC791\uC2B5\uB2C8\uB2E4: ${t.minimum.toString()}${l} ${i}${o}`;
        return `${t.origin ?? "\uAC12"}\uC774 \uB108\uBB34 \uC791\uC2B5\uB2C8\uB2E4: ${t.minimum.toString()} ${i}${o}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `\uC798\uBABB\uB41C \uBB38\uC790\uC5F4: "${i.prefix}"(\uC73C)\uB85C \uC2DC\uC791\uD574\uC57C \uD569\uB2C8\uB2E4`;
        if (i.format === "ends_with") return `\uC798\uBABB\uB41C \uBB38\uC790\uC5F4: "${i.suffix}"(\uC73C)\uB85C \uB05D\uB098\uC57C \uD569\uB2C8\uB2E4`;
        if (i.format === "includes") return `\uC798\uBABB\uB41C \uBB38\uC790\uC5F4: "${i.includes}"\uC744(\uB97C) \uD3EC\uD568\uD574\uC57C \uD569\uB2C8\uB2E4`;
        if (i.format === "regex") return `\uC798\uBABB\uB41C \uBB38\uC790\uC5F4: \uC815\uADDC\uC2DD ${i.pattern} \uD328\uD134\uACFC \uC77C\uCE58\uD574\uC57C \uD569\uB2C8\uB2E4`;
        return `\uC798\uBABB\uB41C ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `\uC798\uBABB\uB41C \uC22B\uC790: ${t.divisor}\uC758 \uBC30\uC218\uC5EC\uC57C \uD569\uB2C8\uB2E4`;
      case "unrecognized_keys":
        return `\uC778\uC2DD\uD560 \uC218 \uC5C6\uB294 \uD0A4: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `\uC798\uBABB\uB41C \uD0A4: ${t.origin}`;
      case "invalid_union":
        return "\uC798\uBABB\uB41C \uC785\uB825";
      case "invalid_element":
        return `\uC798\uBABB\uB41C \uAC12: ${t.origin}`;
      default:
        return "\uC798\uBABB\uB41C \uC785\uB825";
    }
  };
};
function Sf() {
  return { localeError: wf() };
}
var ze = (e) => {
  return e.charAt(0).toUpperCase() + e.slice(1);
};
function ea(e) {
  let n = Math.abs(e), r = n % 10, a = n % 100;
  if (a >= 11 && a <= 19 || r === 0) return "many";
  if (r === 1) return "one";
  return "few";
}
var xf = () => {
  let e = { string: { unit: { one: "simbolis", few: "simboliai", many: "simboli\u0173" }, verb: { smaller: { inclusive: "turi b\u016Bti ne ilgesn\u0117 kaip", notInclusive: "turi b\u016Bti trumpesn\u0117 kaip" }, bigger: { inclusive: "turi b\u016Bti ne trumpesn\u0117 kaip", notInclusive: "turi b\u016Bti ilgesn\u0117 kaip" } } }, file: { unit: { one: "baitas", few: "baitai", many: "bait\u0173" }, verb: { smaller: { inclusive: "turi b\u016Bti ne didesnis kaip", notInclusive: "turi b\u016Bti ma\u017Eesnis kaip" }, bigger: { inclusive: "turi b\u016Bti ne ma\u017Eesnis kaip", notInclusive: "turi b\u016Bti didesnis kaip" } } }, array: { unit: { one: "element\u0105", few: "elementus", many: "element\u0173" }, verb: { smaller: { inclusive: "turi tur\u0117ti ne daugiau kaip", notInclusive: "turi tur\u0117ti ma\u017Eiau kaip" }, bigger: { inclusive: "turi tur\u0117ti ne ma\u017Eiau kaip", notInclusive: "turi tur\u0117ti daugiau kaip" } } }, set: { unit: { one: "element\u0105", few: "elementus", many: "element\u0173" }, verb: { smaller: { inclusive: "turi tur\u0117ti ne daugiau kaip", notInclusive: "turi tur\u0117ti ma\u017Eiau kaip" }, bigger: { inclusive: "turi tur\u0117ti ne ma\u017Eiau kaip", notInclusive: "turi tur\u0117ti daugiau kaip" } } } };
  function n(t, i, o, u) {
    let l = e[t] ?? null;
    if (l === null) return l;
    return { unit: l.unit[i], verb: l.verb[u][o ? "inclusive" : "notInclusive"] };
  }
  let r = { regex: "\u012Fvestis", email: "el. pa\u0161to adresas", url: "URL", emoji: "jaustukas", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO data ir laikas", date: "ISO data", time: "ISO laikas", duration: "ISO trukm\u0117", ipv4: "IPv4 adresas", ipv6: "IPv6 adresas", cidrv4: "IPv4 tinklo prefiksas (CIDR)", cidrv6: "IPv6 tinklo prefiksas (CIDR)", base64: "base64 u\u017Ekoduota eilut\u0117", base64url: "base64url u\u017Ekoduota eilut\u0117", json_string: "JSON eilut\u0117", e164: "E.164 numeris", jwt: "JWT", template_literal: "\u012Fvestis" }, a = { nan: "NaN", number: "skai\u010Dius", bigint: "sveikasis skai\u010Dius", string: "eilut\u0117", boolean: "login\u0117 reik\u0161m\u0117", undefined: "neapibr\u0117\u017Eta reik\u0161m\u0117", function: "funkcija", symbol: "simbolis", array: "masyvas", object: "objektas", null: "nulin\u0117 reik\u0161m\u0117" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Gautas tipas ${u}, o tik\u0117tasi - instanceof ${t.expected}`;
        return `Gautas tipas ${u}, o tik\u0117tasi - ${i}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Privalo b\u016Bti ${b(t.values[0])}`;
        return `Privalo b\u016Bti vienas i\u0161 ${g(t.values, "|")} pasirinkim\u0173`;
      case "too_big": {
        let i = a[t.origin] ?? t.origin, o = n(t.origin, ea(Number(t.maximum)), t.inclusive ?? false, "smaller");
        if (o?.verb) return `${ze(i ?? t.origin ?? "reik\u0161m\u0117")} ${o.verb} ${t.maximum.toString()} ${o.unit ?? "element\u0173"}`;
        let u = t.inclusive ? "ne didesnis kaip" : "ma\u017Eesnis kaip";
        return `${ze(i ?? t.origin ?? "reik\u0161m\u0117")} turi b\u016Bti ${u} ${t.maximum.toString()} ${o?.unit}`;
      }
      case "too_small": {
        let i = a[t.origin] ?? t.origin, o = n(t.origin, ea(Number(t.minimum)), t.inclusive ?? false, "bigger");
        if (o?.verb) return `${ze(i ?? t.origin ?? "reik\u0161m\u0117")} ${o.verb} ${t.minimum.toString()} ${o.unit ?? "element\u0173"}`;
        let u = t.inclusive ? "ne ma\u017Eesnis kaip" : "didesnis kaip";
        return `${ze(i ?? t.origin ?? "reik\u0161m\u0117")} turi b\u016Bti ${u} ${t.minimum.toString()} ${o?.unit}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `Eilut\u0117 privalo prasid\u0117ti "${i.prefix}"`;
        if (i.format === "ends_with") return `Eilut\u0117 privalo pasibaigti "${i.suffix}"`;
        if (i.format === "includes") return `Eilut\u0117 privalo \u012Ftraukti "${i.includes}"`;
        if (i.format === "regex") return `Eilut\u0117 privalo atitikti ${i.pattern}`;
        return `Neteisingas ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `Skai\u010Dius privalo b\u016Bti ${t.divisor} kartotinis.`;
      case "unrecognized_keys":
        return `Neatpa\u017Eint${t.keys.length > 1 ? "i" : "as"} rakt${t.keys.length > 1 ? "ai" : "as"}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return "Rastas klaidingas raktas";
      case "invalid_union":
        return "Klaidinga \u012Fvestis";
      case "invalid_element": {
        let i = a[t.origin] ?? t.origin;
        return `${ze(i ?? t.origin ?? "reik\u0161m\u0117")} turi klaiding\u0105 \u012Fvest\u012F`;
      }
      default:
        return "Klaidinga \u012Fvestis";
    }
  };
};
function Ef() {
  return { localeError: xf() };
}
var Of = () => {
  let e = { string: { unit: "\u0437\u043D\u0430\u0446\u0438", verb: "\u0434\u0430 \u0438\u043C\u0430\u0430\u0442" }, file: { unit: "\u0431\u0430\u0458\u0442\u0438", verb: "\u0434\u0430 \u0438\u043C\u0430\u0430\u0442" }, array: { unit: "\u0441\u0442\u0430\u0432\u043A\u0438", verb: "\u0434\u0430 \u0438\u043C\u0430\u0430\u0442" }, set: { unit: "\u0441\u0442\u0430\u0432\u043A\u0438", verb: "\u0434\u0430 \u0438\u043C\u0430\u0430\u0442" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "\u0432\u043D\u0435\u0441", email: "\u0430\u0434\u0440\u0435\u0441\u0430 \u043D\u0430 \u0435-\u043F\u043E\u0448\u0442\u0430", url: "URL", emoji: "\u0435\u043C\u043E\u045F\u0438", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO \u0434\u0430\u0442\u0443\u043C \u0438 \u0432\u0440\u0435\u043C\u0435", date: "ISO \u0434\u0430\u0442\u0443\u043C", time: "ISO \u0432\u0440\u0435\u043C\u0435", duration: "ISO \u0432\u0440\u0435\u043C\u0435\u0442\u0440\u0430\u0435\u045A\u0435", ipv4: "IPv4 \u0430\u0434\u0440\u0435\u0441\u0430", ipv6: "IPv6 \u0430\u0434\u0440\u0435\u0441\u0430", cidrv4: "IPv4 \u043E\u043F\u0441\u0435\u0433", cidrv6: "IPv6 \u043E\u043F\u0441\u0435\u0433", base64: "base64-\u0435\u043D\u043A\u043E\u0434\u0438\u0440\u0430\u043D\u0430 \u043D\u0438\u0437\u0430", base64url: "base64url-\u0435\u043D\u043A\u043E\u0434\u0438\u0440\u0430\u043D\u0430 \u043D\u0438\u0437\u0430", json_string: "JSON \u043D\u0438\u0437\u0430", e164: "E.164 \u0431\u0440\u043E\u0458", jwt: "JWT", template_literal: "\u0432\u043D\u0435\u0441" }, a = { nan: "NaN", number: "\u0431\u0440\u043E\u0458", array: "\u043D\u0438\u0437\u0430" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `\u0413\u0440\u0435\u0448\u0435\u043D \u0432\u043D\u0435\u0441: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 instanceof ${t.expected}, \u043F\u0440\u0438\u043C\u0435\u043D\u043E ${u}`;
        return `\u0413\u0440\u0435\u0448\u0435\u043D \u0432\u043D\u0435\u0441: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 ${i}, \u043F\u0440\u0438\u043C\u0435\u043D\u043E ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Invalid input: expected ${b(t.values[0])}`;
        return `\u0413\u0440\u0435\u0448\u0430\u043D\u0430 \u043E\u043F\u0446\u0438\u0458\u0430: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 \u0435\u0434\u043D\u0430 ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `\u041F\u0440\u0435\u043C\u043D\u043E\u0433\u0443 \u0433\u043E\u043B\u0435\u043C: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 ${t.origin ?? "\u0432\u0440\u0435\u0434\u043D\u043E\u0441\u0442\u0430"} \u0434\u0430 \u0438\u043C\u0430 ${i}${t.maximum.toString()} ${o.unit ?? "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0438"}`;
        return `\u041F\u0440\u0435\u043C\u043D\u043E\u0433\u0443 \u0433\u043E\u043B\u0435\u043C: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 ${t.origin ?? "\u0432\u0440\u0435\u0434\u043D\u043E\u0441\u0442\u0430"} \u0434\u0430 \u0431\u0438\u0434\u0435 ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `\u041F\u0440\u0435\u043C\u043D\u043E\u0433\u0443 \u043C\u0430\u043B: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 ${t.origin} \u0434\u0430 \u0438\u043C\u0430 ${i}${t.minimum.toString()} ${o.unit}`;
        return `\u041F\u0440\u0435\u043C\u043D\u043E\u0433\u0443 \u043C\u0430\u043B: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 ${t.origin} \u0434\u0430 \u0431\u0438\u0434\u0435 ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `\u041D\u0435\u0432\u0430\u0436\u0435\u0447\u043A\u0430 \u043D\u0438\u0437\u0430: \u043C\u043E\u0440\u0430 \u0434\u0430 \u0437\u0430\u043F\u043E\u0447\u043D\u0443\u0432\u0430 \u0441\u043E "${i.prefix}"`;
        if (i.format === "ends_with") return `\u041D\u0435\u0432\u0430\u0436\u0435\u0447\u043A\u0430 \u043D\u0438\u0437\u0430: \u043C\u043E\u0440\u0430 \u0434\u0430 \u0437\u0430\u0432\u0440\u0448\u0443\u0432\u0430 \u0441\u043E "${i.suffix}"`;
        if (i.format === "includes") return `\u041D\u0435\u0432\u0430\u0436\u0435\u0447\u043A\u0430 \u043D\u0438\u0437\u0430: \u043C\u043E\u0440\u0430 \u0434\u0430 \u0432\u043A\u043B\u0443\u0447\u0443\u0432\u0430 "${i.includes}"`;
        if (i.format === "regex") return `\u041D\u0435\u0432\u0430\u0436\u0435\u0447\u043A\u0430 \u043D\u0438\u0437\u0430: \u043C\u043E\u0440\u0430 \u0434\u0430 \u043E\u0434\u0433\u043E\u0430\u0440\u0430 \u043D\u0430 \u043F\u0430\u0442\u0435\u0440\u043D\u043E\u0442 ${i.pattern}`;
        return `Invalid ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `\u0413\u0440\u0435\u0448\u0435\u043D \u0431\u0440\u043E\u0458: \u043C\u043E\u0440\u0430 \u0434\u0430 \u0431\u0438\u0434\u0435 \u0434\u0435\u043B\u0438\u0432 \u0441\u043E ${t.divisor}`;
      case "unrecognized_keys":
        return `${t.keys.length > 1 ? "\u041D\u0435\u043F\u0440\u0435\u043F\u043E\u0437\u043D\u0430\u0435\u043D\u0438 \u043A\u043B\u0443\u0447\u0435\u0432\u0438" : "\u041D\u0435\u043F\u0440\u0435\u043F\u043E\u0437\u043D\u0430\u0435\u043D \u043A\u043B\u0443\u0447"}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `\u0413\u0440\u0435\u0448\u0435\u043D \u043A\u043B\u0443\u0447 \u0432\u043E ${t.origin}`;
      case "invalid_union":
        return "\u0413\u0440\u0435\u0448\u0435\u043D \u0432\u043D\u0435\u0441";
      case "invalid_element":
        return `\u0413\u0440\u0435\u0448\u043D\u0430 \u0432\u0440\u0435\u0434\u043D\u043E\u0441\u0442 \u0432\u043E ${t.origin}`;
      default:
        return "\u0413\u0440\u0435\u0448\u0435\u043D \u0432\u043D\u0435\u0441";
    }
  };
};
function Tf() {
  return { localeError: Of() };
}
var Nf = () => {
  let e = { string: { unit: "aksara", verb: "mempunyai" }, file: { unit: "bait", verb: "mempunyai" }, array: { unit: "elemen", verb: "mempunyai" }, set: { unit: "elemen", verb: "mempunyai" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "input", email: "alamat e-mel", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "tarikh masa ISO", date: "tarikh ISO", time: "masa ISO", duration: "tempoh ISO", ipv4: "alamat IPv4", ipv6: "alamat IPv6", cidrv4: "julat IPv4", cidrv6: "julat IPv6", base64: "string dikodkan base64", base64url: "string dikodkan base64url", json_string: "string JSON", e164: "nombor E.164", jwt: "JWT", template_literal: "input" }, a = { nan: "NaN", number: "nombor" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Input tidak sah: dijangka instanceof ${t.expected}, diterima ${u}`;
        return `Input tidak sah: dijangka ${i}, diterima ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Input tidak sah: dijangka ${b(t.values[0])}`;
        return `Pilihan tidak sah: dijangka salah satu daripada ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `Terlalu besar: dijangka ${t.origin ?? "nilai"} ${o.verb} ${i}${t.maximum.toString()} ${o.unit ?? "elemen"}`;
        return `Terlalu besar: dijangka ${t.origin ?? "nilai"} adalah ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `Terlalu kecil: dijangka ${t.origin} ${o.verb} ${i}${t.minimum.toString()} ${o.unit}`;
        return `Terlalu kecil: dijangka ${t.origin} adalah ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `String tidak sah: mesti bermula dengan "${i.prefix}"`;
        if (i.format === "ends_with") return `String tidak sah: mesti berakhir dengan "${i.suffix}"`;
        if (i.format === "includes") return `String tidak sah: mesti mengandungi "${i.includes}"`;
        if (i.format === "regex") return `String tidak sah: mesti sepadan dengan corak ${i.pattern}`;
        return `${r[i.format] ?? t.format} tidak sah`;
      }
      case "not_multiple_of":
        return `Nombor tidak sah: perlu gandaan ${t.divisor}`;
      case "unrecognized_keys":
        return `Kunci tidak dikenali: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `Kunci tidak sah dalam ${t.origin}`;
      case "invalid_union":
        return "Input tidak sah";
      case "invalid_element":
        return `Nilai tidak sah dalam ${t.origin}`;
      default:
        return "Input tidak sah";
    }
  };
};
function zf() {
  return { localeError: Nf() };
}
var Uf = () => {
  let e = { string: { unit: "tekens", verb: "heeft" }, file: { unit: "bytes", verb: "heeft" }, array: { unit: "elementen", verb: "heeft" }, set: { unit: "elementen", verb: "heeft" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "invoer", email: "emailadres", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO datum en tijd", date: "ISO datum", time: "ISO tijd", duration: "ISO duur", ipv4: "IPv4-adres", ipv6: "IPv6-adres", cidrv4: "IPv4-bereik", cidrv6: "IPv6-bereik", base64: "base64-gecodeerde tekst", base64url: "base64 URL-gecodeerde tekst", json_string: "JSON string", e164: "E.164-nummer", jwt: "JWT", template_literal: "invoer" }, a = { nan: "NaN", number: "getal" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Ongeldige invoer: verwacht instanceof ${t.expected}, ontving ${u}`;
        return `Ongeldige invoer: verwacht ${i}, ontving ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Ongeldige invoer: verwacht ${b(t.values[0])}`;
        return `Ongeldige optie: verwacht \xE9\xE9n van ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin), u = t.origin === "date" ? "laat" : t.origin === "string" ? "lang" : "groot";
        if (o) return `Te ${u}: verwacht dat ${t.origin ?? "waarde"} ${i}${t.maximum.toString()} ${o.unit ?? "elementen"} ${o.verb}`;
        return `Te ${u}: verwacht dat ${t.origin ?? "waarde"} ${i}${t.maximum.toString()} is`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin), u = t.origin === "date" ? "vroeg" : t.origin === "string" ? "kort" : "klein";
        if (o) return `Te ${u}: verwacht dat ${t.origin} ${i}${t.minimum.toString()} ${o.unit} ${o.verb}`;
        return `Te ${u}: verwacht dat ${t.origin} ${i}${t.minimum.toString()} is`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `Ongeldige tekst: moet met "${i.prefix}" beginnen`;
        if (i.format === "ends_with") return `Ongeldige tekst: moet op "${i.suffix}" eindigen`;
        if (i.format === "includes") return `Ongeldige tekst: moet "${i.includes}" bevatten`;
        if (i.format === "regex") return `Ongeldige tekst: moet overeenkomen met patroon ${i.pattern}`;
        return `Ongeldig: ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `Ongeldig getal: moet een veelvoud van ${t.divisor} zijn`;
      case "unrecognized_keys":
        return `Onbekende key${t.keys.length > 1 ? "s" : ""}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `Ongeldige key in ${t.origin}`;
      case "invalid_union":
        return "Ongeldige invoer";
      case "invalid_element":
        return `Ongeldige waarde in ${t.origin}`;
      default:
        return "Ongeldige invoer";
    }
  };
};
function Af() {
  return { localeError: Uf() };
}
var Df = () => {
  let e = { string: { unit: "tegn", verb: "\xE5 ha" }, file: { unit: "bytes", verb: "\xE5 ha" }, array: { unit: "elementer", verb: "\xE5 inneholde" }, set: { unit: "elementer", verb: "\xE5 inneholde" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "input", email: "e-postadresse", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO dato- og klokkeslett", date: "ISO-dato", time: "ISO-klokkeslett", duration: "ISO-varighet", ipv4: "IPv4-omr\xE5de", ipv6: "IPv6-omr\xE5de", cidrv4: "IPv4-spekter", cidrv6: "IPv6-spekter", base64: "base64-enkodet streng", base64url: "base64url-enkodet streng", json_string: "JSON-streng", e164: "E.164-nummer", jwt: "JWT", template_literal: "input" }, a = { nan: "NaN", number: "tall", array: "liste" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Ugyldig input: forventet instanceof ${t.expected}, fikk ${u}`;
        return `Ugyldig input: forventet ${i}, fikk ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Ugyldig verdi: forventet ${b(t.values[0])}`;
        return `Ugyldig valg: forventet en av ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `For stor(t): forventet ${t.origin ?? "value"} til \xE5 ha ${i}${t.maximum.toString()} ${o.unit ?? "elementer"}`;
        return `For stor(t): forventet ${t.origin ?? "value"} til \xE5 ha ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `For lite(n): forventet ${t.origin} til \xE5 ha ${i}${t.minimum.toString()} ${o.unit}`;
        return `For lite(n): forventet ${t.origin} til \xE5 ha ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `Ugyldig streng: m\xE5 starte med "${i.prefix}"`;
        if (i.format === "ends_with") return `Ugyldig streng: m\xE5 ende med "${i.suffix}"`;
        if (i.format === "includes") return `Ugyldig streng: m\xE5 inneholde "${i.includes}"`;
        if (i.format === "regex") return `Ugyldig streng: m\xE5 matche m\xF8nsteret ${i.pattern}`;
        return `Ugyldig ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `Ugyldig tall: m\xE5 v\xE6re et multiplum av ${t.divisor}`;
      case "unrecognized_keys":
        return `${t.keys.length > 1 ? "Ukjente n\xF8kler" : "Ukjent n\xF8kkel"}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `Ugyldig n\xF8kkel i ${t.origin}`;
      case "invalid_union":
        return "Ugyldig input";
      case "invalid_element":
        return `Ugyldig verdi i ${t.origin}`;
      default:
        return "Ugyldig input";
    }
  };
};
function Pf() {
  return { localeError: Df() };
}
var jf = () => {
  let e = { string: { unit: "harf", verb: "olmal\u0131d\u0131r" }, file: { unit: "bayt", verb: "olmal\u0131d\u0131r" }, array: { unit: "unsur", verb: "olmal\u0131d\u0131r" }, set: { unit: "unsur", verb: "olmal\u0131d\u0131r" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "giren", email: "epostag\xE2h", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO heng\xE2m\u0131", date: "ISO tarihi", time: "ISO zaman\u0131", duration: "ISO m\xFCddeti", ipv4: "IPv4 ni\u015F\xE2n\u0131", ipv6: "IPv6 ni\u015F\xE2n\u0131", cidrv4: "IPv4 menzili", cidrv6: "IPv6 menzili", base64: "base64-\u015Fifreli metin", base64url: "base64url-\u015Fifreli metin", json_string: "JSON metin", e164: "E.164 say\u0131s\u0131", jwt: "JWT", template_literal: "giren" }, a = { nan: "NaN", number: "numara", array: "saf", null: "gayb" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `F\xE2sit giren: umulan instanceof ${t.expected}, al\u0131nan ${u}`;
        return `F\xE2sit giren: umulan ${i}, al\u0131nan ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `F\xE2sit giren: umulan ${b(t.values[0])}`;
        return `F\xE2sit tercih: m\xFBteberler ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `Fazla b\xFCy\xFCk: ${t.origin ?? "value"}, ${i}${t.maximum.toString()} ${o.unit ?? "elements"} sahip olmal\u0131yd\u0131.`;
        return `Fazla b\xFCy\xFCk: ${t.origin ?? "value"}, ${i}${t.maximum.toString()} olmal\u0131yd\u0131.`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `Fazla k\xFC\xE7\xFCk: ${t.origin}, ${i}${t.minimum.toString()} ${o.unit} sahip olmal\u0131yd\u0131.`;
        return `Fazla k\xFC\xE7\xFCk: ${t.origin}, ${i}${t.minimum.toString()} olmal\u0131yd\u0131.`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `F\xE2sit metin: "${i.prefix}" ile ba\u015Flamal\u0131.`;
        if (i.format === "ends_with") return `F\xE2sit metin: "${i.suffix}" ile bitmeli.`;
        if (i.format === "includes") return `F\xE2sit metin: "${i.includes}" ihtiv\xE2 etmeli.`;
        if (i.format === "regex") return `F\xE2sit metin: ${i.pattern} nak\u015F\u0131na uymal\u0131.`;
        return `F\xE2sit ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `F\xE2sit say\u0131: ${t.divisor} kat\u0131 olmal\u0131yd\u0131.`;
      case "unrecognized_keys":
        return `Tan\u0131nmayan anahtar ${t.keys.length > 1 ? "s" : ""}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `${t.origin} i\xE7in tan\u0131nmayan anahtar var.`;
      case "invalid_union":
        return "Giren tan\u0131namad\u0131.";
      case "invalid_element":
        return `${t.origin} i\xE7in tan\u0131nmayan k\u0131ymet var.`;
      default:
        return "K\u0131ymet tan\u0131namad\u0131.";
    }
  };
};
function Cf() {
  return { localeError: jf() };
}
var Rf = () => {
  let e = { string: { unit: "\u062A\u0648\u06A9\u064A", verb: "\u0648\u0644\u0631\u064A" }, file: { unit: "\u0628\u0627\u06CC\u067C\u0633", verb: "\u0648\u0644\u0631\u064A" }, array: { unit: "\u062A\u0648\u06A9\u064A", verb: "\u0648\u0644\u0631\u064A" }, set: { unit: "\u062A\u0648\u06A9\u064A", verb: "\u0648\u0644\u0631\u064A" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "\u0648\u0631\u0648\u062F\u064A", email: "\u0628\u0631\u06CC\u069A\u0646\u0627\u0644\u06CC\u06A9", url: "\u06CC\u0648 \u0622\u0631 \u0627\u0644", emoji: "\u0627\u06CC\u0645\u0648\u062C\u064A", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "\u0646\u06CC\u067C\u0647 \u0627\u0648 \u0648\u062E\u062A", date: "\u0646\u06D0\u067C\u0647", time: "\u0648\u062E\u062A", duration: "\u0645\u0648\u062F\u0647", ipv4: "\u062F IPv4 \u067E\u062A\u0647", ipv6: "\u062F IPv6 \u067E\u062A\u0647", cidrv4: "\u062F IPv4 \u0633\u0627\u062D\u0647", cidrv6: "\u062F IPv6 \u0633\u0627\u062D\u0647", base64: "base64-encoded \u0645\u062A\u0646", base64url: "base64url-encoded \u0645\u062A\u0646", json_string: "JSON \u0645\u062A\u0646", e164: "\u062F E.164 \u0634\u0645\u06D0\u0631\u0647", jwt: "JWT", template_literal: "\u0648\u0631\u0648\u062F\u064A" }, a = { nan: "NaN", number: "\u0639\u062F\u062F", array: "\u0627\u0631\u06D0" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `\u0646\u0627\u0633\u0645 \u0648\u0631\u0648\u062F\u064A: \u0628\u0627\u06CC\u062F instanceof ${t.expected} \u0648\u0627\u06CC, \u0645\u06AB\u0631 ${u} \u062A\u0631\u0644\u0627\u0633\u0647 \u0634\u0648`;
        return `\u0646\u0627\u0633\u0645 \u0648\u0631\u0648\u062F\u064A: \u0628\u0627\u06CC\u062F ${i} \u0648\u0627\u06CC, \u0645\u06AB\u0631 ${u} \u062A\u0631\u0644\u0627\u0633\u0647 \u0634\u0648`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `\u0646\u0627\u0633\u0645 \u0648\u0631\u0648\u062F\u064A: \u0628\u0627\u06CC\u062F ${b(t.values[0])} \u0648\u0627\u06CC`;
        return `\u0646\u0627\u0633\u0645 \u0627\u0646\u062A\u062E\u0627\u0628: \u0628\u0627\u06CC\u062F \u06CC\u0648 \u0644\u0647 ${g(t.values, "|")} \u0685\u062E\u0647 \u0648\u0627\u06CC`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `\u0689\u06CC\u0631 \u0644\u0648\u06CC: ${t.origin ?? "\u0627\u0631\u0632\u069A\u062A"} \u0628\u0627\u06CC\u062F ${i}${t.maximum.toString()} ${o.unit ?? "\u0639\u0646\u0635\u0631\u0648\u0646\u0647"} \u0648\u0644\u0631\u064A`;
        return `\u0689\u06CC\u0631 \u0644\u0648\u06CC: ${t.origin ?? "\u0627\u0631\u0632\u069A\u062A"} \u0628\u0627\u06CC\u062F ${i}${t.maximum.toString()} \u0648\u064A`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `\u0689\u06CC\u0631 \u06A9\u0648\u0686\u0646\u06CC: ${t.origin} \u0628\u0627\u06CC\u062F ${i}${t.minimum.toString()} ${o.unit} \u0648\u0644\u0631\u064A`;
        return `\u0689\u06CC\u0631 \u06A9\u0648\u0686\u0646\u06CC: ${t.origin} \u0628\u0627\u06CC\u062F ${i}${t.minimum.toString()} \u0648\u064A`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `\u0646\u0627\u0633\u0645 \u0645\u062A\u0646: \u0628\u0627\u06CC\u062F \u062F "${i.prefix}" \u0633\u0631\u0647 \u067E\u06CC\u0644 \u0634\u064A`;
        if (i.format === "ends_with") return `\u0646\u0627\u0633\u0645 \u0645\u062A\u0646: \u0628\u0627\u06CC\u062F \u062F "${i.suffix}" \u0633\u0631\u0647 \u067E\u0627\u06CC \u062A\u0647 \u0648\u0631\u0633\u064A\u0696\u064A`;
        if (i.format === "includes") return `\u0646\u0627\u0633\u0645 \u0645\u062A\u0646: \u0628\u0627\u06CC\u062F "${i.includes}" \u0648\u0644\u0631\u064A`;
        if (i.format === "regex") return `\u0646\u0627\u0633\u0645 \u0645\u062A\u0646: \u0628\u0627\u06CC\u062F \u062F ${i.pattern} \u0633\u0631\u0647 \u0645\u0637\u0627\u0628\u0642\u062A \u0648\u0644\u0631\u064A`;
        return `${r[i.format] ?? t.format} \u0646\u0627\u0633\u0645 \u062F\u06CC`;
      }
      case "not_multiple_of":
        return `\u0646\u0627\u0633\u0645 \u0639\u062F\u062F: \u0628\u0627\u06CC\u062F \u062F ${t.divisor} \u0645\u0636\u0631\u0628 \u0648\u064A`;
      case "unrecognized_keys":
        return `\u0646\u0627\u0633\u0645 ${t.keys.length > 1 ? "\u06A9\u0644\u06CC\u0689\u0648\u0646\u0647" : "\u06A9\u0644\u06CC\u0689"}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `\u0646\u0627\u0633\u0645 \u06A9\u0644\u06CC\u0689 \u067E\u0647 ${t.origin} \u06A9\u06D0`;
      case "invalid_union":
        return "\u0646\u0627\u0633\u0645\u0647 \u0648\u0631\u0648\u062F\u064A";
      case "invalid_element":
        return `\u0646\u0627\u0633\u0645 \u0639\u0646\u0635\u0631 \u067E\u0647 ${t.origin} \u06A9\u06D0`;
      default:
        return "\u0646\u0627\u0633\u0645\u0647 \u0648\u0631\u0648\u062F\u064A";
    }
  };
};
function Zf() {
  return { localeError: Rf() };
}
var Lf = () => {
  let e = { string: { unit: "znak\xF3w", verb: "mie\u0107" }, file: { unit: "bajt\xF3w", verb: "mie\u0107" }, array: { unit: "element\xF3w", verb: "mie\u0107" }, set: { unit: "element\xF3w", verb: "mie\u0107" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "wyra\u017Cenie", email: "adres email", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "data i godzina w formacie ISO", date: "data w formacie ISO", time: "godzina w formacie ISO", duration: "czas trwania ISO", ipv4: "adres IPv4", ipv6: "adres IPv6", cidrv4: "zakres IPv4", cidrv6: "zakres IPv6", base64: "ci\u0105g znak\xF3w zakodowany w formacie base64", base64url: "ci\u0105g znak\xF3w zakodowany w formacie base64url", json_string: "ci\u0105g znak\xF3w w formacie JSON", e164: "liczba E.164", jwt: "JWT", template_literal: "wej\u015Bcie" }, a = { nan: "NaN", number: "liczba", array: "tablica" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Nieprawid\u0142owe dane wej\u015Bciowe: oczekiwano instanceof ${t.expected}, otrzymano ${u}`;
        return `Nieprawid\u0142owe dane wej\u015Bciowe: oczekiwano ${i}, otrzymano ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Nieprawid\u0142owe dane wej\u015Bciowe: oczekiwano ${b(t.values[0])}`;
        return `Nieprawid\u0142owa opcja: oczekiwano jednej z warto\u015Bci ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `Za du\u017Ca warto\u015B\u0107: oczekiwano, \u017Ce ${t.origin ?? "warto\u015B\u0107"} b\u0119dzie mie\u0107 ${i}${t.maximum.toString()} ${o.unit ?? "element\xF3w"}`;
        return `Zbyt du\u017C(y/a/e): oczekiwano, \u017Ce ${t.origin ?? "warto\u015B\u0107"} b\u0119dzie wynosi\u0107 ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `Za ma\u0142a warto\u015B\u0107: oczekiwano, \u017Ce ${t.origin ?? "warto\u015B\u0107"} b\u0119dzie mie\u0107 ${i}${t.minimum.toString()} ${o.unit ?? "element\xF3w"}`;
        return `Zbyt ma\u0142(y/a/e): oczekiwano, \u017Ce ${t.origin ?? "warto\u015B\u0107"} b\u0119dzie wynosi\u0107 ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `Nieprawid\u0142owy ci\u0105g znak\xF3w: musi zaczyna\u0107 si\u0119 od "${i.prefix}"`;
        if (i.format === "ends_with") return `Nieprawid\u0142owy ci\u0105g znak\xF3w: musi ko\u0144czy\u0107 si\u0119 na "${i.suffix}"`;
        if (i.format === "includes") return `Nieprawid\u0142owy ci\u0105g znak\xF3w: musi zawiera\u0107 "${i.includes}"`;
        if (i.format === "regex") return `Nieprawid\u0142owy ci\u0105g znak\xF3w: musi odpowiada\u0107 wzorcowi ${i.pattern}`;
        return `Nieprawid\u0142ow(y/a/e) ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `Nieprawid\u0142owa liczba: musi by\u0107 wielokrotno\u015Bci\u0105 ${t.divisor}`;
      case "unrecognized_keys":
        return `Nierozpoznane klucze${t.keys.length > 1 ? "s" : ""}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `Nieprawid\u0142owy klucz w ${t.origin}`;
      case "invalid_union":
        return "Nieprawid\u0142owe dane wej\u015Bciowe";
      case "invalid_element":
        return `Nieprawid\u0142owa warto\u015B\u0107 w ${t.origin}`;
      default:
        return "Nieprawid\u0142owe dane wej\u015Bciowe";
    }
  };
};
function Mf() {
  return { localeError: Lf() };
}
var Bf = () => {
  let e = { string: { unit: "caracteres", verb: "ter" }, file: { unit: "bytes", verb: "ter" }, array: { unit: "itens", verb: "ter" }, set: { unit: "itens", verb: "ter" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "padr\xE3o", email: "endere\xE7o de e-mail", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "data e hora ISO", date: "data ISO", time: "hora ISO", duration: "dura\xE7\xE3o ISO", ipv4: "endere\xE7o IPv4", ipv6: "endere\xE7o IPv6", cidrv4: "faixa de IPv4", cidrv6: "faixa de IPv6", base64: "texto codificado em base64", base64url: "URL codificada em base64", json_string: "texto JSON", e164: "n\xFAmero E.164", jwt: "JWT", template_literal: "entrada" }, a = { nan: "NaN", number: "n\xFAmero", null: "nulo" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Tipo inv\xE1lido: esperado instanceof ${t.expected}, recebido ${u}`;
        return `Tipo inv\xE1lido: esperado ${i}, recebido ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Entrada inv\xE1lida: esperado ${b(t.values[0])}`;
        return `Op\xE7\xE3o inv\xE1lida: esperada uma das ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `Muito grande: esperado que ${t.origin ?? "valor"} tivesse ${i}${t.maximum.toString()} ${o.unit ?? "elementos"}`;
        return `Muito grande: esperado que ${t.origin ?? "valor"} fosse ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `Muito pequeno: esperado que ${t.origin} tivesse ${i}${t.minimum.toString()} ${o.unit}`;
        return `Muito pequeno: esperado que ${t.origin} fosse ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `Texto inv\xE1lido: deve come\xE7ar com "${i.prefix}"`;
        if (i.format === "ends_with") return `Texto inv\xE1lido: deve terminar com "${i.suffix}"`;
        if (i.format === "includes") return `Texto inv\xE1lido: deve incluir "${i.includes}"`;
        if (i.format === "regex") return `Texto inv\xE1lido: deve corresponder ao padr\xE3o ${i.pattern}`;
        return `${r[i.format] ?? t.format} inv\xE1lido`;
      }
      case "not_multiple_of":
        return `N\xFAmero inv\xE1lido: deve ser m\xFAltiplo de ${t.divisor}`;
      case "unrecognized_keys":
        return `Chave${t.keys.length > 1 ? "s" : ""} desconhecida${t.keys.length > 1 ? "s" : ""}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `Chave inv\xE1lida em ${t.origin}`;
      case "invalid_union":
        return "Entrada inv\xE1lida";
      case "invalid_element":
        return `Valor inv\xE1lido em ${t.origin}`;
      default:
        return "Campo inv\xE1lido";
    }
  };
};
function Ff() {
  return { localeError: Bf() };
}
var Jf = () => {
  let e = { string: { unit: "caractere", verb: "s\u0103 aib\u0103" }, file: { unit: "octe\u021Bi", verb: "s\u0103 aib\u0103" }, array: { unit: "elemente", verb: "s\u0103 aib\u0103" }, set: { unit: "elemente", verb: "s\u0103 aib\u0103" }, map: { unit: "intr\u0103ri", verb: "s\u0103 aib\u0103" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "intrare", email: "adres\u0103 de email", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "dat\u0103 \u0219i or\u0103 ISO", date: "dat\u0103 ISO", time: "or\u0103 ISO", duration: "durat\u0103 ISO", ipv4: "adres\u0103 IPv4", ipv6: "adres\u0103 IPv6", mac: "adres\u0103 MAC", cidrv4: "interval IPv4", cidrv6: "interval IPv6", base64: "\u0219ir codat base64", base64url: "\u0219ir codat base64url", json_string: "\u0219ir JSON", e164: "num\u0103r E.164", jwt: "JWT", template_literal: "intrare" }, a = { nan: "NaN", string: "\u0219ir", number: "num\u0103r", boolean: "boolean", function: "func\u021Bie", array: "matrice", object: "obiect", undefined: "nedefinit", symbol: "simbol", bigint: "num\u0103r mare", void: "void", never: "never", map: "hart\u0103", set: "set" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        return `Intrare invalid\u0103: a\u0219teptat ${i}, primit ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Intrare invalid\u0103: a\u0219teptat ${b(t.values[0])}`;
        return `Op\u021Biune invalid\u0103: a\u0219teptat una dintre ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `Prea mare: a\u0219teptat ca ${t.origin ?? "valoarea"} ${o.verb} ${i}${t.maximum.toString()} ${o.unit ?? "elemente"}`;
        return `Prea mare: a\u0219teptat ca ${t.origin ?? "valoarea"} s\u0103 fie ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `Prea mic: a\u0219teptat ca ${t.origin} ${o.verb} ${i}${t.minimum.toString()} ${o.unit}`;
        return `Prea mic: a\u0219teptat ca ${t.origin} s\u0103 fie ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `\u0218ir invalid: trebuie s\u0103 \xEEnceap\u0103 cu "${i.prefix}"`;
        if (i.format === "ends_with") return `\u0218ir invalid: trebuie s\u0103 se termine cu "${i.suffix}"`;
        if (i.format === "includes") return `\u0218ir invalid: trebuie s\u0103 includ\u0103 "${i.includes}"`;
        if (i.format === "regex") return `\u0218ir invalid: trebuie s\u0103 se potriveasc\u0103 cu modelul ${i.pattern}`;
        return `Format invalid: ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `Num\u0103r invalid: trebuie s\u0103 fie multiplu de ${t.divisor}`;
      case "unrecognized_keys":
        return `Chei nerecunoscute: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `Cheie invalid\u0103 \xEEn ${t.origin}`;
      case "invalid_union":
        return "Intrare invalid\u0103";
      case "invalid_element":
        return `Valoare invalid\u0103 \xEEn ${t.origin}`;
      default:
        return "Intrare invalid\u0103";
    }
  };
};
function Gf() {
  return { localeError: Jf() };
}
function ta(e, n, r, a) {
  let t = Math.abs(e), i = t % 10, o = t % 100;
  if (o >= 11 && o <= 19) return a;
  if (i === 1) return n;
  if (i >= 2 && i <= 4) return r;
  return a;
}
var Wf = () => {
  let e = { string: { unit: { one: "\u0441\u0438\u043C\u0432\u043E\u043B", few: "\u0441\u0438\u043C\u0432\u043E\u043B\u0430", many: "\u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432" }, verb: "\u0438\u043C\u0435\u0442\u044C" }, file: { unit: { one: "\u0431\u0430\u0439\u0442", few: "\u0431\u0430\u0439\u0442\u0430", many: "\u0431\u0430\u0439\u0442" }, verb: "\u0438\u043C\u0435\u0442\u044C" }, array: { unit: { one: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442", few: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430", many: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432" }, verb: "\u0438\u043C\u0435\u0442\u044C" }, set: { unit: { one: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442", few: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430", many: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432" }, verb: "\u0438\u043C\u0435\u0442\u044C" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "\u0432\u0432\u043E\u0434", email: "email \u0430\u0434\u0440\u0435\u0441", url: "URL", emoji: "\u044D\u043C\u043E\u0434\u0437\u0438", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO \u0434\u0430\u0442\u0430 \u0438 \u0432\u0440\u0435\u043C\u044F", date: "ISO \u0434\u0430\u0442\u0430", time: "ISO \u0432\u0440\u0435\u043C\u044F", duration: "ISO \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C", ipv4: "IPv4 \u0430\u0434\u0440\u0435\u0441", ipv6: "IPv6 \u0430\u0434\u0440\u0435\u0441", cidrv4: "IPv4 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D", cidrv6: "IPv6 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D", base64: "\u0441\u0442\u0440\u043E\u043A\u0430 \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 base64", base64url: "\u0441\u0442\u0440\u043E\u043A\u0430 \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 base64url", json_string: "JSON \u0441\u0442\u0440\u043E\u043A\u0430", e164: "\u043D\u043E\u043C\u0435\u0440 E.164", jwt: "JWT", template_literal: "\u0432\u0432\u043E\u0434" }, a = { nan: "NaN", number: "\u0447\u0438\u0441\u043B\u043E", array: "\u043C\u0430\u0441\u0441\u0438\u0432" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0432\u0432\u043E\u0434: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C instanceof ${t.expected}, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E ${u}`;
        return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0432\u0432\u043E\u0434: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C ${i}, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0432\u0432\u043E\u0434: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C ${b(t.values[0])}`;
        return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0432\u0430\u0440\u0438\u0430\u043D\u0442: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0434\u043D\u043E \u0438\u0437 ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) {
          let u = Number(t.maximum), l = ta(u, o.unit.one, o.unit.few, o.unit.many);
          return `\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C, \u0447\u0442\u043E ${t.origin ?? "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435"} \u0431\u0443\u0434\u0435\u0442 \u0438\u043C\u0435\u0442\u044C ${i}${t.maximum.toString()} ${l}`;
        }
        return `\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C, \u0447\u0442\u043E ${t.origin ?? "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435"} \u0431\u0443\u0434\u0435\u0442 ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) {
          let u = Number(t.minimum), l = ta(u, o.unit.one, o.unit.few, o.unit.many);
          return `\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u0430\u043B\u0435\u043D\u044C\u043A\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C, \u0447\u0442\u043E ${t.origin} \u0431\u0443\u0434\u0435\u0442 \u0438\u043C\u0435\u0442\u044C ${i}${t.minimum.toString()} ${l}`;
        }
        return `\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u0430\u043B\u0435\u043D\u044C\u043A\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C, \u0447\u0442\u043E ${t.origin} \u0431\u0443\u0434\u0435\u0442 ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430: \u0434\u043E\u043B\u0436\u043D\u0430 \u043D\u0430\u0447\u0438\u043D\u0430\u0442\u044C\u0441\u044F \u0441 "${i.prefix}"`;
        if (i.format === "ends_with") return `\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430: \u0434\u043E\u043B\u0436\u043D\u0430 \u0437\u0430\u043A\u0430\u043D\u0447\u0438\u0432\u0430\u0442\u044C\u0441\u044F \u043D\u0430 "${i.suffix}"`;
        if (i.format === "includes") return `\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430: \u0434\u043E\u043B\u0436\u043D\u0430 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C "${i.includes}"`;
        if (i.format === "regex") return `\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430: \u0434\u043E\u043B\u0436\u043D\u0430 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u043E\u0432\u0430\u0442\u044C \u0448\u0430\u0431\u043B\u043E\u043D\u0443 ${i.pattern}`;
        return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `\u041D\u0435\u0432\u0435\u0440\u043D\u043E\u0435 \u0447\u0438\u0441\u043B\u043E: \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u044B\u0442\u044C \u043A\u0440\u0430\u0442\u043D\u044B\u043C ${t.divisor}`;
      case "unrecognized_keys":
        return `\u041D\u0435\u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u043D\u043D${t.keys.length > 1 ? "\u044B\u0435" : "\u044B\u0439"} \u043A\u043B\u044E\u0447${t.keys.length > 1 ? "\u0438" : ""}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043A\u043B\u044E\u0447 \u0432 ${t.origin}`;
      case "invalid_union":
        return "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0435 \u0432\u0445\u043E\u0434\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435";
      case "invalid_element":
        return `\u041D\u0435\u0432\u0435\u0440\u043D\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0432 ${t.origin}`;
      default:
        return "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0435 \u0432\u0445\u043E\u0434\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435";
    }
  };
};
function Vf() {
  return { localeError: Wf() };
}
var Kf = () => {
  let e = { string: { unit: "znakov", verb: "imeti" }, file: { unit: "bajtov", verb: "imeti" }, array: { unit: "elementov", verb: "imeti" }, set: { unit: "elementov", verb: "imeti" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "vnos", email: "e-po\u0161tni naslov", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO datum in \u010Das", date: "ISO datum", time: "ISO \u010Das", duration: "ISO trajanje", ipv4: "IPv4 naslov", ipv6: "IPv6 naslov", cidrv4: "obseg IPv4", cidrv6: "obseg IPv6", base64: "base64 kodiran niz", base64url: "base64url kodiran niz", json_string: "JSON niz", e164: "E.164 \u0161tevilka", jwt: "JWT", template_literal: "vnos" }, a = { nan: "NaN", number: "\u0161tevilo", array: "tabela" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Neveljaven vnos: pri\u010Dakovano instanceof ${t.expected}, prejeto ${u}`;
        return `Neveljaven vnos: pri\u010Dakovano ${i}, prejeto ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Neveljaven vnos: pri\u010Dakovano ${b(t.values[0])}`;
        return `Neveljavna mo\u017Enost: pri\u010Dakovano eno izmed ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `Preveliko: pri\u010Dakovano, da bo ${t.origin ?? "vrednost"} imelo ${i}${t.maximum.toString()} ${o.unit ?? "elementov"}`;
        return `Preveliko: pri\u010Dakovano, da bo ${t.origin ?? "vrednost"} ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `Premajhno: pri\u010Dakovano, da bo ${t.origin} imelo ${i}${t.minimum.toString()} ${o.unit}`;
        return `Premajhno: pri\u010Dakovano, da bo ${t.origin} ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `Neveljaven niz: mora se za\u010Deti z "${i.prefix}"`;
        if (i.format === "ends_with") return `Neveljaven niz: mora se kon\u010Dati z "${i.suffix}"`;
        if (i.format === "includes") return `Neveljaven niz: mora vsebovati "${i.includes}"`;
        if (i.format === "regex") return `Neveljaven niz: mora ustrezati vzorcu ${i.pattern}`;
        return `Neveljaven ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `Neveljavno \u0161tevilo: mora biti ve\u010Dkratnik ${t.divisor}`;
      case "unrecognized_keys":
        return `Neprepoznan${t.keys.length > 1 ? "i klju\u010Di" : " klju\u010D"}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `Neveljaven klju\u010D v ${t.origin}`;
      case "invalid_union":
        return "Neveljaven vnos";
      case "invalid_element":
        return `Neveljavna vrednost v ${t.origin}`;
      default:
        return "Neveljaven vnos";
    }
  };
};
function qf() {
  return { localeError: Kf() };
}
var Hf = () => {
  let e = { string: { unit: "tecken", verb: "att ha" }, file: { unit: "bytes", verb: "att ha" }, array: { unit: "objekt", verb: "att inneh\xE5lla" }, set: { unit: "objekt", verb: "att inneh\xE5lla" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "regulj\xE4rt uttryck", email: "e-postadress", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO-datum och tid", date: "ISO-datum", time: "ISO-tid", duration: "ISO-varaktighet", ipv4: "IPv4-intervall", ipv6: "IPv6-intervall", cidrv4: "IPv4-spektrum", cidrv6: "IPv6-spektrum", base64: "base64-kodad str\xE4ng", base64url: "base64url-kodad str\xE4ng", json_string: "JSON-str\xE4ng", e164: "E.164-nummer", jwt: "JWT", template_literal: "mall-literal" }, a = { nan: "NaN", number: "antal", array: "lista" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Ogiltig inmatning: f\xF6rv\xE4ntat instanceof ${t.expected}, fick ${u}`;
        return `Ogiltig inmatning: f\xF6rv\xE4ntat ${i}, fick ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Ogiltig inmatning: f\xF6rv\xE4ntat ${b(t.values[0])}`;
        return `Ogiltigt val: f\xF6rv\xE4ntade en av ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `F\xF6r stor(t): f\xF6rv\xE4ntade ${t.origin ?? "v\xE4rdet"} att ha ${i}${t.maximum.toString()} ${o.unit ?? "element"}`;
        return `F\xF6r stor(t): f\xF6rv\xE4ntat ${t.origin ?? "v\xE4rdet"} att ha ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `F\xF6r lite(t): f\xF6rv\xE4ntade ${t.origin ?? "v\xE4rdet"} att ha ${i}${t.minimum.toString()} ${o.unit}`;
        return `F\xF6r lite(t): f\xF6rv\xE4ntade ${t.origin ?? "v\xE4rdet"} att ha ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `Ogiltig str\xE4ng: m\xE5ste b\xF6rja med "${i.prefix}"`;
        if (i.format === "ends_with") return `Ogiltig str\xE4ng: m\xE5ste sluta med "${i.suffix}"`;
        if (i.format === "includes") return `Ogiltig str\xE4ng: m\xE5ste inneh\xE5lla "${i.includes}"`;
        if (i.format === "regex") return `Ogiltig str\xE4ng: m\xE5ste matcha m\xF6nstret "${i.pattern}"`;
        return `Ogiltig(t) ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `Ogiltigt tal: m\xE5ste vara en multipel av ${t.divisor}`;
      case "unrecognized_keys":
        return `${t.keys.length > 1 ? "Ok\xE4nda nycklar" : "Ok\xE4nd nyckel"}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `Ogiltig nyckel i ${t.origin ?? "v\xE4rdet"}`;
      case "invalid_union":
        return "Ogiltig input";
      case "invalid_element":
        return `Ogiltigt v\xE4rde i ${t.origin ?? "v\xE4rdet"}`;
      default:
        return "Ogiltig input";
    }
  };
};
function Xf() {
  return { localeError: Hf() };
}
var Yf = () => {
  let e = { string: { unit: "\u0B8E\u0BB4\u0BC1\u0BA4\u0BCD\u0BA4\u0BC1\u0B95\u0BCD\u0B95\u0BB3\u0BCD", verb: "\u0B95\u0BCA\u0BA3\u0BCD\u0B9F\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD" }, file: { unit: "\u0BAA\u0BC8\u0B9F\u0BCD\u0B9F\u0BC1\u0B95\u0BB3\u0BCD", verb: "\u0B95\u0BCA\u0BA3\u0BCD\u0B9F\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD" }, array: { unit: "\u0B89\u0BB1\u0BC1\u0BAA\u0BCD\u0BAA\u0BC1\u0B95\u0BB3\u0BCD", verb: "\u0B95\u0BCA\u0BA3\u0BCD\u0B9F\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD" }, set: { unit: "\u0B89\u0BB1\u0BC1\u0BAA\u0BCD\u0BAA\u0BC1\u0B95\u0BB3\u0BCD", verb: "\u0B95\u0BCA\u0BA3\u0BCD\u0B9F\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "\u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1", email: "\u0BAE\u0BBF\u0BA9\u0BCD\u0BA9\u0B9E\u0BCD\u0B9A\u0BB2\u0BCD \u0BAE\u0BC1\u0B95\u0BB5\u0BB0\u0BBF", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO \u0BA4\u0BC7\u0BA4\u0BBF \u0BA8\u0BC7\u0BB0\u0BAE\u0BCD", date: "ISO \u0BA4\u0BC7\u0BA4\u0BBF", time: "ISO \u0BA8\u0BC7\u0BB0\u0BAE\u0BCD", duration: "ISO \u0B95\u0BBE\u0BB2 \u0B85\u0BB3\u0BB5\u0BC1", ipv4: "IPv4 \u0BAE\u0BC1\u0B95\u0BB5\u0BB0\u0BBF", ipv6: "IPv6 \u0BAE\u0BC1\u0B95\u0BB5\u0BB0\u0BBF", cidrv4: "IPv4 \u0BB5\u0BB0\u0BAE\u0BCD\u0BAA\u0BC1", cidrv6: "IPv6 \u0BB5\u0BB0\u0BAE\u0BCD\u0BAA\u0BC1", base64: "base64-encoded \u0B9A\u0BB0\u0BAE\u0BCD", base64url: "base64url-encoded \u0B9A\u0BB0\u0BAE\u0BCD", json_string: "JSON \u0B9A\u0BB0\u0BAE\u0BCD", e164: "E.164 \u0B8E\u0BA3\u0BCD", jwt: "JWT", template_literal: "input" }, a = { nan: "NaN", number: "\u0B8E\u0BA3\u0BCD", array: "\u0B85\u0BA3\u0BBF", null: "\u0BB5\u0BC6\u0BB1\u0BC1\u0BAE\u0BC8" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 instanceof ${t.expected}, \u0BAA\u0BC6\u0BB1\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${u}`;
        return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${i}, \u0BAA\u0BC6\u0BB1\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${b(t.values[0])}`;
        return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0BB5\u0BBF\u0BB0\u0BC1\u0BAA\u0BCD\u0BAA\u0BAE\u0BCD: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${g(t.values, "|")} \u0B87\u0BB2\u0BCD \u0B92\u0BA9\u0BCD\u0BB1\u0BC1`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `\u0BAE\u0BBF\u0B95 \u0BAA\u0BC6\u0BB0\u0BBF\u0BAF\u0BA4\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${t.origin ?? "\u0BAE\u0BA4\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1"} ${i}${t.maximum.toString()} ${o.unit ?? "\u0B89\u0BB1\u0BC1\u0BAA\u0BCD\u0BAA\u0BC1\u0B95\u0BB3\u0BCD"} \u0B86\u0B95 \u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
        return `\u0BAE\u0BBF\u0B95 \u0BAA\u0BC6\u0BB0\u0BBF\u0BAF\u0BA4\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${t.origin ?? "\u0BAE\u0BA4\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1"} ${i}${t.maximum.toString()} \u0B86\u0B95 \u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `\u0BAE\u0BBF\u0B95\u0B9A\u0BCD \u0B9A\u0BBF\u0BB1\u0BBF\u0BAF\u0BA4\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${t.origin} ${i}${t.minimum.toString()} ${o.unit} \u0B86\u0B95 \u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
        return `\u0BAE\u0BBF\u0B95\u0B9A\u0BCD \u0B9A\u0BBF\u0BB1\u0BBF\u0BAF\u0BA4\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${t.origin} ${i}${t.minimum.toString()} \u0B86\u0B95 \u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B9A\u0BB0\u0BAE\u0BCD: "${i.prefix}" \u0B87\u0BB2\u0BCD \u0BA4\u0BCA\u0B9F\u0B99\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
        if (i.format === "ends_with") return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B9A\u0BB0\u0BAE\u0BCD: "${i.suffix}" \u0B87\u0BB2\u0BCD \u0BAE\u0BC1\u0B9F\u0BBF\u0BB5\u0B9F\u0BC8\u0BAF \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
        if (i.format === "includes") return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B9A\u0BB0\u0BAE\u0BCD: "${i.includes}" \u0B90 \u0B89\u0BB3\u0BCD\u0BB3\u0B9F\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
        if (i.format === "regex") return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B9A\u0BB0\u0BAE\u0BCD: ${i.pattern} \u0BAE\u0BC1\u0BB1\u0BC8\u0BAA\u0BBE\u0B9F\u0BCD\u0B9F\u0BC1\u0B9F\u0BA9\u0BCD \u0BAA\u0BCA\u0BB0\u0BC1\u0BA8\u0BCD\u0BA4 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
        return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B8E\u0BA3\u0BCD: ${t.divisor} \u0B87\u0BA9\u0BCD \u0BAA\u0BB2\u0BAE\u0BBE\u0B95 \u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
      case "unrecognized_keys":
        return `\u0B85\u0B9F\u0BC8\u0BAF\u0BBE\u0BB3\u0BAE\u0BCD \u0BA4\u0BC6\u0BB0\u0BBF\u0BAF\u0BBE\u0BA4 \u0BB5\u0BBF\u0B9A\u0BC8${t.keys.length > 1 ? "\u0B95\u0BB3\u0BCD" : ""}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `${t.origin} \u0B87\u0BB2\u0BCD \u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0BB5\u0BBF\u0B9A\u0BC8`;
      case "invalid_union":
        return "\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1";
      case "invalid_element":
        return `${t.origin} \u0B87\u0BB2\u0BCD \u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0BAE\u0BA4\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1`;
      default:
        return "\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1";
    }
  };
};
function Qf() {
  return { localeError: Yf() };
}
var ep = () => {
  let e = { string: { unit: "\u0E15\u0E31\u0E27\u0E2D\u0E31\u0E01\u0E29\u0E23", verb: "\u0E04\u0E27\u0E23\u0E21\u0E35" }, file: { unit: "\u0E44\u0E1A\u0E15\u0E4C", verb: "\u0E04\u0E27\u0E23\u0E21\u0E35" }, array: { unit: "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23", verb: "\u0E04\u0E27\u0E23\u0E21\u0E35" }, set: { unit: "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23", verb: "\u0E04\u0E27\u0E23\u0E21\u0E35" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E1B\u0E49\u0E2D\u0E19", email: "\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48\u0E2D\u0E35\u0E40\u0E21\u0E25", url: "URL", emoji: "\u0E2D\u0E34\u0E42\u0E21\u0E08\u0E34", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E40\u0E27\u0E25\u0E32\u0E41\u0E1A\u0E1A ISO", date: "\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E41\u0E1A\u0E1A ISO", time: "\u0E40\u0E27\u0E25\u0E32\u0E41\u0E1A\u0E1A ISO", duration: "\u0E0A\u0E48\u0E27\u0E07\u0E40\u0E27\u0E25\u0E32\u0E41\u0E1A\u0E1A ISO", ipv4: "\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48 IPv4", ipv6: "\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48 IPv6", cidrv4: "\u0E0A\u0E48\u0E27\u0E07 IP \u0E41\u0E1A\u0E1A IPv4", cidrv6: "\u0E0A\u0E48\u0E27\u0E07 IP \u0E41\u0E1A\u0E1A IPv6", base64: "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E41\u0E1A\u0E1A Base64", base64url: "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E41\u0E1A\u0E1A Base64 \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A URL", json_string: "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E41\u0E1A\u0E1A JSON", e164: "\u0E40\u0E1A\u0E2D\u0E23\u0E4C\u0E42\u0E17\u0E23\u0E28\u0E31\u0E1E\u0E17\u0E4C\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E1B\u0E23\u0E30\u0E40\u0E17\u0E28 (E.164)", jwt: "\u0E42\u0E17\u0E40\u0E04\u0E19 JWT", template_literal: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E1B\u0E49\u0E2D\u0E19" }, a = { nan: "NaN", number: "\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02", array: "\u0E2D\u0E32\u0E23\u0E4C\u0E40\u0E23\u0E22\u0E4C (Array)", null: "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E04\u0E48\u0E32 (null)" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E04\u0E27\u0E23\u0E40\u0E1B\u0E47\u0E19 instanceof ${t.expected} \u0E41\u0E15\u0E48\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A ${u}`;
        return `\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E04\u0E27\u0E23\u0E40\u0E1B\u0E47\u0E19 ${i} \u0E41\u0E15\u0E48\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `\u0E04\u0E48\u0E32\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E04\u0E27\u0E23\u0E40\u0E1B\u0E47\u0E19 ${b(t.values[0])}`;
        return `\u0E15\u0E31\u0E27\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E04\u0E27\u0E23\u0E40\u0E1B\u0E47\u0E19\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E43\u0E19 ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "\u0E44\u0E21\u0E48\u0E40\u0E01\u0E34\u0E19" : "\u0E19\u0E49\u0E2D\u0E22\u0E01\u0E27\u0E48\u0E32", o = n(t.origin);
        if (o) return `\u0E40\u0E01\u0E34\u0E19\u0E01\u0E33\u0E2B\u0E19\u0E14: ${t.origin ?? "\u0E04\u0E48\u0E32"} \u0E04\u0E27\u0E23\u0E21\u0E35${i} ${t.maximum.toString()} ${o.unit ?? "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23"}`;
        return `\u0E40\u0E01\u0E34\u0E19\u0E01\u0E33\u0E2B\u0E19\u0E14: ${t.origin ?? "\u0E04\u0E48\u0E32"} \u0E04\u0E27\u0E23\u0E21\u0E35${i} ${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? "\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E19\u0E49\u0E2D\u0E22" : "\u0E21\u0E32\u0E01\u0E01\u0E27\u0E48\u0E32", o = n(t.origin);
        if (o) return `\u0E19\u0E49\u0E2D\u0E22\u0E01\u0E27\u0E48\u0E32\u0E01\u0E33\u0E2B\u0E19\u0E14: ${t.origin} \u0E04\u0E27\u0E23\u0E21\u0E35${i} ${t.minimum.toString()} ${o.unit}`;
        return `\u0E19\u0E49\u0E2D\u0E22\u0E01\u0E27\u0E48\u0E32\u0E01\u0E33\u0E2B\u0E19\u0E14: ${t.origin} \u0E04\u0E27\u0E23\u0E21\u0E35${i} ${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E15\u0E49\u0E2D\u0E07\u0E02\u0E36\u0E49\u0E19\u0E15\u0E49\u0E19\u0E14\u0E49\u0E27\u0E22 "${i.prefix}"`;
        if (i.format === "ends_with") return `\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E15\u0E49\u0E2D\u0E07\u0E25\u0E07\u0E17\u0E49\u0E32\u0E22\u0E14\u0E49\u0E27\u0E22 "${i.suffix}"`;
        if (i.format === "includes") return `\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35 "${i.includes}" \u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21`;
        if (i.format === "regex") return `\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E15\u0E49\u0E2D\u0E07\u0E15\u0E23\u0E07\u0E01\u0E31\u0E1A\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E17\u0E35\u0E48\u0E01\u0E33\u0E2B\u0E19\u0E14 ${i.pattern}`;
        return `\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E08\u0E33\u0E19\u0E27\u0E19\u0E17\u0E35\u0E48\u0E2B\u0E32\u0E23\u0E14\u0E49\u0E27\u0E22 ${t.divisor} \u0E44\u0E14\u0E49\u0E25\u0E07\u0E15\u0E31\u0E27`;
      case "unrecognized_keys":
        return `\u0E1E\u0E1A\u0E04\u0E35\u0E22\u0E4C\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E23\u0E39\u0E49\u0E08\u0E31\u0E01: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `\u0E04\u0E35\u0E22\u0E4C\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E19 ${t.origin}`;
      case "invalid_union":
        return "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E44\u0E21\u0E48\u0E15\u0E23\u0E07\u0E01\u0E31\u0E1A\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E22\u0E39\u0E40\u0E19\u0E35\u0E22\u0E19\u0E17\u0E35\u0E48\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E44\u0E27\u0E49";
      case "invalid_element":
        return `\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E19 ${t.origin}`;
      default:
        return "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07";
    }
  };
};
function tp() {
  return { localeError: ep() };
}
var np = () => {
  let e = { string: { unit: "karakter", verb: "olmal\u0131" }, file: { unit: "bayt", verb: "olmal\u0131" }, array: { unit: "\xF6\u011Fe", verb: "olmal\u0131" }, set: { unit: "\xF6\u011Fe", verb: "olmal\u0131" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "girdi", email: "e-posta adresi", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO tarih ve saat", date: "ISO tarih", time: "ISO saat", duration: "ISO s\xFCre", ipv4: "IPv4 adresi", ipv6: "IPv6 adresi", cidrv4: "IPv4 aral\u0131\u011F\u0131", cidrv6: "IPv6 aral\u0131\u011F\u0131", base64: "base64 ile \u015Fifrelenmi\u015F metin", base64url: "base64url ile \u015Fifrelenmi\u015F metin", json_string: "JSON dizesi", e164: "E.164 say\u0131s\u0131", jwt: "JWT", template_literal: "\u015Eablon dizesi" }, a = { nan: "NaN" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Ge\xE7ersiz de\u011Fer: beklenen instanceof ${t.expected}, al\u0131nan ${u}`;
        return `Ge\xE7ersiz de\u011Fer: beklenen ${i}, al\u0131nan ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Ge\xE7ersiz de\u011Fer: beklenen ${b(t.values[0])}`;
        return `Ge\xE7ersiz se\xE7enek: a\u015Fa\u011F\u0131dakilerden biri olmal\u0131: ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `\xC7ok b\xFCy\xFCk: beklenen ${t.origin ?? "de\u011Fer"} ${i}${t.maximum.toString()} ${o.unit ?? "\xF6\u011Fe"}`;
        return `\xC7ok b\xFCy\xFCk: beklenen ${t.origin ?? "de\u011Fer"} ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `\xC7ok k\xFC\xE7\xFCk: beklenen ${t.origin} ${i}${t.minimum.toString()} ${o.unit}`;
        return `\xC7ok k\xFC\xE7\xFCk: beklenen ${t.origin} ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `Ge\xE7ersiz metin: "${i.prefix}" ile ba\u015Flamal\u0131`;
        if (i.format === "ends_with") return `Ge\xE7ersiz metin: "${i.suffix}" ile bitmeli`;
        if (i.format === "includes") return `Ge\xE7ersiz metin: "${i.includes}" i\xE7ermeli`;
        if (i.format === "regex") return `Ge\xE7ersiz metin: ${i.pattern} desenine uymal\u0131`;
        return `Ge\xE7ersiz ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `Ge\xE7ersiz say\u0131: ${t.divisor} ile tam b\xF6l\xFCnebilmeli`;
      case "unrecognized_keys":
        return `Tan\u0131nmayan anahtar${t.keys.length > 1 ? "lar" : ""}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `${t.origin} i\xE7inde ge\xE7ersiz anahtar`;
      case "invalid_union":
        return "Ge\xE7ersiz de\u011Fer";
      case "invalid_element":
        return `${t.origin} i\xE7inde ge\xE7ersiz de\u011Fer`;
      default:
        return "Ge\xE7ersiz de\u011Fer";
    }
  };
};
function ip() {
  return { localeError: np() };
}
var rp = () => {
  let e = { string: { unit: "\u0441\u0438\u043C\u0432\u043E\u043B\u0456\u0432", verb: "\u043C\u0430\u0442\u0438\u043C\u0435" }, file: { unit: "\u0431\u0430\u0439\u0442\u0456\u0432", verb: "\u043C\u0430\u0442\u0438\u043C\u0435" }, array: { unit: "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0456\u0432", verb: "\u043C\u0430\u0442\u0438\u043C\u0435" }, set: { unit: "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0456\u0432", verb: "\u043C\u0430\u0442\u0438\u043C\u0435" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "\u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456", email: "\u0430\u0434\u0440\u0435\u0441\u0430 \u0435\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u043E\u0457 \u043F\u043E\u0448\u0442\u0438", url: "URL", emoji: "\u0435\u043C\u043E\u0434\u0437\u0456", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "\u0434\u0430\u0442\u0430 \u0442\u0430 \u0447\u0430\u0441 ISO", date: "\u0434\u0430\u0442\u0430 ISO", time: "\u0447\u0430\u0441 ISO", duration: "\u0442\u0440\u0438\u0432\u0430\u043B\u0456\u0441\u0442\u044C ISO", ipv4: "\u0430\u0434\u0440\u0435\u0441\u0430 IPv4", ipv6: "\u0430\u0434\u0440\u0435\u0441\u0430 IPv6", cidrv4: "\u0434\u0456\u0430\u043F\u0430\u0437\u043E\u043D IPv4", cidrv6: "\u0434\u0456\u0430\u043F\u0430\u0437\u043E\u043D IPv6", base64: "\u0440\u044F\u0434\u043E\u043A \u0443 \u043A\u043E\u0434\u0443\u0432\u0430\u043D\u043D\u0456 base64", base64url: "\u0440\u044F\u0434\u043E\u043A \u0443 \u043A\u043E\u0434\u0443\u0432\u0430\u043D\u043D\u0456 base64url", json_string: "\u0440\u044F\u0434\u043E\u043A JSON", e164: "\u043D\u043E\u043C\u0435\u0440 E.164", jwt: "JWT", template_literal: "\u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456" }, a = { nan: "NaN", number: "\u0447\u0438\u0441\u043B\u043E", array: "\u043C\u0430\u0441\u0438\u0432" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0456 \u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F instanceof ${t.expected}, \u043E\u0442\u0440\u0438\u043C\u0430\u043D\u043E ${u}`;
        return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0456 \u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F ${i}, \u043E\u0442\u0440\u0438\u043C\u0430\u043D\u043E ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0456 \u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F ${b(t.values[0])}`;
        return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0430 \u043E\u043F\u0446\u0456\u044F: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F \u043E\u0434\u043D\u0435 \u0437 ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `\u0417\u0430\u043D\u0430\u0434\u0442\u043E \u0432\u0435\u043B\u0438\u043A\u0435: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F, \u0449\u043E ${t.origin ?? "\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F"} ${o.verb} ${i}${t.maximum.toString()} ${o.unit ?? "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0456\u0432"}`;
        return `\u0417\u0430\u043D\u0430\u0434\u0442\u043E \u0432\u0435\u043B\u0438\u043A\u0435: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F, \u0449\u043E ${t.origin ?? "\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F"} \u0431\u0443\u0434\u0435 ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `\u0417\u0430\u043D\u0430\u0434\u0442\u043E \u043C\u0430\u043B\u0435: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F, \u0449\u043E ${t.origin} ${o.verb} ${i}${t.minimum.toString()} ${o.unit}`;
        return `\u0417\u0430\u043D\u0430\u0434\u0442\u043E \u043C\u0430\u043B\u0435: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F, \u0449\u043E ${t.origin} \u0431\u0443\u0434\u0435 ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 \u0440\u044F\u0434\u043E\u043A: \u043F\u043E\u0432\u0438\u043D\u0435\u043D \u043F\u043E\u0447\u0438\u043D\u0430\u0442\u0438\u0441\u044F \u0437 "${i.prefix}"`;
        if (i.format === "ends_with") return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 \u0440\u044F\u0434\u043E\u043A: \u043F\u043E\u0432\u0438\u043D\u0435\u043D \u0437\u0430\u043A\u0456\u043D\u0447\u0443\u0432\u0430\u0442\u0438\u0441\u044F \u043D\u0430 "${i.suffix}"`;
        if (i.format === "includes") return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 \u0440\u044F\u0434\u043E\u043A: \u043F\u043E\u0432\u0438\u043D\u0435\u043D \u043C\u0456\u0441\u0442\u0438\u0442\u0438 "${i.includes}"`;
        if (i.format === "regex") return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 \u0440\u044F\u0434\u043E\u043A: \u043F\u043E\u0432\u0438\u043D\u0435\u043D \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0442\u0438 \u0448\u0430\u0431\u043B\u043E\u043D\u0443 ${i.pattern}`;
        return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0435 \u0447\u0438\u0441\u043B\u043E: \u043F\u043E\u0432\u0438\u043D\u043D\u043E \u0431\u0443\u0442\u0438 \u043A\u0440\u0430\u0442\u043D\u0438\u043C ${t.divisor}`;
      case "unrecognized_keys":
        return `\u041D\u0435\u0440\u043E\u0437\u043F\u0456\u0437\u043D\u0430\u043D\u0438\u0439 \u043A\u043B\u044E\u0447${t.keys.length > 1 ? "\u0456" : ""}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 \u043A\u043B\u044E\u0447 \u0443 ${t.origin}`;
      case "invalid_union":
        return "\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0456 \u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456";
      case "invalid_element":
        return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u0443 ${t.origin}`;
      default:
        return "\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0456 \u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456";
    }
  };
};
function Ms() {
  return { localeError: rp() };
}
function ap() {
  return Ms();
}
var op = () => {
  let e = { string: { unit: "\u062D\u0631\u0648\u0641", verb: "\u06C1\u0648\u0646\u0627" }, file: { unit: "\u0628\u0627\u0626\u0679\u0633", verb: "\u06C1\u0648\u0646\u0627" }, array: { unit: "\u0622\u0626\u0679\u0645\u0632", verb: "\u06C1\u0648\u0646\u0627" }, set: { unit: "\u0622\u0626\u0679\u0645\u0632", verb: "\u06C1\u0648\u0646\u0627" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "\u0627\u0646 \u067E\u0679", email: "\u0627\u06CC \u0645\u06CC\u0644 \u0627\u06CC\u0688\u0631\u06CC\u0633", url: "\u06CC\u0648 \u0622\u0631 \u0627\u06CC\u0644", emoji: "\u0627\u06CC\u0645\u0648\u062C\u06CC", uuid: "\u06CC\u0648 \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC", uuidv4: "\u06CC\u0648 \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC \u0648\u06CC 4", uuidv6: "\u06CC\u0648 \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC \u0648\u06CC 6", nanoid: "\u0646\u06CC\u0646\u0648 \u0622\u0626\u06CC \u0688\u06CC", guid: "\u062C\u06CC \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC", cuid: "\u0633\u06CC \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC", cuid2: "\u0633\u06CC \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC 2", ulid: "\u06CC\u0648 \u0627\u06CC\u0644 \u0622\u0626\u06CC \u0688\u06CC", xid: "\u0627\u06CC\u06A9\u0633 \u0622\u0626\u06CC \u0688\u06CC", ksuid: "\u06A9\u06D2 \u0627\u06CC\u0633 \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC", datetime: "\u0622\u0626\u06CC \u0627\u06CC\u0633 \u0627\u0648 \u0688\u06CC\u0679 \u0679\u0627\u0626\u0645", date: "\u0622\u0626\u06CC \u0627\u06CC\u0633 \u0627\u0648 \u062A\u0627\u0631\u06CC\u062E", time: "\u0622\u0626\u06CC \u0627\u06CC\u0633 \u0627\u0648 \u0648\u0642\u062A", duration: "\u0622\u0626\u06CC \u0627\u06CC\u0633 \u0627\u0648 \u0645\u062F\u062A", ipv4: "\u0622\u0626\u06CC \u067E\u06CC \u0648\u06CC 4 \u0627\u06CC\u0688\u0631\u06CC\u0633", ipv6: "\u0622\u0626\u06CC \u067E\u06CC \u0648\u06CC 6 \u0627\u06CC\u0688\u0631\u06CC\u0633", cidrv4: "\u0622\u0626\u06CC \u067E\u06CC \u0648\u06CC 4 \u0631\u06CC\u0646\u062C", cidrv6: "\u0622\u0626\u06CC \u067E\u06CC \u0648\u06CC 6 \u0631\u06CC\u0646\u062C", base64: "\u0628\u06CC\u0633 64 \u0627\u0646 \u06A9\u0648\u0688\u0688 \u0633\u0679\u0631\u0646\u06AF", base64url: "\u0628\u06CC\u0633 64 \u06CC\u0648 \u0622\u0631 \u0627\u06CC\u0644 \u0627\u0646 \u06A9\u0648\u0688\u0688 \u0633\u0679\u0631\u0646\u06AF", json_string: "\u062C\u06D2 \u0627\u06CC\u0633 \u0627\u0648 \u0627\u06CC\u0646 \u0633\u0679\u0631\u0646\u06AF", e164: "\u0627\u06CC 164 \u0646\u0645\u0628\u0631", jwt: "\u062C\u06D2 \u0688\u0628\u0644\u06CC\u0648 \u0679\u06CC", template_literal: "\u0627\u0646 \u067E\u0679" }, a = { nan: "NaN", number: "\u0646\u0645\u0628\u0631", array: "\u0622\u0631\u06D2", null: "\u0646\u0644" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `\u063A\u0644\u0637 \u0627\u0646 \u067E\u0679: instanceof ${t.expected} \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627\u060C ${u} \u0645\u0648\u0635\u0648\u0644 \u06C1\u0648\u0627`;
        return `\u063A\u0644\u0637 \u0627\u0646 \u067E\u0679: ${i} \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627\u060C ${u} \u0645\u0648\u0635\u0648\u0644 \u06C1\u0648\u0627`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `\u063A\u0644\u0637 \u0627\u0646 \u067E\u0679: ${b(t.values[0])} \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627`;
        return `\u063A\u0644\u0637 \u0622\u067E\u0634\u0646: ${g(t.values, "|")} \u0645\u06CC\u06BA \u0633\u06D2 \u0627\u06CC\u06A9 \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `\u0628\u06C1\u062A \u0628\u0691\u0627: ${t.origin ?? "\u0648\u06CC\u0644\u06CC\u0648"} \u06A9\u06D2 ${i}${t.maximum.toString()} ${o.unit ?? "\u0639\u0646\u0627\u0635\u0631"} \u06C1\u0648\u0646\u06D2 \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u06D2`;
        return `\u0628\u06C1\u062A \u0628\u0691\u0627: ${t.origin ?? "\u0648\u06CC\u0644\u06CC\u0648"} \u06A9\u0627 ${i}${t.maximum.toString()} \u06C1\u0648\u0646\u0627 \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `\u0628\u06C1\u062A \u0686\u06BE\u0648\u0679\u0627: ${t.origin} \u06A9\u06D2 ${i}${t.minimum.toString()} ${o.unit} \u06C1\u0648\u0646\u06D2 \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u06D2`;
        return `\u0628\u06C1\u062A \u0686\u06BE\u0648\u0679\u0627: ${t.origin} \u06A9\u0627 ${i}${t.minimum.toString()} \u06C1\u0648\u0646\u0627 \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `\u063A\u0644\u0637 \u0633\u0679\u0631\u0646\u06AF: "${i.prefix}" \u0633\u06D2 \u0634\u0631\u0648\u0639 \u06C1\u0648\u0646\u0627 \u0686\u0627\u06C1\u06CC\u06D2`;
        if (i.format === "ends_with") return `\u063A\u0644\u0637 \u0633\u0679\u0631\u0646\u06AF: "${i.suffix}" \u067E\u0631 \u062E\u062A\u0645 \u06C1\u0648\u0646\u0627 \u0686\u0627\u06C1\u06CC\u06D2`;
        if (i.format === "includes") return `\u063A\u0644\u0637 \u0633\u0679\u0631\u0646\u06AF: "${i.includes}" \u0634\u0627\u0645\u0644 \u06C1\u0648\u0646\u0627 \u0686\u0627\u06C1\u06CC\u06D2`;
        if (i.format === "regex") return `\u063A\u0644\u0637 \u0633\u0679\u0631\u0646\u06AF: \u067E\u06CC\u0679\u0631\u0646 ${i.pattern} \u0633\u06D2 \u0645\u06CC\u0686 \u06C1\u0648\u0646\u0627 \u0686\u0627\u06C1\u06CC\u06D2`;
        return `\u063A\u0644\u0637 ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `\u063A\u0644\u0637 \u0646\u0645\u0628\u0631: ${t.divisor} \u06A9\u0627 \u0645\u0636\u0627\u0639\u0641 \u06C1\u0648\u0646\u0627 \u0686\u0627\u06C1\u06CC\u06D2`;
      case "unrecognized_keys":
        return `\u063A\u06CC\u0631 \u062A\u0633\u0644\u06CC\u0645 \u0634\u062F\u06C1 \u06A9\u06CC${t.keys.length > 1 ? "\u0632" : ""}: ${g(t.keys, "\u060C ")}`;
      case "invalid_key":
        return `${t.origin} \u0645\u06CC\u06BA \u063A\u0644\u0637 \u06A9\u06CC`;
      case "invalid_union":
        return "\u063A\u0644\u0637 \u0627\u0646 \u067E\u0679";
      case "invalid_element":
        return `${t.origin} \u0645\u06CC\u06BA \u063A\u0644\u0637 \u0648\u06CC\u0644\u06CC\u0648`;
      default:
        return "\u063A\u0644\u0637 \u0627\u0646 \u067E\u0679";
    }
  };
};
function sp() {
  return { localeError: op() };
}
var up = () => {
  let e = { string: { unit: "belgi", verb: "bo\u2018lishi kerak" }, file: { unit: "bayt", verb: "bo\u2018lishi kerak" }, array: { unit: "element", verb: "bo\u2018lishi kerak" }, set: { unit: "element", verb: "bo\u2018lishi kerak" }, map: { unit: "yozuv", verb: "bo\u2018lishi kerak" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "kirish", email: "elektron pochta manzili", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO sana va vaqti", date: "ISO sana", time: "ISO vaqt", duration: "ISO davomiylik", ipv4: "IPv4 manzil", ipv6: "IPv6 manzil", mac: "MAC manzil", cidrv4: "IPv4 diapazon", cidrv6: "IPv6 diapazon", base64: "base64 kodlangan satr", base64url: "base64url kodlangan satr", json_string: "JSON satr", e164: "E.164 raqam", jwt: "JWT", template_literal: "kirish" }, a = { nan: "NaN", number: "raqam", array: "massiv" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `Noto\u2018g\u2018ri kirish: kutilgan instanceof ${t.expected}, qabul qilingan ${u}`;
        return `Noto\u2018g\u2018ri kirish: kutilgan ${i}, qabul qilingan ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `Noto\u2018g\u2018ri kirish: kutilgan ${b(t.values[0])}`;
        return `Noto\u2018g\u2018ri variant: quyidagilardan biri kutilgan ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `Juda katta: kutilgan ${t.origin ?? "qiymat"} ${i}${t.maximum.toString()} ${o.unit} ${o.verb}`;
        return `Juda katta: kutilgan ${t.origin ?? "qiymat"} ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `Juda kichik: kutilgan ${t.origin} ${i}${t.minimum.toString()} ${o.unit} ${o.verb}`;
        return `Juda kichik: kutilgan ${t.origin} ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `Noto\u2018g\u2018ri satr: "${i.prefix}" bilan boshlanishi kerak`;
        if (i.format === "ends_with") return `Noto\u2018g\u2018ri satr: "${i.suffix}" bilan tugashi kerak`;
        if (i.format === "includes") return `Noto\u2018g\u2018ri satr: "${i.includes}" ni o\u2018z ichiga olishi kerak`;
        if (i.format === "regex") return `Noto\u2018g\u2018ri satr: ${i.pattern} shabloniga mos kelishi kerak`;
        return `Noto\u2018g\u2018ri ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `Noto\u2018g\u2018ri raqam: ${t.divisor} ning karralisi bo\u2018lishi kerak`;
      case "unrecognized_keys":
        return `Noma\u2019lum kalit${t.keys.length > 1 ? "lar" : ""}: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `${t.origin} dagi kalit noto\u2018g\u2018ri`;
      case "invalid_union":
        return "Noto\u2018g\u2018ri kirish";
      case "invalid_element":
        return `${t.origin} da noto\u2018g\u2018ri qiymat`;
      default:
        return "Noto\u2018g\u2018ri kirish";
    }
  };
};
function lp() {
  return { localeError: up() };
}
var dp = () => {
  let e = { string: { unit: "k\xFD t\u1EF1", verb: "c\xF3" }, file: { unit: "byte", verb: "c\xF3" }, array: { unit: "ph\u1EA7n t\u1EED", verb: "c\xF3" }, set: { unit: "ph\u1EA7n t\u1EED", verb: "c\xF3" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "\u0111\u1EA7u v\xE0o", email: "\u0111\u1ECBa ch\u1EC9 email", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ng\xE0y gi\u1EDD ISO", date: "ng\xE0y ISO", time: "gi\u1EDD ISO", duration: "kho\u1EA3ng th\u1EDDi gian ISO", ipv4: "\u0111\u1ECBa ch\u1EC9 IPv4", ipv6: "\u0111\u1ECBa ch\u1EC9 IPv6", cidrv4: "d\u1EA3i IPv4", cidrv6: "d\u1EA3i IPv6", base64: "chu\u1ED7i m\xE3 h\xF3a base64", base64url: "chu\u1ED7i m\xE3 h\xF3a base64url", json_string: "chu\u1ED7i JSON", e164: "s\u1ED1 E.164", jwt: "JWT", template_literal: "\u0111\u1EA7u v\xE0o" }, a = { nan: "NaN", number: "s\u1ED1", array: "m\u1EA3ng" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `\u0110\u1EA7u v\xE0o kh\xF4ng h\u1EE3p l\u1EC7: mong \u0111\u1EE3i instanceof ${t.expected}, nh\u1EADn \u0111\u01B0\u1EE3c ${u}`;
        return `\u0110\u1EA7u v\xE0o kh\xF4ng h\u1EE3p l\u1EC7: mong \u0111\u1EE3i ${i}, nh\u1EADn \u0111\u01B0\u1EE3c ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `\u0110\u1EA7u v\xE0o kh\xF4ng h\u1EE3p l\u1EC7: mong \u0111\u1EE3i ${b(t.values[0])}`;
        return `T\xF9y ch\u1ECDn kh\xF4ng h\u1EE3p l\u1EC7: mong \u0111\u1EE3i m\u1ED9t trong c\xE1c gi\xE1 tr\u1ECB ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `Qu\xE1 l\u1EDBn: mong \u0111\u1EE3i ${t.origin ?? "gi\xE1 tr\u1ECB"} ${o.verb} ${i}${t.maximum.toString()} ${o.unit ?? "ph\u1EA7n t\u1EED"}`;
        return `Qu\xE1 l\u1EDBn: mong \u0111\u1EE3i ${t.origin ?? "gi\xE1 tr\u1ECB"} ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `Qu\xE1 nh\u1ECF: mong \u0111\u1EE3i ${t.origin} ${o.verb} ${i}${t.minimum.toString()} ${o.unit}`;
        return `Qu\xE1 nh\u1ECF: mong \u0111\u1EE3i ${t.origin} ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `Chu\u1ED7i kh\xF4ng h\u1EE3p l\u1EC7: ph\u1EA3i b\u1EAFt \u0111\u1EA7u b\u1EB1ng "${i.prefix}"`;
        if (i.format === "ends_with") return `Chu\u1ED7i kh\xF4ng h\u1EE3p l\u1EC7: ph\u1EA3i k\u1EBFt th\xFAc b\u1EB1ng "${i.suffix}"`;
        if (i.format === "includes") return `Chu\u1ED7i kh\xF4ng h\u1EE3p l\u1EC7: ph\u1EA3i bao g\u1ED3m "${i.includes}"`;
        if (i.format === "regex") return `Chu\u1ED7i kh\xF4ng h\u1EE3p l\u1EC7: ph\u1EA3i kh\u1EDBp v\u1EDBi m\u1EABu ${i.pattern}`;
        return `${r[i.format] ?? t.format} kh\xF4ng h\u1EE3p l\u1EC7`;
      }
      case "not_multiple_of":
        return `S\u1ED1 kh\xF4ng h\u1EE3p l\u1EC7: ph\u1EA3i l\xE0 b\u1ED9i s\u1ED1 c\u1EE7a ${t.divisor}`;
      case "unrecognized_keys":
        return `Kh\xF3a kh\xF4ng \u0111\u01B0\u1EE3c nh\u1EADn d\u1EA1ng: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `Kh\xF3a kh\xF4ng h\u1EE3p l\u1EC7 trong ${t.origin}`;
      case "invalid_union":
        return "\u0110\u1EA7u v\xE0o kh\xF4ng h\u1EE3p l\u1EC7";
      case "invalid_element":
        return `Gi\xE1 tr\u1ECB kh\xF4ng h\u1EE3p l\u1EC7 trong ${t.origin}`;
      default:
        return "\u0110\u1EA7u v\xE0o kh\xF4ng h\u1EE3p l\u1EC7";
    }
  };
};
function cp() {
  return { localeError: dp() };
}
var mp = () => {
  let e = { string: { unit: "\u5B57\u7B26", verb: "\u5305\u542B" }, file: { unit: "\u5B57\u8282", verb: "\u5305\u542B" }, array: { unit: "\u9879", verb: "\u5305\u542B" }, set: { unit: "\u9879", verb: "\u5305\u542B" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "\u8F93\u5165", email: "\u7535\u5B50\u90AE\u4EF6", url: "URL", emoji: "\u8868\u60C5\u7B26\u53F7", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO\u65E5\u671F\u65F6\u95F4", date: "ISO\u65E5\u671F", time: "ISO\u65F6\u95F4", duration: "ISO\u65F6\u957F", ipv4: "IPv4\u5730\u5740", ipv6: "IPv6\u5730\u5740", cidrv4: "IPv4\u7F51\u6BB5", cidrv6: "IPv6\u7F51\u6BB5", base64: "base64\u7F16\u7801\u5B57\u7B26\u4E32", base64url: "base64url\u7F16\u7801\u5B57\u7B26\u4E32", json_string: "JSON\u5B57\u7B26\u4E32", e164: "E.164\u53F7\u7801", jwt: "JWT", template_literal: "\u8F93\u5165" }, a = { nan: "NaN", number: "\u6570\u5B57", array: "\u6570\u7EC4", null: "\u7A7A\u503C(null)" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `\u65E0\u6548\u8F93\u5165\uFF1A\u671F\u671B instanceof ${t.expected}\uFF0C\u5B9E\u9645\u63A5\u6536 ${u}`;
        return `\u65E0\u6548\u8F93\u5165\uFF1A\u671F\u671B ${i}\uFF0C\u5B9E\u9645\u63A5\u6536 ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `\u65E0\u6548\u8F93\u5165\uFF1A\u671F\u671B ${b(t.values[0])}`;
        return `\u65E0\u6548\u9009\u9879\uFF1A\u671F\u671B\u4EE5\u4E0B\u4E4B\u4E00 ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `\u6570\u503C\u8FC7\u5927\uFF1A\u671F\u671B ${t.origin ?? "\u503C"} ${i}${t.maximum.toString()} ${o.unit ?? "\u4E2A\u5143\u7D20"}`;
        return `\u6570\u503C\u8FC7\u5927\uFF1A\u671F\u671B ${t.origin ?? "\u503C"} ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `\u6570\u503C\u8FC7\u5C0F\uFF1A\u671F\u671B ${t.origin} ${i}${t.minimum.toString()} ${o.unit}`;
        return `\u6570\u503C\u8FC7\u5C0F\uFF1A\u671F\u671B ${t.origin} ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `\u65E0\u6548\u5B57\u7B26\u4E32\uFF1A\u5FC5\u987B\u4EE5 "${i.prefix}" \u5F00\u5934`;
        if (i.format === "ends_with") return `\u65E0\u6548\u5B57\u7B26\u4E32\uFF1A\u5FC5\u987B\u4EE5 "${i.suffix}" \u7ED3\u5C3E`;
        if (i.format === "includes") return `\u65E0\u6548\u5B57\u7B26\u4E32\uFF1A\u5FC5\u987B\u5305\u542B "${i.includes}"`;
        if (i.format === "regex") return `\u65E0\u6548\u5B57\u7B26\u4E32\uFF1A\u5FC5\u987B\u6EE1\u8DB3\u6B63\u5219\u8868\u8FBE\u5F0F ${i.pattern}`;
        return `\u65E0\u6548${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `\u65E0\u6548\u6570\u5B57\uFF1A\u5FC5\u987B\u662F ${t.divisor} \u7684\u500D\u6570`;
      case "unrecognized_keys":
        return `\u51FA\u73B0\u672A\u77E5\u7684\u952E(key): ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `${t.origin} \u4E2D\u7684\u952E(key)\u65E0\u6548`;
      case "invalid_union":
        return "\u65E0\u6548\u8F93\u5165";
      case "invalid_element":
        return `${t.origin} \u4E2D\u5305\u542B\u65E0\u6548\u503C(value)`;
      default:
        return "\u65E0\u6548\u8F93\u5165";
    }
  };
};
function fp() {
  return { localeError: mp() };
}
var pp = () => {
  let e = { string: { unit: "\u5B57\u5143", verb: "\u64C1\u6709" }, file: { unit: "\u4F4D\u5143\u7D44", verb: "\u64C1\u6709" }, array: { unit: "\u9805\u76EE", verb: "\u64C1\u6709" }, set: { unit: "\u9805\u76EE", verb: "\u64C1\u6709" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "\u8F38\u5165", email: "\u90F5\u4EF6\u5730\u5740", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "ISO \u65E5\u671F\u6642\u9593", date: "ISO \u65E5\u671F", time: "ISO \u6642\u9593", duration: "ISO \u671F\u9593", ipv4: "IPv4 \u4F4D\u5740", ipv6: "IPv6 \u4F4D\u5740", cidrv4: "IPv4 \u7BC4\u570D", cidrv6: "IPv6 \u7BC4\u570D", base64: "base64 \u7DE8\u78BC\u5B57\u4E32", base64url: "base64url \u7DE8\u78BC\u5B57\u4E32", json_string: "JSON \u5B57\u4E32", e164: "E.164 \u6578\u503C", jwt: "JWT", template_literal: "\u8F38\u5165" }, a = { nan: "NaN" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `\u7121\u6548\u7684\u8F38\u5165\u503C\uFF1A\u9810\u671F\u70BA instanceof ${t.expected}\uFF0C\u4F46\u6536\u5230 ${u}`;
        return `\u7121\u6548\u7684\u8F38\u5165\u503C\uFF1A\u9810\u671F\u70BA ${i}\uFF0C\u4F46\u6536\u5230 ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `\u7121\u6548\u7684\u8F38\u5165\u503C\uFF1A\u9810\u671F\u70BA ${b(t.values[0])}`;
        return `\u7121\u6548\u7684\u9078\u9805\uFF1A\u9810\u671F\u70BA\u4EE5\u4E0B\u5176\u4E2D\u4E4B\u4E00 ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `\u6578\u503C\u904E\u5927\uFF1A\u9810\u671F ${t.origin ?? "\u503C"} \u61C9\u70BA ${i}${t.maximum.toString()} ${o.unit ?? "\u500B\u5143\u7D20"}`;
        return `\u6578\u503C\u904E\u5927\uFF1A\u9810\u671F ${t.origin ?? "\u503C"} \u61C9\u70BA ${i}${t.maximum.toString()}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `\u6578\u503C\u904E\u5C0F\uFF1A\u9810\u671F ${t.origin} \u61C9\u70BA ${i}${t.minimum.toString()} ${o.unit}`;
        return `\u6578\u503C\u904E\u5C0F\uFF1A\u9810\u671F ${t.origin} \u61C9\u70BA ${i}${t.minimum.toString()}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `\u7121\u6548\u7684\u5B57\u4E32\uFF1A\u5FC5\u9808\u4EE5 "${i.prefix}" \u958B\u982D`;
        if (i.format === "ends_with") return `\u7121\u6548\u7684\u5B57\u4E32\uFF1A\u5FC5\u9808\u4EE5 "${i.suffix}" \u7D50\u5C3E`;
        if (i.format === "includes") return `\u7121\u6548\u7684\u5B57\u4E32\uFF1A\u5FC5\u9808\u5305\u542B "${i.includes}"`;
        if (i.format === "regex") return `\u7121\u6548\u7684\u5B57\u4E32\uFF1A\u5FC5\u9808\u7B26\u5408\u683C\u5F0F ${i.pattern}`;
        return `\u7121\u6548\u7684 ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `\u7121\u6548\u7684\u6578\u5B57\uFF1A\u5FC5\u9808\u70BA ${t.divisor} \u7684\u500D\u6578`;
      case "unrecognized_keys":
        return `\u7121\u6CD5\u8B58\u5225\u7684\u9375\u503C${t.keys.length > 1 ? "\u5011" : ""}\uFF1A${g(t.keys, "\u3001")}`;
      case "invalid_key":
        return `${t.origin} \u4E2D\u6709\u7121\u6548\u7684\u9375\u503C`;
      case "invalid_union":
        return "\u7121\u6548\u7684\u8F38\u5165\u503C";
      case "invalid_element":
        return `${t.origin} \u4E2D\u6709\u7121\u6548\u7684\u503C`;
      default:
        return "\u7121\u6548\u7684\u8F38\u5165\u503C";
    }
  };
};
function gp() {
  return { localeError: pp() };
}
var vp = () => {
  let e = { string: { unit: "\xE0mi", verb: "n\xED" }, file: { unit: "bytes", verb: "n\xED" }, array: { unit: "nkan", verb: "n\xED" }, set: { unit: "nkan", verb: "n\xED" } };
  function n(t) {
    return e[t] ?? null;
  }
  let r = { regex: "\u1EB9\u0300r\u1ECD \xECb\xE1w\u1ECDl\xE9", email: "\xE0d\xEDr\u1EB9\u0301s\xEC \xECm\u1EB9\u0301l\xEC", url: "URL", emoji: "emoji", uuid: "UUID", uuidv4: "UUIDv4", uuidv6: "UUIDv6", nanoid: "nanoid", guid: "GUID", cuid: "cuid", cuid2: "cuid2", ulid: "ULID", xid: "XID", ksuid: "KSUID", datetime: "\xE0k\xF3k\xF2 ISO", date: "\u1ECDj\u1ECD\u0301 ISO", time: "\xE0k\xF3k\xF2 ISO", duration: "\xE0k\xF3k\xF2 t\xF3 p\xE9 ISO", ipv4: "\xE0d\xEDr\u1EB9\u0301s\xEC IPv4", ipv6: "\xE0d\xEDr\u1EB9\u0301s\xEC IPv6", cidrv4: "\xE0gb\xE8gb\xE8 IPv4", cidrv6: "\xE0gb\xE8gb\xE8 IPv6", base64: "\u1ECD\u0300r\u1ECD\u0300 t\xED a k\u1ECD\u0301 n\xED base64", base64url: "\u1ECD\u0300r\u1ECD\u0300 base64url", json_string: "\u1ECD\u0300r\u1ECD\u0300 JSON", e164: "n\u1ECD\u0301mb\xE0 E.164", jwt: "JWT", template_literal: "\u1EB9\u0300r\u1ECD \xECb\xE1w\u1ECDl\xE9" }, a = { nan: "NaN", number: "n\u1ECD\u0301mb\xE0", array: "akop\u1ECD" };
  return (t) => {
    switch (t.code) {
      case "invalid_type": {
        let i = a[t.expected] ?? t.expected, o = _(t.input), u = a[o] ?? o;
        if (/^[A-Z]/.test(t.expected)) return `\xCCb\xE1w\u1ECDl\xE9 a\u1E63\xEC\u1E63e: a n\xED l\xE1ti fi instanceof ${t.expected}, \xE0m\u1ECD\u0300 a r\xED ${u}`;
        return `\xCCb\xE1w\u1ECDl\xE9 a\u1E63\xEC\u1E63e: a n\xED l\xE1ti fi ${i}, \xE0m\u1ECD\u0300 a r\xED ${u}`;
      }
      case "invalid_value":
        if (t.values.length === 1) return `\xCCb\xE1w\u1ECDl\xE9 a\u1E63\xEC\u1E63e: a n\xED l\xE1ti fi ${b(t.values[0])}`;
        return `\xC0\u1E63\xE0y\xE0n a\u1E63\xEC\u1E63e: yan \u1ECD\u0300kan l\xE1ra ${g(t.values, "|")}`;
      case "too_big": {
        let i = t.inclusive ? "<=" : "<", o = n(t.origin);
        if (o) return `T\xF3 p\u1ECD\u0300 j\xF9: a n\xED l\xE1ti j\u1EB9\u0301 p\xE9 ${t.origin ?? "iye"} ${o.verb} ${i}${t.maximum} ${o.unit}`;
        return `T\xF3 p\u1ECD\u0300 j\xF9: a n\xED l\xE1ti j\u1EB9\u0301 ${i}${t.maximum}`;
      }
      case "too_small": {
        let i = t.inclusive ? ">=" : ">", o = n(t.origin);
        if (o) return `K\xE9r\xE9 ju: a n\xED l\xE1ti j\u1EB9\u0301 p\xE9 ${t.origin} ${o.verb} ${i}${t.minimum} ${o.unit}`;
        return `K\xE9r\xE9 ju: a n\xED l\xE1ti j\u1EB9\u0301 ${i}${t.minimum}`;
      }
      case "invalid_format": {
        let i = t;
        if (i.format === "starts_with") return `\u1ECC\u0300r\u1ECD\u0300 a\u1E63\xEC\u1E63e: gb\u1ECD\u0301d\u1ECD\u0300 b\u1EB9\u0300r\u1EB9\u0300 p\u1EB9\u0300l\xFA "${i.prefix}"`;
        if (i.format === "ends_with") return `\u1ECC\u0300r\u1ECD\u0300 a\u1E63\xEC\u1E63e: gb\u1ECD\u0301d\u1ECD\u0300 par\xED p\u1EB9\u0300l\xFA "${i.suffix}"`;
        if (i.format === "includes") return `\u1ECC\u0300r\u1ECD\u0300 a\u1E63\xEC\u1E63e: gb\u1ECD\u0301d\u1ECD\u0300 n\xED "${i.includes}"`;
        if (i.format === "regex") return `\u1ECC\u0300r\u1ECD\u0300 a\u1E63\xEC\u1E63e: gb\u1ECD\u0301d\u1ECD\u0300 b\xE1 \xE0p\u1EB9\u1EB9r\u1EB9 mu ${i.pattern}`;
        return `A\u1E63\xEC\u1E63e: ${r[i.format] ?? t.format}`;
      }
      case "not_multiple_of":
        return `N\u1ECD\u0301mb\xE0 a\u1E63\xEC\u1E63e: gb\u1ECD\u0301d\u1ECD\u0300 j\u1EB9\u0301 \xE8y\xE0 p\xEDp\xEDn ti ${t.divisor}`;
      case "unrecognized_keys":
        return `B\u1ECDt\xECn\xEC \xE0\xECm\u1ECD\u0300: ${g(t.keys, ", ")}`;
      case "invalid_key":
        return `B\u1ECDt\xECn\xEC a\u1E63\xEC\u1E63e n\xEDn\xFA ${t.origin}`;
      case "invalid_union":
        return "\xCCb\xE1w\u1ECDl\xE9 a\u1E63\xEC\u1E63e";
      case "invalid_element":
        return `Iye a\u1E63\xEC\u1E63e n\xEDn\xFA ${t.origin}`;
      default:
        return "\xCCb\xE1w\u1ECDl\xE9 a\u1E63\xEC\u1E63e";
    }
  };
};
function hp() {
  return { localeError: vp() };
}
var na;
var Bs = Symbol("ZodOutput");
var Fs = Symbol("ZodInput");
var ti = class {
  constructor() {
    this._map = /* @__PURE__ */ new WeakMap(), this._idmap = /* @__PURE__ */ new Map();
  }
  add(e, ...n) {
    let r = n[0];
    if (this._map.set(e, r), r && typeof r === "object" && "id" in r) this._idmap.set(r.id, e);
    return this;
  }
  clear() {
    return this._map = /* @__PURE__ */ new WeakMap(), this._idmap = /* @__PURE__ */ new Map(), this;
  }
  remove(e) {
    let n = this._map.get(e);
    if (n && typeof n === "object" && "id" in n) this._idmap.delete(n.id);
    return this._map.delete(e), this;
  }
  get(e) {
    let n = e._zod.parent;
    if (n) {
      let r = { ...this.get(n) ?? {} };
      delete r.id;
      let a = { ...r, ...this._map.get(e) };
      return Object.keys(a).length ? a : void 0;
    }
    return this._map.get(e);
  }
  has(e) {
    return this._map.has(e);
  }
};
function ni() {
  return new ti();
}
(na = globalThis).__zod_globalRegistry ?? (na.__zod_globalRegistry = ni());
var G = globalThis.__zod_globalRegistry;
function Js(e, n) {
  return new e({ type: "string", ...v(n) });
}
function Gs(e, n) {
  return new e({ type: "string", coerce: true, ...v(n) });
}
function ii(e, n) {
  return new e({ type: "string", format: "email", check: "string_format", abort: false, ...v(n) });
}
function It(e, n) {
  return new e({ type: "string", format: "guid", check: "string_format", abort: false, ...v(n) });
}
function ri(e, n) {
  return new e({ type: "string", format: "uuid", check: "string_format", abort: false, ...v(n) });
}
function ai(e, n) {
  return new e({ type: "string", format: "uuid", check: "string_format", abort: false, version: "v4", ...v(n) });
}
function oi(e, n) {
  return new e({ type: "string", format: "uuid", check: "string_format", abort: false, version: "v6", ...v(n) });
}
function si(e, n) {
  return new e({ type: "string", format: "uuid", check: "string_format", abort: false, version: "v7", ...v(n) });
}
function Ut(e, n) {
  return new e({ type: "string", format: "url", check: "string_format", abort: false, ...v(n) });
}
function ui(e, n) {
  return new e({ type: "string", format: "emoji", check: "string_format", abort: false, ...v(n) });
}
function li(e, n) {
  return new e({ type: "string", format: "nanoid", check: "string_format", abort: false, ...v(n) });
}
function di(e, n) {
  return new e({ type: "string", format: "cuid", check: "string_format", abort: false, ...v(n) });
}
function ci(e, n) {
  return new e({ type: "string", format: "cuid2", check: "string_format", abort: false, ...v(n) });
}
function mi(e, n) {
  return new e({ type: "string", format: "ulid", check: "string_format", abort: false, ...v(n) });
}
function fi(e, n) {
  return new e({ type: "string", format: "xid", check: "string_format", abort: false, ...v(n) });
}
function pi(e, n) {
  return new e({ type: "string", format: "ksuid", check: "string_format", abort: false, ...v(n) });
}
function gi(e, n) {
  return new e({ type: "string", format: "ipv4", check: "string_format", abort: false, ...v(n) });
}
function vi(e, n) {
  return new e({ type: "string", format: "ipv6", check: "string_format", abort: false, ...v(n) });
}
function Ws(e, n) {
  return new e({ type: "string", format: "mac", check: "string_format", abort: false, ...v(n) });
}
function hi(e, n) {
  return new e({ type: "string", format: "cidrv4", check: "string_format", abort: false, ...v(n) });
}
function $i(e, n) {
  return new e({ type: "string", format: "cidrv6", check: "string_format", abort: false, ...v(n) });
}
function yi(e, n) {
  return new e({ type: "string", format: "base64", check: "string_format", abort: false, ...v(n) });
}
function bi(e, n) {
  return new e({ type: "string", format: "base64url", check: "string_format", abort: false, ...v(n) });
}
function _i(e, n) {
  return new e({ type: "string", format: "e164", check: "string_format", abort: false, ...v(n) });
}
function ki(e, n) {
  return new e({ type: "string", format: "jwt", check: "string_format", abort: false, ...v(n) });
}
var Vs = { Any: null, Minute: -1, Second: 0, Millisecond: 3, Microsecond: 6 };
function Ks(e, n) {
  return new e({ type: "string", format: "datetime", check: "string_format", offset: false, local: false, precision: null, ...v(n) });
}
function qs(e, n) {
  return new e({ type: "string", format: "date", check: "string_format", ...v(n) });
}
function Hs(e, n) {
  return new e({ type: "string", format: "time", check: "string_format", precision: null, ...v(n) });
}
function Xs(e, n) {
  return new e({ type: "string", format: "duration", check: "string_format", ...v(n) });
}
function Ys(e, n) {
  return new e({ type: "number", checks: [], ...v(n) });
}
function Qs(e, n) {
  return new e({ type: "number", coerce: true, checks: [], ...v(n) });
}
function eu(e, n) {
  return new e({ type: "number", check: "number_format", abort: false, format: "safeint", ...v(n) });
}
function tu(e, n) {
  return new e({ type: "number", check: "number_format", abort: false, format: "float32", ...v(n) });
}
function nu(e, n) {
  return new e({ type: "number", check: "number_format", abort: false, format: "float64", ...v(n) });
}
function iu(e, n) {
  return new e({ type: "number", check: "number_format", abort: false, format: "int32", ...v(n) });
}
function ru(e, n) {
  return new e({ type: "number", check: "number_format", abort: false, format: "uint32", ...v(n) });
}
function au(e, n) {
  return new e({ type: "boolean", ...v(n) });
}
function ou(e, n) {
  return new e({ type: "boolean", coerce: true, ...v(n) });
}
function su(e, n) {
  return new e({ type: "bigint", ...v(n) });
}
function uu(e, n) {
  return new e({ type: "bigint", coerce: true, ...v(n) });
}
function lu(e, n) {
  return new e({ type: "bigint", check: "bigint_format", abort: false, format: "int64", ...v(n) });
}
function du(e, n) {
  return new e({ type: "bigint", check: "bigint_format", abort: false, format: "uint64", ...v(n) });
}
function cu(e, n) {
  return new e({ type: "symbol", ...v(n) });
}
function mu(e, n) {
  return new e({ type: "undefined", ...v(n) });
}
function fu(e, n) {
  return new e({ type: "null", ...v(n) });
}
function pu(e) {
  return new e({ type: "any" });
}
function gu(e) {
  return new e({ type: "unknown" });
}
function vu(e, n) {
  return new e({ type: "never", ...v(n) });
}
function hu(e, n) {
  return new e({ type: "void", ...v(n) });
}
function $u(e, n) {
  return new e({ type: "date", ...v(n) });
}
function yu(e, n) {
  return new e({ type: "date", coerce: true, ...v(n) });
}
function bu(e, n) {
  return new e({ type: "nan", ...v(n) });
}
function re(e, n) {
  return new Fn({ check: "less_than", ...v(n), value: e, inclusive: false });
}
function W(e, n) {
  return new Fn({ check: "less_than", ...v(n), value: e, inclusive: true });
}
function ae(e, n) {
  return new Jn({ check: "greater_than", ...v(n), value: e, inclusive: false });
}
function Z(e, n) {
  return new Jn({ check: "greater_than", ...v(n), value: e, inclusive: true });
}
function Ii(e) {
  return ae(0, e);
}
function wi(e) {
  return re(0, e);
}
function Si(e) {
  return W(0, e);
}
function xi(e) {
  return Z(0, e);
}
function Ie(e, n) {
  return new oo({ check: "multiple_of", ...v(n), value: e });
}
function Te(e, n) {
  return new lo({ check: "max_size", ...v(n), maximum: e });
}
function oe(e, n) {
  return new co({ check: "min_size", ...v(n), minimum: e });
}
function He(e, n) {
  return new mo({ check: "size_equals", ...v(n), size: e });
}
function Xe(e, n) {
  return new fo({ check: "max_length", ...v(n), maximum: e });
}
function ce(e, n) {
  return new po({ check: "min_length", ...v(n), minimum: e });
}
function Ye(e, n) {
  return new go({ check: "length_equals", ...v(n), length: e });
}
function At(e, n) {
  return new vo({ check: "string_format", format: "regex", ...v(n), pattern: e });
}
function Dt(e) {
  return new ho({ check: "string_format", format: "lowercase", ...v(e) });
}
function Pt(e) {
  return new $o({ check: "string_format", format: "uppercase", ...v(e) });
}
function jt(e, n) {
  return new yo({ check: "string_format", format: "includes", ...v(n), includes: e });
}
function Ct(e, n) {
  return new bo({ check: "string_format", format: "starts_with", ...v(n), prefix: e });
}
function Rt(e, n) {
  return new _o({ check: "string_format", format: "ends_with", ...v(n), suffix: e });
}
function Ei(e, n, r) {
  return new ko({ check: "property", property: e, schema: n, ...v(r) });
}
function Zt(e, n) {
  return new Io({ check: "mime_type", mime: e, ...v(n) });
}
function te(e) {
  return new wo({ check: "overwrite", tx: e });
}
function Lt(e) {
  return te((n) => n.normalize(e));
}
function Mt() {
  return te((e) => e.trim());
}
function Bt() {
  return te((e) => e.toLowerCase());
}
function Ft() {
  return te((e) => e.toUpperCase());
}
function Jt() {
  return te((e) => da(e));
}
function _u(e, n, r) {
  return new e({ type: "array", element: n, ...v(r) });
}
function $p(e, n, r) {
  return new e({ type: "union", options: n, ...v(r) });
}
function yp(e, n, r) {
  return new e({ type: "union", options: n, inclusive: false, ...v(r) });
}
function bp(e, n, r, a) {
  return new e({ type: "union", options: r, discriminator: n, ...v(a) });
}
function _p(e, n, r) {
  return new e({ type: "intersection", left: n, right: r });
}
function kp(e, n, r, a) {
  let t = r instanceof I;
  return new e({ type: "tuple", items: n, rest: t ? r : null, ...v(t ? a : r) });
}
function Ip(e, n, r, a) {
  return new e({ type: "record", keyType: n, valueType: r, ...v(a) });
}
function wp(e, n, r, a) {
  return new e({ type: "map", keyType: n, valueType: r, ...v(a) });
}
function Sp(e, n, r) {
  return new e({ type: "set", valueType: n, ...v(r) });
}
function xp(e, n, r) {
  let a = Array.isArray(n) ? Object.fromEntries(n.map((t) => [t, t])) : n;
  return new e({ type: "enum", entries: a, ...v(r) });
}
function Ep(e, n, r) {
  return new e({ type: "enum", entries: n, ...v(r) });
}
function Op(e, n, r) {
  return new e({ type: "literal", values: Array.isArray(n) ? n : [n], ...v(r) });
}
function ku(e, n) {
  return new e({ type: "file", ...v(n) });
}
function Tp(e, n) {
  return new e({ type: "transform", transform: n });
}
function Np(e, n) {
  return new e({ type: "optional", innerType: n });
}
function zp(e, n) {
  return new e({ type: "nullable", innerType: n });
}
function Up(e, n, r) {
  return new e({ type: "default", innerType: n, get defaultValue() {
    return typeof r === "function" ? r() : ma(r);
  } });
}
function Ap(e, n, r) {
  return new e({ type: "nonoptional", innerType: n, ...v(r) });
}
function Dp(e, n) {
  return new e({ type: "success", innerType: n });
}
function Pp(e, n, r) {
  return new e({ type: "catch", innerType: n, catchValue: typeof r === "function" ? r : () => r });
}
function jp(e, n, r) {
  return new e({ type: "pipe", in: n, out: r });
}
function Cp(e, n) {
  return new e({ type: "readonly", innerType: n });
}
function Rp(e, n, r) {
  return new e({ type: "template_literal", parts: n, ...v(r) });
}
function Zp(e, n) {
  return new e({ type: "lazy", getter: n });
}
function Lp(e, n) {
  return new e({ type: "promise", innerType: n });
}
function Iu(e, n, r) {
  let a = v(r);
  return a.abort ?? (a.abort = true), new e({ type: "custom", check: "custom", fn: n, ...a });
}
function wu(e, n, r) {
  return new e({ type: "custom", check: "custom", fn: n, ...v(r) });
}
function Su(e, n) {
  let r = xu((a) => {
    return a.addIssue = (t) => {
      if (typeof t === "string") a.issues.push(_t(t, a.value, r._zod.def));
      else {
        let i = t;
        if (i.fatal) i.continue = false;
        i.code ?? (i.code = "custom"), i.input ?? (i.input = a.value), i.inst ?? (i.inst = r), i.continue ?? (i.continue = !r._zod.def.abort), a.issues.push(_t(i));
      }
    }, e(a.value, a);
  }, n);
  return r;
}
function xu(e, n) {
  let r = new D({ check: "custom", ...v(n) });
  return r._zod.check = e, r;
}
function Eu(e) {
  let n = new D({ check: "describe" });
  return n._zod.onattach = [(r) => {
    let a = G.get(r) ?? {};
    G.add(r, { ...a, description: e });
  }], n._zod.check = () => {
  }, n;
}
function Ou(e) {
  let n = new D({ check: "meta" });
  return n._zod.onattach = [(r) => {
    let a = G.get(r) ?? {};
    G.add(r, { ...a, ...e });
  }], n._zod.check = () => {
  }, n;
}
function Tu(e, n) {
  let r = v(n), a = r.truthy ?? ["true", "1", "yes", "on", "y", "enabled"], t = r.falsy ?? ["false", "0", "no", "off", "n", "disabled"];
  if (r.case !== "sensitive") a = a.map((f) => typeof f === "string" ? f.toLowerCase() : f), t = t.map((f) => typeof f === "string" ? f.toLowerCase() : f);
  let i = new Set(a), o = new Set(t), u = e.Codec ?? Qn, l = e.Boolean ?? Kn, d = new (e.String ?? qe)({ type: "string", error: r.error }), c = new l({ type: "boolean", error: r.error }), p = new u({ type: "pipe", in: d, out: c, transform: (f, $) => {
    let x = f;
    if (r.case !== "sensitive") x = x.toLowerCase();
    if (i.has(x)) return true;
    else if (o.has(x)) return false;
    else return $.issues.push({ code: "invalid_value", expected: "stringbool", values: [...i, ...o], input: $.value, inst: p, continue: false }), {};
  }, reverseTransform: (f, $) => {
    if (f === true) return a[0] || "true";
    else return t[0] || "false";
  }, error: r.error });
  return p;
}
function Qe(e, n, r, a = {}) {
  let t = v(a), i = { ...v(a), check: "string_format", type: "string", format: n, fn: typeof r === "function" ? r : (o) => r.test(o), ...t };
  if (r instanceof RegExp) i.pattern = r;
  return new e(i);
}
function we(e) {
  let n = e?.target ?? "draft-2020-12";
  if (n === "draft-4") n = "draft-04";
  if (n === "draft-7") n = "draft-07";
  return { processors: e.processors ?? {}, metadataRegistry: e?.metadata ?? G, target: n, unrepresentable: e?.unrepresentable ?? "throw", override: e?.override ?? (() => {
  }), io: e?.io ?? "output", counter: 0, seen: /* @__PURE__ */ new Map(), cycles: e?.cycles ?? "ref", reused: e?.reused ?? "inline", external: e?.external ?? void 0 };
}
function T(e, n, r = { path: [], schemaPath: [] }) {
  var a;
  let t = e._zod.def, i = n.seen.get(e);
  if (i) {
    if (i.count++, r.schemaPath.includes(e)) i.cycle = r.path;
    return i.schema;
  }
  let o = { schema: {}, count: 1, cycle: void 0, path: r.path };
  n.seen.set(e, o);
  let u = e._zod.toJSONSchema?.();
  if (u) o.schema = u;
  else {
    let d = { ...r, schemaPath: [...r.schemaPath, e], path: r.path };
    if (e._zod.processJSONSchema) e._zod.processJSONSchema(n, o.schema, d);
    else {
      let p = o.schema, f = n.processors[t.type];
      if (!f) throw Error(`[toJSONSchema]: Non-representable type encountered: ${t.type}`);
      f(e, n, p, d);
    }
    let c = e._zod.parent;
    if (c) {
      if (!o.ref) o.ref = c;
      T(c, n, d), n.seen.get(c).isParent = true;
    }
  }
  let l = n.metadataRegistry.get(e);
  if (l) Object.assign(o.schema, l);
  if (n.io === "input" && R(e)) delete o.schema.examples, delete o.schema.default;
  if (n.io === "input" && "_prefault" in o.schema) (a = o.schema).default ?? (a.default = o.schema._prefault);
  return delete o.schema._prefault, n.seen.get(e).schema;
}
function Se(e, n) {
  let r = e.seen.get(n);
  if (!r) throw Error("Unprocessed schema. This is a bug in Zod.");
  let a = /* @__PURE__ */ new Map();
  for (let o of e.seen.entries()) {
    let u = e.metadataRegistry.get(o[0])?.id;
    if (u) {
      let l = a.get(u);
      if (l && l !== o[0]) throw Error(`Duplicate schema id "${u}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
      a.set(u, o[0]);
    }
  }
  let t = (o) => {
    let u = e.target === "draft-2020-12" ? "$defs" : "definitions";
    if (e.external) {
      let c = e.external.registry.get(o[0])?.id, p = e.external.uri ?? (($) => $);
      if (c) return { ref: p(c) };
      let f = o[1].defId ?? o[1].schema.id ?? `schema${e.counter++}`;
      return o[1].defId = f, { defId: f, ref: `${p("__shared")}#/${u}/${f}` };
    }
    if (o[1] === r) return { ref: "#" };
    let l = `#/${u}/`, d = o[1].schema.id ?? `__schema${e.counter++}`;
    return { defId: d, ref: l + d };
  }, i = (o) => {
    if (o[1].schema.$ref) return;
    let u = o[1], { ref: l, defId: d } = t(o);
    if (u.def = { ...u.schema }, d) u.defId = d;
    let c = u.schema;
    for (let p in c) delete c[p];
    c.$ref = l;
  };
  if (e.cycles === "throw") for (let o of e.seen.entries()) {
    let u = o[1];
    if (u.cycle) throw Error(`Cycle detected: #/${u.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
  }
  for (let o of e.seen.entries()) {
    let u = o[1];
    if (n === o[0]) {
      i(o);
      continue;
    }
    if (e.external) {
      let l = e.external.registry.get(o[0])?.id;
      if (n !== o[0] && l) {
        i(o);
        continue;
      }
    }
    if (e.metadataRegistry.get(o[0])?.id) {
      i(o);
      continue;
    }
    if (u.cycle) {
      i(o);
      continue;
    }
    if (u.count > 1) {
      if (e.reused === "ref") {
        i(o);
        continue;
      }
    }
  }
}
function xe(e, n) {
  let r = e.seen.get(n);
  if (!r) throw Error("Unprocessed schema. This is a bug in Zod.");
  let a = (u) => {
    let l = e.seen.get(u);
    if (l.ref === null) return;
    let d = l.def ?? l.schema, c = { ...d }, p = l.ref;
    if (l.ref = null, p) {
      a(p);
      let $ = e.seen.get(p), x = $.schema;
      if (x.$ref && (e.target === "draft-07" || e.target === "draft-04" || e.target === "openapi-3.0")) d.allOf = d.allOf ?? [], d.allOf.push(x);
      else Object.assign(d, x);
      if (Object.assign(d, c), u._zod.parent === p) for (let N in d) {
        if (N === "$ref" || N === "allOf") continue;
        if (!(N in c)) delete d[N];
      }
      if (x.$ref && $.def) for (let N in d) {
        if (N === "$ref" || N === "allOf") continue;
        if (N in $.def && JSON.stringify(d[N]) === JSON.stringify($.def[N])) delete d[N];
      }
    }
    let f = u._zod.parent;
    if (f && f !== p) {
      a(f);
      let $ = e.seen.get(f);
      if ($?.schema.$ref) {
        if (d.$ref = $.schema.$ref, $.def) for (let x in d) {
          if (x === "$ref" || x === "allOf") continue;
          if (x in $.def && JSON.stringify(d[x]) === JSON.stringify($.def[x])) delete d[x];
        }
      }
    }
    e.override({ zodSchema: u, jsonSchema: d, path: l.path ?? [] });
  };
  for (let u of [...e.seen.entries()].reverse()) a(u[0]);
  let t = {};
  if (e.target === "draft-2020-12") t.$schema = "https://json-schema.org/draft/2020-12/schema";
  else if (e.target === "draft-07") t.$schema = "http://json-schema.org/draft-07/schema#";
  else if (e.target === "draft-04") t.$schema = "http://json-schema.org/draft-04/schema#";
  else if (e.target === "openapi-3.0") ;
  if (e.external?.uri) {
    let u = e.external.registry.get(n)?.id;
    if (!u) throw Error("Schema is missing an `id` property");
    t.$id = e.external.uri(u);
  }
  Object.assign(t, r.def ?? r.schema);
  let i = e.metadataRegistry.get(n)?.id;
  if (i !== void 0 && t.id === i) delete t.id;
  let o = e.external?.defs ?? {};
  for (let u of e.seen.entries()) {
    let l = u[1];
    if (l.def && l.defId) {
      if (l.def.id === l.defId) delete l.def.id;
      o[l.defId] = l.def;
    }
  }
  if (e.external) ;
  else if (Object.keys(o).length > 0) if (e.target === "draft-2020-12") t.$defs = o;
  else t.definitions = o;
  try {
    let u = JSON.parse(JSON.stringify(t));
    return Object.defineProperty(u, "~standard", { value: { ...n["~standard"], jsonSchema: { input: Pe(n, "input", e.processors), output: Pe(n, "output", e.processors) } }, enumerable: false, writable: false }), u;
  } catch (u) {
    throw Error("Error converting schema to JSON.");
  }
}
function R(e, n) {
  let r = n ?? { seen: /* @__PURE__ */ new Set() };
  if (r.seen.has(e)) return false;
  r.seen.add(e);
  let a = e._zod.def;
  if (a.type === "transform") return true;
  if (a.type === "array") return R(a.element, r);
  if (a.type === "set") return R(a.valueType, r);
  if (a.type === "lazy") return R(a.getter(), r);
  if (a.type === "promise" || a.type === "optional" || a.type === "nonoptional" || a.type === "nullable" || a.type === "readonly" || a.type === "default" || a.type === "prefault") return R(a.innerType, r);
  if (a.type === "intersection") return R(a.left, r) || R(a.right, r);
  if (a.type === "record" || a.type === "map") return R(a.keyType, r) || R(a.valueType, r);
  if (a.type === "pipe") {
    if (e._zod.traits.has("$ZodCodec")) return true;
    return R(a.in, r) || R(a.out, r);
  }
  if (a.type === "object") {
    for (let t in a.shape) if (R(a.shape[t], r)) return true;
    return false;
  }
  if (a.type === "union") {
    for (let t of a.options) if (R(t, r)) return true;
    return false;
  }
  if (a.type === "tuple") {
    for (let t of a.items) if (R(t, r)) return true;
    if (a.rest && R(a.rest, r)) return true;
    return false;
  }
  return false;
}
var Nu = (e, n = {}) => (r) => {
  let a = we({ ...r, processors: n });
  return T(e, a), Se(a, e), xe(a, e);
};
var Pe = (e, n, r = {}) => (a) => {
  let { libraryOptions: t, target: i } = a ?? {}, o = we({ ...t ?? {}, target: i, io: n, processors: r });
  return T(e, o), Se(o, e), xe(o, e);
};
var Mp = { guid: "uuid", url: "uri", datetime: "date-time", json_string: "json-string", regex: "" };
var zu = (e, n, r, a) => {
  let t = r;
  t.type = "string";
  let { minimum: i, maximum: o, format: u, patterns: l, contentEncoding: d } = e._zod.bag;
  if (typeof i === "number") t.minLength = i;
  if (typeof o === "number") t.maxLength = o;
  if (u) {
    if (t.format = Mp[u] ?? u, t.format === "") delete t.format;
    if (u === "time") delete t.format;
  }
  if (d) t.contentEncoding = d;
  if (l && l.size > 0) {
    let c = [...l];
    if (c.length === 1) t.pattern = c[0].source;
    else if (c.length > 1) t.allOf = [...c.map((p) => ({ ...n.target === "draft-07" || n.target === "draft-04" || n.target === "openapi-3.0" ? { type: "string" } : {}, pattern: p.source }))];
  }
};
var Uu = (e, n, r, a) => {
  let t = r, { minimum: i, maximum: o, format: u, multipleOf: l, exclusiveMaximum: d, exclusiveMinimum: c } = e._zod.bag;
  if (typeof u === "string" && u.includes("int")) t.type = "integer";
  else t.type = "number";
  let p = typeof c === "number" && c >= (i ?? Number.NEGATIVE_INFINITY), f = typeof d === "number" && d <= (o ?? Number.POSITIVE_INFINITY), $ = n.target === "draft-04" || n.target === "openapi-3.0";
  if (p) if ($) t.minimum = c, t.exclusiveMinimum = true;
  else t.exclusiveMinimum = c;
  else if (typeof i === "number") t.minimum = i;
  if (f) if ($) t.maximum = d, t.exclusiveMaximum = true;
  else t.exclusiveMaximum = d;
  else if (typeof o === "number") t.maximum = o;
  if (typeof l === "number") t.multipleOf = l;
};
var Au = (e, n, r, a) => {
  r.type = "boolean";
};
var Du = (e, n, r, a) => {
  if (n.unrepresentable === "throw") throw Error("BigInt cannot be represented in JSON Schema");
};
var Pu = (e, n, r, a) => {
  if (n.unrepresentable === "throw") throw Error("Symbols cannot be represented in JSON Schema");
};
var ju = (e, n, r, a) => {
  if (n.target === "openapi-3.0") r.type = "string", r.nullable = true, r.enum = [null];
  else r.type = "null";
};
var Cu = (e, n, r, a) => {
  if (n.unrepresentable === "throw") throw Error("Undefined cannot be represented in JSON Schema");
};
var Ru = (e, n, r, a) => {
  if (n.unrepresentable === "throw") throw Error("Void cannot be represented in JSON Schema");
};
var Zu = (e, n, r, a) => {
  r.not = {};
};
var Lu = (e, n, r, a) => {
};
var Mu = (e, n, r, a) => {
};
var Bu = (e, n, r, a) => {
  if (n.unrepresentable === "throw") throw Error("Date cannot be represented in JSON Schema");
};
var Fu = (e, n, r, a) => {
  let t = e._zod.def, i = On(t.entries);
  if (i.every((o) => typeof o === "number")) r.type = "number";
  if (i.every((o) => typeof o === "string")) r.type = "string";
  r.enum = i;
};
var Ju = (e, n, r, a) => {
  let t = e._zod.def, i = [];
  for (let o of t.values) if (o === void 0) {
    if (n.unrepresentable === "throw") throw Error("Literal `undefined` cannot be represented in JSON Schema");
  } else if (typeof o === "bigint") if (n.unrepresentable === "throw") throw Error("BigInt literals cannot be represented in JSON Schema");
  else i.push(Number(o));
  else i.push(o);
  if (i.length === 0) ;
  else if (i.length === 1) {
    let o = i[0];
    if (r.type = o === null ? "null" : typeof o, n.target === "draft-04" || n.target === "openapi-3.0") r.enum = [o];
    else r.const = o;
  } else {
    if (i.every((o) => typeof o === "number")) r.type = "number";
    if (i.every((o) => typeof o === "string")) r.type = "string";
    if (i.every((o) => typeof o === "boolean")) r.type = "boolean";
    if (i.every((o) => o === null)) r.type = "null";
    r.enum = i;
  }
};
var Gu = (e, n, r, a) => {
  if (n.unrepresentable === "throw") throw Error("NaN cannot be represented in JSON Schema");
};
var Wu = (e, n, r, a) => {
  let t = r, i = e._zod.pattern;
  if (!i) throw Error("Pattern not found in template literal");
  t.type = "string", t.pattern = i.source;
};
var Vu = (e, n, r, a) => {
  let t = r, i = { type: "string", format: "binary", contentEncoding: "binary" }, { minimum: o, maximum: u, mime: l } = e._zod.bag;
  if (o !== void 0) i.minLength = o;
  if (u !== void 0) i.maxLength = u;
  if (l) if (l.length === 1) i.contentMediaType = l[0], Object.assign(t, i);
  else Object.assign(t, i), t.anyOf = l.map((d) => ({ contentMediaType: d }));
  else Object.assign(t, i);
};
var Ku = (e, n, r, a) => {
  r.type = "boolean";
};
var qu = (e, n, r, a) => {
  if (n.unrepresentable === "throw") throw Error("Custom types cannot be represented in JSON Schema");
};
var Hu = (e, n, r, a) => {
  if (n.unrepresentable === "throw") throw Error("Function types cannot be represented in JSON Schema");
};
var Xu = (e, n, r, a) => {
  if (n.unrepresentable === "throw") throw Error("Transforms cannot be represented in JSON Schema");
};
var Yu = (e, n, r, a) => {
  if (n.unrepresentable === "throw") throw Error("Map cannot be represented in JSON Schema");
};
var Qu = (e, n, r, a) => {
  if (n.unrepresentable === "throw") throw Error("Set cannot be represented in JSON Schema");
};
var el = (e, n, r, a) => {
  let t = r, i = e._zod.def, { minimum: o, maximum: u } = e._zod.bag;
  if (typeof o === "number") t.minItems = o;
  if (typeof u === "number") t.maxItems = u;
  t.type = "array", t.items = T(i.element, n, { ...a, path: [...a.path, "items"] });
};
var tl = (e, n, r, a) => {
  let t = r, i = e._zod.def;
  t.type = "object", t.properties = {};
  let o = i.shape;
  for (let d in o) t.properties[d] = T(o[d], n, { ...a, path: [...a.path, "properties", d] });
  let u = new Set(Object.keys(o)), l = new Set([...u].filter((d) => {
    let c = i.shape[d]._zod;
    if (n.io === "input") return c.optin === void 0;
    else return c.optout === void 0;
  }));
  if (l.size > 0) t.required = Array.from(l);
  if (i.catchall?._zod.def.type === "never") t.additionalProperties = false;
  else if (!i.catchall) {
    if (n.io === "output") t.additionalProperties = false;
  } else if (i.catchall) t.additionalProperties = T(i.catchall, n, { ...a, path: [...a.path, "additionalProperties"] });
};
var Oi = (e, n, r, a) => {
  let t = e._zod.def, i = t.inclusive === false, o = t.options.map((u, l) => T(u, n, { ...a, path: [...a.path, i ? "oneOf" : "anyOf", l] }));
  if (i) r.oneOf = o;
  else r.anyOf = o;
};
var nl = (e, n, r, a) => {
  let t = e._zod.def, i = T(t.left, n, { ...a, path: [...a.path, "allOf", 0] }), o = T(t.right, n, { ...a, path: [...a.path, "allOf", 1] }), u = (d) => "allOf" in d && Object.keys(d).length === 1, l = [...u(i) ? i.allOf : [i], ...u(o) ? o.allOf : [o]];
  r.allOf = l;
};
var il = (e, n, r, a) => {
  let t = r, i = e._zod.def;
  t.type = "array";
  let o = n.target === "draft-2020-12" ? "prefixItems" : "items", u = n.target === "draft-2020-12" ? "items" : n.target === "openapi-3.0" ? "items" : "additionalItems", l = i.items.map((f, $) => T(f, n, { ...a, path: [...a.path, o, $] })), d = i.rest ? T(i.rest, n, { ...a, path: [...a.path, u, ...n.target === "openapi-3.0" ? [i.items.length] : []] }) : null;
  if (n.target === "draft-2020-12") {
    if (t.prefixItems = l, d) t.items = d;
  } else if (n.target === "openapi-3.0") {
    if (t.items = { anyOf: l }, d) t.items.anyOf.push(d);
    if (t.minItems = l.length, !d) t.maxItems = l.length;
  } else if (t.items = l, d) t.additionalItems = d;
  let { minimum: c, maximum: p } = e._zod.bag;
  if (typeof c === "number") t.minItems = c;
  if (typeof p === "number") t.maxItems = p;
};
var rl = (e, n, r, a) => {
  let t = r, i = e._zod.def;
  t.type = "object";
  let o = i.keyType, u = o._zod.bag?.patterns;
  if (i.mode === "loose" && u && u.size > 0) {
    let d = T(i.valueType, n, { ...a, path: [...a.path, "patternProperties", "*"] });
    t.patternProperties = {};
    for (let c of u) t.patternProperties[c.source] = d;
  } else {
    if (n.target === "draft-07" || n.target === "draft-2020-12") t.propertyNames = T(i.keyType, n, { ...a, path: [...a.path, "propertyNames"] });
    t.additionalProperties = T(i.valueType, n, { ...a, path: [...a.path, "additionalProperties"] });
  }
  let l = o._zod.values;
  if (l) {
    let d = [...l].filter((c) => typeof c === "string" || typeof c === "number");
    if (d.length > 0) t.required = d;
  }
};
var al = (e, n, r, a) => {
  let t = e._zod.def, i = T(t.innerType, n, a), o = n.seen.get(e);
  if (n.target === "openapi-3.0") o.ref = t.innerType, r.nullable = true;
  else r.anyOf = [i, { type: "null" }];
};
var ol = (e, n, r, a) => {
  let t = e._zod.def;
  T(t.innerType, n, a);
  let i = n.seen.get(e);
  i.ref = t.innerType;
};
var sl = (e, n, r, a) => {
  let t = e._zod.def;
  T(t.innerType, n, a);
  let i = n.seen.get(e);
  i.ref = t.innerType, r.default = JSON.parse(JSON.stringify(t.defaultValue));
};
var ul = (e, n, r, a) => {
  let t = e._zod.def;
  T(t.innerType, n, a);
  let i = n.seen.get(e);
  if (i.ref = t.innerType, n.io === "input") r._prefault = JSON.parse(JSON.stringify(t.defaultValue));
};
var ll = (e, n, r, a) => {
  let t = e._zod.def;
  T(t.innerType, n, a);
  let i = n.seen.get(e);
  i.ref = t.innerType;
  let o;
  try {
    o = t.catchValue(void 0);
  } catch {
    throw Error("Dynamic catch values are not supported in JSON Schema");
  }
  r.default = o;
};
var dl = (e, n, r, a) => {
  let t = e._zod.def, i = t.in._zod.traits.has("$ZodTransform"), o = n.io === "input" ? i ? t.out : t.in : t.out;
  T(o, n, a);
  let u = n.seen.get(e);
  u.ref = o;
};
var cl = (e, n, r, a) => {
  let t = e._zod.def;
  T(t.innerType, n, a);
  let i = n.seen.get(e);
  i.ref = t.innerType, r.readOnly = true;
};
var ml = (e, n, r, a) => {
  let t = e._zod.def;
  T(t.innerType, n, a);
  let i = n.seen.get(e);
  i.ref = t.innerType;
};
var Ti = (e, n, r, a) => {
  let t = e._zod.def;
  T(t.innerType, n, a);
  let i = n.seen.get(e);
  i.ref = t.innerType;
};
var fl = (e, n, r, a) => {
  let t = e._zod.innerType;
  T(t, n, a);
  let i = n.seen.get(e);
  i.ref = t;
};
var Sn = { string: zu, number: Uu, boolean: Au, bigint: Du, symbol: Pu, null: ju, undefined: Cu, void: Ru, never: Zu, any: Lu, unknown: Mu, date: Bu, enum: Fu, literal: Ju, nan: Gu, template_literal: Wu, file: Vu, success: Ku, custom: qu, function: Hu, transform: Xu, map: Yu, set: Qu, array: el, object: tl, union: Oi, intersection: nl, tuple: il, record: rl, nullable: al, nonoptional: ol, default: sl, prefault: ul, catch: ll, pipe: dl, readonly: cl, promise: ml, optional: Ti, lazy: fl };
function pl(e, n) {
  if ("_idmap" in e) {
    let a = e, t = we({ ...n, processors: Sn }), i = {};
    for (let l of a._idmap.entries()) {
      let [d, c] = l;
      T(c, t);
    }
    let o = {}, u = { registry: a, uri: n?.uri, defs: i };
    t.external = u;
    for (let l of a._idmap.entries()) {
      let [d, c] = l;
      Se(t, c), o[d] = xe(t, c);
    }
    if (Object.keys(i).length > 0) {
      let l = t.target === "draft-2020-12" ? "$defs" : "definitions";
      o.__shared = { [l]: i };
    }
    return { schemas: o };
  }
  let r = we({ ...n, processors: Sn });
  return T(e, r), Se(r, e), xe(r, e);
}
var gl = class {
  get metadataRegistry() {
    return this.ctx.metadataRegistry;
  }
  get target() {
    return this.ctx.target;
  }
  get unrepresentable() {
    return this.ctx.unrepresentable;
  }
  get override() {
    return this.ctx.override;
  }
  get io() {
    return this.ctx.io;
  }
  get counter() {
    return this.ctx.counter;
  }
  set counter(e) {
    this.ctx.counter = e;
  }
  get seen() {
    return this.ctx.seen;
  }
  constructor(e) {
    let n = e?.target ?? "draft-2020-12";
    if (n === "draft-4") n = "draft-04";
    if (n === "draft-7") n = "draft-07";
    this.ctx = we({ processors: Sn, target: n, ...e?.metadata && { metadata: e.metadata }, ...e?.unrepresentable && { unrepresentable: e.unrepresentable }, ...e?.override && { override: e.override }, ...e?.io && { io: e.io } });
  }
  process(e, n = { path: [], schemaPath: [] }) {
    return T(e, this.ctx, n);
  }
  emit(e, n) {
    if (n) {
      if (n.cycles) this.ctx.cycles = n.cycles;
      if (n.reused) this.ctx.reused = n.reused;
      if (n.external) this.ctx.external = n.external;
    }
    Se(this.ctx, e);
    let r = xe(this.ctx, e), { "~standard": a, ...t } = r;
    return t;
  }
};
var Bp = {};
var vl = {};
Q(vl, { xor: () => Sd, xid: () => Kl, void: () => yd, uuidv7: () => Ll, uuidv6: () => Zl, uuidv4: () => Rl, uuid: () => Cl, url: () => Ml, unknown: () => me, union: () => mn, undefined: () => hd, ulid: () => Vl, uint64: () => gd, uint32: () => md, tuple: () => Yi, transform: () => pn, templateLiteral: () => Zd, symbol: () => vd, superRefine: () => xr, success: () => Pd, stringbool: () => Wd, stringFormat: () => ad, string: () => je, strictObject: () => Id, set: () => Nd, refine: () => Sr, record: () => Qi, readonly: () => yr, promise: () => Ld, preprocess: () => Kd, prefault: () => cr, pipe: () => St, partialRecord: () => Ed, optional: () => Re, object: () => kd, number: () => ji, nullish: () => Dd, nullable: () => Ze, null: () => Mi, nonoptional: () => mr, never: () => dn, nativeEnum: () => zd, nanoid: () => Jl, nan: () => jd, meta: () => Jd, map: () => Td, mac: () => Xl, looseRecord: () => Od, looseObject: () => wd, literal: () => Ud, lazy: () => kr, ksuid: () => ql, keyof: () => _d, jwt: () => rd, json: () => Vd, ipv6: () => Yl, ipv4: () => Hl, invertCodec: () => Rd, intersection: () => Hi, int64: () => pd, int32: () => cd, int: () => wt, instanceof: () => Gd, httpUrl: () => Bl, hostname: () => od, hex: () => sd, hash: () => ud, guid: () => jl, function: () => xt, float64: () => dd, float32: () => ld, file: () => Ad, exactOptional: () => or, enum: () => fn, emoji: () => Fl, email: () => Pl, e164: () => id, discriminatedUnion: () => xd, describe: () => Fd, date: () => bd, custom: () => Bd, cuid2: () => Wl, cuid: () => Gl, codec: () => Cd, cidrv6: () => ed, cidrv4: () => Ql, check: () => Md, catch: () => gr, boolean: () => Ci, bigint: () => fd, base64url: () => nd, base64: () => td, array: () => ot, any: () => $d, _function: () => xt, _default: () => lr, _ZodString: () => Gt, ZodXor: () => Vi, ZodXID: () => Yt, ZodVoid: () => Gi, ZodUnknown: () => Fi, ZodUnion: () => ut, ZodUndefined: () => Zi, ZodUUID: () => H, ZodURL: () => nt, ZodULID: () => Xt, ZodType: () => w, ZodTuple: () => Xi, ZodTransform: () => rr, ZodTemplateLiteral: () => br, ZodSymbol: () => Ri, ZodSuccess: () => fr, ZodStringFormat: () => U, ZodString: () => tt, ZodSet: () => tr, ZodRecord: () => Ee, ZodReadonly: () => $r, ZodPromise: () => Ir, ZodPreprocess: () => hr, ZodPrefault: () => dr, ZodPipe: () => lt, ZodOptional: () => gn, ZodObject: () => st, ZodNumberFormat: () => ge, ZodNumber: () => it, ZodNullable: () => sr, ZodNull: () => Li, ZodNonOptional: () => vn, ZodNever: () => Ji, ZodNanoID: () => Kt, ZodNaN: () => vr, ZodMap: () => er, ZodMAC: () => Pi, ZodLiteral: () => nr, ZodLazy: () => _r, ZodKSUID: () => Qt, ZodJWT: () => un, ZodIntersection: () => qi, ZodIPv6: () => tn, ZodIPv4: () => en, ZodGUID: () => Ce, ZodFunction: () => wr, ZodFile: () => ir, ZodExactOptional: () => ar, ZodEnum: () => Oe, ZodEmoji: () => Vt, ZodEmail: () => Wt, ZodE164: () => sn, ZodDiscriminatedUnion: () => Ki, ZodDefault: () => ur, ZodDate: () => cn, ZodCustomStringFormat: () => Ne, ZodCustom: () => ct, ZodCodec: () => dt, ZodCatch: () => pr, ZodCUID2: () => Ht, ZodCUID: () => qt, ZodCIDRv6: () => rn, ZodCIDRv4: () => nn, ZodBoolean: () => rt, ZodBigIntFormat: () => ln, ZodBigInt: () => at, ZodBase64URL: () => on, ZodBase64: () => an, ZodArray: () => Wi, ZodAny: () => Bi });
var hl = {};
Q(hl, { uppercase: () => Pt, trim: () => Mt, toUpperCase: () => Ft, toLowerCase: () => Bt, startsWith: () => Ct, slugify: () => Jt, size: () => He, regex: () => At, property: () => Ei, positive: () => Ii, overwrite: () => te, normalize: () => Lt, nonpositive: () => Si, nonnegative: () => xi, negative: () => wi, multipleOf: () => Ie, minSize: () => oe, minLength: () => ce, mime: () => Zt, maxSize: () => Te, maxLength: () => Xe, lte: () => W, lt: () => re, lowercase: () => Dt, length: () => Ye, includes: () => jt, gte: () => Z, gt: () => ae, endsWith: () => Rt });
var Ni = {};
Q(Ni, { time: () => bl, duration: () => _l, datetime: () => $l, date: () => yl, ZodISOTime: () => Ai, ZodISODuration: () => Di, ZodISODateTime: () => zi, ZodISODate: () => Ui });
var zi = m("ZodISODateTime", (e, n) => {
  Co.init(e, n), U.init(e, n);
});
function $l(e) {
  return Ks(zi, e);
}
var Ui = m("ZodISODate", (e, n) => {
  Ro.init(e, n), U.init(e, n);
});
function yl(e) {
  return qs(Ui, e);
}
var Ai = m("ZodISOTime", (e, n) => {
  Zo.init(e, n), U.init(e, n);
});
function bl(e) {
  return Hs(Ai, e);
}
var Di = m("ZodISODuration", (e, n) => {
  Lo.init(e, n), U.init(e, n);
});
function _l(e) {
  return Xs(Di, e);
}
var kl = (e, n) => {
  Nn.init(e, n), e.name = "ZodError", Object.defineProperties(e, { format: { value: (r) => Un(e, r) }, flatten: { value: (r) => zn(e, r) }, addIssue: { value: (r) => {
    e.issues.push(r), e.message = JSON.stringify(e.issues, yt, 2);
  } }, addIssues: { value: (r) => {
    e.issues.push(...r), e.message = JSON.stringify(e.issues, yt, 2);
  } }, isEmpty: { get() {
    return e.issues.length === 0;
  } } });
};
var Fp = m("ZodError", kl);
var B = m("ZodError", kl, { Parent: Error });
var Il = Be(B);
var wl = Fe(B);
var Sl = Je(B);
var xl = Ge(B);
var El = An(B);
var Ol = Dn(B);
var Tl = Pn(B);
var Nl = jn(B);
var zl = Cn(B);
var Ul = Rn(B);
var Al = Zn(B);
var Dl = Ln(B);
var ia = /* @__PURE__ */ new WeakMap();
function et(e, n, r) {
  let a = Object.getPrototypeOf(e), t = ia.get(a);
  if (!t) t = /* @__PURE__ */ new Set(), ia.set(a, t);
  if (t.has(n)) return;
  t.add(n);
  for (let i in r) {
    let o = r[i];
    Object.defineProperty(a, i, { configurable: true, enumerable: false, get() {
      let u = o.bind(this);
      return Object.defineProperty(this, i, { configurable: true, writable: true, enumerable: true, value: u }), u;
    }, set(u) {
      Object.defineProperty(this, i, { configurable: true, writable: true, enumerable: true, value: u });
    } });
  }
}
var w = m("ZodType", (e, n) => {
  return I.init(e, n), Object.assign(e["~standard"], { jsonSchema: { input: Pe(e, "input"), output: Pe(e, "output") } }), e.toJSONSchema = Nu(e, {}), e.def = n, e.type = n.type, Object.defineProperty(e, "_def", { value: n }), e.parse = (r, a) => Il(e, r, a, { callee: e.parse }), e.safeParse = (r, a) => Sl(e, r, a), e.parseAsync = async (r, a) => wl(e, r, a, { callee: e.parseAsync }), e.safeParseAsync = async (r, a) => xl(e, r, a), e.spa = e.safeParseAsync, e.encode = (r, a) => El(e, r, a), e.decode = (r, a) => Ol(e, r, a), e.encodeAsync = async (r, a) => Tl(e, r, a), e.decodeAsync = async (r, a) => Nl(e, r, a), e.safeEncode = (r, a) => zl(e, r, a), e.safeDecode = (r, a) => Ul(e, r, a), e.safeEncodeAsync = async (r, a) => Al(e, r, a), e.safeDecodeAsync = async (r, a) => Dl(e, r, a), et(e, "ZodType", { check(...r) {
    let a = this.def;
    return this.clone(E.mergeDefs(a, { checks: [...a.checks ?? [], ...r.map((t) => typeof t === "function" ? { _zod: { check: t, def: { check: "custom" }, onattach: [] } } : t)] }), { parent: true });
  }, with(...r) {
    return this.check(...r);
  }, clone(r, a) {
    return V(this, r, a);
  }, brand() {
    return this;
  }, register(r, a) {
    return r.add(this, a), this;
  }, refine(r, a) {
    return this.check(Sr(r, a));
  }, superRefine(r, a) {
    return this.check(xr(r, a));
  }, overwrite(r) {
    return this.check(te(r));
  }, optional() {
    return Re(this);
  }, exactOptional() {
    return or(this);
  }, nullable() {
    return Ze(this);
  }, nullish() {
    return Re(Ze(this));
  }, nonoptional(r) {
    return mr(this, r);
  }, array() {
    return ot(this);
  }, or(r) {
    return mn([this, r]);
  }, and(r) {
    return Hi(this, r);
  }, transform(r) {
    return St(this, pn(r));
  }, default(r) {
    return lr(this, r);
  }, prefault(r) {
    return cr(this, r);
  }, catch(r) {
    return gr(this, r);
  }, pipe(r) {
    return St(this, r);
  }, readonly() {
    return yr(this);
  }, describe(r) {
    let a = this.clone();
    return G.add(a, { description: r }), a;
  }, meta(...r) {
    if (r.length === 0) return G.get(this);
    let a = this.clone();
    return G.add(a, r[0]), a;
  }, isOptional() {
    return this.safeParse(void 0).success;
  }, isNullable() {
    return this.safeParse(null).success;
  }, apply(r) {
    return r(this);
  } }), Object.defineProperty(e, "description", { get() {
    return G.get(e)?.description;
  }, configurable: true }), e;
});
var Gt = m("_ZodString", (e, n) => {
  qe.init(e, n), w.init(e, n), e._zod.processJSONSchema = (a, t, i) => zu(e, a, t, i);
  let r = e._zod.bag;
  e.format = r.format ?? null, e.minLength = r.minimum ?? null, e.maxLength = r.maximum ?? null, et(e, "_ZodString", { regex(...a) {
    return this.check(At(...a));
  }, includes(...a) {
    return this.check(jt(...a));
  }, startsWith(...a) {
    return this.check(Ct(...a));
  }, endsWith(...a) {
    return this.check(Rt(...a));
  }, min(...a) {
    return this.check(ce(...a));
  }, max(...a) {
    return this.check(Xe(...a));
  }, length(...a) {
    return this.check(Ye(...a));
  }, nonempty(...a) {
    return this.check(ce(1, ...a));
  }, lowercase(a) {
    return this.check(Dt(a));
  }, uppercase(a) {
    return this.check(Pt(a));
  }, trim() {
    return this.check(Mt());
  }, normalize(...a) {
    return this.check(Lt(...a));
  }, toLowerCase() {
    return this.check(Bt());
  }, toUpperCase() {
    return this.check(Ft());
  }, slugify() {
    return this.check(Jt());
  } });
});
var tt = m("ZodString", (e, n) => {
  qe.init(e, n), Gt.init(e, n), e.email = (r) => e.check(ii(Wt, r)), e.url = (r) => e.check(Ut(nt, r)), e.jwt = (r) => e.check(ki(un, r)), e.emoji = (r) => e.check(ui(Vt, r)), e.guid = (r) => e.check(It(Ce, r)), e.uuid = (r) => e.check(ri(H, r)), e.uuidv4 = (r) => e.check(ai(H, r)), e.uuidv6 = (r) => e.check(oi(H, r)), e.uuidv7 = (r) => e.check(si(H, r)), e.nanoid = (r) => e.check(li(Kt, r)), e.guid = (r) => e.check(It(Ce, r)), e.cuid = (r) => e.check(di(qt, r)), e.cuid2 = (r) => e.check(ci(Ht, r)), e.ulid = (r) => e.check(mi(Xt, r)), e.base64 = (r) => e.check(yi(an, r)), e.base64url = (r) => e.check(bi(on, r)), e.xid = (r) => e.check(fi(Yt, r)), e.ksuid = (r) => e.check(pi(Qt, r)), e.ipv4 = (r) => e.check(gi(en, r)), e.ipv6 = (r) => e.check(vi(tn, r)), e.cidrv4 = (r) => e.check(hi(nn, r)), e.cidrv6 = (r) => e.check($i(rn, r)), e.e164 = (r) => e.check(_i(sn, r)), e.datetime = (r) => e.check($l(r)), e.date = (r) => e.check(yl(r)), e.time = (r) => e.check(bl(r)), e.duration = (r) => e.check(_l(r));
});
function je(e) {
  return Js(tt, e);
}
var U = m("ZodStringFormat", (e, n) => {
  z.init(e, n), Gt.init(e, n);
});
var Wt = m("ZodEmail", (e, n) => {
  Oo.init(e, n), U.init(e, n);
});
function Pl(e) {
  return ii(Wt, e);
}
var Ce = m("ZodGUID", (e, n) => {
  xo.init(e, n), U.init(e, n);
});
function jl(e) {
  return It(Ce, e);
}
var H = m("ZodUUID", (e, n) => {
  Eo.init(e, n), U.init(e, n);
});
function Cl(e) {
  return ri(H, e);
}
function Rl(e) {
  return ai(H, e);
}
function Zl(e) {
  return oi(H, e);
}
function Ll(e) {
  return si(H, e);
}
var nt = m("ZodURL", (e, n) => {
  To.init(e, n), U.init(e, n);
});
function Ml(e) {
  return Ut(nt, e);
}
function Bl(e) {
  return Ut(nt, { protocol: ie.httpProtocol, hostname: ie.domain, ...E.normalizeParams(e) });
}
var Vt = m("ZodEmoji", (e, n) => {
  No.init(e, n), U.init(e, n);
});
function Fl(e) {
  return ui(Vt, e);
}
var Kt = m("ZodNanoID", (e, n) => {
  zo.init(e, n), U.init(e, n);
});
function Jl(e) {
  return li(Kt, e);
}
var qt = m("ZodCUID", (e, n) => {
  Uo.init(e, n), U.init(e, n);
});
function Gl(e) {
  return di(qt, e);
}
var Ht = m("ZodCUID2", (e, n) => {
  Ao.init(e, n), U.init(e, n);
});
function Wl(e) {
  return ci(Ht, e);
}
var Xt = m("ZodULID", (e, n) => {
  Do.init(e, n), U.init(e, n);
});
function Vl(e) {
  return mi(Xt, e);
}
var Yt = m("ZodXID", (e, n) => {
  Po.init(e, n), U.init(e, n);
});
function Kl(e) {
  return fi(Yt, e);
}
var Qt = m("ZodKSUID", (e, n) => {
  jo.init(e, n), U.init(e, n);
});
function ql(e) {
  return pi(Qt, e);
}
var en = m("ZodIPv4", (e, n) => {
  Mo.init(e, n), U.init(e, n);
});
function Hl(e) {
  return gi(en, e);
}
var Pi = m("ZodMAC", (e, n) => {
  Fo.init(e, n), U.init(e, n);
});
function Xl(e) {
  return Ws(Pi, e);
}
var tn = m("ZodIPv6", (e, n) => {
  Bo.init(e, n), U.init(e, n);
});
function Yl(e) {
  return vi(tn, e);
}
var nn = m("ZodCIDRv4", (e, n) => {
  Jo.init(e, n), U.init(e, n);
});
function Ql(e) {
  return hi(nn, e);
}
var rn = m("ZodCIDRv6", (e, n) => {
  Go.init(e, n), U.init(e, n);
});
function ed(e) {
  return $i(rn, e);
}
var an = m("ZodBase64", (e, n) => {
  Wo.init(e, n), U.init(e, n);
});
function td(e) {
  return yi(an, e);
}
var on = m("ZodBase64URL", (e, n) => {
  Ko.init(e, n), U.init(e, n);
});
function nd(e) {
  return bi(on, e);
}
var sn = m("ZodE164", (e, n) => {
  qo.init(e, n), U.init(e, n);
});
function id(e) {
  return _i(sn, e);
}
var un = m("ZodJWT", (e, n) => {
  Xo.init(e, n), U.init(e, n);
});
function rd(e) {
  return ki(un, e);
}
var Ne = m("ZodCustomStringFormat", (e, n) => {
  Yo.init(e, n), U.init(e, n);
});
function ad(e, n, r = {}) {
  return Qe(Ne, e, n, r);
}
function od(e) {
  return Qe(Ne, "hostname", ie.hostname, e);
}
function sd(e) {
  return Qe(Ne, "hex", ie.hex, e);
}
function ud(e, n) {
  let r = n?.enc ?? "hex", a = `${e}_${r}`, t = ie[a];
  if (!t) throw Error(`Unrecognized hash format: ${a}`);
  return Qe(Ne, a, t, n);
}
var it = m("ZodNumber", (e, n) => {
  Vn.init(e, n), w.init(e, n), e._zod.processJSONSchema = (a, t, i) => Uu(e, a, t, i), et(e, "ZodNumber", { gt(a, t) {
    return this.check(ae(a, t));
  }, gte(a, t) {
    return this.check(Z(a, t));
  }, min(a, t) {
    return this.check(Z(a, t));
  }, lt(a, t) {
    return this.check(re(a, t));
  }, lte(a, t) {
    return this.check(W(a, t));
  }, max(a, t) {
    return this.check(W(a, t));
  }, int(a) {
    return this.check(wt(a));
  }, safe(a) {
    return this.check(wt(a));
  }, positive(a) {
    return this.check(ae(0, a));
  }, nonnegative(a) {
    return this.check(Z(0, a));
  }, negative(a) {
    return this.check(re(0, a));
  }, nonpositive(a) {
    return this.check(W(0, a));
  }, multipleOf(a, t) {
    return this.check(Ie(a, t));
  }, step(a, t) {
    return this.check(Ie(a, t));
  }, finite() {
    return this;
  } });
  let r = e._zod.bag;
  e.minValue = Math.max(r.minimum ?? Number.NEGATIVE_INFINITY, r.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null, e.maxValue = Math.min(r.maximum ?? Number.POSITIVE_INFINITY, r.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null, e.isInt = (r.format ?? "").includes("int") || Number.isSafeInteger(r.multipleOf ?? 0.5), e.isFinite = true, e.format = r.format ?? null;
});
function ji(e) {
  return Ys(it, e);
}
var ge = m("ZodNumberFormat", (e, n) => {
  Qo.init(e, n), it.init(e, n);
});
function wt(e) {
  return eu(ge, e);
}
function ld(e) {
  return tu(ge, e);
}
function dd(e) {
  return nu(ge, e);
}
function cd(e) {
  return iu(ge, e);
}
function md(e) {
  return ru(ge, e);
}
var rt = m("ZodBoolean", (e, n) => {
  Kn.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => Au(e, r, a, t);
});
function Ci(e) {
  return au(rt, e);
}
var at = m("ZodBigInt", (e, n) => {
  qn.init(e, n), w.init(e, n), e._zod.processJSONSchema = (a, t, i) => Du(e, a, t, i), e.gte = (a, t) => e.check(Z(a, t)), e.min = (a, t) => e.check(Z(a, t)), e.gt = (a, t) => e.check(ae(a, t)), e.gte = (a, t) => e.check(Z(a, t)), e.min = (a, t) => e.check(Z(a, t)), e.lt = (a, t) => e.check(re(a, t)), e.lte = (a, t) => e.check(W(a, t)), e.max = (a, t) => e.check(W(a, t)), e.positive = (a) => e.check(ae(BigInt(0), a)), e.negative = (a) => e.check(re(BigInt(0), a)), e.nonpositive = (a) => e.check(W(BigInt(0), a)), e.nonnegative = (a) => e.check(Z(BigInt(0), a)), e.multipleOf = (a, t) => e.check(Ie(a, t));
  let r = e._zod.bag;
  e.minValue = r.minimum ?? null, e.maxValue = r.maximum ?? null, e.format = r.format ?? null;
});
function fd(e) {
  return su(at, e);
}
var ln = m("ZodBigIntFormat", (e, n) => {
  es.init(e, n), at.init(e, n);
});
function pd(e) {
  return lu(ln, e);
}
function gd(e) {
  return du(ln, e);
}
var Ri = m("ZodSymbol", (e, n) => {
  ts.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => Pu(e, r, a, t);
});
function vd(e) {
  return cu(Ri, e);
}
var Zi = m("ZodUndefined", (e, n) => {
  ns.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => Cu(e, r, a, t);
});
function hd(e) {
  return mu(Zi, e);
}
var Li = m("ZodNull", (e, n) => {
  is.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => ju(e, r, a, t);
});
function Mi(e) {
  return fu(Li, e);
}
var Bi = m("ZodAny", (e, n) => {
  rs.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => Lu(e, r, a, t);
});
function $d() {
  return pu(Bi);
}
var Fi = m("ZodUnknown", (e, n) => {
  as.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => Mu(e, r, a, t);
});
function me() {
  return gu(Fi);
}
var Ji = m("ZodNever", (e, n) => {
  os.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => Zu(e, r, a, t);
});
function dn(e) {
  return vu(Ji, e);
}
var Gi = m("ZodVoid", (e, n) => {
  ss.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => Ru(e, r, a, t);
});
function yd(e) {
  return hu(Gi, e);
}
var cn = m("ZodDate", (e, n) => {
  us.init(e, n), w.init(e, n), e._zod.processJSONSchema = (a, t, i) => Bu(e, a, t, i), e.min = (a, t) => e.check(Z(a, t)), e.max = (a, t) => e.check(W(a, t));
  let r = e._zod.bag;
  e.minDate = r.minimum ? new Date(r.minimum) : null, e.maxDate = r.maximum ? new Date(r.maximum) : null;
});
function bd(e) {
  return $u(cn, e);
}
var Wi = m("ZodArray", (e, n) => {
  ls.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => el(e, r, a, t), e.element = n.element, et(e, "ZodArray", { min(r, a) {
    return this.check(ce(r, a));
  }, nonempty(r) {
    return this.check(ce(1, r));
  }, max(r, a) {
    return this.check(Xe(r, a));
  }, length(r, a) {
    return this.check(Ye(r, a));
  }, unwrap() {
    return this.element;
  } });
});
function ot(e, n) {
  return _u(Wi, e, n);
}
function _d(e) {
  let n = e._zod.def.shape;
  return fn(Object.keys(n));
}
var st = m("ZodObject", (e, n) => {
  fs.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => tl(e, r, a, t), E.defineLazy(e, "shape", () => {
    return n.shape;
  }), et(e, "ZodObject", { keyof() {
    return fn(Object.keys(this._zod.def.shape));
  }, catchall(r) {
    return this.clone({ ...this._zod.def, catchall: r });
  }, passthrough() {
    return this.clone({ ...this._zod.def, catchall: me() });
  }, loose() {
    return this.clone({ ...this._zod.def, catchall: me() });
  }, strict() {
    return this.clone({ ...this._zod.def, catchall: dn() });
  }, strip() {
    return this.clone({ ...this._zod.def, catchall: void 0 });
  }, extend(r) {
    return E.extend(this, r);
  }, safeExtend(r) {
    return E.safeExtend(this, r);
  }, merge(r) {
    return E.merge(this, r);
  }, pick(r) {
    return E.pick(this, r);
  }, omit(r) {
    return E.omit(this, r);
  }, partial(...r) {
    return E.partial(gn, this, r[0]);
  }, required(...r) {
    return E.required(vn, this, r[0]);
  } });
});
function kd(e, n) {
  let r = { type: "object", shape: e ?? {}, ...E.normalizeParams(n) };
  return new st(r);
}
function Id(e, n) {
  return new st({ type: "object", shape: e, catchall: dn(), ...E.normalizeParams(n) });
}
function wd(e, n) {
  return new st({ type: "object", shape: e, catchall: me(), ...E.normalizeParams(n) });
}
var ut = m("ZodUnion", (e, n) => {
  zt.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => Oi(e, r, a, t), e.options = n.options;
});
function mn(e, n) {
  return new ut({ type: "union", options: e, ...E.normalizeParams(n) });
}
var Vi = m("ZodXor", (e, n) => {
  ut.init(e, n), ps.init(e, n), e._zod.processJSONSchema = (r, a, t) => Oi(e, r, a, t), e.options = n.options;
});
function Sd(e, n) {
  return new Vi({ type: "union", options: e, inclusive: false, ...E.normalizeParams(n) });
}
var Ki = m("ZodDiscriminatedUnion", (e, n) => {
  ut.init(e, n), gs.init(e, n);
});
function xd(e, n, r) {
  return new Ki({ type: "union", options: n, discriminator: e, ...E.normalizeParams(r) });
}
var qi = m("ZodIntersection", (e, n) => {
  vs.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => nl(e, r, a, t);
});
function Hi(e, n) {
  return new qi({ type: "intersection", left: e, right: n });
}
var Xi = m("ZodTuple", (e, n) => {
  Hn.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => il(e, r, a, t), e.rest = (r) => e.clone({ ...e._zod.def, rest: r });
});
function Yi(e, n, r) {
  let a = n instanceof I, t = a ? r : n;
  return new Xi({ type: "tuple", items: e, rest: a ? n : null, ...E.normalizeParams(t) });
}
var Ee = m("ZodRecord", (e, n) => {
  hs.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => rl(e, r, a, t), e.keyType = n.keyType, e.valueType = n.valueType;
});
function Qi(e, n, r) {
  if (!n || !n._zod) return new Ee({ type: "record", keyType: je(), valueType: e, ...E.normalizeParams(n) });
  return new Ee({ type: "record", keyType: e, valueType: n, ...E.normalizeParams(r) });
}
function Ed(e, n, r) {
  let a = V(e);
  return a._zod.values = void 0, new Ee({ type: "record", keyType: a, valueType: n, ...E.normalizeParams(r) });
}
function Od(e, n, r) {
  return new Ee({ type: "record", keyType: e, valueType: n, mode: "loose", ...E.normalizeParams(r) });
}
var er = m("ZodMap", (e, n) => {
  $s.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => Yu(e, r, a, t), e.keyType = n.keyType, e.valueType = n.valueType, e.min = (...r) => e.check(oe(...r)), e.nonempty = (r) => e.check(oe(1, r)), e.max = (...r) => e.check(Te(...r)), e.size = (...r) => e.check(He(...r));
});
function Td(e, n, r) {
  return new er({ type: "map", keyType: e, valueType: n, ...E.normalizeParams(r) });
}
var tr = m("ZodSet", (e, n) => {
  ys.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => Qu(e, r, a, t), e.min = (...r) => e.check(oe(...r)), e.nonempty = (r) => e.check(oe(1, r)), e.max = (...r) => e.check(Te(...r)), e.size = (...r) => e.check(He(...r));
});
function Nd(e, n) {
  return new tr({ type: "set", valueType: e, ...E.normalizeParams(n) });
}
var Oe = m("ZodEnum", (e, n) => {
  bs.init(e, n), w.init(e, n), e._zod.processJSONSchema = (a, t, i) => Fu(e, a, t, i), e.enum = n.entries, e.options = Object.values(n.entries);
  let r = new Set(Object.keys(n.entries));
  e.extract = (a, t) => {
    let i = {};
    for (let o of a) if (r.has(o)) i[o] = n.entries[o];
    else throw Error(`Key ${o} not found in enum`);
    return new Oe({ ...n, checks: [], ...E.normalizeParams(t), entries: i });
  }, e.exclude = (a, t) => {
    let i = { ...n.entries };
    for (let o of a) if (r.has(o)) delete i[o];
    else throw Error(`Key ${o} not found in enum`);
    return new Oe({ ...n, checks: [], ...E.normalizeParams(t), entries: i });
  };
});
function fn(e, n) {
  let r = Array.isArray(e) ? Object.fromEntries(e.map((a) => [a, a])) : e;
  return new Oe({ type: "enum", entries: r, ...E.normalizeParams(n) });
}
function zd(e, n) {
  return new Oe({ type: "enum", entries: e, ...E.normalizeParams(n) });
}
var nr = m("ZodLiteral", (e, n) => {
  _s.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => Ju(e, r, a, t), e.values = new Set(n.values), Object.defineProperty(e, "value", { get() {
    if (n.values.length > 1) throw Error("This schema contains multiple valid literal values. Use `.values` instead.");
    return n.values[0];
  } });
});
function Ud(e, n) {
  return new nr({ type: "literal", values: Array.isArray(e) ? e : [e], ...E.normalizeParams(n) });
}
var ir = m("ZodFile", (e, n) => {
  ks.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => Vu(e, r, a, t), e.min = (r, a) => e.check(oe(r, a)), e.max = (r, a) => e.check(Te(r, a)), e.mime = (r, a) => e.check(Zt(Array.isArray(r) ? r : [r], a));
});
function Ad(e) {
  return ku(ir, e);
}
var rr = m("ZodTransform", (e, n) => {
  Is.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => Xu(e, r, a, t), e._zod.parse = (r, a) => {
    if (a.direction === "backward") throw new Le(e.constructor.name);
    r.addIssue = (i) => {
      if (typeof i === "string") r.issues.push(E.issue(i, r.value, n));
      else {
        let o = i;
        if (o.fatal) o.continue = false;
        o.code ?? (o.code = "custom"), o.input ?? (o.input = r.value), o.inst ?? (o.inst = e), r.issues.push(E.issue(o));
      }
    };
    let t = n.transform(r.value, r);
    if (t instanceof Promise) return t.then((i) => {
      return r.value = i, r.fallback = true, r;
    });
    return r.value = t, r.fallback = true, r;
  };
});
function pn(e) {
  return new rr({ type: "transform", transform: e });
}
var gn = m("ZodOptional", (e, n) => {
  Xn.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => Ti(e, r, a, t), e.unwrap = () => e._zod.def.innerType;
});
function Re(e) {
  return new gn({ type: "optional", innerType: e });
}
var ar = m("ZodExactOptional", (e, n) => {
  ws.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => Ti(e, r, a, t), e.unwrap = () => e._zod.def.innerType;
});
function or(e) {
  return new ar({ type: "optional", innerType: e });
}
var sr = m("ZodNullable", (e, n) => {
  Ss.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => al(e, r, a, t), e.unwrap = () => e._zod.def.innerType;
});
function Ze(e) {
  return new sr({ type: "nullable", innerType: e });
}
function Dd(e) {
  return Re(Ze(e));
}
var ur = m("ZodDefault", (e, n) => {
  xs.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => sl(e, r, a, t), e.unwrap = () => e._zod.def.innerType, e.removeDefault = e.unwrap;
});
function lr(e, n) {
  return new ur({ type: "default", innerType: e, get defaultValue() {
    return typeof n === "function" ? n() : E.shallowClone(n);
  } });
}
var dr = m("ZodPrefault", (e, n) => {
  Es.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => ul(e, r, a, t), e.unwrap = () => e._zod.def.innerType;
});
function cr(e, n) {
  return new dr({ type: "prefault", innerType: e, get defaultValue() {
    return typeof n === "function" ? n() : E.shallowClone(n);
  } });
}
var vn = m("ZodNonOptional", (e, n) => {
  Os.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => ol(e, r, a, t), e.unwrap = () => e._zod.def.innerType;
});
function mr(e, n) {
  return new vn({ type: "nonoptional", innerType: e, ...E.normalizeParams(n) });
}
var fr = m("ZodSuccess", (e, n) => {
  Ts.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => Ku(e, r, a, t), e.unwrap = () => e._zod.def.innerType;
});
function Pd(e) {
  return new fr({ type: "success", innerType: e });
}
var pr = m("ZodCatch", (e, n) => {
  Ns.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => ll(e, r, a, t), e.unwrap = () => e._zod.def.innerType, e.removeCatch = e.unwrap;
});
function gr(e, n) {
  return new pr({ type: "catch", innerType: e, catchValue: typeof n === "function" ? n : () => n });
}
var vr = m("ZodNaN", (e, n) => {
  zs.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => Gu(e, r, a, t);
});
function jd(e) {
  return bu(vr, e);
}
var lt = m("ZodPipe", (e, n) => {
  Yn.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => dl(e, r, a, t), e.in = n.in, e.out = n.out;
});
function St(e, n) {
  return new lt({ type: "pipe", in: e, out: n });
}
var dt = m("ZodCodec", (e, n) => {
  lt.init(e, n), Qn.init(e, n);
});
function Cd(e, n, r) {
  return new dt({ type: "pipe", in: e, out: n, transform: r.decode, reverseTransform: r.encode });
}
function Rd(e) {
  let n = e._zod.def;
  return new dt({ type: "pipe", in: n.out, out: n.in, transform: n.reverseTransform, reverseTransform: n.transform });
}
var hr = m("ZodPreprocess", (e, n) => {
  lt.init(e, n), Us.init(e, n);
});
var $r = m("ZodReadonly", (e, n) => {
  As.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => cl(e, r, a, t), e.unwrap = () => e._zod.def.innerType;
});
function yr(e) {
  return new $r({ type: "readonly", innerType: e });
}
var br = m("ZodTemplateLiteral", (e, n) => {
  Ds.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => Wu(e, r, a, t);
});
function Zd(e, n) {
  return new br({ type: "template_literal", parts: e, ...E.normalizeParams(n) });
}
var _r = m("ZodLazy", (e, n) => {
  Cs.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => fl(e, r, a, t), e.unwrap = () => e._zod.def.getter();
});
function kr(e) {
  return new _r({ type: "lazy", getter: e });
}
var Ir = m("ZodPromise", (e, n) => {
  js.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => ml(e, r, a, t), e.unwrap = () => e._zod.def.innerType;
});
function Ld(e) {
  return new Ir({ type: "promise", innerType: e });
}
var wr = m("ZodFunction", (e, n) => {
  Ps.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => Hu(e, r, a, t);
});
function xt(e) {
  return new wr({ type: "function", input: Array.isArray(e?.input) ? Yi(e?.input) : e?.input ?? ot(me()), output: e?.output ?? me() });
}
var ct = m("ZodCustom", (e, n) => {
  Rs.init(e, n), w.init(e, n), e._zod.processJSONSchema = (r, a, t) => qu(e, r, a, t);
});
function Md(e) {
  let n = new D({ check: "custom" });
  return n._zod.check = e, n;
}
function Bd(e, n) {
  return Iu(ct, e ?? (() => true), n);
}
function Sr(e, n = {}) {
  return wu(ct, e, n);
}
function xr(e, n) {
  return Su(e, n);
}
var Fd = Eu;
var Jd = Ou;
function Gd(e, n = {}) {
  let r = new ct({ type: "custom", check: "custom", fn: (a) => a instanceof e, abort: true, ...E.normalizeParams(n) });
  return r._zod.bag.Class = e, r._zod.check = (a) => {
    if (!(a.value instanceof e)) a.issues.push({ code: "invalid_type", expected: e.name, input: a.value, inst: r, path: [...r._zod.def.path ?? []] });
  }, r;
}
var Wd = (...e) => Tu({ Codec: dt, Boolean: rt, String: tt }, ...e);
function Vd(e) {
  let n = kr(() => {
    return mn([je(e), ji(), Ci(), Mi(), ot(n), Qi(je(), n)]);
  });
  return n;
}
function Kd(e, n) {
  return new hr({ type: "pipe", in: pn(e), out: n });
}
var Jp = { invalid_type: "invalid_type", too_big: "too_big", too_small: "too_small", invalid_format: "invalid_format", not_multiple_of: "not_multiple_of", unrecognized_keys: "unrecognized_keys", invalid_union: "invalid_union", invalid_key: "invalid_key", invalid_element: "invalid_element", invalid_value: "invalid_value", custom: "custom" };
function Gp(e) {
  j({ customError: e });
}
function Wp() {
  return j().customError;
}
var xn;
/* @__PURE__ */ (function(e) {
})(xn || (xn = {}));
var h = { ...vl, ...hl, iso: Ni };
var Vp = /* @__PURE__ */ new Set(["$schema", "$ref", "$defs", "definitions", "$id", "id", "$comment", "$anchor", "$vocabulary", "$dynamicRef", "$dynamicAnchor", "type", "enum", "const", "anyOf", "oneOf", "allOf", "not", "properties", "required", "additionalProperties", "patternProperties", "propertyNames", "minProperties", "maxProperties", "items", "prefixItems", "additionalItems", "minItems", "maxItems", "uniqueItems", "contains", "minContains", "maxContains", "minLength", "maxLength", "pattern", "format", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "description", "default", "contentEncoding", "contentMediaType", "contentSchema", "unevaluatedItems", "unevaluatedProperties", "if", "then", "else", "dependentSchemas", "dependentRequired", "nullable", "readOnly"]);
function Kp(e, n) {
  let r = e.$schema;
  if (r === "https://json-schema.org/draft/2020-12/schema") return "draft-2020-12";
  if (r === "http://json-schema.org/draft-07/schema#") return "draft-7";
  if (r === "http://json-schema.org/draft-04/schema#") return "draft-4";
  return n ?? "draft-2020-12";
}
function qp(e, n) {
  if (!e.startsWith("#")) throw Error("External $ref is not supported, only local refs (#/...) are allowed");
  let r = e.slice(1).split("/").filter(Boolean);
  if (r.length === 0) return n.rootSchema;
  let a = n.version === "draft-2020-12" ? "$defs" : "definitions";
  if (r[0] === a) {
    let t = r[1];
    if (!t || !n.defs[t]) throw Error(`Reference not found: ${e}`);
    return n.defs[t];
  }
  throw Error(`Reference not found: ${e}`);
}
function qd(e, n) {
  if (e.not !== void 0) {
    if (typeof e.not === "object" && Object.keys(e.not).length === 0) return h.never();
    throw Error("not is not supported in Zod (except { not: {} } for never)");
  }
  if (e.unevaluatedItems !== void 0) throw Error("unevaluatedItems is not supported");
  if (e.unevaluatedProperties !== void 0) throw Error("unevaluatedProperties is not supported");
  if (e.if !== void 0 || e.then !== void 0 || e.else !== void 0) throw Error("Conditional schemas (if/then/else) are not supported");
  if (e.dependentSchemas !== void 0 || e.dependentRequired !== void 0) throw Error("dependentSchemas and dependentRequired are not supported");
  if (e.$ref) {
    let t = e.$ref;
    if (n.refs.has(t)) return n.refs.get(t);
    if (n.processing.has(t)) return h.lazy(() => {
      if (!n.refs.has(t)) throw Error(`Circular reference not resolved: ${t}`);
      return n.refs.get(t);
    });
    n.processing.add(t);
    let i = qp(t, n), o = C(i, n);
    return n.refs.set(t, o), n.processing.delete(t), o;
  }
  if (e.enum !== void 0) {
    let t = e.enum;
    if (n.version === "openapi-3.0" && e.nullable === true && t.length === 1 && t[0] === null) return h.null();
    if (t.length === 0) return h.never();
    if (t.length === 1) return h.literal(t[0]);
    if (t.every((o) => typeof o === "string")) return h.enum(t);
    let i = t.map((o) => h.literal(o));
    if (i.length < 2) return i[0];
    return h.union([i[0], i[1], ...i.slice(2)]);
  }
  if (e.const !== void 0) return h.literal(e.const);
  let r = e.type;
  if (Array.isArray(r)) {
    let t = r.map((i) => {
      let o = { ...e, type: i };
      return qd(o, n);
    });
    if (t.length === 0) return h.never();
    if (t.length === 1) return t[0];
    return h.union(t);
  }
  if (!r) return h.any();
  let a;
  switch (r) {
    case "string": {
      let t = h.string();
      if (e.format) {
        let i = e.format;
        if (i === "email") t = t.check(h.email());
        else if (i === "uri" || i === "uri-reference") t = t.check(h.url());
        else if (i === "uuid" || i === "guid") t = t.check(h.uuid());
        else if (i === "date-time") t = t.check(h.iso.datetime());
        else if (i === "date") t = t.check(h.iso.date());
        else if (i === "time") t = t.check(h.iso.time());
        else if (i === "duration") t = t.check(h.iso.duration());
        else if (i === "ipv4") t = t.check(h.ipv4());
        else if (i === "ipv6") t = t.check(h.ipv6());
        else if (i === "mac") t = t.check(h.mac());
        else if (i === "cidr") t = t.check(h.cidrv4());
        else if (i === "cidr-v6") t = t.check(h.cidrv6());
        else if (i === "base64") t = t.check(h.base64());
        else if (i === "base64url") t = t.check(h.base64url());
        else if (i === "e164") t = t.check(h.e164());
        else if (i === "jwt") t = t.check(h.jwt());
        else if (i === "emoji") t = t.check(h.emoji());
        else if (i === "nanoid") t = t.check(h.nanoid());
        else if (i === "cuid") t = t.check(h.cuid());
        else if (i === "cuid2") t = t.check(h.cuid2());
        else if (i === "ulid") t = t.check(h.ulid());
        else if (i === "xid") t = t.check(h.xid());
        else if (i === "ksuid") t = t.check(h.ksuid());
      }
      if (typeof e.minLength === "number") t = t.min(e.minLength);
      if (typeof e.maxLength === "number") t = t.max(e.maxLength);
      if (e.pattern) t = t.regex(new RegExp(e.pattern));
      a = t;
      break;
    }
    case "number":
    case "integer": {
      let t = r === "integer" ? h.number().int() : h.number();
      if (typeof e.minimum === "number") t = t.min(e.minimum);
      if (typeof e.maximum === "number") t = t.max(e.maximum);
      if (typeof e.exclusiveMinimum === "number") t = t.gt(e.exclusiveMinimum);
      else if (e.exclusiveMinimum === true && typeof e.minimum === "number") t = t.gt(e.minimum);
      if (typeof e.exclusiveMaximum === "number") t = t.lt(e.exclusiveMaximum);
      else if (e.exclusiveMaximum === true && typeof e.maximum === "number") t = t.lt(e.maximum);
      if (typeof e.multipleOf === "number") t = t.multipleOf(e.multipleOf);
      a = t;
      break;
    }
    case "boolean": {
      a = h.boolean();
      break;
    }
    case "null": {
      a = h.null();
      break;
    }
    case "object": {
      let t = {}, i = e.properties || {}, o = new Set(e.required || []);
      for (let [l, d] of Object.entries(i)) {
        let c = C(d, n);
        t[l] = o.has(l) ? c : c.optional();
      }
      if (e.propertyNames) {
        let l = C(e.propertyNames, n), d = e.additionalProperties && typeof e.additionalProperties === "object" ? C(e.additionalProperties, n) : h.any();
        if (Object.keys(t).length === 0) {
          a = h.record(l, d);
          break;
        }
        let c = h.object(t).passthrough(), p = h.looseRecord(l, d);
        a = h.intersection(c, p);
        break;
      }
      if (e.patternProperties) {
        let l = e.patternProperties, d = Object.keys(l), c = [];
        for (let f of d) {
          let $ = C(l[f], n), x = h.string().regex(new RegExp(f));
          c.push(h.looseRecord(x, $));
        }
        let p = [];
        if (Object.keys(t).length > 0) p.push(h.object(t).passthrough());
        if (p.push(...c), p.length === 0) a = h.object({}).passthrough();
        else if (p.length === 1) a = p[0];
        else {
          let f = h.intersection(p[0], p[1]);
          for (let $ = 2; $ < p.length; $++) f = h.intersection(f, p[$]);
          a = f;
        }
        break;
      }
      let u = h.object(t);
      if (e.additionalProperties === false) a = u.strict();
      else if (typeof e.additionalProperties === "object") a = u.catchall(C(e.additionalProperties, n));
      else a = u.passthrough();
      break;
    }
    case "array": {
      let { prefixItems: t, items: i } = e;
      if (t && Array.isArray(t)) {
        let o = t.map((l) => C(l, n)), u = i && typeof i === "object" && !Array.isArray(i) ? C(i, n) : void 0;
        if (u) a = h.tuple(o).rest(u);
        else a = h.tuple(o);
        if (typeof e.minItems === "number") a = a.check(h.minLength(e.minItems));
        if (typeof e.maxItems === "number") a = a.check(h.maxLength(e.maxItems));
      } else if (Array.isArray(i)) {
        let o = i.map((l) => C(l, n)), u = e.additionalItems && typeof e.additionalItems === "object" ? C(e.additionalItems, n) : void 0;
        if (u) a = h.tuple(o).rest(u);
        else a = h.tuple(o);
        if (typeof e.minItems === "number") a = a.check(h.minLength(e.minItems));
        if (typeof e.maxItems === "number") a = a.check(h.maxLength(e.maxItems));
      } else if (i !== void 0) {
        let o = C(i, n), u = h.array(o);
        if (typeof e.minItems === "number") u = u.min(e.minItems);
        if (typeof e.maxItems === "number") u = u.max(e.maxItems);
        a = u;
      } else a = h.array(h.any());
      break;
    }
    default:
      throw Error(`Unsupported type: ${r}`);
  }
  return a;
}
function C(e, n) {
  if (typeof e === "boolean") return e ? h.any() : h.never();
  let r = qd(e, n), a = e.type || e.enum !== void 0 || e.const !== void 0;
  if (e.anyOf && Array.isArray(e.anyOf)) {
    let u = e.anyOf.map((d) => C(d, n)), l = h.union(u);
    r = a ? h.intersection(r, l) : l;
  }
  if (e.oneOf && Array.isArray(e.oneOf)) {
    let u = e.oneOf.map((d) => C(d, n)), l = h.xor(u);
    r = a ? h.intersection(r, l) : l;
  }
  if (e.allOf && Array.isArray(e.allOf)) if (e.allOf.length === 0) r = a ? r : h.any();
  else {
    let u = a ? r : C(e.allOf[0], n), l = a ? 0 : 1;
    for (let d = l; d < e.allOf.length; d++) u = h.intersection(u, C(e.allOf[d], n));
    r = u;
  }
  if (e.nullable === true && n.version === "openapi-3.0") r = h.nullable(r);
  if (e.readOnly === true) r = h.readonly(r);
  if (e.default !== void 0) r = r.default(e.default);
  let t = {}, i = ["$id", "id", "$comment", "$anchor", "$vocabulary", "$dynamicRef", "$dynamicAnchor"];
  for (let u of i) if (u in e) t[u] = e[u];
  let o = ["contentEncoding", "contentMediaType", "contentSchema"];
  for (let u of o) if (u in e) t[u] = e[u];
  for (let u of Object.keys(e)) if (!Vp.has(u)) t[u] = e[u];
  if (Object.keys(t).length > 0) n.registry.add(r, t);
  if (e.description) r = r.describe(e.description);
  return r;
}
function Hp(e, n) {
  if (typeof e === "boolean") return e ? h.any() : h.never();
  let r;
  try {
    r = JSON.parse(JSON.stringify(e));
  } catch {
    throw Error("fromJSONSchema input is not valid JSON (possibly cyclic); use $defs/$ref for recursive schemas");
  }
  let a = Kp(r, n?.defaultTarget), t = r.$defs || r.definitions || {}, i = { version: a, defs: t, refs: /* @__PURE__ */ new Map(), processing: /* @__PURE__ */ new Set(), rootSchema: r, registry: n?.registry ?? G };
  return C(r, i);
}
var Hd = {};
Q(Hd, { string: () => Xp, number: () => Yp, date: () => tg, boolean: () => Qp, bigint: () => eg });
function Xp(e) {
  return Gs(tt, e);
}
function Yp(e) {
  return Qs(it, e);
}
function Qp(e) {
  return ou(rt, e);
}
function eg(e) {
  return uu(at, e);
}
function tg(e) {
  return yu(cn, e);
}
j(Zs());
var Er = s;
var ng = s.object({ id: s.string(), temperature: s.number().optional(), maxTokens: s.number().optional(), contextWindow: s.number().optional(), inputPrice: s.number().optional(), outputPrice: s.number().optional(), supportsImages: s.boolean().optional() });
var ig = s.object({ models: s.array(ng).optional(), openAiBaseUrl: s.string().optional(), openAiHeaders: s.record(s.string(), s.string()).optional(), azureApiVersion: s.string().optional(), azureIdentity: s.boolean().optional() });
var rg = s.object({ id: s.string(), thinkingBudgetTokens: s.number().optional() });
var ag = s.object({ name: s.string(), baseModelId: s.string(), thinkingBudgetTokens: s.number().optional() });
var og = s.object({ models: s.array(rg).optional(), customModels: s.array(ag).optional(), awsRegion: s.string().optional(), awsUseCrossRegionInference: s.boolean().optional(), awsUseGlobalInference: s.boolean().optional(), awsBedrockUsePromptCache: s.boolean().optional(), awsBedrockEndpoint: s.string().optional() });
var sg = s.object({ id: s.string() });
var ug = s.object({ models: s.array(sg).optional() });
var lg = s.object({ id: s.string(), thinkingBudgetTokens: s.number().optional() });
var dg = s.object({ models: s.array(lg).optional(), vertexProjectId: s.string().optional(), vertexRegion: s.string().optional() });
var cg = s.object({ id: s.string(), thinkingBudgetTokens: s.number().optional(), promptCachingEnabled: s.boolean().optional() });
var mg = s.object({ models: s.array(cg).optional(), baseUrl: s.string().optional() });
var fg = s.object({ id: s.string(), thinkingBudgetTokens: s.number().optional() });
var pg = s.object({ models: s.array(fg).optional(), baseUrl: s.string().optional() });
var gg = s.object({ OpenAiCompatible: ig.optional(), AwsBedrock: og.optional(), Cline: ug.optional(), Vertex: dg.optional(), LiteLLM: mg.optional(), Anthropic: pg.optional() });
var vg = s.object({ id: s.string() });
var hg = s.object({ name: s.string(), url: s.string(), alwaysEnabled: s.boolean().optional(), headers: s.record(s.string(), s.string()).optional() });
var ra = s.object({ alwaysEnabled: s.boolean(), name: s.string(), contents: s.string() });
var yn = s.object({ bucket: s.string(), accessKeyId: s.string(), secretAccessKey: s.string(), region: s.string().optional(), endpoint: s.string().optional(), accountId: s.string().optional() });
var $g = s.object({ enabled: s.boolean().optional(), type: s.union([s.literal("s3_access_keys"), s.literal("r2_access_keys"), s.literal("azure_access_keys")]).optional(), s3AccessSettings: yn.optional(), r2AccessSettings: yn.optional(), azureAccessSettings: yn.optional() });
var yg = s.object({ promptUploading: $g.optional() });
var jv = s.object({ version: s.string(), providerSettings: gg.optional(), telemetryEnabled: s.boolean().optional(), kanbanEnabled: s.boolean().optional(), mcpMarketplaceEnabled: s.boolean().optional(), allowedMCPServers: s.array(vg).optional(), remoteMCPServers: s.array(hg).optional(), blockPersonalRemoteMCPServers: s.boolean().optional(), yoloModeAllowed: s.boolean().optional(), openTelemetryEnabled: s.boolean().optional(), openTelemetryMetricsExporter: s.string().optional(), openTelemetryLogsExporter: s.string().optional(), openTelemetryOtlpProtocol: s.string().optional(), openTelemetryOtlpEndpoint: s.string().optional(), openTelemetryOtlpHeaders: s.record(s.string(), s.string()).optional(), openTelemetryOtlpMetricsProtocol: s.string().optional(), openTelemetryOtlpMetricsEndpoint: s.string().optional(), openTelemetryOtlpMetricsHeaders: s.record(s.string(), s.string()).optional(), openTelemetryOtlpLogsProtocol: s.string().optional(), openTelemetryOtlpLogsEndpoint: s.string().optional(), openTelemetryOtlpLogsHeaders: s.record(s.string(), s.string()).optional(), openTelemetryMetricExportInterval: s.number().optional(), openTelemetryOtlpInsecure: s.boolean().optional(), openTelemetryLogBatchSize: s.number().optional(), openTelemetryLogBatchTimeout: s.number().optional(), openTelemetryLogMaxQueueSize: s.number().optional(), enterpriseTelemetry: yg.optional(), globalRules: s.array(ra).optional(), globalWorkflows: s.array(ra).optional() });
var Cv = s.record(s.string(), s.string());
var Xd = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
var bg = s.enum(Xd);
var _g = bg.exclude(["none"]);
var kg = s.enum([...Xd, "default"]).nullable();
var Ig = s.discriminatedUnion("type", [s.object({ type: s.literal("toggle") }).strict(), s.object({ type: s.literal("effort"), values: s.array(kg) }).strict(), s.object({ type: s.literal("budget_tokens"), min: s.number().min(-1).optional(), max: s.number().min(0).optional() }).strict().refine((e) => e.min === void 0 || e.max === void 0 || e.min <= e.max, { message: "Minimum reasoning budget cannot exceed maximum", path: ["min"] })]);
var wg = s.enum(["default", "openai-responses", "r1"]);
var Sg = s.enum(["images", "video", "tools", "streaming", "prompt-cache", "reasoning", "reasoning-effort", "computer-use", "global-endpoint", "structured_output", "temperature", "files"]);
var xg = s.enum(["active", "preview", "deprecated", "legacy"]);
var Eg = s.object({ input: s.number().optional(), output: s.number().optional(), cacheWrite: s.number().optional(), cacheRead: s.number().optional() });
var Og = s.object({ maxBudget: s.number().optional(), outputPrice: s.number().optional(), thinkingLevel: s.enum(["low", "high"]).optional() });
var Tg = s.object({ reasoningDefaultOn: s.boolean().optional() }).catchall(s.unknown());
var Yd = s.object({ id: s.string(), name: s.string().optional(), description: s.string().optional(), maxTokens: s.number().optional(), contextWindow: s.number().optional(), maxInputTokens: s.number().optional(), capabilities: s.array(Sg).optional(), reasoningOptions: s.array(Ig).optional(), apiFormat: wg.optional(), systemRole: s.enum(["system", "developer"]).optional(), temperature: s.number().optional(), pricing: Eg.optional(), thinkingConfig: Og.optional(), status: xg.optional(), deprecationNotice: s.string().optional(), replacedBy: s.string().optional(), releaseDate: s.string().optional(), deprecationDate: s.string().optional(), family: s.string().optional(), metadata: Tg.optional() });
var Ng = s.object({ id: s.string(), name: s.string(), input: s.unknown(), output: s.unknown(), error: s.string().optional(), durationMs: s.number(), startedAt: s.date(), endedAt: s.date() });
var zg = s.enum(["completed", "max_iterations", "aborted", "mistake_limit", "error"]);
var Ug = s.object({ inputTokens: s.number(), outputTokens: s.number(), cacheReadTokens: s.number().optional(), cacheWriteTokens: s.number().optional(), totalCost: s.number().optional() });
var Rv = s.object({ text: s.string(), usage: Ug, messages: s.array(s.custom()), toolCalls: s.array(Ng), iterations: s.number(), finishReason: zg, model: s.object({ id: s.string(), provider: s.string(), info: Yd.optional() }), startedAt: s.date(), endedAt: s.date(), durationMs: s.number() });
var Zv = s.object({ sessionId: s.string().optional(), providerId: s.string(), modelId: s.string(), apiKey: s.string().optional(), baseUrl: s.string().url().optional(), headers: s.record(s.string(), s.string()).optional(), knownModels: s.record(s.string(), Yd).optional(), providerConfig: s.unknown().optional(), initialMessages: s.array(s.custom()).optional(), systemPrompt: s.string(), tools: s.array(s.custom()), maxIterations: s.number().positive().optional(), maxParallelToolCalls: s.number().int().positive().default(8), maxTokensPerTurn: s.number().positive().optional(), temperature: s.number().nonnegative().optional(), apiTimeoutMs: s.number().positive().default(18e4), userFileContentLoader: s.function().input([s.string()]).output(s.promise(s.string())).optional(), toolContextMetadata: s.record(s.string(), s.unknown()).optional(), execution: s.object({ maxConsecutiveMistakes: s.number().int().positive().optional(), reminderAfterIterations: s.number().nonnegative().optional(), reminderText: s.string().optional(), loopDetection: s.union([s.literal(false), s.object({ softThreshold: s.number().int().positive().optional(), hardThreshold: s.number().int().positive().optional() })]).optional() }).optional(), reasoningEffort: _g.optional(), thinkingBudgetTokens: s.number().positive().optional(), thinking: s.boolean().optional(), onEvent: s.function().input([s.custom()]).output(s.void()).optional(), hooks: s.custom().optional(), parentAgentId: s.string().optional(), extensions: s.array(s.custom()).optional(), hookErrorMode: s.enum(["ignore", "throw"]).default("ignore"), toolPolicies: s.record(s.string(), s.object({ enabled: s.boolean().optional(), autoApprove: s.boolean().optional() })).optional(), requestToolApproval: s.function().input([s.object({ sessionId: s.string(), agentId: s.string(), conversationId: s.string(), iteration: s.number(), toolCallId: s.string(), toolName: s.string(), input: s.unknown(), policy: s.object({ enabled: s.boolean().optional(), autoApprove: s.boolean().optional() }).default({}) })]).output(s.union([s.object({ approved: s.boolean(), reason: s.string().optional() }), s.promise(s.object({ approved: s.boolean(), reason: s.string().optional() }))])).optional(), onConsecutiveMistakeLimitReached: s.function().input([s.object({ iteration: s.number().int().positive(), consecutiveMistakes: s.number().int().positive(), maxConsecutiveMistakes: s.number().int().positive(), reason: s.enum(["api_error", "invalid_tool_call", "tool_execution_failed"]), details: s.string().optional() })]).output(s.union([s.object({ action: s.literal("continue"), guidance: s.string().optional() }), s.object({ action: s.literal("stop"), reason: s.string().optional() }), s.promise(s.union([s.object({ action: s.literal("continue"), guidance: s.string().optional() }), s.object({ action: s.literal("stop"), reason: s.string().optional() })]))])).optional(), logger: s.custom().optional(), extensionContext: s.custom().optional(), abortSignal: s.custom().optional() });
var Ag = s.enum(["connector.started", "connector.stopping", "session.authorize", "message.received", "message.denied", "message.completed", "message.failed", "session.started", "session.reused", "session.reset", "schedule.delivery.started", "schedule.delivery.sent", "schedule.delivery.failed"]);
var Dg = s.object({ id: s.string().optional(), label: s.string().optional(), role: s.string().optional(), participantKey: s.string().optional(), participantLabel: s.string().optional(), platformUserId: s.string().optional(), metadata: s.record(s.string(), s.unknown()).optional() });
var Pg = s.object({ source: s.string(), sourceEvent: s.string(), threadId: s.string(), channelId: s.string(), isDM: s.boolean(), sessionId: s.string().optional(), workspaceRoot: s.string().optional(), metadata: s.record(s.string(), s.unknown()).optional() });
var Lv = s.object({ actor: Dg, context: Pg, payload: s.record(s.string(), s.unknown()).optional() });
var Mv = s.object({ action: s.enum(["allow", "deny"]).default("allow"), message: s.string().optional(), reason: s.string().optional(), metadata: s.record(s.string(), s.unknown()).optional() });
var Bv = s.object({ adapter: s.string(), botUserName: s.string().optional(), event: Ag, payload: s.record(s.string(), s.unknown()), ts: s.string() });
var jg = ["hooks", "tools", "commands", "rules", "skills", "messageBuilders", "providers", "automationEvents", "mcp"];
var Fv = new Set(jg);
var Qd = { CLINE_PASS: "ext-cline-pass" };
var Jv = { [Qd.CLINE_PASS]: false };
var Gv = Object.values(Qd);
var Cg = s.enum(["agent_start", "agent_resume", "agent_abort", "agent_end", "agent_error", "tool_call", "tool_result", "prompt_submit", "pre_compact", "session_shutdown"]);
var fe = s.record(s.string(), s.string());
var Rg = s.object({ toolName: s.string(), parameters: fe });
var Zg = s.object({ toolName: s.string(), parameters: fe, result: s.string(), success: s.boolean(), executionTimeMs: s.number() });
var Lg = s.object({ prompt: s.string(), attachments: s.array(s.string()) });
var Mg = s.object({ taskMetadata: fe });
var Bg = s.object({ taskMetadata: fe, previousState: fe });
var Fg = s.object({ taskMetadata: fe });
var Jg = s.object({ taskMetadata: fe });
var Gg = s.object({ taskId: s.string(), ulid: s.string(), contextSize: s.number(), compactionStrategy: s.string(), previousApiReqIndex: s.number(), tokensIn: s.number(), tokensOut: s.number(), tokensInCache: s.number(), tokensOutCache: s.number(), deletedRangeStart: s.number(), deletedRangeEnd: s.number(), contextJsonPath: s.string(), contextRawPath: s.string() });
var Wv = s.object({ clineVersion: s.string(), hookName: Cg, timestamp: s.string(), taskId: s.string(), sessionContext: s.object({ rootSessionId: s.string().optional(), hookLogPath: s.string().optional() }).optional(), workspaceRoots: s.array(s.string()), workspaceInfo: s.custom().optional(), userId: s.string(), agent_id: s.string(), parent_agent_id: s.string().nullable(), iteration: s.number().optional(), reason: s.string().optional(), tool_call: s.object({ id: s.string(), name: s.string(), input: s.unknown() }).optional(), tool_result: s.custom().optional(), turn: s.unknown().optional(), error: s.object({ name: s.string(), message: s.string(), stack: s.string().optional() }).optional(), preToolUse: Rg.optional(), postToolUse: Zg.optional(), userPromptSubmit: Lg.optional(), taskStart: Mg.optional(), taskResume: Bg.optional(), taskCancel: Fg.optional(), taskComplete: Jg.optional(), preCompact: Gg.optional() }).passthrough();
var Wg = ["readFile", "search", "bash", "webFetch", "editor", "applyPatch", "skills", "askQuestion", "submit"];
var Vv = new Set(Wg);
function aa(e) {
  return typeof e === "object" && e !== null && !Array.isArray(e);
}
function Or(e, n) {
  if (!e && !n) return;
  let r = e?.metadata, a = n?.metadata, t = { ...e ?? {}, ...n ?? {} };
  if (aa(r) && aa(a)) t.metadata = { ...r, ...a };
  return t;
}
function ec(e) {
  return Math.max(1, Math.ceil(e / 3));
}
function ye(e) {
  return typeof e === "object" && e !== null && !Array.isArray(e);
}
function Vg(e) {
  let n = e.type;
  if (typeof n === "string") return [n];
  return Array.isArray(n) ? n.filter((r) => typeof r === "string") : [];
}
function En(e, n) {
  if (Vg(e).includes(n)) return true;
  for (let r of ["anyOf", "oneOf", "allOf"]) {
    let a = e[r];
    if (Array.isArray(a) && a.some((t) => ye(t) && En(t, n))) return true;
  }
  return false;
}
function Kg(e, n) {
  if (typeof e !== "string") return e;
  let r = e.trim(), a = En(n, "array"), t = En(n, "object");
  if ((!a || !r.startsWith("[")) && (!t || !r.startsWith("{"))) return e;
  try {
    let i = JSON.parse(r);
    if (Array.isArray(i)) return a ? i : e;
    if (ye(i)) return t ? i : e;
    return e;
  } catch {
    return e;
  }
}
function Et(e, n) {
  let r = Kg(e, n);
  if (Array.isArray(r)) {
    let o = n.items;
    if (!ye(o)) return r;
    let u = false, l = r.map((d) => {
      let c = Et(d, o);
      return u ||= c !== d, c;
    });
    return u ? l : r;
  }
  if (!ye(r)) return r;
  let a = n.properties;
  if (!ye(a)) return r;
  let t = false, i = { ...r };
  for (let [o, u] of Object.entries(a)) {
    if (!(o in r) || !ye(u)) continue;
    let l = Et(r[o], u);
    if (l !== r[o]) i[o] = l, t = true;
  }
  return t ? i : r;
}
function tc(e) {
  return Object.fromEntries(Object.entries(e).filter(([, n]) => n !== void 0));
}
function q(e) {
  let n = e?.trim();
  return n ? n : void 0;
}
function qg(e) {
  return s.toJSONSchema(e);
}
var nc = `# Plan Mode

You are in Plan mode. Your role is to explore, analyze, and plan -- not to execute.

- Read files, search the codebase, and gather context to understand the problem
- Ask clarifying questions when requirements are ambiguous
- Present your plan as a structured outline with clear steps
- Explain tradeoffs between different approaches when they exist
- Do NOT edit files, write code, run destructive commands, or make any changes
- Do NOT implement anything -- focus on understanding and alignment first

The run_commands tool remains available in plan mode strictly for read-only inspection -- listing files, searching (grep), reading configs, inspecting git history and diffs, checking tool versions, and the like. Never use it to change anything: no creating, modifying, or deleting files, no writing scripts that make changes, and no state-changing commands (installs, migrations, database or schema changes, container commands that mutate state, etc.). File-editing commands (rm/mv/cp, in-place edits like sed -i, output redirection to files outside /tmp, git commands that change the working tree, package installs) are hard-blocked in plan mode: they are not executed and return a tool error instead, so do not attempt them. If the task requires a mutation, put it in the plan; it happens only after the user switches to act mode.`;
var Kv = `${nc}

Once the user has reviewed your plan and explicitly approved it in a follow-up message, use the switch_to_act_mode tool to switch to act mode and begin implementation. Calling switch_to_act_mode immediately starts execution, so never call it in the same turn you present a plan and never treat the original task request as approval -- end your turn after presenting the plan and wait for the user's response.`;
var qv = `${nc}

Once you have presented your plan, end your turn and wait for the user's response. You do NOT have the ability to switch to act mode yourself -- the user must do it manually with the Plan/Act toggle once they are satisfied with the plan. If the task requires tools that are only available in act mode, ask the user to "toggle to Act mode" (use those words).`;
var Hv = Er.enum(["reasoning", "prompt-cache", "tools", "provider-tools", "oauth", "temperature", "files", "streaming", "vision", "computer-use", "local-auth", "popular"]);
var Xv = Er.enum(["anthropic", "gemini", "openai-chat", "openai-responses", "openai-r1", "ai-sdk"]);
var Yv = Er.enum(["anthropic", "ai-sdk", "ai-sdk-community", "openai", "openai-compatible", "openai-r1", "gemini", "bedrock", "custom", "fetch", "vertex"]);
var ic = "task.provider_request_started";
var rc = "task.provider_stream_started";
var ac = "task.first_chunk_received";
var oc = "task.provider_stream_failed";
var sc = "task.cancelled";
var $e = /* @__PURE__ */ new Map();
function Hg(e, n) {
  let r = typeof n.error_message === "string" ? n.error_message : "";
  return [e, n.component, n.operation, n.error_type, n.error_code ?? "", n.error_status ?? "", r.replace(/\d+/g, "#").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 256)].join("\0");
}
function Xg(e) {
  let n = Date.now(), r = $e.get(e);
  if (r && n - r.startMs < 36e5) {
    if (r.emitted < 5) return r.emitted += 1, { emit: true, suppressed: 0 };
    return r.suppressed += 1, { emit: false, suppressed: r.suppressed };
  }
  let a = r?.suppressed ?? 0;
  if ($e.delete(e), $e.size >= 512) {
    let t = $e.keys().next();
    if (!t.done) $e.delete(t.value);
  }
  return $e.set(e, { startMs: n, emitted: 1, suppressed: 0 }), { emit: true, suppressed: a };
}
function uc(e, n) {
  e?.capture({ event: "agent.reasoning.unexpected_tokens", properties: Tr({ sessionId: n.sessionId, agentId: n.agentId, runId: n.runId, iteration: n.iteration, providerId: n.providerId, modelId: n.modelId, requestedThinking: n.requestedThinking, reasoningTokenCount: n.reasoningTokenCount }) });
}
function lc(e, n) {
  if (!e) return;
  e.capture({ event: n.event, properties: Tr({ sessionId: n.sessionId, ulid: n.ulid ?? n.sessionId, agentId: n.agentId, conversationId: n.conversationId, runId: n.runId, iteration: n.iteration, provider: n.providerId, providerId: n.providerId, model: n.modelId, modelId: n.modelId, phase: n.phase, durationMs: n.durationMs, eventType: n.eventType, ...n.error === void 0 ? {} : cc(n.error, n.messageLimit), error_class: n.errorClass }) });
}
function dc(e, n) {
  if (!e) return false;
  let r = n.event ?? "sdk.error", a = Yg(n), t = 0;
  try {
    let i = Xg(Hg(r, a));
    if (!i.emit) return true;
    t = i.suppressed;
  } catch {
  }
  return e.capture({ event: r, properties: t > 0 ? { ...a, suppressed_count: t } : a }), true;
}
function Yg(e) {
  return Tr({ ...e.context ?? {}, component: e.component, operation: e.operation, severity: e.severity ?? "error", handled: e.handled ?? true, ...cc(e.error, e.messageLimit, e.errorMessage) });
}
function Tr(e) {
  let n = {};
  for (let [r, a] of Object.entries(e)) if (a !== void 0) n[r] = a;
  return n;
}
function cc(e, n = 500, r) {
  let a = tv(e) ? e : void 0, t = e instanceof Error ? e : void 0, i = Ae(r) ?? Ae(t?.message) ?? Ae(a?.message) ?? nv(e) ?? "Unknown error", o = iv(a?.code), u = bn(a?.status) ?? bn(a?.statusCode) ?? bn(a?.responseStatus);
  return { error_type: t?.name?.trim() || Ae(a?.name) || t?.constructor?.name || "Error", error_message: ev(Qg(i), n), ...o !== void 0 ? { error_code: o } : {}, ...u !== void 0 ? { error_status: u } : {} };
}
function Qg(e) {
  return e.replace(/(authorization=Bearer\s+)[^&\s]+/gi, "$1[redacted]").replace(/(api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|password|secret)=([^&\s]+)/gi, "$1=[redacted]").replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1[redacted]").replace(/\/Users\/[^/\s]+/g, "/Users/[redacted]").replace(/\/home\/[^/\s]+/g, "/home/[redacted]").replace(/([A-Za-z]:[\\/]+Users[\\/]+)[^\\/\s]+/g, "$1[redacted]");
}
function ev(e, n) {
  let r = Math.max(1, Math.floor(n));
  return e.length > r ? e.substring(0, r) : e;
}
function tv(e) {
  return typeof e === "object" && e !== null;
}
function Ae(e) {
  return typeof e === "string" && e.trim().length > 0 ? e : void 0;
}
function nv(e) {
  if (e instanceof Error) return;
  let n = typeof e === "string" ? e : String(e);
  return n === "[object Object]" ? void 0 : Ae(n);
}
function iv(e) {
  if (typeof e === "string" && e.trim().length > 0) return e;
  if (typeof e === "number" && Number.isFinite(e)) return e;
  return;
}
function bn(e) {
  return typeof e === "number" && Number.isFinite(e) ? e : void 0;
}
var rv = ["rules", "skills", "workflows", "plugins"];
var Qv = new Set(rv);
var av = s.object({ rootPath: s.string().min(1), hint: s.string().min(1).optional(), associatedRemoteUrls: s.array(s.string().min(1)).optional(), latestGitCommitHash: s.string().min(1).optional(), latestGitBranchName: s.string().min(1).optional() });
var eh = s.object({ currentWorkspacePath: s.string().min(1).optional(), workspaces: s.record(s.string().min(1), av) });
var ov = ["current_state", "boundary_analysis", "interface_proposal"];
var K = s.preprocess((e) => e instanceof Date ? e.toISOString() : e, s.string().datetime());
var be = s.enum(["pending", "in_progress", "blocked", "completed"]);
var mc = s.enum(["queued", "running", "completed", "failed", "cancelled", "interrupted"]);
var hn = s.enum(["draft", "in_review", "finalized"]);
var sv = s.object({ agentId: s.string(), role: s.enum(["lead", "teammate"]), description: s.string().optional(), status: s.enum(["idle", "running", "stopped"]) });
var th = s.object({ agentId: s.string(), rolePrompt: s.string(), modelId: s.string().optional(), maxIterations: s.number().optional() });
function A(e) {
  return s.preprocess((n) => n === null ? void 0 : n, e.optional());
}
var nh = s.object({ agentId: s.string().min(1).describe("Teammate identifier"), rolePrompt: s.string().min(1).describe("System prompt describing teammate role") }).strict();
var ih = s.object({ agentId: s.string().min(1).describe("Teammate identifier"), reason: A(s.string().min(1)).describe("Optional shutdown reason") });
var rh = s.object({});
var uv = { create: ["title", "description"], list: [], claim: ["taskId"], complete: ["taskId", "summary"], block: ["taskId", "reason"] };
var ah = s.object({ action: s.enum(["create", "list", "claim", "complete", "block"]), title: A(s.string().min(1)).describe("Task title"), description: A(s.string().min(1)).describe("Task details"), dependsOn: A(s.array(s.string().describe("Dependency task ID"))).describe("Array of dependency task IDs"), assignee: A(s.string().min(1)).describe("Optional assignee"), status: A(s.enum(["pending", "in_progress", "blocked", "completed"])).describe("Optional task status filter"), taskId: A(s.string()).describe("Task ID"), summary: A(s.string().min(1)).describe("Completion summary"), reason: A(s.string().min(1)).describe("Blocking reason") }).superRefine((e, n) => {
  for (let r of uv[e.action]) {
    if (e[r] !== void 0) continue;
    n.addIssue({ code: "custom", path: [r], message: `Field "${r}" is required when action=${e.action}` });
  }
});
var oh = s.object({ agentId: s.string().describe("Teammate agent ID"), task: s.string().min(1).describe("Task instructions for the teammate"), taskId: A(s.string()).describe("Optional shared task list ID"), runMode: A(s.enum(["sync", "async"])).describe("Execution mode: 'sync' blocks until the teammate finishes and returns the result (default if omitted); 'async' queues the run and returns a runId immediately \u2014 use team_await_runs to collect results later."), continueConversation: A(s.boolean()).describe("If true, continue the teammate conversation; otherwise start fresh") });
var sh = s.object({ status: A(s.enum(["queued", "running", "completed", "failed", "cancelled", "interrupted"])).describe("Optional run status filter. Omit to include all statuses."), agentId: A(s.string().min(1)).describe("Optional teammate ID filter. Omit to include all teammates."), includeCompleted: A(s.boolean()).describe("Include completed/failed runs (default true)") });
var uh = s.object({ runId: s.string().min(1).describe("Run ID"), reason: A(s.string().min(1)).describe("Optional cancellation reason") });
var lh = s.object({ runId: A(s.string().min(1)).describe("Optional async run ID to await. Omit to wait for all active async runs.") }).strict();
var dh = s.object({ toAgentId: s.string().min(1).describe("Recipient agent ID"), subject: s.string().min(1).describe("Message subject"), body: s.string().min(1).describe("Message body"), taskId: A(s.string().min(1)).describe("Optional task ID context") });
var ch = s.object({ subject: s.string().min(1).describe("Message subject"), body: s.string().min(1).describe("Message body"), taskId: A(s.string().min(1)).describe("Optional task ID context") });
var mh = s.object({ unreadOnly: A(s.boolean()).describe("Only unread messages for read action (default true)") });
var fh = s.object({ kind: s.enum(["progress", "handoff", "blocked", "decision", "done", "error"]), summary: s.string().min(1).describe("Update summary"), taskId: A(s.string().min(1)).describe("Optional task ID context"), evidence: A(s.array(s.string().min(1))).describe("Optional evidence links/snippets"), nextAction: A(s.string().min(1)).describe("Planned next step") });
var ph = s.object({});
var gh = s.object({ title: s.string().describe("Outcome title"), requiredSections: s.array(s.string()).default(ov).describe("Required sections for finalization gate (defaults to current_state,boundary_analysis,interface_proposal)") });
var vh = s.object({ outcomeId: s.string().describe("Outcome ID"), section: s.string().describe("Section name"), sourceRunId: A(s.string()).describe("Optional source run ID"), content: s.string().describe("Section fragment content") });
var hh = s.object({ fragmentId: s.string().describe("Fragment ID"), approved: s.boolean().describe("Review decision") });
var $h = s.object({ outcomeId: s.string().describe("Outcome ID") });
var yh = s.object({});
var bh = s.object({ teamId: s.string(), teamName: s.string(), members: s.array(sv), taskCounts: s.record(be, s.number()), unreadMessages: s.number(), missionLogEntries: s.number(), activeRuns: s.number(), queuedRuns: s.number(), outcomeCounts: s.record(hn, s.number()) });
var lv = s.object({ id: s.string(), title: s.string(), description: s.string(), status: be, createdAt: K, updatedAt: K, createdBy: s.string(), assignee: s.string().optional(), dependsOn: s.array(s.string()), summary: s.string().optional(), isReady: s.boolean(), blockedBy: s.array(s.string()) });
var _h = s.discriminatedUnion("action", [s.object({ action: s.literal("create"), taskId: s.string(), status: be, ignoredFields: s.array(s.string()).optional(), note: s.string().optional() }), s.object({ action: s.literal("list"), tasks: s.array(lv) }), s.object({ action: s.literal("claim"), taskId: s.string(), status: be, nextStep: s.string() }), s.object({ action: s.literal("complete"), taskId: s.string(), status: be }), s.object({ action: s.literal("block"), taskId: s.string(), status: be })]);
var kh = s.object({ agentId: s.string(), mode: s.enum(["sync", "async"]), status: s.enum(["dispatched", "running", "queued", "joined"]), dispatched: s.boolean(), message: s.string(), deduped: s.boolean().optional(), runId: s.string().optional(), text: s.string().optional(), iterations: s.number().optional() });
var dv = s.object({ textPreview: s.string(), iterations: s.number(), finishReason: s.string(), durationMs: s.number(), usage: s.object({ inputTokens: s.number(), outputTokens: s.number(), cacheReadTokens: s.number().optional(), cacheWriteTokens: s.number().optional(), totalCost: s.number().optional() }) });
var Ih = s.object({ id: s.string(), agentId: s.string(), taskId: s.string().optional(), status: mc, messagePreview: s.string(), priority: s.number(), retryCount: s.number(), maxRetries: s.number(), nextAttemptAt: K.optional(), continueConversation: s.boolean().optional(), startedAt: K, endedAt: K.optional(), leaseOwner: s.string().optional(), heartbeatAt: K.optional(), lastProgressAt: K.optional(), lastProgressMessage: s.string().optional(), currentActivity: s.string().optional(), error: s.string().optional(), resultSummary: dv.optional() });
var wh = s.object({ id: s.string(), teamId: s.string(), fromAgentId: s.string(), toAgentId: s.string(), subject: s.string(), body: s.string(), taskId: s.string().optional(), sentAt: K, readAt: K.optional() });
var Sh = s.object({ id: s.string(), teamId: s.string(), title: s.string(), status: hn, requiredSections: s.array(s.string()), createdBy: s.string(), createdAt: K, finalizedAt: K.optional() });
var xh = s.object({ outcomeId: s.string(), status: hn, requiredSections: s.array(s.string()) });
var Eh = s.object({ agentId: s.string(), status: s.string() });
var Oh = s.object({ runId: s.string(), status: mc });
var Th = s.object({ id: s.string(), toAgentId: s.string() });
var Nh = s.object({ delivered: s.number() });
var zh = s.object({ id: s.string() });
var Uh = s.object({ status: s.string() });
var Ah = s.object({ fragmentId: s.string(), status: s.string() });
var Dh = s.object({ outcomeId: s.string(), status: hn });
var cv;
((e) => {
  e.TaskStart = "task_start", e.TaskEnd = "task_end", e.AgentEvent = "agent_event", e.TeammateSpawned = "teammate_spawned", e.TeammateShutdown = "teammate_shutdown", e.TeamTaskUpdated = "team_task_updated", e.TeamMessage = "team_message", e.TeamMissionLog = "team_mission_log", e.TeamTaskCompleted = "team_task_completed", e.RunStarted = "run_started", e.RunQueued = "run_queued", e.RunProgress = "run_progress", e.RunCompleted = "run_completed", e.RunFailed = "run_failed", e.RunCancelled = "run_cancelled", e.RunInterrupted = "run_interrupted", e.OutcomeCreated = "outcome_created", e.OutcomeFragmentAttached = "outcome_fragment_attached", e.OutcomeFragmentReviewed = "outcome_fragment_reviewed", e.OutcomeFinalized = "outcome_finalized";
})(cv ||= {});
function mv(e) {
  let { $schema: n, ...r } = e;
  if (typeof r.type === "string") return r;
  if ("properties" in r || "required" in r || "additionalProperties" in r) return { type: "object", ...r };
  for (let a of ["oneOf", "anyOf", "allOf"]) {
    let t = r[a];
    if (!Array.isArray(t) || t.length === 0) continue;
    if (a === "allOf") {
      if (t.some((i) => i && typeof i === "object" && i.type === "object")) return { type: "object", ...r };
      throw Error('Tool inputSchema must describe an object at the top level, but the schema has a top-level "allOf" with no branch that asserts type: "object". Add type: "object" to at least one allOf branch to make the object constraint explicit.');
    }
    if (t.every((i) => i && typeof i === "object" && i.type === "object")) return { type: "object", ...r };
    throw Error(`Tool inputSchema must describe an object at the top level, but the schema has a top-level "${a}" whose branches include non-object types. Pass the strict object schema as inputSchema and reserve union/coercion schemas for use inside execute().`);
  }
  return r;
}
function fv(e) {
  let n = mv(e.inputSchema instanceof s.ZodType ? qg(e.inputSchema) : e.inputSchema);
  return { name: e.name, description: e.description, inputSchema: n, lifecycle: e.lifecycle, timeoutMs: e.timeoutMs ?? 3e4, retryable: e.retryable ?? true, maxRetries: e.maxRetries ?? 3, execute: e.execute };
}
var vv = "Model reached the maximum output token limit before completing the turn";
var hv = "The request exceeds the model's context window and there is no conversation history to compact \u2014 the system prompt, tools, and current input alone are too large. Reduce attached content or switch to a model with a larger context window.";
var $v = "The conversation still exceeds the model's context window after compacting it. Start a new session or switch to a model with a larger context window.";
var yv = "The conversation exceeds the model's context window. Compact the conversation, start a new session, or switch to a model with a larger context window.";
var mt = class extends Error {
  constructor(e, n) {
    super(n?.trim() ? `${e} (provider reported: ${n.trim()})` : e);
    this.name = "ContextWindowOverflowError";
  }
};
function ve(e, n = 8) {
  return `${e}_${nanoid(n)}`;
}
function bv(e) {
  return e.model !== void 0;
}
function _v(e) {
  if (bv(e)) return e;
  let { providerId: n, modelId: r, apiKey: a, baseUrl: t, headers: i, options: o, ...u } = e, d = createGateway({ providerConfigs: [{ providerId: n, apiKey: a, baseUrl: t, headers: i, options: o }], telemetry: u.telemetry }).createAgentModel({ providerId: n, modelId: r }), c = u.messageModelInfo ?? { id: r, provider: n };
  return { ...u, model: d, messageModelInfo: c };
}
function kv(e, n) {
  return { ...n?.["*"] ?? {}, ...n?.[e] ?? {} };
}
function zr(e) {
  try {
    return JSON.stringify(e).length;
  } catch {
    return String(e).length;
  }
}
function Iv(e) {
  if (typeof e === "string") return e.length;
  return zr(e);
}
function wv(e) {
  let n = e.systemPrompt?.length ?? 0, r = 0, a = 0, t = 0;
  for (let i of e.messages) for (let o of i.content) switch (o.type) {
    case "text":
      n += o.text.length;
      break;
    case "reasoning":
      n += o.text.length;
      break;
    case "file":
      n += o.content.length;
      break;
    case "tool-call":
      n += zr(o.input);
      break;
    case "tool-result": {
      let u = Iv(o.output);
      r += 1, a += u, t = Math.max(t, u), n += u;
      break;
    }
  }
  return { messageCount: e.messages.length, toolSchemaCount: e.tools.length, systemPromptChars: e.systemPrompt?.length ?? 0, requestJsonChars: zr({ systemPrompt: e.systemPrompt, messages: e.messages, tools: e.tools, options: e.options }), visibleTextChars: n, estimatedTextTokens: ec(n), toolResultCount: r, toolResultChars: a, maxToolResultChars: t };
}
var Ur = class extends Error {
  reason;
  constructor(e) {
    super(e ?? "Run stopped by runtime control");
    this.name = "ControlledStopError", this.reason = e;
  }
};
var pt = class extends Error {
  reason;
  constructor(e) {
    let n = typeof e === "string" ? e : e instanceof Error ? e.message : e === void 0 ? "Run aborted" : String(e);
    super(n);
    this.name = "AgentRuntimeAbortError", this.reason = e;
  }
};
var Nr = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
function ft(e, n, r) {
  return { id: ve("msg"), role: e, content: n, createdAt: Date.now(), metadata: r };
}
function ue(e) {
  return { ...e };
}
function F(e) {
  return e.map((n) => ({ ...n, content: n.content.map((r) => ({ ...r })), metadata: n.metadata ? { ...n.metadata } : void 0, modelInfo: n.modelInfo ? { ...n.modelInfo } : void 0, metrics: n.metrics ? { ...n.metrics } : void 0 }));
}
function Sv(e, n) {
  let r = Math.max(0, (n.inputTokens ?? 0) - (e.inputTokens ?? 0)), a = Math.max(0, (n.outputTokens ?? 0) - (e.outputTokens ?? 0)), t = Math.max(0, (n.cacheReadTokens ?? 0) - (e.cacheReadTokens ?? 0)), i = Math.max(0, (n.cacheWriteTokens ?? 0) - (e.cacheWriteTokens ?? 0)), o = Math.max(0, (n.reasoningTokenCount ?? 0) - (e.reasoningTokenCount ?? 0)), u = e.totalCost ?? 0, l = n.totalCost ?? 0, d = Math.max(0, l - u);
  if (r === 0 && a === 0 && t === 0 && i === 0 && o === 0 && d === 0) return;
  return { inputTokens: r > 0 ? r : 0, outputTokens: a > 0 ? a : 0, cacheReadTokens: t > 0 ? t : 0, cacheWriteTokens: i > 0 ? i : 0, ...o > 0 ? { reasoningTokenCount: o } : {}, ...d > 0 ? { cost: d } : {} };
}
function xv(e) {
  return e.options?.thinking === false;
}
function pc(e) {
  if (!e) return "";
  return e.content.filter((n) => n.type === "text").map((n) => n.text).join("");
}
function Ev(e) {
  let n = e?.content.find((r) => r.type === "tool-result");
  if (!n || n.isError) return "";
  if (typeof n.output === "string") return n.output;
  try {
    return JSON.stringify(n.output);
  } catch {
    return String(n.output);
  }
}
function Ov(e) {
  if (typeof e === "string") return [ft("user", [{ type: "text", text: e }])];
  if (Array.isArray(e)) return F(e);
  return F([e]);
}
var gt = class {
  config;
  listeners = /* @__PURE__ */ new Set();
  tools = /* @__PURE__ */ new Map();
  hooks = { beforeRun: [], afterRun: [], beforeModel: [], afterModel: [], beforeTool: [], afterTool: [], onEvent: [] };
  state = { agentId: "", agentRole: void 0, parentAgentId: void 0, runId: void 0, status: "idle", iteration: 0, messages: [], pendingToolCalls: [], usage: ue(Nr), lastError: void 0, lastErrorClass: void 0, lastErrorReported: false };
  overflowRecoveryAttempted = false;
  initialization;
  abortController;
  telemetryProviderId;
  telemetryModelId;
  constructor(e) {
    this.telemetryProviderId = q(e.messageModelInfo?.provider) ?? ("providerId" in e ? q(e.providerId) : void 0), this.telemetryModelId = q(e.messageModelInfo?.id) ?? ("modelId" in e ? q(e.modelId) : void 0);
    let n = _v(e);
    this.config = { ...n, toolExecution: n.toolExecution ?? "sequential" }, this.state.agentId = n.agentId ?? ve("agent"), this.state.agentRole = n.agentRole, this.state.parentAgentId = n.parentAgentId, this.state.messages = F(n.initialMessages ?? []);
  }
  async run(e) {
    return this.execute(e);
  }
  async continue(e) {
    return this.execute(e);
  }
  abort(e) {
    if (!this.abortController) return;
    if (this.abortController.signal.aborted) return;
    let n = e instanceof pt ? e : new pt(e);
    this.state.lastError = n.message, this.captureTaskLifecycle(sc, { error: n }), this.abortController.abort(n);
  }
  subscribe(e) {
    return this.listeners.add(e), () => {
      this.listeners.delete(e);
    };
  }
  restore(e) {
    this.abort("Agent state restored"), this.state.runId = void 0, this.state.status = "idle", this.state.iteration = 0, this.state.pendingToolCalls = [], this.state.usage = ue(Nr), this.state.lastError = void 0, this.state.lastErrorClass = void 0, this.state.lastErrorReported = false, this.state.messages = F(e), this.config = { ...this.config, initialMessages: F(e) };
  }
  snapshot() {
    return { agentId: this.state.agentId, agentRole: this.state.agentRole, parentAgentId: this.state.parentAgentId, conversationId: this.config.conversationId?.trim() || void 0, runId: this.state.runId, status: this.state.status, iteration: this.state.iteration, messages: F(this.state.messages), pendingToolCalls: [...this.state.pendingToolCalls], usage: ue(this.state.usage), lastError: this.state.lastError, lastErrorClass: this.state.lastErrorClass };
  }
  async ensureInitialized() {
    this.initialization ??= this.initialize(), await this.initialization;
  }
  async initialize() {
    this.registerHooks(this.config.hooks);
    for (let e of this.config.tools ?? []) this.tools.set(e.name, e);
    for (let e of this.config.plugins ?? []) {
      let n = await e.setup?.({ agentId: this.state.agentId, agentRole: this.state.agentRole, systemPrompt: this.config.systemPrompt });
      for (let r of n?.tools ?? []) this.tools.set(r.name, r);
      this.registerHooks(n?.hooks);
    }
  }
  registerHooks(e) {
    if (!e) return;
    if (e.beforeRun) this.hooks.beforeRun.push(e.beforeRun);
    if (e.afterRun) this.hooks.afterRun.push(e.afterRun);
    if (e.beforeModel) this.hooks.beforeModel.push(e.beforeModel);
    if (e.afterModel) this.hooks.afterModel.push(e.afterModel);
    if (e.beforeTool) this.hooks.beforeTool.push(e.beforeTool);
    if (e.afterTool) this.hooks.afterTool.push(e.afterTool);
    if (e.onEvent) this.hooks.onEvent.push(e.onEvent);
  }
  getRequiredCompletionToolNames() {
    if (this.config.completionPolicy?.requireCompletionTool !== true) return [];
    return [...this.tools.values()].filter((e) => e.lifecycle?.completesRun === true).map((e) => e.name).sort();
  }
  getCompletionToolReminderMessage() {
    let e = this.getRequiredCompletionToolNames();
    if (e.length === 0) return;
    return `[SYSTEM] This run is not complete until you call one of these terminal completion tools: ${e.join(", ")}. Continue working if requirements are not met. If the task is complete, call the appropriate terminal completion tool now.`;
  }
  getCompletionReminderMessages() {
    return [this.getCompletionToolReminderMessage(), this.config.completionPolicy?.completionGuard?.()].filter((e) => Boolean(e));
  }
  async addUserReminderMessage(e) {
    let n = ft("user", [{ type: "text", text: e }], { userRunSpan: 0 });
    return this.state.messages.push(n), await this.emit({ type: "message-added", snapshot: this.snapshot(), message: n }), n;
  }
  async execute(e) {
    if (await this.ensureInitialized(), this.state.status === "running") throw Error("Agent runtime is already running");
    this.abortController = new AbortController(), this.state.runId = ve("run"), this.state.status = "running", this.state.iteration = 0, this.state.pendingToolCalls = [], this.state.lastError = void 0, this.state.lastErrorClass = void 0, this.state.lastErrorReported = false, this.state.usage = ue(Nr), this.overflowRecoveryAttempted = false;
    try {
      await this.callBeforeRunHooks(), await this.emit({ type: "run-started", snapshot: this.snapshot() });
      for (let a of e ? Ov(e) : []) this.state.messages.push(a), await this.emit({ type: "message-added", snapshot: this.snapshot(), message: a });
      let n = this.getCompletionToolReminderMessage();
      if (n) await this.addUserReminderMessage(n);
      let r;
      while (this.config.maxIterations === void 0 || this.state.iteration < this.config.maxIterations) {
        this.throwIfAborted(), this.state.iteration += 1, await this.emit({ type: "turn-started", snapshot: this.snapshot(), iteration: this.state.iteration });
        let { message: a, finishReason: t } = await this.generateAssistantMessageWithOverflowRecovery();
        if (t === "aborted") throw this.normalizeAbortError();
        if (a.content.length === 0) throw Error(t === "error" ? this.state.lastError ?? "Model stream failed" : "Model returned empty response");
        let i = a.content.filter((l) => l.type === "tool-call");
        if (r = a, this.state.messages.push(a), await this.emit({ type: "message-added", snapshot: this.snapshot(), message: a }), await this.emit({ type: "assistant-message", snapshot: this.snapshot(), iteration: this.state.iteration, message: a, finishReason: t }), t === "max-tokens" && i.length === 0) throw Error(vv);
        if (t === "error" && i.length === 0) throw Error(this.state.lastError ?? "Model stream failed");
        if (this.state.pendingToolCalls = i.map((l) => l.toolCallId), i.length === 0) {
          await this.emit({ type: "turn-finished", snapshot: this.snapshot(), iteration: this.state.iteration, toolCallCount: 0 });
          let l = this.getCompletionReminderMessages();
          if (l.length > 0) {
            for (let c of l) await this.addUserReminderMessage(c);
            continue;
          }
          let d = this.finishRun("completed", r);
          return await this.callAfterRunHooks(d), await this.emit({ type: "run-finished", snapshot: this.snapshot(), result: d }), d;
        }
        let o = await this.executeToolCalls(i);
        this.state.pendingToolCalls = [];
        for (let l of o) this.state.messages.push(l), await this.emit({ type: "message-added", snapshot: this.snapshot(), message: l });
        await this.emit({ type: "turn-finished", snapshot: this.snapshot(), iteration: this.state.iteration, toolCallCount: i.length });
        let u = this.findCompletingToolMessage(i, o);
        if (u) {
          let l = this.finishRun("completed", r, Ev(u) || void 0);
          return await this.callAfterRunHooks(l), await this.emit({ type: "run-finished", snapshot: this.snapshot(), result: l }), l;
        }
      }
      throw Error(`Agent runtime exceeded maxIterations (${this.config.maxIterations})`);
    } catch (n) {
      let r = n instanceof Error ? n : Error(String(n)), a = r instanceof Ur, i = this.abortController.signal.aborted || a ? "aborted" : "failed", o = r instanceof mt ? "context_window_exceeded" : r.message === this.state.lastError ? this.state.lastErrorClass : void 0, u = r.message === this.state.lastError && this.state.lastErrorReported;
      this.state.status = i, this.state.lastError = r.message, this.state.lastErrorClass = o, this.state.lastErrorReported = u;
      let l = this.findLastAssistantMessage(), d = { agentId: this.state.agentId, agentRole: this.state.agentRole, runId: this.state.runId ?? ve("run"), status: i, iterations: this.state.iteration, outputText: pc(l), messages: F(this.state.messages), usage: ue(this.state.usage), error: i === "failed" ? r : void 0 };
      if (this.config.logger?.log?.("Agent loop caught error", { severity: i === "failed" ? "error" : "warn", agentId: this.state.agentId, agentRole: this.state.agentRole, runId: d.runId, status: i, iteration: this.state.iteration, errorName: r.name, errorMessage: r.message, assistantContentPartCount: l?.content.length ?? 0 }), await this.callAfterRunHooks(d), i === "failed") await this.emit({ type: "run-failed", snapshot: this.snapshot(), error: r, errorClass: o });
      else await this.emit({ type: "run-finished", snapshot: this.snapshot(), result: d });
      return d;
    } finally {
      this.abortController = void 0;
    }
  }
  async callBeforeRunHooks() {
    for (let e of this.hooks.beforeRun) {
      let n = await e({ snapshot: this.snapshot() });
      this.applyStopControl(n);
    }
  }
  async callAfterRunHooks(e) {
    for (let n of this.hooks.afterRun) await n({ snapshot: this.snapshot(), result: e });
  }
  async generateAssistantMessageWithOverflowRecovery() {
    let e = await this.generateAssistantMessage();
    if (!this.isRecoverableOverflowTurn(e)) return e;
    this.overflowRecoveryAttempted = true;
    let n = this.state.lastError;
    if (!this.config.prepareTurn) throw new mt(yv, n);
    await this.emit({ type: "status-notice", snapshot: this.snapshot(), message: "context window exceeded \u2014 compacting and retrying", metadata: { kind: "context_overflow_recovery", reason: "context_overflow_recovery", phase: "started", iteration: this.state.iteration, providerError: n } });
    let r = await this.generateAssistantMessage({ overflowRecovery: true });
    if (r.finishReason === "error" && this.state.lastErrorClass === "context_window_exceeded") throw new mt($v, this.state.lastError);
    return r;
  }
  isRecoverableOverflowTurn(e) {
    if (e.finishReason !== "error" || this.state.lastErrorClass !== "context_window_exceeded" || this.overflowRecoveryAttempted) return false;
    return !e.message.content.some((n) => n.type === "tool-call");
  }
  async generateAssistantMessage(e) {
    let n = ue(this.state.usage), r = tc({ sessionId: q(this.config.sessionId), agentId: this.state.agentId, conversationId: q(this.config.conversationId), runId: this.state.runId, iteration: this.state.iteration }), a = { systemPrompt: this.config.systemPrompt, messages: F(this.state.messages), tools: [...this.tools.values()].map((y) => ({ name: y.name, description: y.description, inputSchema: y.inputSchema })), signal: this.abortController?.signal, options: Or(this.config.modelOptions, { metadata: r }) }, t = Date.now(), i = () => Date.now() - t;
    if (this.state.iteration > 1) {
      let y = await this.consumePendingUserMessage();
      if (y) a = { ...a, messages: [...a.messages, ...F([y])] };
    }
    a = await this.prepareTurnForModelRequest(a, e), this.throwIfAborted();
    for (let y of this.hooks.beforeModel) {
      let k = await y({ snapshot: this.snapshot(), request: a });
      if (this.throwIfAborted(), this.applyStopControl(k), k?.messages) a = { ...a, messages: F(k.messages) };
      if (k?.tools) a = { ...a, tools: [...k.tools] };
      if (k?.options) a = { ...a, options: Or(a.options, k.options) };
    }
    this.config.logger?.debug("Agent model request diagnostics", { iteration: this.state.iteration, providerId: "providerId" in this.config && typeof this.config.providerId === "string" ? this.config.providerId : void 0, modelId: "modelId" in this.config && typeof this.config.modelId === "string" ? this.config.modelId : void 0, ...wv(a) }), this.throwIfAborted(), this.captureTaskLifecycle(ic, { durationMs: i(), phase: "provider_request_started" });
    let o = this.openTaskLifecycleStream(a, i), u = [], l = /* @__PURE__ */ new Map(), d = [], c = [], p = 0, f = "stop", $ = "", x = "";
    for await (let y of o) switch (this.throwIfAborted(), y.type) {
      case "text-delta": {
        $ += y.text;
        let k = c.at(-1);
        if (k?.type === "part" && k.part.type === "text") k.part.text += y.text;
        else c.push({ type: "part", part: { type: "text", text: y.text } });
        await this.emit({ type: "assistant-text-delta", snapshot: this.snapshot(), iteration: this.state.iteration, text: y.text, accumulatedText: $ });
        break;
      }
      case "reasoning-delta": {
        x += y.text;
        let k = c.at(-1);
        if (k?.type === "part" && k.part.type === "reasoning") k.part.text += y.text, k.part.redacted = y.redacted ?? k.part.redacted, k.part.metadata = y.metadata ?? k.part.metadata;
        else c.push({ type: "part", part: { type: "reasoning", text: y.text, redacted: y.redacted, metadata: y.metadata } });
        await this.emit({ type: "assistant-reasoning-delta", snapshot: this.snapshot(), iteration: this.state.iteration, text: y.text, accumulatedText: x, redacted: y.redacted, metadata: y.metadata });
        break;
      }
      case "tool-call-delta": {
        let k = y.toolCallId ?? `tool_${y.index ?? p}`;
        if (y.index == null && y.toolCallId == null) p += 1;
        let S = l.get(k);
        if (!S) S = { toolCallId: y.toolCallId ?? ve("tool"), inputText: "" }, l.set(k, S), c.push({ type: "tool", key: k });
        if (y.toolCallId) S.toolCallId = y.toolCallId;
        if (y.toolName) S.toolName = y.toolName;
        if (y.input !== void 0) S.inputValue = y.input;
        if (y.metadata !== void 0) S.metadata = gc(S.metadata, y.metadata);
        if (y.inputText) S.inputText = Uv(S.inputText, y.inputText);
        break;
      }
      case "file": {
        c.push({ type: "part", part: y.mediaType.startsWith("image/") ? { type: "image", image: y.data, mediaType: y.mediaType } : { type: "file", path: `model-generated-file-${c.length + 1}`, content: y.data } });
        break;
      }
      case "usage": {
        await this.updateUsage(y.usage);
        break;
      }
      case "finish": {
        if (f = y.reason, y.error) this.state.lastError = y.error, this.state.lastErrorClass = y.errorClass ?? classifyProviderError(y.error), this.state.lastErrorReported = y.errorReported === true;
        break;
      }
    }
    for (let y of c) {
      if (y.type === "part") {
        u.push(y.part);
        continue;
      }
      let k = l.get(y.key);
      if (!k?.toolName) {
        d.push({ toolCallId: k?.toolCallId ?? y.key, input: $n(k?.inputText ?? ""), reason: "missing_name" });
        continue;
      }
      let S = Nv(k);
      if (S.reason) d.push({ toolCallId: k.toolCallId, toolName: k.toolName, input: S.invalidInput, reason: S.reason });
      u.push({ type: "tool-call", toolCallId: k.toolCallId, toolName: k.toolName, input: S.input, metadata: S.parseError ? gc(k.metadata, { inputParseError: S.parseError, rawInputText: k.inputText }) : k.metadata });
    }
    let N = ft("assistant", u, d.length > 0 ? { invalidToolCalls: d } : void 0), X = Sv(n, this.state.usage);
    if (X) N.metrics = X, this.captureUnexpectedReasoningTokens(a, X);
    if (this.config.messageModelInfo) N.modelInfo = { ...this.config.messageModelInfo };
    for (let y of this.hooks.afterModel) {
      let k = await y({ snapshot: this.snapshot(), assistantMessage: N, finishReason: f });
      this.applyStopControl(k);
    }
    return { message: N, finishReason: f };
  }
  async *openTaskLifecycleStream(e, n) {
    let r, a = "provider_request_started";
    try {
      r = await this.config.model.stream(e), this.throwIfAborted(), a = "provider_stream_started", this.captureTaskLifecycle(rc, { durationMs: n(), phase: a });
    } catch (i) {
      if (!this.isAbortError(i)) this.captureTaskLifecycleFailure(i, a, n());
      throw i;
    }
    let t = false;
    try {
      for await (let i of r) {
        if (!t) t = true, a = "first_chunk_received", this.captureTaskLifecycle(ac, { durationMs: n(), phase: a, eventType: i.type });
        yield i;
      }
    } catch (i) {
      if (!this.isAbortError(i)) this.captureTaskLifecycleFailure(i, a, n());
      throw i;
    }
  }
  captureTaskLifecycleFailure(e, n, r) {
    this.captureTaskLifecycle(oc, { durationMs: r, error: e, errorClass: classifyProviderError(e), phase: n });
  }
  captureTaskLifecycle(e, n = {}) {
    let r = q(this.config.sessionId);
    lc(this.config.telemetry, { event: e, sessionId: r, ulid: r, agentId: this.state.agentId, conversationId: q(this.config.conversationId), runId: this.state.runId, iteration: this.state.iteration > 0 ? this.state.iteration : void 0, providerId: this.getTelemetryProviderId(), modelId: this.getTelemetryModelId(), ...n });
  }
  getTelemetryProviderId() {
    return q(this.config.messageModelInfo?.provider) ?? this.telemetryProviderId;
  }
  getTelemetryModelId() {
    return q(this.config.messageModelInfo?.id) ?? this.telemetryModelId;
  }
  isAbortError(e) {
    return e instanceof pt || this.abortController?.signal.aborted === true;
  }
  captureUnexpectedReasoningTokens(e, n) {
    if (!xv(e) || (n.reasoningTokenCount ?? 0) <= 0) return;
    let r = n.reasoningTokenCount;
    if (r === void 0) return;
    uc(this.config.telemetry, { sessionId: this.config.sessionId, agentId: this.state.agentId, runId: this.state.runId, iteration: this.state.iteration, providerId: this.config.messageModelInfo?.provider, modelId: this.config.messageModelInfo?.id, requestedThinking: false, reasoningTokenCount: r });
  }
  async prepareTurnForModelRequest(e, n) {
    if (!this.config.prepareTurn) return e;
    let r = n?.overflowRecovery === true, a = await this.config.prepareTurn({ agentId: this.state.agentId, conversationId: this.config.conversationId, parentAgentId: this.state.parentAgentId ?? null, iteration: this.state.iteration, messages: e.messages, systemPrompt: e.systemPrompt, tools: e.tools, model: { id: this.config.messageModelInfo?.id, provider: this.config.messageModelInfo?.provider }, signal: e.signal, overflowRecovery: r || void 0, emitStatusNotice: (i, o) => {
      this.emit({ type: "status-notice", snapshot: this.snapshot(), message: i, metadata: o });
    } });
    if (r) {
      if (!(a?.messages !== void 0 && JSON.stringify(a.messages).length < JSON.stringify(e.messages).length)) throw new mt(hv, this.state.lastError);
    }
    if (!a) return e;
    let t = e;
    if (a.messages) {
      let i = F(a.messages);
      t = { ...t, messages: F(i) };
    }
    if (a.systemPrompt !== void 0) t = { ...t, systemPrompt: a.systemPrompt };
    return t;
  }
  async consumePendingUserMessage() {
    let e = this.config.consumePendingUserMessage;
    if (!e) return;
    let n = (await e())?.trim();
    if (!n) return;
    let r = ft("user", [{ type: "text", text: n }], { userRunSpan: 0 });
    return this.state.messages.push(r), await this.emit({ type: "message-added", snapshot: this.snapshot(), message: r }), r;
  }
  async updateUsage(e) {
    this.state.usage = { inputTokens: this.state.usage.inputTokens + (e.inputTokens ?? 0), outputTokens: this.state.usage.outputTokens + (e.outputTokens ?? 0), cacheReadTokens: this.state.usage.cacheReadTokens + (e.cacheReadTokens ?? 0), cacheWriteTokens: this.state.usage.cacheWriteTokens + (e.cacheWriteTokens ?? 0), reasoningTokenCount: (this.state.usage.reasoningTokenCount ?? 0) + (e.reasoningTokenCount ?? 0), totalCost: (this.state.usage.totalCost ?? 0) + (e.totalCost ?? 0) }, await this.emit({ type: "usage-updated", snapshot: this.snapshot(), usage: ue(this.state.usage) });
  }
  async executeToolCalls(e) {
    let n = [];
    for (let a of e) n.push(await this.prepareToolExecution(a));
    if (this.config.toolExecution === "parallel") return Promise.all(n.map((a) => this.executePreparedTool(a)));
    let r = [];
    for (let a of n) r.push(await this.executePreparedTool(a));
    return r;
  }
  findCompletingToolMessage(e, n) {
    for (let r = 0; r < e.length; r += 1) {
      let a = e[r];
      if (this.tools.get(a.toolName)?.lifecycle?.completesRun !== true) continue;
      let t = n[r], i = t?.content.find((o) => o.type === "tool-result" && o.toolCallId === a.toolCallId);
      if (i && !i.isError) return t;
    }
    return;
  }
  async prepareToolExecution(e) {
    let n = this.tools.get(e.toolName), r = e.input, a, t = e.metadata && typeof e.metadata === "object" && !Array.isArray(e.metadata) ? e.metadata : void 0;
    if (typeof t?.inputParseError === "string") a = t.inputParseError;
    let i = t?.toolSource && typeof t.toolSource === "object" && !Array.isArray(t.toolSource) ? t.toolSource : void 0;
    if (i?.executionMode === "provider") a = `Tool execution is disabled for provider ${typeof i.providerId === "string" ? i.providerId : "provider"}`;
    if (n && !a) r = Et(r, n.inputSchema);
    let o;
    if (n && !a) for (let u of this.hooks.beforeTool) {
      let l = await u({ snapshot: this.snapshot(), tool: n, toolCall: { ...e, input: r }, input: r });
      if (l?.input !== void 0) r = l.input;
      if (l?.policy) o = { ...o, ...l.policy };
      if (this.applyStopControl(l), l?.skip) {
        a = l.reason ?? `Tool ${n.name} was blocked by a runtime hook`;
        break;
      }
    }
    if (n && !a) {
      let u = { ...kv(e.toolName, this.config.toolPolicies), ...o };
      if (u.enabled === false) a = `Tool "${e.toolName}" is disabled by policy`;
      else if (u.autoApprove === false) {
        let l = await this.requestToolApproval(e, r, u);
        if (!l.approved) a = l.reason ?? `Tool "${e.toolName}" was not approved`;
      }
    }
    return { toolCall: { ...e, input: r }, tool: n, input: r, skipReason: a };
  }
  async requestToolApproval(e, n, r) {
    let a = this.config.requestToolApproval;
    if (!a) return { approved: false, reason: `Tool "${e.toolName}" requires approval but no approval callback is configured` };
    try {
      return await a({ sessionId: this.config.sessionId?.trim() || this.config.conversationId?.trim() || this.state.runId || this.state.agentId, agentId: this.state.agentId, conversationId: this.config.conversationId?.trim() || this.state.runId || this.state.agentId, iteration: this.state.iteration, toolCallId: e.toolCallId, toolName: e.toolName, input: n, policy: r });
    } catch (t) {
      return { approved: false, reason: `Tool "${e.toolName}" approval request failed: ${t instanceof Error ? t.message : String(t)}` };
    }
  }
  async executePreparedTool(e) {
    let n = /* @__PURE__ */ new Date();
    await this.emit({ type: "tool-started", snapshot: this.snapshot(), iteration: this.state.iteration, toolCall: e.toolCall });
    let r;
    if (e.skipReason) r = { output: { error: e.skipReason }, isError: true };
    else if (!e.tool) r = { output: { error: `Unknown tool: ${e.toolCall.toolName}` }, isError: true };
    else try {
      r = { output: await e.tool.execute(e.input, { sessionId: this.config.sessionId, agentId: this.state.agentId, conversationId: this.config.conversationId, runId: this.state.runId ?? ve("run"), iteration: this.state.iteration, toolCallId: e.toolCall.toolCallId, signal: this.abortController?.signal, metadata: this.config.toolContextMetadata, snapshot: this.snapshot(), emitUpdate: (u) => {
        this.emit({ type: "tool-updated", snapshot: this.snapshot(), iteration: this.state.iteration, toolCall: e.toolCall, update: u });
      } }) };
    } catch (o) {
      r = { output: { error: o instanceof Error ? o.message : String(o) }, isError: true };
    }
    let a = /* @__PURE__ */ new Date(), t = Math.max(0, a.getTime() - n.getTime());
    if (e.tool) for (let o of this.hooks.afterTool) {
      let u = await o({ snapshot: this.snapshot(), tool: e.tool, toolCall: e.toolCall, input: e.input, result: r, startedAt: n, endedAt: a, durationMs: t });
      if (this.applyStopControl(u), u?.result) r = u.result;
    }
    let i = ft("tool", [{ type: "tool-result", toolCallId: e.toolCall.toolCallId, toolName: e.toolCall.toolName, output: r.output, isError: r.isError }]);
    return await this.emit({ type: "tool-finished", snapshot: this.snapshot(), iteration: this.state.iteration, toolCall: e.toolCall, message: i }), i;
  }
  finishRun(e, n, r) {
    return this.state.status = e, { agentId: this.state.agentId, agentRole: this.state.agentRole, runId: this.state.runId ?? ve("run"), status: e, iterations: this.state.iteration, outputText: r ?? pc(n ?? this.findLastAssistantMessage()), messages: F(this.state.messages), usage: ue(this.state.usage) };
  }
  findLastAssistantMessage() {
    return [...this.state.messages].reverse().find((e) => e.role === "assistant");
  }
  throwIfAborted() {
    if (this.abortController?.signal.aborted) throw this.normalizeAbortError();
  }
  normalizeAbortError() {
    let e = this.abortController?.signal.reason;
    if (e instanceof Error) return e;
    if (typeof e === "string") return Error(e);
    return Error(this.state.lastError ?? "Run aborted");
  }
  async emit(e) {
    let n = Tv(e);
    switch (e.type) {
      case "run-started":
        this.config.logger?.info?.("Agent run started", n);
        break;
      case "tool-finished":
        this.config.logger?.info?.("Agent tool finished", n);
        break;
      case "run-failed":
        if (this.config.logger?.error?.("Agent run failed", { ...n, error: e.error }), !this.state.lastErrorReported) dc(this.config.telemetry, { component: "agents", operation: "agent.run", error: e.error, severity: "error", handled: false, context: { ...n, providerId: this.getTelemetryProviderId(), modelId: this.getTelemetryModelId() } });
        break;
      default:
        this.config.logger?.debug?.("Agent event", n);
        break;
    }
    this.config.telemetry?.capture({ event: `agent.${e.type}`, properties: n });
    for (let r of this.listeners) r(e);
    for (let r of this.hooks.onEvent) await r(e);
  }
  applyStopControl(e) {
    if (!e?.stop) return;
    if (e.reason) this.state.lastError = e.reason;
    throw new Ur(e.reason);
  }
};
function Tv(e) {
  return { agentId: e.snapshot.agentId, agentRole: e.snapshot.agentRole, runId: e.snapshot.runId, status: e.snapshot.status, iteration: e.snapshot.iteration, eventType: e.type };
}
function gc(e, n) {
  if (!n || typeof n !== "object" || Array.isArray(n)) return n;
  if (!e || typeof e !== "object" || Array.isArray(e)) return n;
  return { ...e, ...n };
}
function Nv(e) {
  if (e.inputValue !== void 0) return { input: e.inputValue, invalidInput: $n(JSON.stringify(e.inputValue)) };
  if (!e.inputText.trim()) return { input: {}, invalidInput: {} };
  let n = zv(e.inputText);
  if (n.ok) return { input: n.value, invalidInput: $n(e.inputText) };
  return { input: {}, invalidInput: $n(e.inputText, n.error), parseError: `Tool call ${e.toolName ?? e.toolCallId} emitted invalid JSON arguments: ${n.error}`, reason: "invalid_arguments" };
}
function $n(e, n) {
  if (!e.trim()) return {};
  return n ? { rawInputText: e, parseError: n } : { rawInputText: e };
}
function zv(e) {
  let n = e.trim();
  if (!n) return { ok: false, error: "Tool call arguments were empty." };
  try {
    return { ok: true, value: JSON.parse(n) };
  } catch {
  }
  if (!(n.startsWith("{") || n.startsWith("["))) return { ok: false, error: "Tool call arguments must be encoded as a JSON object or array." };
  return { ok: false, error: "Tool call arguments could not be parsed as JSON. Ensure the outer tool payload is valid JSON and escape embedded quotes/newlines inside string fields." };
}
function Uv(e, n) {
  if (!e) return n;
  let r = n.trimStart();
  if (r.startsWith("{") || r.startsWith("[")) return n;
  return e + n;
}
var Dv = gt;

// src/cline-browser.js
var DEFAULT_PROMPT = [
  "You are Cline, a coding agent working in /root/project on a 32-bit Alpine Linux VM.",
  "Inspect before editing. Make focused changes and use the available tools rather than guessing.",
  "Installed commands and environment limits are documented in /usr/local/share/vm-agent-capabilities.md.",
  "After creating or editing executable code, run it or an appropriate syntax checker, inspect the exit code and output, and repair failures.",
  "For JavaScript, test with both time qjs FILE and time vmjs < FILE and report both elapsed times.",
  "Report success only after verification. When the task is complete, call finish_task with a concise verified summary."
].join("\n");
var jsonSchema = (properties) => ({ type: "object", properties, additionalProperties: false });
var textOf = (content) => (Array.isArray(content) ? content : []).filter((part) => part?.type === "text" || part?.type === "reasoning").map((part) => part.text).join("\n");
function toOpenAiMessages(messages) {
  const output = [];
  for (const message of messages) {
    if (message.role === "tool") {
      for (const part of message.content || []) if (part.type === "tool-result") {
        output.push({
          role: "tool",
          tool_call_id: part.toolCallId,
          name: part.toolName,
          content: typeof part.output === "string" ? part.output : JSON.stringify(part.output)
        });
      }
      continue;
    }
    const toolCalls = (message.content || []).filter((part) => part.type === "tool-call").map((part) => ({
      id: part.toolCallId,
      type: "function",
      function: { name: part.toolName, arguments: JSON.stringify(part.input ?? {}) }
    }));
    const converted = { role: message.role, content: textOf(message.content) || null };
    if (toolCalls.length) converted.tool_calls = toolCalls;
    output.push(converted);
  }
  return output;
}
function createClineModel(llmClient) {
  if (!llmClient?.chat) throw new Error("Cline requires an LLM client with chat()");
  return {
    id: llmClient.modelName || "webgpu",
    provider: "vmvm",
    async *stream(request) {
      const messages = toOpenAiMessages(request.messages);
      if (request.systemPrompt) messages.unshift({ role: "system", content: request.systemPrompt });
      const tools = request.tools.map((tool) => ({
        type: "function",
        function: { name: tool.name, description: tool.description, parameters: tool.inputSchema }
      }));
      const completion = await llmClient.chat({
        model: llmClient.modelName || "webgpu",
        temperature: 0,
        max_tokens: 1400,
        chat_template_kwargs: { enable_thinking: false },
        messages,
        ...tools.length ? { tools } : {}
      });
      const choice = completion?.choices?.[0] || {};
      const message = choice.message || {};
      if (message.content) yield { type: "text-delta", text: String(message.content) };
      for (const [index, call] of (message.tool_calls || []).entries()) {
        yield {
          type: "tool-call-delta",
          index,
          toolCallId: call.id || `cline-tool-${Date.now()}-${index}`,
          toolName: call.function?.name,
          inputText: call.function?.arguments || "{}"
        };
      }
      const usage = completion?.usage;
      if (usage) yield {
        type: "usage",
        usage: {
          inputTokens: usage.prompt_tokens || 0,
          outputTokens: usage.completion_tokens || 0,
          cacheReadTokens: usage.prompt_tokens_details?.cached_tokens || 0,
          cacheWriteTokens: 0
        }
      };
      yield { type: "finish", reason: message.tool_calls?.length ? "tool-calls" : choice.finish_reason === "length" ? "max-tokens" : "stop" };
    }
  };
}
function createTools({ guest, onActivity }) {
  const activity = (tool, input) => onActivity({ tool, input });
  return [
    fv({
      name: "read_file",
      description: "Read a UTF-8 file in the current project.",
      inputSchema: jsonSchema({ path: { type: "string", description: "Project-relative or absolute path" } }),
      async execute({ path }) {
        activity("read_file", { path });
        return await guest.read(path);
      }
    }),
    fv({
      name: "list_files",
      description: "List files in a project directory.",
      inputSchema: jsonSchema({ path: { type: "string", description: "Directory path; use . for the project root" } }),
      async execute({ path = "." }) {
        activity("list_files", { path });
        return await guest.list(path);
      }
    }),
    fv({
      name: "search_files",
      description: "Search project text using the guest ripgrep implementation.",
      inputSchema: jsonSchema({ pattern: { type: "string" }, path: { type: "string" } }),
      async execute({ pattern, path = "." }) {
        activity("search_files", { pattern, path });
        return await guest.grep(pattern, path);
      }
    }),
    fv({
      name: "write_file",
      description: "Create or replace a UTF-8 project file.",
      inputSchema: jsonSchema({ path: { type: "string" }, content: { type: "string" } }),
      async execute({ path, content }) {
        activity("write_file", { path });
        await guest.write(path, content);
        return `wrote ${path}`;
      }
    }),
    fv({
      name: "execute_command",
      description: "Run a POSIX shell command in the current project and return its exit code and combined output.",
      inputSchema: jsonSchema({ command: { type: "string" } }),
      async execute({ command }) {
        activity("execute_command", { command });
        const raw = String(await guest.execute(command));
        const match = raw.match(/^__V86AGENT_EXIT__(\d+)\n?/);
        return { exitCode: match ? Number(match[1]) : 0, output: match ? raw.slice(match[0].length) : raw };
      }
    }),
    fv({
      name: "finish_task",
      description: "Finish only after the requested work has been verified.",
      inputSchema: jsonSchema({ summary: { type: "string" } }),
      lifecycle: { completesRun: true },
      async execute({ summary }) {
        return summary;
      }
    })
  ];
}
function createClineVMAgent({
  guest,
  llmClient,
  workspace = "/root/project",
  yolo = true,
  approveAction = async () => false,
  onActivity = () => {
  },
  systemPrompt = DEFAULT_PROMPT,
  initialMessages = []
} = {}) {
  if (!guest) throw new Error("Cline requires the guest bridge");
  guest.setWorkspace?.(workspace);
  let autoApprove = Boolean(yolo);
  const runtime = new Dv({
    agentId: "vmvm-cline",
    conversationId: `vmvm-cline-${Date.now()}`,
    systemPrompt,
    model: createClineModel(llmClient),
    tools: createTools({ guest, onActivity }),
    initialMessages,
    maxIterations: 12,
    toolPolicies: {
      read_file: { autoApprove: true },
      list_files: { autoApprove: true },
      search_files: { autoApprove: true },
      write_file: { autoApprove: false },
      execute_command: { autoApprove: false },
      finish_task: { autoApprove: true }
    },
    requestToolApproval: async (request) => ({
      approved: autoApprove || await approveAction(request.toolName, request.input)
    })
  });
  runtime.subscribe((event) => {
    if (event.type === "tool-started") onActivity({ tool: event.toolCall.toolName, input: event.toolCall.input });
  });
  return {
    runtime,
    setYolo(value) {
      autoApprove = Boolean(value);
    },
    stop() {
      runtime.abort("stopped by user");
    },
    snapshot() {
      return runtime.snapshot();
    },
    async run(task) {
      return await runtime.run(String(task));
    },
    async continue(task) {
      return await runtime.continue(String(task));
    }
  };
}
export {
  createClineModel,
  createClineVMAgent
};
