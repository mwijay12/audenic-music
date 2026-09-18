import { useEffect, useRef } from "react";
import { onBackPress } from "./nativeBridge";

export type UseNavigationHistoryProps = {
  overlay: any;
  setOverlay: (o: any) => void;
  tab: string;
  setTab: (t: any) => void;
  reelsChromeHidden?: boolean;
  setReelsChromeHidden?: (h: boolean) => void;
};

/**
 * Unified Navigation History & Hardware Back Button Hook.
 * Connects React overlay/tab UI state to browser history (pushState/popstate),
 * keyboard Escape key, and Capacitor Android hardware back button.
 */
export function useNavigationHistory({
  overlay,
  setOverlay,
  tab,
  setTab,
  reelsChromeHidden,
  setReelsChromeHidden,
}: UseNavigationHistoryProps) {
  const isPoppingRef = useRef(false);

  // Core back action handler
  const handleBackAction = (): boolean => {
    // 1. Close overlay if open
    if (overlay !== null) {
      setOverlay(null);
      return true;
    }

    // 2. Unhide reels chrome if hidden
    if (reelsChromeHidden) {
      setReelsChromeHidden?.(false);
      return true;
    }

    // 3. Return to home tab if on another tab
    if (tab !== "home") {
      setTab("home");
      return true;
    }

    // 4. At root home view — allow native exit or default browser back
    return false;
  };

  // HTML5 popstate event listener (Browser / PWA)
  useEffect(() => {
    const handlePopState = () => {
      isPoppingRef.current = true;
      handleBackAction();
      setTimeout(() => {
        isPoppingRef.current = false;
      }, 50);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [overlay, tab, reelsChromeHidden]);

  // Keyboard Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleBackAction();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [overlay, tab, reelsChromeHidden]);

  // Capacitor Native Android Hardware Back Button listener
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    onBackPress(() => {
      return handleBackAction();
    }).then((unsub) => {
      cleanup = unsub;
    });

    return () => {
      cleanup?.();
    };
  }, [overlay, tab, reelsChromeHidden]);

  // Sync state changes into browser history (pushState)
  useEffect(() => {
    if (isPoppingRef.current) return;
    if (overlay !== null) {
      try {
        window.history.pushState({ overlay, tab }, "", window.location.pathname);
      } catch {
        /* ignore history state quota errors */
      }
    }
  }, [overlay]);
}
