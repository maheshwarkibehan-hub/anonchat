/* ==========================================================================
   Fabale Interactive Controller - AnonChat Edition (Oct 2026)
   Immersive Scroll Experience: GSAP ScrollTrigger + Lenis Smooth Scroll
   Parallax Storytelling, Pinned Narrative Beats, Multi-Plane Card Depth,
   Micro-interactions, and Seamless Chat Matchmaking Activation
   ========================================================================== */

(function () {
  'use strict';

  // Shared state for the pinned scroll story, so the beat rail, the manual swap
  // control and the timeline itself all read the same numbers.
  const storyState = { trigger: null, beat: 1, total: 1 };

  document.addEventListener('DOMContentLoaded', () => {
    initFabaleInteractions();
  });

  function initFabaleInteractions() {
    initHeroVideoSpeed();
    initCtaTriggers();
    initScreenLifecycle();
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
        }, { threshold: 0.02, rootMargin: '50px 0px 50px 0px' });
        obs.observe(video);
      }
      // On mobile / low power devices, pause video immediately when scrolling down past hero to save massive GPU cycles
      const checkVideoScroll = () => {
        const y = window.pageYOffset || document.documentElement.scrollTop || window.scrollY || 0;
        if (y > window.innerHeight * 0.85) {
          if (!video.paused) video.pause();
        }
      };
      window.addEventListener('scroll', checkVideoScroll, { passive: true });
    }
  }

  // 0. Lenis Smooth Scroll + GSAP ScrollTrigger Sync
  function initLenisAndScrollTrigger() {
    // Register GSAP ScrollTrigger if available
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      try {
        gsap.registerPlugin(ScrollTrigger);
      } catch (e) {
        console.warn('ScrollTrigger register:', e);
      }
    }

    if (typeof Lenis !== 'undefined') {
      try {
        // Disable touch hijacking on mobile so devices get buttery 120Hz native momentum scrolling
        const lenis = new Lenis({
          duration: 1.1,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          orientation: 'vertical',
          gestureOrientation: 'vertical',
          smoothWheel: true,
          wheelMultiplier: 1.1,
          touchMultiplier: 0, // Disabled touch hijacking: pure native mobile hardware scroll
          smoothTouch: false, // Prevents Lenis from fighting mobile compositor thread
          infinite: false
        });

        // Sync with GSAP ScrollTrigger
        if (typeof ScrollTrigger !== 'undefined') {
          lenis.on('scroll', ScrollTrigger.update);
        }

        // Real-time synchronous update for navbar floating pill on PC
        lenis.on('scroll', (e) => {
          if (typeof window._onLenisScroll === 'function') {
            window._onLenisScroll(e.scroll);
          }
        });

        if (typeof gsap !== 'undefined') {
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
            if (typeof ScrollTrigger !== 'undefined') {
              ScrollTrigger.refresh();
            }
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

  // 1. Reading & Narrative Progress Bar
  function initScrollProgress() {
    const fill = document.getElementById('scrollProgressFill');
    if (!fill) return;

    function updateProgress() {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const progress = Math.min(1, Math.max(0, window.scrollY / docHeight));
      fill.style.width = (progress * 100).toFixed(2) + '%';
    }

    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }

  // 2. Floating Frosted Glass Navbar on Scroll
  function initNavbarScroll() {
    const navbar = document.querySelector('.editorial-navbar');
    if (!navbar) return;

    function checkNav(currentScrollY) {
      let y = 0;
      if (typeof currentScrollY === 'number') {
        y = currentScrollY;
      } else if (window._lenis && typeof window._lenis.scroll === 'number') {
        y = window._lenis.scroll;
      } else {
        y = window.pageYOffset || document.documentElement.scrollTop || window.scrollY || 0;
      }
      const scrolled = y > 24;
      navbar.classList.toggle('navbar-scrolled', scrolled);
    }

    window._onLenisScroll = (scroll) => checkNav(scroll);
    window.addEventListener('scroll', () => checkNav(), { passive: true });
    if (window._lenis) {
      window._lenis.on('scroll', (e) => checkNav(e.scroll));
    }
    checkNav();
  }

  // 3. Cinematic Hero Parallax Scrub (Apple Product Page Style)
  function initHeroParallax() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const heroWrapper = document.querySelector('.editorial-hero-wrapper');
    const heroContent = document.querySelector('.editorial-hero-content');
    const heroVideo = document.querySelector('.editorial-hero-video');
    const heroBottom = document.querySelector('.editorial-hero-bottom');

    if (!heroWrapper || !heroContent) return;

    // Content drifts up and blurs out smoothly
    gsap.to(heroContent, {
      scrollTrigger: {
        trigger: heroWrapper,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
      y: -75,
      opacity: 0.15,
      scale: 0.95,
      ease: 'none',
    });

    // Background video subtle parallax depth (desktop only to prevent mobile scroll re-composite stutter)
    if (heroVideo && window.innerWidth > 768) {
      gsap.to(heroVideo, {
        scrollTrigger: {
          trigger: heroWrapper,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
        yPercent: 18,
        ease: 'none',
      });
    }

    // Scroll indicator arrow fades out quickly on scroll
    if (heroBottom) {
      gsap.to(heroBottom, {
        scrollTrigger: {
          trigger: heroWrapper,
          start: 'top top',
          end: '20% top',
          scrub: true,
        },
        opacity: 0,
        y: 24,
        ease: 'none',
      });
    }
  }

  // 4. Scrubbed Tech Ticker Velocity Link
  function initTickerScrub() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const tickerSection = document.querySelector('.fab-ticker-section');
    const tickerTrack = document.querySelector('.fab-ticker-track');
    if (!tickerSection || !tickerTrack) return;

    gsap.to(tickerTrack, {
      scrollTrigger: {
        trigger: tickerSection,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1.2,
      },
      xPercent: -6,
      ease: 'none',
    });
  }

  // 5. 3D Stacking & Swapping Cards Showcase + Continuous Horizontal Text Journey
  //
  // ONE master scrubbed ScrollTrigger timeline drives three things together:
  //   a) the 3D card deck peeling forward,
  //   b) the SVG journey line drawing itself,
  //   c) the long editorial sentence travelling horizontally.
  // Because they share a single progress value they can never drift apart, and
  // scrolling back up simply reverses all three together.
  function initParallaxStory() {
    const storySection = document.getElementById('story');
    if (!storySection) return;

    const stage = document.getElementById('storyStage');

    const cardElements = [
      document.getElementById('swapCard0'),
      document.getElementById('swapCard1'),
      document.getElementById('swapCard2'),
      document.getElementById('swapCard3')
    ].filter(Boolean);

    const cards = cardElements.length ? cardElements : Array.from(document.querySelectorAll('.swap-card, .story-card'));
    const stepItems = Array.from(document.querySelectorAll('.story-step-item'));
    const trackFill = document.getElementById('storyTrackFill');
    const journeySvgPath = document.getElementById('journeySvgPath');
    const ribbonTrack = document.getElementById('journeyRibbonTrack');
    const manualSwapBtn = document.getElementById('manualSwapBtn');

    const dynamicTitleEl = document.getElementById('storyDynamicTitle');
    const dynamicDescEl = document.getElementById('storyDynamicDesc');
    const dynamicBadgeText = document.getElementById('storyBadgeText');

    const STORY_BEATS = [
      {
        badge: '01 &bull; Late Night Confessions',
        title: 'Late Night <span class="serif-italic">Confessions</span>',
        desc: 'Scroll to peel through real campus conversations. Swipe-to-reply, emoji reactions, and contextual quotes without leaving a digital trace.'
      },
      {
        badge: '02 &bull; 15s Ephemeral Voice Notes',
        title: '15s Ephemeral <span class="serif-italic">Voice Notes</span>',
        desc: 'Real-time Web Audio waveforms with 15-second expiring voice clips and single-tap view-once media that melt the moment you listen.'
      },
      {
        badge: '03 &bull; 5s Self-Destruct Smoke Bombs',
        title: '5s Self-Destruct <span class="serif-italic">Smoke Bombs</span>',
        desc: 'Sensitive messages and private links vaporize with dynamic smoke particles in 5 seconds. Zero screenshots, zero server logs.'
      },
      {
        badge: '04 &bull; Sub-10ms Matchmaking & Grace',
        title: 'Sub-10ms Match, <span class="serif-italic">3s Skip Grace</span>',
        desc: 'Instant in-memory RAM matchmaking with zero disk footprint, plus a 3-second reconnect grace buffer if you accidentally hit skip.'
      }
    ];

    const switchItems = Array.from(document.querySelectorAll('.story-switch-item'));

    let currentStickyStep = -1;
    function updateStickyContent(stepIndex, immediate = false) {
      if (stepIndex === currentStickyStep && !immediate) return;
      currentStickyStep = stepIndex;

      const beatData = STORY_BEATS[stepIndex];
      if (!beatData) return;

      // Pure HTML/CSS class toggling with CSS transitions
      if (switchItems.length) {
        switchItems.forEach((item, idx) => {
          item.classList.toggle('active', idx === stepIndex);
        });
      }

      if (dynamicBadgeText) {
        dynamicBadgeText.innerHTML = beatData.badge;
      }

      if (dynamicTitleEl && (!switchItems.length || immediate)) {
        dynamicTitleEl.innerHTML = beatData.title;
        if (dynamicDescEl) dynamicDescEl.innerHTML = beatData.desc;
      }
    }

    const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---- Static, fully readable fallback -------------------------------------
    // When GSAP is genuinely unavailable, keep the luxury stacked deck layout
    // intact with interactive step selection and swap controls instead of a grid.
    if (!hasGsap) {
      storySection.classList.add('story-static');
      if (trackFill) trackFill.style.display = 'none';
      if (journeySvgPath) {
        try {
          journeySvgPath.style.strokeDasharray = 'none';
          journeySvgPath.style.strokeDashoffset = '0';
        } catch (err) {
          console.warn('SVG path measurement:', err);
        }
      }

      let currentStaticStep = 0;
      function setStaticCard(index) {
        currentStaticStep = Math.max(0, Math.min(cards.length - 1, index));
        stepItems.forEach((item, idx) => {
          item.classList.toggle('active', idx === currentStaticStep);
        });
        cards.forEach((card, idx) => {
          card.classList.toggle('active', idx === currentStaticStep);
          const depth = Math.min(3, Math.abs(idx - currentStaticStep));
          card.setAttribute('data-stack-depth', String(depth));
        });
        if (trackFill) {
          trackFill.style.height = `${((currentStaticStep / Math.max(1, cards.length - 1)) * 100).toFixed(1)}%`;
        }
        updateStickyContent(currentStaticStep, true);
      }

      stepItems.forEach((item, index) => {
        item.addEventListener('click', () => setStaticCard(index));
        item.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setStaticCard(index);
          }
        });
      });

      cards.forEach((card, index) => {
        card.addEventListener('click', () => setStaticCard(index));
      });

      if (manualSwapBtn) {
        manualSwapBtn.addEventListener('click', (e) => {
          e.preventDefault();
          setStaticCard((currentStaticStep + 1) % cards.length);
        });
      }

      setStaticCard(0);
      return;
    }

    storySection.classList.add('story-motion');
    updateStickyContent(0, true);

    // The travelling strip is the decorative layer; the real, always-present
    // sentence lives in .journey-sentence-static and stays available to
    // assistive tech, so no essential copy depends on the animation.
    if (ribbonTrack) ribbonTrack.setAttribute('aria-hidden', 'true');

    // Dynamic SVG Journey Connector Line Setup (drawn from scroll progress)
    let pathLength = 0;
    if (journeySvgPath) {
      try {
        pathLength = journeySvgPath.getTotalLength();
        journeySvgPath.style.strokeDasharray = `${pathLength} ${pathLength}`;
        journeySvgPath.style.strokeDashoffset = `${pathLength}`;
      } catch (err) {
        console.warn('SVG path measurement:', err);
      }
    }

    function setStepActive(stepIndex) {
      stepItems.forEach((item, idx) => {
        item.classList.toggle('active', idx === stepIndex);
      });
      cards.forEach((card, idx) => {
        card.classList.toggle('active', idx === stepIndex);

        // Pile depth drives the card's shadow: the top card sits proud of the
        // stack with a deep soft shadow, and every buried level gets a flatter,
        // tighter one. Reading the absolute distance from the active beat means
        // the shadows stay correct in both scroll directions without tracking a
        // separate depth counter, because a card's depth in the pile is exactly
        // how many beats away from the front it currently is.
        const depth = Math.min(3, Math.abs(idx - stepIndex));
        if (card.getAttribute('data-stack-depth') !== String(depth)) {
          card.setAttribute('data-stack-depth', String(depth));
        }
      });

      // Sticky Content Switch: Pin heading and morph copy with scroll progression
      updateStickyContent(stepIndex);
    }

    // Scroll to a specific beat without breaking reverse scrubbing: this moves
    // the scroll position, so the timeline resolves from there in both directions.
    function scrollToBeat(beatIndex) {
      const trigger = window._storyTrigger;
      if (!trigger) {
        const targetCard = cards[beatIndex];
        if (targetCard) targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      const clamped = Math.max(0, Math.min(cards.length - 1, beatIndex));

      // Aim at the CENTRE of the beat, never its leading edge. Scroll offsets
      // snap to whole pixels, so a target sitting exactly on a beat boundary
      // can land a hair to either side of it - and the floor() in onUpdate then
      // highlights the PREVIOUS beat. Half a beat of clearance makes rounding
      // unable to cross the boundary, and lands on a card that has visibly
      // settled instead of one that is merely starting to move.
      const progress = storyState.total > 0
        ? Math.min(1, ((clamped + 0.5) * storyState.beat) / storyState.total)
        : 0;
      const targetY = trigger.start + progress * (trigger.end - trigger.start);
      if (window._lenis) {
        window._lenis.scrollTo(targetY, { duration: 1.1 });
      } else {
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      }
    }

    // Step rail navigation (kept keyboard accessible: role=button + tabindex)
    stepItems.forEach((item, index) => {
      item.addEventListener('click', () => scrollToBeat(index));
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          scrollToBeat(index);
        }
      });
    });

    // Cards stay clickable - no overlay is ever placed above the deck.
    cards.forEach((card, index) => {
      card.addEventListener('click', () => scrollToBeat(index));
    });

    // ---- STACK MODEL (Prismic article #13, "Stacked cards effect") ------------
    //
    // The deck used to FAN every card out to the right and slightly up, each one
    // scaled back and dimmed. That geometry has a fatal flaw for storytelling:
    // no card ever covers another one, so the eye reads four flat screenshots
    // floating side by side rather than one conversation with history. Throwing
    // more 3D at it does not help, because the problem is the layout, not the
    // depth.
    //
    // The stacked-cards mechanic fixes it properly. The deck is a PILE: the
    // active card sits centred and full size, and every card already visited
    // tucks underneath it, offset a little further down on each level and scaled
    // back only slightly, so a clean cascade of edges stays visible below the top
    // card. On every beat the outgoing card drops back into the pile and the
    // stack grows by one layer.
    //
    // Two details make this read as a physical stack rather than a glitch:
    //   - Buried cards must stay fully OPAQUE. They are only ever seen at their
    //     exposed edges; the moment they fade, the pile turns to glass and the
    //     whole illusion collapses.
    //   - The cascade offset has to out-run the scale reduction, or the shrinking
    //     card swallows its own exposed edge. Hence a small scale step (0.985)
    //     against a larger y offset (13px), which leaves ~10px of edge showing on
    //     the first buried level and ~29px by the last.
    const STACK_PRESETS = {
      desktop: { dx: -4, dy: 13, dz: -46, scale: 0.985, rot: -0.7, travel: 2500, scrub: 0.8 },
      tablet:  { dx: -3, dy: 11, dz: -38, scale: 0.985, rot: -0.6, travel: 1400, scrub: 0.5 },
      mobile:  { dx: -2, dy: 9,  dz: -30, scale: 0.985, rot: -0.5, travel: 950, scrub: 0.4 }
    };

    function buildSlots(preset) {
      return cards.map((_, i) => {
        // Top of the pile: centred, full size, the only fully readable card.
        if (i === 0) return { x: 0, y: 0, z: 0, scale: 1, rot: 0, zIndex: 40 };
        return {
          x: preset.dx * i,
          y: preset.dy * i,
          z: preset.dz * i,
          scale: 1 - (1 - preset.scale) * i,
          rot: preset.rot * i,
          zIndex: 40 - i * 10
        };
      });
    }

    // Builds the whole pinned story for one breakpoint. Returns a teardown
    // function so gsap.matchMedia() can fully clean up on a breakpoint change
    // (no orphaned triggers, no duplicated timelines).
    function buildStory(preset) {
      const SLOTS = buildSlots(preset);

      // Resting pile: card 0 on top at full size, the rest tucked beneath it.
      cards.forEach((card, i) => {
        const slot = SLOTS[i] || SLOTS[SLOTS.length - 1];
        gsap.set(card, {
          x: slot.x,
          y: slot.y,
          z: slot.z,
          scale: slot.scale,
          rotateY: slot.rot,
          opacity: 1,
          zIndex: slot.zIndex,
          transformOrigin: 'center center',
          force3D: true
        });
      });

      const BEAT = 1;
      const TAIL = 0.55;
      const TOTAL = Math.max(1, cards.length - 1) * BEAT + TAIL;
      storyState.beat = BEAT;
      storyState.total = TOTAL;

      // THE master timeline: one scrubbed progress value for the deck, the SVG
      // journey line and the horizontal sentence.
      const storyTl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: {
          trigger: storySection,
          pin: stage || storySection,
          start: 'top top',
          // Scaled to the viewport: enough distance for every beat to breathe,
          // but capped so the pinned section never becomes a scrolling chore.
          end: () => '+=' + Math.round(Math.min(preset.travel, Math.max(1600, window.innerHeight * 2.6))),
          scrub: preset.scrub,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const progress = self.progress; // 0.0 to 1.0

            // The journey line draws itself forward with the scroll.
            if (journeySvgPath && pathLength > 0) {
              journeySvgPath.style.strokeDashoffset = String(Math.max(0, pathLength * (1 - progress)));
            }
            if (trackFill) {
              trackFill.style.height = `${(progress * 100).toFixed(1)}%`;
            }

            // Beat indicator follows the timeline's own beat grid. The 0.05
            // tolerance absorbs the sub-pixel remainder of a scrubbed scroll,
            // which otherwise settles a hair short and lights the previous step.
            const beat = Math.max(0, Math.min(
              cards.length - 1,
              Math.floor(((progress * TOTAL) / BEAT) + 0.05)
            ));
            setStepActive(beat);
          }
        }
      });

