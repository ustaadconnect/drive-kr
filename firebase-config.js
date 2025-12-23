// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyB7l_cjTojiK8uisKOzrOAtQtElSYIVZ9Y",
    authDomain: "drivekr-4b57c.firebaseapp.com",
    databaseURL: "https://drivekr-4b57c-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "drivekr-4b57c",
    storageBucket: "drivekr-4b57c.firebasestorage.app",
    messagingSenderId: "130397218580",
    appId: "1:130397218580:web:96fb0c1d80824f4d600401",
    measurementId: "G-ZVJVDBMTMZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Export Firebase services
export { app, analytics, auth, db, storage };