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
