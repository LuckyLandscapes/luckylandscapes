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

function handleNavScroll() {
    if (isTeamPage) return; // Team page nav is always scrolled
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
        'Mowing & Maintenance': 'mowing',
        'Garden Beds / Mulch': 'gardenbeds',
        'Plant Transplants': 'transplants',
        'Junk Removal': 'junk',
        'Leaf Removal': 'leaf',
        'Paver Project': 'pavers',
        'Retaining Wall': 'retaining',
        'Deck / Patio': 'decks',
        'Full Landscape Design': 'landscape',
    };
    serviceSelect.addEventListener('change', () => {
        const route = serviceRoutes[serviceSelect.value];
        if (route) {
            window.location.href = `/quote.html?service=${route}`;
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

// Gallery item click handlers (event delegation on the grid)
if (lightbox && galleryGrid) {
    galleryGrid.addEventListener('click', (e) => {
        const item = e.target.closest('.gallery-item[data-project]');
        if (!item) return;
        const idx = parseInt(item.dataset.project, 10);
        openLightbox(idx);
    });

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

    // CTA button closes lightbox and scrolls to contact
    if (lightboxCta) {
        lightboxCta.addEventListener('click', (e) => {
            e.preventDefault();
            closeLightbox();
            setTimeout(() => {
                const target = document.querySelector('#contact');
                if (target) {
                    const navH = navbar ? navbar.offsetHeight : 80;
                    lenis.scrollTo(target, { offset: -navH - 10, duration: 1.4 });
                }
            }, 300);
        });
    }
}

// ============================================
// ST. PATRICK'S DAY PROMO BANNER
// ============================================
(function initPromoBanner() {
    const PROMO_END = new Date('2026-03-31T23:59:59');
    const now = new Date();

    // Auto-expire: don't show anything if the promo period is over
    if (now > PROMO_END) return;

    const banner = document.getElementById('promo-banner');
    const closeBtn = document.getElementById('promo-banner-close');
    const heroBadge = document.getElementById('hero-badge');
    const heroBadgeText = document.getElementById('hero-badge-text');

    // ---- Hero Badge Swap (index page only) ----
    if (heroBadge && heroBadgeText) {
        heroBadgeText.innerHTML = '☘️ St. Patrick\'s Day Special — <span class="promo-badge-highlight">20% Off</span> Any Service!';
        heroBadge.classList.add('hero-badge--promo');
    }

    // ---- Promo Banner ----
    if (!banner) return;

    // Show the banner (always shows on page load — dismiss only hides for current view)
    banner.style.display = '';

    // Measure the banner height and set a CSS variable for offsetting the navbar
    function updatePromoHeight() {
        const h = banner.offsetHeight;
        document.documentElement.style.setProperty('--promo-height', h + 'px');
    }
    updatePromoHeight();
    window.addEventListener('resize', updatePromoHeight);

    // Add class to body so CSS can offset the navbar
    document.body.classList.add('promo-active');

    // Close button
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            banner.style.display = 'none';
            document.body.classList.remove('promo-active');
            // Refresh ScrollTrigger positions since layout shifted
            ScrollTrigger.refresh();
        });
    }

    // CTA "Claim Offer" — on the index page, smooth-scroll to contact
    const ctaBtn = document.getElementById('promo-banner-cta');
    if (ctaBtn) {
        ctaBtn.addEventListener('click', (e) => {
            const contactSection = document.querySelector('#contact');
            if (contactSection) {
                e.preventDefault();
                const navH = navbar ? navbar.offsetHeight : 80;
                lenis.scrollTo(contactSection, { offset: -navH - 10, duration: 1.4 });
            }
    // On other pages the href="/#contact" will navigate normally
        });
    }
})();

// ============================================
// MULTI-SERVICE QUOTE WIZARD
// ============================================
const QUOTES_SCRIPT_URL = ''; // ← Paste your deployed Apps Script URL here

