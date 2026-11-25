/**
 * キャンバス設定＆三分割グリッド・セーフエリアプラグイン
 */
ThumbStudio.registerPlugin({
  id: 'v2-canvas-tab',
  name: 'キャンバス',

  renderOverlay(ctx, api) {
    if (!api.state.showGrid) return;
    const W = api.state.width;
    const H = api.state.height;
    ctx.strokeStyle = 'rgba(79, 140, 255, 0.55)';
    ctx.lineWidth = 1 / api.state.zoom;
    ctx.setLineDash([6 / api.state.zoom, 4 / api.state.zoom]);

    ctx.beginPath();
    ctx.moveTo(W / 3, 0); ctx.lineTo(W / 3, H);
    ctx.moveTo((W * 2) / 3, 0); ctx.lineTo((W * 2) / 3, H);
    ctx.moveTo(0, H / 3); ctx.lineTo(W, H / 3);
    ctx.moveTo(0, (H * 2) / 3); ctx.lineTo(W, (H * 2) / 3);
    ctx.stroke();

    const mX = W * 0.05;
    const mY = H * 0.05;
    ctx.strokeStyle = 'rgba(255, 200, 80, 0.45)';
    ctx.strokeRect(mX, mY, W - mX * 2, H - mY * 2);
  },

  tab: {
    id: 'canvas',
    label: 'キャンバス',
    mount(container, api) {
      container.innerHTML = `
        <div class="field">
          <label>サイズプリセット</label>
          <select id="cv-preset">
            <option value="1000x1000">EC正方形 1000 × 1000</option>
            <option value="1200x1200">EC高解像度 1200 × 1200</option>
            <option value="1280x720">YouTube 1280 × 720</option>
            <option value="1200x628">横長バナー 1200 × 628</option>
            <option value="800x800">正方形 800 × 800</option>
          </select>
        </div>
        <div class="field-row">
          <div class="field"><label>幅 (px)</label><input type="number" id="cv-w" value="1000"></div>
          <div class="field"><label>高さ (px)</label><input type="number" id="cv-h" value="1000"></div>
        </div>
        <button class="btn" id="cv-apply">カスタムサイズを適用</button>
        <div class="field-row" style="border-top:1px solid var(--border); padding-top:8px;">
          <div class="field"><label>背景色</label><input type="color" id="cv-bg" value="#ffffff"></div>
          <div class="field"><label>透過背景</label><button class="btn" id="cv-trans" style="height:26px;">透過にする</button></div>
        </div>
        <div class="field" style="border-top:1px solid var(--border); padding-top:8px;">
          <label>ガイド表示（書き出しには含まれません）</label>
          <button class="btn" id="cv-grid">三分割グリッド＆セーフエリア：OFF</button>
        </div>
      `;

      const preset = container.querySelector('#cv-preset');
      const wEl = container.querySelector('#cv-w');
      const hEl = container.querySelector('#cv-h');
      const bgEl = container.querySelector('#cv-bg');
      const transEl = container.querySelector('#cv-trans');
      const gridEl = container.querySelector('#cv-grid');

      preset.addEventListener('change', () => {
        const [w, h] = preset.value.split('x').map(Number);
        wEl.value = w; hEl.value = h;
        api.setArtboard(w, h);
      });
      container.querySelector('#cv-apply').onclick = () => {
        const w = Math.max(100, Number(wEl.value) || 1000);
        const h = Math.max(100, Number(hEl.value) || 1000);
        api.setArtboard(w, h);
      };
      bgEl.addEventListener('input', () => api.setArtboard(null, null, bgEl.value));
      transEl.onclick = () => {
        const isTrans = api.state.bgColor === 'transparent';
        api.setArtboard(null, null, isTrans ? bgEl.value : 'transparent');
        transEl.textContent = isTrans ? '透過にする' : '透過解除';
      };
      gridEl.onclick = () => {
        api.state.showGrid = !api.state.showGrid;
        gridEl.textContent = `三分割グリッド＆セーフエリア：${api.state.showGrid ? 'ON' : 'OFF'}`;
        api.render();
      };
    }
  }
});
