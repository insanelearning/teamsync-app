import { Button } from './Button.js';

function timeSince(dateString) {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date() - date) / 1000);

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

export function NotificationPanel({ notifications, isOpen, onMarkRead, onMarkAllRead, onClearAll, onNotificationClick }) {
    const panel = document.createElement('div');
    panel.className = 'notification-panel';
    panel.style.display = isOpen ? 'block' : 'none';

    // Header
    const header = document.createElement('div');
    header.className = 'notification-panel-header';
    const title = document.createElement('h4');
    title.textContent = 'Notifications';
    const markAllReadBtn = Button({
        children: 'Mark all as read',
        variant: 'ghost',
        size: 'sm',
        onClick: (e) => {
            e.stopPropagation();
            onMarkAllRead();
        }
    });
    header.append(title, markAllReadBtn);
    panel.appendChild(header);

    // List
    const list = document.createElement('ul');
    list.className = 'notification-panel-list';

    if (notifications.length === 0) {
        list.innerHTML = `<li class="notification-item" style="justify-content: center; cursor: default;">No notifications yet.</li>`;
    } else {
        notifications.forEach(n => {
            const item = document.createElement('li');
            item.className = `notification-item ${n.isRead ? 'is-read' : ''}`;
            item.onclick = (e) => {
                e.stopPropagation();
                if (!n.isRead) onMarkRead(n.id);
                if (n.link) onNotificationClick(n.link);
            };

            const icon = document.createElement('div');
            icon.className = 'notification-item-icon';
            icon.innerHTML = `<i class="fas fa-info-circle"></i>`; // Generic icon

            const content = document.createElement('div');
            content.className = 'notification-item-content';
            const message = document.createElement('p');
            message.innerHTML = n.message;
            const time = document.createElement('p');
            time.className = 'time';
            time.textContent = timeSince(n.createdAt);
            content.append(message, time);

            const actions = document.createElement('div');
            actions.className = 'notification-item-actions';
            if (!n.isRead) {
                const readDot = document.createElement('div');
                readDot.className = 'read-dot';
                readDot.title = 'Mark as read';
                actions.appendChild(readDot);
            }

            item.append(icon, content, actions);
            list.appendChild(item);
        });
    }
    panel.appendChild(list);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'notification-panel-footer';
    const clearAllBtn = Button({
        children: 'Clear All',
        variant: 'danger',
        size: 'sm',
        onClick: (e) => {
            e.stopPropagation();
            onClearAll();
        }
    });
    footer.appendChild(clearAllBtn);
    panel.appendChild(footer);

    return panel;
}
