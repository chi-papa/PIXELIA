/**
 * 定型カラーパレットプラグイン（PIXELIA用・洗練版）
 * - 適用先1クリック切替 ＋ クリア（なし）チップ
 * - ドキュメントカラー（使用中カラー）の自動抽出
 * - 文字色⇔フチ色などの「色反転」ボタン
 * - 写真やキャンバスから拾える「EyeDropperスポイト」
 */
ThumbStudio.registerPlugin({
  id: 'v2-color-palette',
  name: 'カラー',
  tab: {
    id: 'palette',
    label: 'カラー',
    mount(container, api) {
      const STORAGE_KEY = 'pixelia_brand_palette_v2';

      const DEFAULT_COLORS = [
        { name: 'ホワイト', hex: '#ffffff' },
        { name: 'ブラック', hex: '#111111' },
        { name: 'チャコール', hex: '#1e293b' },
        { name: 'PIXELIA青', hex: '#0099ff' },
        { name: 'PIXELIAピンク', hex: '#ff1e8e' },
        { name: 'PIXELIA黄', hex: '#ffb400' },
        { name: '訴求レッド', hex: '#d92d20' },
        { name: '蛍光イエロー', hex: '#ffe600' },
        { name: 'エメラルド', hex: '#10b981' },
        { name: 'ネイビー', hex: '#1d4ed8' }
      ];

      function loadColors() {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length) return parsed;
          }
        } catch (e) {}
        return DEFAULT_COLORS.map(c => ({ ...c }));
      }

      function saveColors(list) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } catch (e) {}
      }

      let colors = loadColors();
      let currentTarget = 'main'; // 'main' | 'stroke' | 'subtext' | 'shadow' | 'canvas'
      let deleteMode = false;

      container.innerHTML = `
        <!-- 1. 適用先セグメントボタン -->
        <div class="field">
          <label>適用先</label>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:4px;" id="pal-targets">
            <button class="btn btn-sm active" data-target="main">塗り/文字</button>
            <button class="btn btn-sm" data-target="stroke">枠線/フチ</button>
            <button class="btn btn-sm" data-target="subtext">サブ文字</button>
            <button class="btn btn-sm" data-target="shadow">影色</button>
            <button class="btn btn-sm" data-target="canvas">背景</button>
            <button class="btn btn-sm" id="pal-invert" title="選択中オブジェクトの色を反転・入れ替え">⇄ 反転</button>
          </div>
        </div>

        <!-- 2. ドキュメントカラー（使用中カラーの自動抽出） -->
        <div class="field" id="doc-colors-wrap" style="display:none;">
          <label style="color:var(--accent);">この作品で使用中の色</label>
          <div id="doc-grid" style="display:flex; gap:4px; flex-wrap:wrap; padding:2px 0;"></div>
        </div>

        <!-- 3. ブランドカラーパレット -->
        <div class="field">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label>ブランドパレット（クリックで適用）</label>
            <button class="btn btn-sm" id="pal-del-mode" title="削除モード切替">
              <i class="fa-regular fa-trash-can"></i> 削除
            </button>
          </div>
          <div id="pal-grid" style="display:grid; grid-template-columns:repeat(6, 1fr); gap:6px; padding:4px 0;"></div>
        </div>

        <!-- 4. カラー追加 ＆ スポイト -->
        <div style="border-top:1px solid var(--border); padding-top:8px; display:flex; flex-direction:column; gap:6px;">
          <label style="font-size:11px; color:var(--text-muted); font-weight:600;">新しいカラーを追加</label>
          <div style="display:flex; gap:6px; align-items:center;">
            <input type="color" id="pal-picker" value="#4f8cff" style="width:38px; height:28px; flex-shrink:0; border-radius:4px;">
            <input type="text" id="pal-hex" value="#4f8cff" placeholder="#000000" style="width:76px; font-family:monospace;">
            <input type="text" id="pal-name" placeholder="色名（任意）" style="flex:1;">
          </div>
          <div class="field-row">
            <button class="btn btn-primary" id="pal-add">
              <i class="fa-solid fa-plus"></i> 追加
            </button>
            <button class="btn" id="pal-dropper" title="画面上のどこからでも色をスポイト抽出" style="display:none;">
              <i class="fa-solid fa-eye-dropper"></i> スポイト
            </button>
          </div>
        </div>

        <div style="border-top:1px solid var(--border); padding-top:8px; display:flex; justify-content:flex-end;">
          <button class="btn btn-sm" id="pal-reset" style="color:var(--text-muted);">
            <i class="fa-solid fa-rotate-left"></i> 初期パレットに戻す
          </button>
        </div>
      `;

      const targetsWrap = container.querySelector('#pal-targets');
      const docColorsWrap = container.querySelector('#doc-colors-wrap');
      const docGrid = container.querySelector('#doc-grid');
      const gridEl = container.querySelector('#pal-grid');
      const delModeBtn = container.querySelector('#pal-del-mode');
      const pickerEl = container.querySelector('#pal-picker');
      const hexEl = container.querySelector('#pal-hex');
      const nameEl = container.querySelector('#pal-name');
      const dropperBtn = container.querySelector('#pal-dropper');

      // EyeDropper API（ブラウザ対応時のみ表示）
      if (window.EyeDropper) {
        dropperBtn.style.display = 'inline-flex';
        dropperBtn.onclick = async () => {
          try {
            const dropper = new EyeDropper();
            const res = await dropper.open();
            if (res && res.sRGBHex) {
              pickerEl.value = res.sRGBHex;
              hexEl.value = res.sRGBHex;
            }
          } catch (e) {}
        };
      }

      // 適用先ボタンの切り替え制御
      targetsWrap.querySelectorAll('[data-target]').forEach(btn => {
        btn.onclick = () => {
          targetsWrap.querySelectorAll('[data-target]').forEach(b => b.classList.remove('active', 'btn-primary'));
          btn.classList.add('active', 'btn-primary');
          currentTarget = btn.dataset.target;
        };
      });
      // 初期状態で「塗り/文字」を選択状態に
      targetsWrap.querySelector('[data-target="main"]').classList.add('btn-primary');

      // 色適用処理（nullの場合は「なし（クリア）」）
      function applyColor(hex) {
        if (currentTarget === 'canvas') {
          api.setArtboard(null, null, hex || '#ffffff');
          const cvBg = document.getElementById('cv-bg');
          if (cvBg) cvBg.value = hex || '#ffffff';
          return;
        }

        const sels = api.getSelectedObjects().filter(o => !o.locked);
        if (!sels.length) return;

        for (const o of sels) {
          if (currentTarget === 'main') {
            if (o.type === 'text') o.color = hex || '#000000';
            else if (o.type === 'shape') o.fill = hex || 'transparent';
            else if (o.type === 'badge') o.bgColor = hex || '#d92d20';
          } else if (currentTarget === 'stroke') {
            if (o.type === 'text') {
              o.strokeColor = hex || '#ffffff';
              if (hex && !o.strokeWidth) o.strokeWidth = 6;
              if (!hex) o.strokeWidth = 0;
            } else if (o.type === 'shape') {
              o.stroke = hex || '#000000';
              if (hex && !o.strokeWidth) o.strokeWidth = 4;
              if (!hex) o.strokeWidth = 0;
            } else if (o.type === 'badge') {
              o.borderColor = hex || '#ffffff';
              if (hex && !o.borderWidth) o.borderWidth = 4;
              if (!hex) o.borderWidth = 0;
            }
          } else if (currentTarget === 'subtext') {
            if (o.type === 'badge') o.textColor = hex || '#ffffff';
            else if (o.type === 'text') o.color = hex || '#000000';
          } else if (currentTarget === 'shadow') {
            o.shadowColor = hex || 'rgba(0,0,0,0.5)';
            if (hex) {
              if (!o.shadowBlur) o.shadowBlur = 12;
              if (!o.shadowY) o.shadowY = 4;
            } else {
              o.shadowBlur = 0; o.shadowX = 0; o.shadowY = 0;
            }
          }
        }
        api.pushHistory();
        api.updateAllUI();
        updateDocColors();
      }

      // 色反転ボタン（文字色⇔フチ色、塗り⇔枠線など）
      container.querySelector('#pal-invert').onclick = () => {
        const sels = api.getSelectedObjects().filter(o => !o.locked);
        if (!sels.length) return;
        for (const o of sels) {
          if (o.type === 'text') {
            const tmp = o.color; o.color = o.strokeColor; o.strokeColor = tmp;
          } else if (o.type === 'shape') {
            const tmp = o.fill; o.fill = o.stroke; o.stroke = tmp;
          } else if (o.type === 'badge') {
            const tmp = o.bgColor; o.bgColor = o.textColor; o.textColor = tmp;
          }
        }
        api.pushHistory();
        api.updateAllUI();
      };

      // ドキュメントカラー（使用中カラー）の自動抽出
      function updateDocColors() {
        const used = new Set();
        api.state.objects.forEach(o => {
          if (o.color && o.color !== 'transparent') used.add(o.color.toLowerCase());
          if (o.fill && o.fill !== 'transparent') used.add(o.fill.toLowerCase());
          if (o.stroke && o.stroke !== 'transparent' && o.strokeWidth > 0) used.add(o.stroke.toLowerCase());
          if (o.strokeColor && o.strokeColor !== 'transparent' && o.strokeWidth > 0) used.add(o.strokeColor.toLowerCase());
          if (o.bgColor && o.bgColor !== 'transparent') used.add(o.bgColor.toLowerCase());
          if (o.borderColor && o.borderColor !== 'transparent' && o.borderWidth > 0) used.add(o.borderColor.toLowerCase());
        });

        const list = Array.from(used);
        if (list.length === 0) {
          docColorsWrap.style.display = 'none';
          return;
        }

        docColorsWrap.style.display = 'block';
        docGrid.innerHTML = '';
        list.forEach(hex => {
          const chip = document.createElement('button');
          chip.title = `使用中の色: ${hex}`;
          chip.style.cssText = `
            width: 26px; height: 26px; border-radius: 4px; background: ${hex};
            border: 1px solid rgba(255,255,255,0.3); cursor: pointer;
            box-shadow: inset 0 0 0 1px rgba(0,0,0,0.2);
          `;
          chip.onclick = () => applyColor(hex);
          docGrid.appendChild(chip);
        });
      }

      // パレット描画（先頭に「なし/クリア」チップを常設）
      function renderGrid() {
        gridEl.innerHTML = '';

        // 先頭の「なし（解除）」チップ
        const noneBtn = document.createElement('button');
        noneBtn.title = '現在の適用先を「なし（透明・0）」にする';
        noneBtn.style.cssText = `
          position: relative; height: 32px; border-radius: 5px; background: var(--bg-app);
          border: 1px dashed var(--text-muted); cursor: pointer; display: flex;
          align-items: center; justify-content: center; color: var(--text-muted); font-size: 10px;
        `;
        noneBtn.innerHTML = 'なし';
        noneBtn.onclick = () => applyColor(null);
        gridEl.appendChild(noneBtn);

        colors.forEach((c, idx) => {
          const btn = document.createElement('button');
          btn.title = deleteMode ? `削除: ${c.name || c.hex}` : `${c.name || c.hex} (${c.hex})`;
          btn.style.cssText = `
            position: relative; height: 32px; border-radius: 5px; background: ${c.hex};
            border: 1px solid ${deleteMode ? 'var(--danger)' : 'rgba(255,255,255,0.25)'};
            cursor: pointer; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.2);
          `;
          if (deleteMode) {
            btn.innerHTML = `<span style="position:absolute; top:-5px; right:-5px; width:15px; height:15px; border-radius:50%; background:var(--danger); color:#fff; font-size:9px; display:flex; align-items:center; justify-content:center;">✕</span>`;
          }
          btn.onclick = () => {
            if (deleteMode) {
              colors.splice(idx, 1);
              saveColors(colors);
              renderGrid();
            } else {
              applyColor(c.hex);
            }
          };
          gridEl.appendChild(btn);
        });
      }

      pickerEl.addEventListener('input', () => { hexEl.value = pickerEl.value; });
      hexEl.addEventListener('input', () => {
        const v = hexEl.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(v)) pickerEl.value = v;
      });

      container.querySelector('#pal-add').onclick = () => {
        let hex = hexEl.value.trim();
        if (!/^#[0-9a-fA-F]{6}$/.test(hex)) hex = pickerEl.value;
        const name = nameEl.value.trim() || hex.toUpperCase();
        colors.push({ name, hex: hex.toLowerCase() });
        saveColors(colors);
        nameEl.value = '';
        renderGrid();
      };

      delModeBtn.onclick = () => {
        deleteMode = !deleteMode;
        delModeBtn.classList.toggle('btn-danger', deleteMode);
        delModeBtn.innerHTML = deleteMode
          ? '<i class="fa-solid fa-check"></i> 完了'
          : '<i class="fa-regular fa-trash-can"></i> 削除';
        renderGrid();
      };

      container.querySelector('#pal-reset').onclick = () => {
        if (!confirm('初期パレットに戻しますか？')) return;
        colors = DEFAULT_COLORS.map(c => ({ ...c }));
        saveColors(colors);
        deleteMode = false;
        delModeBtn.classList.remove('btn-danger');
        delModeBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i> 削除';
        renderGrid();
      };

      renderGrid();
      updateDocColors();
    }
  }
});
