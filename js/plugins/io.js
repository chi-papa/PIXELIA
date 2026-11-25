/**
 * プロジェクトJSON保存／読み込み ＋ PNG/JPEG書き出しプラグイン（PIXELIA / Font Awesome対応）
 */
(() => {
  function saveProjectJSON(api) {
    const cleanObjects = api.state.objects.map(o => {
      const copy = { ...o };
      delete copy.imgElement;
      return copy;
    });
    const payload = {
      app: 'PIXELIA',
      version: '2.0',
      width: api.state.width,
      height: api.state.height,
      bgColor: api.state.bgColor,
      objects: cleanObjects
    };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    a.download = `pixelia_project_${ts}.json`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportImage(api, mime, ext) {
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    a.download = `pixelia_${ts}.${ext}`;
    a.href = api.exportDataURL(mime, 0.92);
    a.click();
  }

  ThumbStudio.registerPlugin({
    id: 'v2-project-io',
    name: 'プロジェクト読込',
    init(api) {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json,application/json';
      fileInput.id = 'v2-json-loader';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);

      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            if (!data || !Array.isArray(data.objects)) throw new Error('Invalid format');
            api.state.width = data.width || 1000;
            api.state.height = data.height || 1000;
            api.state.bgColor = data.bgColor ?? '#ffffff';
            api.state.objects = data.objects;
            api.state.selectedIds = [];
            api.setArtboard(api.state.width, api.state.height, api.state.bgColor);

            // キャンバスタブUIの同期
            const cvW = document.getElementById('cv-w');
            const cvH = document.getElementById('cv-h');
            const cvBg = document.getElementById('cv-bg');
            if (cvW) cvW.value = api.state.width;
            if (cvH) cvH.value = api.state.height;
            if (cvBg && api.state.bgColor !== 'transparent') cvBg.value = api.state.bgColor;
          } catch (err) {
            alert('プロジェクトファイルの読み込みに失敗しました。');
          }
        };
        reader.readAsText(file);
        fileInput.value = '';
      });

      // ショートカット：Ctrl+S（JSON保存） / Ctrl+Shift+E（PNG書出）
      window.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        const k = e.key.toLowerCase();
        if (k === 's') {
          e.preventDefault();
          saveProjectJSON(api);
        } else if (e.shiftKey && k === 'e') {
          e.preventDefault();
          exportImage(api, 'image/png', 'png');
        }
      });
    },
    headerButton: {
      label: '<i class="fa-regular fa-folder-open"></i> 読込',
      primary: false,
      onClick() {
        document.getElementById('v2-json-loader').click();
      }
    }
  });

  ThumbStudio.registerPlugin({
    id: 'v2-project-save',
    name: 'プロジェクト保存',
    headerButton: {
      label: '<i class="fa-regular fa-floppy-disk"></i> 保存',
      primary: false,
      onClick: (api) => saveProjectJSON(api)
    }
  });

  ThumbStudio.registerPlugin({
    id: 'v2-export-png',
    name: 'PNG書出',
    headerButton: {
      label: '<i class="fa-solid fa-download"></i> PNG',
      primary: true,
      onClick: (api) => exportImage(api, 'image/png', 'png')
    }
  });

  ThumbStudio.registerPlugin({
    id: 'v2-export-jpg',
    name: 'JPG書出',
    headerButton: {
      label: '<i class="fa-solid fa-download"></i> JPG',
      primary: false,
      onClick: (api) => exportImage(api, 'image/jpeg', 'jpg')
    }
  });
})();
