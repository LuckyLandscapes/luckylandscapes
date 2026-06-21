/* ============================================
   LUCKY LANDSCAPES — Main JavaScript
   ============================================ */

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// ============================================
// SCROLL TO TOP ON PAGE LOAD
// ============================================
// Prevent browser from restoring previous scroll position
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

// ============================================
// LENIS SMOOTH SCROLL
// ============================================
// Mobile/touch devices use native scroll. Lenis on touch caused a major
// bug where ScrollTrigger updates were chained through gsap.ticker → lenis.raf,
// and iOS Safari pauses rAF during momentum scrolling, so animations would
// freeze for 5-7 seconds until the flick settled. Native scroll on mobile
// fires scroll events directly to ScrollTrigger and IntersectionObserver.
const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches
    || ('ontouchstart' in window && window.innerWidth <= 1024);

let lenis;
if (!isTouchDevice) {
    lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 2,
    });

    // Sync Lenis with GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
} else {
    // Stub so the rest of the code can call lenis.* without branching.
    // Native scroll handles wheel/touch; ScrollTrigger listens to window scroll directly.
    lenis = {
        scrollTo(target, opts = {}) {
            const offset = opts.offset || 0;
            let top = 0;
            if (typeof target === 'number') {
                top = target + offset;
            } else if (target instanceof Element) {
                top = target.getBoundingClientRect().top + window.scrollY + offset;
            } else if (typeof target === 'string') {
                const el = document.querySelector(target);
                if (!el) return;
                top = el.getBoundingClientRect().top + window.scrollY + offset;
            }
            window.scrollTo({ top, behavior: opts.immediate ? 'auto' : 'smooth' });
        },
        stop() {
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
        },
        start() {
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
        },
        on() {},
        raf() {},
        destroy() {},
    };
    // Don't enable ScrollTrigger.normalizeScroll on touch — it intercepts touch
    // events globally and can break the before/after slider drag and carousel
    // swipe handlers below. Modern iOS Safari fires native scroll events
    // continuously enough that ScrollTrigger updates correctly without it.
    ScrollTrigger.config({ ignoreMobileResize: true });
}

// ============================================
// PRELOADER (removed at build time by scripts/inject-head.js, but the .loaded
// class is added unconditionally below in case any CSS still keys off it).
// ============================================
const preloader = document.getElementById('preloader');
if (preloader) {
    window.addEventListener('load', () => {
        setTimeout(() => {
            preloader.classList.add('done');
            document.body.classList.add('loaded');
        }, 800);
    });
    // Fallback: hide preloader after 4s even if load event doesn't fire
    setTimeout(() => {
        preloader.classList.add('done');
        document.body.classList.add('loaded');
    }, 4000);
}
document.body.classList.add('loaded');

// ============================================
// SCROLLTRIGGER REFRESH — KEY MOBILE FIX
// ============================================
// On mobile, images and fonts often arrive AFTER ScrollTrigger has calculated
// where each trigger lives in the document. When images then load, every
// section below them shifts down — but ScrollTrigger still thinks the trigger
// is at its old y-position. Result: user scrolls to a section, but
// ScrollTrigger thinks they're somewhere else and never fires the animation.
// (User-reported symptom: "thinks I'm looking at a different part of the page".)
//
// Fix: refresh ScrollTrigger every time content might have shifted layout —
// after window.load, after each image loads, on resize, and on orientation change.
let stRefreshScheduled = false;
function scheduleScrollTriggerRefresh() {
    if (stRefreshScheduled) return;
    stRefreshScheduled = true;
    requestAnimationFrame(() => {
        ScrollTrigger.refresh();
        stRefreshScheduled = false;
    });
}

// 1. Refresh once after the window 'load' event (all initial images parsed).
window.addEventListener('load', () => {
    ScrollTrigger.refresh();
    // And again after a tick, since iOS sometimes finishes layout slightly
    // after 'load' fires.
    setTimeout(() => ScrollTrigger.refresh(), 300);
});

// 2. Refresh whenever any image finishes loading (covers lazy-loaded gallery
//    images that arrive long after window.load).
document.addEventListener('load', (e) => {
    if (e.target && e.target.tagName === 'IMG') scheduleScrollTriggerRefresh();
}, true);  // capture phase — image 'load' events don't bubble

// 3. Refresh on viewport changes (orientation change, mobile keyboard).
window.addEventListener('resize', scheduleScrollTriggerRefresh, { passive: true });
window.addEventListener('orientationchange', scheduleScrollTriggerRefresh, { passive: true });

// ============================================
// ANALYTICS — thin wrapper that no-ops when GA4/Clarity aren't loaded yet
// ============================================
function trackEvent(name, params = {}) {
    try {
        if (typeof window.gtag === 'function') {
            window.gtag('event', name, params);
        }
        if (window.clarity && typeof window.clarity === 'function') {
            window.clarity('set', name, JSON.stringify(params));
        }
    } catch (_) { /* never let analytics break the page */ }
}

// ============================================
// CLOUDFLARE TURNSTILE — anti-bot widget on forms (lazy-loaded)
// ============================================
// Was eager-loading on every page that had a `.cf-turnstile-mount` element,
// including the homepage's contact section. On iOS WKWebView, Turnstile's
// failure_retry loop runs in a tight cycle that starves the main thread for
// 8–12 seconds, leaving below-the-fold sections un-painted. Defer the load
// until the user actually focuses on a form input — at that point the form
// is being filled out, the widget can verify in the background, and the
// initial render is no longer blocked.
(function setupTurnstileLazy() {
    const key = (window.LL_CONFIG && window.LL_CONFIG.turnstile) || '';
    if (!key) return;
    const mounts = document.querySelectorAll('.cf-turnstile-mount');
    if (mounts.length === 0) return;
    const formInputs = document.querySelectorAll('form input, form textarea, form select');
    if (formInputs.length === 0) return;

    let loaded = false;
    function loadTurnstile() {
        if (loaded) return;
        loaded = true;
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__llTurnstileReady';
        s.async = true;
        s.defer = true;
        window.__llTurnstileReady = function () {
            mounts.forEach(m => {
                if (m.dataset.rendered) return;
                m.dataset.rendered = '1';
                window.turnstile && window.turnstile.render(m, { sitekey: key, theme: 'light', size: 'normal' });
            });
        };
        document.head.appendChild(s);
    }

    formInputs.forEach(el => el.addEventListener('focus', loadTurnstile, { once: true, passive: true }));
})();

// ============================================
// NAVBAR SCROLL EFFECT
// ============================================
const navbar = document.getElementById('navbar');
const isTeamPage = window.location.pathname.includes('team');
const isSubPage = window.location.pathname.includes('services/') || window.location.pathname.includes('gallery') || window.location.pathname.includes('careers') || window.location.pathname.includes('privacy') || window.location.pathname.includes('terms');

function handleNavScroll() {
    if (isTeamPage || isSubPage) return; // Sub-pages nav is always scrolled
    if (window.scrollY > 60) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
}

if (navbar) {
    window.addEventListener('scroll', handleNavScroll, { passive: true });
    handleNavScroll();
}

// ============================================
// STICKY MOBILE CTA BAR
// ============================================
const stickyMobileCta = document.getElementById('sticky-mobile-cta');
if (stickyMobileCta) {
    let stickyVisible = false;
    function handleStickyCta() {
        // Visible from load (no scroll gate) — a visitor who lands and never
        // scrolls still needs a one-tap call path. Hides only over the footer.
        const footer = document.querySelector('.footer');
        const footerTop = footer ? footer.getBoundingClientRect().top : Infinity;
        const shouldShow = footerTop > window.innerHeight;

        if (shouldShow && !stickyVisible) {
            stickyMobileCta.classList.add('visible');
            stickyVisible = true;
        } else if (!shouldShow && stickyVisible) {
            stickyMobileCta.classList.remove('visible');
            stickyVisible = false;
        }
    }
    window.addEventListener('scroll', handleStickyCta, { passive: true });
    handleStickyCta();
}

// ============================================
// MOBILE MENU
// ============================================
const navToggle = document.getElementById('nav-toggle');
const mobileMenu = document.getElementById('mobile-menu');
const mobileOverlay = document.getElementById('mobile-overlay');
const mobileLinks = document.querySelectorAll('.mobile-link, .mobile-cta-btn');

function openMenu() {
    navToggle.classList.add('active');
    mobileMenu.classList.add('open');
    mobileOverlay.classList.add('open');
    lenis.stop();
}

function closeMenu() {
    navToggle.classList.remove('active');
    mobileMenu.classList.remove('open');
    mobileOverlay.classList.remove('open');
    lenis.start();
}

if (navToggle) {
    navToggle.addEventListener('click', () => {
        mobileMenu.classList.contains('open') ? closeMenu() : openMenu();
    });
}

if (mobileOverlay) {
    mobileOverlay.addEventListener('click', closeMenu);
}

mobileLinks.forEach(link => {
    link.addEventListener('click', closeMenu);
});

// ============================================
// SMOOTH SCROLL FOR ANCHOR LINKS
// ============================================
// Handle both #hash and /#hash links (the latter is used in nav links)
const isHomePage = window.location.pathname === '/' || window.location.pathname === '/index.html';

// If a sub-page link like "/#about" or "/services/lawn-care.html#contact" lands
// here with a hash in the URL, browsers usually jump there but Lenis prevents
// the native scroll from sticking. Smooth-scroll to the target after layout.
if (window.location.hash) {
    const hashTarget = document.querySelector(window.location.hash);
    if (hashTarget) {
        // Wait one frame so Lenis is initialized and layout is settled.
        requestAnimationFrame(() => {
            const navH = document.querySelector('.navbar')?.offsetHeight || 80;
            lenis.scrollTo(hashTarget, { offset: -navH - 10, duration: 1.0, immediate: false });
        });
    }
}

document.querySelectorAll('a[href^="#"], a[href^="/#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#' || !href) return;

        // Extract the hash part: "/#about" → "#about", "#about" → "#about"
        const hash = href.startsWith('/#') ? href.slice(1) : href;

        // Only smooth-scroll if we're already on the homepage
        if (hash.startsWith('#') && isHomePage) {
            const target = document.querySelector(hash);
            if (target) {
                e.preventDefault();
                // Close mobile menu if open
                if (mobileMenu && mobileMenu.classList.contains('open')) closeMenu();
                const navH = navbar ? navbar.offsetHeight : 80;
                lenis.scrollTo(target, { offset: -navH - 10, duration: 1.4 });
                // Update URL without reloading
                history.pushState(null, '', hash);
            }
        }
    });
});

