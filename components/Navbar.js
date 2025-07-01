
export function Navbar({ currentView, onNavChange, onThemeToggle }) {
  const navItems = [
    { view: 'projects', label: 'Projects', icon: 'fas fa-tasks' },
    { view: 'attendance', label: 'Attendance', icon: 'fas fa-user-check' },
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
  leftSection.appendChild(desktopMenuDiv);
  flexDiv.appendChild(leftSection);
  
  const rightSection = document.createElement('div');
  rightSection.className = 'navbar-right-section';

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
  flexDiv.appendChild(rightSection);
  
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