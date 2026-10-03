import React, {
  useRef,
  useState,
  useLayoutEffect,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
  CSSProperties,
  HTMLAttributes
} from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/* ==========================================================================
   CardSwapShowcase - premium scroll-driven story

   NOTE FOR MAINTAINERS
   This component is NOT part of the page that is actually served today.
   The live AnonChat experience is vanilla HTML/CSS/JS in /public
   (app-chat.html + editorial.css + fabale.js) and the project deliberately
   ships no React bundler, so nothing mounts this file. It is the React port
   of that same interaction and is kept behaviourally in step with it.
   Shipping it requires adding react, react-dom and a bundler.

   Interaction model:
   - No autoplay. There is no setInterval anywhere; scroll position alone
     decides which card is dominant.
   - ONE master GSAP timeline drives the 3D card deck, the SVG journey line and
     the continuous horizontal sentence, so they cannot drift out of sync.
   - Scrolling up reverses the story rather than restarting it.
   - Reduced motion gets a readable static layout, not a half-built deck.
   ========================================================================== */

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// SSR-safe layout effect (measure before paint, but never on the server)
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/* -------------------------------------------------------------------------- */
/* Deck presets per breakpoint                                                */
/* -------------------------------------------------------------------------- */

interface DeckPreset {
  /** Horizontal offset step per depth slot. */
  x: number;
  /** Vertical offset step per depth slot. */
  y: number;
  /** Z-space step per depth slot. */
  z: number;
  /** Scale of the first depth slot. */
  scale: number;
  /** rotateY step per depth slot, in degrees. Kept small on purpose. */
  rot: number;
  /** skewY step per depth slot, in degrees. */
  skew: number;
  /** Opacity of the first depth slot. */
  op: number;
  /** Extra leftward fan applied to each card as it leaves the deck. */
  recede: number;
  /** Upper bound for the pinned scroll distance, in pixels. */
  travel: number;
  /** Scrub smoothing. */
  scrub: number;
}

const DECK_PRESETS: Record<'desktop' | 'tablet' | 'mobile', DeckPreset> = {
  desktop: { x: 40, y: -26, z: -72, scale: 0.952, rot: -3.0, skew: 2.5, op: 0.93, recede: 26, travel: 2500, scrub: 0.8 },
  tablet:  { x: 30, y: -20, z: -58, scale: 0.945, rot: -2.4, skew: 2.0, op: 0.91, recede: 20, travel: 2150, scrub: 0.65 },
  mobile:  { x: 18, y: -13, z: -44, scale: 0.940, rot: -1.8, skew: 1.4, op: 0.90, recede: 13, travel: 1750, scrub: 0.55 }
};

interface Slot {
  x: number;
  y: number;
  z: number;
  scale: number;
  rot: number;
  skew: number;
  op: number;
  zIndex: number;
}

/**
 * Restrained depth slots. This has to read as modern product storytelling, not
 * as a fanned casino deck, so every step stays small and the opacity floor is
 * high enough that the back of the deck stays legible.
 */
function buildSlots(count: number, preset: DeckPreset): Slot[] {
  return Array.from({ length: count }, (_, i) =>
    i === 0
      ? { x: 0, y: 0, z: 0, scale: 1, rot: 0, skew: 0, op: 1, zIndex: 10 }
      : {
          x: preset.x * i,
          y: preset.y * i,
          z: preset.z * i,
          scale: 1 - (1 - preset.scale) * i,
          rot: preset.rot * i,
          skew: preset.skew * i,
          op: Math.max(0.56, preset.op - (i - 1) * 0.12),
          zIndex: 10 - i
        }
  );
}

/** Beat geometry shared by the timeline and the beat rail. */
const BEAT = 1;
const TAIL = 0.55;
const timelineLength = (cardCount: number) => Math.max(1, cardCount - 1) * BEAT + TAIL;

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export interface CardSwapProps {
  /** Optional explicit deck width. Overrides the responsive clamp. */
  width?: number | string;
  /** Optional explicit deck height. Overrides the responsive aspect ratio. */
  height?: number | string;
  className?: string;
  /** Preserved click behaviour - fires with the tapped card's index. */
  onCardClick?: (idx: number) => void;
  /** Labels for the beat rail. Defaults to generic numbering. */
  beats?: string[];
  /** Escape hatch: render the resting deck without pinning or scrubbing. */
  disableScrollTrigger?: boolean;
  children: ReactNode;
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  customClass?: string;
  children: ReactNode;
}

