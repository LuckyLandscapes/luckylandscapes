'use client';

import { useEffect } from 'react';

// Global body-scroll-lock for modals.
//
// Watches the DOM for any element with .modal-overlay (or [role="dialog"])
// and locks body scroll while one is mounted. Unlocks automatically when
// every overlay is gone, even if the modal unmounted abnormally.
//
// One mount in RootProviders covers every modal in the app — individual
// modals do not need to call anything. New modals work for free as long
// as they render a .modal-overlay backdrop.
export default function BodyScrollLock() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const SELECTOR = '.modal-overlay, .sidebar-mobile-overlay, [role="dialog"][aria-modal="true"]';
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
