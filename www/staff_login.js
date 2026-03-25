import { app } from "./firebase-config.js";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, browserLocalPersistence, setPersistence } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

const db = getFirestore(app);
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(console.warn);

//  Emergency Safety Timeout (Pre-reveal UI if network/FB hangs)
setTimeout(() => {
    const loader = document.getElementById('page-loader');
    if (loader && loader.style.display !== 'none') {
        hideLoader();
        const authPanel = document.getElementById('auth-panel');
        if (authPanel) authPanel.style.display = 'flex';
    }
}, 6000);


function setMsg(id, text, type = 'error') {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text; el.className = `msg ${type}`; el.style.display = 'block';
}

function clearMsg(id) { 
    const el = document.getElementById(id); 
    if (el) el.style.display = 'none'; 
}

function hideLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) { 
        loader.style.opacity = '0'; 
        setTimeout(() => loader.style.display = 'none', 500); 
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async e => {
            e.preventDefault();
            clearMsg('register-msg');
            const name = document.getElementById('reg-name').value.trim();
            const email = document.getElementById('reg-email').value.trim().toLowerCase();
            const dept = document.getElementById('reg-dept').value;
            const team = document.getElementById('reg-team').value;
            const password = document.getElementById('reg-password').value;
            const btn = document.getElementById('btn-register');
            
            if (!name || !email || !dept || !team || !password) return setMsg('register-msg', 'Please fill all fields.');
            if (password.length < 6) return setMsg('register-msg', 'Password must be at least 6 characters.');
            
            btn.disabled = true; btn.textContent = 'Creating account…';
            
            try {
                const cred = await createUserWithEmailAndPassword(auth, email, password);
                await setDoc(doc(db, 'staffProfiles', cred.user.uid), {
                    uid: cred.user.uid, name, email, department: dept, team, role: 'Staff',
                    registeredAt: serverTimestamp()
                });
                setMsg('register-msg', `Welcome, ${name.split(' ')[0]}! Logging you in…`, 'success');
            } catch (err) {
                let m = err.message;
                if (err.code === 'auth/email-already-in-use') m = 'This email is already registered. Please log in.';
                if (err.code === 'auth/weak-password') m = 'Password is too weak. Use at least 6 characters.';
                setMsg('register-msg', m);
                btn.disabled = false; btn.textContent = 'Create Account';
            }
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async e => {
            e.preventDefault();
            clearMsg('login-msg');
            const email = document.getElementById('login-email').value.trim().toLowerCase();
            const password = document.getElementById('login-password').value;
            const btn = document.getElementById('btn-login');
            
            if (!email || !password) return setMsg('login-msg', 'Please enter email and password.');
            btn.disabled = true; btn.textContent = 'Signing in…';
            
            try {
                await signInWithEmailAndPassword(auth, email, password);
            } catch (err) {
                let m = err.message;
                if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') m = 'Invalid credentials. Check email and password.';
                if (err.code === 'auth/wrong-password') m = 'Incorrect password.';
                if (err.code === 'auth/too-many-requests') m = 'Too many attempts. Please wait.';
                setMsg('login-msg', m);
                btn.disabled = false; btn.textContent = 'Sign In';
            }
        });
    }
});

onAuthStateChanged(auth, async user => {
    if (user) {
        // --- BREAK REDIRECT LOOP ---
        // Verify profile exists before jumping to staff_home.html
        try {
            const profileSnap = await getDoc(doc(db, 'staffProfiles', user.uid));
            if (profileSnap.exists()) {
                window.location.replace('staff_home.html');
            } else {
                console.warn("[Auth] No profile found for UID:", user.uid);
                // Stay on login page so user can register or wait for fix
                hideLoader();
                const authPanel = document.getElementById('auth-panel');
                if (authPanel) authPanel.style.display = 'flex';
                setMsg('login-msg', 'Account exists but profile is missing. Please contact admin.', 'error');
            }
        } catch (err) {
            console.error("[Auth] Profile verify error:", err);
            hideLoader();
            if (document.getElementById('auth-panel')) document.getElementById('auth-panel').style.display = 'flex';
        }
    } else {
        hideLoader();
        const authPanel = document.getElementById('auth-panel');
        if (authPanel) {
            authPanel.style.display = 'flex';
        }
    }
});
