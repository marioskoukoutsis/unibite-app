document.addEventListener('DOMContentLoaded', () => {
    // 1. Έλεγχος: Αν είναι ήδη συνδεδεμένος, προσπερνάει το Login!
    if (localStorage.getItem('user')) {
        window.location.href = 'index.html';
        return;
    }

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const toggleRegisterBtn = document.getElementById('toggle-register');
    const authMessage = document.getElementById('auth-message');

    // Εναλλαγή μεταξύ Login και Register
    if (toggleRegisterBtn) {
        toggleRegisterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            registerForm.style.display = registerForm.style.display === 'none' ? 'block' : 'none';
        });
    }

    // Λειτουργία Εμφάνισης Κωδικού
    document.getElementById('show-login-pass').addEventListener('change', function() {
        document.getElementById('login-password').type = this.checked ? 'text' : 'password';
    });

    const showRegPass = document.getElementById('show-reg-pass');
    if (showRegPass) {
        showRegPass.addEventListener('change', function() {
            document.getElementById('reg-password').type = this.checked ? 'text' : 'password';
        });
    }

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
                // Αποθηκεύουμε τον χρήστη (είτε είναι student είτε admin)
                localStorage.setItem('user', JSON.stringify(result.user));
                authMessage.style.color = 'var(--primary-color)';
                authMessage.textContent = 'Επιτυχής σύνδεση! Μεταφορά...';

                // Όλοι πάνε στο κεντρικό Hub!
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

    // --- ΛΕΙΤΟΥΡΓΙΑ REGISTER ---
    if (registerForm) {
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

                    // Και οι νέοι χρήστες πάνε στο κεντρικό Hub!
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