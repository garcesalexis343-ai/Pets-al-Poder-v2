import { auth, db } from "../firebase-config.js";
import {
    addDoc,
    arrayRemove,
    arrayUnion,
    collection,
    doc,
    getDocs,
    orderBy,
    query,
    updateDoc,
    where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const modal = document.getElementById("modal");
const openModalButton = document.getElementById("abrirModal");
const closeModalButton = document.getElementById("cerrarModal");
const publishButton = document.getElementById("publicar");
const caseList = document.getElementById("contenedor-publicaciones");
const problemSelect = document.getElementById("titulo");
const otherProblemField = document.getElementById("custom-problem-field");
const otherProblemInput = document.getElementById("otro-problema");
const photoInput = document.getElementById("foto");
const photoPreview = document.getElementById("foto-preview");
const cloudinaryName = "djzjn0e54";
const cloudinaryUploadPreset = "pets_poder";
const legacyProfileCache = new Map();
const knownAuthorsByName = new Map();

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function getCategory(title = "") {
    const normalized = title.toLocaleLowerCase("es");
    if (normalized.includes("ya no puedo tenerlo")) return "urgente";
    if (["ansiedad", "separación", "miedo"].some((word) => normalized.includes(word))) return "ansiedad";
    return "casa";
}

function getCategoryLabel(category) {
    return category === "urgente" ? "Necesito ayuda urgente" : category === "ansiedad" ? "Miedo y ansiedad" : "Conducta en casa";
}

function showLoginRequired(action) {
    alert(`Inicia sesión para ${action}.`);
    window.location.href = "../auth/login.html";
}

function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
}

function getSafePhotoUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" ? url.href : "";
    } catch {
        return "";
    }
}

function rememberKnownAuthor(name, uid, photoURL) {
    if (!name || !uid) return;
    const normalizedName = name.trim();
    if (!normalizedName) return;
    const authors = knownAuthorsByName.get(normalizedName) || new Map();
    authors.set(uid, photoURL || null);
    knownAuthorsByName.set(normalizedName, authors);
}

async function resolveLegacyCommentProfile(comment) {
    if (comment.usuarioId || !comment.usuario) return comment;
    const name = comment.usuario.trim();
    if (!name) return comment;

    const knownAuthors = knownAuthorsByName.get(name);
    if (knownAuthors?.size === 1) {
        const [usuarioId, usuarioFoto] = knownAuthors.entries().next().value;
        return { ...comment, usuarioId, usuarioFoto: comment.usuarioFoto || usuarioFoto };
    }

    try {
        if (!legacyProfileCache.has(name)) {
            legacyProfileCache.set(name, getDocs(query(
                collection(db, "usuarios"),
                where("displayName", "==", name)
            )).then((snapshot) => {
                if (snapshot.size !== 1) return null;
                const profile = snapshot.docs[0];
                const data = profile.data();
                return {
                    usuarioId: data.uid || profile.id,
                    usuarioFoto: data.photoURL || null
                };
            }).catch((error) => {
                console.warn("No se pudo resolver el perfil de un comentario antiguo:", error);
                return null;
            }));
        }

        const profile = await legacyProfileCache.get(name);
        return profile ? {
            ...comment,
            usuarioId: profile.usuarioId,
            usuarioFoto: comment.usuarioFoto || profile.usuarioFoto
        } : comment;
    } catch (error) {
        console.warn("No se pudo resolver el perfil de un comentario antiguo:", error);
        return comment;
    }
}

async function uploadCasePhoto(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", cloudinaryUploadPreset);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryName}/image/upload`, {
        method: "POST",
        body: formData
    });
    const result = await response.json();
    if (!response.ok || !result.secure_url) {
        throw new Error(result.error?.message || "No se pudo subir la foto.");
    }
    return result.secure_url;
}

