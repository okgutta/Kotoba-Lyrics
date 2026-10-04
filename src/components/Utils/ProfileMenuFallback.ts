interface ProfileMenuFallbackOptions {
  name: string;
  icon: string;
  onOpen: () => void;
}

const PROFILE_SELECTOR =
  '[data-testid="user-widget-link"], .Root__globalNav .main-actionButtons button[aria-expanded][aria-label]';
const MENU_SELECTOR = '#context-menu ul[role="menu"]';

function isProfile(element: Element): boolean {
  return (
    element.matches('[data-testid="user-widget-link"]') ||
    (element.matches("button[aria-expanded][aria-label]") &&
      !!element.closest(".Root__globalNav .main-actionButtons") &&
      !element.closest(".main-actionButtons-spacer"))
  );
}

function belongsToProfile(menu: Element, profile: Element): boolean {
  // Prefer explicit accessibility relationships when the current Spotify build
  // exposes them. Other context menus share the same portal.
  const labelledBy = menu.getAttribute("aria-labelledby");
  if (labelledBy && (!profile.id || !labelledBy.split(/\s+/).includes(profile.id))) return false;
  const controls = profile.getAttribute("aria-controls")?.split(/\s+/).filter(Boolean);
  if (!controls?.length) return true;
  for (let host: Element | null = menu; host; host = host.parentElement) {
    if (controls.includes(host.id)) return true;
  }
  return false;
}

/** Supplements native Spicetify menu registration on builds where it is skipped. */
export function installProfileMenuFallback({
  name,
  icon,
  onOpen,
}: ProfileMenuFallbackOptions): () => void {
  let owned: HTMLLIElement | null = null;
  let disposed = false;
  let unrelatedTrigger = false;

  const removeOwned = () => {
    owned?.remove();
    owned = null;
  };

  const syncMenu = () => {
    if (disposed) return;
    const profile = [...document.querySelectorAll<HTMLElement>(PROFILE_SELECTOR)].find(
      (candidate) => isProfile(candidate) && candidate.getAttribute("aria-expanded") === "true"
    );
    const menu = document.querySelector<HTMLUListElement>(MENU_SELECTOR);
    if (!profile || !menu || unrelatedTrigger || !belongsToProfile(menu, profile)) {
      removeOwned();
      return;
    }
    const rows = [...menu.querySelectorAll<HTMLLIElement>(':scope > li[role="presentation"]')];
    if (rows.some((row) => row !== owned && row.textContent?.trim() === name)) {
      removeOwned();
      return;
    }
    if (owned?.parentElement === menu) return;
    removeOwned();
    const template = rows.find((row) => row.querySelector('[role="menuitem"]'));
    const nativeButton = template?.querySelector<HTMLElement>('[role="menuitem"]');
    if (!template || !nativeButton) return;

    const row = document.createElement("li");
    row.id = "KotobaLyricsSettingsMenuFallback";
    row.className = template.className;
    row.setAttribute("role", "presentation");
    const button = document.createElement("button");
    button.type = "button";
    button.className = nativeButton.className;
    button.setAttribute("role", "menuitem");
    button.tabIndex = -1;
    const label = document.createElement("span");
    label.className = "encore-text-body-small ellipsis-one-line";
    label.dir = "auto";
    label.style.flex = "1";
    label.textContent = name;
    const graphic = new DOMParser().parseFromString(icon, "image/svg+xml").documentElement;
    if (graphic.localName === "svg") {
      graphic.setAttribute("aria-hidden", "true");
      button.append(document.importNode(graphic, true));
    }
    button.append(label);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (disposed || owned !== row || !row.isConnected) return;
      removeOwned();
      if (profile.getAttribute("aria-expanded") === "true") profile.click();
      onOpen();
    });
    row.append(button);
    owned = row;
    const firstNativeRow = rows.find((candidate) =>
      candidate.querySelector('a[role="menuitem"][href]')
    );
    if (firstNativeRow) firstNativeRow.before(row);
    else menu.prepend(row);
  };

  // If another control opens the shared context-menu portal before Spotify has
  // reset the avatar's aria-expanded, do not inject into that unrelated menu.
  const onTrigger = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const candidate = target.closest(PROFILE_SELECTOR);
    if (event.type === "click" && candidate && isProfile(candidate)) unrelatedTrigger = false;
    else if (event.type === "contextmenu" || !target.closest("#context-menu"))
      unrelatedTrigger = true;
    syncMenu();
  };

  const observer = new MutationObserver((records) => {
    if (
      records.some((record) => {
        const target = record.target;
        if (target instanceof Element && (isProfile(target) || target.closest("#context-menu")))
          return true;
        return [...record.addedNodes, ...record.removedNodes].some(
          (node) =>
            node instanceof Element &&
            (node.matches("#context-menu") ||
              node.querySelector("#context-menu") ||
              isProfile(node) ||
              node.querySelector(PROFILE_SELECTOR))
        );
      })
    )
      syncMenu();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-expanded"],
  });
  document.addEventListener("click", onTrigger, true);
  document.addEventListener("contextmenu", onTrigger, true);
  syncMenu();

  return () => {
    disposed = true;
    observer.disconnect();
    document.removeEventListener("click", onTrigger, true);
    document.removeEventListener("contextmenu", onTrigger, true);
    removeOwned();
  };
}
