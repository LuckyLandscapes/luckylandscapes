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
// Touch devices get native scroll — Lenis interferes with iOS momentum scroll
// and pull-to-refresh, and was breaking scrolling on mobile entirely. ScrollTrigger
// works fine against the native window scroll without a Lenis sync.
const isTouchDevice =
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(hover: none)').matches);

let lenis;
if (isTouchDevice) {
    // Stub that mirrors the small surface used elsewhere in this file.
    const navHeight = () => document.querySelector('.navbar')?.offsetHeight || 80;
    lenis = {
        stop() { document.documentElement.style.overflow = 'hidden'; document.body.style.overflow = 'hidden'; },
        start() { document.documentElement.style.overflow = ''; document.body.style.overflow = ''; },
        scrollTo(target, opts = {}) {
            const el = typeof target === 'string' ? document.querySelector(target) : target;
            if (!el) return;
            const offset = opts.offset || 0;
            const top = el.getBoundingClientRect().top + window.scrollY + offset;
            window.scrollTo({ top, behavior: opts.immediate ? 'auto' : 'smooth' });
        },
        on() {},
        raf() {},
    };
} else {
    lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
    });

    // Sync Lenis with GSAP ScrollTrigger (driven by gsap.ticker — no manual raf)
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
}

// Preloader was removed — content shows immediately. Keep loaded class for any
// CSS rules that key off it.
document.body.classList.add('loaded');

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
// CLOUDFLARE TURNSTILE — anti-bot widget on forms (only active when configured)
// ============================================
// Loads the Turnstile API and mounts a widget in every form-mount point on the
// page when LL_CONFIG.turnstile is set. Forms that include a
// `<div class="cf-turnstile-mount"></div>` will get the widget injected.
(function setupTurnstile() {
    const key = (window.LL_CONFIG && window.LL_CONFIG.turnstile) || '';
    if (!key) return;
    const mounts = document.querySelectorAll('.cf-turnstile-mount');
    if (mounts.length === 0) return;
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
        const showAfter = 400;
        const footer = document.querySelector('.footer');
        const footerTop = footer ? footer.getBoundingClientRect().top : Infinity;
        const shouldShow = window.scrollY > showAfter && footerTop > window.innerHeight;

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
const revealEls = document.querySelectorAll(
    '.reveal, .reveal-left, .reveal-right, .reveal-scale, .stagger-children'
);

const revealObs = new IntersectionObserver(
    (entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                revealObs.unobserve(entry.target);
            }
        });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
);

revealEls.forEach(el => revealObs.observe(el));

// ============================================
// GSAP — HERO PARALLAX
// ============================================
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
// GSAP — STATS COUNTER ANIMATION
// ============================================
const statNumbers = document.querySelectorAll('.stat-number[data-count]');

statNumbers.forEach(el => {
    const target = parseInt(el.dataset.count, 10);

    ScrollTrigger.create({
        trigger: el,
        start: 'top 85%',
        once: true,
        onEnter: () => {
            gsap.to(el, {
                duration: 2,
                ease: 'power2.out',
                onUpdate: function () {
                    el.textContent = Math.ceil(this.progress() * target);
                },
            });
        },
    });
});

