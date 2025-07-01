
import { Button } from '../components/Button.js';
import { Modal, closeModal as closeGlobalModal } from '../components/Modal.js';
import { NoteCard } from '../components/NoteCard.js';
import { NoteForm } from '../components/NoteForm.js';
import { FileUploadButton } from '../components/FileUploadButton.js';

let currentModalInstance = null;

// Renders the "Deadlines & At-Risk" component for notes
function renderNotesDeadlines(notes, onNoteClick) {
  const container = document.createElement('div');
  container.className = 'deadlines-container';

  const title = document.createElement('h3');
  title.className = 'chart-title';
  title.textContent = 'Note Deadlines & At-Risk';
  container.appendChild(title);
  
  const now = new Date();
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Filter notes that have a due date
  const notesWithDeadlines = notes.filter(n => n.dueDate);

  const overdueNotes = notesWithDeadlines.filter(n => n.status !== 'Completed' && new Date(n.dueDate) < now);
  const upcomingNotes = notesWithDeadlines.filter(n => {
    const dueDate = new Date(n.dueDate);
    return n.status !== 'Completed' && dueDate >= now && dueDate <= oneWeekFromNow;
  });

  const createNoteList = (listTitle, noteList, iconClass, emptyText) => {
    const section = document.createElement('div');
    section.className = 'deadline-section';
    
    const listHeader = document.createElement('h4');
    listHeader.className = 'deadline-section-title';
    listHeader.innerHTML = `<i class="${iconClass}"></i> ${listTitle} <span>(${noteList.length})</span>`;
    section.appendChild(listHeader);
    
    if (noteList.length > 0) {
      const ul = document.createElement('ul');
      ul.className = 'deadline-list';
      noteList.sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
      noteList.forEach(n => {
        const li = document.createElement('li');
        li.className = 'deadline-item';
        li.innerHTML = `
          <a href="#" data-note-id="${n.id}" class="deadline-item-name">${n.title}</a>
          <span class="deadline-item-date">Due: ${new Date(n.dueDate + 'T00:00:00').toLocaleDateString()}</span>
        `;
        ul.appendChild(li);
      });
      section.appendChild(ul);
    } else {
      section.innerHTML += `<p class="deadline-list-empty">${emptyText}</p>`;
    }
    return section;
  };

  const overdueSection = createNoteList('Overdue Notes', overdueNotes, 'fas fa-exclamation-circle overdue-icon', 'No overdue notes.');
  const upcomingSection = createNoteList('Notes Due This Week', upcomingNotes, 'fas fa-calendar-check upcoming-icon', 'No notes with deadlines this week.');

  container.appendChild(overdueSection);
  container.appendChild(upcomingSection);

  container.addEventListener('click', (e) => {
    if (e.target.tagName === 'A' && e.target.dataset.noteId) {
      e.preventDefault();
      const note = notes.find(n => n.id === e.target.dataset.noteId);
      if (note) {
        onNoteClick(note);
      }
    }
  });

  return container;
}


