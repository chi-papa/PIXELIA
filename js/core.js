/**
 * テキストレイヤープラグイン（ダブルクリック直接編集・コンテキストバー・文字間隔）
 */
ThumbStudio.registerPlugin({
  id: 'v2-text-layer',
  name: 'テキスト',
  objectType: 'text',
  layerIcon: '<i class="fa-solid fa-font"></i>',

  toolButton: {
    icon: '<i class="fa-solid fa-font"></i>',
    label: '文字',
    title: 'テキストを追加（ダブルクリックで直接編集）',
    onClick(api) {
      api.addObject({
        type: 'text',
        name: '見出しテキスト',
        text: 'サンプル見出し',
        x: Math.round(api.state.width * 0.1),
        y: Math.round(api.state.height * 0.4),
        w: Math.round(api.state.width * 0.8),
        h: 110,
        fontSize: 72,
        fontWeight: '900',
        fontFamily: '"Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
        color: '#111111',
        strokeColor: '#ffffff',
        strokeWidth: 0,
        align: 'center',
        lineHeight: 1.25,
        letterSpacing: 0
      });
    }
  },

  onDoubleClick(obj, api) {
    const editor = document.getElementById('inline-editor');
    const pt = api.worldToScreen(obj.x, obj.y);
    const w = Math.max(180, obj.w * api.state.zoom);
    const h = Math.max(60, obj.h * api.state.zoom);

    editor.value = obj.text || '';
    editor.style.left = pt.x + 'px';
    editor.style.top = pt.y + 'px';
    editor.style.width = w + 'px';
    editor.style.height = h + 'px';
    editor.style.fontSize = Math.max(14, Math.round(obj.fontSize * api.state.zoom * 0.6)) + 'px';
    editor.style.textAlign = obj.align || 'center';
    editor.style.display = 'block';
    editor.focus();
    editor.select();

    const finish = () => {
      if (editor.style.display === 'none') return;
      obj.text = editor.value;
      editor.style.display = 'none';
      editor.removeEventListener('blur', finish);
      editor.removeEventListener('keydown', onKey);
      api.pushHistory();
      api.updateAllUI();
    };
    const onKey = (e) => {
      if (e.key === 'Escape' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        finish();
      }
    };
    editor.addEventListener('blur', finish);
    editor.addEventListener('keydown', onKey);
  },

  renderObject(ctx, obj) {
    const lines = String(obj.text || '').split('\n');
    const lh = obj.fontSize * (obj.lineHeight || 1.25);
    ctx.font = `${obj.fontWeight || '700'} ${obj.fontSize}px ${obj.fontFamily}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = obj.align || 'center';
    if ('letterSpacing' in ctx) {
      ctx.letterSpacing = (obj.letterSpacing || 0) + 'px';
    }

    let tx = obj.x;
    if (obj.align === 'center') tx = obj.x + obj.w / 2;
    else if (obj.align === 'right') tx = obj.x + obj.w;

    lines.forEach((line, i) => {
      const ty = obj.y + i * lh;
      if (obj.strokeWidth > 0) {
        ctx.lineJoin = 'round';
        ctx.strokeStyle = obj.strokeColor || '#ffffff';
        ctx.lineWidth = obj.strokeWidth * 2;
        ctx.strokeText(line, tx, ty);
      }
      ctx.fillStyle = obj.color || '#111111';
      ctx.fillText(line, tx, ty);
    });
  },

  renderContextBar(bar, obj, api) {
    bar.innerHTML = `
      <div class="ctx-group">
        <span class="ctx-label">サイズ</span>
        <input type="number" id="ctx-t-size" value="${obj.fontSize}" style="width:58px;">
        <select id="ctx-t-weight" style="width:76px;">
          <option value="400" ${obj.fontWeight==='400'?'selected':''}>標準</option>
          <option value="700" ${obj.fontWeight==='700'?'selected':''}>太字</option>
          <option value="900" ${obj.fontWeight==='900'?'selected':''}>極太</option>
        </select>
      </div>
      <div class="ctx-group">
        <span class="ctx-label">文字色</span>
        <input type="color" id="ctx-t-col" value="${obj.color}" style="width:32px; height:24px;">
        <span class="ctx-label">フチ</span>
        <input type="color" id="ctx-t-scol" value="${obj.strokeColor}" style="width:32px; height:24px;">
        <input type="number" id="ctx-t-sw" min="0" max="40" value="${obj.strokeWidth}" style="width:48px;">
      </div>
      <div class="ctx-group">
        <button class="btn btn-sm" data-al="left">左</button>
        <button class="btn btn-sm" data-al="center">中</button>
        <button class="btn btn-sm" data-al="right">右</button>
      </div>
    `;
    const bind = (sel, key, num = false) => {
      const el = bar.querySelector(sel);
      el.addEventListener('input', () => { obj[key] = num ? Number(el.value) : el.value; api.render(); });
      el.addEventListener('change', () => { api.pushHistory(); api.renderProperties(); });
    };
    bind('#ctx-t-size', 'fontSize', true);
    bind('#ctx-t-weight', 'fontWeight');
    bind('#ctx-t-col', 'color');
    bind('#ctx-t-scol', 'strokeColor');
    bind('#ctx-t-sw', 'strokeWidth', true);
    bar.querySelectorAll('[data-al]').forEach(b => {
      b.onclick = () => { obj.align = b.dataset.al; api.pushHistory(); api.updateAllUI(); };
    });
  },

  renderProperties(container, obj, api) {
    container.innerHTML = `
      <div class="field">
        <label>テキスト（ダブルクリックで直接編集可）</label>
        <textarea id="txt-val" rows="3"></textarea>
      </div>
      <div class="field-row">
        <div class="field"><label>サイズ (px)</label><input type="number" id="txt-size" value="${obj.fontSize}"></div>
        <div class="field"><label>太さ</label>
          <select id="txt-weight">
            <option value="400" ${obj.fontWeight==='400'?'selected':''}>標準 (400)</option>
            <option value="700" ${obj.fontWeight==='700'?'selected':''}>太字 (700)</option>
            <option value="900" ${obj.fontWeight==='900'?'selected':''}>極太 (900)</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>文字間隔 (px)</label><input type="number" id="txt-ls" value="${obj.letterSpacing || 0}"></div>
        <div class="field"><label>行間</label><input type="number" id="txt-lh" step="0.05" value="${obj.lineHeight || 1.25}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>文字色</label><input type="color" id="txt-color" value="${obj.color}"></div>
        <div class="field"><label>揃え</label>
          <select id="txt-align">
            <option value="left" ${obj.align==='left'?'selected':''}>左揃え</option>
            <option value="center" ${obj.align==='center'?'selected':''}>中央揃え</option>
            <option value="right" ${obj.align==='right'?'selected':''}>右揃え</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>フチ色</label><input type="color" id="txt-sc" value="${obj.strokeColor}"></div>
        <div class="field"><label>フチ太さ</label><input type="number" id="txt-sw" min="0" max="40" value="${obj.strokeWidth}"></div>
      </div>
    `;
    container.querySelector('#txt-val').value = obj.text || '';

    const bind = (sel, key, num = false) => {
      const el = container.querySelector(sel);
      el.addEventListener('input', () => { obj[key] = num ? Number(el.value) : el.value; api.render(); });
      el.addEventListener('change', () => { api.pushHistory(); api.renderContextBar(); });
    };
    bind('#txt-val', 'text');
    bind('#txt-size', 'fontSize', true);
    bind('#txt-weight', 'fontWeight');
    bind('#txt-ls', 'letterSpacing', true);
    bind('#txt-lh', 'lineHeight', true);
    bind('#txt-color', 'color');
    bind('#txt-align', 'align');
    bind('#txt-sc', 'strokeColor');
    bind('#txt-sw', 'strokeWidth', true);
  }
});
