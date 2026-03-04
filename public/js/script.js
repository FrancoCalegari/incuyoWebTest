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
				const res = await fetch("/api/chat", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ prompt, history: chatHistory }),
				});
				const data = await res.json();

				if (typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);

				if (data.response) {
					chatHistory.push({ role: "user", parts: [{ text: prompt }] });
					chatHistory.push({ role: "model", parts: [{ text: data.response }] });
					addMessage(data.response, true);
				} else {
					addMessage("Lo siento, hubo un error. Por favor intentá de nuevo.", true);
				}
			} catch (err) {
				if (typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
				addMessage("Error de conexión. Intentá de nuevo más tarde.", true);
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

	console.log("%cInstituto INCUYO 🚀", "color:#3b82f6; font-size:20px; font-weight:bold;");
});