
let activeModal = null; 

function handleEscapeKey(event) {
  if (event.key === 'Escape' && activeModal && activeModal.onClose) {
    activeModal.onClose();
  }
}

export function Modal({ isOpen, onClose, title, children, size = 'md', footer }) {
  if (!isOpen) {
    closeModal(); 
    return null; 
  }

  closeModal(); 

  const modalRoot = document.createElement('div');
  modalRoot.id = 'teamsync-modal-overlay'; 
  modalRoot.className = "modal-overlay"; 
  // Add listener to overlay for closing, but not for content clicks
  modalRoot.addEventListener('click', (e) => {
    if (e.target === modalRoot) { // Only close if overlay itself is clicked
        onClose();
    }
  }); 

  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', handleEscapeKey);

  activeModal = { element: modalRoot, onClose: onClose };

  const modalContentWrapper = document.createElement('div');
  modalContentWrapper.className = `modal-content-wrapper modal-size-${size}`;
  // Stop propagation for clicks on content wrapper, so it doesn't close the modal
  modalContentWrapper.addEventListener('click', (e) => e.stopPropagation());
  modalRoot.appendChild(modalContentWrapper);


  const header = document.createElement('div');
  header.className = "modal-header";
  modalContentWrapper.appendChild(header);

  const h3 = document.createElement('h3');
  h3.className = "modal-title";
  h3.textContent = title;
  header.appendChild(h3);

  const closeButton = document.createElement('button');
  closeButton.type = "button";
  closeButton.className = "modal-close-button";
  closeButton.innerHTML = '<i class="fas fa-times"></i>';
  closeButton.setAttribute('aria-label', 'Close modal');
  closeButton.addEventListener('click', onClose);
  header.appendChild(closeButton);

  const bodyDiv = document.createElement('div');
  bodyDiv.className = "modal-body";
  if (typeof children === 'string') {
    bodyDiv.innerHTML = children;
  } else if (children instanceof HTMLElement) {
    bodyDiv.appendChild(children);
  } else if (Array.isArray(children)) {
    children.forEach(child => {
      if (child instanceof HTMLElement) bodyDiv.appendChild(child);
    });
  }
  modalContentWrapper.appendChild(bodyDiv);

  if (footer) {
    const footerDiv = document.createElement('div');
    footerDiv.className = "modal-footer"; // Standard class for footer
    
    if (footer instanceof HTMLElement) {
        // If footer is a single element (e.g., a div containing buttons)
        // Check if it already has 'modal-footer' class or similar structure.
        // For simplicity, we assume passed footer element is just the content of our styled footer.
        while (footer.firstChild) {
            footerDiv.appendChild(footer.firstChild);
        }
    } else if (Array.isArray(footer)) { // If footer is an array of elements (e.g. buttons)
        footer.forEach(el => footerDiv.appendChild(el));
    } else if (typeof footer === 'string') {
        footerDiv.innerHTML = footer;
    }
    modalContentWrapper.appendChild(footerDiv);
  }
  
  document.body.appendChild(modalRoot);
  
  // Trigger transition
  requestAnimationFrame(() => {
    modalRoot.classList.add('open');
  });

  return modalRoot; 
}

export function closeModal() {
    if (activeModal && activeModal.element) {
        activeModal.element.classList.remove('open');
        // Wait for transition to finish before removing
        activeModal.element.addEventListener('transitionend', function handler(e) {
            if (e.target === activeModal.element && e.propertyName === 'opacity') {
                activeModal.element.removeEventListener('transitionend', handler);
                if (activeModal && activeModal.element.parentNode) { // Check if still in DOM
                    activeModal.element.remove();
                }
                 activeModal = null; // Clear after removal
            }
        });
        // Fallback if transitionend doesn't fire (e.g., element removed prematurely by other means)
        setTimeout(() => {
            if (activeModal && activeModal.element && activeModal.element.parentNode) {
                activeModal.element.remove();
            }
            activeModal = null;
        }, 300); // Match transition duration
    } else if (activeModal && !activeModal.element.parentNode) { // Already removed
        activeModal = null;
    }

    document.body.style.overflow = 'auto';
    document.removeEventListener('keydown', handleEscapeKey);
}