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

// ============================================
// PRELOADER
// ============================================
const preloader = document.getElementById('preloader');
if (preloader) {
    window.addEventListener('load', () => {
        setTimeout(() => {  // Short delay for visual polish
            preloader.classList.add('done');
            // Enable animations after preloader clears
            document.body.classList.add('loaded');
        }, 800);
    });

    // Fallback: hide preloader after 4s even if load event doesn't fire
    setTimeout(() => {
        preloader.classList.add('done');
        document.body.classList.add('loaded');
    }, 4000);
}

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
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#' || !href) return;
        const target = document.querySelector(href);
        if (target) {
            e.preventDefault();
            const navH = navbar ? navbar.offsetHeight : 80;
            lenis.scrollTo(target, { offset: -navH - 10, duration: 1.4 });
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
        title: 'Brick Garden Walls',
        tag: 'Hardscaping',
        cover: 2,
        desc: 'This brick garden wall solved a significant grading challenge while adding striking visual appeal.',
        images: [
            '/images/bricklaying/1.webp',
            '/images/bricklaying/2.webp',
            '/images/bricklaying/3.webp',
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
        title: 'Lawn Cleanup',
        tag: 'Seasonal Cleanup',
        cover: 0,
        desc: 'A thorough lawn cleanup that removed weeds, debris, and overgrowth from the yard, leaving it looking fresh and inviting.',
        images: [
            '/images/LawnRestore/after.webp',
            '/images/LawnRestore/before.webp',
        ],
    },
    {
        title: 'Garden Beds',
        tag: 'Landscaping',
        cover: 1,
        desc: 'A beautiful garden bed built to maximize outdoor living space. Featuring low-maintenance materials and a design that flows seamlessly from the home to the front yard.',
        images: [
            '/images/gardenbed/1.webp',
            '/images/gardenbed/2.webp',
            '/images/gardenbed/3.webp',
            '/images/gardenbed/4.webp',
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

function buildGalleryGrid() {
    if (!galleryGrid) return;
    galleryGrid.innerHTML = '';

    projectData.forEach((project, index) => {
        const coverIdx = project.cover ?? 0;
        const coverImg = project.images[coverIdx] ?? project.images[0];
        const src = getImageSrc(coverImg);

        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.dataset.project = index;

        // In Progress chip
        if (project.inProgress) {
            const chip = document.createElement('div');
            chip.className = 'gallery-progress-chip';
            chip.innerHTML = '<span class="gallery-progress-dot"></span> In Progress';
            item.appendChild(chip);
        }

        // Image element — starts empty, real src set via lazy loader
        const img = document.createElement('img');
        img.dataset.src = src; // store real src for lazy loading
        img.alt = `${project.title} — ${project.tag}`;
        img.loading = 'lazy';
        img.className = 'gallery-img-lazy'; // mark as not-yet-loaded for CSS skeleton

        // Overlay
        const overlay = document.createElement('div');
        overlay.className = 'gallery-overlay';
        overlay.innerHTML = `
            <span class="gallery-label">${project.title}</span>
            <span class="gallery-tag">${project.tag}</span>
        `;

        item.appendChild(img);
        item.appendChild(overlay);
        galleryGrid.appendChild(item);
    });
}

buildGalleryGrid();

// ============================================
// GALLERY PAGE — Flat photo gallery (easy to add new photos!)
// ============================================
// ► TO ADD A NEW PHOTO: just add one line to the galleryPhotos array below.
// ► Categories: 'Hardscaping', 'Landscaping', 'Lawn Care', 'Construction', 'Cleanup'
const galleryPhotos = [
    // === Construction ===
    { src: '/images/megandeck/1.webp', category: 'Construction', caption: 'Custom composite deck build' },
    { src: '/images/megandeck/2.webp', category: 'Construction', caption: 'Deck framing & border detail' },

    // === Hardscaping ===
    { src: '/images/bricklaying/1.webp', category: 'Hardscaping', caption: 'Brick garden wall foundation' },
    { src: '/images/bricklaying/2.webp', category: 'Hardscaping', caption: 'Brick wall construction' },
    { src: '/images/bricklaying/3.webp', category: 'Hardscaping', caption: 'Finished brick retaining wall' },

    // === Lawn Care ===
    { src: '/images/lawncare/1.webp', category: 'Lawn Care', caption: 'Fresh-cut residential lawn' },
    { src: '/images/lawncare/2.webp', category: 'Lawn Care', caption: 'Crisp edging & trim work' },
    { src: '/images/lawncare/3.webp', category: 'Lawn Care', caption: 'Backyard mow & detail' },
    { src: '/images/lawncare/4.webp', category: 'Lawn Care', caption: 'Full property mow service' },
    { src: '/images/lawncare/5.webp', category: 'Lawn Care', caption: 'Manicured front yard' },
    { src: '/images/lawncare/6.webp', category: 'Lawn Care', caption: 'Weekly maintenance service' },

    // === Cleanup ===
    { src: '/images/LawnRestore/after.webp', category: 'Cleanup', caption: 'Yard restoration — after' },
    { src: '/images/LawnRestore/before.webp', category: 'Cleanup', caption: 'Yard restoration — before' },

    // === Landscaping ===
    { src: '/images/gardenbed/1.webp', category: 'Landscaping', caption: 'Garden bed installation' },
    { src: '/images/gardenbed/2.webp', category: 'Landscaping', caption: 'Mulch & edging detail' },
    { src: '/images/gardenbed/3.webp', category: 'Landscaping', caption: 'Front yard bed design' },
    { src: '/images/gardenbed/4.webp', category: 'Landscaping', caption: 'Finished garden beds' },
    { src: '/images/landscapedesign/3.webp', category: 'Landscaping', caption: 'Full landscape transformation' },
    { src: '/images/landscapedesign/1.webp', category: 'Landscaping', caption: 'Landscape design in progress' },
    { src: '/images/landscapedesign/2.webp', category: 'Landscaping', caption: 'Design & build result' },
];

const galleryPageGrid = document.getElementById('gallery-page-grid');
const galleryFilterBar = document.getElementById('gallery-filter-bar');

let currentGalleryFilter = 'all';
let filteredGalleryPhotos = [...galleryPhotos];

function buildGalleryPageGrid(filterTag) {
    if (!galleryPageGrid) return;
    galleryPageGrid.innerHTML = '';
    currentGalleryFilter = filterTag;

    filteredGalleryPhotos = filterTag === 'all'
        ? [...galleryPhotos]
        : galleryPhotos.filter(p => p.category === filterTag);

    filteredGalleryPhotos.forEach((photo, idx) => {
        const item = document.createElement('div');
        item.className = 'gallery-photo-item';
        item.dataset.idx = idx;

        item.innerHTML = `
            <img src="${photo.src}" alt="${photo.caption}" loading="lazy" />
            <span class="gallery-photo-tag">${photo.category}</span>
            <div class="gallery-photo-overlay">
                <span class="gallery-photo-caption">${photo.caption}</span>
            </div>
        `;

        galleryPageGrid.appendChild(item);
    });
}

if (galleryPageGrid) {
    buildGalleryPageGrid('all');

    // Filter button clicks
    if (galleryFilterBar) {
        galleryFilterBar.addEventListener('click', (e) => {
            const btn = e.target.closest('.gallery-filter-btn');
            if (!btn) return;
            const filter = btn.dataset.filter;

            galleryFilterBar.querySelectorAll('.gallery-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            buildGalleryPageGrid(filter);
        });
    }

    // Gallery page photo lightbox
    const gplLightbox = document.getElementById('gallery-photo-lightbox');
    const gplImg = document.getElementById('gpl-img');
    const gplCaption = document.getElementById('gpl-caption');
    const gplCounter = document.getElementById('gpl-counter');
    const gplClose = document.getElementById('gpl-close');
    const gplPrev = document.getElementById('gpl-prev');
    const gplNext = document.getElementById('gpl-next');
    let gplIndex = 0;

    function showGplPhoto(idx) {
        gplIndex = idx;
        const photo = filteredGalleryPhotos[idx];
        if (!photo) return;
        gplImg.src = photo.src;
        gplImg.alt = photo.caption;
        gplCaption.textContent = photo.caption;
        gplCounter.textContent = `${idx + 1} / ${filteredGalleryPhotos.length}`;
    }

    function openGpl(idx) {
        showGplPhoto(idx);
        gplLightbox.classList.add('active');
        lenis.stop();
    }

    function closeGpl() {
        gplLightbox.classList.remove('active');
        lenis.start();
    }

    galleryPageGrid.addEventListener('click', (e) => {
        const item = e.target.closest('.gallery-photo-item');
        if (!item) return;
        openGpl(parseInt(item.dataset.idx, 10));
    });

    if (gplClose) gplClose.addEventListener('click', closeGpl);
    if (gplLightbox) gplLightbox.addEventListener('click', (e) => {
        if (e.target === gplLightbox) closeGpl();
    });

    if (gplPrev) gplPrev.addEventListener('click', () => {
        gplIndex = (gplIndex - 1 + filteredGalleryPhotos.length) % filteredGalleryPhotos.length;
        showGplPhoto(gplIndex);
    });

    if (gplNext) gplNext.addEventListener('click', () => {
        gplIndex = (gplIndex + 1) % filteredGalleryPhotos.length;
        showGplPhoto(gplIndex);
    });

    document.addEventListener('keydown', (e) => {
        if (!gplLightbox || !gplLightbox.classList.contains('active')) return;
        if (e.key === 'Escape') closeGpl();
        if (e.key === 'ArrowLeft') { gplIndex = (gplIndex - 1 + filteredGalleryPhotos.length) % filteredGalleryPhotos.length; showGplPhoto(gplIndex); }
        if (e.key === 'ArrowRight') { gplIndex = (gplIndex + 1) % filteredGalleryPhotos.length; showGplPhoto(gplIndex); }
    });

    // Touch swipe on gallery lightbox
    let gplTouchStartX = 0;
    gplLightbox.addEventListener('touchstart', (e) => { gplTouchStartX = e.changedTouches[0].screenX; }, { passive: true });
    gplLightbox.addEventListener('touchend', (e) => {
        const diff = gplTouchStartX - e.changedTouches[0].screenX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) { gplIndex = (gplIndex + 1) % filteredGalleryPhotos.length; }
            else { gplIndex = (gplIndex - 1 + filteredGalleryPhotos.length) % filteredGalleryPhotos.length; }
            showGplPhoto(gplIndex);
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

// Observe all gallery images for lazy loading
if (galleryGrid) {
    galleryGrid.querySelectorAll('img[data-src]').forEach((img) => {
        lazyImageObserver.observe(img);
    });
}

// ============================================
// LIGHTBOX
// ============================================
const lightbox = document.getElementById('project-lightbox');
const lightboxBackdrop = document.getElementById('lightbox-backdrop');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxMainImg = document.getElementById('lightbox-main-img');
const lightboxTitle = document.getElementById('lightbox-title');
const lightboxTag = document.getElementById('lightbox-tag');
const lightboxDesc = document.getElementById('lightbox-desc');
const lightboxDots = document.getElementById('lightbox-dots');
const lightboxPrev = document.getElementById('lightbox-prev');
const lightboxNext = document.getElementById('lightbox-next');
const lightboxCta = document.getElementById('lightbox-cta');
const lightboxImgWrap = lightboxMainImg ? lightboxMainImg.parentElement : null;

let currentProject = null;
let currentImageIndex = 0;
let isTransitioning = false; // prevent rapid clicks from stacking transitions

function showLightboxLoading() {
    if (lightboxImgWrap) lightboxImgWrap.classList.add('is-loading');
}

function hideLightboxLoading() {
    if (lightboxImgWrap) lightboxImgWrap.classList.remove('is-loading');
}

function updateLightboxImage(direction) {
    if (!currentProject || isTransitioning) return;
    const images = currentProject.images;
    const src = getImageSrc(images[currentImageIndex]);

    isTransitioning = true;

    // Phase 1: Fade out current image
    lightboxMainImg.classList.remove('lb-visible');
    lightboxMainImg.classList.add('lb-hidden');

    // Phase 2: After fade-out completes, swap src and fade in
    setTimeout(() => {
        // Clear old src immediately so stale image never shows
        lightboxMainImg.removeAttribute('src');
        showLightboxLoading();

        const tempImg = new Image();
        tempImg.onload = () => {
            lightboxMainImg.src = src;
            lightboxMainImg.alt = `${currentProject.title} — photo ${currentImageIndex + 1}`;
            hideLightboxLoading();

            // Use rAF to ensure the browser has the new image painted
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    lightboxMainImg.classList.remove('lb-hidden');
                    lightboxMainImg.classList.add('lb-visible');
                    isTransitioning = false;
                });
            });
        };
        tempImg.onerror = () => {
            // Fallback: show image even if preload fails
            lightboxMainImg.src = src;
            lightboxMainImg.alt = `${currentProject.title} — photo ${currentImageIndex + 1}`;
            hideLightboxLoading();
            lightboxMainImg.classList.remove('lb-hidden');
            lightboxMainImg.classList.add('lb-visible');
            isTransitioning = false;
        };
        tempImg.src = src;
    }, 250); // match the CSS fade-out duration

    // Update dots immediately (they should reflect the new selection)
    const dots = lightboxDots.querySelectorAll('.lightbox-dot');
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === currentImageIndex);
    });
}

