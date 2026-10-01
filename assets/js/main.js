(() => {
  const header = document.querySelector('[data-header]');
  const progress = document.querySelector('.scroll-progress span');
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.site-nav');
  const navBackdrop = document.querySelector('[data-nav-backdrop]');
  const revealItems = document.querySelectorAll('.reveal');
  const cards = document.querySelectorAll('[data-project]');
  const demoForm = document.querySelector('[data-demo-form]');
  const aboutParallaxItems = document.querySelectorAll('[data-about-parallax]');
  const heroSlider = document.querySelector('[data-hero-slider]');
  const heroSlides = [...document.querySelectorAll('[data-hero-slide]')];
  const heroTabs = [...document.querySelectorAll('[data-hero-tab]')];
  const heroCurrent = document.querySelector('[data-hero-current]');
  const evolutionSplit = document.querySelector('[data-evolution-split]');
  const chapterPanels = [...document.querySelectorAll('[data-chapter-panel]')];
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  requestAnimationFrame(() => {
    document.body.classList.add('is-ready');
  });

  /* Timed hero slideshow: calm cross-fade + slow image drift. */
  if (heroSlider && heroSlides.length) {
    const duration = 6000;
    let activeHero = 0;
    let heroTimer = null;

    const activateHero = (index, restart = true) => {
      activeHero = (index + heroSlides.length) % heroSlides.length;
      heroSlides.forEach((slide, slideIndex) => {
        slide.classList.toggle('is-active', slideIndex === activeHero);
      });
      heroTabs.forEach((tab, tabIndex) => {
        const selected = tabIndex === activeHero;
        tab.classList.toggle('is-active', selected);
        tab.setAttribute('aria-selected', String(selected));
        if (selected) {
          const bar = tab.querySelector('span');
          if (bar) {
            bar.style.animation = 'none';
            void bar.offsetWidth;
            bar.style.animation = '';
          }
        }
      });
      if (heroCurrent) heroCurrent.textContent = String(activeHero + 1).padStart(2, '0');

      if (restart && !prefersReducedMotion) {
        window.clearInterval(heroTimer);
        heroTimer = window.setInterval(() => activateHero(activeHero + 1, false), duration);
      }
    };

    heroTabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activateHero(index, true));
    });

    activateHero(0, true);

    document.addEventListener('visibilitychange', () => {
      if (prefersReducedMotion) return;
      window.clearInterval(heroTimer);
      if (!document.hidden) {
        heroTimer = window.setInterval(() => activateHero(activeHero + 1, false), duration);
      }
    });
  }

  /* Split studio story — V25 stable local interaction.
     The hover state is driven only by real pointer movement inside this section. Scrolling with
     a stationary pointer does not reset/re-trigger the panels, so the rest of the page never
     flickers. The section height is measured once in the 50/50 state and held stable while the
     two panels resize; the white cards and their copy are then free to reflow naturally inside
     the changing panel width without changing the document height. */
  if (evolutionSplit && chapterPanels.length === 2) {
    const desktopQuery = window.matchMedia('(min-width: 861px)');
    const canSplit = () => desktopQuery.matches;
    const SWITCH_DEADBAND = 34;
    let activePanel = null;
    let pointerRaf = 0;
    let resizeRaf = 0;
    let latestPointer = { x: -1, y: -1 };

    const clearPanelState = () => {
      activePanel = null;
      evolutionSplit.classList.remove('has-focus');
      chapterPanels.forEach((panel) => {
        panel.classList.remove('is-expanded', 'is-collapsed');
      });
    };

    const setChapterFocus = (nextPanel = null) => {
      if (!canSplit()) nextPanel = null;
      if (nextPanel === activePanel) return;

      activePanel = nextPanel;
      evolutionSplit.classList.toggle('has-focus', Boolean(activePanel));

      chapterPanels.forEach((panel) => {
        const isActive = Boolean(activePanel && panel === activePanel);
        panel.classList.toggle('is-expanded', isActive);
        panel.classList.toggle('is-collapsed', Boolean(activePanel && panel !== activePanel));
      });
    };

    const measureStableHeight = () => {
      if (!canSplit()) {
        evolutionSplit.style.removeProperty('--evolution-stable-height');
        clearPanelState();
        return;
      }

      /* Measure only in the neutral 50/50 state. This is done on load/resize, never during hover. */
      const previousActive = activePanel;
      clearPanelState();
      evolutionSplit.style.removeProperty('--evolution-stable-height');

      requestAnimationFrame(() => {
        const naturalHeight = Math.ceil(Math.max(
          650,
          ...chapterPanels.map((panel) => panel.scrollHeight)
        ));
        evolutionSplit.style.setProperty('--evolution-stable-height', `${naturalHeight}px`);

        /* Do not restore an old hover state after a viewport resize. A fresh pointer movement
           chooses the correct side, avoiding a jump when responsive geometry changes. */
        if (previousActive && latestPointer.x >= 0) {
          // Intentionally leave the neutral state until the next genuine pointer movement.
        }
      });
    };

    const panelForPointer = (clientX) => {
      const rect = evolutionSplit.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;

      if (!activePanel) {
        return clientX < midpoint ? chapterPanels[0] : chapterPanels[1];
      }

      /* Small hysteresis keeps the animated divider from switching under a nearly stationary mouse. */
      if (activePanel === chapterPanels[0]) {
        return clientX > midpoint + SWITCH_DEADBAND ? chapterPanels[1] : chapterPanels[0];
      }
      return clientX < midpoint - SWITCH_DEADBAND ? chapterPanels[0] : chapterPanels[1];
    };

    const pointerIsInside = (x, y) => {
      const rect = evolutionSplit.getBoundingClientRect();
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    };

    const processPointer = () => {
      pointerRaf = 0;
      if (!canSplit()) {
        setChapterFocus();
        return;
      }

      const { x, y } = latestPointer;
      if (!pointerIsInside(x, y)) {
        setChapterFocus();
        return;
      }
      setChapterFocus(panelForPointer(x));
    };

    const onPointerMove = (event) => {
      if ('pointerType' in event && event.pointerType === 'touch') return;
      latestPointer = { x: event.clientX, y: event.clientY };
      if (!pointerRaf) pointerRaf = requestAnimationFrame(processPointer);
    };

    /* Listen for genuine pointer movement, not element mouseleave. During wheel/trackpad scrolling
       the pointer is stationary, so the active chapter stays visually stable instead of toggling. */
    const moveEvent = 'PointerEvent' in window ? 'pointermove' : 'mousemove';
    document.addEventListener(moveEvent, onPointerMove, { passive: true });

    chapterPanels.forEach((panel) => {
      panel.addEventListener('focus', () => setChapterFocus(panel));
      panel.addEventListener('blur', () => {
        window.setTimeout(() => {
          if (!evolutionSplit.contains(document.activeElement)) setChapterFocus();
        }, 0);
      });
    });

    const scheduleMeasure = () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        measureStableHeight();
      });
    };

    window.addEventListener('load', scheduleMeasure, { once: true });
    window.addEventListener('resize', scheduleMeasure);
    desktopQuery.addEventListener?.('change', scheduleMeasure);
    scheduleMeasure();
  }

  const onScroll = () => {
    const y = window.scrollY || document.documentElement.scrollTop;
    header?.classList.toggle('is-scrolled', y > 20);

    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - doc.clientHeight);
    progress?.style.setProperty('transform', `scaleX(${Math.min(1, y / max)})`);
  };

  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  window.addEventListener('resize', () => {
    if (window.innerWidth > 860 && menuButton?.getAttribute('aria-expanded') === 'true') {
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Open menu');
      nav?.classList.remove('is-open');
      navBackdrop?.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  });


  if (!prefersReducedMotion && aboutParallaxItems.length) {
    let parallaxTicking = false;

    const updateAboutParallax = () => {
      const viewportCenter = window.innerHeight * 0.5;
      aboutParallaxItems.forEach((item) => {
        const rect = item.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;
        const depth = Number(item.dataset.depth || 0.4);
        const elementCenter = rect.top + rect.height * 0.5;
        const distance = (elementCenter - viewportCenter) / Math.max(window.innerHeight, 1);
        const shift = Math.max(-18, Math.min(18, -distance * 34 * depth));
        item.style.setProperty('--about-shift', `${shift.toFixed(2)}px`);
      });
      parallaxTicking = false;
    };

    const requestAboutParallax = () => {
      if (parallaxTicking) return;
      parallaxTicking = true;
      requestAnimationFrame(updateAboutParallax);
    };

    requestAboutParallax();
    window.addEventListener('scroll', requestAboutParallax, { passive: true });
    window.addEventListener('resize', requestAboutParallax);
  }

  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.11, rootMargin: '0px 0px -5% 0px' });

    revealItems.forEach((item, index) => {
      item.style.transitionDelay = `${Math.min(index % 3, 2) * 85}ms`;
      observer.observe(item);
    });
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  const setMenuState = (open) => {
    menuButton?.setAttribute('aria-expanded', String(open));
    menuButton?.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav?.classList.toggle('is-open', open);
    navBackdrop?.classList.toggle('is-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  };

  menuButton?.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    setMenuState(!open);
  });

  navBackdrop?.addEventListener('click', () => setMenuState(false));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenuState(false);
  });

  nav?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setMenuState(false));
  });

  if (isTouch) {
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const willOpen = !card.classList.contains('is-active');
        cards.forEach((other) => other.classList.remove('is-active'));
        if (willOpen) card.classList.add('is-active');
      });
    });
  } else {
    cards.forEach((card) => {
      card.addEventListener('mousemove', (event) => {
        const rect = card.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty('--mx', `${x}%`);
        card.style.setProperty('--my', `${y}%`);
      });
      card.addEventListener('mouseleave', () => {
        card.style.setProperty('--mx', '50%');
        card.style.setProperty('--my', '50%');
      });
    });
  }

  demoForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const note = demoForm.parentElement.querySelector('.form-note');
    if (note) {
      note.textContent = 'Thank you — the newsletter connection will be enabled in the live CMS version.';
    }
    demoForm.reset();
  });
})();