const quoteForm = document.getElementById('quote-form');
if (quoteForm) {
    // --- PRICING CONFIG ---
    const PRICING = {
        mowing: {
            label: 'Mowing Package', unit: '/ visit',
            totalLabel: (c) => `Season Total: $${c.total.toLocaleString(undefined,{minimumFractionDigits:2})} · 31 mows (Apr–Oct)`,
            calc: (d) => {
                const sqft = parseFloat(d.sqft) || 0;
                const perVisit = sqft * 0.005;
                return { perUnit: perVisit, total: perVisit * 31, mowCount: 31, breakdown: [
                    { label: `Base mowing (${sqft.toLocaleString()} sq ft × $0.005)`, val: perVisit },
                    { label: 'Per visit', val: perVisit, bold: true },
                    { label: 'Season total (31 mows)', val: perVisit * 31, bold: true },
                ]};
            },
            inputs: ['sqft'],
            perks: ['🍀 31 professional mows (April through October)', '🌿 Weed eating & edging included',
                     '💡 Personalized lawn care advice & best practices', '📅 Priority scheduling — never wait for a slot',
                     '👷 Consistent crew who knows your property', '🚫 Cancel anytime — no long-term contracts'],
        },
        fertilizer: {
            label: 'Fertilizer Package', unit: '/ application',
            totalLabel: (c) => `Season Total: $${c.total.toLocaleString(undefined,{minimumFractionDigits:2})} · 4 applications`,
            calc: (d) => {
                const sqft = parseFloat(d.sqft) || 0;
                const perApp = sqft * 0.008;
                return { perUnit: perApp, total: perApp * 4, breakdown: [
                    { label: `Fertilizer (${sqft.toLocaleString()} sq ft × $0.008)`, val: perApp },
                    { label: 'Per application', val: perApp, bold: true },
                    { label: 'Season total (4 applications)', val: perApp * 4, bold: true },
                ]};
            },
            inputs: ['sqft'],
            perks: ['🌱 Keep your lawn thick, green, and healthy', '📅 4 applications: April, June, August, October',
                     '🧪 Professional-grade fertilizer', '💡 Customized for your lawn\'s needs',
                     '🚫 No contracts — cancel anytime'],
        },
        cleanup: {
            label: 'Fall Yard Cleanup', unit: '/ service',
            totalLabel: (c) => `Season Total: $${c.total.toLocaleString(undefined,{minimumFractionDigits:2})} · 6 cleanups`,
            calc: (d) => {
                const sqft = parseFloat(d.sqft) || 0;
                const perService = sqft * 0.02;
                return { perUnit: perService, total: perService * 6, breakdown: [
                    { label: `Cleanup (${sqft.toLocaleString()} sq ft × $0.02)`, val: perService },
                    { label: 'Per service', val: perService, bold: true },
                    { label: 'Season total (6 services)', val: perService * 6, bold: true },
                ]};
            },
            inputs: ['sqft'],
            perks: ['🍂 Remove leaves, sticks, and yard debris', '🧹 Weed eating & sidewalk edging',
                     '📅 6 services: Nov–Mar', '🏡 Keep your yard looking great year-round',
                     '🚫 No contracts — cancel anytime'],
        },
        allinone: {
            label: 'All-In-One Package', unit: '/ season',
            totalLabel: () => '',
            calc: (d) => {
                const sqft = parseFloat(d.sqft) || 0;
                const mowing = 0.005 * sqft * 31;
                const fert = 0.008 * sqft * 4;
                const clean = 0.02 * sqft * 6;
                const total = mowing + fert + clean;
                return { perUnit: total, total, breakdown: [
                    { label: `Mowing (${sqft.toLocaleString()} sq ft × $0.005 × 31)`, val: mowing },
                    { label: `Fertilizer (${sqft.toLocaleString()} sq ft × $0.008 × 4)`, val: fert },
                    { label: `Fall Cleanup (${sqft.toLocaleString()} sq ft × $0.02 × 6)`, val: clean },
                    { label: 'Season total', val: total, bold: true },
                ]};
            },
            inputs: ['sqft'],
            perks: ['🍀 Everything in Mowing, Fertilizer & Cleanup packages',
                     '🌿 31 mows + 4 fertilizer apps + 6 cleanups',
                     '💡 Year-round lawn care advice', '📅 Priority scheduling',
                     '👷 Consistent crew', '💰 Best overall value'],
        },
        gardenbeds: {
            label: 'Garden Beds & Mulch', unit: 'total',
            totalLabel: () => '',
            calc: (d) => {
                const sqft = parseFloat(d.bedSqft) || 0;
                const bedType = d.bedType || 'new3';
                const grade = d.bedMaterial || 'basic';
                const rates = {
                    new3:    { basic: 2.00, mid: 2.50, premium: 3.00 },
                    fresh15: { basic: 2.00, mid: 2.25, premium: 2.50 },
                    rock2:   { basic: 4.00, mid: 2.25, premium: 2.50 },
                };
                const typeNames = { new3: 'New Beds (3")', fresh15: 'Freshen Up (1.5")', rock2: 'Rock (2")' };
                const gradeNames = { basic: 'Basic / Non-colored', mid: 'Mid-range / Colored', premium: 'Premium / Cyprus' };
                const rate = rates[bedType]?.[grade] ?? 2.00;
                const total = sqft * rate;
                return { perUnit: total, total, breakdown: [
                    { label: `${typeNames[bedType]} — ${gradeNames[grade]}`, val: null },
                    { label: `${sqft.toLocaleString()} sq ft × $${rate.toFixed(2)}/sq ft`, val: total },
                    { label: 'Project total', val: total, bold: true },
                ]};
            },
            inputs: ['gardenbeds'],
        },
        edging: {
            label: 'Garden Bed Edging', unit: 'total',
            totalLabel: () => '',
            calc: (d) => {
                const lf = parseFloat(d.edgeLF) || 0;
                const mat = d.edgeMaterial || 'vinyl';
                const rates = { vinyl: 3.50, steel: 4.85, concrete: 7.50 };
                const names = { vinyl: 'Vinyl', steel: 'Steel', concrete: 'Concrete' };
                const rate = rates[mat] ?? 3.50;
                const total = lf * rate;
                return { perUnit: total, total, breakdown: [
                    { label: `${names[mat]} edging`, val: null },
                    { label: `${lf.toLocaleString()} linear ft × $${rate.toFixed(2)}/LF`, val: total },
                    { label: 'Project total', val: total, bold: true },
                ]};
            },
            inputs: ['edging'],
        },
        pavers: {
            label: 'Paver Project', unit: 'total',
            totalLabel: () => '',
            calc: (d) => {
                const sqft = parseFloat(d.paverSqft) || 0;
                const grade = d.paverGrade || 'basic';
                const rates = { basic: 10, mid: 14, premium: 18 };
                const names = { basic: 'Standard Concrete', mid: 'Interlocking', premium: 'Natural Stone / Brick' };
                const rate = rates[grade] ?? 10;
                const total = sqft * rate;
                return { perUnit: total, total, breakdown: [
                    { label: `${names[grade]} pavers`, val: null },
                    { label: `${sqft.toLocaleString()} sq ft × $${rate}/sq ft`, val: total },
                    { label: 'Material + labor + profit', val: null },
                    { label: 'Project estimate', val: total, bold: true },
                ]};
            },
            inputs: ['pavers'],
        },
        retaining: {
            label: 'Retaining Wall', unit: 'total',
            totalLabel: () => '',
            calc: (d) => {
                const len = parseFloat(d.wallLength) || 0;
                const ht = parseFloat(d.wallHeight) || 0;
                const sqft = len * ht;
                const mat = d.wallMaterial || 'block';
                const rates = { block: 25, stone: 35, boulder: 45 };
                const names = { block: 'Standard Block', stone: 'Natural Stone', boulder: 'Boulder' };
                const rate = rates[mat] ?? 25;
                const total = sqft * rate;
                return { perUnit: total, total, breakdown: [
                    { label: `${names[mat]} wall`, val: null },
                    { label: `${len} ft long × ${ht} ft high = ${sqft.toLocaleString()} sq ft face`, val: null },
                    { label: `${sqft.toLocaleString()} sq ft × $${rate}/sq ft`, val: total },
                    { label: 'Project estimate', val: total, bold: true },
                ]};
            },
            inputs: ['retaining'],
        },
        decks: {
            label: 'Deck / Patio', unit: 'total',
            totalLabel: () => '',
            calc: (d) => {
                const sqft = parseFloat(d.deckSqft) || 0;
                const grade = d.deckGrade || 'basic';
                const rates = { basic: 15, mid: 22, premium: 30 };
                const names = { basic: 'Pressure-treated Wood', mid: 'Cedar / Composite', premium: 'Trex / Hardwood' };
                const rate = rates[grade] ?? 15;
                const total = sqft * rate;
                return { perUnit: total, total, breakdown: [
                    { label: `${names[grade]}`, val: null },
                    { label: `${sqft.toLocaleString()} sq ft × $${rate}/sq ft`, val: total },
                    { label: 'Project estimate', val: total, bold: true },
                ]};
            },
            inputs: ['decks'],
        },
        transplants: {
            label: 'Plant Transplants', unit: 'total',
            totalLabel: () => '',
            calc: (d) => {
                const sm = parseInt(d.smallPlants) || 0;
                const md = parseInt(d.medPlants) || 0;
                const lg = parseInt(d.largePlants) || 0;
                const xl = parseInt(d.treePlants) || 0;
                const prices = { sm: 20, md: 45, lg: 75, xl: 150 };
                const smTotal = sm * prices.sm;
                const mdTotal = md * prices.md;
                const lgTotal = lg * prices.lg;
                const xlTotal = xl * prices.xl;
                const total = smTotal + mdTotal + lgTotal + xlTotal;
                const breakdown = [];
                if (sm > 0) breakdown.push({ label: `Small plants (${sm} × $${prices.sm})`, val: smTotal });
                if (md > 0) breakdown.push({ label: `Medium plants (${md} × $${prices.md})`, val: mdTotal });
                if (lg > 0) breakdown.push({ label: `Large plants (${lg} × $${prices.lg})`, val: lgTotal });
                if (xl > 0) breakdown.push({ label: `Trees / XL transplants (${xl} × $${prices.xl})`, val: xlTotal });
                if (breakdown.length === 0) breakdown.push({ label: 'Please add at least one plant', val: 0 });
                breakdown.push({ label: 'Project estimate', val: total, bold: true });
                return { perUnit: total, total, breakdown };
            },
            inputs: ['transplants'],
        },
        junk: {
            label: 'Junk Removal', unit: 'total',
            totalLabel: () => '',
            calc: (d) => {
                const size = d.junkSize || 'quarter';
                const type = d.junkType || 'yard';
                const baseRates = { quarter: 125, half: 200, full: 350, xl: 600 };
                const sizeNames = { quarter: '¼ Truck Load', half: '½ Truck Load', full: 'Full Truck Load', xl: 'XL — Multiple Loads' };
                const typeMultiplier = { yard: 1.0, mixed: 1.15, heavy: 1.35 };
                const typeNames = { yard: 'Yard Waste', mixed: 'Mixed Materials', heavy: 'Heavy Materials' };
                const base = baseRates[size] ?? 125;
                const mult = typeMultiplier[type] ?? 1.0;
                const total = Math.round(base * mult);
                const breakdown = [
                    { label: `${sizeNames[size]}`, val: base },
                ];
                if (mult !== 1.0) {
                    breakdown.push({ label: `${typeNames[type]} (×${mult})`, val: total });
                }
                breakdown.push({ label: 'Project estimate', val: total, bold: true });
                return { perUnit: total, total, breakdown };
            },
            inputs: ['junk'],
        },
        leaf: {
            label: 'Leaf Removal', unit: 'total',
            totalLabel: () => '',
            calc: (d) => {
                const sqft = parseFloat(d.sqft) || 0;
                const rate = 0.015;
                const total = sqft * rate;
                return { perUnit: total, total, breakdown: [
                    { label: `Leaf removal (${sqft.toLocaleString()} sq ft × $0.015)`, val: total },
                    { label: 'Includes blowing, raking & haul-off', val: null },
                    { label: 'Project estimate', val: total, bold: true },
                ]};
            },
            inputs: ['sqft'],
        },
        landscape: {
            label: 'Full Landscape Design', unit: 'estimate',
            totalLabel: () => '',
            calc: (d) => {
                const sqft = parseFloat(d.yardSqft) || 0;
                const scope = d.designScope || 'partial';
                const consultFee = 200;
                const rates = { partial: 3.00, full: 4.50, premium: 7.00 };
                const scopeNames = { partial: 'Partial (front or back)', full: 'Full Property', premium: 'Premium + Hardscaping' };
                const rate = rates[scope] ?? 3.00;
                const install = sqft * rate;
                const total = consultFee + install;
                return { perUnit: total, total, breakdown: [
                    { label: `${scopeNames[scope]} design`, val: null },
                    { label: `Design consultation`, val: consultFee },
                    { label: `Installation (${sqft.toLocaleString()} sq ft × $${rate.toFixed(2)})`, val: install },
                    { label: 'Project estimate', val: total, bold: true },
                ]};
            },
            inputs: ['landscape'],
        },
    };

    // --- STATE ---
    let selectedService = null;
    let calcResult = null;

    // --- DOM refs ---
    const allSteps = ['quote-step-1','quote-step-2','quote-step-3','quote-step-4-accept','quote-step-4-decline']
        .map(id => document.getElementById(id));
    const progressFill = document.getElementById('quote-progress-fill');
    const stepDots = document.querySelectorAll('.quote-step-dot');
    const heroTitle = document.getElementById('quote-hero-title');
    const heroSub = document.getElementById('quote-hero-sub');
    const serviceTypeInput = document.getElementById('q-serviceType');
    const conditionGroup = document.getElementById('condition-group');

    // --- Input group visibility map ---
    const inputGroupMap = {
        sqft: document.getElementById('input-sqft'),
        gardenbeds: document.getElementById('input-gardenbeds'),
        edging: document.getElementById('input-edging'),
        pavers: document.getElementById('input-pavers'),
        retaining: document.getElementById('input-retaining'),
        decks: document.getElementById('input-decks'),
        transplants: document.getElementById('input-transplants'),
        junk: document.getElementById('input-junk'),
        landscape: document.getElementById('input-landscape'),
    };

    // --- Step navigation helpers ---
    function setProgress(step) {
        const pct = step === 1 ? 25 : step === 2 ? 50 : step === 3 ? 75 : 100;
        progressFill.style.width = pct + '%';
        stepDots.forEach((dot) => {
            const dotStep = parseInt(dot.dataset.step, 10);
            dot.classList.remove('active', 'completed');
            if (dotStep === step) dot.classList.add('active');
            else if (dotStep < step) dot.classList.add('completed');
        });
    }

    function showStep(stepEl) {
        allSteps.forEach(s => { if (s) s.classList.add('quote-step-hidden'); });
        stepEl.classList.remove('quote-step-hidden');
        stepEl.style.animation = 'none';
        stepEl.offsetHeight;
        stepEl.style.animation = '';
        const quoteSection = document.getElementById('quote-section');
        if (quoteSection) {
            const navH = navbar ? navbar.offsetHeight : 80;
            lenis.scrollTo(quoteSection, { offset: -navH - 20, duration: .8 });
        }
    }

    function showInputGroups(service) {
        // Hide all service-specific inputs
        Object.values(inputGroupMap).forEach(el => { if (el) el.style.display = 'none'; });
        // Show inputs for this service
        const config = PRICING[service];
        if (!config) return;
        config.inputs.forEach(key => {
            if (inputGroupMap[key]) inputGroupMap[key].style.display = '';
        });
        // Show condition dropdown only for mowing
        if (conditionGroup) {
            conditionGroup.style.display = (service === 'mowing') ? '' : 'none';
        }
    }

    function updateHero(service) {
        const config = PRICING[service];
        if (!config || !heroTitle) return;
        heroTitle.innerHTML = `Get Your <em class="highlight">${config.label}</em><br/>Quote in Seconds`;
        if (heroSub) heroSub.textContent = 'Tell us about your project and we\'ll give you an instant, transparent price.';
    }

    // --- Service selection (Step 1 → Step 2) ---
    const serviceCards = document.querySelectorAll('.service-select-card');
    serviceCards.forEach(card => {
        card.addEventListener('click', () => {
            selectedService = card.dataset.service;
            serviceTypeInput.value = selectedService;
            showInputGroups(selectedService);
            updateHero(selectedService);
            setProgress(2);
            showStep(allSteps[1]); // Step 2
        });
    });

    // --- URL param auto-select ---
    const urlParams = new URLSearchParams(window.location.search);
    const preselected = urlParams.get('service');
    if (preselected && PRICING[preselected]) {
        selectedService = preselected;
        serviceTypeInput.value = selectedService;
        showInputGroups(selectedService);
        updateHero(selectedService);
        setProgress(2);
        // Directly show step 2, skip step 1
        allSteps.forEach(s => { if (s) s.classList.add('quote-step-hidden'); });
        allSteps[1].classList.remove('quote-step-hidden');
    }

    // --- Collect form data ---
    function getFormData() {
        const data = Object.fromEntries(new FormData(quoteForm).entries());
        data.service = selectedService;
        data.serviceLabel = PRICING[selectedService]?.label || selectedService;
        if (calcResult) {
            data.quoteTotal = calcResult.total.toFixed(2);
            data.quotePerUnit = calcResult.perUnit.toFixed(2);
        }
        return data;
    }

    // --- Calculate & display quote ---
    function populateQuote() {
        const config = PRICING[selectedService];
        if (!config) return;

        const data = getFormData();
        calcResult = config.calc(data);

        // Animate price counter
        const priceDisplay = document.getElementById('price-display');
        const priceUnit = document.getElementById('price-unit');
        const targetVal = Math.round(calcResult.perUnit);

        priceUnit.textContent = config.unit;

        gsap.fromTo(priceDisplay, { textContent: 0 }, {
            textContent: targetVal,
            duration: 1.2,
            ease: 'power2.out',
            snap: { textContent: 1 },
            onUpdate() { priceDisplay.textContent = Math.round(parseFloat(priceDisplay.textContent)).toLocaleString(); },
            onComplete() {
                priceDisplay.textContent = calcResult.perUnit % 1 === 0
                    ? calcResult.perUnit.toLocaleString()
                    : calcResult.perUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
        });

        // Total badge
        const totalBadge = document.getElementById('quote-total-badge');
        const totalWrap = document.getElementById('quote-total-wrap');
        const totalText = config.totalLabel(calcResult);
        if (totalText) {
            totalBadge.innerHTML = totalText;
            totalWrap.style.display = '';
        } else {
            totalWrap.style.display = 'none';
        }

        // Result label
        const resultLabel = document.getElementById('quote-result-label');
        if (resultLabel) resultLabel.textContent = `Your Estimated ${config.label} Price`;

        // Build breakdown
        const breakdownEl = document.getElementById('quote-breakdown');
        let html = '';
        calcResult.breakdown.forEach(row => {
            const cls = row.bold ? ' total' : '';
            const valStr = row.val !== null ? `$${row.val.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}` : '';
            html += `<div class="breakdown-row${cls}"><span>${row.label}</span><span class="breakdown-val">${valStr}</span></div>`;
        });
        breakdownEl.innerHTML = html;

        // Perks
        const perksEl = document.getElementById('quote-perks');
        const perksTitle = document.getElementById('perks-title');
        const perksList = document.getElementById('perks-list');
        if (config.perks && config.perks.length > 0) {
            perksEl.style.display = '';
            perksTitle.textContent = `Your ${config.label} Includes`;
            perksList.innerHTML = config.perks.map(p => `<li>✓ ${p}</li>`).join('');
        } else {
            perksEl.style.display = 'none';
        }
    }

    // --- Step 2 → Step 3 (See My Quote) ---
    document.getElementById('quote-next-2').addEventListener('click', () => {
        // Validate required contact fields
        const firstName = document.getElementById('q-firstName').value.trim();
        const lastName = document.getElementById('q-lastName').value.trim();
        const email = document.getElementById('q-email').value.trim();
        const phone = document.getElementById('q-phone').value.trim();

        if (!firstName || !lastName || !email || !phone) {
            quoteForm.reportValidity();
            return;
        }

        // Validate service-specific required fields
        const config = PRICING[selectedService];
        if (!config) return;

        let valid = true;
        if (config.inputs.includes('sqft')) {
            if (!(parseFloat(document.getElementById('q-sqft').value) > 0)) {
                document.getElementById('q-sqft').focus();
                valid = false;
            }
        }
        if (config.inputs.includes('gardenbeds')) {
            if (!(parseFloat(document.getElementById('q-bedSqft').value) > 0)) {
                document.getElementById('q-bedSqft').focus();
                valid = false;
            }
        }
        if (config.inputs.includes('edging')) {
            if (!(parseFloat(document.getElementById('q-edgeLF').value) > 0)) {
                document.getElementById('q-edgeLF').focus();
                valid = false;
            }
        }
        if (config.inputs.includes('pavers')) {
            if (!(parseFloat(document.getElementById('q-paverSqft').value) > 0)) {
                document.getElementById('q-paverSqft').focus();
                valid = false;
            }
        }
        if (config.inputs.includes('retaining')) {
            const l = parseFloat(document.getElementById('q-wallLength').value);
            const h = parseFloat(document.getElementById('q-wallHeight').value);
            if (!(l > 0) || !(h > 0)) {
                document.getElementById(l > 0 ? 'q-wallHeight' : 'q-wallLength').focus();
                valid = false;
            }
        }
        if (config.inputs.includes('decks')) {
            if (!(parseFloat(document.getElementById('q-deckSqft').value) > 0)) {
                document.getElementById('q-deckSqft').focus();
                valid = false;
            }
        }
        if (config.inputs.includes('transplants')) {
            const sm = parseInt(document.getElementById('q-smallPlants').value) || 0;
            const md = parseInt(document.getElementById('q-medPlants').value) || 0;
            const lg = parseInt(document.getElementById('q-largePlants').value) || 0;
            const xl = parseInt(document.getElementById('q-treePlants').value) || 0;
            if (sm + md + lg + xl <= 0) {
                document.getElementById('q-smallPlants').focus();
                valid = false;
            }
        }
        if (config.inputs.includes('landscape')) {
            if (!(parseFloat(document.getElementById('q-yardSqft').value) > 0)) {
                document.getElementById('q-yardSqft').focus();
                valid = false;
            }
        }

        if (!valid) {
            quoteForm.reportValidity();
            return;
        }

        setProgress(3);
        showStep(allSteps[2]); // Step 3
        populateQuote();
    });

    // --- Step 3 → Back to Step 2 ---
    document.getElementById('quote-back-3').addEventListener('click', () => {
        setProgress(2);
        showStep(allSteps[1]);
    });

    // --- Submit to Google Sheet ---
    async function submitQuote(decision) {
        const data = getFormData();
        data.decision = decision;

        if (!QUOTES_SCRIPT_URL) {
            console.warn('QUOTES_SCRIPT_URL not set — skipping Google Sheets submission');
            return;
        }

        try {
            const params = new URLSearchParams();
            for (const [key, value] of Object.entries(data)) {
                params.append(key, value);
            }
            await fetch(QUOTES_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: params });
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

    // --- Accept ---
    document.getElementById('quote-accept').addEventListener('click', async () => {
        const btn = document.getElementById('quote-accept');
        btn.innerHTML = '<span class="spinner"></span> Submitting...';
        btn.disabled = true;
        await submitQuote('accepted');
        setProgress(4);
        showStep(allSteps[3]); // Step 4A
        spawnConfetti();
    });

    // --- Decline ---
    document.getElementById('quote-decline').addEventListener('click', async () => {
        await submitQuote('declined');
        setProgress(4);
        showStep(allSteps[4]); // Step 4B
    });

    // --- Changed My Mind ---
    document.getElementById('quote-changed-mind').addEventListener('click', async () => {
        const btn = document.getElementById('quote-changed-mind');
        btn.innerHTML = '<span class="spinner"></span> Let\'s go!';
        btn.disabled = true;
        await submitQuote('accepted (changed mind)');
        showStep(allSteps[3]);
        spawnConfetti();
    });
}
