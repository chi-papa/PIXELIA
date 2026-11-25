/**
 * 定型カラーパレットプラグイン（PIXELIA用）
 * - ブランドカラーの登録・削除（localStorageに自動保存）
 * - ワンクリック適用（文字色／塗り・枠線／フチ・影色・キャンバス背景）
 * - 複数選択の一括適用＆選択中オブジェクトの色をそのまま登録
 */
ThumbStudio.registerPlugin({
  id: 'v2-color-palette',
  name: 'カラー',
  tab: {
    id: 'palette',
    label: 'カラー',
    mount(container, api) {
      const STORAGE_KEY = 'pixelia_brand_palette_v1';

      // 初期プリセット（PIXELIAカラー＋サムネイル定番色）
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
      let deleteMode = false;

      container.innerHTML = `
        <div class="field">
          <label>ワンクリック時の適用先</label>
          <select id="pal-target">
            <option value="main">メイン色（文字色 / 図形の塗り / バッジ背景）</option>
            <option value="stroke">枠線・フチ色</option>
            <option value="subtext">バッジの文字色</option>
            <option value="shadow">ドロップシャドウ（影色）</option>
            <option value="canvas">キャンバス背景色</option>
          </select>
        </div>

        <div class="field">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label>登録済みカラー（クリックで適用）</label>
            <button class="btn btn-sm" id="pal-del-mode" title="削除モード切替">
              <i class="fa-regular fa-trash-can"></i> 削除
            </button>
          </div>
          <div id="pal-grid" style="display:grid; grid-template-columns:repeat(5, 1fr); gap:6px; padding:4px 0;"></div>
        </div>

        <div style="border-top:1px solid var(--border); padding-top:8px; display:flex; flex-direction:column; gap:6px;">
          <label style="font-size:11px; color:var(--text-muted); font-weight:600;">新しいブランドカラーを登録</label>
          <div style="display:flex; gap:6px; align-items:center;">
            <input type="color" id="pal-picker" value="#4f8cff" style="width:42px; height:28px; flex-shrink:0;">
            <input type="text" id="pal-hex" value="#4f8cff" placeholder="#000000" style="width:82px; font-family:monospace;">
            <input type="text" id="pal-name" placeholder="色名（任意）">
          </div>
          <div class="field-row">
            <button class="btn btn-primary" id="pal-add">
              <i class="fa-solid fa-plus"></i> パレットに追加
            </button>
            <button class="btn" id="pal-pick-sel" title="選択中オブジェクトの色を取り込む">
              <i class="fa-solid fa-eye-dropper"></i> 選択色を取込
            </button>
          </div>
        </div>

        <div style="border-top:1px solid var(--border); padding-top:8px; display:flex; justify-content:flex-end;">
          <button class="btn btn-sm" id="pal-reset" style="color:var(--text-muted);">
            <i class="fa-solid fa-rotate-left"></i> 初期色に戻す
          </button>
        </div>
      `;

      const targetEl = container.querySelector('#pal-target');
      const gridEl = container.querySelector('#pal-grid');
      const delModeBtn = container.querySelector('#pal-del-mode');
      const pickerEl = container.querySelector('#pal-picker');
      const hexEl = container.querySelector('#pal-hex');
      const nameEl = container.querySelector('#pal-name');

      // カラー適用処理
      function applyColor(hex) {
        const target = targetEl.value;

        if (target === 'canvas') {
          api.setArtboard(null, null, hex);
          const cvBg = document.getElementById('cv-bg');
          if (cvBg) cvBg.value = hex;
          return;
        }

        const sels = api.getSelectedObjects().filter(o => !o.locked);
        if (!sels.length) return;

        for (const o of sels) {
          if (target === 'main') {
            if (o.type === 'text') o.color = hex;
            else if (o.type === 'shape') o.fill = hex;
            else if (o.type === 'badge') o.bgColor = hex;
          } else if (target === 'stroke') {
            if (o.type === 'text') {
              o.strokeColor = hex;
              if (!o.strokeWidth) o.strokeWidth = 6;
            } else if (o.type === 'shape') {
              o.stroke = hex;
              if (!o.strokeWidth) o.strokeWidth = 4;
            } else if (o.type === 'badge') {
              o.borderColor = hex;
              if (!o.borderWidth) o.borderWidth = 4;
            }
          } else if (target === 'subtext') {
            if (o.type === 'badge') o.textColor = hex;
            else if (o.type === 'text') o.color = hex;
          } else if (target === 'shadow') {
            o.shadowColor = hex;
            if (!o.shadowBlur && !o.shadowX && !o.shadowY) {
              o.shadowBlur = 12;
              o.shadowY = 4;
            }
          }
        }
        api.pushHistory();
        api.updateAllUI();
      }

      // スウォッチ一覧を描画
      function renderGrid() {
        gridEl.innerHTML = '';
        colors.forEach((c, idx) => {
          const btn = document.createElement('button');
          btn.title = deleteMode
            ? `クリックで削除: ${c.name || c.hex} (${c.hex})`
            : `${c.name || c.hex} (${c.hex})`;
          btn.style.cssText = `
            position: relative;
            height: 34px;
            border-radius: 5px;
            background: ${c.hex};
            border: 1px solid ${deleteMode ? 'var(--danger)' : 'rgba(255,255,255,0.25)'};
            cursor: pointer;
            box-shadow: inset 0 0 0 1px rgba(0,0,0,0.2);
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

      // ピッカーとHEX入力欄の同期
      pickerEl.addEventListener('input', () => {
        hexEl.value = pickerEl.value;
      });
      hexEl.addEventListener('input', () => {
        const v = hexEl.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(v)) pickerEl.value = v;
      });

      // パレットに追加
      container.querySelector('#pal-add').onclick = () => {
        let hex = hexEl.value.trim();
        if (!/^#[0-9a-fA-F]{6}$/.test(hex)) hex = pickerEl.value;
        const name = nameEl.value.trim() || hex.toUpperCase();
        colors.push({ name, hex: hex.toLowerCase() });
        saveColors(colors);
        nameEl.value = '';
        renderGrid();
      };

      // 選択中オブジェクトの色を取り込む
      container.querySelector('#pal-pick-sel').onclick = () => {
        const sel = api.getSelected();
        let hex = null;
        if (sel) {
          if (sel.type === 'text') hex = sel.color;
          else if (sel.type === 'shape') hex = sel.fill;
          else if (sel.type === 'badge') hex = sel.bgColor;
        } else if (api.state.bgColor && api.state.bgColor !== 'transparent') {
          hex = api.state.bgColor;
        }
        if (hex && /^#[0-9a-fA-F]{6}$/i.test(hex)) {
          pickerEl.value = hex;
          hexEl.value = hex;
        }
      };

      // 削除モード切替
      delModeBtn.onclick = () => {
        deleteMode = !deleteMode;
        delModeBtn.classList.toggle('btn-danger', deleteMode);
        delModeBtn.innerHTML = deleteMode
          ? '<i class="fa-solid fa-check"></i> 完了'
          : '<i class="fa-regular fa-trash-can"></i> 削除';
        renderGrid();
      };

      // 初期色に戻す
      container.querySelector('#pal-reset').onclick = () => {
        if (!confirm('登録したカラーを初期プリセットに戻しますか？')) return;
        colors = DEFAULT_COLORS.map(c => ({ ...c }));
        saveColors(colors);
        deleteMode = false;
        delModeBtn.classList.remove('btn-danger');
        delModeBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i> 削除';
        renderGrid();
      };

      renderGrid();
    }
  }
});
