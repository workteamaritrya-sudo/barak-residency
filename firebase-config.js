import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app-check.js";
import { getVertexAI, getGenerativeModel } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-vertexai-preview.js";

export const firebaseConfig = {
    apiKey: "AIzaSyDEbzu1uJ2Ynwso4aFko8pg-tf3aBbWq_U", // Restricted Identity Token
    authDomain: "barak-residency-59405.firebaseapp.com",
    projectId: "barak-residency-59405",
    databaseURL: "https://barak-residency-59405-default-rtdb.firebaseio.com",
    storageBucket: "barak-residency-59405.firebasestorage.app",
    messagingSenderId: "3871550492",
    appId: "1:3871550492:web:2cf49bc0a963b4888f43d9",
    measurementId: "G-B15QTKNNPL"
};

// 1. Initialize Firebase Core
export const app = initializeApp(firebaseConfig);

// 2. Wrap via App Check (reCAPTCHA Enterprise)
export let appCheck;
try {
    appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider('6Le-AZIsAAAAAOKajThe1F13klZEYTApRcKlNYd9'), 
        isTokenAutoRefreshEnabled: true
    });
} catch(e) {
    console.warn("App Check initialization deferred.");
}

// 3. Initialize Gemini 3 Flash via Vertex AI SDK natively
export const vertexAI = getVertexAI(app);
export const aiModel = getGenerativeModel(vertexAI, { model: "gemini-3-flash" });
