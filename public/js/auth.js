document.addEventListener('DOMContentLoaded', () => {
    // ήδη συνδεδεμένος → κατευθείαν στην αρχική
    if (localStorage.getItem('user')) {
        window.location.href = 'index.html';
        return;
    }

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const toggleRegisterBtn = document.getElementById('toggle-register');
    const authMessage = document.getElementById('auth-message');

    // εναλλαγή φόρμας login / register
    if (toggleRegisterBtn) {
        toggleRegisterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            registerForm.style.display = registerForm.style.display === 'none' ? 'block' : 'none';
        });
    }

    // εμφάνιση/απόκρυψη κωδικού
    document.getElementById('show-login-pass').addEventListener('change', function() {
        document.getElementById('login-password').type = this.checked ? 'text' : 'password';
    });

    const showRegPass = document.getElementById('show-reg-pass');
    if (showRegPass) {
        showRegPass.addEventListener('change', function() {
            document.getElementById('reg-password').type = this.checked ? 'text' : 'password';
        });
    }

    // Σύνδεση
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (response.ok) {
                // κρατάμε τον χρήστη τοπικά (student ή admin)
                localStorage.setItem('user', JSON.stringify(result.user));
                authMessage.style.color = 'var(--primary-color)';
                authMessage.textContent = 'Επιτυχής σύνδεση! Μεταφορά...';

                setTimeout(() => window.location.href = 'index.html', 1000);
            } else {
                authMessage.style.color = 'red';
                authMessage.textContent = result.error;
            }
        } catch (error) {
            console.error(error);
            authMessage.textContent = 'Πρόβλημα σύνδεσης με τον server.';
        }
    });

    // Εγγραφή
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });
                const result = await response.json();

                if (response.ok) {
                    localStorage.setItem('user', JSON.stringify(result.user));
                    authMessage.style.color = 'var(--primary-color)';
                    authMessage.textContent = 'Η εγγραφή ολοκληρώθηκε!';

                    setTimeout(() => window.location.href = 'index.html', 1000);
                } else {
                    authMessage.style.color = 'red';
                    authMessage.textContent = result.error;
                }
            } catch (error) {
                console.error(error);
                authMessage.textContent = 'Πρόβλημα σύνδεσης με τον server.';
            }
        });
    }
});