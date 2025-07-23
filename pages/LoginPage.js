
export function renderLoginPage(container, { onLogin, teamMembers, error }) {
    container.innerHTML = '';
    container.className = 'login-page-container';

    const loginBox = document.createElement('div');
    loginBox.className = 'login-box';

    loginBox.innerHTML = `
        <div class="login-logo">
            <i class="fas fa-sync-alt navbar-logo-icon"></i>
            <span>TeamSync</span>
        </div>
        <h2 class="login-title">Sign in to your account</h2>
        <p class="login-subtitle">Enter your email and password to continue.</p>
    `;

    const form = document.createElement('form');
    form.className = 'login-form';
    
    const errorMsg = document.createElement('p');
    errorMsg.className = 'login-error-message';
    
    // Display error message if one is passed from the main app
    if (error) {
        errorMsg.textContent = error;
        errorMsg.style.display = 'block';
    } else {
        errorMsg.style.display = 'none';
    }

    const emailGroup = document.createElement('div');
    emailGroup.innerHTML = `<label for="email" class="form-label">Email</label>`;
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.id = 'email';
    emailInput.name = 'email';
    emailInput.className = 'form-input';
    emailInput.placeholder = 'you@example.com';
    emailInput.required = true;
    emailInput.autocomplete = 'email';
    emailGroup.appendChild(emailInput);

    const passwordGroup = document.createElement('div');
    passwordGroup.innerHTML = `<label for="password" class="form-label">Password</label>`;
    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.id = 'password';
    passwordInput.name = 'password';
    passwordInput.className = 'form-input';
    passwordInput.placeholder = '••••••••';
    passwordInput.required = true;
    passwordInput.autocomplete = 'current-password';
    passwordGroup.appendChild(passwordInput);
    
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'button button-primary button-lg';
    submitButton.style.width = '100%';
    submitButton.textContent = 'Login';

    form.append(errorMsg, emailGroup, passwordGroup, submitButton);

    form.onsubmit = (e) => {
        e.preventDefault();
        const email = emailInput.value.trim().toLowerCase();
        const password = passwordInput.value;
        if (!email || !password) return;
        
        // Pass credentials up to the main app controller
        onLogin(email, password);
    };

    loginBox.appendChild(form);
    container.appendChild(loginBox);
}
