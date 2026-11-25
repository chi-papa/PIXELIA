/**
 * バッジ・ラベル装飾プラグイン（円形・ピル型・コーナー三角）
 */
ThumbStudio.registerPlugin({
  id: 'v2-badge-layer',
  name: 'バッジ',
  objectType: 'badge',
  layerIcon: '★',

  toolButton: {
    icon: '★',
    label: 'バッジ',
    title: '訴求バッジ・ラベルを追加',
    onClick(api) {
      api.addObject({
        type: 'badge',
        name: '訴求バッジ',
        style: 'circle',
        text: '送料無料',
        x: 40,
        y: 40,
        w: 200,
        h: 200,
        bgColor: '#d92d20',
        borderColor: '#ffffff',
        borderWidth: 6,
        textColor: '#ffffff',
        fontSize: 38
      });
    }
  },

  renderObject(ctx, obj) {
    const { x, y, w, h, style, bgColor, borderColor, borderWidth, textColor, fontSize, text } = obj;
    ctx.beginPath();
    if (style === 'circle') {
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    } else if (style === 'pill') {
      ctx.roundRect(x, y, w, h, Math.min(w, h) / 2);
    } else {
      ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x, y + h); ctx.closePath();
    }
    ctx.fillStyle = bgColor || '#d92d20';
    ctx.fill();
    if (borderWidth > 0) {
      ctx.strokeStyle = borderColor || '#ffffff';
      ctx.lineWidth = borderWidth;
      ctx.stroke();
    }

    const lines = String(text || '').split('\n');
    const lh = (fontSize || 36) * 1.15;
    ctx.font = `900 ${fontSize || 36}px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`;
    ctx.fillStyle = textColor || '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (style === 'corner') {
      ctx.translate(x + w * 0.34, y + h * 0.34);
      ctx.rotate(-Math.PI / 4);
      lines.forEach((line, i) => ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * lh));
    } else {
      const cx = x + w / 2, cy = y + h / 2;
      lines.forEach((line, i) => ctx.fillText(line, cx, cy + (i - (lines.length - 1) / 2) * lh));
    }
  },

  renderContextBar(bar, obj, api) {
    bar.innerHTML = `
      <div class="ctx-group">
        <span class="ctx-label">形状</span>
        <select id="ctx-b-st" style="width:92px;">
          <option value="circle" ${obj.style==='circle'?'selected':''}>円形</option>
          <option value="pill" ${obj.style==='pill'?'selected':''}>ピル型</option>
          <option value="corner" ${obj.style==='corner'?'selected':''}>コーナー</option>
        </select>
      </div>
      <div class="ctx-group">
        <span class="ctx-label">背景</span>
        <input type="color" id="ctx-b-bg" value="${obj.bgColor}" style="width:32px; height:24px;">
        <span class="ctx-label">文字</span>
        <input type="color" id="ctx-b-tc" value="${obj.textColor}" style="width:32px; height:24px;">
        <span class="ctx-label">サイズ</span>
        <input type="number" id="ctx-b-fs" value="${obj.fontSize}" style="width:52px;">
      </div>
    `;
    const bind = (sel, key, num = false) => {
      const el = bar.querySelector(sel);
      el.addEventListener('input', () => { obj[key] = num ? Number(el.value) : el.value; api.render(); });
      el.addEventListener('change', () => { api.pushHistory(); api.renderProperties(); });
    };
    bind('#ctx-b-st', 'style');
    bind('#ctx-b-bg', 'bgColor');
    bind('#ctx-b-tc', 'textColor');
    bind('#ctx-b-fs', 'fontSize', true);
  },

  renderProperties(container, obj, api) {
    container.innerHTML = `
      <div class="field"><label>バッジ形状</label>
        <select id="bdg-style">
          <option value="circle" ${obj.style==='circle'?'selected':''}>円形スタンプ</option>
          <option value="pill" ${obj.style==='pill'?'selected':''}>角丸ピル型タグ</option>
          <option value="corner" ${obj.style==='corner'?'selected':''}>左上コーナー三角</option>
        </select>
      </div>
      <div class="field"><label>テキスト（改行可）</label><textarea id="bdg-text" rows="2"></textarea></div>
      <div class="field-row">
        <div class="field"><label>文字サイズ</label><input type="number" id="bdg-fs" value="${obj.fontSize || 36}"></div>
        <div class="field"><label>枠線太さ</label><input type="number" id="bdg-bw" min="0" max="30" value="${obj.borderWidth || 0}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>背景色</label><input type="color" id="bdg-bg" value="${obj.bgColor}"></div>
        <div class="field"><label>文字色</label><input type="color" id="bdg-tc" value="${obj.textColor}"></div>
      </div>
      <div class="field"><label>枠線色</label><input type="color" id="bdg-bc" value="${obj.borderColor}"></div>
    `;
    container.querySelector('#bdg-text').value = obj.text || '';

    const bind = (sel, key, num = false) => {
      const el = container.querySelector(sel);
      el.addEventListener('input', () => { obj[key] = num ? Number(el.value) : el.value; api.render(); });
      el.addEventListener('change', () => { api.pushHistory(); api.renderContextBar(); });
    };
    bind('#bdg-style', 'style');
    bind('#bdg-text', 'text');
    bind('#bdg-fs', 'fontSize', true);
    bind('#bdg-bw', 'borderWidth', true);
    bind('#bdg-bg', 'bgColor');
    bind('#bdg-tc', 'textColor');
    bind('#bdg-bc', 'borderColor');
  }
});
