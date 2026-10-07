import { auth, db } from "../firebase-config.js";

import {
    createUserWithEmailAndPassword,
    updateProfile
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    doc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CLOUD_NAME = "djzjn0e54";
const UPLOAD_PRESET = "pets_poder";

const btn = document.getElementById("registrar");
const form = document.querySelector(".container form");
const message = document.getElementById("registroMensaje");

function showMessage(text, type = "error") {
    message.textContent = text;
    message.dataset.type = type;
    message.hidden = false;
}

function registrationError(error) {
    const messages = {
        "auth/email-already-in-use": "Ya existe una cuenta con ese correo. Ve a Iniciar sesión.",
        "auth/invalid-email": "Escribe un correo válido.",
        "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
        "auth/operation-not-allowed": "El registro por correo no está habilitado en Firebase Authentication.",
        "auth/network-request-failed": "No se pudo conectar. Revisa tu conexión e inténtalo de nuevo."
    };
    return messages[error.code] || "No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.";
}

async function subirACloudinary(archivo){
    if(!archivo) return null;
    const formData = new FormData();
    formData.append('file', archivo);
    formData.append('upload_preset', UPLOAD_PRESET);
    const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData
    });
    const data = await resp.json();
    return data.secure_url;
}

btn.addEventListener("click", async () => {
    if (btn.disabled || !form.reportValidity()) return;

    const nombre = document.getElementById("nombre").value.trim();
    const correo = document.getElementById("correo").value.trim();
    const password = document.getElementById("password").value;
    const fotoArchivo = document.getElementById("fotoPerfil").files[0];
    const descripcionPerfil = document.getElementById("descripcionPerfil").value.trim();
    const labelOriginal = btn.textContent;
    message.hidden = true;
    btn.disabled = true;
    btn.textContent = "Creando cuenta...";

    try {
        const usuario = await createUserWithEmailAndPassword(auth, correo, password);

        let photoURL = null;
        if (fotoArchivo) {
            try {
                photoURL = await subirACloudinary(fotoArchivo);
            } catch (error) {
                console.error("Error subiendo foto de perfil:", error);
            }
        }

        try {
            await updateProfile(usuario.user, { displayName: nombre, photoURL });
        } catch (error) {
            console.warn("La cuenta se creó, pero no se pudo actualizar el perfil de Auth:", error);
        }

        try {
            await setDoc(doc(db, 'usuarios', usuario.user.uid), {
                uid: usuario.user.uid,
                displayName: nombre,
                email: correo,
                photoURL: photoURL,
                descripcion: descripcionPerfil || '',
                createdAt: Date.now()
            });
        } catch (firestoreError) {
            console.warn("La cuenta se creó, pero no se guardó el perfil en Firestore:", firestoreError);
        }

        showMessage("Cuenta creada correctamente. Te llevamos al inicio de sesión...", "success");
        window.setTimeout(() => window.location.replace("../index.html"), 900);
    } catch (error) {
        console.error("Error creando la cuenta:", error);
        showMessage(registrationError(error));
        btn.disabled = false;
        btn.textContent = labelOriginal;
    }
});