/**
 * スタート画面（ホーム）・最近のプロジェクト・自動保存プラグイン（PIXELIA用）
 * - 起動時オーバーレイ表示（新規作成プリセット / 最近使ったプロジェクト一覧）
 * - 2分ごとの自動保存（オートセーブ）＆ 縮小プレビュー付き履歴管理
 * - ヘッダーに「ホーム」ボタンを自動追加
 */
ThumbStudio.registerPlugin({
  id: 'v2-home-launcher',
  name: 'ホーム',

  init(api) {
    const RECENT_KEY = 'pixelia_recent_projects_v1';
    const AUTOSAVE_KEY = 'pixelia_autosave_v1';
    const MAX_RECENT = 8;

    let currentProjectId = 'proj_' + Date.now();
    let currentProjectName = '無題のプロジェクト';

    // サイズプリセット定義
    const PRESETS = [
      { label: 'YouTube サムネイル', w: 1280, h: 720, icon: 'fa-brands fa-youtube' },
      { label: 'SNS 正方形バナー', w: 1080, h: 1080, icon: 'fa-regular fa-square' },
      { label: 'X (Twitter) 投稿画像', w: 1200, h: 675, icon: 'fa-solid fa-image' },
      { label: '縦長ストーリー / リール', w: 1080, h: 1920, icon: 'fa-solid fa-mobile-screen' }
    ];

    // 縮小サムネイル（DataURL）を生成して容量を節約
    function createThumbnailDataUrl() {
      try {
        const vp = document.getElementById('viewport');
        if (!vp) return '';
        const off = document.createElement('canvas');
        const targetW = 320;
        const ratio = (api.state.height || 720) / (api.state.width || 1280);
        off.width = targetW;
        off.height = Math.round(targetW * ratio);
        const octx = off.getContext('2d');

        // 背景塗り
        octx.fillStyle = api.state.bgColor || '#ffffff';
        octx.fillRect(0, 0, off.width, off.height);

        // アートボード領域を現在の表示キャンバスから簡易転写
        const z = api.state.zoom || 1;
        const sx = api.state.panX || 0;
        const sy = api.state.panY || 0;
        const sw = (api.state.width || 1280) * z;
        const sh = (api.state.height || 720) * z;
        octx.drawImage(vp, sx, sy, sw, sh, 0, 0, off.width, off.height);

        return off.toDataURL('image/jpeg', 0.65);
      } catch (e) {
        return '';
      }
    }

    // 保存用シリアライズデータ作成（imgElement等のDOM参照を除外）
    function serializeProject(nameOverride) {
      const cleanObjects = (api.state.objects || []).map(obj => {
        const copy = { ...obj };
        delete copy.imgElement;
        return copy;
      });
      return {
        id: currentProjectId,
        name: nameOverride || currentProjectName,
        updatedAt: Date.now(),
        width: api.state.width,
        height: api.state.height,
        bgColor: api.state.bgColor,
        thumb: createThumbnailDataUrl(),
        objects: cleanObjects
      };
    }

    function loadRecentList() {
      try {
        const raw = localStorage.getItem(RECENT_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
      } catch (e) {
        return [];
      }
    }

    function saveRecentList(list) {
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
      } catch (e) {
        // 容量超過時はサムネイルを削って再試行
        try {
          const slim = list.slice(0, 4).map(item => ({ ...item, thumb: '' }));
          localStorage.setItem(RECENT_KEY, JSON.stringify(slim));
        } catch (e2) {}
      }
    }

    // 現在の作品を「最近のプロジェクト」へ保存
    function recordCurrentToRecent(customName) {
      if (!api.state.objects || api.state.objects.length === 0) return;
      const data = serializeProject(customName);
      const list = loadRecentList().filter(item => item.id !== data.id);
      list.unshift(data);
      saveRecentList(list);
    }

    // 自動保存（オートセーブ）実行
    function runAutoSave() {
      if (!api.state.objects || api.state.objects.length === 0) return;
      try {
        const data = serializeProject('自動保存データ');
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
      } catch (e) {}
    }

    function loadAutoSave() {
      try {
        const raw = localStorage.getItem(AUTOSAVE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }

    // プロジェクトデータをキャンバスへ復元
    function restoreProjectData(data, isFromAutoSave = false) {
      if (!data) return;
      currentProjectId = isFromAutoSave ? ('proj_' + Date.now()) : (data.id || ('proj_' + Date.now()));
      currentProjectName = isFromAutoSave ? '復元されたプロジェクト' : (data.name || '無題のプロジェクト');

      api.state.width = data.width || 1280;
      api.state.height = data.height || 720;
      api.state.bgColor = data.bgColor || '#ffffff';
      api.state.objects = Array.isArray(data.objects) ? JSON.parse(JSON.stringify(data.objects)) : [];
      api.state.selectedIds = [];

      if (api.setArtboard) {
        api.setArtboard(api.state.width, api.state.height, api.state.bgColor);
      }
      api.pushHistory();
      api.updateAllUI();
      if (api.fitArtboard) api.fitArtboard();
    }

    // スタート画面オーバーレイの構築
    const overlay = document.createElement('div');
    overlay.id = 'pixelia-home-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(15, 23, 42, 0.94);
      backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      padding: 20px; overflow-y: auto;
    `;

    function formatTime(ts) {
      if (!ts) return '';
      const d = new Date(ts);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      return `${mm}/${dd} ${hh}:${mi}`;
    }

    function renderHomeScreen() {
      const recents = loadRecentList();
      const autoSaved = loadAutoSave();

      const presetHtml = PRESETS.map(p => `
        <button class="home-preset-btn" data-w="${p.w}" data-h="${p.h}" data-label="${p.label}" style="
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
          padding: 14px 10px; border-radius: 8px; border: 1px solid var(--border);
          background: var(--bg-panel); color: var(--text-main); cursor: pointer; transition: 0.15s;
        ">
          <i class="${p.icon}" style="font-size: 20px; color: var(--accent);"></i>
          <span style="font-size: 12px; font-weight: 600;">${p.label}</span>
          <span style="font-size: 10px; color: var(--text-muted);">${p.w} × ${p.h}</span>
        </button>
      `).join('');

      const recentCardsHtml = recents.map((item, idx) => `
        <div class="home-recent-card" data-idx="${idx}" style="
          position: relative; border-radius: 8px; border: 1px solid var(--border);
          background: var(--bg-panel); overflow: hidden; cursor: pointer; display: flex; flex-direction: column;
        ">
          <div style="height: 92px; background: #0f172a; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            ${item.thumb
              ? `<img src="${item.thumb}" style="width:100%; height:100%; object-fit:contain;">`
              : `<i class="fa-regular fa-file-image" style="font-size:24px; color:var(--text-muted);"></i>`
            }
          </div>
          <div style="padding: 8px; display: flex; flex-direction: column; gap: 2px;">
            <div style="font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${item.name || '無題'}
            </div>
            <div style="font-size: 10px; color: var(--text-muted); display: flex; justify-content: space-between;">
              <span>${item.width}×${item.height}</span>
              <span>${formatTime(item.updatedAt)}</span>
            </div>
          </div>
          <button class="home-del-recent" data-idx="${idx}" title="履歴から削除" style="
            position: absolute; top: 4px; right: 4px; width: 22px; height: 22px;
            border-radius: 50%; border: none; background: rgba(0,0,0,0.65); color: #fff;
            font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center;
          ">✕</button>
        </div>
      `).join('');

      overlay.innerHTML = `
        <div style="
          width: 100%; max-width: 820px; background: var(--bg-app);
          border: 1px solid var(--border); border-radius: 12px;
          padding: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          display: flex; flex-direction: column; gap: 20px; color: var(--text-main);
        ">
          <!-- ヘッダー＆ロゴアニメーション枠 -->
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); padding-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <video id="home-logo-video" src="pixelia_B_pixel.mp4" autoplay muted playsinline style="height: 44px; border-radius: 6px; display: none;"></video>
              <div id="home-logo-fallback" style="font-size: 22px; font-weight: 800; letter-spacing: 0.08em; color: var(--text-main);">
                PIXELIA
              </div>
              <span style="font-size: 12px; color: var(--text-muted);">サムネイル・バナー制作スタジオ</span>
            </div>
            <button class="btn btn-sm" id="home-close-editor">現在のキャンバスへ戻る ✕</button>
          </div>

          ${autoSaved && autoSaved.objects && autoSaved.objects.length > 0 ? `
            <div style="
              display: flex; align-items: center; justify-content: space-between; gap: 12px;
              padding: 10px 14px; border-radius: 8px;
              background: rgba(79, 140, 255, 0.12); border: 1px solid var(--accent);
            ">
              <div style="font-size: 12px;">
                <strong style="color: var(--accent);">自動保存データがあります</strong>
                <span style="color: var(--text-muted); margin-left: 8px;">最終更新: ${formatTime(autoSaved.updatedAt)}（${autoSaved.objects.length}レイヤー）</span>
              </div>
              <button class="btn btn-sm btn-primary" id="home-restore-auto">続きから復元する</button>
            </div>
          ` : ''}

          <!-- 新規作成セクション -->
          <div>
            <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 8px;">
              新規作成（キャンバスサイズを選択）
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px;">
              ${presetHtml}
            </div>
          </div>

          <!-- 最近使ったプロジェクト -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 12px; font-weight: 700; color: var(--text-muted);">
                最近使ったプロジェクト（自動保存履歴）
              </span>
              <button class="btn btn-sm btn-primary" id="home-save-current">
                <i class="fa-solid fa-bookmark"></i> 今の作業を履歴に保存
              </button>
            </div>
            ${recents.length > 0
              ? `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(175px, 1fr)); gap: 10px;">${recentCardsHtml}</div>`
              : `<div style="padding: 24px; text-align: center; border: 1px dashed var(--border); border-radius: 8px; color: var(--text-muted); font-size: 12px;">
                  まだ保存されたプロジェクトはありません。「新規作成」から始めてください。
                </div>`
            }
          </div>
        </div>
      `;

      // 動画ファイルが存在すれば表示してフォールバック文字を隠す
      const vid = overlay.querySelector('#home-logo-video');
      const fallback = overlay.querySelector('#home-logo-fallback');
      if (vid && fallback) {
        vid.addEventListener('loadeddata', () => {
          vid.style.display = 'block';
          fallback.style.display = 'none';
        });
      }

      // 新規作成プリセットクリック
      overlay.querySelectorAll('.home-preset-btn').forEach(btn => {
        btn.onclick = () => {
          // 現在の作業があれば履歴へ退避
          recordCurrentToRecent();

          const w = Number(btn.dataset.w);
          const h = Number(btn.dataset.h);
          currentProjectId = 'proj_' + Date.now();
          currentProjectName = btn.dataset.label + ' (' + formatTime(Date.now()) + ')';

          api.state.objects = [];
          api.state.selectedIds = [];
          api.setArtboard(w, h, '#ffffff');
          api.pushHistory();
          api.updateAllUI();
          if (api.fitArtboard) api.fitArtboard();
          closeHome();
        };
      });

      // 最近のプロジェクト復元
      overlay.querySelectorAll('.home-recent-card').forEach(card => {
        card.onclick = (e) => {
          if (e.target.closest('.home-del-recent')) return;
          const idx = Number(card.dataset.idx);
          const list = loadRecentList();
          if (list[idx]) {
            restoreProjectData(list[idx], false);
            closeHome();
          }
        };
      });

      // 履歴から個別削除
      overlay.querySelectorAll('.home-del-recent').forEach(delBtn => {
        delBtn.onclick = (e) => {
          e.stopPropagation();
          const idx = Number(delBtn.dataset.idx);
          const list = loadRecentList();
          list.splice(idx, 1);
          saveRecentList(list);
          renderHomeScreen();
        };
      });

      // 自動保存データの復元
      overlay.querySelector('#home-restore-auto')?.addEventListener('click', () => {
        if (autoSaved) {
          restoreProjectData(autoSaved, true);
          closeHome();
        }
      });

      // 今の作業を履歴に手動保存
      overlay.querySelector('#home-save-current')?.addEventListener('click', () => {
        if (!api.state.objects || api.state.objects.length === 0) {
          alert('キャンバスに要素が配置されていません。');
          return;
        }
        const name = prompt('プロジェクト名を入力してください：', currentProjectName);
        if (name === null) return;
        currentProjectName = name.trim() || currentProjectName;
        recordCurrentToRecent(currentProjectName);
        renderHomeScreen();
      });

      // 閉じる
      overlay.querySelector('#home-close-editor')?.addEventListener('click', closeHome);
    }

    function openHome() {
      recordCurrentToRecent();
      renderHomeScreen();
      overlay.style.display = 'flex';
    }

    function closeHome() {
      overlay.style.display = 'none';
    }

    document.body.appendChild(overlay);

    // 上部ヘッダーに「ホーム」ボタンを追加
    const header = document.querySelector('header') || document.querySelector('.topbar');
    if (header) {
      const homeBtn = document.createElement('button');
      homeBtn.className = 'btn btn-sm';
      homeBtn.innerHTML = '<i class="fa-solid fa-house"></i> ホーム';
      homeBtn.title = 'スタート画面を開く（新規作成・最近のプロジェクト）';
      homeBtn.style.marginLeft = '8px';
      homeBtn.onclick = openHome;
      header.appendChild(homeBtn);
    }

    // 2分ごとの自動保存タイマー
    setInterval(runAutoSave, 2 * 60 * 1000);

    // ページを閉じる直前にも自動保存＆最近のプロジェクト更新
    window.addEventListener('beforeunload', () => {
      runAutoSave();
      recordCurrentToRecent();
    });

    // 初回起動時はスタート画面を表示
    renderHomeScreen();
  }
});
