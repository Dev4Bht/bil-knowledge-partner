import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ADMIN } from "@/test/fixtures";
import { routerMock } from "@/test/next-navigation";
import { mockApi, renderApp, route } from "@/test/utils";
import { navState } from "@/test/next-navigation";
import { LoginScreen, safeNext, DEMO_PASSWORD } from "./login-screen";

const ready = route("GET", "/ready", { body: { status: "ready", checks: { database: { ok: true } } } });

describe("LoginScreen", () => {
  it("signs in, sends credentials with the CSRF header, then goes to /ask", async () => {
    const user = userEvent.setup();
    const { calls } = mockApi(ready, route("POST", "/auth/login", { body: ADMIN }));
    renderApp(<LoginScreen />);
    await user.type(screen.getByLabelText("Email"), " admin@demo.bil.test ");
    await user.type(screen.getByLabelText("Password"), "secret-pw");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/ask"));
    const post = calls.find((c) => c.url.pathname === "/auth/login")!;
    expect(JSON.parse(post.init.body as string)).toEqual({ email: "admin@demo.bil.test", password: "secret-pw" });
    expect((post.init.headers as Record<string, string>)["X-Requested-With"]).toBe("bil-web");
    expect(post.init.credentials).toBe("include");
  });

  it("never says which half was wrong", async () => {
    const user = userEvent.setup();
    mockApi(ready, route("POST", "/auth/login", { status: 401, body: { detail: "Wrong email or password", code: "invalid_credentials" } }));
    renderApp(<LoginScreen />);
    await user.type(screen.getByLabelText("Email"), "a@b.c");
    await user.type(screen.getByLabelText("Password"), "x");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The email or password is not right");
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("tells people when they are rate limited", async () => {
    const user = userEvent.setup();
    mockApi(ready, route("POST", "/auth/login", { status: 429, body: { detail: "Too many sign-in attempts. Wait a minute and try again", code: "rate_limited" } }));
    renderApp(<LoginScreen />);
    await user.type(screen.getByLabelText("Email"), "a@b.c");
    await user.type(screen.getByLabelText("Password"), "x");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText(/Too many sign-in attempts/)).toBeInTheDocument();
  });

  it("labels the demo accounts and fills them in on request", async () => {
    mockApi(ready);
    renderApp(<LoginScreen />);
    expect(screen.getByText(/fictional demo data, not BIL policy/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /staff@demo.bil.test/ }));
    expect(screen.getByLabelText("Email")).toHaveValue("staff@demo.bil.test");
    expect(screen.getByLabelText("Password")).toHaveValue(DEMO_PASSWORD);
  });

  it("returns to the page the person wanted, but only same-site paths", async () => {
    navState.search = "next=%2Fdocuments%3Fq%3Dmotor";
    mockApi(ready);
    renderApp(<LoginScreen />, { user: ADMIN });
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/documents?q=motor"));
    expect(safeNext("//evil.example")).toBe("/ask");
    expect(safeNext("https://evil.example")).toBe("/ask");
    expect(safeNext("/login")).toBe("/ask");
    expect(safeNext(null)).toBe("/ask");
    expect(safeNext("/admin/audit")).toBe("/admin/audit");
  });
});
