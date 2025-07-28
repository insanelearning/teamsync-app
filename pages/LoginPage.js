

export function renderLoginPage(container, { onLogin, teamMembers, appSettings }) {
    container.innerHTML = '';
    container.className = 'login-page-container';

    const loginBox = document.createElement('div');
    loginBox.className = 'login-box';

    const loginLogoDiv = document.createElement('div');
    loginLogoDiv.className = 'login-logo';
    
    // Dynamic branding logic similar to Navbar
    const appName = appSettings?.appName || 'TeamSync';
    if (appSettings?.appLogoUrl) {
        // Using navbar-logo-image class to ensure consistent styling
        loginLogoDiv.innerHTML = `<img src="${appSettings.appLogoUrl}" alt="Logo" class="navbar-logo-image"/> <span>${appName}</span>`;
    } else {
        loginLogoDiv.innerHTML = `<i class="fas fa-sync-alt navbar-logo-icon"></i> <span>${appName}</span>`;
    }

    const titleElement = document.createElement('h2');
    titleElement.className = 'login-title';
    titleElement.textContent = 'Sign in to your account';

    const subtitleElement = document.createElement('p');
    subtitleElement.className = 'login-subtitle';
    subtitleElement.textContent = 'Enter your email address to continue.';

    loginBox.append(loginLogoDiv, titleElement, subtitleElement);

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
