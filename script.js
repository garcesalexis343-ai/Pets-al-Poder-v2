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

        const veterinaryGrid = document.querySelector(".grid-veterinarios");
        const nearbyButton = document.getElementById("buscar-veterinarias-cercanas");
        const geolocationStatus = document.getElementById("estado-geolocalizacion");

        if (veterinaryGrid && nearbyButton && geolocationStatus) {
            const veterinaryCards = Array.from(veterinaryGrid.querySelectorAll(".card"));
            const originalCardOrder = [...veterinaryCards];
            const buttonLabel = nearbyButton.textContent.trim();

            function distanceInKm(origin, destination) {
                const radians = degrees => degrees * Math.PI / 180;
                const latitudeDifference = radians(destination.lat - origin.lat);
                const longitudeDifference = radians(destination.lng - origin.lng);
                const originLatitude = radians(origin.lat);
                const destinationLatitude = radians(destination.lat);
                const haversine = Math.sin(latitudeDifference / 2) ** 2
                    + Math.cos(originLatitude) * Math.cos(destinationLatitude)
                    * Math.sin(longitudeDifference / 2) ** 2;

                return 6371 * 2 * Math.atan2(
                    Math.sqrt(haversine),
                    Math.sqrt(1 - haversine)
                );
            }

            function resetNearbyResults() {
                originalCardOrder.forEach(card => {
                    card.querySelector(".distancia-veterinaria")?.remove();
                    veterinaryGrid.append(card);
                });
            }

            function showGeolocationError(error) {
                resetNearbyResults();

                if (error.code === error.PERMISSION_DENIED) {
                    geolocationStatus.textContent = "No se concedió el permiso. Puedes seguir explorando la lista completa.";
                } else if (error.code === error.TIMEOUT) {
                    geolocationStatus.textContent = "La ubicación tardó demasiado en obtenerse. Inténtalo de nuevo.";
                } else {
                    geolocationStatus.textContent = "No pudimos determinar tu ubicación. Puedes seguir explorando la lista completa.";
                }

                nearbyButton.disabled = false;
                nearbyButton.textContent = buttonLabel;
            }

            nearbyButton.addEventListener("click", () => {
                if (!window.isSecureContext || !navigator.geolocation) {
                    geolocationStatus.textContent = "La ubicación requiere HTTPS o abrir el sitio en localhost.";
                    return;
                }

                nearbyButton.disabled = true;
                nearbyButton.textContent = "Buscando ubicación...";
                geolocationStatus.textContent = "El navegador te pedirá permiso para usar tu ubicación.";

                navigator.geolocation.getCurrentPosition(position => {
                    const userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    const rankedCards = veterinaryCards.map((card, index) => {
                        const locations = JSON.parse(card.dataset.locations || "[]");
                        const nearestLocation = locations
                            .map(location => ({
                                ...location,
                                distance: distanceInKm(userLocation, location)
                            }))
                            .sort((first, second) => first.distance - second.distance)[0];

                        return { card, index, nearestLocation };
                    }).sort((first, second) => {
                        const firstDistance = first.nearestLocation?.distance ?? Infinity;
                        const secondDistance = second.nearestLocation?.distance ?? Infinity;
                        return firstDistance - secondDistance || first.index - second.index;
                    });

                    rankedCards.forEach(({ card, nearestLocation }) => {
                        card.querySelector(".distancia-veterinaria")?.remove();

                        const distanceLabel = document.createElement("p");
                        distanceLabel.className = "distancia-veterinaria";
                        distanceLabel.textContent = nearestLocation
                            ? `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(nearestLocation.distance)} km en línea recta · ${nearestLocation.label}`
                            : "Distancia no disponible";
                        card.querySelector("h3")?.after(distanceLabel);
                        veterinaryGrid.append(card);
                    });

                    geolocationStatus.textContent = "Veterinarias ordenadas por cercanía. La distancia es en línea recta y puede diferir de la ruta.";
                    nearbyButton.disabled = false;
                    nearbyButton.textContent = buttonLabel;
                }, showGeolocationError, {
                    enableHighAccuracy: false,
                    timeout: 12000,
                    maximumAge: 300000
                });
            });
        }

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