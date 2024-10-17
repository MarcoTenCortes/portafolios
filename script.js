const btn = document.getElementById('button');
const sectionAll = document.querySelectorAll('section[id]');
const inputName = document.querySelector('#nombre');
const inputEmail = document.querySelector('#email');
const flagsElement = document.getElementById('flags');
const textsToChange = document.querySelectorAll('[data-section]');

/* ===== Loader =====*/
window.addEventListener('load', () => {
    const contenedorLoader = document.querySelector('.container--loader');
    contenedorLoader.style.opacity = 0;
    contenedorLoader.style.visibility = 'hidden';
})

/*===== Header =====*/
window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    header.classList.toggle('abajo', window.scrollY > 0);
});

/*===== Boton Menu =====*/
btn.addEventListener('click', function() {
    if (this.classList.contains('active')) {
        this.classList.remove('active');
        this.classList.add('not-active');
        document.querySelector('.nav_menu').classList.remove('active');
        document.querySelector('.nav_menu').classList.add('not-active');
    }
    else {
        this.classList.add('active');
        this.classList.remove('not-active');
        document.querySelector('.nav_menu').classList.remove('not-active');
        document.querySelector('.nav_menu').classList.add('active');
    }
});

/*===== Cambio de idioma =====*/
const changeLanguage = async language => {
    const requestJson = await fetch(`./languages/${language}.json`);
    const texts = await requestJson.json();

    for(const textToChange of textsToChange) {
        const section = textToChange.dataset.section;
        const value = textToChange.dataset.value;

        textToChange.innerHTML = texts[section][value];
    }
}

flagsElement.addEventListener('click', (e) => {
    changeLanguage(e.target.parentElement.dataset.language);
})

/*===== class active por secciones =====*/
window.addEventListener('scroll', () => {
    const scrollY = window.pageYOffset;
    sectionAll.forEach((current) => {
        const sectionHeight = current.offsetHeight;
        const sectionTop = current.offsetTop - 100;
        const sectionId = current.getAttribute('id');

        if (scrollY > sectionTop && scrollY < sectionTop + sectionHeight) {
            document.querySelector('nav a[href*=' + sectionId + ']').classList.add('active');
        }
        else {
            document.querySelector('nav a[href*=' + sectionId + ']').classList.remove('active');
        }
    });
});

/*===== Boton y función ir arriba =====*/
window.onscroll = function() {
    if (document.documentElement.scrollTop > 100) {
        document.querySelector('.go-top-container').classList.add('show');
    }
    else {
        document.querySelector('.go-top-container').classList.remove('show');
    }
}

document.querySelector('.go-top-container').addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

// Navegación del Slider
(function() {
    const slidesWrapper = document.querySelector('.slides-wrapper');
    const slides = document.querySelectorAll('.slide');
    const leftBtn = document.querySelector('.left-btn');
    const rightBtn = document.querySelector('.right-btn');
    let currentSlide = 0;

    function showSlide(index) {
        if (index >= slides.length) {
            currentSlide = 0;
        } else if (index < 0) {
            currentSlide = slides.length - 1;
        } else {
            currentSlide = index;
        }
        slidesWrapper.style.transform = `translateX(-${currentSlide * 100}%)`;

        // Reiniciar animaciones AOS
        AOS.refresh();
    }

    leftBtn.addEventListener('click', () => {
        showSlide(currentSlide - 1);
    });

    rightBtn.addEventListener('click', () => {
        showSlide(currentSlide + 1);
    });

    // Inicializar el primer slide
    showSlide(currentSlide);
})();
document.addEventListener('mousemove', function(event) {
    const gradientElement = document.getElementById('mouse-gradient');
    const x = event.clientX;
    const y = event.clientY;

    gradientElement.style.background = `radial-gradient(600px at ${x}px ${y}px, rgba(29, 78, 216, 0.15), transparent 80%)`;
});