// ============================================
// SCROLL REVEAL (IntersectionObserver)
// ============================================
// Includes .hero-content because Firefox iOS (and occasionally other WKWebView
// surfaces) sometimes never auto-starts CSS animations at parse time, leaving
// content with `from { opacity: 0 }` stuck invisible. The .revealed class has
// !important rules in styles.css that force opacity:1 + transform:none, so
// adding it kicks content visible regardless of whether the animation ran.
const revealEls = document.querySelectorAll(
    '.reveal, .reveal-left, .reveal-right, .reveal-scale, .stagger-children, .hero-content'
);

// Looser thresholds + positive bottom rootMargin so reveals fire as soon as
// any pixel of the element enters the viewport — important on mobile where
// fast flicks otherwise blow past the trigger before it fires.
const revealObs = new IntersectionObserver(
    (entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                revealObs.unobserve(entry.target);
            }
        });
    },
    { threshold: 0.01, rootMargin: '0px 0px 100px 0px' }
);

revealEls.forEach(el => revealObs.observe(el));

// Failsafe: force-reveal every .reveal* element after 1.2 seconds, regardless
// of scroll position. 1.2s is just longer than the longest staged animation
// (.8s + .48s stagger delay = 1.28s) so on healthy browsers the failsafe is
// a no-op (animation already finished). On Firefox iOS where the animation
// never started, this is what un-blanks the page — without it, sections stay
// invisible for 8–12 seconds (or until the user manually scrolls into them).
function forceRevealAll() {
    revealEls.forEach(el => {
        el.classList.add('revealed');
        try { revealObs.unobserve(el); } catch (_) {}
    });
}
setTimeout(forceRevealAll, 1200);

// bfcache restore (Safari/Firefox/Chrome iOS all fire pageshow with
// event.persisted=true when the user hits Back from a sub-page). On restore,
// CSS animations don't replay and any pending setTimeout from the previous
// lifecycle is gone — so without this handler, content can be left stuck at
// `from { opacity: 0 }` after Back navigation. Force-reveal immediately.
window.addEventListener('pageshow', (event) => {
    if (event.persisted) forceRevealAll();
});

// ============================================
// GSAP — HERO PARALLAX
// ============================================
// Safe to keep: gsap.to() — element starts at its natural position. If
// ScrollTrigger never fires, the video just sits still (no parallax) but is
// fully visible.
const heroVideoWrap = document.querySelector('.hero-video-wrap');
if (heroVideoWrap) {
    gsap.to(heroVideoWrap, {
        yPercent: 30,
        ease: 'none',
        scrollTrigger: {
            trigger: '.hero',
            start: 'top top',
            end: 'bottom top',
            scrub: true,
        },
    });
}

// ============================================
// GSAP — STAT NUMBER COUNTERS
// ============================================
// Animates any <span class="stat-number" data-count="N">0</span> from 0 up
// to N when the element scrolls into view. The HTML on team.html (and any
// future page using the same pattern) ships the start value 0 so the page
// is intelligible without JS — the animation just adds polish.
//
// `once: true` means the counter fires exactly once per element and never
// resets on scroll-up. Reduced-motion users skip the tween entirely and get
// the final value instantly.
const statNumbers = document.querySelectorAll('.stat-number[data-count]');
if (statNumbers.length > 0) {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    statNumbers.forEach(el => {
        const target = parseFloat(el.dataset.count);
        if (!Number.isFinite(target)) return;
        // Decimal targets (e.g. "4.9") render with one decimal place; integer
        // targets render as whole numbers so "5" doesn't show "5.0".
        const isDecimal = !Number.isInteger(target);
        const format = v => isDecimal ? v.toFixed(1) : String(Math.round(v));
        if (reduceMotion) {
            el.textContent = format(target);
            return;
        }
        const counter = { value: 0 };
        gsap.to(counter, {
            value: target,
            duration: 1.8,
            ease: 'power2.out',
            scrollTrigger: {
                trigger: el,
                start: 'top 88%',
                once: true,
            },
            onUpdate: () => { el.textContent = format(counter.value); },
        });
    });
}

// ============================================
// GSAP — TEAM CARDS
// ============================================
const teamCards = document.querySelectorAll('.team-card');
if (teamCards.length > 0 && window.innerWidth > 768) {
    teamCards.forEach((card, i) => {
        gsap.from(card, {
            x: i % 2 === 0 ? -40 : 40,
            duration: 0.8,
            ease: 'power2.out',
            scrollTrigger: {
                trigger: card,
                start: 'top 88%',
                toggleActions: 'play none none none',
            },
        });
    });
}

// ============================================
// GSAP — CTA SECTION PARALLAX
// ============================================
const ctaSection = document.querySelector('.cta-section');
if (ctaSection && window.innerWidth > 768) {
    gsap.from('.cta-info', {
        x: -60,
        duration: 1,
        ease: 'power2.out',
        scrollTrigger: {
            trigger: ctaSection,
            start: 'top 70%',
            toggleActions: 'play none none none',
        },
    });

    gsap.from('.contact-form-card', {
        x: 60,
        duration: 1,
        ease: 'power2.out',
        scrollTrigger: {
            trigger: ctaSection,
            start: 'top 70%',
            toggleActions: 'play none none none',
        },
    });
}

// ============================================
// ACTIVE NAV LINK ON SCROLL
// ============================================
if (!isTeamPage) {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');

    const sectionObs = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    navLinks.forEach(link => {
                        link.classList.remove('active');
                        const href = link.getAttribute('href');
                        if (href === `#${id}` || href === `/#${id}`) {
                            link.classList.add('active');
                        }
                    });
                }
            });
        },
        { threshold: 0.3, rootMargin: '-80px 0px -40% 0px' }
    );

    sections.forEach(s => sectionObs.observe(s));
}

// ============================================
// APPS SCRIPT URLs — Replace with your deployed URLs
// ============================================
const CONTACT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyJYOqTwi-6KdPaR6oPBN9Tn1PBpcq_67rn7bPtsXwV3HTOFVSuIUGAXbX36CyN0ct59A/exec';
const CAREERS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxFi4x3V_BUkDCfHrx6UXmTBb3VhOGYt2crQeaNDUd9KWqCSmih7yjfUJ2m0don0fSr/exec';

// ============================================
// CONTACT FORM HANDLER
// ============================================
const contactForm = document.getElementById('contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(contactForm).entries());

        if (!data.firstName || !data.email) {
            alert('Please fill in at least your name and email.');
            return;
        }

        const btn = contactForm.querySelector('.form-submit');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<span class="spinner"></span> Sending...';
        btn.classList.add('loading');
        btn.disabled = true;

        try {
            // Primary: luckyapp lead intake (readable response — we only show
            // success if the server actually accepted the lead). The old
            // Apps Script no-cors path claimed "✓ Sent!" unconditionally,
            // which silently swallowed leads whenever the script broke.
            const leadPayload = {
                firstName: data.firstName,
                lastName: data.lastName || '',
                email: data.email,
                phone: data.phone || '',
                category: 'other',
                categoryLabel: data.service || 'General Contact',
                project_description: [data.message, data.service ? `Service interested in: ${data.service}` : '']
                    .filter(Boolean).join('\n') || 'Contact form message (no message text)',
                source_form: 'homepage_contact_modal',
            };
            const turnstileResp = contactForm.querySelector('[name="cf-turnstile-response"]');
            if (turnstileResp && turnstileResp.value) leadPayload.turnstile_token = turnstileResp.value;

            const res = await fetch(LEADS_INTAKE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(leadPayload),
            });
            if (!res.ok) throw new Error(`Lead intake responded ${res.status}`);

            // Best-effort backup: legacy Apps Script sheet (fire-and-forget).
            if (CONTACT_SCRIPT_URL) {
                const params = new URLSearchParams();
                for (const [key, value] of Object.entries(data)) params.append(key, value);
                fetch(CONTACT_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: params }).catch(() => { });
            }

            trackEvent('contact_submit', { service: data.service || 'none' });
            btn.innerHTML = '✓ Request Sent!';
            btn.classList.remove('loading');
            btn.classList.add('success');
            contactForm.reset();

            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.classList.remove('success');
                btn.disabled = false;
            }, 4000);
        } catch (err) {
            console.error('Contact form submission failed:', err);
            btn.innerHTML = '✕ Error — try again or call (402) 405-5475';
            btn.classList.remove('loading');
            btn.classList.add('error');

            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.classList.remove('error');
                btn.disabled = false;
            }, 4000);
        }
    });
}

// ============================================
// SERVICE DROPDOWN → INSTANT QUOTE REDIRECT
// ============================================
const serviceSelect = document.getElementById('service');
if (serviceSelect) {
    const serviceRoutes = {
        'Mowing & Maintenance': 'lawn',
        'Garden Beds / Mulch': 'garden',
        'Plant Transplants': 'garden',
        'Junk Removal': 'cleanup',
        'Leaf Removal': 'cleanup',
        'Paver Project': 'hardscape',
        'Retaining Wall': 'hardscape',
        'Full Landscape Design': 'design',
    };
    serviceSelect.addEventListener('change', () => {
        const route = serviceRoutes[serviceSelect.value];
        if (route) {
            // Carry anything already typed into the quote form's autosave so
            // the redirect doesn't discard the visitor's input.
            try {
                const fd = Object.fromEntries(new FormData(contactForm).entries());
                const stash = { savedAt: Date.now() };
                if (fd.firstName) stash.firstName = fd.firstName;
                if (fd.lastName) stash.lastName = fd.lastName;
                if (fd.email) stash.email = fd.email;
                if (fd.phone) stash.phone = fd.phone;
                if (fd.message) stash.project_description = fd.message;
                if (Object.keys(stash).length > 1) {
                    localStorage.setItem('lucky_quote_partial', JSON.stringify(stash));
                }
            } catch (_) { }
            // Clean URL — /quote.html eats a 308 redirect on CF Pages.
            window.location.href = `/quote?category=${route}`;
        }
    });
}

// ============================================
// GENERAL CONTACT FORM MODAL
// ============================================
const generalFormModal = document.getElementById('general-form-modal');
const openFormBtn = document.getElementById('open-general-form');
const closeFormBtn = document.getElementById('gfm-close');
const gfmBackdrop = document.getElementById('gfm-backdrop');

