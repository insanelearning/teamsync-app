
import { Button } from './Button.js';

export function FileUploadButton({
  onFileSelect,
  accept,
  children,
  variant = 'primary', // Default variant passed to Button
  size = 'md',         // Default size passed to Button
  leftIcon,
  className = ''       // Allow additional classes for the Button
}) {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.className = 'hidden-file-input'; // For CSS if any specific styling needed for the hidden input
  fileInput.setAttribute('aria-hidden', 'true');
  if (accept) {
    fileInput.accept = accept;
  }
  fileInput.addEventListener('change', (event) => {
    const file = event.target.files ? event.target.files[0] : null;
    onFileSelect(file);
    if (event.target) {
      event.target.value = '';
    }
  });

  // The visibleButton will be styled by the Button component itself using its new CSS classes
  const visibleButton = Button({
    children,
    variant,
    size,
    leftIcon,
    className, // Pass through any custom classes
    type: 'button',
    onClick: () => fileInput.click(),
  });
  
  // It's good practice to append the hidden input if it needs to be part of the DOM for any reason,
  // though for `click()` it might not be strictly necessary. Some browsers/setups might be pickier.
  // For simplicity here, we don't append it to the visible button, it's created and its click is triggered.
  // If issues occur, one might append fileInput to document.body temporarily or to visibleButton's parent.

  return visibleButton;
}