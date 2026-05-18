import { describe, expect, it } from "vitest";
import { TRAY_MENU_ITEMS, trayMenuHasNoDangerousDirectActions } from "./menu";

describe("tray menu contract", () => {
  it("contains the desktop alpha entry points", () => {
    expect(TRAY_MENU_ITEMS.map((item) => item.label)).toEqual([
      "Open Dashboard",
      "Import .skr...",
      "Refresh",
      "Mount Manager",
      "Envelope Explorer",
      "Quit",
    ]);
  });

  it("does not expose direct dangerous actions", () => {
    expect(trayMenuHasNoDangerousDirectActions()).toBe(true);
  });
});
