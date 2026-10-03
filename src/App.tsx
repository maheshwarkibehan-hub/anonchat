import React, { useState } from 'react';
import CardSwap, { Card } from './components/CardSwapShowcase';

/* ==========================================================================
   Host app for the scroll-driven CardSwap story.

   NOTE FOR MAINTAINERS
   This file is not what the deployed site serves. /public/app-chat.html +
   editorial.css + fabale.js is the live implementation; the project ships no
   React bundler, so mounting this requires adding react, react-dom and a
   bundler. Every card below uses the real chat captures from /public.
   ========================================================================== */

interface Beat {
  /** Screen-reader caption, also used for the beat rail. */
  label: string;
  /** Real conversation capture from /public. */
  shot: string;
  alt: string;
  /** Corner tag, mirrors the overlay pill on the live cards. */
  tag: string;
  /** Real peer identity shown on the chat header. */
  peer: string;
  /** True for the headline capture that anchors the story. */
  live?: boolean;
}

const BEATS: Beat[] = [
  {
    label: 'Late Night Confessions',
    shot: 'chat-screenshot-real-1.png',
    alt: 'Late night confession conversation with quoted replies',
    tag: '01 · Late Night Confessions',
    peer: 'Stranger #4092',
    live: true
  },
  {
    label: '15s Ephemeral Audio Notes',
    shot: 'chat-screenshot-real-2.png',
    alt: 'Conversation using 15 second ephemeral voice notes',
    tag: '02 · 15s Audio Notes & View-Once',
    peer: 'Stranger #1877'
  },
  {
    label: '5s Self-Destruct Bombs',
    shot: 'chat-screenshot-real-3.png',
    alt: 'Conversation using 5 second self destruct messages',
    tag: '03 · 5s Self-Destruct Bombs',
    peer: 'Stranger #3310'
  },
  {
    label: 'Sub-10ms Matchmaking',
    shot: 'chat-screenshot-real-4.png',
    alt: 'Conversation with the 3 second skip grace protection',
    tag: '04 · 3s Skip Grace Protection',
    peer: 'Stranger #7754'
  }
];

export default function App() {
  const [openCard, setOpenCard] = useState<number | null>(null);

  return (
    <main className="min-h-screen bg-[#f1f7f6] font-sans text-slate-900 selection:bg-cyan-500/20">
      <header className="px-4 py-12 text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-cyan-600">
          AnonChat 2026 Engine
        </span>
        <h1 className="mt-2 font-serif text-4xl tracking-tight md:text-6xl">
          Stacking Cards &amp; Continuous Journey
        </h1>
      </header>

      <CardSwap
        beats={BEATS.map((b) => b.label)}
        onCardClick={(idx) => setOpenCard((current) => (current === idx ? null : idx))}
      >
        {BEATS.map((beat, idx) => (
          <Card
            key={beat.shot}
            customClass="ring-1 ring-slate-900/5"
            aria-label={`${beat.tag}, talking to ${beat.peer}`}
            aria-current={openCard === idx}
          >
            <figure className="relative h-full w-full bg-[#090b10]">
              {/* Real capture, contained so nothing is cropped or distorted. */}
              <img
                src={`/${beat.shot}`}
                alt={`${beat.alt}, ${beat.peer}`}
                className="h-full w-full object-contain"
                loading={idx === 0 ? 'eager' : 'lazy'}
                decoding="async"
                draggable={false}
              />

              <figcaption className="absolute right-3.5 top-3.5 flex items-center gap-2 rounded-full bg-slate-900/70 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-slate-100 backdrop-blur-sm">
                {beat.live && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                )}
                {beat.tag}
              </figcaption>

              <span className="absolute bottom-3.5 left-3.5 text-[11px] font-medium tracking-wide text-slate-300">
                {beat.peer}
              </span>
            </figure>
          </Card>
        ))}
      </CardSwap>
    </main>
  );
}