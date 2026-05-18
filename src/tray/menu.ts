export const TRAY_MENU_ITEMS = [
  { id: "open_dashboard", label: "Open Dashboard", dangerous: false },
  { id: "import_skr", label: "Import .skr...", dangerous: false },
  { id: "refresh", label: "Refresh", dangerous: false },
  { id: "mount_manager", label: "Mount Manager", dangerous: false },
  { id: "envelope_explorer", label: "Envelope Explorer", dangerous: false },
  { id: "quit", label: "Quit", dangerous: false },
] as const;

const FORBIDDEN_DIRECT_ACTIONS = new Set(["enable", "apply", "rollback"]);

export function trayMenuHasNoDangerousDirectActions(): boolean {
  return TRAY_MENU_ITEMS.every((item) => {
    const normalized = `${item.id} ${item.label}`.toLowerCase();
    return (
      !item.dangerous &&
      ![...FORBIDDEN_DIRECT_ACTIONS].some((action) => normalized.includes(action))
    );
  });
}