function openGeneralForm() {
    if (generalFormModal) {
        generalFormModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeGeneralForm() {
    if (generalFormModal) {
        generalFormModal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

if (openFormBtn) openFormBtn.addEventListener('click', openGeneralForm);
if (closeFormBtn) closeFormBtn.addEventListener('click', closeGeneralForm);
if (gfmBackdrop) gfmBackdrop.addEventListener('click', closeGeneralForm);

// ============================================
// CAREERS FORM HANDLER
// ============================================
const careersForm = document.getElementById('careers-form');
if (careersForm) {
    careersForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(careersForm);
        const data = Object.fromEntries(formData.entries());

        if (!data.fullName || !data.email) {
            alert('Please fill in at least your name and email.');
            return;
        }

        const btn = careersForm.querySelector('.form-submit');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<span class="spinner"></span> Submitting...';
        btn.classList.add('loading');
        btn.disabled = true;

        try {
            // Build URLSearchParams so that data survives no-cors mode
            // (JSON content-type is not a "simple" header and gets stripped)
            const params = new URLSearchParams();
            // Add all text fields
            for (const [key, value] of Object.entries(data)) {
                if (key !== 'resume') {
                    params.append(key, value);
                }
            }

            // Handle resume file — convert to base64 for Apps Script
            const resumeFile = careersForm.querySelector('#resume').files[0];
            if (resumeFile) {
                const reader = new FileReader();
                const base64 = await new Promise((resolve, reject) => {
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(resumeFile);
                });
                params.append('resumeData', base64);
                params.append('resumeName', resumeFile.name);
                params.append('resumeType', resumeFile.type);
            }

            await fetch(CAREERS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: params,
            });

            trackEvent('careers_submit', { position: data.position || 'unspecified' });
            btn.innerHTML = '✓ Application Sent!';
            btn.classList.remove('loading');
            btn.classList.add('success');
            careersForm.reset();

            // Clear file input label
            const fileLabel = careersForm.querySelector('.file-name');
            if (fileLabel) fileLabel.textContent = 'No file chosen';

            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.classList.remove('success');
                btn.disabled = false;
            }, 4000);
        } catch (err) {
            btn.innerHTML = '✕ Error — try again';
            btn.classList.remove('loading');
            btn.classList.add('error');

            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.classList.remove('error');
                btn.disabled = false;
            }, 3000);
        }
    });

    // Custom file input display
    const resumeInput = document.getElementById('resume');
    if (resumeInput) {
        resumeInput.addEventListener('change', () => {
            const label = careersForm.querySelector('.file-name');
            if (label) {
                label.textContent = resumeInput.files.length > 0
                    ? resumeInput.files[0].name
                    : 'No file chosen';
            }
        });
    }
}

// ============================================
// MAGNETIC CURSOR ON BUTTONS (desktop only)
// ============================================
if (window.innerWidth > 768) {
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            gsap.to(btn, { x: x * 0.15, y: y * 0.15, duration: 0.3, ease: 'power2.out' });
        });

        btn.addEventListener('mouseleave', () => {
            gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
        });
    });
}

// ============================================
// PROJECT LIGHTBOX / GALLERY — Data-driven system
// ============================================
// ► TO ADD/REMOVE/REORDER PROJECTS: just edit this array.
//   The gallery grid AND lightbox are auto-generated from it.
//   Each image can optionally have a mobile variant (for <1024px).
//   If no mobile variant is provided, the desktop image is used.
// `projectData` is the in-memory portfolio that drives the homepage Featured
// Work grid + the /gallery page (categories landing + per-category detail).
//
// On page load we fetch /api/marketing/gallery from luckyapp. If it returns
// any published photos, the entire array is REPLACED with the remote items
// (no merging). The hardcoded entries below are the bootstrap + outage
// fallback — they're what visitors see while the fetch is in flight, OR
// when luckyapp is unreachable, OR when luckyapp has zero published photos.
//
// IMPORTANT: do not delete the static entries even after Riley has imported
// the legacy portfolio. They're the resilience layer that keeps the public
// site working during luckyapp outages or a temporary Supabase issue.
// See loadMarketingGalleryFromLuckyapp() below for the wire-up.
let projectData = [
    {
        title: 'Custom Built Deck',
        tag: 'Construction',
        cover: 1, // index of the image shown in the gallery grid
        desc: 'A custom composite deck with a contrasting picture-frame border, built to extend this family\'s living space into the backyard.',
        images: [
            '/images/megandeck/1.webp',
            '/images/megandeck/2.webp',
        ],
        inProgress: true,
    },
    {
        title: 'Retaining Walls',
        tag: 'Hardscaping',
        cover: 4,
        desc: 'A block retaining wall built to stop erosion and square up the grade — set on a compacted base with clean cap courses, so it stays plumb through freeze-thaw.',
        images: [
            '/images/retainingwall/1-1.webp',
            '/images/retainingwall/1-2.webp',
            '/images/retainingwall/1-3.webp',
            '/images/retainingwall/1-4.webp',
            '/images/retainingwall/1-5.webp',
        ],
    },
    {
        title: 'Lawn Maintenance',
        tag: 'Maintenance',
        cover: 0,
        desc: 'Weekly maintenance on a set route: mowing, crisp edging along every walk and bed, trimming, blowing, and hedge work — the same crew each visit.',
        images: [
            '/images/lawncare/1.webp',
            '/images/lawncare/2.webp',
            '/images/lawncare/3.webp',
            '/images/lawncare/4.webp',
            '/images/lawncare/5.webp',
            '/images/lawncare/6.webp',
        ],
    },
    {
        title: 'Outdoor Fireplace',
        tag: 'Hardscaping',
        cover: 0,
        desc: 'An outdoor fireplace and surround laid course by course — the anchor of this backyard\'s gathering space, built to handle Nebraska winters.',
        images: [
            '/images/fireplace/1.jpg',
        ],
    },
    {
        title: 'Garden Beds',
        tag: 'Landscaping',
        cover: 1,
        desc: 'Fresh-cut bed lines, new plantings, and a clean mulch finish that frames the house instead of fighting it.',
        images: [
            '/images/mulchgardenbeds/1.webp',
            '/images/mulchgardenbeds/2.jpg',
        ],
    },
    {
        title: 'Design & Build',
        tag: 'Landscaping',
        cover: 0,
        desc: 'A full design-and-build: layout, plant selection, and installation handled by the same crew from the first sketch to the final walkthrough.',
        images: [
            '/images/landscapedesign/3.webp',
            '/images/landscapedesign/1.webp',
            '/images/landscapedesign/2.webp',
        ],
    },
    {
        title: 'Lawn Restoration',
        tag: 'Seasonal Cleanup',
        cover: 0,
        desc: 'A thorough lawn cleanup that removed weeds, debris, and overgrowth from the yard, leaving it looking fresh and inviting. See the dramatic before-and-after transformation.',
        beforeAfter: true,
        images: [
            '/images/LawnRestore/before.webp',
            '/images/LawnRestore/after.webp',
        ],
    },
    {
        title: 'Brick Garden Walls',
        tag: 'Hardscaping',
        cover: 2,
        desc: 'This brick garden wall solved a significant grading challenge while adding striking visual appeal. Built with precision to withstand the elements and elevate the landscape.',
        images: [
            '/images/bricklaying/1.webp',
            '/images/bricklaying/2.webp',
            '/images/bricklaying/3.webp',
        ],
    },
    {
        title: 'Front Yard Beds',
        tag: 'Landscaping',
        cover: 1,
        desc: 'Complete front yard garden bed installation featuring fresh mulch, clean edging, and carefully selected plantings that bring year-round curb appeal.',
        images: [
            '/images/gardenbed/1.webp',
            '/images/gardenbed/2.webp',
            '/images/gardenbed/3.webp',
            '/images/gardenbed/4.webp',
        ],
    },
];

// ============================================
// AUTO-GENERATE GALLERY GRID
// ============================================
const galleryGrid = document.getElementById('gallery-grid');

function getImageSrc(img) {
    // img can be a string (simple path) or an object { desktop, mobile }
    if (typeof img === 'string') return img;
    const isMobile = window.innerWidth <= 1024;
    return (isMobile && img.mobile) ? img.mobile : img.desktop;
}

// Indices into projectData for the homepage "Featured Work" grid (max 6).
// These hardcoded indices ONLY apply while the static fallback is showing
// (luckyapp unreachable, or no photos uploaded yet). As soon as remote data
// arrives, loadMarketingGalleryFromLuckyapp() rebuilds this list from the
// remote items, prioritizing any photo Riley starred as featured in the
// luckyapp manage view.
let homepageFeatured = [1, 5, 6, 3, 2, 4];

function buildGalleryGrid() {
    if (!galleryGrid) return;
    galleryGrid.innerHTML = '';

    // Homepage shows curated subset; gallery page shows all via buildCollectionGrid
    const featured = homepageFeatured;

    featured.forEach((index) => {
        const project = projectData[index];
        if (!project) return;
        const coverIdx = project.cover ?? 0;
        const coverImg = project.images[coverIdx] ?? project.images[0];
        const src = getImageSrc(coverImg);

        const card = document.createElement('div');
        card.className = 'collection-card';
        card.dataset.project = index;

        // Determine badge text
        let badgeText = '';
        if (project.beforeAfter) {
            badgeText = 'Before & After';
        } else if (project.images.length > 1) {
            badgeText = `${project.images.length} Photos`;
        } else {
            badgeText = '1 Photo';
        }

        // In Progress chip
        let chipHtml = '';
        if (project.inProgress) {
            chipHtml = '<div class="gallery-progress-chip"><span class="gallery-progress-dot"></span> In Progress</div>';
        }

        const title = prettyTitle(project);
        const titleHtml = title ? `<h3 class="collection-card-title">${escapeHtml(title)}</h3>` : '';
        const tagText = escapeHtml(project.tag || 'Project');
        const altText = escapeHtml(title || project.tag || 'Lucky Landscapes project');

        card.innerHTML = `
            ${chipHtml}
            <img src="${escapeHtml(src)}" alt="${altText}" loading="lazy" class="collection-card-img"
                 onerror="this.onerror=null;this.src='/images/banner.jpg';this.classList.add('is-fallback');" />
            <div class="collection-card-overlay">
                <div class="collection-card-bottom">
                    <span class="collection-card-tag">${tagText}</span>
                    ${titleHtml}
                </div>
                <span class="collection-card-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    ${badgeText}
                </span>
            </div>
        `;

        galleryGrid.appendChild(card);
    });
}

buildGalleryGrid();

