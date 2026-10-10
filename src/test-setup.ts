import "@testing-library/jest-dom/vitest";

// jsdom does not implement matchMedia; polyfill it so components that read
// prefers-reduced-motion / prefers-color-scheme don't crash under vitest.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}
