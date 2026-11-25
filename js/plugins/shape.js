/**
 * 図形・帯レイヤープラグイン（四角・角丸・楕円）
 */
ThumbStudio.registerPlugin({
  id: 'v2-shape-layer',
  name: '図形',
  objectType: 'shape',
  layerIcon: '■',

  toolButton: {
    icon: '■',
    label: '図形',
    title: '長方形・帯・円を追加',
    onClick(api) {
      api.addObject({
        type: 'shape',
        name: '図形・帯',
        shapeType: 'rect',
        x: Math.round(api.state.width * 0.1),
        y: Math.round(api.state.height * 0.75),
        w: Math.round(api.state.width * 0.8),
        h: 140,
        fill: '#1e293b',
        stroke: '#000000',
        strokeWidth: 0,
        radius: 0
      });
    }
  },

  renderObject(ctx, obj) {
    ctx.beginPath();
    if (obj.shapeType === 'ellipse') {
      ctx.ellipse(obj.x + obj.w / 2, obj.y + obj.h / 2, obj.w / 2, obj.h / 2, 0, 0, Math.PI * 2);
    } else {
      ctx.roundRect(obj.x, obj.y, obj.w, obj.h, obj.radius || 0);
    }
    if (obj.fill && obj.fill !== 'transparent') {
      ctx.fillStyle = obj.fill;
      ctx.fill();
    }
    if (obj.strokeWidth > 0) {
      ctx.strokeStyle = obj.stroke || '#000000';
      ctx.lineWidth = obj.strokeWidth;
      ctx.stroke();
    }
  },

  renderContextBar(bar, obj, api) {
    bar.innerHTML = `
      <div class="ctx-group">
        <span class="ctx-label">塗り</span>
        <input type="color" id="ctx-s-fill" value="${obj.fill}" style="width:32px; height:24px;">
        <span class="ctx-label">枠線</span>
        <input type="color" id="ctx-s-str" value="${obj.stroke}" style="width:32px; height:24px;">
        <input type="number" id="ctx-s-sw" min="0" max="50" value="${obj.strokeWidth || 0}" style="width:48px;">
      </div>
      <div class="ctx-group">
        <span class="ctx-label">角丸</span>
        <input type="number" id="ctx-s-rad" min="0" value="${obj.radius || 0}" style="width:54px;">
      </div>
    `;
    const bind = (sel, key, num = false) => {
      const el = bar.querySelector(sel);
      el.addEventListener('input', () => { obj[key] = num ? Number(el.value) : el.value; api.render(); });
      el.addEventListener('change', () => { api.pushHistory(); api.renderProperties(); });
    };
    bind('#ctx-s-fill', 'fill');
    bind('#ctx-s-str', 'stroke');
    bind('#ctx-s-sw', 'strokeWidth', true);
    bind('#ctx-s-rad', 'radius', true);
  },

  renderProperties(container, obj, api) {
    container.innerHTML = `
      <div class="field-row">
        <div class="field"><label>形状</label>
          <select id="shp-type">
            <option value="rect" ${obj.shapeType==='rect'?'selected':''}>長方形・帯</option>
            <option value="ellipse" ${obj.shapeType==='ellipse'?'selected':''}>円・楕円</option>
          </select>
        </div>
        <div class="field"><label>角丸 (px)</label><input type="number" id="shp-rad" min="0" value="${obj.radius || 0}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>塗り色</label><input type="color" id="shp-fill" value="${obj.fill}"></div>
        <div class="field"><label>枠線色</label><input type="color" id="shp-stroke" value="${obj.stroke}"></div>
      </div>
      <div class="field"><label>枠線の太さ (px)</label><input type="number" id="shp-sw" min="0" max="50" value="${obj.strokeWidth || 0}"></div>
    `;
    const bind = (sel, key, num = false) => {
      const el = container.querySelector(sel);
      el.addEventListener('input', () => { obj[key] = num ? Number(el.value) : el.value; api.render(); });
      el.addEventListener('change', () => { api.pushHistory(); api.renderContextBar(); });
    };
    bind('#shp-type', 'shapeType');
    bind('#shp-rad', 'radius', true);
    bind('#shp-fill', 'fill');
    bind('#shp-stroke', 'stroke');
    bind('#shp-sw', 'strokeWidth', true);
  }
});