function addLikeButton(card, { sample = false, likes = [] } = {}) {
    const actions = card.querySelector(".case-actions");
    if (!actions) return;

    const likeButton = document.createElement("button");
    likeButton.type = "button";
    likeButton.className = "like-button";
    likeButton.innerHTML = '<i data-lucide="heart"></i><span class="like-count"></span>';
    actions.prepend(likeButton);

    const sampleKey = `entre-huellas:likes:${card.dataset.sampleId}`;
    let currentLikes = Array.isArray(likes) ? [...likes] : [];

    function updateButton() {
        const liked = sample
            ? localStorage.getItem(sampleKey) === "true"
            : Boolean(auth.currentUser && currentLikes.includes(auth.currentUser.uid));
        likeButton.classList.toggle("is-liked", liked);
        likeButton.setAttribute("aria-pressed", String(liked));
        likeButton.setAttribute("aria-label", liked ? "Quitar me gusta" : "Me gusta");
        likeButton.querySelector(".like-count").textContent = String(sample ? (Number(card.dataset.likes || 0) + Number(liked)) : currentLikes.length);
    }

    likeButton.addEventListener("click", async () => {
        if (sample) {
            const liked = localStorage.getItem(sampleKey) === "true";
            localStorage.setItem(sampleKey, String(!liked));
            updateButton();
            return;
        }
        if (!auth.currentUser) {
            showLoginRequired("dar me gusta");
            return;
        }

        const uid = auth.currentUser.uid;
        const liked = currentLikes.includes(uid);
        try {
            await updateDoc(doc(db, "publicaciones", card.dataset.id), {
                likes: liked ? arrayRemove(uid) : arrayUnion(uid)
            });
            currentLikes = liked ? currentLikes.filter((id) => id !== uid) : [...currentLikes, uid];
            updateButton();
        } catch (error) {
            console.error("No se pudo actualizar el me gusta:", error);
            alert("No se pudo guardar el me gusta. Revisa las reglas de Firestore.");
        }
    });

    updateButton();
    if (!sample) auth.onAuthStateChanged(updateButton);
}

function addCommentPanel(card, { sample = false } = {}) {
    const panel = document.createElement("div");
    panel.className = "case-comments";
    panel.hidden = false;
    panel.innerHTML = `
        <div class="case-comment-list"></div>
        <div class="comment-entry">
            <textarea class="case-comment-input" maxlength="500" placeholder="Comparte una idea con respeto"></textarea>
            <button class="comment-submit" type="button">Enviar</button>
        </div>
    `;
    card.append(panel);

    const toggleButton = card.querySelector(".text-action");
    toggleButton?.addEventListener("click", () => {
        panel.hidden = !panel.hidden;
        toggleButton.setAttribute("aria-expanded", String(!panel.hidden));
        if (!panel.hidden) panel.querySelector("textarea").focus();
    });
    toggleButton?.setAttribute("aria-expanded", "true");

    const commentList = panel.querySelector(".case-comment-list");
    const input = panel.querySelector(".case-comment-input");
    card.querySelector(".professional-action")?.addEventListener("click", () => {
        panel.hidden = false;
        input.focus();
    });

    function renderComment(comment) {
        commentList.querySelector(".case-comments-empty")?.remove();
        const item = document.createElement("article");
        item.className = "case-comment";
        const profileUrl = comment.usuarioId ? `perfil.html?uid=${encodeURIComponent(comment.usuarioId)}` : "";
        const photoUrl = getSafePhotoUrl(comment.usuarioFoto);
        const initial = escapeHTML((comment.usuario || "U").charAt(0).toLocaleUpperCase("es"));
        const avatar = photoUrl
            ? `<img src="${escapeHTML(photoUrl)}" alt="" class="comment-avatar-image">`
            : `<span class="comment-avatar-placeholder" aria-hidden="true">${initial}</span>`;
        item.innerHTML = `
            ${profileUrl ? `<a class="comment-profile-avatar" href="${profileUrl}" aria-label="Ver perfil de ${escapeHTML(comment.usuario || "Usuario")}">${avatar}</a>` : `<span class="comment-profile-avatar">${avatar}</span>`}
            <div class="comment-content">
                <div class="comment-meta">
                    ${profileUrl ? `<a href="${profileUrl}" class="comment-profile-name">${escapeHTML(comment.usuario || "Usuario")}</a>` : `<strong>${escapeHTML(comment.usuario || "Usuario")}</strong>`}
                    ${comment.fecha ? `<time>${escapeHTML(comment.fecha)}</time>` : ""}
                </div>
                <p>${escapeHTML(comment.comentario || "")}</p>
            </div>
        `;
        commentList.append(item);
    }

    if (sample) {
        const storageKey = `entre-huellas:comments:${card.dataset.sampleId}`;
        let savedComments = [];
        try {
            savedComments = JSON.parse(localStorage.getItem(storageKey) || "[]");
        } catch {
            savedComments = [];
        }
        if (!savedComments.length) commentList.innerHTML = '<p class="case-comments-empty">Todavía no hay respuestas. Puedes ser la primera persona en ayudar.</p>';
        savedComments.forEach(renderComment);
        panel.querySelector(".comment-submit").addEventListener("click", () => {
            const comentario = input.value.trim();
            if (!comentario) return;
            const entry = { usuario: "Vecino de la comunidad", comentario };
            savedComments.push(entry);
            localStorage.setItem(storageKey, JSON.stringify(savedComments));
            renderComment(entry);
            input.value = "";
        });
        return;
    }

    const commentsRef = collection(db, "publicaciones", card.dataset.id, "comentarios");
    getDocs(commentsRef)
        .then(async (snapshot) => {
            if (snapshot.empty) {
                commentList.innerHTML = '<p class="case-comments-empty">Todavía no hay respuestas. Puedes ser la primera persona en ayudar.</p>';
                return;
            }
            const comments = await Promise.all(snapshot.docs.map((commentDoc) => resolveLegacyCommentProfile(commentDoc.data())));
            comments.sort((first, second) => {
                const firstTime = Number(first.fechaCreacion) || Date.parse(first.fecha || "") || 0;
                const secondTime = Number(second.fechaCreacion) || Date.parse(second.fecha || "") || 0;
                return firstTime - secondTime;
            });
            comments.forEach(renderComment);
        })
        .catch((error) => console.error("No se pudieron cargar los comentarios:", error));

    panel.querySelector(".comment-submit").addEventListener("click", async () => {
        if (!auth.currentUser) {
            showLoginRequired("comentar");
            return;
        }
        const comentario = input.value.trim();
        if (!comentario) return;
        const entry = {
            usuario: auth.currentUser.displayName || "Usuario",
            usuarioId: auth.currentUser.uid,
            usuarioFoto: auth.currentUser.photoURL || null,
            comentario,
            fecha: new Date().toLocaleString("es"),
            fechaCreacion: Date.now()
        };
        try {
            await addDoc(commentsRef, entry);
            renderComment(entry);
            input.value = "";
        } catch (error) {
            console.error("No se pudo guardar el comentario:", error);
            alert("No se pudo guardar el comentario.");
        }
    });
}

