'use strict';

// -----------------------------------------------------
// プログラム名：fuwaimg
// バージョン：2.0.0
// 製作者：ガタガタ（https://do.gt-gt.org/）
// 公開日：2020.11.20
// 修正日：2026.10.11
//
// このプログラムは使用・改変・再配布・販売すべて自由です。
// 報告やリンクなども必要ありません。
// ただし、利用にあたりこの注意書きは削除しないでください。
// また、あたかもプログラムを自作したかのように誤解させる言動はお控えください。
// -----------------------------------------------------

(() => {
  'use strict';

  function initialize() {
    if (document.getElementById('fuwaimg')) return;

    const modal = document.createElement('div');
    modal.id = 'fuwaimg';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', '画像ビューアー');
    modal.tabIndex = -1;
    const icon = path => `<svg class="fuwaimg_icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${path}" /></svg>`;
    modal.innerHTML = `
      <div id="fuwaimg_mask"></div>
      <div id="fuwaimg_inner">
        <div id="fuwaimg_img">
          <div id="fuwaimg_imginner"></div>
          <p id="fuwaimg_loading" role="status" aria-live="polite"></p>
        </div>
        <button id="fuwaimg_prev" type="button" aria-label="前の画像">${icon('M15 5l-7 7 7 7')}</button>
        <button id="fuwaimg_next" type="button" aria-label="次の画像">${icon('M9 5l7 7-7 7')}</button>
        <div id="fuwaimg_caption">
          <p id="fuwaimg_caption_text"></p>
          <span id="fuwaimg_count" aria-live="polite"></span>
          <div id="fuwaimg_tools">
            <button id="fuwaimg_zoomout" type="button" aria-label="縮小">${icon('M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13M15.1 15.1L21 21M7.5 10.5h6')}</button>
            <button id="fuwaimg_zoom" type="button" aria-label="拡大">${icon('M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13M15.1 15.1L21 21M7.5 10.5h6M10.5 7.5v6')}</button>
            <button id="fuwaimg_close" type="button" aria-label="閉じる">${icon('M6 6l12 12M18 6L6 18')}</button>
          </div>
        </div>
      </div>`;
    document.body.append(modal);

    const get = id => modal.querySelector(`#fuwaimg_${id}`);
    const viewport = get('img');
    const content = get('imginner');
    const status = get('loading');
    const caption = get('caption_text');
    const previous = get('prev');
    const next = get('next');
    const zoomIn = get('zoom');
    const zoomOut = get('zoomout');
    const pointers = new Map();
    const state = {
      items: [], index: 0, image: null, ready: false, zoomable: true, rtl: false,
      scale: 1, maxScale: 1, x: 0, y: 0, width: 0, height: 0,
      request: 0, gesture: null, opener: null, overflow: '', siblings: [],
    };
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    // Every gesture uses the same fitted-image coordinates and bounded transform.
    function render() {
      const maxX = Math.max(0, (state.width * state.scale - viewport.clientWidth) / 2);
      const maxY = Math.max(0, (state.height * state.scale - viewport.clientHeight) / 2);
      state.x = clamp(state.x, -maxX, maxX);
      state.y = clamp(state.y, -maxY, maxY);
      if (state.image) {
        state.image.style.width = `${state.width}px`;
        state.image.style.height = `${state.height}px`;
        state.image.style.transform = `translate(-50%, -50%) translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
      }
      viewport.classList.toggle('zoom_in', state.scale > 1);
      zoomIn.disabled = !state.ready || state.scale >= state.maxScale;
      zoomOut.disabled = !state.ready || state.scale <= 1;
    }

    function fit() {
      if (!state.ready) return;
      const ratio = Math.min(1, viewport.clientWidth / state.image.naturalWidth,
        viewport.clientHeight / state.image.naturalHeight);
      state.width = state.image.naturalWidth * ratio;
      state.height = state.image.naturalHeight * ratio;
      state.maxScale = 1 / ratio;
      state.scale = clamp(state.scale, 1, state.maxScale);
      render();
    }

    function reset() {
      state.scale = 1;
      state.x = state.y = 0;
      render();
    }

    function zoom(value, clientX, clientY) {
      if (!state.ready || !state.zoomable) return;
      const rect = viewport.getBoundingClientRect();
      const x = clientX == null ? 0 : clientX - rect.left - rect.width / 2;
      const y = clientY == null ? 0 : clientY - rect.top - rect.height / 2;
      const scale = clamp(value, 1, state.maxScale);
      const ratio = scale / state.scale;
      state.x = x - (x - state.x) * ratio;
      state.y = y - (y - state.y) * ratio;
      state.scale = scale;
      render();
    }

    function clearGesture() {
      for (const id of pointers.keys()) {
        if (viewport.hasPointerCapture(id)) viewport.releasePointerCapture(id);
      }
      pointers.clear();
      state.gesture = null;
      viewport.classList.remove('dragging');
    }

    function show(index) {
      if (index < 0 || index >= state.items.length) return;
      clearGesture();
      state.index = index;
      state.ready = false;
      state.image = null;
      reset();
      const link = state.items[index];
      state.zoomable = link.dataset.fzoom !== 'false';
      caption.textContent = link.dataset.fcaption || '';
      get('count').textContent = state.items.length > 1 ? `${index + 1} / ${state.items.length}` : '';
      previous.hidden = index === 0;
      next.hidden = index === state.items.length - 1;
      for (const button of [zoomIn, zoomOut]) button.hidden = !state.zoomable;
      content.replaceChildren();
      status.hidden = false;
      status.textContent = '読み込み中…';
      viewport.setAttribute('aria-busy', 'true');
      const request = ++state.request;
      const image = new Image();
      image.id = 'fuwaimg-showimg';
      image.alt = link.querySelector('img')?.alt || link.dataset.fcaption || '';
      image.draggable = false;
      image.onload = () => {
        if (request !== state.request || modal.hidden) return;
        state.image = image;
        state.ready = true;
        content.replaceChildren(image);
        status.hidden = true;
        viewport.setAttribute('aria-busy', 'false');
        fit();
      };
      image.onerror = () => {
        if (request !== state.request || modal.hidden) return;
        status.textContent = '画像を読み込めませんでした。';
        viewport.setAttribute('aria-busy', 'false');
      };
      image.src = link.href;
      // Image changes must not leave keyboard focus on a hidden control.
      if (modal.contains(document.activeElement) &&
          (document.activeElement.hidden || document.activeElement.disabled)) get('close').focus();
    }

    function open(link) {
      if (modal.hidden) {
        state.opener = link;
        state.overflow = document.body.style.overflow;
        state.siblings = Array.from(document.body.children)
          .filter(element => element !== modal)
          .map(element => [element, element.inert]);
        for (const [element] of state.siblings) element.inert = true;
        document.body.style.overflow = 'hidden';
        modal.hidden = false;
      }
      const group = link.dataset.fimg;
      state.items = group === undefined ? [link] :
        Array.from(document.querySelectorAll('a.fuwaimg[href]'))
          .filter(item => item.dataset.fimg === group);
      // The opening link overrides the group's first explicit reading direction.
      const direction = link.dataset.fpage ?? state.items.find(item => item.dataset.fpage)?.dataset.fpage;
      state.rtl = direction === 'rtl';
      modal.classList.toggle('fuwaimg_rtl', state.rtl);
      show(state.items.indexOf(link));
      get('close').focus({ preventScroll: true });
    }

    function close() {
      if (modal.hidden) return;
      ++state.request;
      clearGesture();
      modal.hidden = true;
      content.replaceChildren();
      state.image = null;
      state.ready = false;
      document.body.style.overflow = state.overflow;
      for (const [element, inert] of state.siblings) element.inert = inert;
      state.siblings = [];
      if (state.opener?.isConnected) state.opener.focus({ preventScroll: true });
    }

    // Delegation also supports links added after the script has initialized.
    document.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest('a.fuwaimg[href]');
      if (!link) return;
      event.preventDefault();
      open(link);
    });
    get('mask').addEventListener('click', close);
    get('close').addEventListener('click', close);
    previous.addEventListener('click', () => show(state.index - 1));
    next.addEventListener('click', () => show(state.index + 1));
    zoomIn.addEventListener('click', () => zoom(state.scale * 1.5));
    zoomOut.addEventListener('click', () => zoom(state.scale / 1.5));
    viewport.addEventListener('dblclick', event => {
      if (state.scale > 1) reset();
      else zoom(2, event.clientX, event.clientY);
    });
    viewport.addEventListener('wheel', event => {
      if (!state.ready || !state.zoomable) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
      zoom(state.scale * Math.exp(-clamp(delta, -100, 100) * 0.003), event.clientX, event.clientY);
    }, { passive: false });

    function beginGesture() {
      const points = Array.from(pointers.values());
      if (points.length >= 2) {
        const [a, b] = points;
        const rect = viewport.getBoundingClientRect();
        state.gesture = { type: 'pinch', scale: state.scale,
          distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
          anchorX: ((a.x + b.x) / 2 - rect.left - rect.width / 2 - state.x) / state.scale,
          anchorY: ((a.y + b.y) / 2 - rect.top - rect.height / 2 - state.y) / state.scale };
      } else if (points.length === 1) {
        state.gesture = { type: state.scale > 1 ? 'pan' : 'swipe',
          start: points[0], x: state.x, y: state.y };
      } else state.gesture = null;
    }

    viewport.addEventListener('pointerdown', event => {
      if (!state.ready || event.button !== 0) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add('dragging');
      beginGesture();
    });
    viewport.addEventListener('pointermove', event => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const gesture = state.gesture;
      if (!gesture) return;
      const points = Array.from(pointers.values());
      if (gesture.type === 'pinch' && state.zoomable) {
        const [a, b] = points;
        const rect = viewport.getBoundingClientRect();
        state.scale = clamp(gesture.scale * Math.hypot(b.x - a.x, b.y - a.y) / gesture.distance, 1, state.maxScale);
        state.x = (a.x + b.x) / 2 - rect.left - rect.width / 2 - gesture.anchorX * state.scale;
        state.y = (a.y + b.y) / 2 - rect.top - rect.height / 2 - gesture.anchorY * state.scale;
        render();
      } else if (gesture.type === 'pan') {
        state.x = gesture.x + points[0].x - gesture.start.x;
        state.y = gesture.y + points[0].y - gesture.start.y;
        render();
      }
    });
    function endPointer(event) {
      if (!pointers.has(event.pointerId)) return;
      const gesture = state.gesture;
      const last = pointers.get(event.pointerId);
      pointers.delete(event.pointerId);
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      if (event.type === 'pointerup' && gesture?.type === 'swipe' && pointers.size === 0) {
        const dx = last.x - gesture.start.x;
        const dy = last.y - gesture.start.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          show(state.index + (dx < 0 ? 1 : -1) * (state.rtl ? -1 : 1));
        }
      }
      // A remaining finger after a pinch pans; it never advances the gallery.
      beginGesture();
      if (gesture?.type === 'pinch' && state.gesture?.type === 'swipe') state.gesture.type = 'pan';
      if (!pointers.size) viewport.classList.remove('dragging');
    }
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) viewport.addEventListener(type, endPointer);

    document.addEventListener('keydown', event => {
      if (modal.hidden) return;
      if (event.key === 'Tab') {
        const buttons = Array.from(modal.querySelectorAll('button')).filter(button => !button.hidden && !button.disabled);
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && (document.activeElement === first || !buttons.includes(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !buttons.includes(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      switch (event.key) {
        case 'Escape': close(); break;
        case 'ArrowLeft': show(state.index + (state.rtl ? 1 : -1)); break;
        case 'ArrowRight': show(state.index + (state.rtl ? -1 : 1)); break;
        case '+': case '=': zoom(state.scale * 1.5); break;
        case '-': zoom(state.scale / 1.5); break;
        case '0': reset(); break;
        default: return;
      }
      event.preventDefault();
    });
    new ResizeObserver(() => {
      clearGesture();
      fit();
    }).observe(viewport);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
