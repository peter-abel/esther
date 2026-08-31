var pdProjects = {
  apo: {
    title: "Apo Residential Layout",
    location: "Kigali, Rwanda",
    type: "Residential",
    date: "Design Phase",
    size: "2,400 sqm",
    timeline: "16 Months",
    scope: "Architectural Design",
    heroImage: "img/portfolio/Apo Layout.png",
    sideImage: "img/portfolio/Apo Layout.png",
    outcome: "A bespoke residential layout crafted to maximize natural light, airflow, and outdoor living while prioritizing energy efficiency and sustainable materials.",
    description: "The Apo Residential Layout is a bespoke residential design developed around family living. Building orientation, openings, and material choices were carefully composed to respond to the Kigali climate, creating a home that is comfortable, efficient, and connected to its landscape.",
    highlights: [
      { icon: "fa-sun-o", title: "Passive Solar Design", text: "Orientation and openings optimized for natural light and cross-ventilation." },
      { icon: "fa-leaf", title: "Green Design", text: "Energy-efficient systems and sustainable, locally sourced materials." },
      { icon: "fa-tint", title: "Water Conservation", text: "Rainwater harvesting and low-flow fixtures reduce overall water use." }
    ],
    gallery: [
      { src: "img/portfolio/Apo Layout.png", alt: "Apo Residential Layout" },
      { src: "img/portfolio/apo gallery/2.png", alt: "Apo Residential Layout - Floor Plan" },
      { src: "img/portfolio/apo gallery/3.png", alt: "Apo Residential Layout - Plan Detail" }
    ],
    plans: [
      { label: "2 Bed Floor Plan (PDF)", url: "img/portfolio/apo gallery/2 bed floor plan.pdf" },
      { label: "Site Plan (PDF)", url: "img/portfolio/apo gallery/site plan.pdf" }
    ]
  },
  murenzi: {
    title: "Murenzi Residence",
    location: "Kigali, Rwanda",
    type: "Residential",
    date: "Design Phase",
    size: "1,600 sqm",
    timeline: "12 Months",
    scope: "Architectural Design",
    heroImage: "img/portfolio/murenzi.jpg",
    sideImage: "img/portfolio/murenzi.jpg",
    outcome: "A refined private residence designed around family living, blending contemporary architecture with sustainable building practices and energy-efficient systems.",
    description: "The Murenzi Residence is a contemporary private home conceived around family life. The design balances generous living spaces with sustainability, using energy-efficient systems and natural ventilation to keep running costs low while creating a calm, light-filled environment.",
    highlights: [
      { icon: "fa-sun-o", title: "Passive Solar Design", text: "Orientation and openings optimized for natural light and cross-ventilation." },
      { icon: "fa-leaf", title: "Green Design", text: "Energy-efficient systems and sustainable, locally sourced materials." },
      { icon: "fa-tint", title: "Water Conservation", text: "Rainwater harvesting and low-flow fixtures reduce overall water use." }
    ],
    gallery: [
      { src: "img/portfolio/murenzi.jpg", alt: "Murenzi Residence" },
      { src: "img/portfolio/murenzi gallery/3D_Perspective_03.jpg", alt: "Murenzi Residence - 3D Perspective" },
      { src: "img/portfolio/murenzi gallery/3D_Perspective_06.jpg", alt: "Murenzi Residence - 3D Perspective" }
    ],
    plans: [],
    beforeAfter: {
      before: "img/portfolio/murenzi gallery/before1.jpeg",
      after: "img/portfolio/murenzi gallery/3D_Perspective_03.jpg"
    }
  },
  ishami: {
    title: "ISHAMI Residence",
    location: "Ishami, Kigali",
    type: "Residential",
    date: "Design Phase",
    size: "1,200 sqm",
    timeline: "10 Months",
    scope: "Architectural Design",
    heroImage: "img/portfolio/2 ISHAMI.jpeg",
    sideImage: "img/portfolio/2 ISHAMI.jpeg",
    outcome: "A contemporary residential project in Ishami, designed with a focus on indoor-outdoor flow, natural ventilation, and sustainable, locally sourced materials.",
    description: "The ISHAMI Residence is a contemporary residential project in the Ishami neighborhood of Kigali. The design emphasizes indoor-outdoor flow and natural ventilation, creating a light and airy home built with locally sourced, sustainable materials.",
    highlights: [
      { icon: "fa-sun-o", title: "Passive Solar Design", text: "Orientation and openings optimized for natural light and cross-ventilation." },
      { icon: "fa-leaf", title: "Green Design", text: "Energy-efficient systems and sustainable, locally sourced materials." },
      { icon: "fa-tint", title: "Water Conservation", text: "Rainwater harvesting and low-flow fixtures reduce overall water use." }
    ],
    gallery: [
      { src: "img/portfolio/2 ISHAMI.jpeg", alt: "ISHAMI Residence" },
      { src: "img/portfolio/ishami Gallery/1 ISHAMI.jpeg", alt: "ISHAMI Residence - View 1" },
      { src: "img/portfolio/ishami Gallery/3 ISHAMI.jpeg", alt: "ISHAMI Residence - View 3" },
      { src: "img/portfolio/ishami Gallery/4 ISHAMI.jpeg", alt: "ISHAMI Residence - View 4" },
      { src: "img/portfolio/ishami Gallery/5 ISHAMI.png", alt: "ISHAMI Residence - View 5" }
    ],
    plans: [
      { label: "Proposed ISHAMI Apartments (PDF)", url: "img/portfolio/ishami Gallery/THE PROPOSED ISHAMI APARTMENTS-REV-02-09-03-2026 (1).pdf" }
    ]
  }
};

