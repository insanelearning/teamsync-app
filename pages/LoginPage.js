

export function renderLoginPage(container, { onLogin, teamMembers, appSettings }) {
    container.innerHTML = '';
    container.className = 'login-page-container';

    const loginBox = document.createElement('div');
    loginBox.className = 'login-box';

    const logoUrl = appSettings?.appLogoUrl;
    const appName = appSettings?.appName || 'TeamSync';

    loginBox.innerHTML = `
        <div class="login-logo">
            ${logoUrl 
                ? `<img src="${logoUrl}" alt="Logo" class="navbar-logo-image"/>` 
                : `<i class="fas fa-sync-alt navbar-logo-icon"></i>`
            }
            <span>${appName}</span>
        </div>
        <h2 class="login-title">Sign in to your account</h2>
        <p class="login-subtitle">Enter your email address to continue.</p>
    `;

    const form = document.createElement('form');
    form.className = 'login-form';
    
    const errorMsg = document.createElement('p');
    errorMsg.className = 'login-error-message';
    errorMsg.style.display = 'none';

    const emailGroup = document.createElement('div');
    emailGroup.innerHTML = `<label for="email" class="form-label">Email</label>`;
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.id = 'email';
    emailInput.name = 'email';
    emailInput.className = 'form-input';
    emailInput.placeholder = 'you@example.com';
    emailInput.required = true;
    emailGroup.appendChild(emailInput);
    
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'button button-primary button-lg';
    submitButton.style.width = '100%';
    submitButton.textContent = 'Login';

    form.append(errorMsg, emailGroup, submitButton);

    form.onsubmit = (e) => {
        e.preventDefault();
        const email = emailInput.value.trim().toLowerCase();
        if (!email) return;

        const member = teamMembers.find(m => m.email && m.email.toLowerCase() === email);
        
        if (member) {
            onLogin(member);
        } else {
            errorMsg.textContent = 'Invalid email address.';
            errorMsg.style.display = 'block';
            emailInput.focus();
        }
    };

    loginBox.appendChild(form);
    container.appendChild(loginBox);
}
