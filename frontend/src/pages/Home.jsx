import { useState, useEffect } from 'react';
import '../assets/css/index.css';

// Import image assets 
import logoBrown from '../assets/img/buksupply-brown.png';
import logoWhite from '../assets/img/buksupply-white.png';

export default function Home() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // ScrollSpy Intersection Observer
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id]');

    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0,
    };

    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const activeId = entry.target.getAttribute('id');
          navLinks.forEach((link) => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${activeId}`) {
              link.classList.add('active');
            }
          });
        }
      });
    }, observerOptions);

    sections.forEach((section) => navObserver.observe(section));

    // Scroll Reveal Observer
    const revealElements = document.querySelectorAll(
      '.info-card, .service-card, .section-header'
    );

    const scrollObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.15 }
    );

    revealElements.forEach((el) => {
      el.classList.add('reveal-on-scroll');
      scrollObserver.observe(el);
    });

    // Cleanup observers on unmount
    return () => {
      navObserver.disconnect();
      scrollObserver.disconnect();
    };
  }, []);

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* STICKY HEADER / NAVIGATION */}
      <header className="navbar">
        <div className="container nav-container">
          <a href="#overview" className="logo">
            <img src={logoBrown} alt="BukSUPPLY" className="logo-img" />
          </a>

          {/* Navigation Links */}
          <nav
            className={`nav-menu ${isMobileMenuOpen ? 'active' : ''}`}
            id="navMenu"
          >
            <a href="#overview" className="nav-link active" onClick={closeMobileMenu}>
              Overview
            </a>
            <a href="#about" className="nav-link" onClick={closeMobileMenu}>
              About Us
            </a>
            <a href="#services" className="nav-link" onClick={closeMobileMenu}>
              Services
            </a>
          </nav>

          {/* Navigation Actions */}
          <div className="nav-actions">
            <a href="/signin" className="btn-nav">
              Sign In <i className="bi bi-arrow-right"></i>
            </a>
            <button
              className="mobile-toggle"
              id="mobileToggle"
              aria-label="Toggle Navigation"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            >
              ☰
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
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
              The smarter way to <br />
              <span className="text-accent">requisition & track</span> university
              <br />
              supplies
            </h1>
            <p className="hero-subtitle">
              Streamlined inventory claiming, equipment reservations, and
              automated COA compliance for BukSU faculty, personnel, and students.
            </p>
            <div className="hero-buttons">
              <a href="/signin" className="btn btn-dark">
                Get Started
              </a>
              <a href="#about" className="btn btn-light">
                About Us
              </a>
            </div>
          </div>
        </section>

        {/* WHAT IS BUKSUPPLY CARD SECTION */}
        <section className="about-section" id="about">
          <div className="container">
            <div className="info-card">
              <h2 className="card-title">What is BukSUPPLY?</h2>
              <p className="card-text">
                <strong>BukSUPPLY</strong> was made specifically for the Property
                and Supply Management Office (PSMO) of{' '}
                <strong>Bukidnon State University</strong> to eliminate tedious,
                paper-based requisition forms, unorganized inventory tracking, and
                long physical queues at the Main Campus Bodega.
              </p>
              <p className="card-text">
                By providing an intuitive digital portal, this system connects
                university faculty, administrative employees, custodians, and
                recognized student leaders with the university's central supply
                repository in real time.
              </p>
            </div>
          </div>
        </section>

        {/* SERVICES CARD */}
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
              {/* Card 1: Request Supplies */}
              <div className="service-card">
                <div className="icon-circle">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                </div>
                <h3 className="service-title">Request Supplies</h3>
                <p className="service-category">
                  Bond paper, pens, markers, and office supplies
                </p>

                <hr className="card-divider" />

                <p className="service-description">
                  Look up available supplies online and submit a request in
                  seconds. Once approved, you can pick up your items at the supply
                  window using your digital claim slip.
                </p>
              </div>

              {/* Card 2: Borrow Equipment */}
              <div className="service-card">
                <div className="icon-circle">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="17"></line>
                  </svg>
                </div>
                <h3 className="service-title">Borrow Equipment</h3>
                <p className="service-category">
                  Projectors, laptops, cables, and other school equipment
                </p>

                <hr className="card-divider" />

                <p className="service-description">
                  Reserve projectors, laptops, and other school equipment ahead of
                  time for your classes, thesis defense, or university events.
                  Return items on schedule with ease.
                </p>
              </div>

              {/* Card 3: Track & Manage Records */}
              <div className="service-card">
                <div className="icon-circle">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                </div>
                <h3 className="service-title">Track & Manage Records</h3>
                <p className="service-category">
                  History, inventory tracking, and clearance status
                </p>

                <hr className="card-divider" />

                <p className="service-description">
                  Keep a clear record of all your requests and borrowed items.
                  Staff can manage live inventory, while students and faculty
                  ensure their semester clearance stays clear.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container footer-container">
          <div className="footer-logo">
            <img src={logoWhite} alt="BukSUPPLY" className="footer-logo-img" />
          </div>
          <p className="copyright">© 2026 BukSUPPLY. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}