/**
 * Individual card wrapper. Keeps the 3D transform context intact so the deck's
 * translateZ and rotateY read as real depth rather than a flat scale.
 */
export const Card: React.FC<CardProps> = ({
  customClass = '',
  className = '',
  children,
  style,
  ...rest
}) => (
  <div
    className={`overflow-hidden rounded-2xl shadow-2xl ${customClass} ${className}`}
    style={{
      width: '100%',
      height: '100%',
      backfaceVisibility: 'hidden',
      WebkitBackfaceVisibility: 'hidden',
      transformStyle: 'preserve-3d',
      ...style
    }}
    {...rest}
  >
    {children}
  </div>
);

/* -------------------------------------------------------------------------- */
/* The continuous horizontal sentence                                         */
/* -------------------------------------------------------------------------- */

/** Inline connector shapes that sit between phrases like punctuation. */
type LinkGlyph = 'curve' | 'dots' | 'arrow' | 'cross' | 'star' | 'dash';

type FlowNode =
  | { kind: 'phrase'; text: string; lead: number; italic?: boolean; accent?: boolean }
  | { kind: 'link'; width: number; lead: number; glyph: LinkGlyph }
  | { kind: 'pill'; label: string; tone: 'cyan' | 'indigo' | 'green' | 'orange'; icon: ReactNode; lead: number };

/**
 * One long editorial sentence, not a deck of slides.
 *
 * Every gap carries its own `lead` value on a deliberately uneven scale (8 to
 * 20, alternating) so the rhythm reads as art-directed rather than as a
 * repeating grid. The SVG connectors sit inline between phrases, acting as the
 * punctuation and conjunctions of the sentence.
 */
const JOURNEY_FLOW: FlowNode[] = [
  { kind: 'phrase', text: 'In every late-night silence', lead: 0 },

  { kind: 'link', width: 46, lead: 18, glyph: 'curve' },
  { kind: 'pill', label: 'Sub-10ms Match', tone: 'cyan', lead: 14, icon: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /> },

  { kind: 'link', width: 34, lead: 16, glyph: 'dots' },
  { kind: 'phrase', text: 'discover the undeniable', lead: 10, italic: true },

  { kind: 'link', width: 40, lead: 12, glyph: 'arrow' },
  { kind: 'phrase', text: 'freedom', lead: 8, accent: true },

  { kind: 'link', width: 30, lead: 14, glyph: 'cross' },
  { kind: 'pill', label: 'Zero Logins', tone: 'cyan', lead: 20, icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /> },

  { kind: 'link', width: 52, lead: 16, glyph: 'curve' },
  { kind: 'phrase', text: 'of sharing pure honest thoughts', lead: 16 },

  { kind: 'link', width: 32, lead: 12, glyph: 'dash' },
  { kind: 'pill', label: 'RAM Voice Memos', tone: 'indigo', lead: 12, icon: <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /></> },

  { kind: 'link', width: 38, lead: 14, glyph: 'curve' },
  { kind: 'phrase', text: 'that brings classmates', lead: 10, italic: true },

  { kind: 'link', width: 36, lead: 12, glyph: 'arrow' },
  { kind: 'pill', label: '100% Ephemeral', tone: 'green', lead: 18, icon: <polyline points="20 6 9 17 4 12" /> },

  { kind: 'link', width: 44, lead: 14, glyph: 'curve' },
  { kind: 'phrase', text: 'together', lead: 14 },

  { kind: 'link', width: 30, lead: 12, glyph: 'star' },
  { kind: 'phrase', text: 'without leaving', lead: 12 },

  { kind: 'link', width: 28, lead: 12, glyph: 'curve' },
  { kind: 'phrase', text: 'a single trace', lead: 8, accent: true },

  { kind: 'link', width: 40, lead: 12, glyph: 'arrow' },
  { kind: 'pill', label: 'Vaporizes on Exit', tone: 'orange', lead: 16, icon: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></> }
];

