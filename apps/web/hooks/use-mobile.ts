import { useCallback, useSyncExternalStore } from "react";

function useMediaQuery(query: string, serverDefault = false) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => serverDefault);
}

const MOBILE_QUERY = `(max-width: ${768 - 1}px)`;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function useIsMobile() {
  return useMediaQuery(MOBILE_QUERY);
}

export function useReducedMotion() {
  return useMediaQuery(REDUCED_MOTION_QUERY);
}