// ============================================
// SERVICE-PAGE GALLERY STRIP
// ============================================
// Service pages (hardscaping / design / garden) can include a
// <div class="collection-grid" id="svc-gallery-grid" data-svc-category="A,B,C">.
// We fill it with up to 6 projectData cards whose tag/tags match any of the
// comma-separated category keywords (case-insensitive, substring either way).
// Cards link straight to /gallery (service pages don't mount the lightbox).
// The whole section is hidden if nothing matches, so the page never shows an
// empty grid. Re-runs after the luckyapp remote fetch replaces projectData.
function buildServiceGallery() {
    const grid = document.getElementById('svc-gallery-grid');
    if (!grid) return;
    const section = document.getElementById('svc-gallery-section');
    const wanted = (grid.dataset.svcCategory || '')
        .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

    const picks = (wanted.length ? projectData.filter((p) => {
        const tags = [p.tag, ...(p.tags || [])].filter(Boolean).map((t) => String(t).toLowerCase());
        return tags.some((t) => wanted.some((w) => t.includes(w) || w.includes(t)));
    }) : []).slice(0, 6);

    if (!picks.length) {
        if (section) section.style.display = 'none';
        return;
    }
    if (section) section.style.display = '';

    grid.innerHTML = picks.map((project) => {
        const coverIdx = project.cover ?? 0;
        const coverImg = (project.images && (project.images[coverIdx] ?? project.images[0])) || '/images/banner.jpg';
        const src = getImageSrc(coverImg);
        const badgeText = project.beforeAfter ? 'Before & After'
            : (project.images && project.images.length > 1) ? `${project.images.length} Photos` : '1 Photo';
        const title = prettyTitle(project);
        const titleHtml = title ? `<h3 class="collection-card-title">${escapeHtml(title)}</h3>` : '';
        const tagText = escapeHtml(project.tag || 'Project');
        const altText = escapeHtml(title || project.tag || 'Lucky Landscapes project');
        return `
            <a class="collection-card" href="/gallery" aria-label="See more projects in our gallery">
                <img src="${escapeHtml(src)}" alt="${altText}" loading="lazy" class="collection-card-img"
                     onerror="this.onerror=null;this.src='/images/banner.jpg';this.classList.add('is-fallback');" />
                <div class="collection-card-overlay">
                    <div class="collection-card-bottom">
                        <span class="collection-card-tag">${tagText}</span>
                        ${titleHtml}
                    </div>
                    <span class="collection-card-badge">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                        ${badgeText}
                    </span>
                </div>
            </a>`;
    }).join('');
}

buildServiceGallery();

// ============================================
// MARKETING GALLERY — REMOTE FETCH FROM LUCKYAPP
// ============================================
// Pulls live photos from /api/marketing/gallery (managed in luckyapp via
// the Marketing Gallery page) and REPLACES the static projectData seed when
// any photos come back. The static portfolio above is only the bootstrap +
// outage fallback — it is never merged on top of remote data.
//
// Why replace instead of merge: the /import-legacy endpoint copies the same
// 9 hardcoded projects into Supabase as one-time seed data. If we merged
// remote + static, every imported project would render twice on the public
// site. With remote-wins, luckyapp is the single source of truth as soon as
// it has any photos, and the static fallback only shows when:
//   • luckyapp is unreachable (network error, DNS, server down), or
//   • luckyapp returns 0 published items (fresh install / nothing imported).
//
// Endpoint shape: { items: [{ title, description, tags, imageUrl,
//                              beforeImageUrl, isBeforeAfter, isFeatured,
//                              projectName, width, height, createdAt }] }
// Items arrive pre-sorted by (sort_order ASC, created_at DESC), so the
// conversion below preserves that order — Riley's drag-to-reorder in the
// manage view is what controls public display order.
//
// Vercel edge caches the response for 60s + stale-while-revalidate 5min,
// so updates land on the site in about a minute without us doing anything.

const MARKETING_GALLERY_URL = 'https://app.luckylandscapes.com/api/marketing/gallery';

// Category metadata from luckyapp's /api/marketing/gallery response. Each
// entry: { name, displayName, coverImageUrl, icon, sortOrder }. ONLY visible
// categories are included (Riley toggles per-category in the Manage Categories
// modal). Empty array means he hasn't curated yet → public site falls back
// to auto-derive (every unique tag becomes a tile, current behavior).
let remoteCategories = [];

// Convert the remote API response into the projectData shape the rendering
// code already understands. Single rows become single cards; rows sharing
// a `projectName` collapse into ONE card whose lightbox carousels through
// every photo in that project (preserves arrival order).
//
// Cover photo within a group: any row with `isCover: true` wins. If none
// of the group's rows are flagged (e.g. legacy data pre-migration 042),
// fall back to the first photo. Cover is stored as an INDEX into the
// `images` array (not a separate URL) so all the existing rendering code
// — homepage grid, gallery cards, lightbox — keeps working unchanged.
function buildProjectsFromRemoteItems(remote) {
    const projects = [];
    const projectByName = new Map();

    remote.forEach(item => {
        if (item.projectName) {
            // Multi-photo project — append into the existing group or start one.
            let group = projectByName.get(item.projectName);
            if (!group) {
                group = {
                    title: item.projectName,
                    tag: null,
                    tags: [],
                    desc: '',
                    cover: 0,
                    images: [],
                    imageDescs: [],
                    beforeAfter: false,
                    featured: false,
                    source: 'remote',
                };
                projectByName.set(item.projectName, group);
                projects.push(group);
            }
            const idxInGroup = group.images.length;
            group.images.push(item.imageUrl);
            group.imageDescs.push(item.description || '');
            if (item.isCover) group.cover = idxInGroup;
            if (!group.desc && item.description) group.desc = item.description;
            if (item.isFeatured) group.featured = true;
            if (Array.isArray(item.tags)) {
                item.tags.forEach(t => {
                    if (t && !group.tags.includes(t)) group.tags.push(t);
                });
            }
            if (!group.tag && group.tags.length) group.tag = group.tags[0];
        } else {
            // Standalone photo — single-card project. Before/after pairs put
            // the "before" first so the lightbox slider initializes correctly.
            const tags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
            const isBA = !!item.beforeImageUrl;
            projects.push({
                title: item.title || 'Untitled project',
                tag: tags[0] || 'Project',
                tags,
                desc: item.description || '',
                cover: isBA ? 1 : 0,
                images: isBA ? [item.beforeImageUrl, item.imageUrl] : [item.imageUrl],
                imageDescs: isBA ? ['', item.description || ''] : [item.description || ''],
                beforeAfter: isBA,
                featured: !!item.isFeatured,
                source: 'remote',
            });
        }
    });

    return projects;
}

// Pick up to 6 indices for the homepage "Featured Work" grid. Items the
// owner explicitly starred (`featured: true`) come first in their original
// order; the rest fill any remaining slots so the section never goes empty.
function computeHomepageFeatured(projects) {
    const featuredIdx = [];
    const fillIdx = [];
    projects.forEach((p, i) => {
        if (p.featured) featuredIdx.push(i);
        else fillIdx.push(i);
    });
    return [...featuredIdx, ...fillIdx].slice(0, 6);
}

async function loadMarketingGalleryFromLuckyapp() {
    let res;
    try {
        res = await fetch(MARKETING_GALLERY_URL, { cache: 'no-store' });
    } catch (err) {
        console.warn('[gallery] remote fetch failed (network) — using static fallback', err);
        return;
    }
    if (!res.ok) {
        console.warn('[gallery] remote fetch returned', res.status, '— using static fallback');
        return;
    }

    let json;
    try {
        json = await res.json();
    } catch (err) {
        console.warn('[gallery] remote response was not JSON — using static fallback', err);
        return;
    }

    const remote = Array.isArray(json?.items) ? json.items : [];
    if (remote.length === 0) {
        console.info('[gallery] luckyapp returned 0 published photos — using static fallback');
        return;
    }

    const converted = buildProjectsFromRemoteItems(remote);
    if (converted.length === 0) return;  // belt-and-suspenders: keep static

    // REPLACE — not merge. Luckyapp is the source of truth.
    projectData = converted;
    homepageFeatured = computeHomepageFeatured(projectData);
    // Categories are optional — older luckyapp versions don't return them;
    // an empty array also means Riley hasn't enabled any in Manage
    // Categories. Either way, buildCategoryTiles() falls back to auto-derive.
    remoteCategories = Array.isArray(json?.categories) ? json.categories : [];

    // Rebuild any gallery surfaces that have already mounted with the
    // static seed. Safe to re-call; both functions clear their containers.
    if (typeof buildGalleryGrid === 'function') buildGalleryGrid();
    if (typeof buildCollectionGrid === 'function') buildCollectionGrid();
    if (typeof buildServiceGallery === 'function') buildServiceGallery();

    console.info(
        `[gallery] loaded ${converted.length} project${converted.length === 1 ? '' : 's'} ` +
        `from ${remote.length} luckyapp row${remote.length === 1 ? '' : 's'}`
    );
}

// Fire-and-forget on page load; static gallery shows immediately, then
// swaps in if luckyapp responds with photos.
loadMarketingGalleryFromLuckyapp();

// ============================================
// EDITABLE IMAGE SLOTS (luckyapp-managed)
// ============================================
// Certain page graphics (the service-page "Why Lucky Landscapes" feature
// images) are tagged <img data-ll-img="<slot_key>">. Riley swaps them from
// luckyapp's "Website Images" page; this fetches the override map and replaces
// the src/alt at load. The bundled image is the fallback — if luckyapp is
// unreachable or a slot has no override, the static image stays. Same
// resilience model as the gallery loader above.
const MARKETING_IMAGES_URL = 'https://app.luckylandscapes.com/api/marketing/images';

async function loadMarketingImagesFromLuckyapp() {
    const els = document.querySelectorAll('[data-ll-img]');
    if (!els.length) return;  // page has no editable slots — nothing to do

    let res;
    try {
        res = await fetch(MARKETING_IMAGES_URL, { cache: 'no-store' });
    } catch (err) {
        console.warn('[images] remote fetch failed (network) — using static images', err);
        return;
    }
    if (!res.ok) {
        console.warn('[images] remote fetch returned', res.status, '— using static images');
        return;
    }

    let json;
    try {
        json = await res.json();
    } catch (err) {
        console.warn('[images] remote response was not JSON — using static images', err);
        return;
    }

    const slots = (json && json.slots) || {};
    let applied = 0;
    els.forEach(el => {
        const key = el.getAttribute('data-ll-img');
        const slot = key && slots[key];
        if (slot && slot.url) {
            el.src = slot.url;
            if (slot.alt) el.alt = slot.alt;
            applied++;
        }
    });
    if (applied) console.info(`[images] applied ${applied} luckyapp image override${applied === 1 ? '' : 's'}`);
}

loadMarketingImagesFromLuckyapp();

// ============================================
// GALLERY PAGE — Project Collections
// ============================================
// Uses projectData (defined above) to render collection cards on the gallery page.
// Clicking a collection opens either:
//   • Before/After Slider — for projects with beforeAfter: true (2 images)
//   • Image Carousel — for projects with 2+ images (series viewer)

const collectionGrid = document.getElementById('collection-grid');
const galleryEmpty = document.getElementById('gallery-empty');
const galleryEmptyClear = document.getElementById('gallery-empty-clear');
// Two-view gallery refs (categories landing + photos detail)
const galleryCategoriesView = document.getElementById('gallery-categories-view');
const galleryCategoriesGrid = document.getElementById('gallery-categories-grid');
const galleryCategoriesCount = document.getElementById('gallery-categories-count');
const galleryDetailView = document.getElementById('gallery-detail-view');
const galleryDetailTitle = document.getElementById('gallery-detail-title');
const galleryDetailCount = document.getElementById('gallery-detail-count');
const galleryBackBtn = document.getElementById('gallery-back-btn');
const galleryShowMoreWrap = document.getElementById('gallery-show-more-wrap');
const galleryShowMoreBtn = document.getElementById('gallery-show-more');