function wireCaseCard(card, options = {}) {
    addLikeButton(card, options);
    addCommentPanel(card, options);
}

function applyFilter(filter) {
    caseList.querySelectorAll(".card").forEach((card) => {
        card.hidden = filter !== "todos" && card.dataset.category !== filter;
    });
}

function checkCaseImage(card) {
    const image = card.querySelector(".post-image");
    if (image?.complete && image.naturalWidth === 0) image.dispatchEvent(new Event("error"));
}

document.querySelectorAll(".filter-button").forEach((button) => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".filter-button").forEach((filterButton) => {
            const active = filterButton === button;
            filterButton.classList.toggle("is-active", active);
            filterButton.setAttribute("aria-pressed", String(active));
        });
        applyFilter(button.dataset.filter);
    });
});

document.querySelectorAll(".sample-card").forEach((card) => wireCaseCard(card, { sample: true }));
refreshIcons();

photoInput.addEventListener("change", () => {
    const file = photoInput.files?.[0];
    if (!file) {
        photoPreview.removeAttribute("src");
        photoPreview.hidden = true;
        return;
    }
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
        alert("Elige una imagen válida de hasta 8 MB.");
        photoInput.value = "";
        photoPreview.hidden = true;
        return;
    }
    photoPreview.src = URL.createObjectURL(file);
    photoPreview.hidden = false;
});

problemSelect.addEventListener("change", () => {
    const isOther = problemSelect.value === "otro";
    otherProblemField.hidden = !isOther;
    otherProblemInput.required = isOther;
    if (!isOther) otherProblemInput.value = "";
});

openModalButton.addEventListener("click", () => { modal.style.display = "flex"; });
closeModalButton.addEventListener("click", () => { modal.style.display = "none"; });
modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.style.display = "none";
});

auth.onAuthStateChanged(() => {
    openModalButton.style.display = "inline-flex";
});

