// ==========================================================================
// AnonChat School Work & Class Notes — Client Engine (Modular v2.0)
// Minimalist, Apple & Anthropic clean UI • Touch & Mobile Optimized
// ==========================================================================

(function() {
  'use strict';

  let state = {
    subjects: [],
    currentSubject: null,
    currentChapter: null,
    photos: [],
    lightboxIndex: 0,
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    startX: 0,
    startY: 0,
    touchStartX: 0,
    touchStartY: 0,
    touchDistStart: 0
  };

  // Expose public navigation functions for inline HTML handlers
  window.navigateToSubjects = navigateToSubjects;
  window.navigateToCurrentSubject = navigateToCurrentSubject;
  window.openSubject = openSubject;
  window.openChapter = openChapter;
  window.openLightbox = openLightbox;
  window.closeLightbox = closeLightbox;
  window.prevLightboxPhoto = prevLightboxPhoto;
  window.nextLightboxPhoto = nextLightboxPhoto;
  window.zoomLightbox = zoomLightbox;
  window.resetLightboxZoom = resetLightboxZoom;

  // Initialize
  async function init() {
    setupLightboxListeners();
    await loadSubjects();
  }

  // 1. Fetch & Render Subjects
  async function loadSubjects() {
    try {
      const res = await fetch('/api/school-work/subjects');
      const data = await res.json();
      if (data.success && Array.isArray(data.subjects)) {
        state.subjects = data.subjects;
        renderSubjectsGrid(data.subjects);
      }
    } catch (err) {
      console.error('Failed to load subjects:', err);
      const grid = document.getElementById('subjectsGrid');
      if (grid) {
        grid.innerHTML = `
          <div class="sw-empty-state">
            <div class="sw-empty-title">Failed to load subjects</div>
            <p class="sw-empty-desc">Check your network connection and reload.</p>
          </div>
        `;
      }
    }
  }

  function renderSubjectsGrid(subjects) {
    const grid = document.getElementById('subjectsGrid');
    if (!grid) return;

    if (!subjects || subjects.length === 0) {
      grid.innerHTML = `
        <div class="sw-empty-state">
          <div class="sw-empty-title">No Subjects Available</div>
          <p class="sw-empty-desc">Subjects will appear here once configured.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = subjects.map(s => {
      const chaptersLabel = s.chaptersCount === 1 ? '1 Chapter' : `${s.chaptersCount} Chapters`;
      const pagesLabel = s.totalPagesCount === 1 ? '1 Page' : `${s.totalPagesCount} Pages`;

      return `
        <div class="sw-subject-card" onclick="openSubject('${s.id}')" tabindex="0" role="button" onkeydown="if(event.key==='Enter') openSubject('${s.id}')">
          <div>
            <div class="sw-card-header">
              <span class="sw-code-badge">${escapeHtml(s.code || 'SUB')}</span>
              <span class="sw-category-tag">${escapeHtml(s.category || '')}</span>
            </div>
            <h2 class="sw-subject-name">${escapeHtml(s.name)}</h2>
            <p class="sw-subject-desc">${escapeHtml(s.description || '')}</p>
          </div>
          <div class="sw-card-footer">
            <span class="sw-stat-pill">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
              ${chaptersLabel}
            </span>
            <span class="sw-view-action">
              <span>View</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </span>
          </div>
        </div>
      `;
    }).join('');
  }

  // 2. Open Subject & Load Chapters
  async function openSubject(subjectId) {
    try {
      const res = await fetch(`/api/school-work/subject/${subjectId}`);
      const data = await res.json();
      if (data.success && data.subject) {
        state.currentSubject = data.subject;
        showView('viewChapters');

        // Breadcrumbs
        const c1 = document.getElementById('crumbSep1');
        const cSub = document.getElementById('crumbSubject');
        const c2 = document.getElementById('crumbSep2');
        const cCh = document.getElementById('crumbChapter');
        const cAll = document.getElementById('crumbSubjects');

        if (c1) c1.style.display = 'inline';
        if (cSub) {
          cSub.style.display = 'inline';
          cSub.textContent = data.subject.name;
          cSub.classList.add('active');
        }
        if (c2) c2.style.display = 'none';
        if (cCh) cCh.style.display = 'none';
        if (cAll) cAll.classList.remove('active');

        // Header info
        const codeEl = document.getElementById('currentSubjectCode');
        const nameEl = document.getElementById('currentSubjectName');
        const descEl = document.getElementById('currentSubjectDesc');
        if (codeEl) codeEl.textContent = data.subject.code || 'SUB';
        if (nameEl) nameEl.textContent = data.subject.name;
        if (descEl) descEl.textContent = data.subject.description || '';

        renderChaptersList(data.subject.chapters || []);
      }
    } catch (err) {
      console.error('Failed to open subject:', err);
    }
  }

  function renderChaptersList(chapters) {
    const list = document.getElementById('chaptersList');
    if (!list) return;

    if (!chapters || chapters.length === 0) {
      list.innerHTML = `
        <div class="sw-empty-state">
          <svg class="sw-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <div class="sw-empty-title">No Chapters Added Yet</div>
          <p class="sw-empty-desc">Notes have not been uploaded for this subject yet. The administrator can create chapters from the admin panel.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = chapters.map(ch => {
      const pagesLabel = ch.pagesCount === 1 ? '1 Page' : `${ch.pagesCount} Pages`;
      const numFormatted = String(ch.chapterNumber).padStart(2, '0');

      return `
        <div class="sw-chapter-card" onclick="openChapter('${state.currentSubject.id}', '${ch.id}')" tabindex="0" role="button" onkeydown="if(event.key==='Enter') openChapter('${state.currentSubject.id}', '${ch.id}')">
          <div class="sw-chapter-left">
            <span class="sw-chapter-num-badge">CH.${numFormatted}</span>
            <div class="sw-chapter-info">
              <span class="sw-chapter-title">${escapeHtml(ch.title)}</span>
              <span class="sw-chapter-meta">
                <span>Chapter ${ch.chapterNumber}</span>
                <span>•</span>
                <span>${pagesLabel}</span>
              </span>
            </div>
          </div>
          <div class="sw-chapter-right">
            <span class="sw-pages-pill">${pagesLabel}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </div>
      `;
    }).join('');
  }

  // 3. Open Chapter & Load Notes Photos
  async function openChapter(subjectId, chapterId) {
    try {
      const res = await fetch(`/api/school-work/chapter/${subjectId}/${chapterId}`);
      const data = await res.json();
      if (data.success && data.chapter) {
        state.currentChapter = data.chapter;
        state.photos = data.chapter.photos || [];
        showView('viewNotes');

        // Breadcrumbs
        const c2 = document.getElementById('crumbSep2');
        const cCh = document.getElementById('crumbChapter');
        const cSub = document.getElementById('crumbSubject');
        if (c2) c2.style.display = 'inline';
        if (cCh) {
          cCh.style.display = 'inline';
          cCh.textContent = `Chapter ${data.chapter.chapterNumber}`;
          cCh.classList.add('active');
        }
        if (cSub) cSub.classList.remove('active');

        // Header info
        const numFormatted = String(data.chapter.chapterNumber).padStart(2, '0');
        const badgeEl = document.getElementById('currentChapterBadge');
        const titleEl = document.getElementById('currentChapterTitle');
        const countEl = document.getElementById('currentChapterPagesCount');

        if (badgeEl) badgeEl.textContent = `CH.${numFormatted}`;
        if (titleEl) titleEl.textContent = data.chapter.title;
        if (countEl) {
          const count = state.photos.length;
          countEl.textContent = count === 1 ? '1 note page available' : `${count} note pages available`;
        }

        renderPhotosGrid(state.photos);
      }
    } catch (err) {
      console.error('Failed to open chapter:', err);
    }
  }

  function renderPhotosGrid(photos) {
    const grid = document.getElementById('photosGrid');
    if (!grid) return;

    if (!photos || photos.length === 0) {
      grid.innerHTML = `
        <div class="sw-empty-state" style="grid-column: 1 / -1;">
          <svg class="sw-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <div class="sw-empty-title">No Notes Uploaded</div>
          <p class="sw-empty-desc">This chapter folder is ready, but no photos have been uploaded yet. Upload images via the admin panel.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = photos.map((p, idx) => {
      const numFormatted = String(p.pageNumber || idx + 1).padStart(2, '0');
      return `
        <div class="sw-photo-card" onclick="openLightbox(${idx})" tabindex="0" role="button" onkeydown="if(event.key==='Enter') openLightbox(${idx})">
          <div class="sw-photo-thumb-wrap">
            <img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.title || 'Page ' + numFormatted)}" class="sw-photo-thumb" loading="lazy" />
            <div class="sw-photo-overlay">
              <span class="sw-zoom-icon-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  <line x1="11" y1="8" x2="11" y2="14"></line>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
                <span>Zoom Note</span>
              </span>
            </div>
          </div>
          <div class="sw-photo-info">
            <span class="sw-photo-page-label">PG.${numFormatted}</span>
            <span class="sw-photo-title" title="${escapeHtml(p.title || '')}">${escapeHtml(p.title || `Page ${numFormatted}`)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // 4. View Switching Navigation
  function showView(viewId) {
    document.querySelectorAll('.sw-view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function navigateToSubjects() {
    state.currentSubject = null;
    state.currentChapter = null;
    showView('viewSubjects');

    const cAll = document.getElementById('crumbSubjects');
    const c1 = document.getElementById('crumbSep1');
    const cSub = document.getElementById('crumbSubject');
    const c2 = document.getElementById('crumbSep2');
    const cCh = document.getElementById('crumbChapter');

    if (cAll) cAll.classList.add('active');
    if (c1) c1.style.display = 'none';
    if (cSub) cSub.style.display = 'none';
    if (c2) c2.style.display = 'none';
    if (cCh) cCh.style.display = 'none';

    loadSubjects();
  }

  function navigateToCurrentSubject() {
    if (state.currentSubject) {
      openSubject(state.currentSubject.id);
    } else {
      navigateToSubjects();
    }
  }

  // 5. Fullscreen Lightbox & Touch Engine
  function openLightbox(index) {
    if (!state.photos || state.photos.length === 0) return;
    state.lightboxIndex = index;
    resetLightboxZoom();

    const modal = document.getElementById('lightboxModal');
    if (modal) {
      modal.classList.add('active');
      updateLightboxContent();
    }
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    const modal = document.getElementById('lightboxModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
    resetLightboxZoom();
  }

  function updateLightboxContent() {
    const photo = state.photos[state.lightboxIndex];
    if (!photo) return;

    const total = state.photos.length;
    const counter = document.getElementById('lbCounter');
    const title = document.getElementById('lbTitle');
    const img = document.getElementById('lbImage');
    const downloadBtn = document.getElementById('lbDownloadBtn');

    if (counter) counter.textContent = `${state.lightboxIndex + 1} / ${total}`;
    if (title) title.textContent = photo.title || `Page ${state.lightboxIndex + 1}`;
    if (img) img.src = photo.url;
    if (downloadBtn) {
      downloadBtn.href = photo.url;
      downloadBtn.setAttribute('download', photo.filename || `note_page_${state.lightboxIndex + 1}.jpg`);
    }

    resetLightboxZoom();
  }

  function prevLightboxPhoto() {
    if (state.lightboxIndex > 0) {
      state.lightboxIndex--;
      updateLightboxContent();
    } else if (state.photos.length > 1) {
      state.lightboxIndex = state.photos.length - 1;
      updateLightboxContent();
    }
  }

  function nextLightboxPhoto() {
    if (state.lightboxIndex < state.photos.length - 1) {
      state.lightboxIndex++;
      updateLightboxContent();
    } else if (state.photos.length > 1) {
      state.lightboxIndex = 0;
      updateLightboxContent();
    }
  }

  function zoomLightbox(delta) {
    state.zoom = Math.max(0.75, Math.min(4.0, state.zoom + delta));
    applyLightboxTransform();
  }

  function resetLightboxZoom() {
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    applyLightboxTransform();
  }

  function applyLightboxTransform() {
    const wrap = document.getElementById('lbImgWrap');
    const zoomVal = document.getElementById('lbZoomVal');
    if (wrap) {
      wrap.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
    }
    if (zoomVal) {
      zoomVal.textContent = `${Math.round(state.zoom * 100)}%`;
    }
  }

  // Setup Lightbox Listeners (Mouse + Touch Swipe + Pinch)
  function setupLightboxListeners() {
    const lbStage = document.getElementById('lbStage');
    const lbWrap = document.getElementById('lbImgWrap');
    if (!lbStage || !lbWrap) return;

    // Mouse drag pan
    lbStage.addEventListener('mousedown', (e) => {
      if (state.zoom > 1) {
        state.isPanning = true;
        state.startX = e.clientX - state.panX;
        state.startY = e.clientY - state.panY;
        lbWrap.classList.add('panning');
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (state.isPanning) {
        state.panX = e.clientX - state.startX;
        state.panY = e.clientY - state.startY;
        applyLightboxTransform();
      }
    });

    window.addEventListener('mouseup', () => {
      state.isPanning = false;
      lbWrap.classList.remove('panning');
    });

    // Touch Swipe & Pinch-Zoom for Mobile
    lbStage.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        state.touchStartX = e.touches[0].clientX;
        state.touchStartY = e.touches[0].clientY;
        if (state.zoom > 1) {
          state.isPanning = true;
          state.startX = e.touches[0].clientX - state.panX;
          state.startY = e.touches[0].clientY - state.panY;
        }
      } else if (e.touches.length === 2) {
        state.touchDistStart = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    lbStage.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && state.zoom > 1 && state.isPanning) {
        state.panX = e.touches[0].clientX - state.startX;
        state.panY = e.touches[0].clientY - state.startY;
        applyLightboxTransform();
      } else if (e.touches.length === 2 && state.touchDistStart > 0) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = dist / state.touchDistStart;
        state.zoom = Math.max(0.75, Math.min(4.0, state.zoom * factor));
        state.touchDistStart = dist;
        applyLightboxTransform();
      }
    }, { passive: true });

    lbStage.addEventListener('touchend', (e) => {
      if (state.isPanning) {
        state.isPanning = false;
      }
      if (e.changedTouches.length === 1 && state.zoom === 1) {
        const deltaX = e.changedTouches[0].clientX - state.touchStartX;
        const deltaY = e.changedTouches[0].clientY - state.touchStartY;
        // Horizontal swipe detected
        if (Math.abs(deltaX) > 60 && Math.abs(deltaY) < 50) {
          if (deltaX < 0) nextLightboxPhoto();
          else prevLightboxPhoto();
        }
      }
      state.touchDistStart = 0;
    }, { passive: true });

    // Wheel zoom
    lbStage.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.2 : -0.2;
      zoomLightbox(delta);
    }, { passive: false });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      const modal = document.getElementById('lightboxModal');
      if (!modal || !modal.classList.contains('active')) return;

      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') prevLightboxPhoto();
      else if (e.key === 'ArrowRight') nextLightboxPhoto();
      else if (e.key === '+' || e.key === '=') zoomLightbox(0.25);
      else if (e.key === '-' || e.key === '_') zoomLightbox(-0.25);
      else if (e.key === '0') resetLightboxZoom();
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  window.addEventListener('DOMContentLoaded', init);
})();