document.addEventListener("DOMContentLoaded", function() {
    const cafe = document.querySelector('.cafe');
    const ceja1 = document.querySelector('.ceja1');
    const ceja2 = document.querySelector('.ceja2');
    const labios = document.querySelector('.labios');
    const gotas = document.querySelectorAll('.gota');
    const lagrima = document.getElementById('lagrima'); // Añadido para la lagrima
    const charco = document.querySelector('.charco'); // Elemento del charco

    
    gotas.forEach(gota => {
        gota.style.animationPlayState = 'paused';
        gota.style.opacity = '0';
        gota.style.top = '80%';
        console.log(gota.style.top);
      });
    let clickCount = 0;
    if (cafe && ceja1 && labios) {
        cafe.addEventListener('click', function() {
            clickCount++;

            if (clickCount === 1) {
                cafe.classList.add('shake');
                ceja1.classList.add('angry-eyebrows1');
            } else if (clickCount === 2) {
                cafe.classList.add('shake-intense');
                ceja1.classList.remove('angry-eyebrows1');
                ceja1.classList.add('angry-eyebrows11');
                ceja2.classList.add('angry-eyebrows22');

                // Activa las gotas de café
                gotas.forEach(gota => {
                    gota.style.opacity = '1';
                    gota.style.animationPlayState = 'running';
                });
            } else if (clickCount === 3) {
                // Hacer que el café caiga
                cafe.classList.add('cafe-caida');
                ceja1.classList.remove('angry-eyebrows11');
                ceja2.classList.remove('angry-eyebrows22');
                ceja1.classList.add('angry-eyebrows111');
                ceja2.classList.add('angry-eyebrows222');
                // Detener las gotas después de la caída
                gotas.forEach(gota => {
                    gota.classList.remove('cafe-gota1');
                    gota.classList.remove('cafe-gota2');
                    gota.classList.remove('cafe-gota3');
                    
                    gota.style.animationPlayState = 'pause'; // Mantener la animación
                    gota.style.opacity = '0'; // Mantener la animación
                });
                charco.style.opacity = '1';
                charco.style.animationPlayState = 'running'; 
                                // Activar la animación de la lágrima
                if (lagrima) {
                    lagrima.style.opacity = '1';  // Hacer visible la lágrima
                    lagrima.style.animationPlayState = 'running';  // Iniciar la animación
                }
                clickCount = 0;
                // Resetear el contador para que no siga añadiendo clases
                
            }

            labios.style.clipPath = 'inset(0 23% 0 36%)';

            cafe.addEventListener('animationend', function() {
                if (clickCount === 2) {
                    cafe.classList.remove('shake-intense');
                } else if (clickCount === 1) {
                    cafe.classList.remove('shake');
                }
                else if(clickCount === 3) {
                    gotas.forEach(gota => {
                        gota.style.animationPlayState = 'pause'; // Mantener la animación
                        gota.style.opacity = '0'; // Mantener la animación
                        console.log("hey");
                        console.log(gota.style.opacity);
                    });
    
                }
            }, { once: true });
        });
    } else {
        console.error("No se encontró el elemento con la clase '.cafe', '.cejas' o '.labios'");
    }
});




document.addEventListener('mousemove', (e) => {
    const ojos = document.querySelector('.ojos'); // Seleccionamos el elemento de los ojos
    const ojosRect = ojos.getBoundingClientRect(); // Obtenemos la posición y tamaño del elemento ojos
    const centroX = ojosRect.left + ojosRect.width / 2; // Centro del ojo en el eje X
    const centroY = ojosRect.top + ojosRect.height / 2; // Centro del ojo en el eje Y

    const maxMovimientoX = ojosRect.width / 18; // Máximo movimiento permitido en X
    const maxMovimientoY = ojosRect.height / 18; // Máximo movimiento permitido en Y

    // Calculamos la distancia relativa al centro del ojo con límites
    const distanciaX = Math.min(Math.max((e.clientX - centroX) / 50, -maxMovimientoX), maxMovimientoX);
    const distanciaY = Math.min(Math.max((e.clientY - centroY) / 50, -maxMovimientoY), maxMovimientoY);

    ojos.style.transform = `translate(${distanciaX}px, ${distanciaY}px)`; // Movemos los ojos ligeramente
});