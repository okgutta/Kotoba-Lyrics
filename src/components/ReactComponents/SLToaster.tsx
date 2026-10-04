import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { $isGlobalNav } from "../../utils/uiState";
import Logger from "../../utils/Logger";
import { LYRIVA_TOASTER_ID } from "../../utils/notify.ts";

const toasterLogger = new Logger("Toaster");

export default function SLToaster() {
  const [nowPlayingBarHeight, setNowPlayingBarHeight] = useState(0);
  const isGlobalNav = useStore($isGlobalNav);

  useEffect(() => {
    // Spotify 1.3.x drops the mapped class; the wrapper still owns the height.
    const targetElement =
      document.querySelector<HTMLElement>(".Root__now-playing-bar") ??
      document.querySelector<HTMLElement>('[data-testid="now-playing-bar"]')?.parentElement ??
      null;

    if (!targetElement) {
      toasterLogger.warn("Could not find the now playing bar in the DOM");
      return;
    }

    setNowPlayingBarHeight(targetElement.offsetHeight);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setNowPlayingBarHeight((entry.target as HTMLElement).offsetHeight);
      }
    });
    resizeObserver.observe(targetElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [setNowPlayingBarHeight]);

  const bottomOffset = `var(--sltoaster-bottom-padding, ${nowPlayingBarHeight + 16 + (isGlobalNav ? 0 : 8)}px)`;

  return (
    <Toaster
      id={LYRIVA_TOASTER_ID}
      className="sl-toaster"
      containerAriaLabel="Kotoba Lyrics 通知"
      position="bottom-center"
      offset={{ bottom: bottomOffset }}
      mobileOffset={{ bottom: bottomOffset }}
      theme="dark"
      richColors={false}
    />
  );
}
