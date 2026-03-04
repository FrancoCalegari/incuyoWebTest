// ============================================
// INSTITUTO INCUYO - INTERACTIVE FUNCTIONALITY
// ============================================

document.addEventListener("DOMContentLoaded", function () {
	// ============================================
	// NAVBAR SCROLL EFFECT
	// ============================================
	const navbar = document.getElementById("navbar");

	window.addEventListener("scroll", function () {
		if (window.scrollY > 50) {
			navbar.classList.add("scrolled");
		} else {
			navbar.classList.remove("scrolled");
		}
	});

	// ============================================
	// MOBILE NAVIGATION TOGGLE
	// ============================================
	const navbarToggle = document.getElementById("navbarToggle");
	const navbarMenu = document.getElementById("navbarMenu");

	navbarToggle.addEventListener("click", function () {
		navbarToggle.classList.toggle("active");
		navbarMenu.classList.toggle("active");
	});

	// Close mobile menu when clicking on a link
	const navLinks = navbarMenu.querySelectorAll("a");
	navLinks.forEach((link) => {
		link.addEventListener("click", function () {
			navbarToggle.classList.remove("active");
			navbarMenu.classList.remove("active");
		});
	});

	// Close mobile menu when clicking outside
	document.addEventListener("click", function (event) {
		const isClickInsideNav = navbar.contains(event.target);

		if (!isClickInsideNav && navbarMenu.classList.contains("active")) {
			navbarToggle.classList.remove("active");
			navbarMenu.classList.remove("active");
		}
	});

	// ============================================
	// SMOOTH SCROLL NAVIGATION
	// ============================================
	navLinks.forEach((link) => {
		link.addEventListener("click", function (e) {
			const href = this.getAttribute("href");

			// Only apply smooth scroll to internal links
			if (href.startsWith("#")) {
				e.preventDefault();
				const targetId = href.substring(1);
				const targetSection = document.getElementById(targetId);

				if (targetSection) {
					const navbarHeight = navbar.offsetHeight;
					const targetPosition = targetSection.offsetTop - navbarHeight;

					window.scrollTo({
						top: targetPosition,
						behavior: "smooth",
					});
				}
			}
		});
	});

	// ============================================
	// SCROLL REVEAL ANIMATIONS
	// ============================================
	const revealElements = document.querySelectorAll(".reveal");

	const revealOnScroll = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					entry.target.classList.add("active");
					// Optional: unobserve after revealing
					// revealOnScroll.unobserve(entry.target);
				}
			});
		},
		{
			threshold: 0.15,
			rootMargin: "0px 0px -50px 0px",
		},
	);

	revealElements.forEach((element) => {
		revealOnScroll.observe(element);
	});

	// ============================================
	// CURRICULUM ACCORDION
	// ============================================
	const accordionItems = document.querySelectorAll(".accordion-item");

	accordionItems.forEach((item) => {
		const header = item.querySelector(".accordion-header");
		const content = item.querySelector(".accordion-content");

		header.addEventListener("click", function () {
			const isActive = item.classList.contains("active");

			// Close all accordion items
			accordionItems.forEach((otherItem) => {
				otherItem.classList.remove("active");
				const otherContent = otherItem.querySelector(".accordion-content");
				otherContent.style.maxHeight = null;
			});

			// Toggle current item
			if (!isActive) {
				item.classList.add("active");
				content.style.maxHeight = content.scrollHeight + "px";
			}
		});
	});

	// Open first accordion item by default
	if (accordionItems.length > 0) {
		const firstItem = accordionItems[0];
		const firstContent = firstItem.querySelector(".accordion-content");
		firstItem.classList.add("active");
		firstContent.style.maxHeight = firstContent.scrollHeight + "px";
	}

	// ============================================
	// IMAGE GALLERY LIGHTBOX
	// ============================================
	const galleryItems = document.querySelectorAll(".gallery-item");

	// Create lightbox element
	const lightbox = document.createElement("div");
	lightbox.id = "lightbox";
	lightbox.style.cssText = `
        display: none;
        position: fixed;
        z-index: 10000;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.95);
        justify-content: center;
        align-items: center;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;

	const lightboxImg = document.createElement("img");
	lightboxImg.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        object-fit: contain;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    `;

	const closeBtn = document.createElement("button");
	closeBtn.innerHTML = "&times;";
	closeBtn.style.cssText = `
        position: absolute;
        top: 30px;
        right: 30px;
        background: white;
        border: none;
        font-size: 40px;
        color: #333;
        cursor: pointer;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        line-height: 1;
    `;

	closeBtn.addEventListener("mouseenter", function () {
		closeBtn.style.transform = "scale(1.1) rotate(90deg)";
		closeBtn.style.background = "#3b82f6";
		closeBtn.style.color = "white";
	});

	closeBtn.addEventListener("mouseleave", function () {
		closeBtn.style.transform = "scale(1) rotate(0deg)";
		closeBtn.style.background = "white";
		closeBtn.style.color = "#333";
	});

	lightbox.appendChild(lightboxImg);
	lightbox.appendChild(closeBtn);
	document.body.appendChild(lightbox);

	// Open lightbox
	galleryItems.forEach((item) => {
		item.addEventListener("click", function () {
			const img = this.querySelector("img");
			if (img) {
				lightboxImg.src = img.src;
				lightboxImg.alt = img.alt;
				lightbox.style.display = "flex";

				// Trigger fade in
				setTimeout(() => {
					lightbox.style.opacity = "1";
				}, 10);
			}
		});
	});

	// Close lightbox
	function closeLightbox() {
		lightbox.style.opacity = "0";
		setTimeout(() => {
			lightbox.style.display = "none";
		}, 300);
	}

	closeBtn.addEventListener("click", closeLightbox);

	lightbox.addEventListener("click", function (e) {
		if (e.target === lightbox) {
			closeLightbox();
		}
	});

	// Close on ESC key
	document.addEventListener("keydown", function (e) {
		if (e.key === "Escape" && lightbox.style.display === "flex") {
			closeLightbox();
		}
	});

	// ============================================
	// LAZY LOADING IMAGES
	// ============================================
	const lazyImages = document.querySelectorAll('img[loading="lazy"]');

	if ("IntersectionObserver" in window) {
		const imageObserver = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					const img = entry.target;

					// Add fade-in effect
					img.style.transition = "opacity 0.5s ease";

					// Check if image is already loaded (cached)
					if (img.complete && img.naturalHeight !== 0) {
						// Image already loaded, show it immediately
						img.style.opacity = "1";
					} else {
						// Image not loaded yet, start hidden and fade in on load
						img.style.opacity = "0";
						img.addEventListener("load", function () {
							img.style.opacity = "1";
						});
					}

					imageObserver.unobserve(img);
				}
			});
		});

		lazyImages.forEach((img) => {
			imageObserver.observe(img);
		});
	} else {
		// Fallback for browsers without IntersectionObserver
		lazyImages.forEach((img) => {
			img.style.opacity = "1";
		});
	}

	// ============================================
	// PARALLAX EFFECT ON HERO (Optional Enhancement)
	// ============================================
	// DISABLED: Parallax was causing layout issues with other sections
	// Uncomment if needed and adjust for better compatibility
	/*
	const hero = document.querySelector(".hero");

	if (hero) {
		window.addEventListener("scroll", function () {
			const scrolled = window.pageYOffset;
			const parallaxSpeed = 0.5;

			if (scrolled < hero.offsetHeight) {
				hero.style.transform = `translateY(${scrolled * parallaxSpeed}px)`;
			}
		});
	}
	*/

	// ============================================
	// ANIMATED COUNTER (for statistics if added later)
	// ============================================
	function animateCounter(element, target, duration = 2000) {
		let startTime = null;
		const start = 0;

		function updateCounter(currentTime) {
			if (!startTime) startTime = currentTime;
			const progress = Math.min((currentTime - startTime) / duration, 1);

			const current = Math.floor(progress * (target - start) + start);
			element.textContent = current;

			if (progress < 1) {
				requestAnimationFrame(updateCounter);
			} else {
				element.textContent = target;
			}
		}

		requestAnimationFrame(updateCounter);
	}

	// ============================================
	// WHATSAPP BUTTON ANALYTICS (Optional)
	// ============================================
	const whatsappBtn = document.querySelector(".whatsapp-btn");

	if (whatsappBtn) {
		whatsappBtn.addEventListener("click", function () {
			// Log click event (can integrate with Google Analytics)
			console.log("WhatsApp button clicked");

			// Optional: Send event to analytics
			// gtag('event', 'whatsapp_click', { ... });
		});
	}

	// ============================================
	// FORM VALIDATION (if contact form added later)
	// ============================================
	function validateEmail(email) {
		const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return re.test(String(email).toLowerCase());
	}

	function validatePhone(phone) {
		const re = /^[\d\s\-\+\(\)]+$/;
		return re.test(phone) && phone.replace(/\D/g, "").length >= 8;
	}

	// ============================================
	// PERFORMANCE OPTIMIZATION
	// ============================================

	// Debounce function for scroll events
	function debounce(func, wait) {
		let timeout;
		return function executedFunction(...args) {
			const later = () => {
				clearTimeout(timeout);
				func(...args);
			};
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
		};
	}

	// Apply debounce to scroll-heavy functions if needed
	const debouncedScroll = debounce(function () {
		// Any heavy scroll operations
	}, 100);

	window.addEventListener("scroll", debouncedScroll);

	// ============================================
	// ACCESSIBILITY ENHANCEMENTS
	// ============================================

	// Add keyboard navigation support for accordion
	accordionItems.forEach((item) => {
		const header = item.querySelector(".accordion-header");
		header.setAttribute("tabindex", "0");
		header.setAttribute("role", "button");
		header.setAttribute("aria-expanded", "false");

		header.addEventListener("keydown", function (e) {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				header.click();

				const isExpanded = item.classList.contains("active");
				header.setAttribute("aria-expanded", isExpanded);
			}
		});
	});

	// ============================================
	// CONSOLE WELCOME MESSAGE
	// ============================================
	console.log(
		"%c¡Bienvenido al sitio del Instituto INCUYO! 🚀",
		"color: #3b82f6; font-size: 20px; font-weight: bold;",
	);
	console.log(
		"%c¿Interesado en desarrollo de software? Visitá nuestra tecnicatura!",
		"color: #06b6d4; font-size: 14px;",
	);
});

