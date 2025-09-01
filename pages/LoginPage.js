
export function renderLoginPage(container, { onLogin, teamMembers, appSettings }) {
    container.innerHTML = '';
    container.className = 'login-page-container';

    // --- Animated Background ---
    const bgContainer = document.createElement('div');
    bgContainer.className = 'login-bg';
    for (let i = 0; i < 15; i++) {
        const shape = document.createElement('div');
        shape.className = 'shape';
        const size = Math.random() * 80 + 20;
        shape.style.width = `${size}px`;
        shape.style.height = `${size}px`;
        shape.style.left = `${Math.random() * 100}%`;
        shape.style.animationDuration = `${Math.random() * 15 + 15}s`;
        shape.style.animationDelay = `${Math.random() * 5}s`;
        bgContainer.appendChild(shape);
    }
    container.appendChild(bgContainer);
    
    // --- New Login Wrapper for Panda and Card ---
    const loginWrapper = document.createElement('div');
    loginWrapper.className = 'login-wrapper';

    // --- Panda Elements ---
    const pandaHead = document.createElement('div');
    pandaHead.className = 'panda-head';
    pandaHead.innerHTML = `
        <div class="panda-ear-left"></div>
        <div class="panda-ear-right"></div>
        <div class="panda-face">
            <div class="panda-eye left">
                <div class="panda-pupil"></div>
            </div>
            <div class="panda-eye right">
                <div class="panda-pupil"></div>
            </div>
        </div>
    `;

    const pandaPawLeft = document.createElement('div');
    pandaPawLeft.className = 'panda-paw-left';

    const pandaPawRight = document.createElement('div');
    pandaPawRight.className = 'panda-paw-right';
    
    // --- Login Box ---
    const loginBox = document.createElement('div');
    loginBox.className = 'login-box';

    const appName = appSettings?.appName || 'TeamSync';

    const titleElement = document.createElement('h2');
    titleElement.className = 'login-title';
    titleElement.textContent = `Welcome to ${appName}`;

    const subtitleElement = document.createElement('p');
    subtitleElement.className = 'login-subtitle';
    subtitleElement.textContent = 'Enter your credentials to continue.';

    loginBox.append(titleElement, subtitleElement);

    const form = document.createElement('form');
    form.className = 'login-form';
    
    const errorMsg = document.createElement('p');
    errorMsg.className = 'login-error-message';
    errorMsg.style.display = 'none';

    // --- Email Floating Label Input ---
    const emailGroup = document.createElement('div');
    emailGroup.className = 'form-group';
    
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.id = 'email';
    emailInput.name = 'email';
    emailInput.className = 'form-input';
    emailInput.placeholder = ' '; // Important for the CSS selector
    emailInput.required = true;
    
    const emailLabel = document.createElement('label');
    emailLabel.htmlFor = 'email';
    emailLabel.className = 'form-label';
    emailLabel.textContent = 'Email Address';
    
    emailGroup.append(emailInput, emailLabel);
    
    // --- Password Floating Label Input with Visibility Toggle ---
    const passwordGroup = document.createElement('div');
    passwordGroup.className = 'form-group';

    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.id = 'password';
    passwordInput.name = 'password';
    passwordInput.className = 'form-input';
    passwordInput.placeholder = ' '; // For floating label
    passwordInput.required = true;

    const passwordLabel = document.createElement('label');
    passwordLabel.htmlFor = 'password';
    passwordLabel.className = 'form-label';
    passwordLabel.textContent = 'Password';

    const passwordToggle = document.createElement('button');
    passwordToggle.type = 'button';
    passwordToggle.className = 'password-toggle-btn';
    passwordToggle.setAttribute('aria-label', 'Toggle password visibility');
    passwordToggle.innerHTML = '<i class="fas fa-eye"></i>';

    passwordToggle.onclick = () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        passwordToggle.innerHTML = isPassword ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
    };

    passwordGroup.append(passwordInput, passwordLabel, passwordToggle);

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

        const member = teamMembers.find(m => m.email && m.email.toLowerCase() === email);
        
        // IMPORTANT: In a real application, passwords should be hashed.
        // This is a plain-text comparison for demonstration purposes only.
        if (member && member.password === password) {
            onLogin(member);
        } else {
            errorMsg.textContent = 'Invalid email or password.';
            errorMsg.style.display = 'block';
            emailInput.focus();
        }
    };

    loginBox.appendChild(form);
    
    // Assemble the final structure
    loginWrapper.append(pandaHead, loginBox, pandaPawLeft, pandaPawRight);
    container.appendChild(loginWrapper);

    // --- Panda Interaction Logic ---
    const pupils = pandaHead.querySelectorAll('.panda-pupil');
    
    const handleFocus = () => {
        pandaHead.classList.add('is-focused');
    };

    const handleBlur = () => {
        pandaHead.classList.remove('is-focused');
        pupils.forEach(p => {
            p.style.transform = 'translate(0, 0)';
        });
    };

    const handleInput = (e) => {
        const input = e.target;
        // Calculate the percentage of the cursor's position within the input
        // Use a fixed max length for consistent movement range
        const maxLength = 30; 
        const percentage = Math.min(input.selectionStart / maxLength, 1);
        
        // Calculate pupil movement range: -8px to 8px horizontally.
        const pupilX = (percentage * 16) - 8;
        // A slight downward look when typing
        const pupilY = 2;

        pupils.forEach(p => {
            p.style.transform = `translate(${pupilX}px, ${pupilY}px)`;
        });
    };

    emailInput.addEventListener('focus', handleFocus);
    emailInput.addEventListener('blur', handleBlur);
    passwordInput.addEventListener('focus', handleFocus);
    passwordInput.addEventListener('blur', handleBlur);
    
    // Track typing in both fields for a more responsive feel
    emailInput.addEventListener('input', handleInput);
    passwordInput.addEventListener('input', handleInput);
}
