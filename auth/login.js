import { auth } from "../firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginBtn");
const errorMessage = document.getElementById("loginError");

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorMessage.hidden = true;
    loginButton.disabled = true;
    loginButton.textContent = "Ingresando...";

    const correo = document.getElementById("correo").value.trim();
    const password = document.getElementById("password").value;

    try {
        await signInWithEmailAndPassword(auth, correo, password);
        window.location.replace("inicio.html");
    } catch (error) {
        const messages = {
            "auth/invalid-credential": "El correo o la contraseña no son correctos.",
            "auth/invalid-email": "Escribe un correo válido.",
            "auth/too-many-requests": "Hubo varios intentos. Espera un momento y prueba de nuevo.",
            "auth/network-request-failed": "No se pudo conectar. Revisa tu conexión a internet."
        };
        errorMessage.textContent = messages[error.code] || "No se pudo iniciar sesión. Revisa tus datos e inténtalo de nuevo.";
        errorMessage.hidden = false;
        loginButton.disabled = false;
        loginButton.textContent = "Entrar";
    }
});