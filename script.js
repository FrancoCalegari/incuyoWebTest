document.addEventListener("DOMContentLoaded", () => {
	const navbar = document.getElementById("navbar");
	const navMenu = document.getElementById("navbarMenu");
	const navToggle = document.getElementById("navbarToggle");

	// --- NAVEGACIÓN ---
	window.addEventListener("scroll", () => navbar.classList.toggle("scrolled", window.scrollY > 50));

	const toggleMenu = (state) => {
		navToggle.classList.toggle("active", state);
		navMenu.classList.toggle("active", state);
	};

	navToggle.onclick = () => toggleMenu(!navMenu.classList.contains("active"));

	document.addEventListener("click", (e) => {
		if (!navbar.contains(e.target) || e.target.tagName === 'A') toggleMenu(false);
	});

	// Smooth Scroll
	document.querySelectorAll('a[href^="#"]').forEach(anchor => {
		anchor.onclick = (e) => {
			e.preventDefault();
			const target = document.querySelector(anchor.getAttribute("href"));
			if (target) window.scrollTo({ top: target.offsetTop - navbar.offsetHeight, behavior: "smooth" });
		};
	});

	// --- COMPONENTES UI (Acordeón y Reveal) ---
	const items = document.querySelectorAll(".accordion-item");
	items.forEach(item => {
		item.querySelector(".accordion-header").onclick = () => {
			const isOpen = item.classList.contains("active");
			items.forEach(i => { i.classList.remove("active"); i.querySelector(".accordion-content").style.maxHeight = null; });
			if (!isOpen) {
				item.classList.add("active");
				item.querySelector(".accordion-content").style.maxHeight = item.querySelector(".accordion-content").scrollHeight + "px";
			}
		};
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

	// --- CHATBOT BACKEND (usa /api/chat del servidor) ---
	const chatBtn    = document.getElementById("aiChatBtn");
	const chatWindow = document.getElementById("aiChatWindow");
	const chatClose  = document.getElementById("aiChatClose");
	const chatInput  = document.getElementById("aiChatInput");
	const chatSend   = document.getElementById("aiChatSend");
	const chatMsgs   = document.getElementById("aiChatMessages");

	if (!chatBtn || !chatWindow) return; // seguridad

	// historial multi-turno (formato para el backend)
	const chatHistory = [];

	// Abrir / Cerrar ventana
	chatBtn.onclick = () => {
		const isOpen = chatWindow.classList.toggle("active");
		chatWindow.setAttribute("aria-hidden", String(!isOpen));
		chatBtn.classList.toggle("active", isOpen);
		if (isOpen) chatInput.focus();
	};
	chatClose.onclick = () => {
		chatWindow.classList.remove("active");
		chatWindow.setAttribute("aria-hidden", "true");
		chatBtn.classList.remove("active");
	};

	// Auto-resize del textarea
	chatInput.addEventListener("input", () => {
		chatInput.style.height = "auto";
		chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
	});

	// Enviar con Enter (Shift+Enter = nueva línea)
	chatInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	});
	chatSend.onclick = sendMessage;

	/** Agrega un mensaje al DOM del chat */
	function appendMessage(role, textContent, richContent) {
		const wrapper = document.createElement("div");
		wrapper.className = `ai-chat-msg ai-chat-msg--${role === "user" ? "user" : "bot"}`;

		const bubble = document.createElement("div");
		bubble.className = "ai-chat-msg-bubble";

		// Rich content (tablas / cards) va ANTES del texto
		if (richContent) {
			const richDiv = document.createElement("div");
			richDiv.className = "ai-chat-rich";
			richDiv.innerHTML = richContent; // HTML generado en el server
			bubble.appendChild(richDiv);
		}

		// Texto de la IA (con soporte básico de **negrita** y saltos de línea)
		if (textContent) {
			const textDiv = document.createElement("div");
			textDiv.className = "ai-chat-text";
			textDiv.innerHTML = formatText(textContent);
			bubble.appendChild(textDiv);
		}

		wrapper.appendChild(bubble);
		chatMsgs.appendChild(wrapper);
		chatMsgs.scrollTop = chatMsgs.scrollHeight;
		return wrapper;
	}

	/** Formato básico: **negrita**, \n → <br> */
	function formatText(text) {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
			.replace(/\n/g, "<br>");
	}

	/** Indicador de "escribiendo..." */
	function showTyping() {
		const el = document.createElement("div");
		el.className = "ai-chat-msg ai-chat-msg--bot ai-chat-typing";
		el.innerHTML = `<div class="ai-chat-msg-bubble">
			<span class="typing-dot"></span>
			<span class="typing-dot"></span>
			<span class="typing-dot"></span>
		</div>`;
		chatMsgs.appendChild(el);
		chatMsgs.scrollTop = chatMsgs.scrollHeight;
		return el;
	}

	async function sendMessage() {
		const prompt = chatInput.value.trim();
		if (!prompt) return;

		// Mostrar mensaje del usuario
		appendMessage("user", prompt);
		chatInput.value = "";
		chatInput.style.height = "auto";
		chatSend.disabled = true;

		const typingEl = showTyping();

		try {
			const res = await fetch("/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt, history: chatHistory }),
			});

			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();

			typingEl.remove();

			const botText = data.response || "Lo siento, no pude procesar tu consulta.";
			const richContent = data.richContent || "";

			// Mostrar respuesta
			appendMessage("bot", botText, richContent);

			// Actualizar historial multi-turno
			chatHistory.push({ role: "user",  parts: [{ text: prompt }] });
			chatHistory.push({ role: "model", parts: [{ text: botText }] });

			// Mantener historial acotado (últimos 10 turnos = 20 mensajes)
			if (chatHistory.length > 20) chatHistory.splice(0, chatHistory.length - 20);

		} catch (err) {
			typingEl.remove();
			appendMessage("bot", "❌ Hubo un error al conectar con el asistente. Intentá de nuevo en unos segundos.");
			console.error("[Chat] Error:", err);
		} finally {
			chatSend.disabled = false;
			chatInput.focus();
		}
	}

	console.log("%cInstituto INCUYO 🚀", "color:#3b82f6; font-size:20px; font-weight:bold;");
});