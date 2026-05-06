'use client';

import { useEffect } from 'react';

// Global body-scroll-lock for modals AND popup menus.
//
// Watches the DOM for any element with .modal-overlay (or [role="dialog"]),
// or any popup with [data-menu-scroll], and locks body scroll while one is
// mounted. Unlocks automatically when every overlay/menu is gone, even if
// it unmounted abnormally.
//
// One mount in RootProviders covers every modal and popup menu in the app
// — individual surfaces do not need to call anything. New modals work for
// free as long as they render a .modal-overlay backdrop; new popup menus
// work as long as they tag the scrollable container with data-menu-scroll.
export default function BodyScrollLock() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const SELECTOR = '.modal-overlay, .sidebar-mobile-overlay, [role="dialog"][aria-modal="true"], [data-menu-scroll]';
    let savedOverflow = '';
    let savedPaddingRight = '';
    let locked = false;

    const lock = () => {
      if (locked) return;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      savedOverflow = document.body.style.overflow;
      savedPaddingRight = document.body.style.paddingRight;
      document.body.style.overflow = 'hidden';
      // Compensate for the scrollbar disappearing so the page doesn't
      // visibly shift when the modal opens.
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      locked = true;
    };

    const unlock = () => {
      if (!locked) return;
      document.body.style.overflow = savedOverflow;
      document.body.style.paddingRight = savedPaddingRight;
      locked = false;
    };

    const sync = () => {
      const hasModal = !!document.querySelector(SELECTOR);
      if (hasModal) lock();
      else unlock();
    };

    // Initial pass — covers SSR-mounted overlays.
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      unlock();
    };
  }, []);

  return null;
}