function initializeProjectDetails() {
  var hero = document.getElementById("project-hero");
  if (!hero) return;

  var params = new URLSearchParams(window.location.search);
  var key = params.get("project") || "apo";
  var project = pdProjects[key] || pdProjects.apo;

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // Hero
  hero.style.backgroundImage = "url('" + project.heroImage + "')";
  setText("project-title", project.title);
  setText("project-location", project.location);
  setText("project-type", project.type);
  setText("project-date", project.date);
  setText("project-outcome-text", project.outcome);

  // Quick facts
  setText("fact-location", project.location);
  setText("fact-size", project.size);
  setText("fact-timeline", project.timeline);
  setText("fact-scope", project.scope);

  // About
  setText("project-description", project.description);
  var sideImage = document.getElementById("project-side-image");
  if (sideImage) {
    sideImage.src = project.sideImage;
    sideImage.alt = project.title;
  }

  // Design highlights
  var features = document.getElementById("project-features");
  if (features) {
    features.innerHTML = project.highlights.map(function (h) {
      return '<div class="col-md-4"><div class="text-center">' +
        '<i class="fa ' + h.icon + ' fa-3x" style="color: #2c3e50; margin-bottom: 15px;"></i>' +
        '<h4>' + h.title + '</h4><p>' + h.text + '</p></div></div>';
    }).join("");
  }

  // Gallery
  var gallery = document.getElementById("project-gallery");
  if (gallery) {
    gallery.innerHTML = project.gallery.map(function (g) {
      return '<div class="gallery-item"><img src="' + g.src + '" alt="' + g.alt + '"></div>';
    }).join("");
  }

  // Before & After comparison slider
  var beforeAfterSection = document.getElementById("before-after-section");
  var beforeImg = document.getElementById("comparison-before");
  var afterImg = document.getElementById("comparison-after");
  if (beforeAfterSection && beforeImg && afterImg) {
    if (project.beforeAfter) {
      beforeAfterSection.style.display = "";
      beforeImg.src = project.beforeAfter.before;
      beforeImg.alt = project.title + " - Before";
      afterImg.src = project.beforeAfter.after;
      afterImg.alt = project.title + " - After";
      initComparisonSlider();
    } else {
      beforeAfterSection.style.display = "none";
    }
  }

  // Layout plans (PDFs)
  var plansSection = document.getElementById("layout-plans-section");
  var plans = document.getElementById("project-plans");
  if (plansSection && plans) {
    if (project.plans.length > 0) {
      plansSection.style.display = "";
      plans.innerHTML = project.plans.map(function (p) {
        return '<a href="' + p.url + '" target="_blank" rel="noopener" class="btn btn-primary">' +
          '<i class="fa fa-file-pdf-o"></i> ' + p.label + '</a>';
      }).join("");
    } else {
      plansSection.style.display = "none";
    }
  }

  // Browser tab title
  document.title = project.title + " - Sanifu Limited";
}

function initComparisonSlider() {
  var slider = document.getElementById("comparison-slider");
  var handle = document.getElementById("comparison-handle");
  var beforeImg = document.getElementById("comparison-before");
  if (!slider || !handle || !beforeImg) return;

  var dragging = false;

  function applyPosition(pct) {
    pct = Math.max(0, Math.min(100, pct));
    handle.style.left = pct + "%";
    beforeImg.style.clipPath =
      "polygon(0 0, " + pct + "% 0, " + pct + "% 100%, 0 100%)";
  }

  function setFromPointer(clientX) {
    var rect = slider.getBoundingClientRect();
    if (rect.width > 0) {
      applyPosition(((clientX - rect.left) / rect.width) * 100);
    }
  }

  slider.addEventListener("pointerdown", function (e) {
    dragging = true;
    slider.classList.add("dragging");
    setFromPointer(e.clientX);
    e.preventDefault();
  });

  window.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    setFromPointer(e.clientX);
  });

  window.addEventListener("pointerup", function () {
    dragging = false;
    slider.classList.remove("dragging");
  });

  window.addEventListener("pointercancel", function () {
    dragging = false;
    slider.classList.remove("dragging");
  });

  // Keyboard support (arrow keys)
  handle.setAttribute("tabindex", "0");
  handle.addEventListener("keydown", function (e) {
    var current = parseFloat(handle.style.left) || 50;
    if (e.key === "ArrowLeft") {
      applyPosition(current - 5);
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      applyPosition(current + 5);
      e.preventDefault();
    }
  });

  applyPosition(50);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeProjectDetails);
} else {
  initializeProjectDetails();
}