// View state. galleryFilter === 'all' renders the categories landing view;
// any other value renders the detail view for that tag.
let galleryFilter = 'all';
// Pagination — number of photos rendered so far in the detail view.
const GALLERY_PAGE_SIZE = 12;
let galleryDetailVisibleCount = GALLERY_PAGE_SIZE;

// Detect generic / auto-filled titles ("Untitled 3", "IMG 1234", "Photo 5", etc.)
// Phone photos uploaded via luckyapp default to the filename, which is rarely
// human-friendly. When detected, the public site hides the title row entirely
// and lets the tag chip + the photo carry the card.
function isGenericTitle(t) {
    if (!t) return true;
    const cleaned = String(t).trim();
    if (!cleaned) return true;
    return /^(untitled|img|image|photo|dsc|pxl|screenshot)[\s_-]*\d*$/i.test(cleaned);
}

function prettyTitle(project) {
    const t = (project.title || '').trim();
    if (isGenericTitle(t)) return '';
    return t;
}

// Local placeholder used when a remote (Supabase) image fails to load —
// keeps the card from looking broken while still communicating the project.
const FALLBACK_CARD_IMG = '/images/banner.jpg';

function projectMatchesFilter(project, filter) {
    if (filter === 'all') return true;
    if (project.tag === filter) return true;
    if (Array.isArray(project.tags) && project.tags.includes(filter)) return true;
    return false;
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Compute tag→projects map. Each project may appear under multiple tags
// (its .tags array). Used by both the category tiles and the detail view.
function computeTagProjects() {
    const byTag = new Map();
    projectData.forEach((project, index) => {
        const tagsForProject = (Array.isArray(project.tags) && project.tags.length)
            ? project.tags
            : [project.tag].filter(Boolean);
        const seen = new Set();
        tagsForProject.forEach(t => {
            if (!t || seen.has(t)) return;
            seen.add(t);
            if (!byTag.has(t)) byTag.set(t, []);
            byTag.get(t).push({ project, index });
        });
    });
    return byTag;
}

// LEVEL 1 — Render the category tiles landing view.
//
// Two modes depending on Riley's curation state in luckyapp:
//
//  CURATED MODE (remoteCategories has any entries):
//    Render only those categories, in their server-side sort_order, using
//    their explicit cover_image_url (falls back to the first project's
//    cover if the explicit one is null), display_name override, and icon.
//    Categories without any matching photos are skipped silently.
//
//  AUTO-DERIVE MODE (remoteCategories empty):
//    Existing behavior — every unique tag found across projectData becomes
//    a tile, sorted by descending project count. Used when Riley hasn't
//    enabled any categories yet OR when running on the static fallback.
function buildCategoryTiles() {
    if (!galleryCategoriesGrid) return;
    const byTag = computeTagProjects();

    // Decide which (tag, projects, meta) tuples to render.
    let entries;
    if (Array.isArray(remoteCategories) && remoteCategories.length > 0) {
        // Curated mode — honor Riley's explicit picks.
        entries = remoteCategories
            .slice()
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map(meta => {
                const projects = byTag.get(meta.name) || [];
                return { tag: meta.name, projects, meta };
            })
            .filter(e => e.projects.length > 0);  // skip categories with zero photos
    } else {
        // Auto-derive mode — every tag becomes a tile.
        entries = Array.from(byTag.entries())
            .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
            .map(([tag, projects]) => ({ tag, projects, meta: null }));
    }

    if (galleryCategoriesCount) {
        const totalProjects = projectData.length;
        const totalCategories = entries.length;
        galleryCategoriesCount.textContent = totalCategories === 0
            ? `${totalProjects} ${totalProjects === 1 ? 'project' : 'projects'} — gallery being curated`
            : `${totalProjects} ${totalProjects === 1 ? 'project' : 'projects'} across ${totalCategories} ${totalCategories === 1 ? 'category' : 'categories'}`;
    }

    galleryCategoriesGrid.innerHTML = entries.map(({ tag, projects, meta }) => {
        // Cover-image precedence: explicit meta.coverImageUrl → first project's
        // chosen cover → first project's first image → fallback banner.
        let coverSrc = '/images/banner.jpg';
        if (meta?.coverImageUrl) {
            coverSrc = meta.coverImageUrl;
        } else {
            for (const { project } of projects) {
                const coverIdx = project.cover ?? 0;
                const coverImg = project.images?.[coverIdx] ?? project.images?.[0];
                if (coverImg) {
                    coverSrc = getImageSrc(coverImg);
                    break;
                }
            }
        }
        const displayLabel = meta?.displayName || tag;
        const safeTag = escapeHtml(tag);
        const safeLabel = escapeHtml(displayLabel);
        const iconHtml = meta?.icon
            ? `<span aria-hidden="true" style="font-size:1.6rem;line-height:1;display:block;margin-bottom:.35rem;">${escapeHtml(meta.icon)}</span>`
            : '';
        const count = projects.length;
        return `
            <a href="#tag=${encodeURIComponent(tag)}" class="gallery-category-tile" data-tag="${safeTag}" aria-label="View ${safeLabel} projects (${count})">
                <img src="${escapeHtml(coverSrc)}" alt="" loading="lazy" class="gallery-category-img"
                     onerror="this.onerror=null;this.src='/images/banner.jpg';this.classList.add('is-fallback');" />
                <div class="gallery-category-overlay">
                    ${iconHtml}
                    <h3 class="gallery-category-title">${safeLabel}</h3>
                    <p class="gallery-category-count">${count} ${count === 1 ? 'project' : 'projects'}</p>
                </div>
            </a>
        `;
    }).join('');
}

// LEVEL 2 — Render photos for the currently-active category. Honors
// `galleryDetailVisibleCount` for pagination.
function buildCollectionGrid() {
    if (!collectionGrid) return;
    collectionGrid.innerHTML = '';

    // Categories landing view — render tiles and bail.
    if (galleryFilter === 'all') {
        if (galleryCategoriesView) galleryCategoriesView.hidden = false;
        if (galleryDetailView) galleryDetailView.hidden = true;
        if (galleryEmpty) galleryEmpty.hidden = true;
        if (galleryShowMoreWrap) galleryShowMoreWrap.hidden = true;
        buildCategoryTiles();
        return;
    }

    // Detail view for a specific category.
    if (galleryCategoriesView) galleryCategoriesView.hidden = true;
    if (galleryDetailView) galleryDetailView.hidden = false;

    const visible = projectData
        .map((project, index) => ({ project, index }))
        .filter(({ project }) => projectMatchesFilter(project, galleryFilter));

    if (galleryDetailTitle) galleryDetailTitle.textContent = galleryFilter;
    if (galleryDetailCount) {
        galleryDetailCount.textContent = `${visible.length} ${visible.length === 1 ? 'project' : 'projects'}`;
    }

    if (galleryEmpty) {
        galleryEmpty.hidden = visible.length > 0;
    }

    // Pagination — only render up to the current visible count, then show
    // a "Show more" button if there's more.
    const sliced = visible.slice(0, galleryDetailVisibleCount);
    if (galleryShowMoreWrap) {
        galleryShowMoreWrap.hidden = sliced.length >= visible.length;
    }

    sliced.forEach(({ project, index }) => {
        const coverIdx = project.cover ?? 0;
        const coverImg = project.images[coverIdx] ?? project.images[0];
        const src = getImageSrc(coverImg);

        const card = document.createElement('div');
        card.className = 'collection-card';
        card.dataset.project = index;

        // Determine badge text
        let badgeText = '';
        if (project.beforeAfter) {
            badgeText = 'Before & After';
        } else if (project.images.length > 1) {
            badgeText = `${project.images.length} Photos`;
        } else {
            badgeText = '1 Photo';
        }

        // In Progress chip
        let chipHtml = '';
        if (project.inProgress) {
            chipHtml = '<div class="gallery-progress-chip"><span class="gallery-progress-dot"></span> In Progress</div>';
        }

        const title = prettyTitle(project);
        const titleHtml = title ? `<h3 class="collection-card-title">${escapeHtml(title)}</h3>` : '';
        const tagText = escapeHtml(project.tag || 'Project');
        const desc = (project.desc || '').trim();
        const descHtml = desc
            ? `<p class="collection-card-desc">${escapeHtml(desc.length > 140 ? desc.slice(0, 137) + '…' : desc)}</p>`
            : '';
        const altText = escapeHtml(title || project.tag || 'Lucky Landscapes project');

        card.innerHTML = `
            ${chipHtml}
            <img src="${escapeHtml(src)}" alt="${altText}" loading="lazy" class="collection-card-img"
                 onerror="this.onerror=null;this.src='${FALLBACK_CARD_IMG}';this.classList.add('is-fallback');" />
            <div class="collection-card-overlay">
                <div class="collection-card-bottom">
                    <span class="collection-card-tag">${tagText}</span>
                    ${titleHtml}
                    ${descHtml}
                </div>
                <span class="collection-card-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    ${badgeText}
                </span>
            </div>
        `;

        collectionGrid.appendChild(card);
    });
}

// Category tile clicks (event delegation). Tiles are <a href="#tag=..."> so
// they also work via direct link / browser nav; the listener just enhances
// scroll behavior + avoids a full page jump.
if (galleryCategoriesGrid) {
    galleryCategoriesGrid.addEventListener('click', (e) => {
        const tile = e.target.closest('.gallery-category-tile[data-tag]');
        if (!tile) return;
        // Let the hashchange listener pick up the filter swap — the href
        // already encodes the destination.
    });
}

// Back-to-categories button clears the hash, triggering hashchange.
if (galleryBackBtn) {
    galleryBackBtn.addEventListener('click', () => {
        history.pushState('', document.title, window.location.pathname + window.location.search);
        applyHashFilter();
        galleryCategoriesView?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

// "Show more" button — bumps the visible count by one page and re-renders.
if (galleryShowMoreBtn) {
    galleryShowMoreBtn.addEventListener('click', () => {
        galleryDetailVisibleCount += GALLERY_PAGE_SIZE;
        buildCollectionGrid();
    });
}

// Empty-state "browse all categories" button returns to the landing view.
if (galleryEmptyClear) {
    galleryEmptyClear.addEventListener('click', () => {
        history.pushState('', document.title, window.location.pathname + window.location.search);
        applyHashFilter();
    });
}

// Read the URL hash and update `galleryFilter` accordingly. Shareable links:
//   /gallery#tag=Hardscaping  →  detail view for Hardscaping
//   /gallery                  →  categories landing
function applyHashFilter() {
    const hash = (window.location.hash || '').replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const tag = params.get('tag');
    galleryFilter = tag || 'all';
    // Reset pagination when switching categories.
    galleryDetailVisibleCount = GALLERY_PAGE_SIZE;
    buildCollectionGrid();
}

window.addEventListener('hashchange', applyHashFilter);
applyHashFilter();

// ============================================
// COLLECTION LIGHTBOX — Before/After & Carousel
// ============================================
const clLightbox = document.getElementById('collection-lightbox');
const clBackdrop = document.getElementById('cl-backdrop');
const clClose = document.getElementById('cl-close');
const clContent = document.getElementById('cl-content');
const clBaView = document.getElementById('cl-ba-view');
const clCarouselView = document.getElementById('cl-carousel-view');
const clCarouselImg = document.getElementById('cl-carousel-img');
const clDots = document.getElementById('cl-dots');
const clCounter = document.getElementById('cl-counter');
const clPrev = document.getElementById('cl-prev');
const clNext = document.getElementById('cl-next');
const clTitle = document.getElementById('cl-title');
const clTag = document.getElementById('cl-tag');
const clDesc = document.getElementById('cl-desc');

// Before/After elements
const baSlider = document.getElementById('ba-slider');
const baBeforeImg = document.getElementById('ba-before-img');
const baAfterImg = document.getElementById('ba-after-img');
const baAfter = document.getElementById('ba-after');
const baHandle = document.getElementById('ba-handle');

let clCurrentProject = null;
let clCurrentImgIdx = 0;
let clIsTransitioning = false;

function closeCollectionLightbox() {
    if (!clLightbox) return;
    clLightbox.classList.remove('active');
    lenis.start();
    clCurrentProject = null;
    clIsTransitioning = false;
}

function openCollectionLightbox(projectIndex) {
    clCurrentProject = projectData[projectIndex];
    clCurrentImgIdx = 0;
    clIsTransitioning = false;

    if (!clCurrentProject || !clLightbox) return;

    // Populate info
    // Hide the title element when it's generic ("Untitled 3", "IMG_1234", etc.)
    // so the lightbox doesn't show "Untitled 1" alongside the tag.
    const lbTitle = prettyTitle(clCurrentProject);
    clTitle.textContent = lbTitle;
    clTitle.style.display = lbTitle ? '' : 'none';
    clTag.textContent = clCurrentProject.tag;
    clDesc.textContent = clCurrentProject.desc || '';

    // Preload all images
    clCurrentProject.images.forEach(img => preloadImage(getImageSrc(img)));

    if (clCurrentProject.beforeAfter && clCurrentProject.images.length === 2) {
        // Show Before/After Slider
        clBaView.style.display = '';
        clCarouselView.style.display = 'none';

        baBeforeImg.src = getImageSrc(clCurrentProject.images[0]);
        baAfterImg.src = getImageSrc(clCurrentProject.images[1]);

        // Reset slider to 50%
        requestAnimationFrame(() => {
            if (baAfter) baAfter.style.clipPath = 'inset(0 0 0 50%)';
            if (baHandle) baHandle.style.left = '50%';
        });
    } else {
        // Show Image Carousel
        clBaView.style.display = 'none';
        clCarouselView.style.display = '';

        showCarouselImage(0);
        buildCarouselDots();
    }

    clLightbox.classList.add('active');
    lenis.stop();
}

// --- Image Carousel ---
function showCarouselImage(idx) {
    if (!clCurrentProject) return;
    clCurrentImgIdx = idx;
    const src = getImageSrc(clCurrentProject.images[idx]);

    clIsTransitioning = true;
    clCarouselImg.classList.add('cl-img-fade-out');

    setTimeout(() => {
        clCarouselImg.src = src;
        clCarouselImg.alt = `${clCurrentProject.title} — photo ${idx + 1}`;

        const tempImg = new Image();
        tempImg.onload = () => {
            clCarouselImg.classList.remove('cl-img-fade-out');
            clIsTransitioning = false;
        };
        tempImg.onerror = () => {
            clCarouselImg.classList.remove('cl-img-fade-out');
            clIsTransitioning = false;
        };
        tempImg.src = src;

        clCounter.textContent = `${idx + 1} / ${clCurrentProject.images.length}`;
        updateCarouselDots();
        // Swap the description in the info pane to match the photo we're
        // showing — each photo in a project may carry its own caption.
        // Falls back to the project-level description for legacy entries
        // that didn't ship per-image descs.
        if (clDesc) {
            const perPhotoDesc = clCurrentProject.imageDescs?.[idx];
            clDesc.textContent = (perPhotoDesc && perPhotoDesc.trim()) || clCurrentProject.desc || '';
        }
    }, 200);
}

function buildCarouselDots() {
    if (!clDots || !clCurrentProject) return;
    clDots.innerHTML = '';
    clCurrentProject.images.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'cl-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', `View image ${i + 1}`);
        dot.addEventListener('click', () => {
            if (i === clCurrentImgIdx || clIsTransitioning) return;
            showCarouselImage(i);
        });
        clDots.appendChild(dot);
    });
}

function updateCarouselDots() {
    if (!clDots) return;
    clDots.querySelectorAll('.cl-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === clCurrentImgIdx);
    });
}

