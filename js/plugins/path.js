/**
 * パス・矢印・多角形ツールプラグイン（PIXELIA用・真の完全版）
 * - PC（ダブルクリック / Enter / Esc）＆ スマホ（コンテキストバー確定ボタン）両対応
 * - 45度スナップ・角丸クランプ・完全透明化防止ガード付き
 */
ThumbStudio.registerPlugin({
  id: 'v2-path-tool',
  name: 'パス',
  objectType: 'path',
  layerIcon: '<i class="fa-solid fa-pen-nib"></i>',

  init(api) {
    let isDrawing = false;
    let points = [];
    let cursorPt = null;
    let isNearStart = false;

    const vpCanvas = document.getElementById('viewport');

    function getToolBtn() {
      return Array.from(document.querySelectorAll('.tool-btn')).find(b => b.textContent.includes('パス'));
    }

    function updateDrawingBar() {
      const bar = document.getElementById('context-bar');
      if (!bar) return;
      if (!isDrawing) {
        api.renderContextBar();
        return;
      }
      bar.innerHTML = `
        <div class="ctx-group">
          <span class="ctx-label" style="color:var(--accent); font-weight:bold;">パス描画中（${points.length}点）</span>
          <button class="btn btn-sm btn-primary" id="ctx-path-done" ${points.length < 2 ? 'disabled' : ''}>完了 (Enter)</button>
          <button class="btn btn-sm" id="ctx-path-close" ${points.length < 3 ? 'disabled' : ''}>閉じて完了</button>
          <button class="btn btn-sm" id="ctx-path-cancel">キャンセル (Esc)</button>
        </div>
        <span class="ctx-label">クリックで頂点追加 / Shiftで45度固定</span>
      `;
      bar.querySelector('#ctx-path-done')?.addEventListener('click', () => finishPath(false));
      bar.querySelector('#ctx-path-close')?.addEventListener('click', () => finishPath(true));
      bar.querySelector('#ctx-path-cancel')?.addEventListener('click', () => setDrawingMode(false));
    }

    function setDrawingMode(active) {
      isDrawing = active;
      points = [];
      cursorPt = null;
      isNearStart = false;
      const btn = getToolBtn();
      if (btn) btn.classList.toggle('active', active);
      if (vpCanvas) vpCanvas.style.cursor = active ? 'crosshair' : '';
      updateDrawingBar();
      api.render();
    }

    function screenToWorld(clientX, clientY) {
      const rect = vpCanvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left - api.state.panX) / api.state.zoom,
        y: (clientY - rect.top - api.state.panY) / api.state.zoom
      };
    }

    function applyAngleSnap(prev, curr) {
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const dist = Math.hypot(dx, dy);
      if (dist === 0) return curr;
      const angle = Math.atan2(dy, dx);
      const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      return {
        x: Math.round(prev.x + Math.cos(snapped) * dist),
        y: Math.round(prev.y + Math.sin(snapped) * dist)
      };
    }

    function finishPath(closed = false) {
      if (!isDrawing) return;
      if (points.length < 2) {
        setDrawingMode(false);
        return;
      }
      const xs = points.map(p => p.x);
      const ys = points.map(p => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      const w = Math.max(10, Math.round(maxX - minX));
      const h = Math.max(10, Math.round(maxY - minY));

      const normPoints = points.map(p => ({
        rx: (p.x - minX) / w,
        ry: (p.y - minY) / h
      }));

      setDrawingMode(false);

      const selBtn = document.getElementById('mode-select');
      if (selBtn) selBtn.click();

      api.addObject({
        type: 'path',
        name: closed ? '多角形パス' : 'パス・矢印',
        x: Math.round(minX),
        y: Math.round(minY),
        w,
        h,
        points: normPoints,
        closed,
        stroke: '#1e293b',
        strokeWidth: 6,
        fill: closed ? '#4f8cff' : 'transparent',
        dashed: false,
        arrowEnd: !closed,
        cornerRadius: 0
      });
    }

    api.startPathTool = () => {
      api.state.selectedIds = [];
      api.updateAllUI();
      setDrawingMode(true);
    };

    vpCanvas.addEventListener('mousedown', (e) => {
      if (!isDrawing || e.button !== 0) return;
      e.stopImmediatePropagation();
      e.preventDefault();

      let pos = screenToWorld(e.clientX, e.clientY);
      pos = { x: Math.round(pos.x), y: Math.round(pos.y) };

      if (points.length > 0 && e.shiftKey) {
        pos = applyAngleSnap(points[points.length - 1], pos);
      }

      if (points.length >= 3) {
        const start = points[0];
        if (Math.hypot(pos.x - start.x, pos.y - start.y) <= 14 / api.state.zoom) {
          finishPath(true);
          return;
        }
      }

      if (points.length >= 2) {
        const last = points[points.length - 1];
        if (Math.hypot(pos.x - last.x, pos.y - last.y) <= 4 / api.state.zoom) {
          finishPath(false);
          return;
        }
      }

      points.push(pos);
      cursorPt = pos;
      updateDrawingBar();
      api.render();
    }, true);

    window.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      let pos = screenToWorld(e.clientX, e.clientY);
      pos = { x: Math.round(pos.x), y: Math.round(pos.y) };

      if (points.length > 0 && e.shiftKey) {
        pos = applyAngleSnap(points[points.length - 1], pos);
      }

      isNearStart = false;
      if (points.length >= 3) {
        const start = points[0];
        if (Math.hypot(pos.x - start.x, pos.y - start.y) <= 14 / api.state.zoom) {
          pos = { x: start.x, y: start.y };
          isNearStart = true;
        }
      }
      cursorPt = pos;
      api.render();
    }, true);

    vpCanvas.addEventListener('dblclick', (e) => {
      if (!isDrawing) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      finishPath(false);
    }, true);

    document.getElementById('toolbar')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.tool-btn');
      if (btn && !btn.textContent.includes('パス') && isDrawing) {
        setDrawingMode(false);
      }
    });

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        api.startPathTool();
        return;
      }
      if (isDrawing) {
        if (e.key === 'Enter') {
          e.preventDefault();
          finishPath(false);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setDrawingMode(false);
        }
      }
    });

    api._drawPathPreview = (ctx) => {
      if (!isDrawing || points.length === 0) return;
      const z = api.state.zoom;
      ctx.save();
      ctx.strokeStyle = '#4f8cff';
      ctx.lineWidth = 2 / z;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      if (cursorPt) {
        ctx.lineTo(cursorPt.x, cursorPt.y);
      }
      ctx.stroke();

      const r = 4.5 / z;
      points.forEach((p, idx) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, idx === 0 && isNearStart ? r * 1.6 : r, 0, Math.PI * 2);
        ctx.fillStyle = idx === 0 ? '#ff4fd8' : '#ffffff';
        ctx.fill();
        ctx.stroke();
      });
      ctx.restore();
    };
  },

  toolButton: {
    icon: '<i class="fa-solid fa-pen-nib"></i>',
    label: 'パス',
    title: 'パス・矢印・多角形を描画 (P)',
    onClick(api) {
      if (api.startPathTool) api.startPathTool();
    }
  },

  renderOverlay(ctx, api) {
    if (api._drawPathPreview) api._drawPathPreview(ctx);
  },

  renderObject(ctx, obj) {
    if (!obj.points || obj.points.length < 2) return;
    const pts = obj.points.map(p => ({
      x: obj.x + p.rx * obj.w,
      y: obj.y + p.ry * obj.h
    }));

    const r = obj.cornerRadius || 0;
    const closed = !!obj.closed;

    ctx.save();
    ctx.beginPath();

    if (r > 0 && pts.length >= 3) {
      const len = pts.length;
      for (let i = 0; i < len; i++) {
        const prev = pts[(i - 1 + len) % len];
        const curr = pts[i];
        const next = pts[(i + 1) % len];

        if (!closed && (i === 0 || i === len - 1)) {
          if (i === 0) ctx.moveTo(curr.x, curr.y);
          else ctx.lineTo(curr.x, curr.y);
        } else {
          const d1 = Math.hypot(curr.x - prev.x, curr.y - prev.y) * 0.48;
          const d2 = Math.hypot(next.x - curr.x, next.y - curr.y) * 0.48;
          const safeR = Math.min(r, d1, d2);

          if (i === 0) {
            const midX = (prev.x + curr.x) / 2;
            const midY = (prev.y + curr.y) / 2;
            ctx.moveTo(midX, midY);
          }
          ctx.arcTo(curr.x, curr.y, next.x, next.y, Math.max(0, safeR));
        }
      }
      if (closed) ctx.closePath();
    } else {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      if (closed) ctx.closePath();
    }

    if (closed && obj.fill && obj.fill !== 'transparent') {
      ctx.fillStyle = obj.fill;
      ctx.fill();
    }

    const sw = obj.strokeWidth ?? 6;
    if (sw > 0) {
      ctx.strokeStyle = obj.stroke || '#1e293b';
      ctx.lineWidth = sw;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (obj.dashed) {
        ctx.setLineDash([sw * 2.2, sw * 1.6]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (!closed && obj.arrowEnd && sw > 0 && pts.length >= 2) {
      const p1 = pts[pts.length - 2];
      const p2 = pts[pts.length - 1];
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const headLen = Math.max(16, sw * 3.2);
      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p2.x - headLen * Math.cos(angle - Math.PI / 6), p2.y - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(p2.x - headLen * 0.72 * Math.cos(angle), p2.y - headLen * 0.72 * Math.sin(angle));
      ctx.lineTo(p2.x - headLen * Math.cos(angle + Math.PI / 6), p2.y - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = obj.stroke || '#1e293b';
      ctx.fill();
    }

    ctx.restore();
  },

  renderContextBar(bar, obj, api) {
    const isTransparent = !obj.fill || obj.fill === 'transparent';
    const fillVal = isTransparent ? '#4f8cff' : obj.fill;

    bar.innerHTML = `
      <div class="ctx-group">
        <span class="ctx-label">線</span>
        <input type="color" id="ctx-p-str" value="${obj.stroke || '#1e293b'}" style="width:30px; height:24px;">
        <input type="number" id="ctx-p-sw" min="0" max="60" value="${obj.strokeWidth ?? 6}" style="width:46px;">
      </div>
      <div class="ctx-group">
        <span class="ctx-label">塗り</span>
        <input type="color" id="ctx-p-fill" value="${fillVal}" style="width:30px; height:24px; opacity:${isTransparent ? 0.35 : 1};">
        <button class="btn btn-sm ${isTransparent ? 'btn-primary' : ''}" id="ctx-p-none">なし</button>
      </div>
      <div class="ctx-group">
        <button class="btn btn-sm ${obj.arrowEnd ? 'btn-primary' : ''}" id="ctx-p-arrow">矢印</button>
        <button class="btn btn-sm ${obj.dashed ? 'btn-primary' : ''}" id="ctx-p-dash">破線</button>
        <button class="btn btn-sm ${obj.closed ? 'btn-primary' : ''}" id="ctx-p-close">閉じる</button>
      </div>
      <div class="ctx-group">
        <span class="ctx-label">角丸</span>
        <input type="number" id="ctx-p-rad" min="0" max="200" value="${obj.cornerRadius || 0}" style="width:48px;">
      </div>
    `;

    const bind = (sel, key, num = false) => {
      const el = bar.querySelector(sel);
      el.addEventListener('input', () => { obj[key] = num ? Number(el.value) : el.value; api.render(); });
      el.addEventListener('change', () => { api.pushHistory(); api.renderProperties(); });
    };
    bind('#ctx-p-str', 'stroke');
    bind('#ctx-p-sw', 'strokeWidth', true);
    bind('#ctx-p-rad', 'cornerRadius', true);

    const fillEl = bar.querySelector('#ctx-p-fill');
    fillEl.addEventListener('input', () => {
      obj.fill = fillEl.value;
      obj.closed = true;
      obj.arrowEnd = false;
      api.render();
    });
    fillEl.addEventListener('change', () => { api.pushHistory(); api.updateAllUI(); });

    bar.querySelector('#ctx-p-none').onclick = () => {
      if (isTransparent) {
        obj.fill = fillEl.value;
        obj.closed = true;
        obj.arrowEnd = false;
      } else {
        obj.fill = 'transparent';
        if (!obj.strokeWidth) obj.strokeWidth = 2;
      }
      api.pushHistory(); api.updateAllUI();
    };
    bar.querySelector('#ctx-p-arrow').onclick = () => {
      obj.arrowEnd = !obj.arrowEnd;
      if (obj.arrowEnd) obj.closed = false;
      api.pushHistory(); api.updateAllUI();
    };
    bar.querySelector('#ctx-p-dash').onclick = () => {
      obj.dashed = !obj.dashed;
      api.pushHistory(); api.updateAllUI();
    };
    bar.querySelector('#ctx-p-close').onclick = () => {
      obj.closed = !obj.closed;
      if (obj.closed) obj.arrowEnd = false;
      api.pushHistory(); api.updateAllUI();
    };
  },

  renderProperties(container, obj, api) {
    const isTransparent = !obj.fill || obj.fill === 'transparent';
    const fillVal = isTransparent ? '#4f8cff' : obj.fill;

    container.innerHTML = `
      <div class="field-row">
        <div class="field"><label>線の色</label><input type="color" id="pth-str" value="${obj.stroke || '#1e293b'}"></div>
        <div class="field"><label>線の太さ (px)</label><input type="number" id="pth-sw" min="0" max="60" value="${obj.strokeWidth ?? 6}"></div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>塗り色</label>
          <div style="display:flex; gap:4px; align-items:center;">
            <input type="color" id="pth-fill" value="${fillVal}" style="opacity:${isTransparent ? 0.35 : 1};">
            <button class="btn btn-sm ${isTransparent ? 'btn-primary' : ''}" id="pth-none">なし</button>
          </div>
        </div>
        <div class="field"><label>角の丸み (px)</label><input type="number" id="pth-rad" min="0" max="200" value="${obj.cornerRadius || 0}"></div>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="btn btn-sm ${obj.arrowEnd ? 'btn-primary' : ''}" id="pth-arrow" style="flex:1;">終点矢印</button>
        <button class="btn btn-sm ${obj.dashed ? 'btn-primary' : ''}" id="pth-dash" style="flex:1;">破線</button>
        <button class="btn btn-sm ${obj.closed ? 'btn-primary' : ''}" id="pth-close" style="flex:1;">パスを閉じる</button>
      </div>
    `;

    const bind = (sel, key, num = false) => {
      const el = container.querySelector(sel);
      el.addEventListener('input', () => { obj[key] = num ? Number(el.value) : el.value; api.render(); });
      el.addEventListener('change', () => { api.pushHistory(); api.renderContextBar(); });
    };
    bind('#pth-str', 'stroke');
    bind('#pth-sw', 'strokeWidth', true);
    bind('#pth-rad', 'cornerRadius', true);

    const fillEl = container.querySelector('#pth-fill');
    fillEl.addEventListener('input', () => {
      obj.fill = fillEl.value;
      obj.closed = true;
      obj.arrowEnd = false;
      api.render();
    });
    fillEl.addEventListener('change', () => { api.pushHistory(); api.updateAllUI(); });

    container.querySelector('#pth-none').onclick = () => {
      if (isTransparent) {
        obj.fill = fillEl.value;
        obj.closed = true;
        obj.arrowEnd = false;
      } else {
        obj.fill = 'transparent';
        if (!obj.strokeWidth) obj.strokeWidth = 2;
      }
      api.pushHistory(); api.updateAllUI();
    };
    container.querySelector('#pth-arrow').onclick = () => {
      obj.arrowEnd = !obj.arrowEnd;
      if (obj.arrowEnd) obj.closed = false;
      api.pushHistory(); api.updateAllUI();
    };
    container.querySelector('#pth-dash').onclick = () => {
      obj.dashed = !obj.dashed;
      api.pushHistory(); api.updateAllUI();
    };
    container.querySelector('#pth-close').onclick = () => {
      obj.closed = !obj.closed;
      if (obj.closed) obj.arrowEnd = false;
      api.pushHistory(); api.updateAllUI();
    };
  }
});
