import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { navState, routerMock } from "./src/test/next-navigation";

vi.mock("next/navigation", () => import("./src/test/next-navigation"));

// jsdom lacks these.
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// Page images are shown from object URLs, which jsdom does not provide.
let blobCount = 0;
URL.createObjectURL = () => `blob:test-page-${++blobCount}`;
URL.revokeObjectURL = () => {};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  routerMock.push.mockReset();
  routerMock.replace.mockReset();
  navState.pathname = "/";
  navState.search = "";
});