const LINK_GLYPHS: Record<LinkGlyph, string> = {
  curve: 'M1 7C11 1 20 13 30 7c4-2.4 9-2.4 15 0',
  arrow: 'M2 11C13 3 27 3 38 7M33 3.5 38 7l-5.4 2.6',
  cross: 'M15 1v12M9 7h12M11.5 3.5 9 7l2.5 3.5M18.5 3.5 21 7l-2.5 3.5',
  star: 'M15 1.5 16.6 6l4.4.4-3.3 2.9 1 4.3L15 11.4 11.3 13.6l1-4.3L9 6.4 13.4 6z',
  dash: 'M1 7h30',
  dots: ''
};

const PILL_TONE: Record<string, string> = {
  cyan: 'border-cyan-700/20 text-cyan-800',
  indigo: 'border-indigo-700/20 text-indigo-800',
  green: 'border-emerald-700/20 text-emerald-800',
  orange: 'border-orange-700/20 text-orange-800'
};

/* -------------------------------------------------------------------------- */
/* CardSwap                                                                   */
/* -------------------------------------------------------------------------- */

export const CardSwap: React.FC<CardSwapProps> = ({
  width,
  height,
  className = '',
  onCardClick,
  beats,
  disableScrollTrigger = false,
  children
}) => {
  /* Stable refs - nothing here is ever queried globally. */
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const journeyPathRef = useRef<SVGPathElement>(null);

  const cardList = useMemo(() => React.Children.toArray(children), [children]);
  const totalCards = cardList.length;

  const beatLabels = useMemo(
    () => beats ?? Array.from({ length: totalCards }, (_, i) => `Story beat ${i + 1}`),
    [beats, totalCards]
  );

  // Only the beat rail needs to re-render, never the deck or the sentence.
  const [activeBeat, setActiveBeat] = useState(0);

  const deckSize: CSSProperties = useMemo(
    () =>
      width || height
        ? { width: width as CSSProperties['width'], height: height as CSSProperties['height'] }
        : {},
    [width, height]
  );

  /**
   * Move the scroll position to a beat. Scrubbed timelines resolve from the
   * scroll offset, so this stays correct when scrolling back up as well.
   */
  const scrollToBeat = useCallback(
    (index: number) => {
      const trigger = ScrollTrigger.getById('cardSwapStory');
      if (!trigger) return;
      const clamped = Math.max(0, Math.min(totalCards - 1, index));

      // Aim at the CENTRE of the beat, never its leading edge.
      //
      // Scroll offsets are snapped to whole pixels, so a target computed
      // exactly on a beat boundary can land a fraction of a pixel to either
      // side of it. That is enough for the Math.floor() in onUpdate to report
      // the PREVIOUS beat, which left the rail highlighting the wrong card.
      // The centre of a beat sits a full half-beat from either edge, so
      // rounding can never cross it - and landing mid-beat also means the card
      // has visibly settled instead of merely starting to move.
      const TOTAL = timelineLength(totalCards);
      const beatCentre = clamped + 0.5;
      const y = trigger.start + (beatCentre / TOTAL) * (trigger.end - trigger.start);

      window.scrollTo({ top: Math.round(y), behavior: 'smooth' });
    },
    [totalCards]
  );

  /* ---------------------------------------------------------------------- */
  /* GSAP setup: deferred measurement, scoped context, full teardown        */
  /* ---------------------------------------------------------------------- */
  useIsomorphicLayoutEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const deck = deckRef.current;
    if (!section || !stage || !deck) return;

    let cancelled = false;
    let rafOuter = 0;
    let rafInner = 0;
    let mediaMatcher: gsap.MatchMedia | null = null;
    let revertContext: (() => void) | null = null;

    /**
     * Builds the whole story for one breakpoint. Returns nothing: gsap.context
     * and the matchMedia instance own the teardown.
     */
    const buildStory = (preset: DeckPreset) => {
      const cardEls = Array.from(deck.children) as HTMLElement[];
      if (cardEls.length === 0) return;

      const slots = buildSlots(cardEls.length, preset);

      // Resting deck: card 1 dominant, the rest receding with subtle depth.
      cardEls.forEach((card, i) => {
        const s = slots[i] ?? slots[slots.length - 1];
        gsap.set(card, {
          x: s.x,
          y: s.y,
          z: s.z,
          scale: s.scale,
          rotateY: s.rot,
          skewY: s.skew,
          opacity: s.op,
          zIndex: s.zIndex,
          transformOrigin: 'center center',
          force3D: true
        });
      });

      // Escape hatch: a static deck, no pin and no scroll hijacking.
      if (disableScrollTrigger) return;

      // SVG journey line. Measured only once the path has real layout.
      const path = journeyPathRef.current;
      let pathLength = 0;
      if (path) {
        try {
          pathLength = path.getTotalLength();
          path.style.strokeDasharray = `${pathLength} ${pathLength}`;
          path.style.strokeDashoffset = `${pathLength}`;
        } catch {
          pathLength = 0;
        }
      }

      const TOTAL = timelineLength(cardEls.length);

      /* THE master timeline: one scrubbed progress value for the deck, the
         journey line and the horizontal sentence. */
      const timeline = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: {
          id: 'cardSwapStory',
          trigger: section,
          pin: stage,
          start: 'top top',
          // Enough distance for every beat to breathe, but capped so the
          // pinned stage never turns into a scrolling chore.
          end: () =>
            '+=' +
            Math.round(
              Math.min(preset.travel, Math.max(1600, window.innerHeight * 2.6))
            ),
          scrub: preset.scrub,
          anticipatePin: 1,
          // Re-measure function-based values after a resize or font swap.
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const progress = self.progress;

            // The journey line draws itself from the same progress value.
            if (path && pathLength > 0) {
              path.style.strokeDashoffset = String(
                Math.max(0, pathLength * (1 - progress))
              );
            }

            setActiveBeat(
              Math.max(
                0,
                Math.min(
                  cardEls.length - 1,
                  // A twentieth of a beat of tolerance absorbs the sub-pixel
                  // remainder of a scrubbed scroll. Without it, a rail click
                  // that targets a beat boundary can settle a hair short and
                  // highlight the previous card.
                  Math.floor((progress * TOTAL) / BEAT + 0.05)
                )
              )
            );
          }
        }
      });

      /* Card beats. The outgoing card slides back and to the left and dims only
         slightly - it never disappears - while the incoming card slides in
         from the right, over it, into the dominant slot. */
      for (let k = 0; k < cardEls.length - 1; k++) {
        const at = k * BEAT;
        const outgoingSlot = slots[Math.min(k + 1, slots.length - 1)] ?? slots[0];

        timeline.to(
          cardEls[k],
          {
            x: -(58 + preset.recede * k),
            y: 10,
            z: -150 - 60 * k,
            scale: outgoingSlot.scale * 0.95,
            rotateY: -5.5,
            rotateZ: -2.2,
            opacity: Math.max(0.34, 0.55 - 0.1 * k),
            zIndex: 2,
            duration: BEAT
          },
          at
        );

        // Everything still in the deck shuffles forward exactly one slot.
        for (let j = k + 1; j < cardEls.length; j++) {
          const slot = slots[j - (k + 1)] ?? slots[0];
          timeline.to(
            cardEls[j],
            {
              x: slot.x,
              y: slot.y,
              z: slot.z,
              scale: slot.scale,
              rotateY: slot.rot,
              skewY: slot.skew,
              opacity: slot.op,
              zIndex: slot.zIndex,
              duration: BEAT
            },
            at
          );
        }
      }

      // Breathing room so the final card settles before the stage releases.
      timeline.to({}, { duration: TAIL }, (cardEls.length - 1) * BEAT);

      /* The continuous sentence rides the SAME timeline, so the typography
         cannot fall out of step with the deck. */
      const flow = flowRef.current;
      if (flow) {
        timeline.to(
          flow,
          {
            x: () =>
              -Math.max(
                flow.scrollWidth - window.innerWidth + 160,
                window.innerWidth * 0.7
              ),
            ease: 'none',
            duration: TOTAL
          },
          0
        );
      }
    };

    /**
     * Deferred init: allow the DOM to finish rendering and webfonts to settle
     * before anything is measured. Two frames is enough for layout to be
     * committed and keeps mount cost trivial.
     */
    const init = () => {
      if (cancelled) return;
      if (deck.children.length === 0) return;

      const ctx = gsap.context(() => {
        section.classList.add('story-motion');

        mediaMatcher = gsap.matchMedia();

        // Every breakpoint gets the pinned, scrubbed, 3D story. Gating this to a
        // desktop-only query is what previously hid the effect on scaled
        // Windows laptops (125-150% scaling reports a narrower viewport), on
        // tablets and on phones.
        mediaMatcher.add(
          { desktop: '(min-width: 992px) and (prefers-reduced-motion: no-preference)' },
          () => buildStory(DECK_PRESETS.desktop)
        );
        mediaMatcher.add(
          {
            tablet:
              '(min-width: 720px) and (max-width: 991px) and (prefers-reduced-motion: no-preference)'
          },
          () => buildStory(DECK_PRESETS.tablet)
        );
        mediaMatcher.add(
          { mobile: '(max-width: 719px) and (prefers-reduced-motion: no-preference)' },
          () => buildStory(DECK_PRESETS.mobile)
        );

        // Reduced motion: no pinning, no scrubbing, no horizontal travel, and a
        // readable stacked layout instead of a half-built deck.
        mediaMatcher.add(
          { reduce: '(prefers-reduced-motion: reduce)' },
          () => {
            section.classList.remove('story-motion');
            section.classList.add('story-static');
            return () => section.classList.remove('story-static');
          }
        );
      }, section);

      revertContext = () => {
        if (mediaMatcher) {
          mediaMatcher.revert();
          mediaMatcher = null;
        }
        ctx.revert();
      };

      ScrollTrigger.refresh();

      // Webfonts change the rendered width of the sentence.
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
          if (!cancelled) ScrollTrigger.refresh();
        });
      }
    };

    rafOuter = requestAnimationFrame(() => {
      rafInner = requestAnimationFrame(init);
    });

    return () => {
      // Strict Mode and HMR both mount and unmount this effect, so every
      // animation and trigger must be reclaimed here. No orphans, no doubles.
      cancelled = true;
      cancelAnimationFrame(rafOuter);
      cancelAnimationFrame(rafInner);
      if (revertContext) revertContext();
    };
    // The story is built once per mount on purpose: re-running this on every
    // children change would rebuild and re-pin the stage mid-read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section ref={sectionRef} className={`relative w-full ${className}`}>
      {/* The pinned stage. Locked to the viewport so ScrollTrigger can pin it
          without ever clipping the deck or the sentence. */}
      <div
        ref={stageRef}
        className="sticky-stage relative flex h-[100dvh] min-h-[560px] w-full flex-col justify-center overflow-hidden"
      >
        <div className="mx-auto grid w-full max-w-[1240px] grid-cols-1 items-center gap-6 px-6 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
          {/* Story rail: headline, journey line and beat navigation */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-700/20 bg-cyan-500/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-800">
              <span className="h-2 w-2 rounded-full bg-cyan-500" />
              Interactive Card Deck &bull; Real Chat Experience
            </span>

            <h2 className="mt-3 font-serif text-[clamp(26px,3.1vw,46px)] leading-[1.05] tracking-tight">
              Talk Freely, <span className="italic">Vanish Completely</span>
            </h2>

            <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-slate-600">
              Scroll to peel through real campus conversations. Cards stack over one
              another while the journey line draws and the sentence travels with them.
            </p>

            <div className="mt-5 flex gap-4">
              {/* The progressive journey line. Its length is measured at runtime
                  and its dash offset is driven by the master timeline. */}
              <svg
                className="w-[34px] shrink-0 self-stretch"
                viewBox="0 0 34 320"
                fill="none"
                aria-hidden="true"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="cardSwapJourney" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0e7490" />
                    <stop offset="50%" stopColor="#21d2ed" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
                <path
                  d="M17 16C17 90 17 120 17 190S17 280 17 304"
                  stroke="rgba(14,116,144,0.15)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path
                  ref={journeyPathRef}
                  d="M17 16C17 90 17 120 17 190S17 280 17 304"
                  stroke="url(#cardSwapJourney)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>

              <ol className="flex flex-col gap-1.5">
                {beatLabels.map((label, i) => (
                  <li key={label}>
                    <button
                      type="button"
                      onClick={() => scrollToBeat(i)}
                      aria-current={activeBeat === i}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left transition-colors duration-300 ${
                        activeBeat === i
                          ? 'bg-cyan-500/10 font-semibold text-cyan-800'
                          : 'text-slate-500 hover:bg-slate-500/5'
                      }`}
                    >
                      <span className="font-mono text-xs font-bold tracking-wider">
                        0{i + 1}
                      </span>
                      <span className="text-sm">{label}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* 3D card deck. The aspect ratio mirrors the real 938x906 chat
              captures, so object-contain fills the frame with no letterboxing
              and no cropping of actual conversation content. */}
          <div className="flex items-center justify-center [perspective:1400px]">
            <div
              ref={deckRef}
              className="card-swap-deck relative aspect-[938/906] w-[clamp(200px,min(38vw,52dvh),460px)] max-w-full [transform-style:preserve-3d]"
              style={deckSize}
            >
              {cardList.map((child, idx) => (
                <div
                  key={idx}
                  data-swap-card={idx}
                  // No overlay sits above the deck, so clicks reach the card.
                  className="absolute inset-0 cursor-pointer [transform-style:preserve-3d] [will-change:transform,opacity]"
                  onClick={() => onCardClick?.(idx)}
                >
                  {child}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* One continuous horizontal sentence, not a deck of slides. */}
        <div className="journey-ribbon-band relative mt-6 w-full overflow-hidden border-t border-slate-200/70 py-4">
          {/* The readable copy. This is always real text in the DOM, so no
              essential content depends on the animation running. */}
          <p className="journey-sentence-static mx-auto max-w-[62ch] px-6 text-center font-serif text-[clamp(19px,2.1vw,28px)] leading-relaxed">
            In every late-night silence, discover the undeniable freedom of sharing pure
            honest thoughts that brings classmates together &mdash; without leaving a
            single trace.
          </p>

          {/* The travelling layer. aria-hidden, because the sentence above
              already carries the same words for assistive technology. */}
          <div
            ref={flowRef}
            aria-hidden="true"
            className="journey-ribbon-track w-max items-center whitespace-nowrap pl-[4vw] [will-change:transform]"
          >
            {JOURNEY_FLOW.map((node, i) => {
              if (node.kind === 'phrase') {
                return (
                  <span
                    key={i}
                    style={{ marginLeft: node.lead }}
                    className={`font-serif text-[clamp(23px,2.6vw,38px)] leading-tight tracking-tight ${
                      node.accent ? 'italic text-cyan-700' : ''
                    }`}
                  >
                    {node.text}
                  </span>
                );
              }

              if (node.kind === 'link') {
                return (
                  <span
                    key={i}
                    style={{ marginLeft: node.lead, width: node.width }}
                    className="inline-flex shrink-0 items-center text-cyan-700 opacity-45"
                  >
                    <svg
                      viewBox="0 0 40 14"
                      fill="none"
                      className="h-[14px] w-full overflow-visible"
                      stroke="currentColor"
                      strokeWidth={1.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={node.glyph === 'dash' ? '1 5' : undefined}
                    >
                      {node.glyph === 'dots' ? (
                        <>
                          <circle cx="6" cy="7" r="1.9" fill="currentColor" stroke="none" />
                          <circle cx="17" cy="7" r="1.9" fill="currentColor" stroke="none" />
                          <circle cx="28" cy="7" r="1.9" fill="currentColor" stroke="none" />
                        </>
                      ) : (
                        <path d={LINK_GLYPHS[node.glyph]} />
                      )}
                    </svg>
                  </span>
                );
              }

              return (
                <span
                  key={i}
                  style={{ marginLeft: node.lead }}
                  className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border bg-white px-4 py-[7px] text-[13.5px] font-semibold shadow-sm ${PILL_TONE[node.tone]}`}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {node.icon}
                  </svg>
                  {node.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CardSwap;