function preloadProjectImages(project) {
    if (!project) return;
    project.images.forEach((img) => {
        preloadImage(getImageSrc(img));
    });
}

function openLightbox(projectIndex) {
    currentProject = projectData[projectIndex];
    currentImageIndex = 0;
    isTransitioning = false;

    if (!currentProject || !lightbox) return;

    // ► IMMEDIATELY clear old image so stale gallery photos never show
    lightboxMainImg.removeAttribute('src');
    lightboxMainImg.alt = '';
    lightboxMainImg.classList.remove('lb-visible');
    lightboxMainImg.classList.add('lb-hidden');
    showLightboxLoading();

    // Preload all images for this project
    preloadProjectImages(currentProject);

    // Populate info (text updates instantly)
    lightboxTitle.textContent = currentProject.title;
    lightboxTag.textContent = currentProject.tag;
    lightboxDesc.textContent = currentProject.desc;

    // Create dots
    lightboxDots.innerHTML = '';
    currentProject.images.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'lightbox-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', `View image ${i + 1}`);
        dot.addEventListener('click', () => {
            if (i === currentImageIndex) return;
            currentImageIndex = i;
            updateLightboxImage();
        });
        lightboxDots.appendChild(dot);
    });

    // Load first image — preload then fade in
    const firstSrc = getImageSrc(currentProject.images[0]);
    const tempImg = new Image();
    tempImg.onload = () => {
        lightboxMainImg.src = firstSrc;
        lightboxMainImg.alt = `${currentProject.title} — photo 1`;
        hideLightboxLoading();
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                lightboxMainImg.classList.remove('lb-hidden');
                lightboxMainImg.classList.add('lb-visible');
            });
        });
    };
    tempImg.onerror = () => {
        lightboxMainImg.src = firstSrc;
        lightboxMainImg.alt = `${currentProject.title} — photo 1`;
        hideLightboxLoading();
        lightboxMainImg.classList.remove('lb-hidden');
        lightboxMainImg.classList.add('lb-visible');
    };
    tempImg.src = firstSrc;

    // Show lightbox
    lightbox.classList.add('active');
    lenis.stop();
}

