import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app-check.js";
import { getVertexAI, getGenerativeModel } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-vertexai-preview.js";

// MASTER KEY (For Auth/Firestore)
const FIREBASE_MASTER_KEY = "AIzaSyANudXFm6QK4jJXKtXtAaDe9hWFDcBF8Vo";

// RESTRICTED GEMINI KEY (For Vertex AI)
const GEMINI_RESTRICTED_KEY = "AIzaSyDEbzu1uJ2Ynwso4aFko8pg-tf3aBbWq_U";

export const firebaseConfig = {
    apiKey: FIREBASE_MASTER_KEY, 
    authDomain: "barak-residency-59405.firebaseapp.com",
    projectId: "barak-residency-59405",
    databaseURL: "https://barak-residency-59405-default-rtdb.firebaseio.com",
    storageBucket: "barak-residency-59405.firebasestorage.app",
    messagingSenderId: "3871550492",
    appId: "1:3871550492:web:2cf49bc0a963b4888f43d9",
    measurementId: "G-B15QTKNNPL"
};

// 1. Initialize Primary App (Auth, Firestore, App Check)
export const app = initializeApp(firebaseConfig);

// 2. Initialize App Check (Native Recaptcha Enterprise)
export let appCheck = null;
try {
    appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider('6Le-AZIsAAAAAOKajThe1F13klZEYTApRcKlNYd9'), 
        isTokenAutoRefreshEnabled: true
    });
} catch(e) {
    console.warn("[AppCheck] Deferred:", e.message);
}

// 3. Initialize Secondary App strictly for Restricted Vertex AI access
export let aiModel = null;
try {
    const aiConfig = { ...firebaseConfig, apiKey: GEMINI_RESTRICTED_KEY };
    const aiApp = initializeApp(aiConfig, "Gemini-Engine-v3");
    const vertexAI = getVertexAI(aiApp);
    aiModel = getGenerativeModel(vertexAI, { model: "gemini-3-flash" });
    console.log("[VertexAI] Gemini 3 Flash Online.");
} catch(e) {
    console.warn("[VertexAI] Deferred:", e.message);
}
