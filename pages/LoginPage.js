

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
    
    // --- Login Box ---
    const loginBox = document.createElement('div');
    loginBox.className = 'login-box';

    // --- Animated Mascot "Synco" ---
    const mascotSVG = `
        <svg id="login-mascot" class="login-mascot" viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg">
            <g>
                <path d="M20,78 C10,78 10,70 10,70 L10,45 C10,35 20,35 20,35 L80,35 C90,35 90,45 90,45 L90,70 C90,70 90,78 80,78 L20,78 Z" fill="#D1D5DB"/>
                <rect x="25" y="45" width="50" height="15" rx="4" fill="#6B7280"/>
                <circle cx="35" cy="25" r="15" fill="#E5E7EB"/>
                <circle cx="65" cy="25" r="15" fill="#E5E7EB"/>
                <g class="eye">
                    <circle cx="35" cy="25" r="8" fill="#FFFFFF"/>
                    <circle class="pupil" cx="35" cy="25" r="4" fill="#111827"/>
                </g>
                <g class="eye">
                    <circle cx="65" cy="25" r="8" fill="#FFFFFF"/>
                    <circle class="pupil" cx="65" cy="25" r="4" fill="#111827"/>
                </g>
                <line x1="50" y1="10" x2="50" y2="0" stroke="#9CA3AF" stroke-width="2"/>
                <circle cx="50" cy="10" r="3" fill="#9CA3AF"/>
            </g>
        </svg>
    `;
    loginBox.innerHTML = mascotSVG;

    const appName = appSettings?.appName || 'TeamSync';

    const titleElement = document.createElement('h2');
    titleElement.className = 'login-title';
    titleElement.textContent = `Welcome to ${appName}`;

    const subtitleElement = document.createElement('p');
    subtitleElement.className = 'login-subtitle';
    subtitleElement.textContent = 'Enter your email to continue.';

    loginBox.append(titleElement, subtitleElement);

    const form = document.createElement('form');
    form.className = 'login-form';
    
    const errorMsg = document.createElement('p');
    errorMsg.className = 'login-error-message';
    errorMsg.style.display = 'none';

    // --- Floating Label Input ---
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

    // --- Mascot Animation Logic ---
    const mascot = container.querySelector('#login-mascot');
    if (mascot) {
        const eyes = Array.from(mascot.querySelectorAll('.eye'));
        const pupils = Array.from(mascot.querySelectorAll('.pupil'));
        const maxPupilMove = 3;

        const moveEyes = (event) => {
            const { clientX, clientY } = event;
            eyes.forEach((eye, index) => {
                const rect = eye.getBoundingClientRect();
                const eyeCenterX = rect.left + rect.width / 2;
                const eyeCenterY = rect.top + rect.height / 2;

                const deltaX = clientX - eyeCenterX;
                const deltaY = clientY - eyeCenterY;

                const angle = Math.atan2(deltaY, deltaX);
                const distance = Math.min(maxPupilMove, Math.sqrt(deltaX * deltaX + deltaY * deltaY) / 20);

                const pupilX = Math.cos(angle) * distance;
                const pupilY = Math.sin(angle) * distance;

                pupils[index].style.transform = `translate(${pupilX}px, ${pupilY}px)`;
            });
        };
        window.addEventListener('mousemove', moveEyes);
    }
}
