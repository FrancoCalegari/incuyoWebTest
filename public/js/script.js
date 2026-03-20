document.addEventListener("DOMContentLoaded", () => {
	const navbar = document.getElementById("navbar");
	const navMenu = document.getElementById("navbarMenu");
	const navToggle = document.getElementById("navbarToggle");

	// --- NAVEGACIÓN ---
	if (navbar) {
		window.addEventListener("scroll", () => navbar.classList.toggle("scrolled", window.scrollY > 50));
	}

	if (navToggle && navMenu) {
		const toggleMenu = (state) => {
			navToggle.classList.toggle("active", state);
			navMenu.classList.toggle("active", state);
		};

		navToggle.onclick = () => toggleMenu(!navMenu.classList.contains("active"));

		document.addEventListener("click", (e) => {
			if (!navbar.contains(e.target) || e.target.tagName === 'A') toggleMenu(false);
		});
	}

	// Smooth Scroll
	document.querySelectorAll('a[href^="#"]').forEach(anchor => {
		anchor.onclick = (e) => {
			e.preventDefault();
			const target = document.querySelector(anchor.getAttribute("href"));
			if (target && navbar) window.scrollTo({ top: target.offsetTop - navbar.offsetHeight, behavior: "smooth" });
		};
	});

	// --- COMPONENTES UI (Acordeón y Reveal) ---
	const items = document.querySelectorAll(".accordion-item");
	items.forEach(item => {
		const header = item.querySelector(".accordion-header");
		if (header) {
			header.onclick = () => {
				const isOpen = item.classList.contains("active");
				items.forEach(i => { i.classList.remove("active"); const c = i.querySelector(".accordion-content"); if (c) c.style.maxHeight = null; });
				if (!isOpen) {
					item.classList.add("active");
					const content = item.querySelector(".accordion-content");
					if (content) content.style.maxHeight = content.scrollHeight + "px";
				}
			};
		}
	});

	const observer = new IntersectionObserver(entries => {
		entries.forEach(en => { if (en.isIntersecting) en.target.classList.add("active"); });
	}, { threshold: 0.15 });
	document.querySelectorAll(".reveal").forEach(el => observer.observe(el));

	// --- LIGHTBOX SIMPLIFICADO ---
	const lb = document.createElement("div");
	lb.id = "lightbox";
	lb.innerHTML = `<img style="max-width:90%; max-height:90%; border-radius:12px;"><button style="position:absolute; top:20px; right:20px; font-size:40px; color:white; background:none; border:none; cursor:pointer;">&times;</button>`;
	Object.assign(lb.style, { display: "none", position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center" });
	document.body.appendChild(lb);

	document.querySelectorAll(".gallery-item img").forEach(img => {
		img.onclick = () => {
			lb.querySelector("img").src = img.src;
			lb.style.display = "flex";
		};
	});
	lb.onclick = () => lb.style.display = "none";

	// --- CHATBOT GEMINI (via Backend Proxy) ---
	const chatBtn = document.getElementById("aiChatBtn");
	const chatWindow = document.getElementById("aiChatWindow");
	const chatClose = document.getElementById("aiChatClose");
	const chatMessages = document.getElementById("aiChatMessages");
	const chatInput = document.getElementById("aiChatInput");
	const chatSend = document.getElementById("aiChatSend");

	if (chatBtn && chatWindow) {
		const chatHistory = [];

		function toggleChat(forceClose) {
			const isOpen = chatWindow.classList.contains("open");
			if (forceClose || isOpen) {
				chatWindow.classList.remove("open");
				chatWindow.setAttribute("aria-hidden", "true");
			} else {
				chatWindow.classList.add("open");
				chatWindow.setAttribute("aria-hidden", "false");
				if (chatInput) chatInput.focus();
			}
		}

		chatBtn.onclick = () => toggleChat(false);

		if (chatClose) chatClose.onclick = () => toggleChat(true);

		function addMessage(text, isBot) {
			const msgDiv = document.createElement("div");
			msgDiv.className = `ai-chat-msg ai-chat-msg--${isBot ? 'bot' : 'user'}`;
			// Simple markdown-like formatting for bot responses
			let html = text;
			if (isBot) {
				html = html
					.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
					.replace(/\n/g, '<br>');
			}
			msgDiv.innerHTML = `<div class="ai-chat-msg-bubble">${html}</div>`;
			chatMessages.appendChild(msgDiv);
			chatMessages.scrollTop = chatMessages.scrollHeight;
		}

		function showTyping() {
			const typingDiv = document.createElement("div");
			typingDiv.className = "ai-chat-msg ai-chat-msg--bot";
			typingDiv.id = "chatTyping";
			typingDiv.innerHTML = '<div class="ai-chat-typing"><span></span><span></span><span></span></div>';
			chatMessages.appendChild(typingDiv);
			chatMessages.scrollTop = chatMessages.scrollHeight;
			return typingDiv;
		}

		async function sendMessage() {
			const prompt = chatInput.value.trim();
			if (!prompt) return;

			addMessage(prompt, false);
			chatInput.value = "";
			chatInput.style.height = 'auto';

			const typingEl = showTyping();

			try {
				console.log("🤖 Enviando consulta a la IA:", prompt);

				// Filtramos el historial para que solo contenga roles válidos (user/model)
				// Eliminamos entradas de "action" o roles no soportados por la API estándar
				const cleanHistory = chatHistory.filter(h => h.role === 'user' || h.role === 'model');

				const res = await fetch("/api/chat", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ prompt, history: cleanHistory }),
				});

				const data = await res.json();
				console.log("📥 Respuesta recibida del servidor:", data);

				if (typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);

				if (!res.ok) {
					console.error("❌ Error en respuesta del servidor:", data);
					if (res.status === 429 || (data.details && JSON.stringify(data.details).includes('429'))) {
						addMessage("¡Uf! Estoy recibiendo muchos mensajes a la vez. 😅 Por favor, esperá un minuto y volvé a preguntarme.", true);
					} else if (data.status === 400 || (data.details && JSON.stringify(data.details).includes('API key not valid'))) {
						addMessage("⚠️ Hay un problema con la configuración del chat (Clave API inválida). Por favor, contactá al administrador.", true);
					} else {
						addMessage("Lo siento, hubo un error interno. Por favor intentá de nuevo más tarde.", true);
					}
					return;
				}

				if (data.response) {
					console.log("✅ Renderizando respuesta de la IA");
					chatHistory.push({ role: "user", parts: [{ text: prompt }] });
					chatHistory.push({ role: "model", parts: [{ text: data.response }] });

					addMessage(data.response, true);

					// Ejecutar acción de UI si el bot la pidió (aunque ahora el backend no las envía, mantenemos por compatibilidad futura)
					if (data.action) {
						console.log("⚡ Ejecutando acción de UI:", data.action);
						setTimeout(() => {
							if (data.action === "mostrar_plan_de_estudios") {
								window.location.href = "/#plan-de-estudios";
								setTimeout(() => toggleChat(true), 1500);
							} else if (data.action === "mostrar_proyectos") {
								window.location.href = "/proyectosalumnos";
							} else if (data.action === "mostrar_compromiso_social") {
								window.location.href = "/#compromiso-social";
								setTimeout(() => toggleChat(true), 1500);
							}
						}, 1200);
					}
				} else {
					console.warn("⚠️ Advertencia: Respuesta parseada correctamente pero sin campo 'response'");
					addMessage("El bot no pudo generar una respuesta. Por favor intentá de nuevo.", true);
				}
			} catch (err) {
				console.error("❌ Error CRÍTICO de conexión:", err);
				if (typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
				addMessage("Error de conexión con el servidor. Asegurate de que el servicio esté activo e intentá de nuevo.", true);
			}
		}

		if (chatSend) chatSend.onclick = sendMessage;
		if (chatInput) {
			chatInput.addEventListener("keydown", (e) => {
				if (e.key === "Enter" && !e.shiftKey) {
					e.preventDefault();
					sendMessage();
				}
			});
			// Auto-resize textarea
			chatInput.addEventListener("input", () => {
				chatInput.style.height = 'auto';
				chatInput.style.height = Math.min(chatInput.scrollHeight, 110) + 'px';
			});
		}
	}

	// --- TYPEWRITER EFFECT PARA HERO TITLE ---
	const heroTitle = document.querySelector('.hero-title');
	if (heroTitle) {
		const phrases = ["Imagina tu Futuro", "Escribe tu Futuro", "Mejora tu Futuro", "Crea tu Futuro"];
		let currentPhraseIndex = 0;
		let isDeleting = false;
		let currentText = phrases[0];
		let isWaiting = true;

		function typeWriter() {
			const fullText = phrases[currentPhraseIndex];

			if (isWaiting) {
				isWaiting = false;
				isDeleting = true;
				setTimeout(typeWriter, 3000);
				return;
			}

			if (isDeleting) {
				currentText = fullText.substring(0, currentText.length - 1);
			} else {
				currentText = fullText.substring(0, currentText.length + 1);
			}

			heroTitle.innerHTML = currentText + '<span class="typewriter-cursor">|</span>';

			let typeSpeed = isDeleting ? 50 : 100;

			if (!isDeleting && currentText === fullText) {
				isWaiting = true;
				typeSpeed = 0;
			} else if (isDeleting && currentText === "") {
				isDeleting = false;
				currentPhraseIndex = (currentPhraseIndex + 1) % phrases.length;
				typeSpeed = 500;
			}

			setTimeout(typeWriter, typeSpeed);
		}

		heroTitle.innerHTML = currentText + '<span class="typewriter-cursor">|</span>';
		setTimeout(typeWriter, 3000);
	}

	console.log("%cInstituto INCUYO 🚀", "color:#3b82f6; font-size:20px; font-weight:bold;");
});