document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const toggleRegisterBtn = document.getElementById('toggle-register');
    const authMessage = document.getElementById('auth-message');

    // Νέα στοιχεία που προσθέσαμε
    const authTitle = document.getElementById('auth-title');
    const registerSection = document.getElementById('register-section');

    const urlParams = new URLSearchParams(window.location.search);
    const redirectTarget = urlParams.get('redirect') || 'index.html';
    const adminSwitchSection = document.getElementById('admin-switch-section');

    if (redirectTarget === 'admin.html') {
        authTitle.textContent = 'Είσοδος Διαχειριστή';
        if (registerSection) registerSection.style.display = 'none';
        if (adminSwitchSection) adminSwitchSection.style.display = 'none'; // Κρύβουμε το link αν είμαστε ήδη εδώ
    }

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
            // ΣΙΓΟΥΡΕΥΟΜΑΣΤΕ ΟΤΙ ΧΤΥΠΑΕΙ ΣΤΟ LOCALHOST:3000
            const response = await fetch('http://localhost:3000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const result = await response.json();

            if (response.ok) {
                // Έλεγχος Δικαιωμάτων Admin
                if (redirectTarget === 'admin.html' && result.user.role !== 'admin') {
                    authMessage.style.color = 'red';
                    authMessage.textContent = 'Πρόσβαση αρνήθηκε: Δεν έχετε δικαιώματα διαχειριστή!';
                    return;
                }

                localStorage.setItem('user', JSON.stringify(result.user));
                authMessage.style.color = 'var(--primary-color)';
                authMessage.textContent = 'Επιτυχής σύνδεση! Μεταφορά...';

                setTimeout(() => window.location.href = redirectTarget, 1000);
            } else {
                authMessage.style.color = 'red';
                authMessage.textContent = result.error;
            }
        } catch (error) {
            console.error(error); // Για να βλέπεις το λάθος στο Console
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
                // ΣΙΓΟΥΡΕΥΟΜΑΣΤΕ ΟΤΙ ΧΤΥΠΑΕΙ ΣΤΟ LOCALHOST:3000
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

                    setTimeout(() => window.location.href = redirectTarget, 1000);
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