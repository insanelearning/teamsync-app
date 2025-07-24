
export function CelebrationsWidget({ celebrations }) {
    if (!celebrations || celebrations.length === 0) {
        return document.createDocumentFragment(); // Return an empty fragment if no celebrations
    }

    const container = document.createElement('div');
    container.className = 'celebrations-widget';
    
    const header = document.createElement('div');
    header.className = 'celebrations-header';
    header.innerHTML = `<i class="fas fa-gift"></i> Today's Celebrations`;
    container.appendChild(header);

    const list = document.createElement('div');
    list.className = 'celebrations-list';
    
    celebrations.forEach(celeb => {
        const item = document.createElement('div');
        item.className = 'celebration-item';
        
        let iconHtml = '';
        let textHtml = '';

        if (celeb.type === 'birthday') {
            iconHtml = `<i class="fas fa-birthday-cake celebration-icon"></i>`;
            textHtml = `Happy Birthday to <strong>${celeb.memberName}</strong>!`;
        } else if (celeb.type === 'anniversary') {
            iconHtml = `<i class="fas fa-award celebration-icon"></i>`;
            const yearText = celeb.years === 1 ? 'year' : 'years';
            textHtml = `Congratulations to <strong>${celeb.memberName}</strong> on their <strong>${celeb.years}-${yearText}</strong> work anniversary!`;
        }

        item.innerHTML = `${iconHtml}<div class="celebration-item-text">${textHtml}</div>`;
        list.appendChild(item);
    });

    container.appendChild(list);
    return container;
}