// ---- Card beats -------------------------------------------------------
      // Every beat the pile grows by one layer. The outgoing top card does not
      // fly off to the side any more - it drops straight back into the stack,
      // gaining an edge and a softer shadow on its way down, while the next card
      // is placed on top of it.
      for (let k = 0; k < cards.length - 1; k++) {
        const at = k * BEAT;
        const buriedSlot = SLOTS[Math.min(k + 1, SLOTS.length - 1)] || SLOTS[0];

        // Outgoing: settles into the pile one level deeper. It stays fully opaque
        // because a transparent card in a stack reads as a rendering bug.
        storyTl.to(cards[k], {
          x: buriedSlot.x,
          y: buriedSlot.y,
          z: buriedSlot.z,
          scale: buriedSlot.scale,
          rotateY: buriedSlot.rot,
          opacity: 1,
          zIndex: buriedSlot.zIndex,
          duration: BEAT * 0.72,
          ease: 'power2.inOut'
        }, at);

        // Everything still in the pile shuffles forward exactly one slot, so the
        // cards ahead of the active beat stay stacked underneath it in order.
        for (let j = k + 1; j < cards.length; j++) {
          const slot = SLOTS[j - (k + 1)] || SLOTS[0];

          // The incoming card (the one moving into the top slot) gets a two-part
          // scale keyframe so it visibly settles onto the pile instead of merely
          // swapping coordinates with the card below it. Scale is expressed as
          // keyframes rather than a second tween on purpose: two tweens driving
          // the same properties on one element fight each other, and only the
          // last one to start wins.
          if (j === k + 1) {
            storyTl.to(cards[j], {
              x: slot.x,
              y: slot.y,
              z: slot.z,
              rotateY: slot.rot,
              opacity: 1,
              zIndex: slot.zIndex,
              keyframes: [
                { scale: slot.scale * 1.045, duration: BEAT * 0.2, ease: 'power2.out' },
                { scale: slot.scale, duration: BEAT * 0.8, ease: 'power3.out' }
              ]
            }, at);
          } else {
            storyTl.to(cards[j], {
              x: slot.x,
              y: slot.y,
              z: slot.z,
              scale: slot.scale,
              rotateY: slot.rot,
              opacity: 1,
              zIndex: slot.zIndex,
              duration: BEAT,
              ease: 'power2.inOut'
            }, at);
          }
        }
      }

      // Breathing room so the final card settles before the stage releases.
      storyTl.to({}, { duration: TAIL }, (cards.length - 1) * BEAT);

      // ---- Continuous horizontal text journey --------------------------------
      // Same timeline, same progress: the sentence travels as the deck advances.
      // Function-based values, so invalidateOnRefresh re-measures the real
      // rendered width after a resize or a webfont swap.
      if (ribbonTrack) {
        storyTl.to(ribbonTrack, {
          x: () => -initHorizontalRibbon(ribbonTrack),
          ease: 'none',
          duration: TOTAL
        }, 0);
      }

      window._storyTrigger = storyTl.scrollTrigger;
      storyState.trigger = storyTl.scrollTrigger;

      // Manual "Swap Deck" control: jumps to the next beat by moving the scroll
      // position, so it stays perfectly in step with the scrubbed timeline.
      if (manualSwapBtn && !manualSwapBtn.dataset.beatBound) {
        manualSwapBtn.dataset.beatBound = '1';
        manualSwapBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const current = window._storyTrigger ? (window._storyTrigger.progress || 0) : 0;

          // Floor, matching the beat grid the timeline itself uses in onUpdate.
          //
          // scrollToBeat parks the story on the CENTRE of a beat (k + 0.5), so a
          // resting position is never on a boundary and floor is unambiguous.
          // Rounding here instead would read the centre of beat k as beat k + 1
          // and step the control two beats forward.
          const beatNow = Math.max(0, Math.min(
            cards.length - 1,
            Math.floor((current * storyState.total) / storyState.beat)
          ));
          scrollToBeat(beatNow >= cards.length - 1 ? 0 : beatNow + 1);
        });
      }

      // Teardown for this breakpoint: kills the timeline, its trigger and the pin,
      // and restores the resting deck so nothing is left mid-transform.
      return () => {
        const trigger = storyTl.scrollTrigger;
        if (trigger) trigger.kill(true);
        storyTl.kill();
        if (window._storyTrigger === trigger) window._storyTrigger = null;
        storyState.trigger = null;
        cards.forEach((card) => {
          card.style.transform = '';
          card.style.opacity = '';
          card.style.zIndex = '';
        });
      };
    }

    // Every breakpoint now gets the pinned, scrubbed, 3D story. This used to be
    // desktop-only at >= 992px, which is precisely why the effect disappeared on
    // scaled Windows laptops (125-150% display scaling reports a narrower
    // viewport), on tablets and on phones.
    const activeDesktopPreset = reduceMotion ? { ...STACK_PRESETS.desktop, rot: 0, scrub: 0.4 } : STACK_PRESETS.desktop;
    const activeTabletPreset = reduceMotion ? { ...STACK_PRESETS.tablet, rot: 0, scrub: 0.4 } : STACK_PRESETS.tablet;
    const activeMobilePreset = reduceMotion ? { ...STACK_PRESETS.mobile, rot: 0, scrub: 0.3 } : STACK_PRESETS.mobile;

    const mm = gsap.matchMedia();
    mm.add('(min-width: 992px)', () => buildStory(activeDesktopPreset));
    mm.add('(min-width: 720px) and (max-width: 991px)', () => buildStory(activeTabletPreset));
    mm.add('(max-width: 719px)', () => buildStory(activeMobilePreset));

    // Webfonts change the rendered width of the sentence, so re-measure once they
    // land instead of leaving the ribbon short of its target.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => ScrollTrigger.refresh());
    }

    // The stage is sized in dvh and the pin math is viewport-derived, so give
    // ScrollTrigger a debounced nudge after a resize settles.
    let storyResizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(storyResizeTimer);
      storyResizeTimer = setTimeout(() => ScrollTrigger.refresh(), 180);
    });
  }

  // 5b. Continuous horizontal sentence.
  // The ribbon no longer owns a separate ScrollTrigger - it rides the story's
  // master timeline so the typography, the deck and the journey line can never
  // drift apart. This helper only reports how far the sentence has to travel,
  // and is re-invoked on every refresh so the measurement stays honest.
  function initHorizontalRibbon(track) {
    const ribbonTrack = track || document.getElementById('journeyRibbonTrack');
    if (!ribbonTrack) return 0;
    return Math.max(ribbonTrack.scrollWidth - window.innerWidth + 160, window.innerWidth * 0.7);
  }

  // 5c. Scroll-Drawn Lifecycle Timeline  (Prismic article #50)
  //
  // The "How it works" story used to live only in a modal the navbar no longer
  // exposed. It is now a real section, and the connector rail between the four
  // beats draws itself straight from the section's scroll progress: the line
  // fills as you read, and each node wakes at the moment the line reaches it.
  //
  // One scrubbed trigger drives the whole thing. Progress is written to a proxy
  // object and mirrored into a single transform, so scrubbing forwards and
  // backwards is identical work and nothing is ever left half-lit.
  function initHowTimeline() {
    const section = document.getElementById('how-it-works');
    const svgPath = document.getElementById('howJourneySvgPath');
    const svgGlow = document.getElementById('howJourneySvgGlow');
    const beaconGroup = document.getElementById('howJourneyBeaconGroup');
    const fill = document.getElementById('howTimelineFill');
    if (!section) return;

    const steps = Array.from(section.querySelectorAll('.ed-tl-step'));
    if (!steps.length) return;

    const total = steps.length;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';

    // Measure SVG path length safely (SVG viewBox length is 1000)
    let pathLength = 1000;
    if (svgPath) {
      try {
        const measured = svgPath.getTotalLength();
        if (measured && measured > 0) pathLength = measured;
      } catch (e) {
        pathLength = 1000;
      }
      svgPath.style.strokeDasharray = `${pathLength} ${pathLength}`;
      svgPath.style.strokeDashoffset = `${pathLength}`;
      if (svgGlow) {
        svgGlow.style.strokeDasharray = `${pathLength} ${pathLength}`;
        svgGlow.style.strokeDashoffset = `${pathLength}`;
      }
    }

    // Fully lit state when motion is reduced
    function lightEverything() {
      if (svgPath) svgPath.style.strokeDashoffset = '0';
      if (svgGlow) svgGlow.style.strokeDashoffset = '0';
      if (beaconGroup) {
        beaconGroup.setAttribute('transform', 'translate(20, 1000)');
        beaconGroup.style.opacity = '1';
      }
      if (fill) fill.style.transform = 'scaleY(1)';
      steps.forEach((step) => step.classList.add('is-live', 'is-done'));
    }

    if (reduceMotion) {
      lightEverything();
      return;
    }

    const applied = steps.map(() => ({ live: false, done: false }));
    const proxy = { p: 0 };

    function renderProgress(p) {
      const clamped = Math.max(0, Math.min(1, p));

      // Fast, snappy SVG line drawing based on user's scroll percentage
      if (svgPath) {
        const offset = Math.max(0, pathLength * (1 - clamped));
        svgPath.style.strokeDashoffset = offset.toFixed(2);
        if (svgGlow) svgGlow.style.strokeDashoffset = offset.toFixed(2);
      }

      // Dynamic beacon positioning at the leading tip of the drawn line
      if (beaconGroup) {
        const yPos = (clamped * 1000).toFixed(1);
        beaconGroup.setAttribute('transform', `translate(20, ${yPos})`);
        beaconGroup.style.opacity = clamped > 0.015 ? '1' : '0';
      }

      if (fill) {
        fill.style.transform = `scaleY(${clamped.toFixed(4)})`;
      }

      // Step activation synchronized with line tip reaching each node
      for (let i = 0; i < total; i++) {
        const threshold = total > 1 ? i / (total - 1) : 0;
        const live = clamped >= Math.max(0, threshold - 0.08);
        const done = i < total - 1 ? clamped >= threshold + 0.16 : clamped >= 0.98;

        if (applied[i].live !== live) {
          steps[i].classList.toggle('is-live', live);
          applied[i].live = live;
        }
        if (applied[i].done !== done) {
          steps[i].classList.toggle('is-done', done);
          applied[i].done = done;
        }
      }
    }

    if (!hasGsap) {
      // Snappy vanilla scroll fallback with requestAnimationFrame
      let ticking = false;
      function onVanillaScroll() {
        if (!ticking) {
          window.requestAnimationFrame(() => {
            const rect = section.getBoundingClientRect();
            const vh = window.innerHeight || 800;
            const start = vh * 0.78;
            const end = vh * 0.3 - rect.height;
            const progress = (start - rect.top) / (start - end);
            renderProgress(progress);
            ticking = false;
          });
          ticking = true;
        }
      }
      window.addEventListener('scroll', onVanillaScroll, { passive: true });
      onVanillaScroll();
      return;
    }

    // High-velocity snappy scrubbed ScrollTrigger ("jaldi" scroll animation)
    gsap.to(proxy, {
      p: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top 78%',
        end: 'bottom 68%',
        // scrub: 0.18 gives instantaneous, butter-smooth scroll tracking
        scrub: 0.18,
        invalidateOnRefresh: true,
        onRefresh: () => {
          if (svgPath) {
            try {
              const measured = svgPath.getTotalLength();
              if (measured && measured > 0) pathLength = measured;
            } catch (e) {}
          }
          renderProgress(proxy.p);
        },
      },
      onUpdate: () => renderProgress(proxy.p),
    });

    renderProgress(0);
  }

  // 6. Feature & Why Cards: Multi-Plane Depth & Staggered Scroll Reveals
  function initFeatureCardsDepth() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      // Fallback: simple IntersectionObserver
      const reveals = document.querySelectorAll('.fab-reveal');
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('revealed');
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
        reveals.forEach(el => observer.observe(el));
      } else {
        reveals.forEach(el => el.classList.add('revealed'));
      }
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.fab-reveal').forEach(el => el.classList.add('revealed'));
      return;
    }

    const cards = gsap.utils.toArray('.fab-feature-card, .fab-why-card');
    if (cards.length) {
      ScrollTrigger.batch(cards, {
        onEnter: (batch) => {
          gsap.fromTo(batch,
            { opacity: 0, y: 35, scale: 0.98 },
            { opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.1, ease: 'power2.out', overwrite: 'auto' }
          );
        },
        start: 'top 88%',
        once: true
      });

      // Parallax on card icons (multi-layer optical depth)
      cards.forEach((card) => {
        const icon = card.querySelector('.editorial-card-icon');
        if (icon) {
          gsap.to(icon, {
            scrollTrigger: {
              trigger: card,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
            y: -14,
            ease: 'none',
          });
        }
      });

      // Prismic #11: Why Cards Multi-Speed Parallax Float
      const whyCards = gsap.utils.toArray('.fab-why-card');
      const speeds = [-18, 12, -22];
      whyCards.forEach((card, idx) => {
        gsap.to(card, {
          y: speeds[idx % speeds.length],
          ease: 'none',
          scrollTrigger: {
            trigger: '#why',
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1.2
          }
        });
      });
    }

    // Section headers reveal
    const headers = gsap.utils.toArray('.fab-section-header');
    headers.forEach((hdr) => {
      gsap.fromTo(hdr,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: hdr,
            start: 'top 85%',
            toggleActions: 'play none none none'
          }
        }
      );
    });
  }

  // 6b. GALLERY - STICKY CONTENT SWITCH
  //
  // The headline on the left stays pinned while the captures on the right travel
  // horizontally, and the headline re-writes itself the moment a new capture
  // crosses the centre of the viewport. Vertical scroll is never hijacked: one
  // pinned stage, one scrubbed X translation.
  //
  // This replaces an earlier version that pinned a ~60%-viewport-tall block
  // *inside* #features. Three things were wrong with it, and all three are
  // structural:
  //   1. A pinned block shorter than the viewport leaves the uncovered strip
  //      showing the rest of the page scrolling past behind it. That was the
  //      overlap that got reported.
  //   2. The slides were `flex: 0 0 100%` inside a `width:max-content` row, so
  //      the percentage basis resolved against an indefinite container and the
  //      measured travel distance came out around 5600px. The pin range was
  //      therefore ~5.5k px long and the slide rendered as a blank over-wide box.
  //   3. It was wired into the navbar's "Features" target, so a feature list
  //      link landed on a pinned scroll stage.
  //
  // Init is deliberately deferred. ScrollTrigger measures real pixels, so it must
  // not run while webfonts or images are still changing the rendered width: the
  // block waits for two committed frames, resolved fonts and decoded images, with
  // a hard ceiling so a stalled asset can never leave the section dead.
  function initGalleryPin() {
    const section = document.getElementById('gallery');
    const stage = document.getElementById('galleryPin');
    const viewport = document.getElementById('galleryViewport');
    const track = document.getElementById('galleryTrack');
    if (!section || !stage || !viewport || !track) return;

    const slides = Array.from(track.querySelectorAll('.gallery-slide'));
    const copies = Array.from(section.querySelectorAll('.gallery-copy-item'));
    const dots = Array.from(section.querySelectorAll('.gallery-dot'));
    const numEl = document.getElementById('galleryCopyNum');
    const hintEl = document.getElementById('galleryHint');
    if (!slides.length) return;

    const lastIndex = slides.length - 1;

    // TAIL is the FRACTION of the pinned scroll range given over to holding the
    // final capture, rather than travelling further. Without it the last slide
    // arrives at the exact instant the pin releases and is never readable.
    //
    // It has to stay consistent across three places, or slide N stops lining up
    // with its own copy: the x tween's duration, the empty tail tween, and the
    // progress -> x mapping below. Travel happens across the first (1 - TAIL) of
    // the pin; x = -travel * min(1, progress / (1 - TAIL)).
    const TAIL = 0.18;

    let media = null;        // gsap.matchMedia() owning the pinned build
    let trigger = null;      // live ScrollTrigger, used by the dot navigation
    let activeIndex = -1;
    let travel = 0;          // measured distance the track has to cover
    let centres = [];        // each slide's centre in untransformed track space
    let resizeTimer = null;
    let disposed = false;

    /* -------------------------------------------------------------------- */
    /* Copy switching. Class toggles only - CSS owns every transition, so    */
    /* the switch still works with GSAP absent and cannot desync from the   */
    /* timeline the way a second tween on the same properties would.        */
    /* -------------------------------------------------------------------- */
    function applyIndex(index) {
      const next = Math.max(0, Math.min(lastIndex, index));
      if (next === activeIndex) return;
      activeIndex = next;

      copies.forEach((el, i) => {
        const on = i === next;
        el.classList.toggle('is-active', on);
        // Hidden copies are removed from the accessibility tree and from the
        // tab order by the same `visibility:hidden` the transition animates.
        if (on) el.removeAttribute('aria-hidden');
        else el.setAttribute('aria-hidden', 'true');
      });
      slides.forEach((el, i) => el.classList.toggle('is-active', i === next));
      dots.forEach((el, i) => {
        el.classList.toggle('is-active', i === next);
        el.classList.toggle('is-past', i < next);
        el.setAttribute('aria-current', i === next ? 'true' : 'false');
      });
      if (numEl) numEl.textContent = String(next + 1).padStart(2, '0');
    }

    /* -------------------------------------------------------------------- */
    /* Measurement. Re-read on every build AND on every ScrollTrigger        */
    /* refresh, because webfonts, image decode and resize all change it. A   */
    /* stale number is what produces a pin range thousands of pixels too long.*/
    /* -------------------------------------------------------------------- */
    function measure() {
      centres = slides.map((slide) => slide.offsetLeft + slide.offsetWidth / 2);

      // Travel is the gap between the first and last slide CENTRES, not the
      // full track width. Combined with the track's centring padding this means
      // slide N sits dead centre exactly when the track has moved N spacings,
      // which is what the copy switch keys off. Using the track's right edge
      // here is what used to leave the final slide hanging off-centre.
      travel = Math.max(0, centres[lastIndex] - centres[0]);
      return travel;
    }

    /**
     * Which capture owns the centre right now.
     * Pure geometry on cached centres, so it is exact in both scroll
     * directions and independent of easing, scrub smoothing or the tail.
     */
    function indexAtX(x) {
      const mid = viewport.clientWidth / 2;
      let best = 0;
      let bestGap = Infinity;
      for (let i = 0; i < centres.length; i++) {
        const gap = Math.abs(centres[i] + x - mid);
        if (gap < bestGap) { bestGap = gap; best = i; }
      }
      return best;
    }

    /** Progress of the pinned range -> the track's current X offset. */
    function xAtProgress(progress) {
      // The tween occupies the first (1 - TAIL) of the range; the rest is the
      // hold. Both clamps matter: progress never exceeds 1, and the ratio must
      // match the tween's own duration or the copy drifts off its slide.
      return -travel * Math.min(1, progress / (1 - TAIL));
    }

    /** Progress at which slide `index` sits exactly centred. */
    function progressForIndex(index) {
      const fraction = lastIndex === 0 ? 0 : index / lastIndex;
      return fraction * (1 - TAIL);
    }

    /* -------------------------------------------------------------------- */
    /* Teardown. matchMedia().revert() removes the pin, its spacer and the    */
    /* transform, so switching breakpoints can never leave two pinned stages. */
    /* -------------------------------------------------------------------- */
    function leavePinnedMode() {
      // Reverting the matchMedia context is what removes the pin, its spacer and the
      // timeline. It has to happen BEFORE the classes change, otherwise the teardown
      // measures itself against the wrong layout.
      if (media) { media.revert(); media = null; }
      section.classList.remove('is-horizontal', 'is-static');
      if (hintEl) hintEl.classList.remove('is-done');
      if (typeof gsap !== 'undefined') gsap.set(track, { clearProps: 'transform' });
      trigger = null;
    }

    function enterStaticMode() {
      leavePinnedMode();
      section.classList.add('is-static');
      applyIndex(0);
    }

    /* -------------------------------------------------------------------- */
    /* The pinned horizontal build                                          */
    /* -------------------------------------------------------------------- */
    function buildPinned() {
      const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
      if (!hasGsap) { enterStaticMode(); return; }

      // A rebuild after a breakpoint change must never stack a second pin on top
      // of the first one.
      leavePinnedMode();
      section.classList.add('is-horizontal');

      measure();

      // Nothing to travel: either the slides already fit (a very wide window,
      // or a viewport too short for the stage) or the layout has not settled.
      // Pinning here would only create a multi-thousand-pixel dead zone.
      if (travel < 40 || viewport.clientWidth < 240) { enterStaticMode(); return; }

      media = gsap.matchMedia();

      media.add('(min-width: 900px)', () => {
        const timeline = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            id: 'galleryShowcase',
            // Pin the stage itself, and start the pin when the STAGE reaches the
            // top of the screen - not when the section header does.
            trigger: stage,
            pin: stage,
            start: 'top top',
            // Function-based so the pin range is recomputed from real pixels on
            // every refresh: measure() and this length can never disagree.
            end: () => '+=' + Math.round(measure() / (1 - TAIL)),
            scrub: 0.5,
            anticipatePin: 1,
            pinSpacing: true,
            invalidateOnRefresh: true,
            onRefresh: () => {
              // Keep the copy in step after a resize or font swap even when the
              // trigger has not been scrolled since.
              if (trigger) applyIndex(indexAtX(xAtProgress(trigger.progress)));
            },
            onUpdate: (self) => {
              const x = xAtProgress(self.progress);
              applyIndex(indexAtX(x));
              if (hintEl) hintEl.classList.toggle('is-done', self.progress > 0.02);
            }
          }
        });

        timeline.to(track, { x: () => -measure(), duration: 1 - TAIL }, 0);
        // Empty tail tween: extends the timeline without moving anything, which
        // is what holds the final capture centred before the pin releases.
        timeline.to({}, { duration: TAIL }, 1 - TAIL);

        trigger = timeline.scrollTrigger;
        applyIndex(indexAtX(xAtProgress(trigger.progress)));

        return () => {
          const dead = trigger;
          trigger = null;
          if (dead) dead.kill(true);
          timeline.kill();
        };
      });

      // Pinning changes the document height, so every other trigger in the page
      // is now measured against a different page. One refresh settles it all.
      ScrollTrigger.refresh();
    }

    /* -------------------------------------------------------------------- */
    /* Deferred, safe init                                                   */
    /* -------------------------------------------------------------------- */

    /**
     * Runs `done` only once the section can be measured honestly:
     * two committed animation frames, resolved webfonts and decoded images,
     * plus one more frame to flush the reflow those two cause.
     * `budget` is a hard ceiling, so a slow or broken asset can never leave the
     * showcase unbuilt.
     */
    function whenMeasurable(el, done, budget) {
      // settled is the one-shot latch, and cancel() deliberately trips it: a
      // measurement abandoned by a mode flip must never fire through its promise
      // chain afterwards and rebuild a pin the user has already left behind.
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (!disposed) done();
      };
      const timer = window.setTimeout(finish, budget);

      const painted = () => new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });

      const fontsReady = document.fonts && document.fonts.ready
        ? document.fonts.ready.catch(() => {})
        : Promise.resolve();

      const imagesReady = Promise.all(
        Array.from(el.querySelectorAll('img')).map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          });
        })
      );

      Promise.all([painted(), fontsReady, imagesReady]).then(
        () => requestAnimationFrame(finish),
        () => finish()
      );

      return () => {
        settled = true;
        window.clearTimeout(timer);
      };
    }

    // A late-arriving image changes the slide metrics, so re-measure and let
    // ScrollTrigger recompute the pin range instead of trusting the first read.
    Array.from(track.querySelectorAll('img')).forEach((img) => {
      if (img.complete) return;
      img.addEventListener('load', () => {
        if (disposed) return;
        measure();
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
      }, { once: true });
    });

    /* -------------------------------------------------------------------- */
    /* Dot navigation. Moves the scroll position rather than animating the    */
    /* track, so the scrubbed timeline stays the single source of truth and    */
    /* reverse scrolling behaves identically.                                  */
    /* -------------------------------------------------------------------- */
    function scrollToSlide(index) {
      const clamped = Math.max(0, Math.min(lastIndex, index));

      if (!trigger) {
        const slide = slides[clamped];
        if (slide && slide.scrollIntoView) {
          slide.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        return;
      }

      // The progress at which slide N is centred, derived from the same
      // geometry the trigger itself uses - never from a hand-tuned pixel value.
      const progress = progressForIndex(clamped);
      const y = Math.round(trigger.start + progress * (trigger.end - trigger.start));

      if (window._lenis) window._lenis.scrollTo(y, { duration: 1.1 });
      else window.scrollTo({ top: y, behavior: 'smooth' });
    }

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => scrollToSlide(i));
    });

    // Prev / Next button navigation for desktop and tablet
    const prevBtn = document.getElementById('galleryPrevBtn');
    const nextBtn = document.getElementById('galleryNextBtn');
    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToSlide((activeIndex <= 0 ? lastIndex : activeIndex - 1));
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToSlide((activeIndex >= lastIndex ? 0 : activeIndex + 1));
      });
    }

    // Desktop Mouse Drag to Swipe / Scroll feature cards (identical to mobile touch experience)
    let isMouseDown = false;
    let dragStartX = 0;
    let dragDistance = 0;

    viewport.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only primary mouse button
      isMouseDown = true;
      dragStartX = e.clientX;
      dragDistance = 0;
      viewport.classList.add('is-dragging');
    });

    window.addEventListener('mousemove', (e) => {
      if (!isMouseDown) return;
      dragDistance = e.clientX - dragStartX;
    });

    window.addEventListener('mouseup', () => {
      if (!isMouseDown) return;
      isMouseDown = false;
      viewport.classList.remove('is-dragging');
      if (Math.abs(dragDistance) > 45) {
        if (dragDistance < 0) {
          scrollToSlide(Math.min(lastIndex, activeIndex + 1));
        } else {
          scrollToSlide(Math.max(0, activeIndex - 1));
        }
      }
      dragDistance = 0;
    });

    // Keyboard Arrow navigation when gallery is in view
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const rect = section.getBoundingClientRect();
      const inView = rect.top < window.innerHeight * 0.7 && rect.bottom > window.innerHeight * 0.3;
      if (!inView) return;

      if (e.key === 'ArrowRight') {
        scrollToSlide(Math.min(lastIndex, activeIndex + 1));
      } else if (e.key === 'ArrowLeft') {
        scrollToSlide(Math.max(0, activeIndex - 1));
      }
    });

    /* -------------------------------------------------------------------- */
    /* Boot                                                                  */
    /* -------------------------------------------------------------------- */

    // The pinned mode is a LIVE decision, not a one-shot boot check.
    //
    // Deciding only once was a real bug: a window dragged across 900px left the
    // section still carrying is-horizontal, where the desktop rules hide both the
    // slide captions and the copy column. The section was then on screen with no
    // text anywhere in it. The OS flipping reduce-motion mid-session had the same
    // effect, and nothing switched back when motion came back either.
    const wideMotion = window.matchMedia('(min-width: 900px)');

    let cancelMeasure = null;

    function syncMode() {
      if (disposed) return;

      // Never leave a measurement in flight while the mode flips underneath it.
      if (cancelMeasure) { cancelMeasure(); cancelMeasure = null; }

      if (wideMotion.matches) {
        // Exactly the deferred, measure-safe path used on the very first boot.
        cancelMeasure = whenMeasurable(section, () => {
          cancelMeasure = null;
          if (!disposed && wideMotion.matches) buildPinned();
          else enterStaticMode();
        }, 1200);
      } else {
        enterStaticMode();
      }
    }

    if (typeof wideMotion.addEventListener === 'function') {
      wideMotion.addEventListener('change', syncMode);
    } else if (typeof wideMotion.addListener === 'function') {
      wideMotion.addListener(syncMode);
    }

    syncMode();

    // Resize only needs a refresh: every value the pin depends on is
    // function-based, so ScrollTrigger re-measures it on its own. Rebuilding
    // here instead would re-pin mid-scroll, which is exactly what made the old
    // version jump around while the window was being dragged.
    window.addEventListener('resize', () => {
      if (disposed) return;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!disposed && typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
      }, 200);
    }, { passive: true });
  }

