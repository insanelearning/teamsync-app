
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  isLoading = false,
  className = '', // For additional custom classes if needed
  onClick,
  disabled = false,
  type = 'button',
  ariaLabel,
  id
}) {
  const button = document.createElement('button');
  button.type = type;
  if (id) button.id = id;

  const baseClass = 'button';
  const variantClass = `button-${variant}`; // e.g., button-primary
  const sizeClass = `button-${size}`;     // e.g., button-md

  button.className = `${baseClass} ${variantClass} ${sizeClass} ${className}`;
  
  if (isLoading) {
    button.classList.add('loading'); // A generic loading class perhaps, or handle icon within
  }
  button.disabled = isLoading || disabled;

  if (onClick) {
    button.addEventListener('click', onClick);
  }
  if (ariaLabel) {
    button.setAttribute('aria-label', ariaLabel);
  }

  let contentHTML = '';
  if (isLoading) {
    const spinnerSizeClass = `button-${size}-icon`; // e.g. button-md-icon
    contentHTML += `<svg class="animate-spin button-icon-spinner ${spinnerSizeClass}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>`;
  }
  if (leftIcon && !isLoading) {
    contentHTML += `<span class="button-left-icon">${leftIcon}</span>`;
  }
  
  if (typeof children === 'string') {
    contentHTML += children;
  } else if (children instanceof HTMLElement) {
    contentHTML += children.outerHTML; // Simpler to just get HTML string
  } else if (children) {
    contentHTML += String(children);
  }

  if (rightIcon && !isLoading) {
    contentHTML += `<span class="button-right-icon">${rightIcon}</span>`;
  }
  button.innerHTML = contentHTML;

  return button;
}