import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import usePage from "../hooks/usePage";
import css from "../styles/index.css?raw";

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "about", label: "About Us" },
  { id: "services", label: "Services" },
];

const SERVICES = [
  {
    title: "Request Supplies",
    category: "Bond paper, pens, markers, and office supplies",
    description:
      "Look up available supplies online and submit a request in seconds. Once approved, you can pick up your items at the supply window using your digital claim slip.",
    icon: (
      <>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </>
    ),
  },
  {
    title: "Borrow Equipment",
    category: "Projectors, laptops, cables, and other school equipment",
    description:
      "Reserve projectors, laptops, and other school equipment ahead of time for your classes, thesis defense, or university events. Return items on schedule with ease.",
    icon: (
      <>
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="17" />
      </>
    ),
  },
  {
    title: "Track & Manage Records",
    category: "History, inventory tracking, and clearance status",
    description:
      "Keep a clear record of all your requests and borrowed items. Staff can manage live inventory, while students and faculty ensure their semester clearance stays clear.",
    icon: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </>
    ),
  },
];

export default function Home() {
  usePage(css, "BukSUPPLY");

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState("overview");

  const navRef = useRef(null);
  const toggleRef = useRef(null);

  // Mobile menu: close on outside click, Escape, or viewport resize to desktop
  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (e) => {
      const inMenu = navRef.current && navRef.current.contains(e.target);
      const inToggle = toggleRef.current && toggleRef.current.contains(e.target);
      if (!inMenu && !inToggle) setMenuOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);

    // Sync with mobile media query breakpoint (768px)
    const mql = window.matchMedia("(min-width: 769px)");
    const onChange = (e) => e.matches && setMenuOpen(false);

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    mql.addEventListener("change", onChange);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      mql.removeEventListener("change", onChange);
    };
  }, [menuOpen]);

  // Smooth scroll to top when clicking overview anchor or logo
  const goTo = (e, id) => {
    setMenuOpen(false);
    if (id === "overview") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Scrollspy to highlight active section and trigger scroll animations
  useEffect(() => {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        });
      },
      { root: null, rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );
    document
      .querySelectorAll("section[id]")
      .forEach((s) => sectionObserver.observe(s));

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        });
      },
      { threshold: 0.15 },
    );
    document
      .querySelectorAll(".info-card, .service-card, .section-header")
      .forEach((el) => {
        el.classList.add("reveal-on-scroll");
        revealObserver.observe(el);
      });

    return () => {
      sectionObserver.disconnect();
      revealObserver.disconnect();
    };
  }, []);

  return (
    <div className="landing-page">
      {/* STICKY HEADER / NAVIGATION */}
      <header className="navbar">
        <div className="container nav-container">
          <a
            href="#overview"
            className="logo"
            onClick={(e) => goTo(e, "overview")}
          >
            <img
              src="/img/buksupply-brown.png"
              alt="BukSUPPLY"
              className="logo-img"
            />
          </a>

          <nav
            className={`nav-menu${menuOpen ? " active" : ""}`}
            id="navMenu"
            ref={navRef}
            aria-label="Main navigation"
          >
            <span className="nav-menu-title">Navigation</span>
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className={`nav-link${activeId === n.id ? " active" : ""}`}
                aria-current={activeId === n.id ? "true" : undefined}
                onClick={(e) => goTo(e, n.id)}
              >
                {n.label}
              </a>
            ))}
          </nav>

          <div className="nav-actions">
            <Link to="/signin" className="btn-nav">
              Sign In <i className="bi bi-arrow-right"></i>
            </Link>
            <button
              ref={toggleRef}
              type="button"
              className="mobile-toggle"
              id="mobileToggle"
              aria-label="Toggle Navigation"
              aria-expanded={menuOpen}
              aria-controls="navMenu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <i className={`bi ${menuOpen ? "bi-x-lg" : "bi-list"}`}></i>
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* HERO SECTION */}
        <section className="hero-section" id="overview">
          <div className="hero-bg-circles" aria-hidden="true">
            <div className="circle circle-1"></div>
            <div className="circle circle-2"></div>
            <div className="circle circle-3"></div>
            <div className="circle circle-4"></div>
            <div className="circle circle-5"></div>
            <div className="circle circle-6"></div>
          </div>

          <div className="container hero-container">
            <h1 className="hero-title">
              The smarter way to <br className="br-desktop" />
              <span className="text-accent">requisition &amp; track </span>
              university{" "}
              <br className="br-desktop" />
              supplies
            </h1>
            <p className="hero-subtitle">
              Streamlined inventory claiming, equipment reservations, and
              automated COA compliance for BukSU faculty, personnel, and
              students.
            </p>
            <div className="hero-buttons">
              <Link to="/signin" className="btn btn-dark">
                Get Started
              </Link>
              <a href="#about" className="btn btn-light">
                About Us
              </a>
            </div>
          </div>
        </section>

        {/* WHAT IS BUKSUPPLY */}
        <section className="about-section" id="about">
          <div className="container">
            <div className="info-card">
              <h2 className="card-title">What is BukSUPPLY?</h2>
              <p className="card-text">
                <strong>BukSUPPLY</strong> was made specifically for the
                Property and Supply Management Office (PSMO) of{" "}
                <strong>Bukidnon State University</strong> to eliminate tedious,
                paper-based requisition forms, unorganized inventory tracking,
                and long physical queues at the Main Campus Bodega.
              </p>
              <p className="card-text">
                By providing an intuitive digital portal, this system connects
                university faculty, administrative employees, custodians, and
                recognized student leaders with the university&apos;s central
                supply repository in real time.
              </p>
            </div>
          </div>
        </section>

        {/* SERVICES */}
        <section className="services-section" id="services">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">What You Can Do with BukSUPPLY?</h2>
              <p className="section-subtitle">
                Three simple services to help BukSU students, faculty, and staff
                request supplies, borrow equipment, and keep track of items
              </p>
            </div>

            <div className="services-grid">
              {SERVICES.map((s) => (
                <div className="service-card" key={s.title}>
                  <div className="icon-circle">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      {s.icon}
                    </svg>
                  </div>
                  <h3 className="service-title">{s.title}</h3>
                  <p className="service-category">{s.category}</p>
                  <hr className="card-divider" />
                  <p className="service-description">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container footer-container">
          <div className="footer-logo">
            <img
              src="/img/buksupply-white.png"
              alt="BukSUPPLY"
              className="footer-logo-img"
            />
          </div>
          <p className="copyright">© 2026 BukSUPPLY. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}