import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app-check.js";
import { getVertexAI, getGenerativeModel } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-vertexai.js";

// --- DYNAMIC ENVIRONMENTAL INJECTION (SAFE FOR GITHUB PAGES) ---
// Note: These values are replaced by the GitHub Actions pipeline during deployment.
const MASTER_KEY = "";
const RESTRICTED_AI_KEY = "";

export const firebaseConfig = {
    apiKey: MASTER_KEY, 
    authDomain: "barak-residency-59405.firebaseapp.com",
    projectId: "barak-residency-59405",
    databaseURL: "https://barak-residency-59405-default-rtdb.firebaseio.com",
    storageBucket: "barak-residency-59405.firebasestorage.app",
    messagingSenderId: "3871550492",
    appId: "1:3871550492:web:2cf49bc0a963b4888f43d9",
    measurementId: "G-B15QTKNNPL"
};

// 1. Initialize Primary App
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

// 3. Initialize Gemini 3 Flash via STABLE Vertex AI SDK
export let aiModel = null;
try {
    const aiConfig = { ...firebaseConfig, apiKey: RESTRICTED_AI_KEY };
    const aiApp = initializeApp(aiConfig, "Engine-Gemini-Stable");
    const vertexAI = getVertexAI(aiApp);
    aiModel = getGenerativeModel(vertexAI, { model: "gemini-3-flash" });
    console.log("[VertexAI] Gemini 3 Flash Online.");
} catch(e) {
    console.warn("[VertexAI] Offline:", e.message);
}
