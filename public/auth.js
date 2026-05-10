document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const toggleRegisterBtn = document.getElementById('toggle-register');
    const authMessage = document.getElementById('auth-message');

    // --- ΝΕΟ: Διαβάζουμε πού ήθελε να πάει ο χρήστης από το URL! ---
    const urlParams = new URLSearchParams(window.location.search);
    const redirectTarget = urlParams.get('redirect') || 'index.html'; // Αν δεν βρει κάτι, πάει index

    // Εναλλαγή μεταξύ Login και Register
    toggleRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.style.display = registerForm.style.display === 'none' ? 'block' : 'none';
    });

    // --- ΛΕΙΤΟΥΡΓΙΑ LOGIN ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch('http://localhost:3000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const result = await response.json();

            if (response.ok) {
                localStorage.setItem('user', JSON.stringify(result.user));
                authMessage.style.color = 'var(--primary-color)';
                authMessage.textContent = 'Επιτυχής σύνδεση! Μεταφορά...';

                // Τον στέλνουμε κατευθείαν εκεί που ήθελε!
                setTimeout(() => window.location.href = redirectTarget, 1000);
            } else {
                authMessage.style.color = 'red';
                authMessage.textContent = result.error;
            }
        } catch (error) {
            authMessage.textContent = 'Πρόβλημα σύνδεσης με τον server.';
        }
    });

    // --- ΛΕΙΤΟΥΡΓΙΑ REGISTER ---
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;

        try {
            const response = await fetch('http://localhost:3000/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            const result = await response.json();

            if (response.ok) {
                localStorage.setItem('user', JSON.stringify(result.user));
                authMessage.style.color = 'var(--primary-color)';
                authMessage.textContent = 'Η εγγραφή ολοκληρώθηκε!';

                // Τον στέλνουμε κατευθείαν εκεί που ήθελε!
                setTimeout(() => window.location.href = redirectTarget, 1000);
            } else {
                authMessage.style.color = 'red';
                authMessage.textContent = result.error;
            }
        } catch (error) {
            authMessage.textContent = 'Πρόβλημα σύνδεσης με τον server.';
        }
    });
});