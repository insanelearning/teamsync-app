

import { Button } from './Button.js';
import { TeamMemberRole } from '../types.js';

export function Navbar({ currentView, onNavChange, onThemeToggle, currentUser, onLogout, appSettings }) {
  const navItems = [
    { view: 'dashboard', label: 'Dashboard', icon: 'fas fa-home' },
    { view: 'projects', label: 'Projects', icon: 'fas fa-tasks' },
    { view: 'attendance', label: 'Attendance', icon: 'fas fa-user-check' },
    { view: 'worklog', label: 'Work Log', icon: 'fas fa-clock' },
    { view: 'notes', label: 'Notes', icon: 'fas fa-sticky-note' },
  ];

  if (currentUser && currentUser.role === TeamMemberRole.Manager) {
    navItems.push({ view: 'admin', label: 'Admin', icon: 'fas fa-cogs' });
  }

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

  if (appSettings?.appLogoUrl) {
    logoSpan.innerHTML = `<img src="${appSettings.appLogoUrl}" alt="Logo" class="navbar-logo-image"/> ${appSettings.appName || 'TeamSync'}`;
  } else {
    logoSpan.innerHTML = `<i class="fas fa-sync-alt navbar-logo-icon"></i>${appSettings?.appName || 'TeamSync'}`;
  }

  logoShrinkDiv.appendChild(logoSpan);
  logoDiv.appendChild(logoShrinkDiv);
  leftSection.appendChild(logoDiv);
  flexDiv.appendChild(leftSection);
  
  // --- Right Section (Menu, Logout, Theme Toggle, Mobile Button) ---
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
  
  // Logout Button (replaces user profile menu)
  if (currentUser) {
    const logoutContainer = document.createElement('div');
    logoutContainer.className = 'navbar-logout-container';

    const logoutButton = Button({
      variant: 'secondary',
      size: 'sm',
      onClick: onLogout,
      leftIcon: '<i class="fas fa-sign-out-alt"></i>',
      children: 'Logout'
    });
    logoutContainer.appendChild(logoutButton);
    rightSection.appendChild(logoutContainer);
  }

  // Theme Toggle Button
  const themeToggleButton = document.createElement('button');
  themeToggleButton.className = 'theme-toggle-button';
  themeToggleButton.setAttribute('aria-label', 'Toggle dark mode');
  const isCurrentlyDark = document.documentElement.classList.contains('dark');
  themeToggleButton.innerHTML = isCurrentlyDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  
  const isThemeEnforced = appSettings.defaultTheme && appSettings.defaultTheme !== 'User Choice';
  themeToggleButton.disabled = isThemeEnforced;
  if(isThemeEnforced) {
    themeToggleButton.title = `Theme is set to "${appSettings.defaultTheme}" by the administrator.`;
  }

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
  
  // Add mobile logout button if logged in
  if (currentUser) {
      const separator = document.createElement('hr');
      separator.className = 'navbar-mobile-menu-separator';
      mobileMenuItemsDiv.appendChild(separator);

      const logoutButtonMobile = document.createElement('button');
      logoutButtonMobile.onclick = () => {
          onLogout();
          mobileMenuOpen = false; // Close menu
          mobileMenuContainer.style.display = 'none';
      }
      logoutButtonMobile.className = 'nav-item-mobile';
      logoutButtonMobile.innerHTML = `<i class="fas fa-sign-out-alt nav-item-icon"></i>Logout`;
      mobileMenuItemsDiv.appendChild(logoutButtonMobile);
  }

  mobileMenuContainer.appendChild(mobileMenuItemsDiv);
  navElement.appendChild(mobileMenuContainer);

  return navElement;
}
