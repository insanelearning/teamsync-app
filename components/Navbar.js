

import { Button } from './Button.js';
import { NotificationType } from '../types.js';

function timeSince(dateString) {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return Math.floor(seconds) + "s ago";
}

function getNotificationIcon(type) {
    switch (type) {
        case NotificationType.NEW_ASSIGNMENT: return 'fa-user-plus';
        case NotificationType.PROJECT_STATUS_CHANGE: return 'fa-tasks';
        case NotificationType.PROJECT_DUE_SOON: return 'fa-clock';
        case NotificationType.PROJECT_OVERDUE: return 'fa-exclamation-triangle';
        default: return 'fa-bell';
    }
}


export function Navbar({ currentView, onNavChange, onThemeToggle, currentUser, onLogout, notifications, onMarkNotificationRead, onMarkAllNotificationsRead }) {
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
  
  // --- Right Section (Menu, Notifications, Logout, Theme Toggle, Mobile Button) ---
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

  // --- Notifications ---
  if (currentUser) {
      const notificationContainer = document.createElement('div');
      notificationContainer.className = 'notification-container';

      const bellButton = document.createElement('button');
      bellButton.className = 'notification-bell-btn';
      bellButton.innerHTML = '<i class="fas fa-bell"></i>';
      
      const userNotifications = (notifications || []).filter(n => n.userId === currentUser.id);
      const unreadCount = userNotifications.filter(n => !n.isRead).length;

      if (unreadCount > 0) {
          const badge = document.createElement('span');
          badge.className = 'notification-badge';
          badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
          bellButton.appendChild(badge);
      }
      
      const notificationPanel = document.createElement('div');
      notificationPanel.className = 'notification-panel';

      const panelHeader = document.createElement('div');
      panelHeader.className = 'notification-panel-header';
      panelHeader.innerHTML = `<h3>Notifications</h3>`;
      const markAllReadBtn = Button({
          children: 'Mark all as read',
          variant: 'ghost',
          size: 'sm',
          onClick: (e) => {
              e.stopPropagation();
              onMarkAllNotificationsRead();
          },
          disabled: unreadCount === 0
      });
      panelHeader.appendChild(markAllReadBtn);
      
      const notificationList = document.createElement('div');
      notificationList.className = 'notification-panel-list';

      if (userNotifications.length > 0) {
          userNotifications
            .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 10) // Show latest 10
            .forEach(notification => {
                const item = document.createElement('div');
                item.className = `notification-item ${notification.isRead ? 'is-read' : ''}`;
                item.innerHTML = `
                    <div class="notification-item-icon">
                        <i class="fas ${getNotificationIcon(notification.type)}"></i>
                    </div>
                    <div class="notification-item-content">
                        <p class="notification-item-message">${notification.message}</p>
                        <span class="notification-item-time">${timeSince(notification.createdAt)}</span>
                    </div>
                `;
                if (!notification.isRead) {
                    const readButton = document.createElement('button');
                    readButton.className = 'notification-item-read-btn';
                    readButton.setAttribute('aria-label', 'Mark as read');
                    readButton.title = 'Mark as read';
                    readButton.onclick = (e) => {
                        e.stopPropagation();
                        onMarkNotificationRead(notification.id);
                    };
                    item.appendChild(readButton);
                }
                notificationList.appendChild(item);
            });
      } else {
          notificationList.innerHTML = `<div class="notification-panel-empty">You're all caught up!</div>`;
      }

      notificationPanel.append(panelHeader, notificationList);
      
      bellButton.onclick = (e) => {
          e.stopPropagation();
          notificationPanel.classList.toggle('show');
      };
      
      document.addEventListener('click', (e) => {
          if (!notificationContainer.contains(e.target)) {
              notificationPanel.classList.remove('show');
          }
      });
      
      notificationContainer.append(bellButton, notificationPanel);
      rightSection.appendChild(notificationContainer);
  }
  
  // Logout Button
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
  themeToggleButton.onclick = () => {
    onThemeToggle();
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
        mobileMenuOpen = false;
        mobileMenuContainer.style.display = 'none';
    }
    button.className = `nav-item-mobile ${currentView === item.view ? 'nav-item-mobile-active' : ''}`;
    button.innerHTML = `<i class="${item.icon} nav-item-icon"></i>${item.label}`;
    mobileMenuItemsDiv.appendChild(button);
  });
  
  if (currentUser) {
      const separator = document.createElement('hr');
      separator.className = 'navbar-mobile-menu-separator';
      mobileMenuItemsDiv.appendChild(separator);

      const logoutButtonMobile = document.createElement('button');
      logoutButtonMobile.onclick = () => {
          onLogout();
          mobileMenuOpen = false;
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
