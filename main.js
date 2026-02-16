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
