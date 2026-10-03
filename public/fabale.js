/* ==========================================================================
   Fabale Interactive Controller - AnonChat Edition
   Handles Tab Switching, FAQ Accordions, Pricing Toggle, Stat Counters,
   Smooth Scrolling, and Seamless Chat Matchmaking Activation
   ========================================================================== */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    initFabaleInteractions();
  });

  function initFabaleInteractions() {
    initHeroVideoSpeed();
    initLenis();
    initRevealAnimations();
    initTabShowcase();
    initPricingSwitcher();
    initFaqAccordions();
    initStatCounters();
    initCtaTriggers();
    initSmoothAnchors();
  }

  // Manage hero video: normal speed + auto-pause offscreen for mobile performance
  function initHeroVideoSpeed() {
    const video = document.getElementById('heroVideo') || document.querySelector('.editorial-hero-video');
    if (video) {
      video.playbackRate = 1.0;
      video.addEventListener('play', () => { video.playbackRate = 1.0; });
      video.addEventListener('loadedmetadata', () => { video.playbackRate = 1.0; });
      if ('IntersectionObserver' in window) {
        const obs = new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) video.play().catch(() => {});
            else video.pause();
          });
        }, { threshold: 0.05 });
        obs.observe(video);
      }
    }
  }

  // 0. Lenis Smooth Scroll (Desktop only - Mobile uses native 120Hz momentum scroll)
  function initLenis() {
    if ('ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || window.innerWidth < 800) {
      return;
    }
    if (typeof Lenis !== 'undefined') {
      try {
        const lenis = new Lenis({
          duration: 1.2,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          orientation: 'vertical',
          gestureOrientation: 'vertical',
          smoothWheel: true,
          wheelMultiplier: 1.0,
          touchMultiplier: 1.2
        });

        // Sync with GSAP's ticker if loaded
        if (typeof gsap !== 'undefined') {
          if (typeof ScrollTrigger !== 'undefined') {
            lenis.on('scroll', ScrollTrigger.update);
          }
          gsap.ticker.add((time) => {
            lenis.raf(time * 1000);
          });
          gsap.ticker.lagSmoothing(0);
        } else {
          function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
          }
          requestAnimationFrame(raf);
        }

        window._lenis = lenis;

        // Auto pause on non-landing screens (searching / chat) to preserve native chat performance
        const screenObserver = new MutationObserver(() => {
          if (document.body.classList.contains('on-landing')) {
            lenis.start();
            lenis.resize();
          } else {
            lenis.stop();
          }
        });
        screenObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

      } catch (e) {
        console.warn('Lenis scroll init:', e);
      }
    }
  }

  // 1. Reveal Animations (Framer-like Fade Up)
  function initRevealAnimations() {
    const reveals = document.querySelectorAll('.fab-reveal');
    if (!reveals.length) return;

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('revealed');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
      );

      reveals.forEach((el) => observer.observe(el));
    } else {
      reveals.forEach((el) => el.classList.add('revealed'));
    }
  }

  // 2. Interactive Use Cases Tabs with ARIA and Arrow Navigation
  function initTabShowcase() {
    const tabBtns = Array.from(document.querySelectorAll('.fab-tab-btn'));
    const tabPanels = document.querySelectorAll('.fab-tab-panel');

    if (!tabBtns.length || !tabPanels.length) return;

    function activateTab(btn) {
      const targetTab = btn.getAttribute('data-tab');

      tabBtns.forEach((b) => {
        const isSelected = b === btn;
        b.classList.toggle('active', isSelected);
        b.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        b.setAttribute('tabindex', isSelected ? '0' : '-1');
      });

      tabPanels.forEach((panel) => {
        const isMatch = panel.getAttribute('id') === `tab-panel-${targetTab}`;
        panel.classList.toggle('active', isMatch);
        panel.setAttribute('aria-hidden', isMatch ? 'false' : 'true');
      });
    }

    tabBtns.forEach((btn, index) => {
      btn.addEventListener('click', () => activateTab(btn));

      btn.addEventListener('keydown', (e) => {
        let newIndex = null;
        if (e.key === 'ArrowRight') {
          newIndex = (index + 1) % tabBtns.length;
        } else if (e.key === 'ArrowLeft') {
          newIndex = (index - 1 + tabBtns.length) % tabBtns.length;
        } else if (e.key === 'Home') {
          newIndex = 0;
        } else if (e.key === 'End') {
          newIndex = tabBtns.length - 1;
        }

        if (newIndex !== null) {
          e.preventDefault();
          tabBtns[newIndex].focus();
          activateTab(tabBtns[newIndex]);
        }
      });
    });
  }

  // 3. Pricing Switcher (Monthly / Yearly)
  function initPricingSwitcher() {
    const switchBtns = document.querySelectorAll('.fab-switch-btn');
    const priceAmounts = document.querySelectorAll('.fab-tier-amount');
    const pricePeriods = document.querySelectorAll('.fab-tier-period');

    if (!switchBtns.length) return;

    switchBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        switchBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const mode = btn.getAttribute('data-mode'); // 'monthly' or 'yearly'
        priceAmounts.forEach((amt) => {
          if (mode === 'yearly') {
            amt.textContent = '$0';
          } else {
            amt.textContent = '$0';
          }
        });

        pricePeriods.forEach((p) => {
          p.textContent = mode === 'yearly' ? '/year (free forever)' : '/month (free forever)';
        });
      });
    });
  }

  // 4. FAQ Accordions (Expand / Collapse with Keyboard Activation & ARIA)
  function initFaqAccordions() {
    const accordions = document.querySelectorAll('.fab-accordion');
    if (!accordions.length) return;

    function toggleAccordion(acc, header) {
      const isOpen = acc.classList.contains('open');

      accordions.forEach((other) => {
        if (other !== acc) {
          other.classList.remove('open');
          const otherHeader = other.querySelector('.fab-accordion-header');
          if (otherHeader) otherHeader.setAttribute('aria-expanded', 'false');
        }
      });

      if (isOpen) {
        acc.classList.remove('open');
        if (header) header.setAttribute('aria-expanded', 'false');
      } else {
        acc.classList.add('open');
        if (header) header.setAttribute('aria-expanded', 'true');
      }
    }

    accordions.forEach((acc) => {
      const header = acc.querySelector('.fab-accordion-header');
      if (!header) return;

      header.addEventListener('click', () => toggleAccordion(acc, header));

      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleAccordion(acc, header);
        }
      });
    });
  }

  // 5. Animated Stat Counters
  function initStatCounters() {
    const counters = document.querySelectorAll('.fab-counter');
    if (!counters.length) return;

    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateNumber(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );

    counters.forEach((el) => observer.observe(el));

    function animateNumber(el) {
      const target = parseFloat(el.getAttribute('data-target') || '0');
      const prefix = el.getAttribute('data-prefix') || '';
      const suffix = el.getAttribute('data-suffix') || '';
      const duration = 1400; // ms
      const startTime = performance.now();

      function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out expo
        const ease = 1 - Math.pow(2, -10 * progress);
        const currentVal = Math.round(target * ease * 10) / 10;

        el.textContent = `${prefix}${currentVal}${suffix}`;

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          el.textContent = `${prefix}${target}${suffix}`;
        }
      }

      requestAnimationFrame(update);
    }
  }

  // 6. Connect All CTA buttons to AnonChat Matchmaking!
  function initCtaTriggers() {
    const ctaTriggers = document.querySelectorAll('.trigger-start-chat');
    const startChatBtn = document.getElementById('startChatBtn');

    ctaTriggers.forEach((btn) => {
      // Never attach to startChatBtn to prevent infinite click loop
      if (btn === startChatBtn || btn.id === 'startChatBtn') return;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof window.startSearch === 'function') {
          window.startSearch();
        } else if (startChatBtn) {
          startChatBtn.click();
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
  }

  // 7. Smooth Anchor Scrolling with Lenis
  function initSmoothAnchors() {
    const links = document.querySelectorAll('a[href^="#"]');
    links.forEach((link) => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href');
        if (targetId && targetId !== '#') {
          const targetEl = document.querySelector(targetId);
          if (targetEl) {
            e.preventDefault();
            if (window._lenis) {
              window._lenis.scrollTo(targetEl, { offset: -60, duration: 1.2 });
            } else {
              targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        }
      });
    });
  }
})();

