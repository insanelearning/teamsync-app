

export function Navbar({ currentView, onNavChange, onThemeToggle, currentUser, onLogout }) {
  const navItems = [
    { view: 'dashboard', label: 'Dashboard', icon: 'fas fa-home' },
    { view: 'projects', label: 'Projects', icon: 'fas fa-tasks' },
    { view: 'attendance', label: 'Attendance', icon: 'fas fa-user-check' },
    { view: 'worklog', label: 'Work Log', icon: 'fas fa-clock' },
    { view: 'notes', label: 'Notes', icon: 'fas fa-sticky-note' },
  ];

  const navElement = document.createElement('nav');
  navElement.className = 'navbar';

  const containerDiv = document.createElement('div');
  containerDiv.className = 'navbar-container';
  navElement.appendChild(containerDiv);

  const flexDiv = document.createElement('div');
  flexDiv.className = 'navbar-flex';
  containerDiv.appendChild(flexDiv);

  // --- Left Section (Logo only) ---
  const leftSection = document.createElement('div');
  leftSection.className = 'navbar-left-section';
  
  const logoDiv = document.createElement('div');
  logoDiv.className = 'navbar-logo-area';
  const logoShrinkDiv = document.createElement('div');
  logoShrinkDiv.className = 'navbar-logo-shrink';
  const logoSpan = document.createElement('span');
  logoSpan.className = 'navbar-logo-text';
  logoSpan.innerHTML = '<i class="fas fa-sync-alt navbar-logo-icon"></i>TeamSync';
  logoShrinkDiv.appendChild(logoSpan);
  logoDiv.appendChild(logoShrinkDiv);
  leftSection.appendChild(logoDiv);
  flexDiv.appendChild(leftSection);
  
  // --- Right Section (Menu, User Profile, Theme Toggle, Mobile Button) ---
  const rightSection = document.createElement('div');
  rightSection.className = 'navbar-right-section';

  // Desktop Menu
  const desktopMenuDiv = document.createElement('div');
  desktopMenuDiv.className = 'navbar-desktop-menu';
  const desktopMenuItemsDiv = document.createElement('div');
  desktopMenuItemsDiv.className = 'navbar-desktop-items';
  navItems.forEach(item => {
    const button = document.createElement('button');
    button.onclick = () => onNavChange(item.view);
    button.className = `nav-item ${currentView === item.view ? 'nav-item-active' : ''}`;
    button.innerHTML = `<i class="${item.icon} nav-item-icon"></i>${item.label}`;
    desktopMenuItemsDiv.appendChild(button);
  });
  desktopMenuDiv.appendChild(desktopMenuItemsDiv);
  rightSection.appendChild(desktopMenuDiv);
  
  // User Profile Menu
  if (currentUser) {
    const userProfileDiv = document.createElement('div');
    userProfileDiv.className = 'navbar-user-profile';
    
    const userButton = document.createElement('button');
    userButton.className = 'navbar-user-button';
    userButton.innerHTML = `
        <span class="navbar-user-name">${currentUser.name}</span>
        <i class="fas fa-chevron-down navbar-chevron"></i>
    `;
    
    const userMenu = document.createElement('div');
    userMenu.className = 'navbar-user-menu';
    
    const logoutButton = document.createElement('button');
    logoutButton.className = 'navbar-user-menu-item';
    logoutButton.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
    logoutButton.onclick = onLogout;
    userMenu.appendChild(logoutButton);
    
    userProfileDiv.append(userButton, userMenu);

    let isMenuOpen = false;
    const toggleMenu = (e) => {
        e.stopPropagation();
        isMenuOpen = !isMenuOpen;
        userMenu.style.display = isMenuOpen ? 'block' : 'none';
        userButton.classList.toggle('active', isMenuOpen);
    };

    userButton.addEventListener('click', toggleMenu);

    document.addEventListener('click', (e) => {
        if (isMenuOpen && !userProfileDiv.contains(e.target)) {
            isMenuOpen = false;
            userMenu.style.display = 'none';
            userButton.classList.remove('active');
        }
    }, true); // Use capture phase to handle clicks outside reliably
    
    rightSection.appendChild(userProfileDiv);
  }

  // Theme Toggle Button
  const themeToggleButton = document.createElement('button');
  themeToggleButton.className = 'theme-toggle-button';
  themeToggleButton.setAttribute('aria-label', 'Toggle dark mode');
  const isCurrentlyDark = document.documentElement.classList.contains('dark');
  themeToggleButton.innerHTML = isCurrentlyDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  themeToggleButton.onclick = () => {
    onThemeToggle();
    // The icon will be updated on the next render pass which is triggered by onThemeToggle
  };
  rightSection.appendChild(themeToggleButton);


  // Mobile Menu Button
  const mobileMenuButtonDiv = document.createElement('div');
  mobileMenuButtonDiv.className = 'navbar-mobile-button-area';
  const mobileButton = document.createElement('button');
  mobileButton.className = 'navbar-mobile-button';
  mobileButton.innerHTML = '<i class="fas fa-bars"></i>';
  
  const mobileMenuContainer = document.createElement('div'); 
  mobileMenuContainer.className = 'navbar-mobile-menu'; 
  
  let mobileMenuOpen = false;
  mobileButton.onclick = () => {
      mobileMenuOpen = !mobileMenuOpen;
      mobileMenuContainer.style.display = mobileMenuOpen ? 'block' : 'none';
  };
  mobileMenuButtonDiv.appendChild(mobileButton);
  rightSection.appendChild(mobileMenuButtonDiv);
  
  flexDiv.appendChild(rightSection); // Add the entire right section to the flex container
  
  // Mobile Menu
  const mobileMenuItemsDiv = document.createElement('div');
  mobileMenuItemsDiv.className = 'navbar-mobile-items';
  navItems.forEach(item => {
    const button = document.createElement('button');
    button.onclick = () => {
        onNavChange(item.view);
        mobileMenuOpen = false; // Close menu on selection
        mobileMenuContainer.style.display = 'none';
    }
    button.className = `nav-item-mobile ${currentView === item.view ? 'nav-item-mobile-active' : ''}`;
    button.innerHTML = `<i class="${item.icon} nav-item-icon"></i>${item.label}`;
    mobileMenuItemsDiv.appendChild(button);
  });
  mobileMenuContainer.appendChild(mobileMenuItemsDiv);
  navElement.appendChild(mobileMenuContainer);

  return navElement;
}
