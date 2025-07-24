// A simple CSV parser and stringifier.

/**
 * Parses a single row of a CSV string, handling quoted fields.
 * @param {string} rowString The string for a single CSV row.
 * @returns {Array<string>} An array of values for the row.
 */
function parseCSVRow(rowString) {
    const values = [];
    let currentVal = '';
    let inQuotes = false;
    // Append a comma to ensure the last value is pushed
    const effectiveRow = rowString + ',';

    for (let i = 0; i < effectiveRow.length; i++) {
        const char = effectiveRow[i];
        
        if (char === '"') {
            // Check for escaped double quote
            if (inQuotes && effectiveRow[i + 1] === '"') {
                currentVal += '"';
                i++; // Skip the next character
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(currentVal);
            currentVal = '';
        } else {
            currentVal += char;
        }
    }
    
    return values.map(v => v.trim());
}

/**
 * Formats a single value for a CSV field. It handles values that contain
 * commas, double quotes, or newlines by enclosing them in double quotes.
 * Existing double quotes within the value are escaped by doubling them.
 * @param {*} value The value to format.
 * @returns {string} The formatted CSV field.
 */
function formatCSVField(value) {
    if (value === null || value === undefined) {
        return '';
    }

    // Convert the value to a string.
    let stringValue = String(value);
    
    // If the string contains a comma, a newline, or a double quote, enclose it in double quotes.
    if (stringValue.search(/("|,|\n)/g) >= 0) {
        // Within a quoted field, any double quote must be escaped by another double quote.
        stringValue = '"' + stringValue.replace(/"/g, '""') + '"';
    }
    return stringValue;
}

export const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) {
    alert("No data to export.");
    return;
  }

  const header = Object.keys(data[0]);
  const csv = [
    header.join(','), // Header row
    ...data.map(row =>
      header
        .map(fieldName => formatCSVField(row[fieldName]))
        .join(',')
    ),
  ].join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } else {
    alert("CSV export is not supported in this browser.");
  }
};

export const importFromCSV = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvString = event.target?.result;
        if (!csvString) {
          throw new Error("File is empty or could not be read.");
        }
        
        const rows = csvString.split(/\r\n|\n/).filter(row => row.trim() !== ''); // Split rows and remove empty ones
        if (rows.length < 2) {
          throw new Error("CSV must have a header row and at least one data row.");
        }
        
        // Use robust parser for the header as well
        const header = parseCSVRow(rows[0]).map(h => h.replace(/^"|"$/g, ''));

        const data = rows.slice(1).map(rowString => {
          if (rowString.trim() === '') return null;
          // Use robust parser for data rows
          const values = parseCSVRow(rowString);
          if (values.length === 0) return null;
          
          const obj = {};
          header.forEach((key, index) => {
            let value = values[index] !== undefined ? values[index] : '';
            obj[key] = value;
          });
          return obj;
        }).filter(item => item !== null);

        resolve(data);
      } catch (error) {
        console.error("Error parsing CSV:", error);
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
};
