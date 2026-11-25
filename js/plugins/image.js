/**
 * 画像レイヤープラグイン（D&D・色調補正・角丸・フィット対応 / PIXELIA用）
 */
ThumbStudio.registerPlugin({
  id: 'v2-image-layer',
  name: '画像',
  objectType: 'image',
  layerIcon: '<i class="fa-regular fa-image"></i>',

  init(api) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.id = 'v2-image-picker';
    input.style.display = 'none';
    document.body.appendChild(input);

    const loadImageFile = (file) => {
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        const img = new Image();
        img.onload = () => {
          const maxW = api.state.width * 0.85;
          const maxH = api.state.height * 0.85;
          const scale = Math.min(maxW / img.width, maxH / img.height, 1);
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          api.addObject({
            type: 'image',
            name: file.name.replace(/\.[^.]+$/, ''),
            x: Math.round((api.state.width - w) / 2),
            y: Math.round((api.state.height - h) / 2),
            w,
            h,
            imgSrc: dataUrl,
            imgElement: img,
            radius: 0,
            brightness: 100,
            contrast: 100,
            saturation: 100
          });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    };

    input.addEventListener('change', (e) => {
      if (e.target.files[0]) loadImageFile(e.target.files[0]);
      input.value = '';
    });

    const stage = document.getElementById('stage-wrap');
    stage.addEventListener('dragover', (e) => e.preventDefault());
    stage.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        loadImageFile(e.dataTransfer.files[0]);
      }
    });
  },

  toolButton: {
    icon: '<i class="fa-regular fa-image"></i>',
    label: '画像',
    title: '画像を配置（画面へドラッグ＆ドロップも可）',
    onClick() {
      document.getElementById('v2-image-picker').click();
    }
  },

  renderObject(ctx, obj, api) {
    if (!obj.imgElement && obj.imgSrc) {
      const img = new Image();
      img.onload = () => api.render();
      img.src = obj.imgSrc;
      obj.imgElement = img;
      return;
    }
    if (!obj.imgElement || !obj.imgElement.complete) return;

    ctx.save();

    // 色調補正フィルターの適用 (明るさ・コントラスト・彩度)
    const b = obj.brightness ?? 100;
    const c = obj.contrast ?? 100;
    const s = obj.saturation ?? 100;
    if (b !== 100 || c !== 100 || s !== 100) {
      ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
    }

    const r = obj.radius || 0;
    if (r > 0) {
      ctx.beginPath();
      ctx.roundRect(obj.x, obj.y, obj.w, obj.h, r);
      ctx.clip();
    }
    ctx.drawImage(obj.imgElement, obj.x, obj.y, obj.w, obj.h);

    ctx.restore();
  },

  renderContextBar(bar, obj, api) {
    bar.innerHTML = `
      <div class="ctx-group">
        <span class="ctx-label">画像</span>
        <button class="btn btn-sm" id="ctx-img-fit">アートボードに合わせる</button>
      </div>
      <div class="ctx-group">
        <span class="ctx-label">角丸</span>
        <input type="number" id="ctx-img-rad" min="0" max="500" value="${obj.radius || 0}" style="width:62px;">
      </div>
    `;
    bar.querySelector('#ctx-img-fit').onclick = () => {
      obj.x = 0; obj.y = 0; obj.w = api.state.width; obj.h = api.state.height; obj.rotation = 0;
      api.pushHistory(); api.updateAllUI();
    };
    const rad = bar.querySelector('#ctx-img-rad');
    rad.addEventListener('input', () => { obj.radius = Number(rad.value); api.render(); });
    rad.addEventListener('change', () => { api.pushHistory(); api.renderProperties(); });
  },

  renderProperties(container, obj, api) {
    container.innerHTML = `
      <div class="field">
        <label>角丸 (${obj.radius || 0}px)</label>
        <input type="range" id="img-rad" min="0" max="300" value="${obj.radius || 0}">
      </div>
      <button class="btn" id="img-fit-btn">アートボードいっぱいに合わせる</button>
    `;
    const rad = container.querySelector('#img-rad');
    rad.addEventListener('input', () => {
      obj.radius = Number(rad.value);
      rad.previousElementSibling.textContent = `角丸 (${obj.radius}px)`;
      api.render();
    });
    rad.addEventListener('change', () => { api.pushHistory(); api.renderContextBar(); });
    container.querySelector('#img-fit-btn').onclick = () => {
      obj.x = 0; obj.y = 0; obj.w = api.state.width; obj.h = api.state.height; obj.rotation = 0;
      api.pushHistory(); api.updateAllUI();
    };
  }
});
