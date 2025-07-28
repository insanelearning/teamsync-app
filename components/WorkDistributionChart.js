
import { Button } from './Button.js';

function formatMinutes(minutes) {
    const totalMinutes = Math.round(minutes);
    if (isNaN(totalMinutes) || totalMinutes < 0) return '0h 0m';
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
}

export function WorkDistributionChart({ title, data, onBarClick, drilldownTitle, onBackClick }) {
    const container = document.createElement('div');
    container.className = 'work-distribution-analysis';

    const header = document.createElement('div');
    header.className = 'chart-header-container';

    const titleElement = document.createElement('h3');
    titleElement.className = 'chart-title';

    if (drilldownTitle) {
        titleElement.textContent = drilldownTitle;
        const backButton = Button({
            variant: 'ghost',
            size: 'sm',
            leftIcon: '<i class="fas fa-arrow-left"></i>',
            children: 'Back',
            className: 'chart-back-button',
            onClick: onBackClick,
        });
        header.appendChild(backButton);
    } else {
        titleElement.textContent = title;
    }
    header.appendChild(titleElement);
    container.appendChild(header);

    const chartContainer = document.createElement('div');
    chartContainer.className = 'bar-chart-container';

    if (!data || data.length === 0) {
        chartContainer.innerHTML = `<p class="bar-chart-empty">No data to display for the selected filters.</p>`;
        container.appendChild(chartContainer);
        return container;
    }

    const totalValue = data.reduce((sum, item) => sum + item.value, 0);

    data.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'bar-chart-item';
        if (onBarClick) {
            itemElement.classList.add('clickable');
            itemElement.onclick = () => onBarClick(item.label);
        }

        const label = document.createElement('div');
        label.className = 'bar-chart-label';
        label.textContent = item.label;
        label.title = item.label;

        const barWrapper = document.createElement('div');
        barWrapper.className = 'bar-chart-bar-wrapper';
        const barFill = document.createElement('div');
        barFill.className = 'bar-chart-bar-fill';
        barFill.style.backgroundColor = item.color || 'var(--color-primary)';
        // Defer width setting for transition effect
        setTimeout(() => {
            barFill.style.width = totalValue > 0 ? `${(item.value / totalValue) * 100}%` : '0%';
        }, 10);
        barWrapper.appendChild(barFill);

        const valueLabel = document.createElement('div');
        valueLabel.className = 'bar-chart-value-label';
        const percentage = totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : '0.0';
        valueLabel.innerHTML = `${formatMinutes(item.value)} <span class="percentage">(${percentage}%)</span>`;

        itemElement.append(label, barWrapper, valueLabel);
        chartContainer.appendChild(itemElement);
    });

    container.appendChild(chartContainer);
    return container;
}
