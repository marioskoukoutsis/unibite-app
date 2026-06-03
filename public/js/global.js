/**
 * global.js — Κοινές λειτουργίες για όλες τις σελίδες της εφαρμογής.
 * Φορτώνεται πριν από κάθε άλλο script.
 */
document.addEventListener('DOMContentLoaded', () => {

    // ─── 1. Sticky Navbar Shadow on Scroll ───
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            navbar.classList.toggle('scrolled', window.scrollY > 10);
        }, { passive: true });
    }

    // ─── 2. Scroll-to-Top Button ───
    const btn = document.createElement('button');
    btn.className = 'scroll-to-top';
    btn.setAttribute('aria-label', 'Επιστροφή στην κορυφή');
    btn.innerHTML = '↑';
    document.body.appendChild(btn);

    window.addEventListener('scroll', () => {
        btn.classList.toggle('visible', window.scrollY > 300);
    }, { passive: true });

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});
