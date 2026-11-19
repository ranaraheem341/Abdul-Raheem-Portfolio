import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../src/components/layout/portfolio-motion.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
});

function setup({ reduced = false, supported = true, fine = true, hash = "" } = {}) {
  class Element {
    dataset = {};
    attributes = new Set();
    listeners = new Map();
    properties = new Map();
    style = { setProperty: (name, value) => this.properties.set(name, value), removeProperty: name => this.properties.delete(name) };
    constructor(top = 0) { this.top = top; }
    getBoundingClientRect() { return { top: this.top, left: 0, width: 200, height: 100 }; }
    contains(element) {
      for (let node = element; node; node = node.parentElement) if (node === this) return true;
      return false;
    }
    hasAttribute(name) { return this.attributes.has(name); }
    toggleAttribute(name, active) { if (active) this.attributes.add(name); else this.attributes.delete(name); }
    removeAttribute(name) { this.attributes.delete(name); }
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    removeEventListener(name) { this.listeners.delete(name); }
    closest(selector) { return selector === "[data-motion-tilt]" ? this.card : this.panel; }
  }
  const onScreen = new Element(200), offScreen = new Element(1000), focused = new Element(1100);
  const portrait = new Element();
  portrait.attributes.add("data-motion-loop");
  const root = new Element();
  [onScreen, offScreen, focused, portrait].forEach(element => { element.parentElement = root; });
  root.querySelectorAll = selector => selector.includes("section") ? [onScreen, offScreen, focused] : [portrait];
  const document = new Element();
  document.activeElement = focused;
  document.hidden = false;
  document.getElementById = id => id === "about" ? offScreen : null;
  const preference = new Element();
  preference.matches = reduced;
  const finePointer = new Element();
  finePointer.matches = fine;
  const frames = new Map();
  let nextFrame = 0;
  const window = Object.assign(new Element(), {
    innerHeight: 800, location: { hash }, matchMedia: query => query.includes("reduced") ? preference : finePointer,
    requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  const observers = [];
  class IntersectionObserver {
    targets = new Set();
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(element) { this.targets.add(element); }
    unobserve(element) { this.targets.delete(element); }
    disconnect() { this.targets.clear(); }
    enter(target, isIntersecting = true) { this.callback([{ target, isIntersecting }]); }
  }
  let effect;
  const exports = {};
  const react = { useRef: () => ({ current: root }), useEffect: callback => { effect = callback; } };
  vm.runInNewContext(outputText, {
    exports, require: name => name === "react" ? react : { jsx: () => null },
    Element, Node: Element, document, IntersectionObserver,
    window: Object.assign(window, supported ? { IntersectionObserver } : {}),
  });
  exports.PortfolioMotion({ children: null });
  const cleanup = effect();
  return { root, document, window, preference, finePointer, frames, observers, onScreen, offScreen, focused, portrait, Element, cleanup };
}

test("reveals only below-screen content once; preserves visible and focused content", () => {
  const state = setup();
  const observer = state.observers[0];
  assert.equal(state.onScreen.dataset.reveal, undefined);
  assert.equal(state.focused.dataset.reveal, undefined);
  assert.equal(state.offScreen.dataset.reveal, "pending");
  observer.enter(state.offScreen);
  assert.equal(state.offScreen.dataset.reveal, "visible");
  assert.equal(observer.targets.has(state.offScreen), false);
  observer.enter(state.portrait);
  assert.equal(state.portrait.hasAttribute("data-motion-active"), true);
  observer.enter(state.portrait, false);
  assert.equal(state.portrait.hasAttribute("data-motion-active"), false);
  state.cleanup();
});

test("keyboard focus reveals immediately; background tabs pause loops; cleanup restores content", () => {
  const state = setup();
  const input = new state.Element();
  input.panel = state.offScreen;
  state.root.listeners.get("focusin")({ target: input });
  assert.equal(state.offScreen.dataset.reveal, undefined);
  assert.equal(state.observers[0].targets.has(state.offScreen), false);
  state.document.hidden = true;
  state.document.listeners.get("visibilitychange")();
  assert.equal(state.root.hasAttribute("data-motion-paused"), true);
  state.cleanup();
  assert.equal(state.root.listeners.size, 0);
  assert.equal(state.document.listeners.size, 0);
  assert.equal(state.preference.listeners.size, 0);
  assert.equal(state.observers[0].targets.size, 0);
});

test("live reduced-motion changes remove pending reveals and observers", () => {
  const state = setup();
  state.preference.matches = true;
  state.preference.listeners.get("change")();
  assert.equal(state.offScreen.dataset.reveal, undefined);
  assert.equal(state.observers[0].targets.size, 0);
  state.cleanup();
  const reduced = setup({ reduced: true });
  assert.equal(reduced.observers.length, 0);
  assert.equal(reduced.offScreen.dataset.reveal, undefined);
  reduced.cleanup();
});

test("missing IntersectionObserver leaves server content visible", () => {
  const state = setup({ supported: false });
  assert.equal(state.observers.length, 0);
  assert.equal(state.offScreen.dataset.reveal, undefined);
});

test("direct and changing section hashes expose destination content immediately", () => {
  const direct = setup({ hash: "#about" });
  assert.equal(direct.offScreen.dataset.reveal, undefined);
  direct.cleanup();
  const state = setup();
  state.window.location.hash = "#about";
  state.window.listeners.get("hashchange")();
  assert.equal(state.offScreen.dataset.reveal, undefined);
  assert.equal(state.observers[0].targets.has(state.offScreen), false);
  state.cleanup();
  assert.equal(state.window.listeners.size, 0);
});

test("keyboard focus exposes all nested reveal ancestors", () => {
  const state = setup();
  const nested = new state.Element();
  nested.dataset.reveal = "pending";
  nested.parentElement = state.offScreen;
  state.offScreen.panel = state.offScreen;
  const input = new state.Element();
  input.panel = nested;
  state.root.listeners.get("focusin")({ target: input });
  assert.equal(nested.dataset.reveal, undefined);
  assert.equal(state.offScreen.dataset.reveal, undefined);
  state.cleanup();
});

test("pointer tilt batches frames, clamps movement, and clears on exit or background", () => {
  const state = setup();
  const card = new state.Element();
  card.parentElement = state.root;
  card.card = card;
  const move = state.root.listeners.get("pointermove");
  move({ target: card, pointerType: "touch", clientX: 200, clientY: 100 });
  assert.equal(state.frames.size, 0);
  move({ target: card, pointerType: "mouse", clientX: 200, clientY: 100 });
  move({ target: card, pointerType: "mouse", clientX: 1000, clientY: -1000 });
  assert.equal(state.frames.size, 1);
  for (const [id, callback] of state.frames) { state.frames.delete(id); callback(); }
  assert.equal(card.properties.get("--tilt-x"), "1.60deg");
  assert.equal(card.properties.get("--tilt-y"), "1.60deg");
  state.root.listeners.get("pointerout")({ relatedTarget: null });
  assert.equal(card.properties.size, 0);
  move({ target: card, pointerType: "mouse", clientX: 200, clientY: 100 });
  state.document.hidden = true;
  state.document.listeners.get("visibilitychange")();
  assert.equal(state.frames.size, 0);
  assert.equal(card.properties.size, 0);
  state.cleanup();
});

test("coarse pointers skip tilt listeners and capability changes remove queued motion", () => {
  const coarse = setup({ fine: false });
  assert.equal(coarse.root.listeners.has("pointermove"), false);
  coarse.cleanup();
  const state = setup();
  const card = new state.Element();
  card.parentElement = state.root;
  card.card = card;
  state.root.listeners.get("pointermove")({ target: card, pointerType: "mouse", clientX: 200, clientY: 100 });
  state.finePointer.matches = false;
  state.finePointer.listeners.get("change")();
  assert.equal(state.frames.size, 0);
  assert.equal(state.root.listeners.has("pointermove"), false);
  state.cleanup();
});
