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

	// --- CHATBOT GEMINI (Lógica Core) ---
	const chatLogic = (() => {
		const API_KEY = window.INCUYO_CONFIG?.GEMINI_API_KEY || "";
		const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
		const history = [];

		async function askGemini(prompt) {
			const res = await fetch(URL, {
				method: "POST",
				body: JSON.stringify({
					system_instruction: { parts: [{ text: "Contexto del Instituto INCUYO..." }] },
					contents: history.concat([{ role: "user", parts: [{ text: prompt }] }])
				})
			});
			const data = await res.json();
			return data.candidates[0].content.parts[0].text;
		}
		// ... (Interacción con el DOM del chat se mantiene similar)
	})();

	console.log("%cInstituto INCUYO 🚀", "color:#3b82f6; font-size:20px; font-weight:bold;");
});