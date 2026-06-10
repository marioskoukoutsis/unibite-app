/**
 * global.js — κοινά κομμάτια για όλες τις σελίδες. Φορτώνεται πρώτο.
 */
document.addEventListener('DOMContentLoaded', () => {

    // σκιά στο navbar μόλις αρχίσει το scroll
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            navbar.classList.toggle('scrolled', window.scrollY > 10);
        }, { passive: true });
    }

    // κουμπί "πάνω-πάνω" που εμφανίζεται μετά από λίγο scroll
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