// 7. Chat Preview Bubbles Scrub Entrance in Use Cases
  function initChatPreviewScrub() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const previewCards = gsap.utils.toArray('.editorial-preview-card');
    previewCards.forEach((pCard) => {
      const bubbles = pCard.querySelectorAll('.preview-bubble');
      if (bubbles.length) {
        gsap.fromTo(bubbles,
          { opacity: 0, y: 16, scale: 0.97 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            stagger: 0.18,
            duration: 0.5,
            ease: 'back.out(1.2)',
            scrollTrigger: {
              trigger: pCard,
              start: 'top 80%',
              toggleActions: 'play none none none'
            }
          }
        );
      }
    });
  }

  // 8. Interactive Use Cases Tabs with ARIA and Arrow Navigation
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

      // Trigger animation on newly visible panel bubbles
      if (typeof gsap !== 'undefined') {
        const activePanel = document.getElementById(`tab-panel-${targetTab}`);
        if (activePanel) {
          const bubbles = activePanel.querySelectorAll('.preview-bubble');
          gsap.fromTo(bubbles, 
            { opacity: 0, y: 12 },
            { opacity: 1, y: 0, stagger: 0.12, duration: 0.4, ease: 'power2.out' }
          );
        }
      }
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

  // 9. Pricing Switcher (Monthly / Yearly)
  function initPricingSwitcher() {
    const switchBtns = document.querySelectorAll('.fab-switch-btn');
    const priceAmounts = document.querySelectorAll('.fab-tier-amount');
    const pricePeriods = document.querySelectorAll('.fab-tier-period');

    if (!switchBtns.length) return;

    switchBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        switchBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const mode = btn.getAttribute('data-mode');
        priceAmounts.forEach((amt) => {
          amt.textContent = '$0';
        });

        pricePeriods.forEach((p) => {
          p.textContent = mode === 'yearly' ? '/year (free forever)' : '/month (free forever)';
        });
      });
    });
  }

  // 10. FAQ Accordions (Expand / Collapse with Keyboard Activation & ARIA)
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

  // 11. Animated Stat Counters
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

  // 12. Magnetic Button & Ambient Expansion for Final CTA
  function initMagneticCta() {
    const ctaBanner = document.querySelector('.fab-cta-banner');
    if (!ctaBanner) return;

    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(ctaBanner,
        { opacity: 0.8, scale: 0.97 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.7,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: ctaBanner,
            start: 'top 85%',
            toggleActions: 'play none none none'
          }
        }
      );
    }

    const ctaBtn = ctaBanner.querySelector('.trigger-start-chat');
    if (!ctaBtn || window.matchMedia('(hover: none)').matches) return;

    ctaBtn.addEventListener('mousemove', (e) => {
      const rect = ctaBtn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      ctaBtn.style.transform = `translate(${x * 0.16}px, ${y * 0.16}px)`;
    });

    ctaBtn.addEventListener('mouseleave', () => {
      ctaBtn.style.transform = 'translate(0px, 0px)';
      ctaBtn.style.transition = 'transform 0.3s ease';
    });

    ctaBtn.addEventListener('mouseenter', () => {
      ctaBtn.style.transition = 'none';
    });
  }

  // 13. Connect All CTA buttons to AnonChat Matchmaking!
  function initCtaTriggers() {
    const ctaTriggers = document.querySelectorAll('.trigger-start-chat');
    const startChatBtn = document.getElementById('startChatBtn');

    ctaTriggers.forEach((btn) => {
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

  // 14. Smooth Anchor Scrolling with Lenis and Navbar Offset
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
              window._lenis.scrollTo(targetEl, { offset: -70, duration: 1.15 });
            } else {
              const yOffset = -70;
              const y = targetEl.getBoundingClientRect().top + window.pageYOffset + yOffset;
              window.scrollTo({ top: y, behavior: 'smooth' });
            }
          }
        }
      });
    });
  }

  // 15. Safe Screen Lifecycle: Pause animations when chatting to guarantee 0% overhead
  function initScreenLifecycle() {
    // The pinned story lives inside #landingScreen, which is display:none while
    // the user is in the searching or chat screen. Previously this handler called
    // ScrollTrigger.disable(false) on EVERY trigger whenever the app left the
    // landing screen. Pinned triggers disabled without a revert keep a dead pin
    // spacer, and the later enable() + refresh() could not recover them - which
    // is why the pinned card animation would stop responding after returning
    // from a chat session.
    //
    // Now we simply re-measure once the landing screen is visible again. While it
    // is hidden its triggers are inert anyway, because a display:none subtree has
    // no layout to measure.
    let refreshQueued = false;
    function queueRefresh() {
      if (refreshQueued) return;
      refreshQueued = true;
      requestAnimationFrame(() => {
        refreshQueued = false;
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
      });
    }

    const observer = new MutationObserver(() => {
      const landingEl = document.getElementById('landingScreen');
      const onLanding =
        document.body.classList.contains('on-landing') ||
        (landingEl && landingEl.classList.contains('active'));
      if (onLanding) queueRefresh();
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const landing = document.getElementById('landingScreen');
    if (landing) {
      observer.observe(landing, { attributes: true, attributeFilter: ['class'] });
    }
  }

})();