function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('active');
    lenis.start();
    currentProject = null;
    isTransitioning = false;

    // Clear image so next open doesn't flash old content
    if (lightboxMainImg) {
        lightboxMainImg.removeAttribute('src');
        lightboxMainImg.classList.remove('lb-visible');
        lightboxMainImg.classList.add('lb-hidden');
    }
}

// Gallery item click handlers (event delegation on the homepage grid)
if (lightbox && galleryGrid) {
    galleryGrid.addEventListener('click', (e) => {
        const item = e.target.closest('.gallery-item[data-project]');
        if (!item) return;
        const idx = parseInt(item.dataset.project, 10);
        openLightbox(idx);
    });
}

// Lightbox controls — bind whenever lightbox exists (works on both homepage & gallery page)
if (lightbox) {
    // Navigation
    if (lightboxPrev) {
        lightboxPrev.addEventListener('click', () => {
            if (!currentProject) return;
            currentImageIndex = (currentImageIndex - 1 + currentProject.images.length) % currentProject.images.length;
            updateLightboxImage('left');
        });
    }

    if (lightboxNext) {
        lightboxNext.addEventListener('click', () => {
            if (!currentProject) return;
            currentImageIndex = (currentImageIndex + 1) % currentProject.images.length;
            updateLightboxImage('right');
        });
    }

    // Close handlers
    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    if (lightboxBackdrop) lightboxBackdrop.addEventListener('click', closeLightbox);

    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft' && lightboxPrev) {
            if (!currentProject) return;
            currentImageIndex = (currentImageIndex - 1 + currentProject.images.length) % currentProject.images.length;
            updateLightboxImage('left');
        }
        if (e.key === 'ArrowRight' && lightboxNext) {
            if (!currentProject) return;
            currentImageIndex = (currentImageIndex + 1) % currentProject.images.length;
            updateLightboxImage('right');
        }
    });

    // Touch swipe support for lightbox
    let touchStartX = 0;
    let touchEndX = 0;
    const lightboxImages = document.querySelector('.lightbox-images');
    if (lightboxImages) {
        lightboxImages.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        lightboxImages.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            const swipeDistance = touchStartX - touchEndX;
            if (Math.abs(swipeDistance) > 50 && currentProject) {
                if (swipeDistance > 0) {
                    // Swipe left → next image
                    currentImageIndex = (currentImageIndex + 1) % currentProject.images.length;
                    updateLightboxImage('right');
                } else {
                    // Swipe right → prev image
                    currentImageIndex = (currentImageIndex - 1 + currentProject.images.length) % currentProject.images.length;
                    updateLightboxImage('left');
                }
            }
        }, { passive: true });
    }

    // CTA button closes lightbox and navigates to quote
    if (lightboxCta) {
        lightboxCta.addEventListener('click', (e) => {
            e.preventDefault();
            closeLightbox();
            const href = lightboxCta.getAttribute('href') || '/quote.html';
            setTimeout(() => {
                window.location.href = href;
            }, 300);
        });
    }
}