function carouselPrev() {
    if (!clCurrentProject || clIsTransitioning) return;
    const len = clCurrentProject.images.length;
    showCarouselImage((clCurrentImgIdx - 1 + len) % len);
}

function carouselNext() {
    if (!clCurrentProject || clIsTransitioning) return;
    const len = clCurrentProject.images.length;
    showCarouselImage((clCurrentImgIdx + 1) % len);
}

// --- Before/After Slider ---
let baIsDragging = false;

function updateSliderPosition(x) {
    if (!baSlider) return;
    const rect = baSlider.getBoundingClientRect();
    let pct = ((x - rect.left) / rect.width) * 100;
    pct = Math.max(0, Math.min(100, pct));

    if (baAfter) baAfter.style.clipPath = `inset(0 0 0 ${pct}%)`;
    if (baHandle) baHandle.style.left = `${pct}%`;
}

if (baSlider) {
    baSlider.addEventListener('mousedown', (e) => {
        baIsDragging = true;
        updateSliderPosition(e.clientX);
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (baIsDragging) {
            updateSliderPosition(e.clientX);
            e.preventDefault();
        }
    });

    document.addEventListener('mouseup', () => { baIsDragging = false; });

    // Touch support for before/after slider
    baSlider.addEventListener('touchstart', (e) => {
        baIsDragging = true;
        updateSliderPosition(e.touches[0].clientX);
    }, { passive: true });

    baSlider.addEventListener('touchmove', (e) => {
        if (baIsDragging) {
            updateSliderPosition(e.touches[0].clientX);
            e.preventDefault();
        }
    }, { passive: false });

    baSlider.addEventListener('touchend', () => { baIsDragging = false; }, { passive: true });
}

// --- Event Listeners ---
if (collectionGrid) {
    collectionGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.collection-card[data-project]');
        if (!card) return;
        openCollectionLightbox(parseInt(card.dataset.project, 10));
    });
}

if (clClose) clClose.addEventListener('click', closeCollectionLightbox);
if (clBackdrop) clBackdrop.addEventListener('click', closeCollectionLightbox);
if (clPrev) clPrev.addEventListener('click', carouselPrev);
if (clNext) clNext.addEventListener('click', carouselNext);

// Keyboard navigation for collection lightbox
document.addEventListener('keydown', (e) => {
    if (!clLightbox || !clLightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeCollectionLightbox();
    if (clCurrentProject && !clCurrentProject.beforeAfter) {
        if (e.key === 'ArrowLeft') carouselPrev();
        if (e.key === 'ArrowRight') carouselNext();
    }
});

// Touch swipe for carousel in collection lightbox
if (clCarouselView) {
    let clTouchStartX = 0;
    clCarouselView.addEventListener('touchstart', (e) => {
        clTouchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    clCarouselView.addEventListener('touchend', (e) => {
        const diff = clTouchStartX - e.changedTouches[0].screenX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) carouselNext();
            else carouselPrev();
        }
    }, { passive: true });
}


// ============================================
// GSAP — GALLERY ITEMS (after dynamic generation)
// ============================================
// Skipped on touch devices: gsap.from() would set scale: 0.92 on every gallery
// item immediately and only animate to 1 when ScrollTrigger fires. If a mobile
// trigger calc is stale (the bug we're fighting), items stay slightly smaller
// than expected. Cleaner to skip the polish on mobile entirely.
const galleryItemsForAnim = document.querySelectorAll('.gallery-item');
if (galleryItemsForAnim.length > 0 && !isTouchDevice) {
    galleryItemsForAnim.forEach((item, i) => {
        gsap.from(item, {
            scale: 0.92,
            duration: 0.7,
            ease: 'power2.out',
            delay: i * 0.08,
            scrollTrigger: {
                trigger: item,
                start: 'top 88%',
                toggleActions: 'play none none none',
            },
        });
    });
}

// ============================================
// GALLERY IMAGE PRELOADING
// ============================================
const preloadedSrcs = new Set();

function preloadImage(src) {
    if (!src || preloadedSrcs.has(src)) return Promise.resolve();
    preloadedSrcs.add(src);
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = resolve; // resolve even on error so we never hang
        img.src = src;
    });
}

// ============================================
// LAZY LOADING — Gallery grid images (IntersectionObserver)
// ============================================
const lazyImageObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const realSrc = img.dataset.src;
                if (realSrc) {
                    const tempImg = new Image();
                    tempImg.onload = () => {
                        img.src = realSrc;
                        img.classList.remove('gallery-img-lazy');
                        img.classList.add('gallery-img-loaded');
                        preloadedSrcs.add(realSrc);
                    };
                    tempImg.onerror = () => {
                        // Still set the src so the browser can show its own fallback
                        img.src = realSrc;
                        img.classList.remove('gallery-img-lazy');
                        img.classList.add('gallery-img-loaded');
                    };
                    tempImg.src = realSrc;
                    img.removeAttribute('data-src');
                }
                lazyImageObserver.unobserve(img);
            }
        });
    },
    { rootMargin: '300px 0px', threshold: 0.01 }
);

// Homepage gallery grid → open collection lightbox on card click
if (galleryGrid) {
    galleryGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.collection-card[data-project]');
        if (!card) return;
        openCollectionLightbox(parseInt(card.dataset.project, 10));
    });
}












// ============================================
// GUIDED QUESTIONNAIRE WIZARD
// ============================================
// Apps Script intake retired 2026-05-01 — luckyapp now handles photos + email
// notifications + in-app feed. Leave blank to keep it disabled. If you ever
// need to dual-write again (e.g. Vercel outage), paste the deployment URL here.
const QUOTES_SCRIPT_URL = '';
// luckyapp public lead-intake endpoint — creates a customer (tagged "lead", source "website"),
// uploads photos to Supabase Storage, and pings owners via Resend + web push.
const LEADS_INTAKE_URL = 'https://app.luckylandscapes.com/api/leads/public';

