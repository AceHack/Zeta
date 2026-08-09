import {
  DARK_HALL_BROWSER_PAGE_GLOBAL,
  startNativeDarkHallBrowserPage,
  type DarkHallBrowserPageResult,
  type DarkHallBrowserPageRuntime,
} from "./darkhall-browser-page";

export const DARK_HALL_BROWSER_PAGE_ENTRY_RESULT: DarkHallBrowserPageResult<DarkHallBrowserPageRuntime> =
  await startNativeDarkHallBrowserPage();

try {
  Reflect.set(globalThis, DARK_HALL_BROWSER_PAGE_GLOBAL, DARK_HALL_BROWSER_PAGE_ENTRY_RESULT);
} catch {
  // The mount already carries the typed startup readout; this global is test and inspection access only.
}
