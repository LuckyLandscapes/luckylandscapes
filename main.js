/* ============================================
   LUCKY LANDSCAPES — Main JavaScript
   ============================================ */

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

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
// CONTACT FORM HANDLER
// ============================================
const contactForm = document.getElementById('contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(contactForm).entries());

        if (!data.firstName || !data.email) {
            alert('Please fill in at least your name and email.');
            return;
        }

        const btn = contactForm.querySelector('.form-submit');
        const original = btn.innerHTML;
        btn.innerHTML = '✓ Request Sent!';
        btn.style.background = '#2D4A22';
        btn.disabled = true;

        setTimeout(() => {
            btn.innerHTML = original;
            btn.style.background = '';
            btn.disabled = false;
            contactForm.reset();
        }, 3000);
    });
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
