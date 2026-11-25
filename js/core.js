/**
 * ============================================================
 * ThumbStudio v2.0 Microkernel Core (PIXELIA / Font Awesome対応)
 * ============================================================
 */
const ThumbStudio = (() => {
  const stageWrap = document.getElementById('stage-wrap');
  const vpCanvas = document.getElementById('viewport');
  const vpCtx = vpCanvas.getContext('2d');

  // 内部状態
  const state = {
    width: 1000,
    height: 1000,
    bgColor: '#ffffff',
    zoom: 0.6,
    panX: 0,
    panY: 0,
    mode: 'select', // 'select' | 'pan'
    showGrid: false,
    objects: [],
    selectedIds: [],
    history: [],
    historyIndex: -1,
    guides: { x: null, y: null }
  };

  // レジストリ
  const plugins = new Map();
  const renderers = new Map();
  const propRenderers = new Map();
  const ctxBarRenderers = new Map();
  const dblClickHandlers = new Map();
  const overlayHooks = [];
  const layerIcons = new Map();

  let clipboard = [];
  let pasteCount = 0;
  let dragState = null;
  let isSpaceDown = false;

  const uid = () => 'obj_' + Math.random().toString(36).slice(2, 9);
  const getSelectedObjects = () => state.objects.filter(o => state.selectedIds.includes(o.id));
  const getSelected = () => getSelectedObjects()[0] || null;

  // --- 座標変換（スクリーン ⇔ アートボード） ---
  function screenToWorld(clientX, clientY) {
    const rect = vpCanvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - state.panX) / state.zoom,
      y: (clientY - rect.top - state.panY) / state.zoom
    };
  }
  function worldToScreen(wx, wy) {
    const rect = vpCanvas.getBoundingClientRect();
    return {
      x: rect.left + state.panX + wx * state.zoom,
      y: rect.top + state.panY + wy * state.zoom
    };
  }

  // --- ビューポートサイズ＆フィット ---
  function resizeViewport() {
    vpCanvas.width = stageWrap.clientWidth;
    vpCanvas.height = stageWrap.clientHeight;
    render();
  }

  function fitZoom() {
    const pad = 80;
    const availW = Math.max(100, stageWrap.clientWidth - pad);
    const availH = Math.max(100, stageWrap.clientHeight - pad);
    state.zoom = Math.max(0.1, Math.min(availW / state.width, availH / state.height, 1.5));
    state.panX = Math.round((stageWrap.clientWidth - state.width * state.zoom) / 2);
    state.panY = Math.round((stageWrap.clientHeight - state.height * state.zoom) / 2);
    updateStatus();
    render();
  }

  // --- 履歴管理 ---
  function pushHistory() {
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push({
      width: state.width,
      height: state.height,
      bgColor: state.bgColor,
      objects: state.objects.map(o => ({ ...o }))
    });
    if (state.history.length > 60) state.history.shift();
    state.historyIndex = state.history.length - 1;
  }

  function restoreHistory(idx) {
    if (idx < 0 || idx >= state.history.length) return;
    state.historyIndex = idx;
    const snap = state.history[idx];
    state.width = snap.width;
    state.height = snap.height;
    state.bgColor = snap.bgColor;
    state.objects = snap.objects.map(o => ({ ...o }));
    state.selectedIds = state.selectedIds.filter(id => state.objects.some(o => o.id === id));
    updateAllUI();
  }

  // --- オブジェクト単体描画（回転・影・不透明度を共通処理） ---
  function drawObject(ctx, obj) {
    const fn = renderers.get(obj.type);
    if (!fn) return;
    ctx.save();
    ctx.globalAlpha = obj.opacity ?? 1;

    // 共通ドロップシャドウ
    if (obj.shadowBlur > 0 || obj.shadowX || obj.shadowY) {
      ctx.shadowColor = obj.shadowColor || 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = obj.shadowBlur || 0;
      ctx.shadowOffsetX = obj.shadowX || 0;
      ctx.shadowOffsetY = obj.shadowY || 0;
    }

    // 中心基準で回転
    const cx = obj.x + obj.w / 2;
    const cy = obj.y + obj.h / 2;
    if (obj.rotation) {
      ctx.translate(cx, cy);
      ctx.rotate((obj.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    fn(ctx, obj, api);
    ctx.restore();
  }

  // --- メイン描画 ---
  function render() {
    const W = vpCanvas.width;
    const H = vpCanvas.height;
    vpCtx.clearRect(0, 0, W, H);

    vpCtx.save();
    vpCtx.translate(state.panX, state.panY);
    vpCtx.scale(state.zoom, state.zoom);

    // アートボード影＋背景
    vpCtx.save();
    vpCtx.shadowColor = 'rgba(0,0,0,0.5)';
    vpCtx.shadowBlur = 24 / state.zoom;
    vpCtx.shadowOffsetY = 8 / state.zoom;
    if (state.bgColor === 'transparent') {
      vpCtx.fillStyle = '#2c303a';
      vpCtx.fillRect(0, 0, state.width, state.height);
    } else {
      vpCtx.fillStyle = state.bgColor;
      vpCtx.fillRect(0, 0, state.width, state.height);
    }
    vpCtx.restore();

    // 全オブジェクト描画（ペーストボード外も見える）
    for (const obj of state.objects) {
      if (!obj.visible) continue;
      drawObject(vpCtx, obj);
    }

    // アートボード枠線
    vpCtx.strokeStyle = 'rgba(255,255,255,0.22)';
    vpCtx.lineWidth = 1 / state.zoom;
    vpCtx.strokeRect(0, 0, state.width, state.height);

    // オーバーレイフック（グリッド線など）
    for (const hook of overlayHooks) {
      vpCtx.save();
      hook(vpCtx, api);
      vpCtx.restore();
    }

    // スマートガイド
    if (state.guides.x !== null) {
      vpCtx.save();
      vpCtx.strokeStyle = '#ff4fd8';
      vpCtx.lineWidth = 1.5 / state.zoom;
      vpCtx.setLineDash([6 / state.zoom, 4 / state.zoom]);
      vpCtx.beginPath();
      vpCtx.moveTo(state.guides.x, -5000);
      vpCtx.lineTo(state.guides.x, 5000);
      vpCtx.stroke();
      vpCtx.restore();
    }
    if (state.guides.y !== null) {
      vpCtx.save();
      vpCtx.strokeStyle = '#ff4fd8';
      vpCtx.lineWidth = 1.5 / state.zoom;
      vpCtx.setLineDash([6 / state.zoom, 4 / state.zoom]);
      vpCtx.beginPath();
      vpCtx.moveTo(-5000, state.guides.y);
      vpCtx.lineTo(5000, state.guides.y);
      vpCtx.stroke();
      vpCtx.restore();
    }

    // 選択バウンディングボックス
    const sels = getSelectedObjects().filter(o => o.visible);
    const lw = 1.5 / state.zoom;
    const hs = 9 / state.zoom;

    for (const sel of sels) {
      vpCtx.save();
      const cx = sel.x + sel.w / 2;
      const cy = sel.y + sel.h / 2;
      if (sel.rotation) {
        vpCtx.translate(cx, cy);
        vpCtx.rotate((sel.rotation * Math.PI) / 180);
        vpCtx.translate(-cx, -cy);
      }
      vpCtx.strokeStyle = '#4f8cff';
      vpCtx.lineWidth = lw;
      vpCtx.strokeRect(sel.x, sel.y, sel.w, sel.h);

      // 単体選択かつロック解除時のみリサイズ＆回転ハンドル表示
      if (sels.length === 1 && !sel.locked) {
        const handles = [
          { x: sel.x, y: sel.y },
          { x: sel.x + sel.w, y: sel.y },
          { x: sel.x, y: sel.y + sel.h },
          { x: sel.x + sel.w, y: sel.y + sel.h }
        ];
        vpCtx.fillStyle = '#ffffff';
        for (const h of handles) {
          vpCtx.fillRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
          vpCtx.strokeRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
        }
        // 回転ハンドル（上中央から24px上）
        const rotDist = 24 / state.zoom;
        vpCtx.beginPath();
        vpCtx.moveTo(cx, sel.y);
        vpCtx.lineTo(cx, sel.y - rotDist);
        vpCtx.stroke();
        vpCtx.beginPath();
        vpCtx.arc(cx, sel.y - rotDist, hs * 0.55, 0, Math.PI * 2);
        vpCtx.fill();
        vpCtx.stroke();
      }
      vpCtx.restore();
    }

    // ラバーバンド範囲選択枠
    if (dragState && dragState.mode === 'marquee') {
      const m = dragState;
      vpCtx.save();
      vpCtx.fillStyle = 'rgba(79, 140, 255, 0.14)';
      vpCtx.strokeStyle = '#4f8cff';
      vpCtx.lineWidth = 1 / state.zoom;
      vpCtx.fillRect(m.x, m.y, m.w, m.h);
      vpCtx.strokeRect(m.x, m.y, m.w, m.h);
      vpCtx.restore();
    }

    vpCtx.restore();
  }

  // --- ヒット判定（回転考慮） ---
  function toLocalPoint(obj, wx, wy) {
    const cx = obj.x + obj.w / 2;
    const cy = obj.y + obj.h / 2;
    if (!obj.rotation) return { x: wx, y: wy };
    const rad = (-obj.rotation * Math.PI) / 180;
    const dx = wx - cx, dy = wy - cy;
    return {
      x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
      y: cy + dx * Math.sin(rad) + dy * Math.cos(rad)
    };
  }

  function hitTestObject(obj, wx, wy) {
    const p = toLocalPoint(obj, wx, wy);
    return p.x >= obj.x && p.x <= obj.x + obj.w && p.y >= obj.y && p.y <= obj.y + obj.h;
  }

  // --- マウス操作 ---
  vpCanvas.addEventListener('mousedown', (e) => {
    hideContextMenu();
    if (e.button === 2) return;

    // パン移動（Space押下 / 手のひらモード / 中クリック）
    if (isSpaceDown || state.mode === 'pan' || e.button === 1) {
      dragState = {
        mode: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        origPanX: state.panX,
        origPanY: state.panY
      };
      return;
    }

    const pos = screenToWorld(e.clientX, e.clientY);
    const sels = getSelectedObjects();

    // 1. 単体選択時の回転・リサイズハンドル判定
    if (sels.length === 1 && sels[0].visible && !sels[0].locked) {
      const sel = sels[0];
      const lp = toLocalPoint(sel, pos.x, pos.y);
      const tol = 12 / state.zoom;
      const rotY = sel.y - 24 / state.zoom;
      const cx = sel.x + sel.w / 2;

      if (Math.hypot(lp.x - cx, lp.y - rotY) <= tol) {
        dragState = {
          mode: 'rotate',
          obj: sel,
          cx,
          cy: sel.y + sel.h / 2
        };
        return;
      }
      const handles = [
        { id: 'nw', x: sel.x, y: sel.y },
        { id: 'ne', x: sel.x + sel.w, y: sel.y },
        { id: 'sw', x: sel.x, y: sel.y + sel.h },
        { id: 'se', x: sel.x + sel.w, y: sel.y + sel.h }
      ];
      for (const h of handles) {
        if (Math.abs(lp.x - h.x) <= tol && Math.abs(lp.y - h.y) <= tol) {
          dragState = {
            mode: 'resize',
            handle: h.id,
            obj: sel,
            startX: pos.x,
            startY: pos.y,
            orig: { x: sel.x, y: sel.y, w: sel.w, h: sel.h }
          };
          return;
        }
      }
    }

    // 2. オブジェクトヒット判定
    let hit = null;
    for (let i = state.objects.length - 1; i >= 0; i--) {
      const o = state.objects[i];
      if (!o.visible) continue;
      if (hitTestObject(o, pos.x, pos.y)) { hit = o; break; }
    }

    if (hit) {
      if (e.shiftKey) {
        if (state.selectedIds.includes(hit.id)) {
          state.selectedIds = state.selectedIds.filter(id => id !== hit.id);
        } else {
          state.selectedIds.push(hit.id);
        }
      } else if (!state.selectedIds.includes(hit.id)) {
        state.selectedIds = [hit.id];
      }

      // Alt+ドラッグでその場複製
      if (e.altKey) {
        const copies = [];
        for (const o of getSelectedObjects()) {
          if (o.locked) continue;
          const c = { ...o, id: uid() };
          state.objects.push(c);
          copies.push(c.id);
        }
        if (copies.length) state.selectedIds = copies;
      }

      updateAllUI();
      const movable = getSelectedObjects().filter(o => !o.locked);
      if (movable.length) {
        dragState = {
          mode: 'move',
          startX: pos.x,
          startY: pos.y,
          items: movable.map(o => ({ obj: o, origX: o.x, origY: o.y }))
        };
      }
    } else {
      // 空き領域ドラッグ → ラバーバンド範囲選択
      if (!e.shiftKey) state.selectedIds = [];
      updateAllUI();
      dragState = {
        mode: 'marquee',
        startX: pos.x,
        startY: pos.y,
        x: pos.x,
        y: pos.y,
        w: 0,
        h: 0
      };
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragState) return;
    if (dragState.mode === 'pan') {
      state.panX = dragState.origPanX + (e.clientX - dragState.startX);
      state.panY = dragState.origPanY + (e.clientY - dragState.startY);
      render();
      return;
    }

    const pos = screenToWorld(e.clientX, e.clientY);
    state.guides.x = null;
    state.guides.y = null;

    if (dragState.mode === 'move') {
      let dx = pos.x - dragState.startX;
      let dy = pos.y - dragState.startY;
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0;
      }

      // 強化スマートガイド（先頭選択オブジェクト基準）
      const primary = dragState.items[0];
      let nx = primary.origX + dx;
      let ny = primary.origY + dy;
      const snapTol = 8 / state.zoom;

      const snapX = [0, state.width / 2, state.width];
      const snapY = [0, state.height / 2, state.height];
      for (const o of state.objects) {
        if (!o.visible || state.selectedIds.includes(o.id)) continue;
        snapX.push(o.x, o.x + o.w / 2, o.x + o.w);
        snapY.push(o.y, o.y + o.h / 2, o.y + o.h);
      }

      const pw = primary.obj.w, ph = primary.obj.h;
      for (const tx of snapX) {
        if (Math.abs(nx - tx) < snapTol) { dx = tx - primary.origX; state.guides.x = tx; break; }
        if (Math.abs(nx + pw / 2 - tx) < snapTol) { dx = tx - pw / 2 - primary.origX; state.guides.x = tx; break; }
        if (Math.abs(nx + pw - tx) < snapTol) { dx = tx - pw - primary.origX; state.guides.x = tx; break; }
      }
      for (const ty of snapY) {
        if (Math.abs(ny - ty) < snapTol) { dy = ty - primary.origY; state.guides.y = ty; break; }
        if (Math.abs(ny + ph / 2 - ty) < snapTol) { dy = ty - ph / 2 - primary.origY; state.guides.y = ty; break; }
        if (Math.abs(ny + ph - ty) < snapTol) { dy = ty - ph - primary.origY; state.guides.y = ty; break; }
      }

      for (const it of dragState.items) {
        it.obj.x = Math.round(it.origX + dx);
        it.obj.y = Math.round(it.origY + dy);
      }
      updateStatus();
      render();
    } else if (dragState.mode === 'resize') {
      const o = dragState.obj;
      const orig = dragState.orig;
      const dx = pos.x - dragState.startX;
      const dy = pos.y - dragState.startY;
      const ratio = orig.w / Math.max(1, orig.h);
      let nx = orig.x, ny = orig.y, nw = orig.w, nh = orig.h;

      if (dragState.handle.includes('e')) nw = Math.max(10, orig.w + dx);
      if (dragState.handle.includes('s')) nh = Math.max(10, orig.h + dy);
      if (dragState.handle.includes('w')) { nw = Math.max(10, orig.w - dx); nx = orig.x + (orig.w - nw); }
      if (dragState.handle.includes('n')) { nh = Math.max(10, orig.h - dy); ny = orig.y + (orig.h - nh); }
      if (e.shiftKey) {
        nh = nw / ratio;
        if (dragState.handle.includes('n')) ny = orig.y + (orig.h - nh);
      }
      o.x = Math.round(nx); o.y = Math.round(ny);
      o.w = Math.round(nw); o.h = Math.round(nh);
      updateStatus();
      render();
    } else if (dragState.mode === 'rotate') {
      let deg = Math.atan2(pos.y - dragState.cy, pos.x - dragState.cx) * (180 / Math.PI) + 90;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      dragState.obj.rotation = Math.round(deg);
      updateStatus();
      render();
    } else if (dragState.mode === 'marquee') {
      dragState.x = Math.min(dragState.startX, pos.x);
      dragState.y = Math.min(dragState.startY, pos.y);
      dragState.w = Math.abs(pos.x - dragState.startX);
      dragState.h = Math.abs(pos.y - dragState.startY);
      render();
    }
  });

  window.addEventListener('mouseup', () => {
    if (!dragState) return;
    if (dragState.mode === 'marquee') {
      const m = dragState;
      if (m.w > 4 || m.h > 4) {
        const hitIds = state.objects
          .filter(o => o.visible && o.x + o.w >= m.x && o.x <= m.x + m.w && o.y + o.h >= m.y && o.y <= m.y + m.h)
          .map(o => o.id);
        state.selectedIds = hitIds;
      }
      dragState = null;
      updateAllUI();
      return;
    }
    const changed = ['move', 'resize', 'rotate'].includes(dragState.mode);
    state.guides.x = null;
    state.guides.y = null;
    dragState = null;
    if (changed) {
      pushHistory();
      renderProperties();
    }
    render();
  });

  // ダブルクリック（インライン編集など）
  vpCanvas.addEventListener('dblclick', (e) => {
    const pos = screenToWorld(e.clientX, e.clientY);
    for (let i = state.objects.length - 1; i >= 0; i--) {
      const o = state.objects[i];
      if (!o.visible || o.locked) continue;
      if (hitTestObject(o, pos.x, pos.y)) {
        const handler = dblClickHandlers.get(o.type);
        if (handler) handler(o, api);
        break;
      }
    }
  });

  // Ctrl + ホイールズーム（カーソル位置基準）
  stageWrap.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const rect = vpCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const newZoom = Math.max(0.1, Math.min(4, state.zoom * factor));
    state.panX = mx - (mx - state.panX) * (newZoom / state.zoom);
    state.panY = my - (my - state.panY) * (newZoom / state.zoom);
    state.zoom = newZoom;
    updateStatus();
    render();
  }, { passive: false });

  // --- 右クリックメニュー ---
  const ctxMenu = document.getElementById('context-menu');
  function hideContextMenu() { ctxMenu.style.display = 'none'; }

  vpCanvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    ctxMenu.style.left = Math.min(e.clientX, window.innerWidth - 180) + 'px';
    ctxMenu.style.top = Math.min(e.clientY, window.innerHeight - 240) + 'px';
    ctxMenu.style.display = 'flex';
  });

  ctxMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const cmd = btn.dataset.cmd;
    hideContextMenu();
    if (cmd === 'copy') api.copySelected();
    if (cmd === 'paste') api.pasteClipboard(20);
    if (cmd === 'pasteInPlace') api.pasteClipboard(0);
    if (cmd === 'dup') api.duplicateSelected();
    if (cmd === 'front') api.reorderSelected('front');
    if (cmd === 'back') api.reorderSelected('back');
    if (cmd === 'lock') {
      getSelectedObjects().forEach(o => o.locked = !o.locked);
      pushHistory(); updateAllUI();
    }
    if (cmd === 'delete') api.removeSelected();
  });

  // --- ボタン押下後のSpace誤爆防止 ---
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn) btn.blur();
  });

  // --- Windows標準ショートカット ---
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

    if (e.code === 'Space' && !isSpaceDown) {
      e.preventDefault();
      isSpaceDown = true;
      stageWrap.classList.add('panning');
      return;
    }

    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    if (ctrl && key === 'z') { e.preventDefault(); e.shiftKey ? restoreHistory(state.historyIndex + 1) : restoreHistory(state.historyIndex - 1); return; }
    if (ctrl && key === 'y') { e.preventDefault(); restoreHistory(state.historyIndex + 1); return; }
    if (ctrl && key === 'c') { e.preventDefault(); api.copySelected(); return; }
    if (ctrl && key === 'v') { e.preventDefault(); api.pasteClipboard(20); return; }
    if (ctrl && key === 'f') { e.preventDefault(); api.pasteClipboard(0); return; }
    if (ctrl && key === 'd') { e.preventDefault(); api.duplicateSelected(); return; }
    if (ctrl && key === 'a') { e.preventDefault(); state.selectedIds = state.objects.filter(o => o.visible).map(o => o.id); updateAllUI(); return; }
    if (ctrl && key === '0') { e.preventDefault(); fitZoom(); return; }
    if (ctrl && (e.key === ']' || e.key === '}')) { e.preventDefault(); api.reorderSelected(e.shiftKey ? 'front' : 'up'); return; }
    if (ctrl && (e.key === '[' || e.key === '{')) { e.preventDefault(); api.reorderSelected(e.shiftKey ? 'back' : 'down'); return; }

    if (!ctrl && key === 'v') { setMode('select'); return; }
    if (!ctrl && key === 'h') { setMode('pan'); return; }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (state.selectedIds.length) { e.preventDefault(); api.removeSelected(); }
      return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      const movable = getSelectedObjects().filter(o => !o.locked);
      if (!movable.length) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      for (const o of movable) {
        if (e.key === 'ArrowUp') o.y -= step;
        if (e.key === 'ArrowDown') o.y += step;
        if (e.key === 'ArrowLeft') o.x -= step;
        if (e.key === 'ArrowRight') o.x += step;
      }
      pushHistory();
      updateStatus();
      renderProperties();
      render();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      isSpaceDown = false;
      if (state.mode !== 'pan') stageWrap.classList.remove('panning');
    }
  });

  function setMode(m) {
    state.mode = m;
    document.getElementById('mode-select').classList.toggle('active', m === 'select');
    document.getElementById('mode-pan').classList.toggle('active', m === 'pan');
    stageWrap.classList.toggle('panning', m === 'pan');
  }
  document.getElementById('mode-select').onclick = () => setMode('select');
  document.getElementById('mode-pan').onclick = () => setMode('pan');

  // --- UI更新群 ---
  function updateStatus() {
    document.getElementById('st-artboard').textContent = `${state.width} × ${state.height} px`; document.getElementById('st-zoom').textContent = `${Math.round(state.zoom * 100)}%`;
    const sels = getSelectedObjects();
    const stSel = document.getElementById('st-selection');
    if (sels.length === 0) stSel.textContent = '未選択';
    else if (sels.length === 1) {
      const o = sels[0];
      stSel.textContent = `X:${o.x} Y:${o.y} W:${o.w} H:${o.h} 角度:${o.rotation \vert{}\vert{} 0}°`; } else { stSel.textContent = `${sels.length}個のオブジェクトを選択中`;
    }
  }

  function renderContextBar() {
    const bar = document.getElementById('context-bar');
    const sels = getSelectedObjects();
    bar.innerHTML = '';
    if (sels.length === 0) {
      bar.innerHTML = `<span class="ctx-label">未選択（アートボード: ${state.width} ×${state.height}px）</span>`;
      return;
    }
    if (sels.length > 1) {
      bar.innerHTML = `<span class="ctx-label">${sels.length}個選択中：右パネルの「整列」タブで一括整列できます</span>`;
      return;
    }
    const sel = sels[0];
    const fn = ctxBarRenderers.get(sel.type);
    if (fn) fn(bar, sel, api);
    else bar.innerHTML = `<span class="ctx-label">${sel.name || sel.type} を選択中</span>`;
  }

  function renderLayers() {
    const list = document.getElementById('layer-list');
    list.innerHTML = '';
    if (!state.objects.length) {
      list.innerHTML = '<div class="empty-note">レイヤーがありません</div>';
      return;
    }
    let dragSrcId = null;
    [...state.objects].reverse().forEach(obj => {
      const item = document.createElement('div');
      item.className = 'layer-item' + (state.selectedIds.includes(obj.id) ? ' active' : '');
      item.draggable = true;
      item.innerHTML = `
        <span class="layer-icon">${layerIcons.get(obj.type) || '<i class="fa-regular fa-square"></i>'}</span>
        <span class="layer-name"></span>
        <button class="layer-btn ${obj.visible ? '' : 'off'}" data-act="vis" title="表示切替">
          <i class="fa-regular ${obj.visible ? 'fa-eye' : 'fa-eye-slash'}"></i>
        </button>
        <button class="layer-btn ${obj.locked ? '' : 'off'}" data-act="lock" title="ロック">
          <i class="fa-solid ${obj.locked ? 'fa-lock' : 'fa-lock-open'}"></i>
        </button>
      `;
      item.querySelector('.layer-name').textContent = obj.name || obj.type;

      item.addEventListener('click', (e) => {
        const actBtn = e.target.closest('[data-act]');
        const act = actBtn ? actBtn.dataset.act : null;
        if (act === 'vis') { obj.visible = !obj.visible; pushHistory(); updateAllUI(); return; }
        if (act === 'lock') { obj.locked = !obj.locked; pushHistory(); updateAllUI(); return; }
        if (e.shiftKey) {
          if (state.selectedIds.includes(obj.id)) state.selectedIds = state.selectedIds.filter(id => id !== obj.id);
          else state.selectedIds.push(obj.id);
        } else {
          state.selectedIds = [obj.id];
        }
        updateAllUI();
      });
      // D&D並び替え
      item.addEventListener('dragstart', () => { dragSrcId = obj.id; });
      item.addEventListener('dragover', (e) => { e.preventDefault(); item.classList.add('drag-over'); });
      item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drag-over');
        if (!dragSrcId || dragSrcId === obj.id) return;
        const fromIdx = state.objects.findIndex(o => o.id === dragSrcId);
        const [moved] = state.objects.splice(fromIdx, 1);
        const toIdx = state.objects.findIndex(o => o.id === obj.id);
        state.objects.splice(toIdx + 1, 0, moved);
        pushHistory(); updateAllUI();
      });
      list.appendChild(item);
    });
  }

  function renderProperties() {
    const pane = document.getElementById('tab-pane-props');
    const sels = getSelectedObjects();
    if (sels.length !== 1) {
      pane.innerHTML = `<div class="empty-note">${sels.length ? sels.length + '個のオブジェクトを選択中' : 'オブジェクトを選択してください'}</div>`;
      return;
    }
    const sel = sels[0];
    pane.innerHTML = `
      <div class="field">
        <label>レイヤー名</label>
        <input type="text" id="p-name" value="">
      </div>
      <div class="field-row">
        <div class="field"><label>X</label><input type="number" id="p-x" value="${sel.x}"></div>
        <div class="field"><label>Y</label><input type="number" id="p-y" value="${sel.y}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>幅 (W)</label><input type="number" id="p-w" value="${sel.w}"></div>
        <div class="field"><label>高さ (H)</label><input type="number" id="p-h" value="${sel.h}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>角度 (°)</label><input type="number" id="p-rot" value="${sel.rotation || 0}"></div>
        <div class="field"><label>不透明度</label><input type="range" id="p-op" min="0" max="1" step="0.05" value="${sel.opacity ?? 1}"></div>
      </div>
      <div id="plugin-props-slot" style="display:flex; flex-direction:column; gap:8px; border-top:1px solid var(--border); padding-top:8px;"></div>
      <div style="border-top:1px solid var(--border); padding-top:8px; display:flex; flex-direction:column; gap:6px;">
        <label style="font-size:11px; color:var(--text-muted); font-weight:600;">ドロップシャドウ（影）</label>
        <div class="field-row">
          <div class="field"><label>ぼかし</label><input type="number" id="p-sb" min="0" max="80" value="${sel.shadowBlur || 0}"></div>
          <div class="field"><label>影色</label><input type="color" id="p-sc" value="${sel.shadowColor || '#000000'}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>距離 X</label><input type="number" id="p-sx" value="${sel.shadowX || 0}"></div>
          <div class="field"><label>距離 Y</label><input type="number" id="p-sy" value="${sel.shadowY || 0}"></div>
        </div>
      </div>
    `;

    pane.querySelector('#p-name').value = sel.name || '';

    const bind = (id, key, isNum = true) => {
      const el = pane.querySelector('#' + id);
      el.addEventListener('input', () => {
        sel[key] = isNum ? Number(el.value) : el.value;
        if (key === 'name') renderLayers();
        updateStatus(); render();
      });
      el.addEventListener('change', () => pushHistory());
    };
    bind('p-name', 'name', false);
    bind('p-x', 'x'); bind('p-y', 'y'); bind('p-w', 'w'); bind('p-h', 'h');
    bind('p-rot', 'rotation'); bind('p-op', 'opacity');
    bind('p-sb', 'shadowBlur'); bind('p-sc', 'shadowColor', false);
    bind('p-sx', 'shadowX'); bind('p-sy', 'shadowY');

    const slot = pane.querySelector('#plugin-props-slot');
    const fn = propRenderers.get(sel.type);
    if (fn) fn(slot, sel, api);
    else slot.style.display = 'none';
  }

  function updateAllUI() {
    updateStatus();
    renderContextBar();
    renderLayers();
    renderProperties();
    render();
  }

  // タブ切替
  document.getElementById('tab-bar').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-pane-' + btn.dataset.tab).classList.add('active');
  });

  // 基本ボタン配線
  document.getElementById('btn-undo').onclick = () => restoreHistory(state.historyIndex - 1);
  document.getElementById('btn-redo').onclick = () => restoreHistory(state.historyIndex + 1);
  document.getElementById('btn-zoom-in').onclick = () => { state.zoom = Math.min(4, state.zoom * 1.15); updateStatus(); render(); };
  document.getElementById('btn-zoom-out').onclick = () => { state.zoom = Math.max(0.1, state.zoom / 1.15); updateStatus(); render(); };
  document.getElementById('btn-zoom-fit').onclick = fitZoom;
  document.getElementById('btn-layer-up').onclick = () => api.reorderSelected('up');
  document.getElementById('btn-layer-down').onclick = () => api.reorderSelected('down');
  document.getElementById('btn-layer-dup').onclick = () => api.duplicateSelected();
  document.getElementById('btn-layer-del').onclick = () => api.removeSelected();

  // --- 公開API ---
  const api = {
    state,
    worldToScreen,
    getSelected,
    getSelectedObjects,
    render,
    pushHistory,
    updateAllUI,
    renderProperties,
    renderContextBar,
    setArtboard(w, h, bg) {
      if (w) state.width = w;
      if (h) state.height = h;
      if (bg !== undefined) state.bgColor = bg;
      fitZoom();
      pushHistory();
      updateAllUI();
    },
    addObject(obj) {
      const item = { id: uid(), visible: true, locked: false, opacity: 1, rotation: 0, ...obj };
      state.objects.push(item);
      state.selectedIds = [item.id];
      pushHistory();
      updateAllUI();
      return item;
    },
    removeSelected() {
      state.objects = state.objects.filter(o => !state.selectedIds.includes(o.id));
      state.selectedIds = [];
      pushHistory();
      updateAllUI();
    },
    copySelected() {
      const sels = getSelectedObjects();
      if (!sels.length) return;
      clipboard = sels.map(o => ({ ...o }));
      pasteCount = 0;
    },
    pasteClipboard(offset = 20) {
      if (!clipboard.length) return;
      if (offset > 0) pasteCount++;
      const shift = offset * (offset > 0 ? pasteCount : 0);
      const newIds = [];
      for (const src of clipboard) {
        const c = { ...src, id: uid(), x: src.x + shift, y: src.y + shift };
        state.objects.push(c);
        newIds.push(c.id);
      }
      state.selectedIds = newIds;
      pushHistory();
      updateAllUI();
    },
    duplicateSelected() {
      const sels = getSelectedObjects();
      if (!sels.length) return;
      const newIds = [];
      for (const src of sels) {
        const c = { ...src, id: uid(), x: src.x + 20, y: src.y + 20, name: (src.name || src.type) + ' コピー' };
        state.objects.push(c);
        newIds.push(c.id);
      }
      state.selectedIds = newIds;
      pushHistory();
      updateAllUI();
    },
    reorderSelected(dir) {
      if (state.selectedIds.length !== 1) return;
      const idx = state.objects.findIndex(o => o.id === state.selectedIds[0]);
      if (idx < 0) return;
      const [item] = state.objects.splice(idx, 1);
      if (dir === 'front') state.objects.push(item);
      else if (dir === 'back') state.objects.unshift(item);
      else if (dir === 'up') state.objects.splice(Math.min(state.objects.length, idx + 1), 0, item);
      else if (dir === 'down') state.objects.splice(Math.max(0, idx - 1), 0, item);
      pushHistory();
      updateAllUI();
    },
    exportDataURL(mime = 'image/png', quality = 0.92) {
      const off = document.createElement('canvas');
      off.width = state.width;
      off.height = state.height;
      const octx = off.getContext('2d');
      if (state.bgColor !== 'transparent') {
        octx.fillStyle = state.bgColor;
        octx.fillRect(0, 0, state.width, state.height);
      }
      for (const obj of state.objects) {
        if (!obj.visible) continue;
        drawObject(octx, obj);
      }
      return off.toDataURL(mime, quality);
    },
    registerPlugin(p) {
      if (!p || !p.id) return;
      plugins.set(p.id, p);
      if (p.objectType) {
        if (p.renderObject) renderers.set(p.objectType, p.renderObject);
        if (p.renderProperties) propRenderers.set(p.objectType, p.renderProperties);
        if (p.renderContextBar) ctxBarRenderers.set(p.objectType, p.renderContextBar);
        if (p.onDoubleClick) dblClickHandlers.set(p.objectType, p.onDoubleClick);
        if (p.layerIcon) layerIcons.set(p.objectType, p.layerIcon);
      }
      if (p.renderOverlay) overlayHooks.push(p.renderOverlay);
      if (p.toolButton) {
        const btn = document.createElement('button');
        btn.className = 'tool-btn';
        btn.title = p.toolButton.title || p.name;
        btn.innerHTML = `<span class="icon">${p.toolButton.icon}</span><span class="label">${p.toolButton.label}</span>`;
        btn.onclick = () => p.toolButton.onClick(api);
        document.getElementById('toolbar').appendChild(btn);
      }
      if (p.headerButton) {
        const btn = document.createElement('button');
        btn.className = 'btn ' + (p.headerButton.primary ? 'btn-primary' : '');
        btn.innerHTML = p.headerButton.label;
        btn.onclick = () => p.headerButton.onClick(api);
        document.getElementById('header-actions').appendChild(btn);
      }
      if (p.tab) {
        const tBtn = document.createElement('button');
        tBtn.className = 'tab-btn';
        tBtn.dataset.tab = p.tab.id;
        tBtn.textContent = p.tab.label;
        document.getElementById('tab-bar').appendChild(tBtn);

        const pane = document.createElement('div');
        pane.className = 'tab-pane';
        pane.id = 'tab-pane-' + p.tab.id;
        p.tab.mount(pane, api);
        document.getElementById('tab-content-wrap').appendChild(pane);
      }
      if (p.init) p.init(api);
    }
  };

  window.addEventListener('load', () => { resizeViewport(); fitZoom(); pushHistory(); updateAllUI(); });
  window.addEventListener('resize', resizeViewport);
  return api;
})();
