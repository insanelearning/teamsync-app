
import { initializeApp } from "firebase-app";
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, writeBatch, query, where, Timestamp } from "firebase-firestore";

// Initialize Firebase
let app;
let db;

try {
    // Construct config from environment variables
    const firebaseConfig = {
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.VITE_FIREBASE_APP_ID,
      measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
    };

    // A simple check to see if the config is still using placeholder values
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        throw new Error("Firebase configuration is not complete. Please check your environment variables.");
    }
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
} catch (error) {
    console.error("Firebase initialization error:", error);
    // Display a user-friendly error directly on the page
    document.body.innerHTML = `
        <div class="firebase-config-error-container">
            <h1><i class="fas fa-exclamation-triangle"></i> Firebase Configuration Error</h1>
            <p>The application could not connect to the database. This is likely due to missing configuration settings on the hosting platform.</p>
            <h2>How to Fix This:</h2>
            <p>You need to add your Firebase and Gemini credentials as <strong>Environment Variables</strong> in your Vercel project settings.</p>
            <div class="steps">
              <div class="step">
                <div class="step-number">1</div>
                <div class="step-text">In your Vercel project dashboard, go to the <strong>Settings</strong> tab.</div>
              </div>
              <div class="step">
                <div class="step-number">2</div>
                <div class="step-text">Click on <strong>Environment Variables</strong> in the side menu.</div>
              </div>
              <div class="step">
                <div class="step-number">3</div>
                <div class="step-text">Add a variable for your Gemini API Key called <code>API_KEY</code>.</div>
              </div>
               <div class="step">
                <div class="step-number">4</div>
                <div class="step-text">Add all the Firebase variables (e.g., <code>VITE_FIREBASE_API_KEY</code>, <code>VITE_FIREBASE_PROJECT_ID</code>, etc.) with the values from your Firebase project config.</div>
              </div>
              <div class="step">
                <div class="step-number">5</div>
                <div class="step-text">After adding the variables, go to the <strong>Deployments</strong> tab, click the latest deployment, and choose <strong>Redeploy</strong> to apply the changes.</div>
              </div>
            </div>
            <p class="error-message"><strong>Original Error:</strong> ${error.message}</p>
        </div>
    `;
    throw new Error("Could not initialize Firebase. Please check your hosting environment variables.");
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