// ============================================
// SERVICE WORKER (Optional for PWA capabilities)
// ============================================
if ("serviceWorker" in navigator) {
	window.addEventListener("load", function () {
		// Uncomment when service worker file is created
		// navigator.serviceWorker.register('/sw.js').then(function(registration) {
		//     console.log('ServiceWorker registered:', registration);
		// }, function(err) {
		//     console.log('ServiceWorker registration failed:', err);
		// });
	});
}

// ============================================
// AI CHATBOT – GEMINI API
// ============================================
(function () {
	// ── Gemini API credentials (leídas desde config.js — ver config.example.js) ──
	const GEMINI_API_KEY = (window.INCUYO_CONFIG && window.INCUYO_CONFIG.GEMINI_API_KEY) || "";
	const GEMINI_MODEL = "gemini-1.5-flash";
	const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

	if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
		console.warn("[INCUYO AI] No se encontró una clave de API válida. Copiá config.example.js → config.js y completá tu GEMINI_API_KEY.");
	}

	// ── Page context the AI will use ────────────────────────────────────────
	const PAGE_CONTEXT = `
Eres el asistente virtual oficial del Instituto INCUYO (Instituto de Estudios Superiores Nuevo Cuyo PT-169), ubicado en La Rioja 614, Ciudad de Mendoza, Argentina.

INSTRUCCIÓN FUNDAMENTAL: Solo debes responder preguntas relacionadas con el Instituto INCUYO, sus programas, inscripciones, certificaciones, metodología y contacto. Si la pregunta NO tiene relación con el instituto, responde exactamente: "Lo siento, solo puedo responder preguntas relacionadas con el Instituto INCUYO y su oferta educativa."

INFORMACIÓN DEL INSTITUTO:
- Nombre completo: Instituto de Estudios Superiores Nuevo Cuyo PT-169
- Carrera: Tecnicatura Superior en Desarrollo de Software
- Duración: 6 cuatrimestres (3 años)
- Modalidad: Presencial / Bimodal (también por Zoom, clases grabadas para consultas)
- Resolución: 2024-6079-E-GDEMZA-DGE
- Ubicación: La Rioja 614, Ciudad de Mendoza, Argentina
- Teléfono/WhatsApp: (+054) 261 6271658
- Email: incuyo@gmail.com
- Campus Virtual: aula.incuyo.edu.ar

TÍTULOS QUE OTORGA:
- Título Nacional: Técnico Superior en Desarrollo de Software
- Títulos intermedios: Programador Junior / Desarrollador Full Stack Junior

CONDICIONES DE INGRESO:
- Haber aprobado el nivel Secundario o Ciclo Polimodal
- O ser mayor de 25 años según el Art. 7° de la Ley de Educación Superior N° 24.521

PLAN DE ESTUDIOS:
1° AÑO: Programación 1 + IA, Matemática aplicada, Lógica computacional, Inglés técnico 1, Alfabetización académica, Seminario de nuevas tecnologías + IA, Arquitectura de dispositivos, Sistemas operativos 1, Base de datos 1, Práctica Profesionalizante 1 + IA.
2° AÑO: Programación 2 + IA, Matemática discreta, Comunicación y redes, Inglés técnico 2, Modelado de software + IA, Sistemas Operativos 2, Base de datos 2 + IA, Práctica Profesionalizante 2 + IA.
3° AÑO: Programación 3 + IA, Arquitectura y diseño de interfaces UI y UX + IA, Auditoría y calidad de sistemas, Ciberseguridad + IA, Inglés técnico 3, Legislación informática y ética profesional, Estadística y probabilidades para el desarrollo de software, Gestión de proyectos de software, Metodologías ágiles + IA, Base de datos 3 + IA, Práctica Profesionalizante 3 + IA.

CERTIFICACIONES LABORALES ADICIONALES (coprogramáticas):
1° Año: Técnico en Hardware y Software, Programador Python (nivel Junior).
2° Año: Sistemas Operativos (Linux-Windows), Sistemas de Programación Pymes, Análisis y Técnicas de sistemas.
3° Año: Diseño y programación de páginas web, WEB SITE con base de datos dinámicas, Inteligencia Artificial en la nube.

BECAS E INSCRIPCIONES:
- Inscripciones abiertas desde agosto.
- Becas con hasta 40% de descuento.
- Consultas por WhatsApp: (+054) 261 6271658

CARACTERÍSTICAS DESTACADAS:
- Clases prácticas desde la primera semana con proyectos reales.
- Docentes con experiencia en la industria del software.
- Ambiente colaborativo y de excelente compañerismo.
- Inteligencia Artificial integrada en varias materias.
- Campus virtual en aula.incuyo.edu.ar.
- Los alumnos pueden crear proyectos reales desde el primer año.
- Compromiso social: alumnos organizan actividades para ayudar a la comunidad.
`;

	// ── DOM references ───────────────────────────────────────────────────────
	const chatBtn = document.getElementById("aiChatBtn");
	const chatWindow = document.getElementById("aiChatWindow");
	const closeBtn = document.getElementById("aiChatClose");
	const messagesEl = document.getElementById("aiChatMessages");
	const inputEl = document.getElementById("aiChatInput");
	const sendBtn = document.getElementById("aiChatSend");

	if (!chatBtn || !chatWindow) return; // Safety guard

	// ── Conversation history (Gemini multi-turn format) ──────────────────────
	let history = [];
	let isLoading = false;

	// ── Toggle chat window ───────────────────────────────────────────────────
	function openChat() {
		chatWindow.classList.add("open");
		chatWindow.setAttribute("aria-hidden", "false");
		inputEl.focus();
	}

	function closeChat() {
		chatWindow.classList.remove("open");
		chatWindow.setAttribute("aria-hidden", "true");
	}

	chatBtn.addEventListener("click", function () {
		if (chatWindow.classList.contains("open")) {
			closeChat();
		} else {
			openChat();
		}
	});

	closeBtn.addEventListener("click", closeChat);

	// Close on ESC
	document.addEventListener("keydown", function (e) {
		if (e.key === "Escape" && chatWindow.classList.contains("open")) {
			closeChat();
		}
	});

	// ── Auto-resize textarea ─────────────────────────────────────────────────
	inputEl.addEventListener("input", function () {
		this.style.height = "auto";
		this.style.height = Math.min(this.scrollHeight, 110) + "px";
	});

	// ── Send on Enter (Shift+Enter = new line) ───────────────────────────────
	inputEl.addEventListener("keydown", function (e) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	});

	sendBtn.addEventListener("click", sendMessage);

	// ── Append a message bubble ──────────────────────────────────────────────
	function appendMessage(text, role, isError = false) {
		const wrapper = document.createElement("div");
		wrapper.className = `ai-chat-msg ai-chat-msg--${role}${isError ? " ai-chat-msg--error" : ""}`;

		const bubble = document.createElement("div");
		bubble.className = "ai-chat-msg-bubble";
		bubble.innerHTML = text.replace(/\n/g, "<br>");

		wrapper.appendChild(bubble);
		messagesEl.appendChild(wrapper);
		scrollToBottom();
		return wrapper;
	}

	// ── Typing indicator ─────────────────────────────────────────────────────
	function showTyping() {
		const wrapper = document.createElement("div");
		wrapper.className = "ai-chat-msg ai-chat-msg--bot";
		wrapper.id = "aiTypingIndicator";

		const dot = document.createElement("div");
		dot.className = "ai-chat-typing";
		dot.innerHTML = "<span></span><span></span><span></span>";

		wrapper.appendChild(dot);
		messagesEl.appendChild(wrapper);
		scrollToBottom();
	}

	function hideTyping() {
		const el = document.getElementById("aiTypingIndicator");
		if (el) el.remove();
	}

	function scrollToBottom() {
		messagesEl.scrollTop = messagesEl.scrollHeight;
	}

	// ── Main send function ───────────────────────────────────────────────────
	async function sendMessage() {
		const text = inputEl.value.trim();
		if (!text || isLoading) return;

		// Reset input
		inputEl.value = "";
		inputEl.style.height = "auto";

		// Show user message
		appendMessage(text, "user");

		// Add to history
		history.push({ role: "user", parts: [{ text }] });

		// Lock UI
		isLoading = true;
		sendBtn.disabled = true;

		showTyping();

		try {
			const response = await fetch(GEMINI_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					system_instruction: {
						parts: [{ text: PAGE_CONTEXT }]
					},
					contents: history,
					generationConfig: {
						temperature: 0.4,
						maxOutputTokens: 600
					}
				})
			});

			// Always parse JSON first to get real error messages
			const data = await response.json();

			if (!response.ok) {
				const apiMsg = data?.error?.message || "";
				console.error("[INCUYO AI] API error body:", JSON.stringify(data));
				if (response.status === 400 && (apiMsg.includes("API key not valid") || apiMsg.includes("INVALID_ARGUMENT"))) {
					throw new Error("API_KEY_INVALID");
				}
				throw new Error(`HTTP ${response.status}: ${apiMsg || "Error desconocido"}`);
			}

			// Extract reply text
			const reply =
				data?.candidates?.[0]?.content?.parts?.[0]?.text ||
				"Lo siento, no pude generar una respuesta. Por favor intentá de nuevo.";

			hideTyping();
			appendMessage(reply, "bot");

			// Add to history
			history.push({ role: "model", parts: [{ text: reply }] });

		} catch (err) {
			hideTyping();
			console.error("AI Chatbot error:", err);

			if (err.message === "API_KEY_INVALID") {
				appendMessage(
					"⚠️ La clave de la API de Gemini no es válida. Configurala en <code>config.js</code> (ver README).",
					"bot",
					true
				);
			} else {
				appendMessage(
					`⚠️ Error: ${err.message}. Revisá la consola para más detalles.`,
					"bot",
					true
				);
			}
		} finally {
			isLoading = false;
			sendBtn.disabled = false;
			inputEl.focus();
		}
	}
})();