// ============================================
// GSAP — SERVICE CARDS PARALLAX
// ============================================
const serviceCards = document.querySelectorAll('.service-card');
if (serviceCards.length > 0) {
    serviceCards.forEach((card, i) => {
        gsap.from(card, {
            y: 40 + (i % 4) * 15,
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

// (GSAP gallery item animations are initialized after buildGalleryGrid below)

// ============================================
// GSAP — ABOUT CARDS
// ============================================
const aboutCards = document.querySelectorAll('.about-card');
if (aboutCards.length > 0) {
    aboutCards.forEach((card, i) => {
        gsap.from(card, {
            y: 50,
            duration: 0.7,
            delay: i * 0.15,
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
            // Use URLSearchParams so the body survives no-cors mode
            // (JSON content-type is not a "simple" header and gets stripped)
            const params = new URLSearchParams();
            for (const [key, value] of Object.entries(data)) {
                params.append(key, value);
            }

            await fetch(CONTACT_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: params,
            });

            // no-cors means we can't read the response, but if fetch didn't throw, it sent
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
            window.location.href = `/quote.html?category=${route}`;
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
const projectData = [
    {
        title: 'Custom Built Deck',
        tag: 'Construction',
        cover: 1, // index of the image shown in the gallery grid
        desc: 'A custom built deck designed to extend this family\'s outdoor living space. We selected premium composite materials with a complementary border pattern, creating a durable and beautiful surface perfect for entertainment and relaxation.',
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
        desc: 'We specialize in building strong, long-lasting retaining walls that solve drainage and erosion problems while looking great. Using high-quality materials and proven construction methods, we create retaining walls that protect your property and enhance its curb appeal.',
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
        desc: 'Regular lawn maintenance to keep your lawn looking its best. Includes mowing, edging, trimming, blowing, and hedge trimming.',
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
        title: 'Fire Places',
        tag: 'Hardscaping',
        cover: 0,
        desc: 'A custom built fire place designed to extend this family\'s outdoor living space. We selected premium materials with a complementary border pattern, creating a durable and beautiful surface perfect for entertainment and relaxation.',
        images: [
            '/images/fireplace/1.jpg',
        ],
    },
    {
        title: 'Garden Beds',
        tag: 'Landscaping',
        cover: 1,
        desc: 'A beautiful garden bed built to maximize outdoor living space. Featuring low-maintenance materials and a design that flows seamlessly from the home to the backyard.',
        images: [
            '/images/mulchgardenbeds/1.webp',
            '/images/mulchgardenbeds/2.jpg',
        ],
    },
    {
        title: 'Design & Build',
        tag: 'Landscaping',
        cover: 0,
        desc: 'Transforming outdoor spaces with thoughtful design and expert construction. From concept to completion, we create landscapes that enhance beauty and functionality.',
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

// Curated projects for the homepage (indices into projectData)
// Covers hardscaping, landscaping, before/after, outdoor living, maintenance, curb appeal
const homepageFeatured = [1, 5, 6, 3, 2, 4];

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

        card.innerHTML = `
            ${chipHtml}
            <img src="${src}" alt="${project.title}" loading="lazy" class="collection-card-img" />
            <div class="collection-card-overlay">
                <div class="collection-card-bottom">
                    <span class="collection-card-title">${project.title}</span>
                    <span class="collection-card-tag">${project.tag}</span>
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
// GALLERY PAGE — Project Collections
// ============================================
// Uses projectData (defined above) to render collection cards on the gallery page.
// Clicking a collection opens either:
//   • Before/After Slider — for projects with beforeAfter: true (2 images)
//   • Image Carousel — for projects with 2+ images (series viewer)

const collectionGrid = document.getElementById('collection-grid');

function buildCollectionGrid() {
    if (!collectionGrid) return;
    collectionGrid.innerHTML = '';

    projectData.forEach((project, index) => {
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

        card.innerHTML = `
            ${chipHtml}
            <img src="${src}" alt="${project.title}" loading="lazy" class="collection-card-img" />
            <div class="collection-card-overlay">
                <div class="collection-card-bottom">
                    <span class="collection-card-title">${project.title}</span>
                    <span class="collection-card-tag">${project.tag}</span>
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

buildCollectionGrid();

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
    clTitle.textContent = clCurrentProject.title;
    clTag.textContent = clCurrentProject.tag;
    clDesc.textContent = clCurrentProject.desc;

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
const galleryItemsForAnim = document.querySelectorAll('.gallery-item');
if (galleryItemsForAnim.length > 0) {
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
        lawn:      'Lawn Care',
        garden:    'Garden & Beds',
        hardscape: 'Patios & Walls',
        cleanup:   'Property Cleanup',
        design:    'Design & Build',
        other:     'Something Else',
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
        const colors = ['#6B8E4E', '#8FAF72', '#B5CFA0', '#5A7A40', '#41a100', '#F7F5F0', '#FFD700'];
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

            // Required: category + first/last name + email + description.
            if (!category) {
                if (categoryError) categoryError.classList.add('visible');
                document.getElementById('qz-categories').scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
            if (!firstName || !lastName || !email || !description) {
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
                project_size: data.project_size || 'unspecified',
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
                item.addEventListener('mousedown', (e) => { e.preventDefault(); selectAddress(currentResults[parseInt(item.dataset.idx, 10)]); });
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
