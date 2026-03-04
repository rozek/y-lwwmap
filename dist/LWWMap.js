import * as m from "yjs";
import { Observable as A } from "lib0/observable";
import T from "blueimp-md5";
const u = 3e3, _ = 720 * 60 * 60 * 1e3;
class b extends A {
  constructor(e, t = _) {
    if (super(), !isFinite(t) || t <= 0)
      throw new RangeError('LWWMap: "RetentionPeriod" must be a positive finite number');
    this.sharedArray = e, this.RetentionPeriod = t * u, this.lastTimestamp = Date.now() * u, this.localMap = /* @__PURE__ */ new Map(), this._initializeMap(), this._ObserverHandler = (s, a) => this._updateOnChange(s, a), this.sharedArray.observe(this._ObserverHandler);
  }
  /**** destroy ****/
  destroy() {
    this.sharedArray.unobserve(this._ObserverHandler), super.destroy();
  }
  /**** @@iterator ****/
  [Symbol.iterator]() {
    return [...this.localMap.entries()].filter((e) => "Value" in e[1]).map((e) => [e[0], this._resolvedValue(e[1].Value)])[Symbol.iterator]();
  }
  /**** size ****/
  get size() {
    let e = 0;
    return this.localMap.forEach((t) => {
      "Value" in t && e++;
    }), e;
  }
  /**** clear ****/
  clear() {
    this.size > 0 && this.sharedArray.doc.transact(() => {
      this._removeAnyObsoleteDeletions(), this.sharedArray.delete(0, this.sharedArray.length), this.localMap.forEach((e, t) => {
        if ("Value" in e) {
          this._updateLastTimestampWith(Date.now() * u);
          let s = { Key: t, Timestamp: this.lastTimestamp };
          this.sharedArray.push([s]);
        } else
          this.sharedArray.push([e]);
      });
    });
  }
  /**** delete ****/
  delete(e) {
    return this.localMap.has(e) ? (this.sharedArray.doc.transact(() => {
      this._removeAnyLogEntriesForKey(e), this._removeAnyObsoleteDeletions(), this._updateLastTimestampWith(Date.now() * u);
      let t = { Key: e, Timestamp: this.lastTimestamp };
      this.sharedArray.push([t]);
    }), !0) : !1;
  }
  /**** entries ****/
  entries() {
    const e = this.localMap.entries();
    return {
      [Symbol.iterator]() {
        return this;
      },
      // makes this object iterable
      // @ts-ignore TS2322
      next: () => {
        let t = e.next();
        for (; !t.done; ) {
          let [s, a] = t.value;
          if ("Value" in a)
            return { value: [s, this._resolvedValue(a.Value)] };
          t = e.next();
        }
        return { done: !0 };
      }
    };
  }
  /**** forEach ****/
  forEach(e, t) {
    this.localMap.forEach((s, a) => {
      "Value" in s && e.call(t, this._resolvedValue(s.Value), a, this);
    });
  }
  /**** get ****/
  get(e) {
    if (!this.localMap.has(e))
      return;
    const t = this.localMap.get(e);
    return "Value" in t ? this._resolvedValue(t.Value) : void 0;
  }
  /**** has ****/
  has(e) {
    return this.localMap.has(e) && "Value" in this.localMap.get(e);
  }
  /**** keys ****/
  keys() {
    const e = this.localMap.entries();
    return {
      [Symbol.iterator]() {
        return this;
      },
      // makes this object iterable
      // @ts-ignore TS2322
      next: () => {
        let t = e.next();
        for (; !t.done; ) {
          let [s, a] = t.value;
          if ("Value" in a)
            return { value: s };
          t = e.next();
        }
        return { done: !0 };
      }
    };
  }
  /**** set ****/
  set(e, t) {
    return this.sharedArray.doc.transact(() => {
      if (this._removeAnyLogEntriesForKey(e), this._removeAnyObsoleteDeletions(), this._updateLastTimestampWith(Date.now() * u), t instanceof m.AbstractType)
        if (t.doc != null) {
          const s = this._YjsSentinelFor(t), a = s ?? t;
          this.sharedArray.push([{ Key: e, Value: a, Timestamp: this.lastTimestamp }]);
        } else {
          let s = new m.Map();
          this.sharedArray.push([s]), s.set("Key", e), s.set("Timestamp", this.lastTimestamp), s.set("Value", t);
        }
      else
        this.sharedArray.push([{ Key: e, Value: t, Timestamp: this.lastTimestamp }]);
    }), this;
  }
  /**** values ****/
  values() {
    const e = this.localMap.entries();
    return {
      [Symbol.iterator]() {
        return this;
      },
      // makes this object iterable
      // @ts-ignore TS2322
      next: () => {
        let t = e.next();
        for (; !t.done; ) {
          let [s, a] = t.value;
          if ("Value" in a)
            return { value: this._resolvedValue(a.Value) };
          t = e.next();
        }
        return { done: !0 };
      }
    };
  }
  /**** transact ****/
  transact(e, t) {
    this.sharedArray.doc.transact(e, t);
  }
  /**** Container ****/
  get Container() {
    return this.sharedArray;
  }
  /**** _YjsSentinelFor — serialisable reference to an already-integrated Yjs type ****/
  _YjsSentinelFor(e) {
    const t = e.doc;
    if (t == null)
      return null;
    const s = t.share;
    for (const [a, i] of s)
      if (i === e) {
        if (e instanceof m.Array)
          return { YjsRef: "array", YjsName: a };
        if (e instanceof m.Map)
          return { YjsRef: "map", YjsName: a };
        if (e instanceof m.Text)
          return { YjsRef: "text", YjsName: a };
        if (e instanceof m.XmlFragment)
          return { YjsRef: "xml", YjsName: a };
      }
    return null;
  }
  /**** _ValueIsYjsSentinel — detects a sentinel produced by _YjsSentinelFor ****/
  _isYjsSentinel(e) {
    return e != null && typeof e == "object" && !(e instanceof m.AbstractType) && typeof e.YjsRef == "string" && typeof e.YjsName == "string";
  }
  /**** _ValueFromYjsSentinel — reconstructs a Yjs type from a sentinel ****/
  _ValueFromYjsSentinel(e) {
    const t = this.sharedArray.doc;
    if (t == null)
      return e;
    switch (e.YjsRef) {
      case "array":
        return t.getArray(e.YjsName);
      case "map":
        return t.getMap(e.YjsName);
      case "text":
        return t.getText(e.YjsName);
      case "xml":
        return t.get(e.YjsName, m.XmlFragment);
      default:
        return e;
    }
  }
  /**** _resolvedValue — resolves sentinels, passes other values through unchanged ****/
  _resolvedValue(e) {
    return this._isYjsSentinel(e) ? this._ValueFromYjsSentinel(e) : e;
  }
  /**** _normalizedEntry — converts a Y.Map log entry to a plain ChangeLogEntry ****/
  _normalizedEntry(e) {
    if (e instanceof m.Map) {
      const t = { Key: e.get("Key"), Timestamp: e.get("Timestamp") };
      return e.has("Value") && (t.Value = e.get("Value")), t;
    }
    return e;
  }
  /**** _LogEntryIsBroken ****/
  _LogEntryIsBroken(e) {
    if (e == null)
      return !0;
    const t = this._normalizedEntry(e);
    if (typeof t.Key != "string" || typeof t.Timestamp != "number" || !isFinite(t.Timestamp) || t.Timestamp < 0 || Math.floor(t.Timestamp) !== t.Timestamp)
      return !0;
    if ("Value" in t) {
      const s = typeof t.Value;
      if (s !== "object" && s !== "boolean" && s !== "string" && s !== "number")
        return !0;
    }
    return !1;
  }
  /**** _ChangesCollide - is "firstChange" newer than "secondChange"? ****/
  _md5Hash(e) {
    try {
      return e instanceof Uint8Array ? T(Array.from(e).join(",")) : T(JSON.stringify(e));
    } catch {
      return "";
    }
  }
  _ChangesCollide(e, t) {
    return e.Timestamp > t.Timestamp || e.Timestamp === t.Timestamp && e.Value !== t.Value && this._md5Hash(e.Value) > this._md5Hash(t.Value);
  }
  /**** initialize "localMap" from "sharedArray", remove obsolete array items ****/
  _initializeMap() {
    const e = /* @__PURE__ */ new Map(), t = this.sharedArray.toArray();
    this.sharedArray.doc.transact(() => {
      for (let s = t.length - 1; s >= 0; s--) {
        const a = this._normalizedEntry(t[s]), i = a.Key, c = this.localMap.has(i) || e.has(i), p = c ? this.localMap.get(i) || e.get(i) : void 0;
        if ("Value" in a)
          switch (!0) {
            case !c:
              this.localMap.set(i, a), this._updateLastTimestampWith(a.Timestamp);
              break;
            case this._ChangesCollide(p, a):
              console.warn(
                'LWWMap: timestamp mismatch for key "' + i + '"'
              ), this.sharedArray.delete(s);
              break;
            default:
              e.delete(i), this.localMap.set(i, a), this._updateLastTimestampWith(a.Timestamp);
          }
        else
          switch (!0) {
            case !c:
              e.set(i, a), this._updateLastTimestampWith(a.Timestamp);
              break;
            case this._ChangesCollide(p, a):
              console.warn(
                'LWWMap: timestamp mismatch for key "' + i + '"'
              ), this.sharedArray.delete(s);
              break;
            default:
              e.set(i, a), this.localMap.delete(i), this._updateLastTimestampWith(a.Timestamp);
          }
      }
    });
  }
  /**** apply reported updates - if applicable ****/
  _updateOnChange(e, t) {
    const s = /* @__PURE__ */ new Map();
    let a = this.lastTimestamp;
    const i = /* @__PURE__ */ new Map();
    function c(r) {
      if (a = Math.max(a, r), a > Number.MAX_SAFE_INTEGER)
        throw new TypeError("timestamp has reached the allowed limit");
    }
    const p = Array.from(e.changes.added).map(
      (r) => r.content.getContent()
    ).flat(), g = p.map(
      (r) => this._normalizedEntry(r)
    );
    try {
      g.forEach((r) => {
        if (this._LogEntryIsBroken(r))
          return;
        const n = r.Key, h = s.has(n) || this.localMap.has(n), o = h ? s.get(n) || this.localMap.get(n) : void 0;
        switch (!0) {
          case !("Value" in r):
            if (h) {
              if (this._ChangesCollide(o, r)) {
                console.warn(
                  "LWWMap: remotely deleted entry was later modified locally",
                  o.Timestamp,
                  r.Timestamp
                );
                return;
              }
              c(r.Timestamp), s.set(n, r), i.set(n, {
                action: "delete",
                oldValue: o.Value
              });
            }
            break;
          case (h && this._ChangesCollide(o, r)):
            console.warn(
              "LWWMap: remote change is outdated",
              o.Timestamp,
              r.Timestamp
            );
            return;
          default:
            c(r.Timestamp), s.set(n, r), this.localMap.has(n) ? i.set(n, {
              action: "update",
              oldValue: o.Value,
              newValue: r.Value
            }) : i.set(n, {
              action: "add",
              newValue: r.Value
            });
        }
      });
    } catch (r) {
      if (r.message.startsWith("Conflict: ")) {
        const n = /* @__PURE__ */ new Set(), h = /* @__PURE__ */ new Set();
        p.forEach((d, l) => {
          n.add(g[l].Key), h.add(d);
        });
        const o = this.sharedArray.toArray();
        this.sharedArray.doc.transact(() => {
          const d = /* @__PURE__ */ new Map();
          for (let l = o.length - 1; l >= 0; l--) {
            let y = o[l], f = this._normalizedEntry(y).Key;
            switch (!0) {
              case h.has(y):
                this.sharedArray.delete(l);
                break;
              case n.has(f):
                d.has(f) || d.set(f, y), this.sharedArray.delete(l);
            }
          }
          for (const [, l] of d)
            this.sharedArray.push([l]);
        });
        return;
      } else
        throw r;
    }
    if (i.size > 0) {
      for (const [r, n] of s)
        this.localMap.set(r, n);
      this.lastTimestamp = a;
    }
    if (this._removeAnyBrokenLogEntries(), this._removeAnyObsoleteDeletions(), i.size > 0) {
      const r = this.sharedArray.toArray();
      this.sharedArray.doc.transact(() => {
        for (let n = r.length - 1; n >= 0; n--) {
          const h = this._normalizedEntry(r[n]), o = h.Key;
          i.has(o) && i.get(o).newValue !== h.Value && this.sharedArray.delete(n);
        }
      });
    }
    i.size > 0 && this.emit("change", [i, t]);
  }
  /**** _removeAnyBrokenLogEntries ****/
  _removeAnyBrokenLogEntries() {
    const e = this.sharedArray.toArray();
    for (let t = e.length - 1; t >= 0; t--)
      this._LogEntryIsBroken(e[t]) && this.sharedArray.delete(t);
  }
  /**** _removeAnyLogEntriesForKey ****/
  _removeAnyLogEntriesForKey(e) {
    const t = this.sharedArray.toArray();
    for (let s = t.length - 1; s >= 0; s--)
      this._normalizedEntry(t[s]).Key === e && this.sharedArray.delete(s);
  }
  /**** _removeAnyObsoleteDeletions ****/
  _removeAnyObsoleteDeletions() {
    let e = Date.now() * u - this.RetentionPeriod;
    const t = this.sharedArray.toArray();
    for (let s = t.length - 1; s >= 0; s--) {
      const a = this._normalizedEntry(t[s]);
      !("Value" in a) && a.Timestamp < e && (this.localMap.delete(a.Key), this.sharedArray.delete(s));
    }
  }
  /**** _updateLastTimestampWith ****/
  _updateLastTimestampWith(e) {
    let t = Math.max(this.lastTimestamp + 1, e);
    if (t > Number.MAX_SAFE_INTEGER)
      throw new TypeError("timestamp has reached the allowed limit");
    this.lastTimestamp = t;
  }
}
export {
  b as LWWMap
};