function renderCase(id, data) {
    const category = getCategory(data.titulo);
    const likes = Array.isArray(data.likes) ? data.likes : [];
    const anonymous = Boolean(data.anonimo);
    const age = data.edadPerro ? `${escapeHTML(data.edadPerro)} · ` : "";
    const card = document.createElement("article");
    card.className = "card post-card";
    card.dataset.id = id;
    card.dataset.category = category;
    card.innerHTML = `
        <div class="case-topline">
            <span class="category-tag"><i data-lucide="${category === "urgente" ? "life-buoy" : category === "ansiedad" ? "heart-pulse" : "home"}"></i> ${getCategoryLabel(category)}</span>
            <span class="case-status status-open"><span></span> Abierto</span>
        </div>
        <div class="case-heading">
            <span class="dog-icon"><i data-lucide="dog"></i></span>
            <div><p class="post-sub">${anonymous ? "Anónimo" : escapeHTML(data.usuario || "Usuario")} · ${age}${escapeHTML(data.fecha || "")}</p><h3 class="post-title">${escapeHTML(data.titulo)}</h3></div>
        </div>
        <p class="post-body">${escapeHTML(data.descripcion || "")}</p>
        ${data.imagen ? `<img class="post-image" src="${escapeHTML(data.imagen)}" alt="Foto adjunta al caso" loading="lazy">` : ""}
        <div class="case-footer">
            <span class="help-count"><i data-lucide="heart"></i> ${likes.length} personas ya ayudaron</span>
            <div class="case-actions">
                <button class="text-action" type="button"><i data-lucide="lightbulb"></i> A mí me funcionó esto</button>
                <button class="professional-action" type="button"><i data-lucide="badge-check"></i> Soy profesional</button>
            </div>
        </div>
    `;
    const image = card.querySelector(".post-image");
    image?.addEventListener("error", () => {
        const unavailable = document.createElement("div");
        unavailable.className = "post-image-fallback";
        unavailable.innerHTML = '<i data-lucide="image-off"></i><span>Esta foto ya no está disponible en el almacenamiento.</span>';
        image.replaceWith(unavailable);
        refreshIcons();
    }, { once: true });
    wireCaseCard(card, { likes });
    return card;
}

async function loadCases() {
    try {
        const cases = await getDocs(query(collection(db, "publicaciones"), orderBy("fechaCreacion", "desc")));
        cases.docs.forEach((caseDoc) => {
            const data = caseDoc.data();
            rememberKnownAuthor(data.usuario, data.usuarioId, data.usuarioFoto);
        });
        [...cases.docs].reverse().forEach((caseDoc) => {
            const card = renderCase(caseDoc.id, caseDoc.data());
            caseList.prepend(card);
            checkCaseImage(card);
        });
        const activeFilter = document.querySelector(".filter-button.is-active");
        applyFilter(activeFilter?.dataset.filter || "todos");
        refreshIcons();
    } catch (error) {
        console.error("No se pudieron cargar los casos:", error);
    }
}

publishButton.addEventListener("click", async () => {
    if (!auth.currentUser) {
        showLoginRequired("publicar un caso");
        return;
    }

    const selectedProblem = problemSelect.value;
    const title = selectedProblem === "otro" ? otherProblemInput.value.trim() : selectedProblem;
    const description = document.getElementById("descripcion").value.trim();
    const photo = photoInput.files?.[0];
    if (!title || !description) {
        alert("Completa el problema y cuéntanos qué has intentado.");
        return;
    }
    if (photo && photo.size > 8 * 1024 * 1024) {
        alert("La foto debe pesar 8 MB o menos.");
        return;
    }

    const anonymous = document.getElementById("anonimo").checked;
    publishButton.disabled = true;
    const originalButtonContent = publishButton.innerHTML;
    try {
        publishButton.innerHTML = '<i data-lucide="loader-circle"></i> Publicando caso...';
        refreshIcons();
        const imageUrl = photo ? await uploadCasePhoto(photo) : "";
        const data = {
            titulo: title,
            descripcion: description,
            edadPerro: document.getElementById("edad-perro").value,
            usuario: anonymous ? "Anónimo" : (auth.currentUser.displayName || "Usuario"),
            usuarioId: auth.currentUser.uid,
            usuarioFoto: anonymous ? null : (auth.currentUser.photoURL || null),
            anonimo: anonymous,
            likes: [],
            imagen: imageUrl,
            fecha: new Date().toLocaleString("es"),
            fechaCreacion: Date.now()
        };
        const newCase = await addDoc(collection(db, "publicaciones"), data);
        const card = renderCase(newCase.id, data);
        caseList.prepend(card);
        checkCaseImage(card);
        const activeFilter = document.querySelector(".filter-button.is-active");
        applyFilter(activeFilter?.dataset.filter || "todos");
        refreshIcons();
        modal.style.display = "none";
        document.getElementById("descripcion").value = "";
        photoInput.value = "";
        photoPreview.removeAttribute("src");
        photoPreview.hidden = true;
        document.getElementById("anonimo").checked = true;
        problemSelect.selectedIndex = 0;
        otherProblemInput.value = "";
        otherProblemField.hidden = true;
        otherProblemInput.required = false;
    } catch (error) {
        console.error("No se pudo publicar el caso:", error);
        alert(error.message || "No se pudo publicar. Revisa la conexión y los permisos de Firestore.");
    } finally {
        publishButton.innerHTML = originalButtonContent;
        refreshIcons();
        publishButton.disabled = false;
    }
});

loadCases();