
import { initializeApp } from './App.js';

document.addEventListener('DOMContentLoaded', async () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }
  // Initializing the app is now an async operation
  await initializeApp(rootElement);
});
