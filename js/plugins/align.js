/**
 * 整列・等間隔分布タブプラグイン
 */
ThumbStudio.registerPlugin({
  id: 'v2-align-tab',
  name: '整列',
  tab: {
    id: 'align',
    label: '整列',
    mount(container, api) {
      container.innerHTML = `
        <div class="field">
          <label>整列の基準</label>
          <select id="al-base">
            <option value="auto">自動（1個ならボード / 複数なら選択範囲）</option>
            <option value="artboard">常にアートボード基準</option>
          </select>
        </div>
        <div class="field">
          <label>オブジェクトの整列</label>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;">
            <button class="btn" data-al="left">⇤ 左揃え</button>
            <button class="btn" data-al="centerH">↔ 水平中央</button>
            <button class="btn" data-al="right">⇥ 右揃え</button>
            <button class="btn" data-al="top">⤒ 上揃え</button>
            <button class="btn" data-al="centerV">↕ 垂直中央</button>
            <button class="btn" data-al="bottom">⤓ 下揃え</button>
          </div>
        </div>
        <div class="field">
          <label>等間隔に分布（3個以上選択時）</label>
          <div class="field-row">
            <button class="btn" data-dist="h">水平に均等</button>
            <button class="btn" data-dist="v">垂直に均等</button>
          </div>
        </div>
      `;

      const baseEl = container.querySelector('#al-base');

      container.querySelectorAll('[data-al]').forEach(btn => {
        btn.addEventListener('click', () => {
          const sels = api.getSelectedObjects().filter(o => !o.locked);
          if (!sels.length) return;

          const useBoard = baseEl.value === 'artboard' || sels.length === 1;
          let minX = 0, maxX = api.state.width, minY = 0, maxY = api.state.height;

          if (!useBoard) {
            minX = Math.min(...sels.map(o => o.x));
            maxX = Math.max(...sels.map(o => o.x + o.w));
            minY = Math.min(...sels.map(o => o.y));
            maxY = Math.max(...sels.map(o => o.y + o.h));
          }

          const mode = btn.dataset.al;
          for (const o of sels) {
            if (mode === 'left') o.x = Math.round(minX);
            if (mode === 'centerH') o.x = Math.round((minX + maxX - o.w) / 2);
            if (mode === 'right') o.x = Math.round(maxX - o.w);
            if (mode === 'top') o.y = Math.round(minY);
            if (mode === 'centerV') o.y = Math.round((minY + maxY - o.h) / 2);
            if (mode === 'bottom') o.y = Math.round(maxY - o.h);
          }
          api.pushHistory();
          api.updateAllUI();
        });
      });

      container.querySelectorAll('[data-dist]').forEach(btn => {
        btn.addEventListener('click', () => {
          const sels = api.getSelectedObjects().filter(o => !o.locked);
          if (sels.length < 3) return;
          const axis = btn.dataset.dist;

          if (axis === 'h') {
            const sorted = [...sels].sort((a, b) => a.x - b.x);
            const first = sorted[0];
            const last = sorted[sorted.length - 1];
            const totalW = sorted.reduce((sum, o) => sum + o.w, 0);
            const gap = ((last.x + last.w) - first.x - totalW) / (sorted.length - 1);
            let curX = first.x;
            for (const o of sorted) {
              o.x = Math.round(curX);
              curX += o.w + gap;
            }
          } else {
            const sorted = [...sels].sort((a, b) => a.y - b.y);
            const first = sorted[0];
            const last = sorted[sorted.length - 1];
            const totalH = sorted.reduce((sum, o) => sum + o.h, 0);
            const gap = ((last.y + last.h) - first.y - totalH) / (sorted.length - 1);
            let curY = first.y;
            for (const o of sorted) {
              o.y = Math.round(curY);
              curY += o.h + gap;
            }
          }
          api.pushHistory();
          api.updateAllUI();
        });
      });
    }
  }
});
