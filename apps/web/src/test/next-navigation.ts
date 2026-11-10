import { vi } from "vitest";

// A controllable stand-in for next/navigation. Tests import routerMock/navState from "@/test/next-navigation".
export const routerMock = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };
export const navState = { pathname: "/", search: "" };

export const useRouter = () => routerMock;
export const usePathname = () => navState.pathname;
export const useSearchParams = () => new URLSearchParams(navState.search);
