

import { Button } from './Button.js';
import { TeamMemberRole } from '../types.js';
import { NotificationPanel } from './NotificationPanel.js';

let isNotificationPanelOpen = false;

export function Navbar(props) {
  const { 
    currentView, onNavChange, onThemeToggle, currentUser, onLogout,
    notifications, onMarkNotificationRead, onMarkAllNotificationsRead, onClearAllNotifications
  } = props;

  const isManager = currentUser?.role === TeamMemberRole.Manager;

  const navItems = [
    { view: 'dashboard', label: 'Dashboard', icon: 'fas fa-home', managerOnly: false },
    { view: 'projects', label: 'Projects', icon: 'fas fa-tasks', managerOnly: false },
    { view: 'attendance', label: 'Attendance', icon: 'fas fa-user-check', managerOnly: false },
    { view: 'worklog', label: 'Work Log', icon: 'fas fa-clock', managerOnly: false },
    { view: 'notes', label: 'Notes', icon: 'fas fa-sticky-note', managerOnly: false },
    { view: 'settings', label: 'Settings', icon: 'fas fa-cog', managerOnly: true },
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
  
  // --- Right Section (Menu, Notifications, Logout, Theme Toggle, Mobile Button) ---
  const rightSection = document.createElement('div');
  rightSection.className = 'navbar-right-section';

  // Desktop Menu
  const desktopMenuDiv = document.createElement('div');
  desktopMenuDiv.className = 'navbar-desktop-menu';
  const desktopMenuItemsDiv = document.createElement('div');
  desktopMenuItemsDiv.className = 'navbar-desktop-items';
  navItems.forEach(item => {
    if (item.managerOnly && !isManager) return;
    const button = document.createElement('button');
    button.onclick = () => onNavChange(item.view);
    button.className = `nav-item ${currentView === item.view ? 'nav-item-active' : ''}`;
    button.innerHTML = `<i class="${item.icon} nav-item-icon"></i>${item.label}`;
    desktopMenuItemsDiv.appendChild(button);
  });
  desktopMenuDiv.appendChild(desktopMenuItemsDiv);
  rightSection.appendChild(desktopMenuDiv);
  
  // --- Notifications Button and Panel ---
  if (currentUser) {
    const notificationContainer = document.createElement('div');
    notificationContainer.className = 'notification-container';

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const notificationButton = document.createElement('button');
    notificationButton.className = 'notification-button';
    notificationButton.setAttribute('aria-label', `Notifications (${unreadCount} unread)`);
    notificationButton.innerHTML = `<i class="fas fa-bell"></i>`;
    if (unreadCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'notification-badge';
        notificationButton.appendChild(badge);
    }
    notificationButton.onclick = (e) => {
        e.stopPropagation();
        isNotificationPanelOpen = !isNotificationPanelOpen;
        const panel = navElement.querySelector('.notification-panel');
        if (panel) {
            panel.style.display = isNotificationPanelOpen ? 'block' : 'none';
        }
    };
    notificationContainer.appendChild(notificationButton);

    const notificationPanel = NotificationPanel({
      notifications,
      isOpen: isNotificationPanelOpen,
      onMarkRead: onMarkNotificationRead,
      onMarkAllRead: onMarkAllNotificationsRead,
      onClearAll: onClearAllNotifications,
      onNotificationClick: (link) => {
          // Parse link like "view=projects&projectId=xyz"
          const params = new URLSearchParams(link);
          const view = params.get('view');
          const projectId = params.get('projectId');
          // For now, only handle project links
          if (view) {
              onNavChange(view, { projectId });
          }
          // Close panel on click
          isNotificationPanelOpen = false;
          const panel = navElement.querySelector('.notification-panel');
          if (panel) panel.style.display = 'none';
      }
    });
    notificationPanel.style.display = isNotificationPanelOpen ? 'block' : 'none';
    notificationContainer.appendChild(notificationPanel);
    rightSection.appendChild(notificationContainer);
  }

  // Logout Button
  if (currentUser) {
    const logoutContainer = document.createElement('div');
    logoutContainer.className = 'navbar-logout-container';
    const logoutButton = Button({
      variant: 'secondary', size: 'sm', onClick: onLogout,
      leftIcon: '<i class="fas fa-sign-out-alt"></i>', children: 'Logout'
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
    if (item.managerOnly && !isManager) return;
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

  document.body.addEventListener('click', (e) => {
      const panel = navElement.querySelector('.notification-panel');
      const container = navElement.querySelector('.notification-container');
      if (isNotificationPanelOpen && panel && container && !container.contains(e.target)) {
          isNotificationPanelOpen = false;
          panel.style.display = 'none';
      }
  });

  return navElement;
}
