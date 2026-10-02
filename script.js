window.addEventListener("scroll", function() {

    const nav = document.querySelector("nav");

    if (window.scrollY > 50) {
        nav.style.display = "none";
    } else {
        nav.style.display = "flex";
    }

});



document.querySelectorAll(".vermas").forEach(boton => {

    boton.addEventListener("click", () => {

        let extra = boton.nextElementSibling;

        let card = boton.closest(".card");

        extra.classList.toggle("activo");

        card.classList.toggle(
            "abierta",
            extra.classList.contains("activo")
        );

        boton.textContent =
            extra.classList.contains("activo")
            ? "Ver menos"
            : "Ver más";

    });

});




/**
 * carrusel
 */
const fotos = [
    "imgprincipal.jpg",
    "perros.jpg",
    "perros1.avif",
    "perros3.avif"

];

let indiceFoto = 0;

const imagenPrincipal = document.getElementById("anuel");

document.getElementById("siguiente").addEventListener("click", () => {

    indiceFoto++;

    if(indiceFoto >= fotos.length){
        indiceFoto = 0;
    }

    imagenPrincipal.src = fotos[indiceFoto];

});

document.getElementById("anterior").addEventListener("click", () => {

    indiceFoto--;

    if(indiceFoto < 0){
        indiceFoto = fotos.length - 1;
    }

    imagenPrincipal.src = fotos[indiceFoto];

});

let nav = document.querySelector("nav")
let btn = document.getElementById("btn")

btn.addEventListener("click",() =>{
    console.log("click")
    nav.classList.toggle("abierto");
});


// Mostrar nombre de usuario en inicio si está autenticado
import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
    const el = document.getElementById("userWelcome");
    const perfilBtn = document.getElementById("viewProfileBtn");
    if(el){
        if (user) {
            const name = user.displayName || user.email;
            el.textContent = `Bienvenido ${name}`;
        } else {
            el.textContent = "";
        }
    }
    if(perfilBtn){
        if(user){
            perfilBtn.style.display = 'inline-block';
            perfilBtn.href = `comunidad/perfil.html?uid=${user.uid}`;
        } else {
            perfilBtn.style.display = 'none';
        }
    }
});