// LL:QUOTE-FORM-V2 — single-page form handler
const qzCategoryBtns = document.querySelectorAll('#qz-categories .qz-option-card');
if (qzCategoryBtns.length > 0) {
    // --- DOM refs ---
    const formCard = document.getElementById('quote-form-card');
    const confirmCard = document.getElementById('quote-confirmation');
    const quoteForm = document.getElementById('quote-form');
    const categoryInput = document.getElementById('q-category');
    const categoryLabelInput = document.getElementById('q-categoryLabel');
    const categoryError = document.getElementById('category-error');

    const categoryLabels = {
        lawn:        'Lawn Care',
        garden:      'Garden & Beds',
        hardscape:   'Patios & Walls',
        fencing:     'Fencing',
        cleanup:     'Property Cleanup',
        design:      'Design & Build',
        maintenance: 'Recurring Maintenance',
        other:       'Something Else',
    };

    // --- Category chip selection (single-select) ---
    function selectCategory(cat) {
        if (!cat) return;
        categoryInput.value = cat;
        if (categoryLabelInput) categoryLabelInput.value = categoryLabels[cat] || cat;
        qzCategoryBtns.forEach(b => b.classList.toggle('selected', b.dataset.category === cat));
        if (categoryError) categoryError.classList.remove('visible');
        trackEvent('quote_category_select', { category: cat });
    }

    qzCategoryBtns.forEach(btn => {
        btn.addEventListener('click', () => selectCategory(btn.dataset.category));
    });

    // --- URL ?category=xxx pre-select ---
    const urlParams = new URLSearchParams(window.location.search);
    const preselect = urlParams.get('category');
    if (preselect && categoryLabels[preselect]) selectCategory(preselect);

    // ============================================
    // PHOTO UPLOAD
    // ============================================
    const photoInput = document.getElementById('q-photos');
    const uploadTrigger = document.getElementById('qz-upload-trigger');
    const uploadPreview = document.getElementById('qz-upload-preview');
    let selectedPhotos = [];

    if (uploadTrigger && photoInput) {
        uploadTrigger.addEventListener('click', () => photoInput.click());
        photoInput.addEventListener('change', () => {
            const newFiles = Array.from(photoInput.files);
            const MAX_PER_FILE = 10 * 1024 * 1024;
            const MAX_TOTAL = 30 * 1024 * 1024;
            const skipped = [];
            let totalBytes = selectedPhotos.reduce((s, f) => s + f.size, 0);
            for (const file of newFiles) {
                if (selectedPhotos.length >= 5) { skipped.push(`${file.name} (max 5 photos)`); continue; }
                if (!file.type.startsWith('image/')) { skipped.push(`${file.name} (not an image)`); continue; }
                if (file.size > MAX_PER_FILE) { skipped.push(`${file.name} (over 10 MB)`); continue; }
                if (totalBytes + file.size > MAX_TOTAL) { skipped.push(`${file.name} (combined size limit)`); continue; }
                selectedPhotos.push(file);
                totalBytes += file.size;
            }
            photoInput.value = '';
            if (skipped.length > 0) alert(`Skipped:\n• ${skipped.join('\n• ')}`);
            renderPhotoPreview();
        });
    }

    function renderPhotoPreview() {
        if (!uploadPreview) return;
        uploadPreview.innerHTML = '';
        selectedPhotos.forEach((file, idx) => {
            const thumb = document.createElement('div');
            thumb.className = 'qz-upload-thumb';
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.alt = file.name;
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'qz-upload-thumb-remove';
            removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', () => {
                selectedPhotos.splice(idx, 1);
                renderPhotoPreview();
            });
            thumb.appendChild(img);
            thumb.appendChild(removeBtn);
            uploadPreview.appendChild(thumb);
        });
    }

    // Downscale + JPEG-recompress to ~200–400KB before base64-encoding.
    // Vercel serverless POST bodies cap at 4.5MB; 5 raw phone photos blow past
    // that easily. Mirrors luckyapp's `compressImage` helper.
    async function compressForUpload(file) {
        if (!file || !file.type || !file.type.startsWith('image/')) return file;
        if (file.size < 200_000) return file;
        let bitmap;
        try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
        catch { return file; }
        const MAX = 1600;
        const ratio = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
        const w = Math.round(bitmap.width * ratio);
        const h = Math.round(bitmap.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
        bitmap.close?.();
        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.7));
        if (!blob || blob.size >= file.size) return file;
        return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    }

    async function getPhotoData() {
        const out = [];
        for (const original of selectedPhotos) {
            const file = await compressForUpload(original);
            const b64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(file);
            });
            out.push({ name: file.name, type: file.type, data: b64 });
        }
        return out;
    }

    // ============================================
    // SUBMISSION (Apps Script + luckyapp lead intake)
    // ============================================
    async function submitQuestionnaire(data) {
        const payload = { ...data };
        if (selectedPhotos.length > 0) payload.photos = await getPhotoData();
        let leadOk = !LEADS_INTAKE_URL;
        const tasks = [];
        if (QUOTES_SCRIPT_URL) {
            tasks.push(
                fetch(QUOTES_SCRIPT_URL, {
                    method: 'POST', mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify(payload),
                }).catch(err => console.error('Apps Script submission error:', err))
            );
        }
        if (LEADS_INTAKE_URL) {
            tasks.push(
                fetch(LEADS_INTAKE_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }).then(async r => {
                    if (r.ok) { leadOk = true; return; }
                    const text = await r.text().catch(() => '');
                    console.error('Lead intake failed', r.status, text);
                }).catch(err => console.error('Lead intake error:', err))
            );
        }
        await Promise.allSettled(tasks);
        return { leadOk };
    }

    // ============================================
    // CONFETTI (kept from old version — visual reward on submit)
    // ============================================
    function spawnConfetti() {
        const container = document.getElementById('confetti-container');
        if (!container) return;
        container.innerHTML = '';
        const colors = ['#6B8E4E', '#8FAF72', '#B5CFA0', '#5A7A40', '#E0B84C', '#F7F5F0', '#FFD700'];
        for (let i = 0; i < 60; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = Math.random() * 100 + '%';
            piece.style.top = '-10px';
            piece.style.background = colors[Math.floor(Math.random() * colors.length)];
            piece.style.animationDelay = Math.random() * 1.5 + 's';
            piece.style.animationDuration = (2 + Math.random() * 2) + 's';
            piece.style.width = (6 + Math.random() * 8) + 'px';
            piece.style.height = (6 + Math.random() * 8) + 'px';
            piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            container.appendChild(piece);
        }
    }

    // ============================================
    // AUTOSAVE (localStorage) — keeps partial leads alive
    // ============================================
    const AUTOSAVE_KEY = 'lucky_quote_partial';
    const AUTOSAVE_TTL_DAYS = 7;
    const AUTOSAVE_FIELDS = ['q-firstName', 'q-lastName', 'q-email', 'q-phone', 'q-address', 'q-description'];

    function loadAutosave() {
        try {
            const raw = localStorage.getItem(AUTOSAVE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data || !data.savedAt) return null;
            if ((Date.now() - data.savedAt) / 86400000 > AUTOSAVE_TTL_DAYS) {
                localStorage.removeItem(AUTOSAVE_KEY);
                return null;
            }
            return data;
        } catch (_) { return null; }
    }

    function saveAutosave() {
        try {
            const payload = { savedAt: Date.now() };
            AUTOSAVE_FIELDS.forEach(id => {
                const el = document.getElementById(id);
                if (el && el.value.trim()) payload[el.name] = el.value;
            });
            if (categoryInput && categoryInput.value) payload.category = categoryInput.value;
            if (Object.keys(payload).length <= 1) return;
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
        } catch (_) {}
    }

    function clearAutosave() {
        try { localStorage.removeItem(AUTOSAVE_KEY); } catch (_) {}
    }

    (function restoreAutosave() {
        const data = loadAutosave();
        if (!data) return;
        const map = { firstName: 'q-firstName', lastName: 'q-lastName', email: 'q-email', phone: 'q-phone', address: 'q-address', project_description: 'q-description' };
        Object.entries(map).forEach(([k, id]) => {
            const el = document.getElementById(id);
            if (el && data[k] && !el.value) el.value = data[k];
        });
        if (data.category && categoryLabels[data.category]) selectCategory(data.category);
        trackEvent('quote_autosave_restored');
    })();

    AUTOSAVE_FIELDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', saveAutosave);
    });

    // ============================================
    // PHONE auto-format + EMAIL validation
    // ============================================
    const phoneInput = document.getElementById('q-phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, '').slice(0, 10);
            let f = '';
            if (val.length > 0) f += '(' + val.slice(0, 3);
            if (val.length >= 3) f += ') ';
            if (val.length > 3) f += val.slice(3, 6);
            if (val.length >= 6) f += '-';
            if (val.length > 6) f += val.slice(6, 10);
            e.target.value = f;
            const group = phoneInput.closest('.form-group');
            if (val.length === 10 && group) group.classList.remove('has-error');
        });
        phoneInput.addEventListener('blur', () => {
            const digits = phoneInput.value.replace(/\D/g, '');
            const group = phoneInput.closest('.form-group');
            if (group) group.classList.toggle('has-error', digits.length > 0 && digits.length < 10);
        });
    }

    const emailInput = document.getElementById('q-email');
    if (emailInput) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        emailInput.addEventListener('blur', () => {
            const v = emailInput.value.trim();
            const group = emailInput.closest('.form-group');
            if (group) group.classList.toggle('has-error', v.length > 0 && !emailRegex.test(v));
        });
        emailInput.addEventListener('input', () => {
            const group = emailInput.closest('.form-group');
            if (group && emailRegex.test(emailInput.value.trim())) group.classList.remove('has-error');
        });
    }

    // ============================================
    // SUBMIT
    // ============================================
    if (quoteForm) {
        quoteForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const firstName = document.getElementById('q-firstName').value.trim();
            const lastName  = document.getElementById('q-lastName').value.trim();
            const email     = document.getElementById('q-email').value.trim();
            const phone     = document.getElementById('q-phone').value.trim();
            const description = document.getElementById('q-description').value.trim();
            const category  = categoryInput.value;

            // Required: category + first name + email + description.
            // Last name is optional — it's not needed to respond to a lead,
            // and every extra required field costs form completions.
            if (!category) {
                if (categoryError) categoryError.classList.add('visible');
                document.getElementById('qz-categories').scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
            if (!firstName || !email || !description) {
                quoteForm.reportValidity();
                return;
            }
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!emailRegex.test(email)) {
                document.getElementById('q-email').closest('.form-group').classList.add('has-error');
                document.getElementById('q-email').focus();
                return;
            }
            if (phone) {
                const digits = phone.replace(/\D/g, '');
                if (digits.length < 10) {
                    document.getElementById('q-phone').closest('.form-group').classList.add('has-error');
                    document.getElementById('q-phone').focus();
                    return;
                }
            }

            const btn = document.getElementById('qz-submit');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<span class="spinner"></span> Submitting...';
            btn.disabled = true;

            const fd = new FormData(quoteForm);
            const data = {};
            for (const [k, v] of fd.entries()) {
                if (v && k !== 'photos') data[k] = v;
            }
            if (selectedPhotos.length > 0) {
                data.photoCount = selectedPhotos.length;
                data.photoNames = selectedPhotos.map(f => f.name).join(', ');
            }

            // If Turnstile is configured, include the token so the backend can verify.
            const turnstileResp = quoteForm.querySelector('[name="cf-turnstile-response"]');
            if (turnstileResp && turnstileResp.value) data.turnstile_token = turnstileResp.value;

            const { leadOk } = await submitQuestionnaire(data);
            if (!leadOk) {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
                alert("We couldn't send your request just now. Please try again, or email rileykopf@luckylandscapes.com directly.");
                return;
            }
            clearAutosave();

            trackEvent('quote_submit', {
                category,
                project_budget: data.project_budget || 'unspecified',
                timeline: data.project_timeline || 'unspecified',
                has_address: !!data.address,
                has_photos: !!data.photoCount,
            });
            trackEvent('generate_lead', { value: 1, currency: 'USD' });

            // Swap form card for confirmation card.
            if (formCard) formCard.classList.add('quote-step-hidden');
            if (confirmCard) {
                confirmCard.classList.remove('quote-step-hidden');
                spawnConfetti();
                confirmCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            btn.innerHTML = originalHTML;
            btn.disabled = false;
        });
    }

    // ============================================
    // ADDRESS AUTOCOMPLETE + lazy Leaflet (preserved from prior version)
    // ============================================
    const addressInput = document.getElementById('q-address');
    const suggestionsEl = document.getElementById('address-suggestions');
    const mapWrap = document.getElementById('address-map-wrap');
    const mapEl = document.getElementById('address-minimap');
    const mapLabel = document.getElementById('address-map-label');

    let leafletLoaded = false;
    function loadLeaflet() {
        if (leafletLoaded || typeof L !== 'undefined') { leafletLoaded = true; return Promise.resolve(); }
        return new Promise((resolve) => {
            const css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            css.crossOrigin = '';
            document.head.appendChild(css);
            const js = document.createElement('script');
            js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            js.crossOrigin = '';
            js.onload = () => { leafletLoaded = true; resolve(); };
            js.onerror = () => resolve();
            document.head.appendChild(js);
        });
    }

    if (addressInput) {
        const triggerLeafletLoad = () => { loadLeaflet(); addressInput.removeEventListener('focus', triggerLeafletLoad); addressInput.removeEventListener('input', triggerLeafletLoad); };
        addressInput.addEventListener('focus', triggerLeafletLoad, { once: true });
        addressInput.addEventListener('input', triggerLeafletLoad, { once: true });
    }

    if (addressInput && suggestionsEl) {
        let debounceTimer = null, focusedIdx = -1, currentResults = [], miniMap = null, miniMapMarker = null;

        const luckyPinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52"><defs><filter id="pinShadow" x="-20%" y="-10%" width="140%" height="130%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.3"/></filter></defs><path d="M20 51 C20 51 3 31 3 18 A17 17 0 0 1 37 18 C37 31 20 51 20 51Z" fill="#4a7c34" filter="url(#pinShadow)"/><path d="M20 49 C20 49 5 30 5 18.5 A15 15 0 0 1 35 18.5 C35 30 20 49 20 49Z" fill="#6B8E4E"/><circle cx="20" cy="18" r="11" fill="rgba(255,255,255,0.2)"/><g transform="translate(20,18)" fill="#fff"><ellipse cx="0" cy="-4" rx="3.2" ry="4" opacity="0.95"/><ellipse cx="0" cy="4" rx="3.2" ry="4" opacity="0.95"/><ellipse cx="-4" cy="0" rx="4" ry="3.2" opacity="0.95"/><ellipse cx="4" cy="0" rx="4" ry="3.2" opacity="0.95"/><circle cx="0" cy="0" r="2" fill="#6B8E4E"/></g></svg>`;

        async function initMiniMap(lat, lon) {
            if (!mapEl) return;
            if (typeof L === 'undefined') await loadLeaflet();
            if (typeof L === 'undefined') return;
            mapWrap.style.display = '';
            requestAnimationFrame(() => mapWrap.classList.add('visible'));
            const luckyPinIcon = L.icon({ iconUrl: 'data:image/svg+xml;base64,' + btoa(luckyPinSvg), iconSize: [40, 52], iconAnchor: [20, 52], popupAnchor: [0, -52] });
            if (!miniMap) {
                miniMap = L.map(mapEl, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false }).setView([lat, lon], 16);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(miniMap);
                L.control.attribution({ prefix: false, position: 'bottomright' }).addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>').addTo(miniMap);
                miniMapMarker = L.marker([lat, lon], { icon: luckyPinIcon }).addTo(miniMap);
            } else {
                miniMap.setView([lat, lon], 16);
                miniMapMarker.setLatLng([lat, lon]);
            }
            setTimeout(() => miniMap.invalidateSize(), 350);
        }

        function hideMiniMap() {
            if (mapWrap) {
                mapWrap.classList.remove('visible');
                setTimeout(() => mapWrap.style.display = 'none', 300);
            }
        }

        function formatAddress(r) {
            const a = r.address || {};
            const parts = [];
            const road = a.road || '';
            if (road) parts.push((a.house_number ? a.house_number + ' ' : '') + road);
            const city = a.city || a.town || a.village || '';
            if (city) parts.push(city);
            if (a.state || a.postcode) parts.push((a.state || '') + (a.postcode ? ' ' + a.postcode : ''));
            return parts.join(', ') || r.display_name;
        }

        function renderSuggestions(results) {
            currentResults = results; focusedIdx = -1;
            if (results.length === 0) {
                suggestionsEl.innerHTML = '<div class="addr-no-results">No addresses found — try a more specific search</div>';
                suggestionsEl.classList.add('visible');
                setTimeout(() => suggestionsEl.classList.remove('visible'), 3000);
                return;
            }
            suggestionsEl.innerHTML = results.map((r, i) => {
                const a = r.address || {};
                const main = a.road ? (a.house_number ? a.house_number + ' ' : '') + a.road : (r.display_name || '').split(',')[0];
                const sub = [a.city || a.town || a.village || '', a.state || ''].filter(Boolean).join(', ');
                return `<div class="address-suggestion-item" data-idx="${i}"><div class="addr-text"><strong>${main}</strong><span>${sub}</span></div></div>`;
            }).join('');
            suggestionsEl.classList.add('visible');
            suggestionsEl.querySelectorAll('.address-suggestion-item').forEach(item => {
                // Use pointerdown so it fires immediately on both mouse and touch.
                // mousedown alone is unreliable on mobile because the browser's
                // input-blur sequence can hide the suggestions before mousedown fires.
                const handler = (e) => {
                    e.preventDefault();
                    selectAddress(currentResults[parseInt(item.dataset.idx, 10)]);
                };
                item.addEventListener('pointerdown', handler);
                // Fallback for the rare browser without PointerEvent support.
                if (!window.PointerEvent) item.addEventListener('mousedown', handler);
            });
        }

        function selectAddress(r) {
            const f = formatAddress(r);
            addressInput.value = f;
            saveAutosave();
            suggestionsEl.classList.remove('visible');
            const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
            if (!isNaN(lat) && !isNaN(lon)) {
                initMiniMap(lat, lon);
                if (mapLabel) mapLabel.textContent = f;
            }
            addressInput.classList.add('addr-confirmed');
            setTimeout(() => addressInput.classList.remove('addr-confirmed'), 1500);
        }

        let currentAbort = null;
        async function searchAddress(query) {
            if (query.length < 3) { suggestionsEl.classList.remove('visible'); return; }
            if (currentAbort) currentAbort.abort();
            currentAbort = new AbortController();
            const signal = currentAbort.signal;
            suggestionsEl.innerHTML = '<div class="addr-loading"><span class="addr-loading-spinner"></span> Searching addresses...</div>';
            suggestionsEl.classList.add('visible');
            try {
                const geoapifyKey = (window.LL_CONFIG && window.LL_CONFIG.geoapify) || '';
                let merged = [];
                if (geoapifyKey) {
                    const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&filter=countrycode:us&bias=proximity:-96.7026,40.8136&limit=6&apiKey=${geoapifyKey}`;
                    const res = await fetch(url, { signal });
                    if (signal.aborted) return;
                    if (res.ok) {
                        const json = await res.json();
                        merged = (json.features || []).map(f => {
                            const p = f.properties || {};
                            return { display_name: p.formatted, lat: p.lat, lon: p.lon, address: { house_number: p.housenumber, road: p.street, city: p.city || p.town || p.village, state: p.state, postcode: p.postcode } };
                        });
                    }
                } else {
                    const neUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=us&viewbox=-104.1,43.0,-95.3,40.0&bounded=1&q=${encodeURIComponent(query)}`;
                    const res = await fetch(neUrl, { signal, headers: { 'Accept-Language': 'en-US,en' } });
                    if (signal.aborted) return;
                    if (res.ok) merged = await res.json();
                }
                renderSuggestions(merged.slice(0, 6));
            } catch (e) {
                if (e.name === 'AbortError') return;
                suggestionsEl.innerHTML = '<div class="addr-loading addr-error">Unable to search — type your full address</div>';
                setTimeout(() => suggestionsEl.classList.remove('visible'), 3000);
            }
        }

        addressInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const v = addressInput.value.trim();
            if (v.length < 3) {
                suggestionsEl.classList.remove('visible');
                if (currentAbort) currentAbort.abort();
                if (v.length === 0) hideMiniMap();
                return;
            }
            debounceTimer = setTimeout(() => searchAddress(v), 250);
        });

        addressInput.addEventListener('keydown', (e) => {
            const items = suggestionsEl.querySelectorAll('.address-suggestion-item');
            if (!items.length) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); focusedIdx = Math.min(focusedIdx + 1, items.length - 1); items.forEach((it, i) => it.classList.toggle('focused', i === focusedIdx)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); focusedIdx = Math.max(focusedIdx - 1, 0); items.forEach((it, i) => it.classList.toggle('focused', i === focusedIdx)); }
            else if (e.key === 'Enter' && focusedIdx >= 0) { e.preventDefault(); selectAddress(currentResults[focusedIdx]); }
            else if (e.key === 'Escape') suggestionsEl.classList.remove('visible');
        });

        addressInput.addEventListener('blur', () => setTimeout(() => suggestionsEl.classList.remove('visible'), 200));
    }
}
