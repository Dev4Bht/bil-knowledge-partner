// Not a client module on purpose: the root layout (a server component) embeds BOOT_SCRIPT in <head>.
// Keys are shared with lib/theme.ts and lib/accent.ts.
export const THEME_KEY = "bil-theme";
export const ACCENT_KEY = "bil-accent";
export const ACCENT_CSS_KEY = "bil-accent-css";
export const ACCENT_STYLE_ID = "bil-accent-style";

/**
 * Runs before first paint so a saved light/dark choice and theme colour never flash the wrong look.
 * The saved CSS is only injected if it passes the same strict check as lib/accent.ts (safeAccentCss).
 */
export const BOOT_SCRIPT = `try{
var d=document.documentElement,t=localStorage.getItem("${THEME_KEY}");
if(t==="light"||t==="dark")d.setAttribute("data-theme",t);
var c=localStorage.getItem("${ACCENT_CSS_KEY}");
if(c&&c.length<6000&&!/url\\(|@import|expression|javascript:|<|\\\\/i.test(c)){
var r=c.replace(/--[a-z0-9-]+:#[0-9a-f]{6}/gi,"").replace(/html:root\\[data-accent\\](\\[data-theme="dark"\\]|:not\\(\\[data-theme="light"\\]\\))?/g,"").replace(/@media \\(prefers-color-scheme: dark\\)/g,"");
if(/^[\\s{};]*$/.test(r)){var s=document.createElement("style");s.id="${ACCENT_STYLE_ID}";s.textContent=c;document.head.appendChild(s);d.setAttribute("data-accent","1")}
}}catch(e){}`;
