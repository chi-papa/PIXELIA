/**
 * テキストレイヤープラグイン（PIXELIA用・Google Fonts対応＆縦位置揃え対応版）
 */
ThumbStudio.registerPlugin({
  id: 'v2-text-layer',
  name: 'テキスト',
  objectType: 'text',
  layerIcon: '<i class="fa-solid fa-font"></i>',

  init(api) {
    // 厳選した商用利用可能なGoogle Fonts（各フォントの最適ウエイトも指定）
    const FONT_LIST = [
      { name: 'Noto Sans JP (ゴシック)', family: '"Noto Sans JP", sans-serif', weight: '700', url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=swap' },
      { name: 'Noto Serif JP (明朝)', family: '"Noto Serif JP", serif', weight: '700', url: 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap' },
      { name: 'M PLUS Rounded 1c (丸ゴシック)', family: '"M PLUS Rounded 1c", sans-serif', weight: '700', url: 'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@700;900&display=swap' },
      { name: 'Dela Gothic One (超極太見出し)', family: '"Dela Gothic One", sans-serif', weight: '400', url: 'https://fonts.googleapis.com/css2?family=Dela+Gothic+One&display=swap' },
      { name: 'Zen Maru Gothic (丸ゴシック)', family: '"Zen Maru Gothic", sans-serif', weight: '700', url: 'https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@700;900&display=swap' },
      { name: 'Reggae One (ポップ手書き風)', family: '"Reggae One", sans-serif', weight: '400', url: 'https://fonts.googleapis.com/css2?family=Reggae+One&display=swap' },
      { name: 'RocknRoll One (レトロインパクト)', family: '"RocknRoll One", sans-serif', weight: '400', url: 'https://fonts.googleapis.com/css2?family=RocknRoll+One&display=swap' },
      { name: 'Zen Kurenaido (上品手書き風)', family: '"Zen Kurenaido", sans-serif', weight: '400', url: 'https://fonts.googleapis.com/css2?family=Zen+Kurenaido&display=swap' },
      { name: 'Yuji Boku (筆文字・和風)', family: '"Yuji Boku", serif', weight: '400', url: 'https://fonts.googleapis.com/css2?family=Yuji+Boku&display=swap' },
      { name: 'Hina Mincho (アンティーク明朝)', family: '"Hina Mincho", serif', weight: '400', url: 'https://fonts.googleapis.com/css2?family=Hina+Mincho&display=swap' },
      { name: 'Montserrat (欧文・数字用)', family: '"Montserrat", sans-serif', weight: '900', url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&display=swap' },
      { name: 'Oswald (欧文インパクト)', family: '"Oswald", sans-serif', weight: '700', url: 'https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&display=swap' }
    ];

    const loadedFonts = new Set();

    api.loadGoogleFont = function(fontFamily) {
      const match = FONT_LIST.find(f => f.family === fontFamily);
      if (!match || loadedFonts.has(match.family)) return;
      loadedFonts.add(match.family);

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = match.url;
      link.onload = () => {
        if (document.fonts) {
          document.fonts.ready.then(() => api.render());
        } else {
          api.render();
        }
      };
      document.head.appendChild(link);
    };

    // 初期化時に事前ロード
    FONT_LIST.forEach(f => api.loadGoogleFont(f.family));

    if (document.fonts) {
      document.fonts.ready.then(() => api.render());
    }

    api.getFontList = () => FONT_LIST;
  },

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
        fontWeight: '700',
        fontFamily: '"Noto Sans JP", sans-serif',
        color: '#111111',
        strokeColor: '#ffffff',
        strokeWidth: 0,
        align: 'center',
        vAlign: 'middle',
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

  renderObject(ctx, obj, api) {
    if (api && api.loadGoogleFont && obj.fontFamily) {
      api.loadGoogleFont(obj.fontFamily);
    }
    const lines = String(obj.text || '').split('\n');
    const fontSize = obj.fontSize || 48;
    const lh = fontSize * (obj.lineHeight || 1.25);
    ctx.font = `${obj.fontWeight || '700'} ${fontSize}px ${obj.fontFamily || '"Noto Sans JP", sans-serif'}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = obj.align || 'center';
    if ('letterSpacing' in ctx) {
      ctx.letterSpacing = (obj.letterSpacing || 0) + 'px';
    }

    let tx = obj.x;
    if (obj.align === 'center') tx = obj.x + obj.w / 2;
    else if (obj.align === 'right') tx = obj.x + obj.w;

    // テキスト全体の高さを算出し、縦揃え（上・中央・下）に応じた開始Y座標を決定
    const totalHeight = (lines.length - 1) * lh + fontSize;
    const vAlign = obj.vAlign || 'top';
    let startY = obj.y;
    if (vAlign === 'middle') {
      startY = obj.y + (obj.h - totalHeight) / 2;
    } else if (vAlign === 'bottom') {
      startY = obj.y + obj.h - totalHeight;
    }

    lines.forEach((line, i) => {
      const ty = startY + i * lh;
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
    const fonts = api.getFontList ? api.getFontList() : [];
    const fontOptions = fonts.map(f => `<option value='${f.family}' ${obj.fontFamily === f.family ? 'selected' : ''}>${f.name}</option>`).join('');
    const curValign = obj.vAlign || 'top';

    bar.innerHTML = `
      <div class="ctx-group">
        <select id="ctx-t-font" style="width:155px; font-size:11px;">
          ${fontOptions}
        </select>
        <input type="number" id="ctx-t-size" value="${obj.fontSize}" style="width:52px;" title="文字サイズ">
      </div>
      <div class="ctx-group">
        <span class="ctx-label">文字色</span>
        <input type="color" id="ctx-t-col" value="${obj.color}" style="width:32px; height:24px;">
        <span class="ctx-label">フチ</span>
        <input type="color" id="ctx-t-scol" value="${obj.strokeColor}" style="width:32px; height:24px;">
        <input type="number" id="ctx-t-sw" min="0" max="40" value="${obj.strokeWidth}" style="width:42px;">
      </div>
      <div class="ctx-group">
        <button class="btn btn-sm ${obj.align === 'left' ? 'btn-primary' : ''}" data-al="left" title="左揃え">左</button>
        <button class="btn btn-sm ${obj.align === 'center' ? 'btn-primary' : ''}" data-al="center" title="中央揃え">中</button>
        <button class="btn btn-sm ${obj.align === 'right' ? 'btn-primary' : ''}" data-al="right" title="右揃え">右</button>
      </div>
      <div class="ctx-group">
        <button class="btn btn-sm ${curValign === 'top' ? 'btn-primary' : ''}" data-val="top" title="上揃え">上</button>
        <button class="btn btn-sm ${curValign === 'middle' ? 'btn-primary' : ''}" data-val="middle" title="上下中央">央</button>
        <button class="btn btn-sm ${curValign === 'bottom' ? 'btn-primary' : ''}" data-val="bottom" title="下揃え">下</button>
      </div>
    `;

    const fontEl = bar.querySelector('#ctx-t-font');
    fontEl.addEventListener('change', () => {
      obj.fontFamily = fontEl.value;
      const match = fonts.find(f => f.family === obj.fontFamily);
      if (match) obj.fontWeight = match.weight;
      if (api.loadGoogleFont) api.loadGoogleFont(obj.fontFamily);
      api.pushHistory();
      api.updateAllUI();
      if (document.fonts) {
        document.fonts.load(`${obj.fontWeight} ${obj.fontSize}px ${obj.fontFamily}`).then(() => api.render());
      }
    });

    const bind = (sel, key, num = false) => {
      const el = bar.querySelector(sel);
      if (!el) return;
      el.addEventListener('input', () => { obj[key] = num ? Number(el.value) : el.value; api.render(); });
      el.addEventListener('change', () => { api.pushHistory(); api.renderProperties(); });
    };
    bind('#ctx-t-size', 'fontSize', true);
    bind('#ctx-t-col', 'color');
    bind('#ctx-t-scol', 'strokeColor');
    bind('#ctx-t-sw', 'strokeWidth', true);
    bar.querySelectorAll('[data-al]').forEach(b => {
      b.onclick = () => { obj.align = b.dataset.al; api.pushHistory(); api.updateAllUI(); };
    });
    bar.querySelectorAll('[data-val]').forEach(b => {
      b.onclick = () => { obj.vAlign = b.dataset.val; api.pushHistory(); api.updateAllUI(); };
    });
  },

  renderProperties(container, obj, api) {
    const fonts = api.getFontList ? api.getFontList() : [];
    const fontOptions = fonts.map(f => `<option value='${f.family}' ${obj.fontFamily === f.family ? 'selected' : ''}>${f.name}</option>`).join('');
    const curValign = obj.vAlign || 'top';

    container.innerHTML = `
      <div class="field">
        <label>テキスト（ダブルクリックで直接編集可）</label>
        <textarea id="txt-val" rows="3"></textarea>
      </div>
      <div class="field">
        <label>フォントファミリー</label>
        <select id="txt-font" style="width:100%;">${fontOptions}</select>
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
        <div class="field"><label>横揃え</label>
          <select id="txt-align">
            <option value="left" ${obj.align==='left'?'selected':''}>左揃え</option>
            <option value="center" ${obj.align==='center'?'selected':''}>中央揃え</option>
            <option value="right" ${obj.align==='right'?'selected':''}>右揃え</option>
          </select>
        </div>
        <div class="field"><label>縦揃え</label>
          <select id="txt-valign">
            <option value="top" ${curValign==='top'?'selected':''}>上揃え</option>
            <option value="middle" ${curValign==='middle'?'selected':''}>上下中央</option>
            <option value="bottom" ${curValign==='bottom'?'selected':''}>下揃え</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>文字色</label><input type="color" id="txt-color" value="${obj.color}"></div>
        <div class="field"><label>フチ色</label><input type="color" id="txt-sc" value="${obj.strokeColor}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>フチ太さ</label><input type="number" id="txt-sw" min="0" max="40" value="${obj.strokeWidth}"></div>
      </div>
    `;
    container.querySelector('#txt-val').value = obj.text || '';

    const fontEl = container.querySelector('#txt-font');
    fontEl.addEventListener('change', () => {
      obj.fontFamily = fontEl.value;
      const match = fonts.find(f => f.family === obj.fontFamily);
      if (match) obj.fontWeight = match.weight;
      if (api.loadGoogleFont) api.loadGoogleFont(obj.fontFamily);
      api.pushHistory();
      api.updateAllUI();
      if (document.fonts) {
        document.fonts.load(`${obj.fontWeight} ${obj.fontSize}px ${obj.fontFamily}`).then(() => api.render());
      }
    });

    const bind = (sel, key, num = false) => {
      const el = container.querySelector(sel);
      if (!el) return;
      el.addEventListener('input', () => { obj[key] = num ? Number(el.value) : el.value; api.render(); });
      el.addEventListener('change', () => { api.pushHistory(); api.renderContextBar(); });
    };
    bind('#txt-val', 'text');
    bind('#txt-size', 'fontSize', true);
    bind('#txt-weight', 'fontWeight');
    bind('#txt-ls', 'letterSpacing', true);
    bind('#txt-lh', 'lineHeight', true);
    bind('#txt-align', 'align');
    bind('#txt-valign', 'vAlign');
    bind('#txt-color', 'color');
    bind('#txt-sc', 'strokeColor');
    bind('#txt-sw', 'strokeWidth', true);
  }
});
