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
const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    touchMultiplier: 2,
});

// Lenis is driven by gsap.ticker below — no manual raf loop needed

// Sync Lenis with GSAP ScrollTrigger
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

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
const QUOTES_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwB-7peAjT_cYSONjylBKFMKPMax95KK0ZWtOY0_DfDAX64_L80XV76hBmtmjL07Svd/exec'; // ← Paste your deployed Apps Script URL here
// luckyapp public lead-intake endpoint — creates a customer (tagged "lead", source "website").
// Set to '' to disable; e.g. 'https://app.luckylandscapes.com/api/leads/public'.
const LEADS_INTAKE_URL = 'https://app.luckylandscapes.com/api/leads/public';

const qzCategoryBtns = document.querySelectorAll('#qz-categories .qz-option-card, .qz-notsure-btn[data-category]');
if (qzCategoryBtns.length > 0) {
    // --- STATE ---
    let qzCategory = null;
    let qzProjectType = null;

    // --- DOM refs ---
    const allSteps = [
        document.getElementById('quote-step-1'),
        document.getElementById('quote-step-2a'),
        document.getElementById('quote-step-2b'),
        document.getElementById('quote-step-3'),
        document.getElementById('quote-step-4'),
    ];
    const progressFill = document.getElementById('quote-progress-fill');
    const stepDots = document.querySelectorAll('.quote-step-dot');
    const heroTitle = document.getElementById('quote-hero-title');
    const heroSub = document.getElementById('quote-hero-sub');

    const questionGroups = {
        lawn: document.getElementById('qz-lawn'),
        garden: document.getElementById('qz-garden'),
        hardscape: document.getElementById('qz-hardscape'),
        cleanup: document.getElementById('qz-cleanup'),
        design: document.getElementById('qz-design'),
        custom: document.getElementById('qz-custom'),
        notsure: document.getElementById('qz-notsure'),
    };

    const categoryLabels = {
        lawn: { title: 'Lawn Care', icon: '🌿' },
        garden: { title: 'Garden & Beds', icon: '🌺' },
        hardscape: { title: 'Hardscaping', icon: '🧱' },
        cleanup: { title: 'Property Cleanup', icon: '🧹' },
        design: { title: 'Landscape Design', icon: '🎨' },
        custom: { title: 'Custom Project', icon: '🔧' },
        notsure: { title: 'Free Consultation', icon: '🤔' },
    };

    // Categories that show the New vs Repair step
    const needsProjectType = ['lawn', 'garden', 'hardscape'];

    // --- Step navigation ---
    function setProgress(step) {
        const pct = step === 1 ? 25 : step === 2 ? 50 : step === 3 ? 75 : 100;
        if (progressFill) progressFill.style.width = pct + '%';
        stepDots.forEach(dot => {
            const ds = parseInt(dot.dataset.step, 10);
            dot.classList.remove('active', 'completed');
            if (ds === step) dot.classList.add('active');
            else if (ds < step) dot.classList.add('completed');
        });
    }

    function showStep(stepEl) {
        allSteps.forEach(s => { if (s) s.classList.add('quote-step-hidden'); });
        if (stepEl) {
            stepEl.classList.remove('quote-step-hidden');
            stepEl.style.animation = 'none';
            stepEl.offsetHeight; // reflow
            stepEl.style.animation = '';
        }
        const qs = document.getElementById('quote-section');
        if (qs) {
            const navH = navbar ? navbar.offsetHeight : 80;
            lenis.scrollTo(qs, { offset: -navH - 20, duration: 0.8 });
        }
    }

    function showQuestionGroup(category) {
        Object.values(questionGroups).forEach(g => { if (g) g.style.display = 'none'; });
        if (questionGroups[category]) questionGroups[category].style.display = '';
        // Show description wrap
        const descWrap = document.getElementById('qz-description-wrap');
        if (descWrap) descWrap.style.display = '';
        // Show continue button and back button
        const nextBtn = document.getElementById('qz-next-to-contact');
        const backBtn = document.getElementById('back-to-step2a');
        if (nextBtn) nextBtn.style.display = '';
        if (backBtn) backBtn.style.display = needsProjectType.includes(category) ? '' : 'none';
        // Show lawn condition for repair
        const condWrap = document.getElementById('qz-lawn-condition-wrap');
        if (condWrap) condWrap.style.display = (category === 'lawn' && qzProjectType === 'repair') ? '' : 'none';
    }

    function updateHero(category) {
        const info = categoryLabels[category];
        if (!info || !heroTitle) return;
        heroTitle.innerHTML = `Your <em class="highlight">${info.title}</em><br/>Quote Starts Here`;
        if (heroSub) heroSub.textContent = 'Answer a few quick questions and we\'ll craft a personalized quote just for you.';
    }

    // --- Step 1: Category selection ---
    qzCategoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            qzCategory = btn.dataset.category;
            qzProjectType = null;
            updateHero(qzCategory);

            trackEvent('quote_step_complete', { step: 1, category: qzCategory });

            if (needsProjectType.includes(qzCategory)) {
                // Show New vs Repair step
                const t = document.getElementById('step2a-title');
                const s = document.getElementById('step2a-sub');
                const info = categoryLabels[qzCategory];
                if (t) t.textContent = `Is Your ${info.title} Project New or Repair?`;
                if (s) s.textContent = 'This helps us understand the scope and give you a better quote.';
                setProgress(2);
                showStep(allSteps[1]); // step 2a
            } else {
                // Skip to questions directly
                showQuestionGroup(qzCategory);
                setProgress(2);
                showStep(allSteps[2]); // step 2b
            }
        });
    });

    // --- Step 2a: Project type selection ---
    const projectTypeBtns = document.querySelectorAll('#qz-project-type .qz-option-card, #quote-step-2a .qz-notsure-btn[data-projecttype]');
    projectTypeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            qzProjectType = btn.dataset.projecttype;
            showQuestionGroup(qzCategory);
            setProgress(2);
            showStep(allSteps[2]); // step 2b
        });
    });

    // --- Back buttons ---
    const backToStep1 = document.getElementById('back-to-step1');
    if (backToStep1) {
        backToStep1.addEventListener('click', () => {
            qzCategory = null;
            qzProjectType = null;
            if (heroTitle) heroTitle.innerHTML = 'Let\'s Build Your<br/><em class="highlight">Dream Yard</em> Together';
            if (heroSub) heroSub.textContent = 'Answer a few quick questions and we\'ll craft a personalized quote just for you. It only takes 2 minutes.';
            setProgress(1);
            showStep(allSteps[0]);
        });
    }

    const backToStep2a = document.getElementById('back-to-step2a');
    if (backToStep2a) {
        backToStep2a.addEventListener('click', () => {
            if (needsProjectType.includes(qzCategory)) {
                setProgress(2);
                showStep(allSteps[1]); // step 2a
            } else {
                setProgress(1);
                showStep(allSteps[0]); // step 1
            }
        });
    }

    const backToStep2b = document.getElementById('back-to-step2b');
    if (backToStep2b) {
        backToStep2b.addEventListener('click', () => {
            setProgress(2);
            showStep(allSteps[2]); // step 2b
        });
    }

    // ============================================
    // DYNAMIC QUESTION TOGGLING — Show/hide conditional sections based on checkbox state
    // ============================================

    // --- Lawn Care: show add-ons when mowing or complete is checked ---
    const lawnMow = document.querySelector('input[name="lawn_mowing"]');
    const lawnComplete = document.querySelector('input[name="lawn_complete"]');
    const lawnAddonsWrap = document.getElementById('qz-lawn-addons');
    const lawnFreqWrap = document.getElementById('qz-lawn-frequency-wrap');

    function updateLawnAddons() {
        if (!lawnAddonsWrap) return;
        const show = (lawnMow?.checked || lawnComplete?.checked);
        lawnAddonsWrap.classList.toggle('visible', show);
        // Show frequency selector when mowing is checked
        if (lawnFreqWrap) lawnFreqWrap.style.display = (lawnMow?.checked || lawnComplete?.checked) ? '' : 'none';
    }
    if (lawnMow) lawnMow.addEventListener('change', updateLawnAddons);
    if (lawnComplete) lawnComplete.addEventListener('change', updateLawnAddons);

    // --- Garden & Beds: show edging material when edging is checked ---
    const gardenEdging = document.querySelector('input[name="garden_edging"]');
    const gardenEdgingMaterialWrap = document.getElementById('qz-garden-edging-material-wrap');

    function updateGardenEdging() {
        if (!gardenEdgingMaterialWrap) return;
        gardenEdgingMaterialWrap.style.display = gardenEdging?.checked ? '' : 'none';
    }
    if (gardenEdging) gardenEdging.addEventListener('change', updateGardenEdging);

    // --- Garden & Beds: show plant details when planting is checked ---
    const gardenPlanting = document.querySelector('input[name="garden_planting"]');
    const gardenPlantWrap = document.getElementById('qz-garden-plant-wrap');

    function updateGardenPlanting() {
        if (!gardenPlantWrap) return;
        gardenPlantWrap.style.display = gardenPlanting?.checked ? '' : 'none';
    }
    if (gardenPlanting) gardenPlanting.addEventListener('change', updateGardenPlanting);

    // --- Garden & Beds: show mulch details when garden beds is checked ---
    const gardenBeds = document.querySelector('input[name="garden_beds"]');
    const gardenMulchWrap = document.getElementById('qz-garden-mulch-wrap');

    function updateGardenMulch() {
        if (!gardenMulchWrap) return;
        gardenMulchWrap.style.display = gardenBeds?.checked ? '' : 'none';
    }
    if (gardenBeds) gardenBeds.addEventListener('change', updateGardenMulch);

    // --- Hardscaping: show paver sub-options when pavers is checked ---
    const hardPavers = document.querySelector('input[name="hard_pavers"]');
    const hardPaverTypeWrap = document.getElementById('qz-hard-paver-type-wrap');

    function updateHardPavers() {
        if (!hardPaverTypeWrap) return;
        hardPaverTypeWrap.style.display = hardPavers?.checked ? '' : 'none';
    }
    if (hardPavers) hardPavers.addEventListener('change', updateHardPavers);
    // Init
    if (hardPaverTypeWrap) hardPaverTypeWrap.style.display = 'none';

    // --- Hardscaping: show wall details when retaining walls is checked ---
    const hardRetaining = document.querySelector('input[name="hard_retaining"]');
    const hardWallWrap = document.getElementById('qz-hard-wall-wrap');

    function updateHardRetaining() {
        if (!hardWallWrap) return;
        hardWallWrap.style.display = hardRetaining?.checked ? '' : 'none';
    }
    if (hardRetaining) hardRetaining.addEventListener('change', updateHardRetaining);

    // --- Hardscaping: show outdoor living features when outdoor is checked ---
    const hardOutdoor = document.querySelector('input[name="hard_outdoor"]');
    const hardOutdoorWrap = document.getElementById('qz-hard-outdoor-wrap');

    function updateHardOutdoor() {
        if (!hardOutdoorWrap) return;
        hardOutdoorWrap.style.display = hardOutdoor?.checked ? '' : 'none';
    }
    if (hardOutdoor) hardOutdoor.addEventListener('change', updateHardOutdoor);

    // --- Photo upload handling ---
    const photoInput = document.getElementById('q-photos');
    const uploadTrigger = document.getElementById('qz-upload-trigger');
    const uploadPreview = document.getElementById('qz-upload-preview');
    let selectedPhotos = [];

    if (uploadTrigger && photoInput) {
        uploadTrigger.addEventListener('click', () => photoInput.click());

        photoInput.addEventListener('change', () => {
            const newFiles = Array.from(photoInput.files);
            // Limit: 5 photos total, 10MB each, 30MB combined, image/* only.
            const MAX_PER_FILE = 10 * 1024 * 1024;
            const MAX_TOTAL = 30 * 1024 * 1024;
            const skipped = [];
            let totalBytes = selectedPhotos.reduce((s, f) => s + f.size, 0);
            for (const file of newFiles) {
                if (selectedPhotos.length >= 5) {
                    skipped.push(`${file.name} (max 5 photos)`);
                    continue;
                }
                if (!file.type.startsWith('image/')) {
                    skipped.push(`${file.name} (not an image)`);
                    continue;
                }
                if (file.size > MAX_PER_FILE) {
                    skipped.push(`${file.name} (over 10 MB)`);
                    continue;
                }
                if (totalBytes + file.size > MAX_TOTAL) {
                    skipped.push(`${file.name} (combined size limit)`);
                    continue;
                }
                selectedPhotos.push(file);
                totalBytes += file.size;
            }
            photoInput.value = '';
            if (skipped.length > 0) {
                alert(`Skipped:\n• ${skipped.join('\n• ')}`);
            }
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

    // --- Continue to contact ---
    const nextToContact = document.getElementById('qz-next-to-contact');
    if (nextToContact) {
        nextToContact.addEventListener('click', () => {
            trackEvent('quote_step_complete', { step: 2, category: qzCategory });
            setProgress(3);
            showStep(allSteps[3]); // step 3
        });
    }

    // --- Collect all questionnaire data ---
    function collectData() {
        const data = {};
        data.category = qzCategory || '';
        data.categoryLabel = categoryLabels[qzCategory]?.title || qzCategory || '';
        data.projectType = qzProjectType || '';

        // Collect all checkboxes and selects from the active question group
        const group = questionGroups[qzCategory];
        if (group) {
            group.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
                data[cb.name] = cb.value;
            });
            group.querySelectorAll('select').forEach(sel => {
                if (sel.value) data[sel.name] = sel.value;
            });
        }

        // Description
        const desc = document.getElementById('qz-description');
        if (desc && desc.value.trim()) data.project_description = desc.value.trim();

        // Contact form fields
        const form = document.getElementById('quote-form');
        if (form) {
            const fd = new FormData(form);
            for (const [k, v] of fd.entries()) {
                if (v && k !== 'photos') data[k] = v;
            }
        }

        // Photo file names (for the spreadsheet)
        if (selectedPhotos.length > 0) {
            data.photoCount = selectedPhotos.length;
            data.photoNames = selectedPhotos.map(f => f.name).join(', ');
        }

        return data;
    }

    // Convert photos to base64 for sending to Google Drive
    async function getPhotoData() {
        const photoData = [];
        for (const file of selectedPhotos) {
            const reader = new FileReader();
            const b64 = await new Promise((resolve) => {
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(file);
            });
            photoData.push({ name: file.name, type: file.type, data: b64 });
        }
        return photoData;
    }

    // --- Submit to Google Sheets + luckyapp lead intake ---
    async function submitQuestionnaire(data) {
        const payload = { ...data };
        if (selectedPhotos.length > 0) {
            payload.photos = await getPhotoData();
        }

        const tasks = [];

        // 1. Google Apps Script (Sheets/Drive/Gmail) — keeps existing flow intact.
        if (QUOTES_SCRIPT_URL) {
            tasks.push(
                fetch(QUOTES_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify(payload),
                }).catch(err => console.error('Apps Script submission error:', err))
            );
        } else {
            console.warn('QUOTES_SCRIPT_URL not set — skipping Sheets submission');
        }

        // 2. luckyapp lead intake — creates the customer record. Photos are not sent
        //    here (Drive/Sheets is the canonical photo store); only the count is sent.
        if (LEADS_INTAKE_URL) {
            const { photos, ...leadPayload } = payload;
            tasks.push(
                fetch(LEADS_INTAKE_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(leadPayload),
                })
                    .then(async r => {
                        // Don't log the response body — it may echo customer data.
                        if (!r.ok) console.error('Lead intake failed', r.status);
                    })
                    .catch(err => console.error('Lead intake error:', err))
            );
        }

        await Promise.allSettled(tasks);
    }

    // --- Confetti ---
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

    // --- Form submission ---
    const quoteForm = document.getElementById('quote-form');
    if (quoteForm) {
        quoteForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const firstName = document.getElementById('q-firstName').value.trim();
            const lastName = document.getElementById('q-lastName').value.trim();
            const email = document.getElementById('q-email').value.trim();
            const phone = document.getElementById('q-phone').value.trim();

            if (!firstName || !lastName || !email) {
                quoteForm.reportValidity();
                return;
            }

            // Phone is optional, but if provided it must be a real US-style number.
            if (phone) {
                const digits = phone.replace(/\D/g, '');
                if (digits.length < 10) {
                    const pg = document.getElementById('q-phone').closest('.form-group');
                    if (pg) pg.classList.add('has-error');
                    document.getElementById('q-phone').focus();
                    return;
                }
            }

            // Email validation
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!emailRegex.test(email)) {
                const eg = document.getElementById('q-email').closest('.form-group');
                if (eg) eg.classList.add('has-error');
                document.getElementById('q-email').focus();
                return;
            }

            const btn = document.getElementById('qz-submit');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<span class="spinner"></span> Submitting...';
            btn.disabled = true;

            const data = collectData();
            await submitQuestionnaire(data);

            // Successful submission — clear the autosave so next visit is fresh.
            clearAutosave();

            // Conversion tracking — primary lead event.
            trackEvent('quote_submit', {
                category: data.category || 'unknown',
                project_type: data.projectType || 'unknown',
                has_address: !!data.address,
                has_photos: !!data.photoCount,
            });
            // GA4 also has a built-in 'generate_lead' event that goes into the standard conversion reports.
            trackEvent('generate_lead', { value: 1, currency: 'USD' });

            setProgress(4);
            showStep(allSteps[4]); // step 4
            spawnConfetti();

            btn.innerHTML = originalHTML;
            btn.disabled = false;
        });
    }

    // ============================================
    // QUOTE FORM AUTOSAVE — keep partial leads alive across tab close
    // ============================================
    // Saves contact fields as the user types so a bounced visitor coming back
    // doesn't lose their progress. Cleared on successful submit.
    const AUTOSAVE_KEY = 'lucky_quote_partial';
    const AUTOSAVE_TTL_DAYS = 7;

    function loadAutosave() {
        try {
            const raw = localStorage.getItem(AUTOSAVE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data || !data.savedAt) return null;
            const ageDays = (Date.now() - data.savedAt) / 86400000;
            if (ageDays > AUTOSAVE_TTL_DAYS) {
                localStorage.removeItem(AUTOSAVE_KEY);
                return null;
            }
            return data;
        } catch (_) { return null; }
    }

    function saveAutosave() {
        try {
            const fields = ['q-firstName', 'q-lastName', 'q-email', 'q-phone', 'q-address', 'q-notes'];
            const payload = { savedAt: Date.now() };
            fields.forEach(id => {
                const el = document.getElementById(id);
                if (el && el.value.trim()) payload[el.name] = el.value;
            });
            // Don't write an empty record.
            if (Object.keys(payload).length <= 1) return;
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
        } catch (_) { /* localStorage may be disabled — silently noop */ }
    }

    function clearAutosave() {
        try { localStorage.removeItem(AUTOSAVE_KEY); } catch (_) {}
    }

    // Restore saved contact info if present.
    (function restoreAutosave() {
        const data = loadAutosave();
        if (!data) return;
        const map = { firstName: 'q-firstName', lastName: 'q-lastName', email: 'q-email', phone: 'q-phone', address: 'q-address', notes: 'q-notes' };
        Object.entries(map).forEach(([key, id]) => {
            const el = document.getElementById(id);
            if (el && data[key] && !el.value) el.value = data[key];
        });
        trackEvent('quote_autosave_restored');
    })();

    // Save on input across the whole form.
    ['q-firstName', 'q-lastName', 'q-email', 'q-phone', 'q-address', 'q-notes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => saveAutosave());
    });

    // --- Phone auto-format ---
    const phoneInput = document.getElementById('q-phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, '');
            if (val.length > 10) val = val.slice(0, 10);
            let formatted = '';
            if (val.length > 0) formatted += '(' + val.slice(0, 3);
            if (val.length >= 3) formatted += ') ';
            if (val.length > 3) formatted += val.slice(3, 6);
            if (val.length >= 6) formatted += '-';
            if (val.length > 6) formatted += val.slice(6, 10);
            e.target.value = formatted;
            const group = phoneInput.closest('.form-group');
            if (val.length === 10) group.classList.remove('has-error');
        });
        phoneInput.addEventListener('blur', () => {
            const digits = phoneInput.value.replace(/\D/g, '');
            const group = phoneInput.closest('.form-group');
            if (digits.length > 0 && digits.length < 10) group.classList.add('has-error');
            else group.classList.remove('has-error');
        });
    }

    // --- Email validation ---
    const emailInput = document.getElementById('q-email');
    if (emailInput) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        emailInput.addEventListener('blur', () => {
            const val = emailInput.value.trim();
            const group = emailInput.closest('.form-group');
            if (val.length > 0 && !emailRegex.test(val)) group.classList.add('has-error');
            else group.classList.remove('has-error');
        });
        emailInput.addEventListener('input', () => {
            const val = emailInput.value.trim();
            const group = emailInput.closest('.form-group');
            if (emailRegex.test(val)) group.classList.remove('has-error');
        });
    }

    // --- Address autocomplete + Mini Map ---
    // Uses Geoapify when LL_CONFIG.geoapify is set (free 3k req/day, sane usage policy);
    // falls back to OpenStreetMap Nominatim otherwise. Leaflet is lazy-loaded the first
    // time the user focuses the input so it doesn't block the quote page's first paint.
    const addressInput = document.getElementById('q-address');
    const suggestionsEl = document.getElementById('address-suggestions');
    const mapWrap = document.getElementById('address-map-wrap');
    const mapEl = document.getElementById('address-minimap');
    const mapLabel = document.getElementById('address-map-label');

    let leafletLoaded = false;
    function loadLeaflet() {
        if (leafletLoaded || typeof L !== 'undefined') {
            leafletLoaded = true;
            return Promise.resolve();
        }
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
            js.onerror = () => resolve(); // fail open — autocomplete still works without the map
            document.head.appendChild(js);
        });
    }

    if (addressInput) {
        // Lazy-load Leaflet on first focus or first keystroke, whichever comes first.
        const triggerLeafletLoad = () => {
            loadLeaflet();
            addressInput.removeEventListener('focus', triggerLeafletLoad);
            addressInput.removeEventListener('input', triggerLeafletLoad);
        };
        addressInput.addEventListener('focus', triggerLeafletLoad, { once: true });
        addressInput.addEventListener('input', triggerLeafletLoad, { once: true });
    }

    if (addressInput && suggestionsEl) {
        let debounceTimer = null;
        let focusedIdx = -1;
        let currentResults = [];
        let miniMap = null;
        let miniMapMarker = null;

        // Custom green lucky clover pin SVG
        const luckyPinSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">
            <defs>
                <filter id="pinShadow" x="-20%" y="-10%" width="140%" height="130%">
                    <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.3"/>
                </filter>
            </defs>
            <path d="M20 51 C20 51 3 31 3 18 A17 17 0 0 1 37 18 C37 31 20 51 20 51Z" fill="#4a7c34" filter="url(#pinShadow)"/>
            <path d="M20 49 C20 49 5 30 5 18.5 A15 15 0 0 1 35 18.5 C35 30 20 49 20 49Z" fill="#6B8E4E"/>
            <circle cx="20" cy="18" r="11" fill="rgba(255,255,255,0.2)"/>
            <!-- Four-leaf clover -->
            <g transform="translate(20,18)" fill="#fff">
                <ellipse cx="0" cy="-4" rx="3.2" ry="4" opacity="0.95"/>
                <ellipse cx="0" cy="4" rx="3.2" ry="4" opacity="0.95"/>
                <ellipse cx="-4" cy="0" rx="4" ry="3.2" opacity="0.95"/>
                <ellipse cx="4" cy="0" rx="4" ry="3.2" opacity="0.95"/>
                <circle cx="0" cy="0" r="2" fill="#6B8E4E"/>
            </g>
        </svg>`;

        function makeLuckyPinIcon() {
            if (typeof L === 'undefined') return null;
            return L.icon({
                iconUrl: 'data:image/svg+xml;base64,' + btoa(luckyPinSvg),
                iconSize: [40, 52],
                iconAnchor: [20, 52],
                popupAnchor: [0, -52],
            });
        }

        async function initMiniMap(lat, lon) {
            if (!mapEl) return;
            // Make sure Leaflet is loaded before we try to use it.
            if (typeof L === 'undefined') await loadLeaflet();
            if (typeof L === 'undefined') return; // load failed — silently skip the map
            const luckyPinIcon = makeLuckyPinIcon();

            mapWrap.style.display = '';
            // Trigger reflow for animation
            requestAnimationFrame(() => {
                mapWrap.classList.add('visible');
            });

            if (!miniMap) {
                miniMap = L.map(mapEl, {
                    zoomControl: false,
                    attributionControl: false,
                    dragging: false,
                    scrollWheelZoom: false,
                    doubleClickZoom: false,
                    touchZoom: false,
                    boxZoom: false,
                    keyboard: false
                }).setView([lat, lon], 16);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                }).addTo(miniMap);

                // Subtle attribution
                L.control.attribution({ prefix: false, position: 'bottomright' })
                    .addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>')
                    .addTo(miniMap);

                miniMapMarker = L.marker([lat, lon], { icon: luckyPinIcon }).addTo(miniMap);
            } else {
                miniMap.setView([lat, lon], 16);
                miniMapMarker.setLatLng([lat, lon]);
            }

            // Force map to recalculate size after reveal animation
            setTimeout(() => {
                miniMap.invalidateSize();
            }, 350);
        }

        function hideMiniMap() {
            if (mapWrap) {
                mapWrap.classList.remove('visible');
                setTimeout(() => {
                    mapWrap.style.display = 'none';
                }, 300);
            }
        }

        function formatAddress(result) {
            const addr = result.address || {};
            const parts = [];
            // Street
            const house = addr.house_number || '';
            const road = addr.road || '';
            if (road) parts.push((house ? house + ' ' : '') + road);
            // City
            const city = addr.city || addr.town || addr.village || addr.hamlet || '';
            if (city) parts.push(city);
            // State abbreviated
            const state = addr.state || '';
            const zip = addr.postcode || '';
            if (state || zip) parts.push((state ? state : '') + (zip ? ' ' + zip : ''));
            return parts.join(', ') || result.display_name;
        }

        function renderSuggestions(results) {
            currentResults = results;
            focusedIdx = -1;
            if (results.length === 0) {
                suggestionsEl.classList.remove('visible');
                suggestionsEl.innerHTML = '<div class="addr-no-results"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> No addresses found — try a more specific search</div>';
                suggestionsEl.classList.add('visible');
                setTimeout(() => {
                    suggestionsEl.classList.remove('visible');
                }, 3000);
                return;
            }
            suggestionsEl.innerHTML = results.map((r, i) => {
                const addr = r.address || {};
                const house = addr.house_number || '';
                const road = addr.road || '';
                const main = road ? (house ? house + ' ' : '') + road : r.display_name.split(',')[0];
                const city = addr.city || addr.town || addr.village || '';
                const state = addr.state || '';
                const sub = [city, state].filter(Boolean).join(', ');
                return `<div class="address-suggestion-item" data-idx="${i}">
                    <span class="addr-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    </span>
                    <div class="addr-text"><strong>${main}</strong><span>${sub}</span></div>
                </div>`;
            }).join('');
            suggestionsEl.classList.add('visible');
            suggestionsEl.querySelectorAll('.address-suggestion-item').forEach(item => {
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    selectAddress(currentResults[parseInt(item.dataset.idx, 10)]);
                });
            });
        }

        function selectAddress(result) {
            const formatted = formatAddress(result);
            addressInput.value = formatted;
            suggestionsEl.classList.remove('visible');
            suggestionsEl.innerHTML = '';
            currentResults = [];

            // Show minimap
            const lat = parseFloat(result.lat);
            const lon = parseFloat(result.lon);
            if (!isNaN(lat) && !isNaN(lon)) {
                initMiniMap(lat, lon);
                if (mapLabel) {
                    mapLabel.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${formatted}`;
                }
            }

            // Pulse the input green briefly
            addressInput.classList.add('addr-confirmed');
            setTimeout(() => addressInput.classList.remove('addr-confirmed'), 1500);
        }

        let currentAbort = null;

        async function searchAddress(query) {
            if (query.length < 3) {
                suggestionsEl.classList.remove('visible');
                return;
            }

            // Abort any in-flight request
            if (currentAbort) currentAbort.abort();
            currentAbort = new AbortController();
            const signal = currentAbort.signal;

            suggestionsEl.innerHTML = '<div class="addr-loading"><span class="addr-loading-spinner"></span> Searching addresses...</div>';
            suggestionsEl.classList.add('visible');

            try {
                const geoapifyKey = (window.LL_CONFIG && window.LL_CONFIG.geoapify) || '';
                let merged = [];

                if (geoapifyKey) {
                    // Geoapify Autocomplete — preferred path, free 3k req/day, no usage-policy
                    // restriction on autocomplete use. Bias to Lincoln, NE.
                    const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&filter=countrycode:us&bias=proximity:-96.7026,40.8136&limit=6&apiKey=${geoapifyKey}`;
                    const res = await fetch(url, { signal });
                    if (signal.aborted) return;
                    if (res.ok) {
                        const json = await res.json();
                        merged = (json.features || []).map(f => {
                            const p = f.properties || {};
                            return {
                                display_name: p.formatted,
                                lat: p.lat,
                                lon: p.lon,
                                importance: (p.rank && p.rank.confidence) || 0.5,
                                address: {
                                    house_number: p.housenumber,
                                    road: p.street,
                                    city: p.city || p.town || p.village,
                                    state: p.state,
                                    postcode: p.postcode,
                                },
                            };
                        });
                    }
                } else {
                    // OSM Nominatim fallback. OSM's usage policy frowns on autocomplete at scale —
                    // set window.LL_CONFIG.geoapify in production once you've got more than a few
                    // dozen lookups per day.
                    const neUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=7&countrycodes=us&viewbox=-104.1,43.0,-95.3,40.0&bounded=1&q=${encodeURIComponent(query)}`;
                    const usUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=us&q=${encodeURIComponent(query)}`;
                    const [neRes, usRes] = await Promise.allSettled([
                        fetch(neUrl, { signal, headers: { 'Accept-Language': 'en-US,en' } }),
                        fetch(usUrl, { signal, headers: { 'Accept-Language': 'en-US,en' } }),
                    ]);
                    if (signal.aborted) return;
                    let neData = [], usData = [];
                    if (neRes.status === 'fulfilled' && neRes.value.ok) neData = await neRes.value.json();
                    if (usRes.status === 'fulfilled' && usRes.value.ok) usData = await usRes.value.json();
                    if (signal.aborted) return;
                    const seen = new Set();
                    for (const r of neData) {
                        const key = `${parseFloat(r.lat).toFixed(4)},${parseFloat(r.lon).toFixed(4)}`;
                        if (!seen.has(key)) { seen.add(key); r._fromNE = true; merged.push(r); }
                    }
                    for (const r of usData) {
                        const key = `${parseFloat(r.lat).toFixed(4)},${parseFloat(r.lon).toFixed(4)}`;
                        if (!seen.has(key)) { seen.add(key); merged.push(r); }
                    }
                    merged.sort((a, b) => {
                        const aIsNE = (a.address?.state || '').toLowerCase().includes('nebraska');
                        const bIsNE = (b.address?.state || '').toLowerCase().includes('nebraska');
                        if (aIsNE && !bIsNE) return -1;
                        if (!aIsNE && bIsNE) return 1;
                        return (parseFloat(b.importance) || 0) - (parseFloat(a.importance) || 0);
                    });
                }

                renderSuggestions(merged.slice(0, 6));
            } catch (e) {
                if (e.name === 'AbortError') return;
                suggestionsEl.innerHTML = '<div class="addr-loading addr-error"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Unable to search — type your full address</div>';
                setTimeout(() => suggestionsEl.classList.remove('visible'), 3000);
            }
        }

        addressInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const val = addressInput.value.trim();
            if (val.length < 3) {
                suggestionsEl.classList.remove('visible');
                if (currentAbort) currentAbort.abort();
                return;
            }
            debounceTimer = setTimeout(() => searchAddress(val), 250);
        });

        addressInput.addEventListener('keydown', (e) => {
            const items = suggestionsEl.querySelectorAll('.address-suggestion-item');
            if (!items.length) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                focusedIdx = Math.min(focusedIdx + 1, items.length - 1);
                items.forEach((it, i) => it.classList.toggle('focused', i === focusedIdx));
                items[focusedIdx]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                focusedIdx = Math.max(focusedIdx - 1, 0);
                items.forEach((it, i) => it.classList.toggle('focused', i === focusedIdx));
                items[focusedIdx]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter' && focusedIdx >= 0) {
                e.preventDefault();
                selectAddress(currentResults[focusedIdx]);
            } else if (e.key === 'Escape') {
                suggestionsEl.classList.remove('visible');
            }
        });

        addressInput.addEventListener('blur', () => {
            setTimeout(() => suggestionsEl.classList.remove('visible'), 200);
        });

        // Clear map if address is deleted
        addressInput.addEventListener('input', () => {
            if (addressInput.value.trim().length === 0) {
                hideMiniMap();
            }
        });
    }

    // --- Clickable step dots ---
    stepDots.forEach(dot => {
        dot.addEventListener('click', () => {
            const clickedStep = parseInt(dot.dataset.step, 10);
            if (!dot.classList.contains('completed')) return;
            if (clickedStep === 1) {
                if (heroTitle) heroTitle.innerHTML = 'Let\'s Build Your<br/><em class="highlight">Dream Yard</em> Together';
                if (heroSub) heroSub.textContent = 'Answer a few quick questions and we\'ll craft a personalized quote just for you. It only takes 2 minutes.';
                setProgress(1);
                showStep(allSteps[0]);
            } else if (clickedStep === 2) {
                setProgress(2);
                showStep(allSteps[2]); // step 2b (questions)
            } else if (clickedStep === 3) {
                setProgress(3);
                showStep(allSteps[3]);
            }
        });
    });

    // --- URL param auto-select ---
    const urlParams = new URLSearchParams(window.location.search);
    const preselectedCat = urlParams.get('category');
    if (preselectedCat && categoryLabels[preselectedCat]) {
        qzCategory = preselectedCat;
        updateHero(qzCategory);
        if (needsProjectType.includes(qzCategory)) {
            const t = document.getElementById('step2a-title');
            const info = categoryLabels[qzCategory];
            if (t) t.textContent = `Is Your ${info.title} Project New or Repair?`;
            setProgress(2);
            allSteps.forEach(s => { if (s) s.classList.add('quote-step-hidden'); });
            allSteps[1].classList.remove('quote-step-hidden');
        } else {
            showQuestionGroup(qzCategory);
            setProgress(2);
            allSteps.forEach(s => { if (s) s.classList.add('quote-step-hidden'); });
            allSteps[2].classList.remove('quote-step-hidden');
        }
    }
}