export function renderNotesPage(container, props) {
  const { notes, noteStatuses, onAddNote, onUpdateNote, onDeleteNote, onExport, onImport } = props;

  let searchTerm = '';
  let statusFilter = '';

  container.innerHTML = '';
  const pageWrapper = document.createElement('div');
  pageWrapper.className = 'page-container';

  function closeModal() {
    closeGlobalModal();
    currentModalInstance = null;
  }

  function openModalForNew() {
    const formElement = NoteForm({
      note: null,
      onSave: (noteData) => {
        onAddNote(noteData);
        closeModal();
      },
      onCancel: closeModal
    });
    currentModalInstance = Modal({
      isOpen: true,
      onClose: closeModal,
      title: 'Add New Note',
      children: formElement,
      size: 'lg'
    });
  }

  function openModalWithNote(note) {
    const formElement = NoteForm({
      note,
      onSave: (noteData) => {
        onUpdateNote(noteData);
        closeModal();
      },
      onCancel: closeModal
    });
    currentModalInstance = Modal({
      isOpen: true,
      onClose: closeModal,
      title: 'Edit Note',
      children: formElement,
      size: 'lg'
    });
  }

  function handleDeleteNote(noteId) {
    if (window.confirm('Are you sure you want to delete this note?')) {
      onDeleteNote(noteId);
    }
  }

  // Header
  const headerDiv = document.createElement('div');
  headerDiv.className = "page-header";
  const headerTitle = document.createElement('h1');
  headerTitle.className = 'page-header-title';
  headerTitle.textContent = 'My Notes';
  headerDiv.appendChild(headerTitle);

  const actionsWrapper = document.createElement('div');
  actionsWrapper.className = "page-header-actions";
  actionsWrapper.append(
    Button({ children: 'Export Notes', variant: 'secondary', size: 'sm', leftIcon: '<i class="fas fa-file-export"></i>', onClick: onExport }),
    FileUploadButton({
        children: 'Import Notes', variant: 'secondary', size: 'sm', leftIcon: '<i class="fas fa-file-import"></i>', accept: '.csv',
        onFileSelect: (file) => { if (file) onImport(file); }
    }),
    Button({ children: 'Add Note', size: 'sm', leftIcon: '<i class="fas fa-plus"></i>', onClick: openModalForNew })
  );
  headerDiv.appendChild(actionsWrapper);
  pageWrapper.appendChild(headerDiv);
  
  // New two-column layout
  const notesPageLayout = document.createElement('div');
  notesPageLayout.className = 'notes-page-layout';

  const notesMainContent = document.createElement('div');
  notesMainContent.className = 'notes-main-content';

  const notesSidebar = document.createElement('div');
  notesSidebar.className = 'notes-sidebar';

  // Deadlines Section (goes into sidebar)
  notesSidebar.appendChild(renderNotesDeadlines(notes, openModalWithNote));

  // Filters (goes into main content)
  const filtersDiv = document.createElement('div');
  filtersDiv.className = "filters-container";
  filtersDiv.style.marginBottom = '0'; // Remove margin as gap is handled by parent
  const filterGrid = document.createElement('div');
  filterGrid.className = "filters-grid";

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search by title or content...';
  searchInput.className = "form-input";
  searchInput.oninput = (e) => {
    searchTerm = e.target.value.toLowerCase();
    rerenderNotesList();
  };
  filterGrid.appendChild(searchInput);

  const statusSelect = document.createElement('select');
  statusSelect.className = "form-select";
  statusSelect.innerHTML = `<option value="">All Statuses</option>` + noteStatuses.map(s => `<option value="${s}">${s}</option>`).join('');
  statusSelect.onchange = (e) => {
    statusFilter = e.target.value;
    rerenderNotesList();
  };
  filterGrid.appendChild(statusSelect);

  filtersDiv.appendChild(filterGrid);
  notesMainContent.appendChild(filtersDiv);

  // Notes Grid (goes into main content)
  const notesContainer = document.createElement('div');
  notesMainContent.appendChild(notesContainer);
  
  notesPageLayout.append(notesMainContent, notesSidebar);
  pageWrapper.appendChild(notesPageLayout);
  
  container.appendChild(pageWrapper);

  function getFilteredAndSortedNotes() {
    return notes
      .filter(note => {
        const matchesSearch = searchTerm === '' ||
          note.title.toLowerCase().includes(searchTerm) ||
          note.content.toLowerCase().includes(searchTerm) ||
          (note.tags || []).some(tag => tag.toLowerCase().includes(searchTerm));
        const matchesStatus = statusFilter === '' || note.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)); // Show most recently updated first
  }

  function rerenderNotesList() {
    const displayNotes = getFilteredAndSortedNotes();
    notesContainer.innerHTML = '';
    
    if (displayNotes.length > 0) {
      notesContainer.className = 'notes-container-grid';
      displayNotes.forEach(note => {
        const noteCardElement = NoteCard({
          note,
          onEdit: openModalWithNote,
          onDelete: handleDeleteNote,
          onUpdate: onUpdateNote
        });
        notesContainer.appendChild(noteCardElement);
      });
    } else {
      notesContainer.className = "no-data-placeholder"; // Re-use placeholder style
      notesContainer.innerHTML = `
        <i class="fas fa-sticky-note icon"></i>
        <p class="primary-text">No notes found.</p>
        <p class="secondary-text">Try adjusting filters or add a new note.</p>`;
    }
  }

  rerenderNotesList();
}
