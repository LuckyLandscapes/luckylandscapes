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

// ============================================
// GSAP — GALLERY ITEMS
// ============================================
const galleryItems = document.querySelectorAll('.gallery-item');
if (galleryItems.length > 0) {
    galleryItems.forEach((item, i) => {
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
if (teamCards.length > 0) {
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
if (ctaSection) {
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
// PROJECT LIGHTBOX / GALLERY
// ============================================
const projectData = [
    {
        title: 'Custom Paver Patio',
        tag: 'Hardscaping',
        desc: 'A stunning custom paver patio designed to extend this family\'s outdoor living space. We selected premium interlocking pavers with a complementary border pattern, creating a durable and beautiful surface perfect for entertaining.',
        images: [
            'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=1200',
            'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&q=80&w=1200',
            'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&q=80&w=1200',
        ],
    },
    {
        title: 'Stone Retaining Wall',
        tag: 'Hardscaping',
        desc: 'This natural stone retaining wall solved a significant grading challenge while adding striking visual appeal. Multiple tiers create planting opportunities and transform a steep slope into usable yard space.',
        images: [
            'https://images.unsplash.com/photo-1592420982531-15e71418cb2a?auto=format&fit=crop&q=80&w=1200',
            'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&q=80&w=1200',
            'https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?auto=format&fit=crop&q=80&w=1200',
        ],
    },
    {
        title: 'Full Lawn Restoration',
        tag: 'Landscaping',
        desc: 'A complete lawn renovation that brought this yard back to life. Starting with soil preparation and grading, we installed fresh sod with a professional irrigation setup for a lush, green result that the homeowners love.',
        images: [
            'https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&q=80&w=1200',
            'https://images.unsplash.com/photo-1592150621744-aca64f48394a?auto=format&fit=crop&q=80&w=1200',
            'https://images.unsplash.com/photo-1600438337956-5feb827da8f3?auto=format&fit=crop&q=80&w=1200',
        ],
    },
    {
        title: 'Garden Bed Design',
        tag: 'Planting',
        desc: 'Custom-designed garden beds featuring a curated selection of perennials and ornamental grasses. We used premium mulch and landscape edging to create clean lines that frame the property beautifully.',
        images: [
            'https://images.unsplash.com/photo-1621262981503-45f8e0bd6028?auto=format&fit=crop&q=80&w=1200',
            'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&q=80&w=1200',
            'https://images.unsplash.com/photo-1598902108854-d1446a8a5665?auto=format&fit=crop&q=80&w=1200',
        ],
    },
    {
        title: 'Composite Deck Build',
        tag: 'Construction',
        desc: 'A beautiful composite deck built to maximize outdoor living space. Featuring low-maintenance materials, integrated lighting, and a multi-level design that flows seamlessly from the home to the backyard.',
        images: [
            'https://images.unsplash.com/photo-1599629959669-02685732145b?auto=format&fit=crop&q=80&w=1200',
            'https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?auto=format&fit=crop&q=80&w=1200',
            'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&q=80&w=1200',
        ],
    },
    {
        title: 'Seasonal Cleanup & Mulching',
        tag: 'Maintenance',
        desc: 'A comprehensive seasonal cleanup that included bush trimming, leaf removal, fresh mulch installation, and bed edging. The property went from overgrown to polished in just one day.',
        images: [
            'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&q=80&w=1200',
            'https://images.unsplash.com/photo-1621262981503-45f8e0bd6028?auto=format&fit=crop&q=80&w=1200',
            'https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&q=80&w=1200',
        ],
    },
];

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

let currentProject = null;
let currentImageIndex = 0;

function updateLightboxImage() {
    if (!currentProject) return;
    const images = currentProject.images;
    lightboxMainImg.style.opacity = '0';
    setTimeout(() => {
        lightboxMainImg.src = images[currentImageIndex];
        lightboxMainImg.alt = `${currentProject.title} — photo ${currentImageIndex + 1}`;
        lightboxMainImg.style.opacity = '1';
    }, 150);

    // Update dots
    const dots = lightboxDots.querySelectorAll('.lightbox-dot');
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === currentImageIndex);
    });
}

function openLightbox(projectIndex) {
    currentProject = projectData[projectIndex];
    currentImageIndex = 0;

    if (!currentProject || !lightbox) return;

    // Populate info
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
            currentImageIndex = i;
            updateLightboxImage();
        });
        lightboxDots.appendChild(dot);
    });

    // Set first image
    lightboxMainImg.src = currentProject.images[0];
    lightboxMainImg.alt = `${currentProject.title} — photo 1`;
    lightboxMainImg.style.opacity = '1';

    // Show lightbox
    lightbox.classList.add('active');
    lenis.stop();
}

function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('active');
    lenis.start();
    currentProject = null;
}

// Gallery item click handlers
if (lightbox) {
    document.querySelectorAll('.gallery-item[data-project]').forEach(item => {
        item.addEventListener('click', () => {
            const idx = parseInt(item.dataset.project, 10);
            openLightbox(idx);
        });
    });

    // Navigation
    if (lightboxPrev) {
        lightboxPrev.addEventListener('click', () => {
            if (!currentProject) return;
            currentImageIndex = (currentImageIndex - 1 + currentProject.images.length) % currentProject.images.length;
            updateLightboxImage();
        });
    }

    if (lightboxNext) {
        lightboxNext.addEventListener('click', () => {
            if (!currentProject) return;
            currentImageIndex = (currentImageIndex + 1) % currentProject.images.length;
            updateLightboxImage();
        });
    }

    // Close handlers
    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    if (lightboxBackdrop) lightboxBackdrop.addEventListener('click', closeLightbox);

    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft' && lightboxPrev) lightboxPrev.click();
        if (e.key === 'ArrowRight' && lightboxNext) lightboxNext.click();
    });

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
