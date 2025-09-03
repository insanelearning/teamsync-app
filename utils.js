/**
 * Formats a date string (assumed YYYY-MM-DD) or a Date object into DD-MM-YYYY format.
 * Handles timezone issues by parsing YYYY-MM-DD as a local date.
 * @param {string | Date} dateInput The date to format.
 * @returns {string} The formatted date string, or an empty string if input is invalid.
 */
export function formatDateToIndian(dateInput) {
    if (!dateInput) return '';
    try {
        let date;
        if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            // To avoid timezone issues where new Date('YYYY-MM-DD') can be the previous day,
            // we parse it manually into local time.
            const [year, month, day] = dateInput.split('-').map(Number);
            date = new Date(year, month - 1, day);
        } else {
            date = new Date(dateInput);
        }

        if (isNaN(date.getTime())) {
            return ''; // Invalid date
        }

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();

        return `${day}-${month}-${year}`;
    } catch (e) {
        console.error("Error formatting date:", dateInput, e);
        return String(dateInput); // Return original on error
    }
}

/**
 * Parses a DD-MM-YYYY or DD/MM/YYYY date string into YYYY-MM-DD format.
 * @param {string} indianDateString The date string in DD-MM-YYYY or DD/MM/YYYY format.
 * @returns {string} The date string in YYYY-MM-DD format, or empty string if invalid.
 */
export function parseIndianDate(indianDateString) {
    if (!indianDateString || typeof indianDateString !== 'string') return '';
    const parts = indianDateString.split(/[-/]/);
    if (parts.length !== 3) return '';

    const [day, month, year] = parts;
    
    // Basic validation
    if (String(day).length > 2 || String(month).length > 2 || String(year).length !== 4) return '';
    if (isNaN(day) || isNaN(month) || isNaN(year)) return '';

    const dayPadded = String(day).padStart(2, '0');
    const monthPadded = String(month).padStart(2, '0');

    return `${year}-${monthPadded}-${dayPadded}`;
}
