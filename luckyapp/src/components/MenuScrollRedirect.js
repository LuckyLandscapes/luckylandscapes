'use client';

import { useEffect } from 'react';

// Global wheel-redirect for popup menus.
//
// When a popup menu (anything with [data-menu-scroll]) is mounted,
// any mouse-wheel scroll on the page is redirected into that menu —
// so the user doesn't have to drag the cursor over the dropdown to
// scroll through long lists.
//
// Opt-in: add `data-menu-scroll` to the scrollable container. The
// container needs to be a real overflow-y:auto element. If multiple
// menus are open, the most recently rendered (last in DOM order) wins.
//
// One mount in RootProviders covers every menu in the app. Capture
// phase + passive:false so we beat Google Maps' wheel-zoom handler
// when the dropdown is sitting on top of the map.
export default function MenuScrollRedirect() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const SELECTOR = '[data-menu-scroll]';

    const findOpenMenu = () => {
      const menus = document.querySelectorAll(SELECTOR);
      if (menus.length === 0) return null;
      return menus[menus.length - 1];
    };

    const onWheel = (e) => {
      const menu = findOpenMenu();
      if (!menu) return;
      if (menu.contains(e.target)) return;
      // No overflow → nothing to scroll, let the page handle the wheel
      // event normally so a short list doesn't trap page scroll.
      if (menu.scrollHeight <= menu.clientHeight) return;
      e.preventDefault();
      menu.scrollTop += e.deltaY;
    };

    document.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => document.removeEventListener('wheel', onWheel, { capture: true });
  }, []);

  return null;
}
