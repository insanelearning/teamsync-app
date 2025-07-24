

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, writeBatch, query, where, Timestamp, addDoc } from "firebase/firestore";
import { firebaseConfig } from '../firebaseConfig.js';

// Initialize Firebase
let app;
let db;

try {
    // A simple check to see if the config is still using placeholder values
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("YOUR_")) {
        throw new Error("Firebase configuration is not complete. Please check your firebaseConfig.js file.");
    }
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
} catch (error) {
    console.error("Firebase initialization error:", error);
    // Display a more generic error if config is missing, as the user now controls the config file.
    document.body.innerHTML = `
        <div class="firebase-config-error-container">
            <h1><i class="fas fa-exclamation-triangle"></i> Firebase Configuration Error</h1>
            <p>The application could not connect to the database.</p>
            <h2>How to Fix This:</h2>
            <p>Please make sure you have copied your Firebase project configuration into the <code>firebaseConfig.js</code> file in your project.</p>
            <p class="error-message"><strong>Original Error:</strong> ${error.message}</p>
        </div>
    `;
    // Stop execution if Firebase fails to initialize
    throw new Error("Could not initialize Firebase. Please check your firebaseConfig.js file.");
}

/**
 * Sanitizes any Firestore Timestamps within an object or nested objects/arrays.
 * @param {*} data The data to sanitize.
 * @returns {*} The sanitized data.
 */
function sanitizeTimestamps(data) {
  if (data instanceof Timestamp) {
    return data.toDate().toISOString();
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeTimestamps(item));
  }
  if (data && typeof data === 'object') {
    const sanitizedObject = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        sanitizedObject[key] = sanitizeTimestamps(data[key]);
      }
    }
    return sanitizedObject;
  }
  return data;
}


/**
 * Fetches all documents from a specified collection and sanitizes Timestamps.
 * @param {string} collectionName The name of the collection.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of documents.
 */
export async function getCollection(collectionName) {
  const querySnapshot = await getDocs(collection(db, collectionName));
  const data = [];
  querySnapshot.forEach((document) => {
    const docData = document.data();
    // Sanitize the entire document data for any Timestamps
    const sanitizedData = sanitizeTimestamps(docData);
    data.push({ id: document.id, ...sanitizedData });
  });
  return data;
}

/**
 * Creates a new document in a collection with an auto-generated ID.
 * @param {string} collectionName The name of the collection.
 * @param {Object} data The data for the new document.
 * @returns {Promise<string>} The ID of the newly created document.
 */
export async function addDocument(collectionName, data) {
    const docRef = await addDoc(collection(db, collectionName), data);
    return docRef.id;
}


/**
 * Creates or overwrites a single document in a collection.
 * @param {string} collectionName The name of the collection.
 * @param {string} docId The ID of the document.
 * @param {Object} data The data to set in the document.
 */
export async function setDocument(collectionName, docId, data) {
    await setDoc(doc(db, collectionName, docId), data);
}

/**
 * Updates an existing document. Fails if the document does not exist.
 * @param {string} collectionName The name of the collection.
 *  @param {string} docId The ID of the document to update.
 * @param {Object} data An object containing the fields and values to update.
 */
export async function updateDocument(collectionName, docId, data) {
    await updateDoc(doc(db, collectionName, docId), data);
}

/**
 * Deletes a single document from a collection.
 * @param {string} collectionName The name of the collection.
 * @param {string} docId The ID of the document to delete.
 */
export async function deleteDocument(collectionName, docId) {
    await deleteDoc(doc(db, collectionName, docId));
}

/**
 * Writes multiple documents to a collection in a single batch.
 * This is useful for CSV imports. It uses set() so it can create or overwrite.
 * @param {string} collectionName The name of the collection.
 * @param {Array<Object>} dataArray An array of objects to write. Each object must have an 'id' property.
 */
export async function batchWrite(collectionName, dataArray) {
    if (!dataArray || dataArray.length === 0) return;

    const batch = writeBatch(db);
    dataArray.forEach(item => {
        if (item.id) {
            const docRef = doc(db, collectionName, item.id);
            const dataToSet = { ...item };
            delete dataToSet.id; // Don't store the ID as a field in the document itself
            batch.set(docRef, dataToSet);
        }
    });

    await batch.commit();
}

/**
 * Deletes multiple documents based on a query.
 * @param {string} collectionName The name of the collection.
 * @param {string} field The field to query on.
 * @param {*} value The value to match.
 */
export async function deleteByQuery(collectionName, field, value) {
    const q = query(collection(db, collectionName), where(field, '==', value));
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);
    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();
}