// ============================================
// GUIDED QUESTIONNAIRE WIZARD
// ============================================
const QUOTES_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwB-7peAjT_cYSONjylBKFMKPMax95KK0ZWtOY0_DfDAX64_L80XV76hBmtmjL07Svd/exec'; // ← Paste your deployed Apps Script URL here

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
            // Limit to 5 total, max 10MB each
            for (const file of newFiles) {
                if (selectedPhotos.length >= 5) break;
                if (file.size > 10 * 1024 * 1024) continue; // Skip files > 10MB
                if (!file.type.startsWith('image/')) continue;
                selectedPhotos.push(file);
            }
            photoInput.value = ''; // Reset so same file can be re-selected
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

    // --- Submit to Google Sheets ---
    async function submitQuestionnaire(data) {
        if (!QUOTES_SCRIPT_URL) {
            console.warn('QUOTES_SCRIPT_URL not set — skipping submission');
            return;
        }
        try {
            const payload = { ...data };
            // Include photos as base64 if present
            if (selectedPhotos.length > 0) {
                payload.photos = await getPhotoData();
            }
            await fetch(QUOTES_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            });
        } catch (err) {
            console.error('Quote submission error:', err);
        }
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

            if (!firstName || !lastName || !email || !phone) {
                quoteForm.reportValidity();
                return;
            }

            // Phone validation
            const digits = phone.replace(/\D/g, '');
            if (digits.length < 10) {
                const pg = document.getElementById('q-phone').closest('.form-group');
                if (pg) pg.classList.add('has-error');
                document.getElementById('q-phone').focus();
                return;
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

            setProgress(4);
            showStep(allSteps[4]); // step 4
            spawnConfetti();

            btn.innerHTML = originalHTML;
            btn.disabled = false;
        });
    }

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

    // --- Address autocomplete (Nominatim) ---
    const addressInput = document.getElementById('q-address');
    const suggestionsEl = document.getElementById('address-suggestions');
    if (addressInput && suggestionsEl) {
        let debounceTimer = null;
        let focusedIdx = -1;
        let currentResults = [];

        function renderSuggestions(results) {
            currentResults = results;
            focusedIdx = -1;
            if (results.length === 0) {
                suggestionsEl.classList.remove('visible');
                suggestionsEl.innerHTML = '';
                return;
            }
            suggestionsEl.innerHTML = results.map((r, i) => {
                const parts = r.display_name.split(', ');
                const main = parts.slice(0, 2).join(', ');
                const sub = parts.slice(2).join(', ');
                return `<div class="address-suggestion-item" data-idx="${i}">
                    <span class="addr-icon">📍</span>
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
            addressInput.value = result.display_name;
            suggestionsEl.classList.remove('visible');
            suggestionsEl.innerHTML = '';
            currentResults = [];
        }

        async function searchAddress(query) {
            if (query.length < 3) { suggestionsEl.classList.remove('visible'); return; }
            suggestionsEl.innerHTML = '<div class="addr-loading">Searching...</div>';
            suggestionsEl.classList.add('visible');
            try {
                const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=us&q=${encodeURIComponent(query)}`;
                const res = await fetch(url, { headers: { 'Accept-Language': 'en-US,en' } });
                const data = await res.json();
                renderSuggestions(data);
            } catch {
                suggestionsEl.innerHTML = '<div class="addr-loading">Unable to search — type your full address</div>';
                setTimeout(() => suggestionsEl.classList.remove('visible'), 2000);
            }
        }

        addressInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const val = addressInput.value.trim();
            if (val.length < 3) { suggestionsEl.classList.remove('visible'); return; }
            debounceTimer = setTimeout(() => searchAddress(val), 350);
        });

        addressInput.addEventListener('keydown', (e) => {
            const items = suggestionsEl.querySelectorAll('.address-suggestion-item');
            if (!items.length) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); focusedIdx = Math.min(focusedIdx + 1, items.length - 1); items.forEach((it, i) => it.classList.toggle('focused', i === focusedIdx)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); focusedIdx = Math.max(focusedIdx - 1, 0); items.forEach((it, i) => it.classList.toggle('focused', i === focusedIdx)); }
            else if (e.key === 'Enter' && focusedIdx >= 0) { e.preventDefault(); selectAddress(currentResults[focusedIdx]); }
            else if (e.key === 'Escape') { suggestionsEl.classList.remove('visible'); }
        });

        addressInput.addEventListener('blur', () => {
            setTimeout(() => suggestionsEl.classList.remove('visible'), 200);
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
