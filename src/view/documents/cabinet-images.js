import { esc, pageShell } from './_util.js';

/** Only embedded raster images can enter delivery documents and offline exports. */
export function isDocumentImage(value) {
  return typeof value === 'string' && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

export function renderCabinetImage({ cabinetImage } = {}) {
  const body = isDocumentImage(cabinetImage)
    ? `<figure class="cabinet-image-card"><div class="cabinet-image-frame"><img src="${cabinetImage}" alt="当前方案的三维配电箱图"></div><figcaption>当前方案的三维视图，用于了解设备布置与箱内空间。</figcaption></figure>`
    : '<div class="doc-empty">暂无三维配电箱图。请等待三维视图加载完成后重新导出。</div>';
  return pageShell('三维配电箱方案图', body, 'doc-cabinet-image', '此图由当前方案生成，供布置沟通参考；实际安装情况请对照现场照片与实物核对。');
}

export function renderSitePhoto({ design } = {}) {
  const photo = design?.sitePhoto;
  if (!isDocumentImage(photo?.dataUrl)) return '';
  const name = String(photo.name || '现场照片');
  const displayName = name.length > 160 ? `${name.slice(0, 157)}…` : name;
  const body = `<figure class="cabinet-image-card"><div class="cabinet-image-frame cabinet-image-frame--photo"><img src="${photo.dataUrl}" alt="用户上传的配电箱安装现场照片"></div><figcaption>照片文件：${esc(displayName)}</figcaption></figure>`;
  return pageShell('配电箱现场实拍', body, 'doc-cabinet-image', '本页为用户上传的安装现场照片，用于交接记录。照片不代表已完成检查或验收，请结合检查与验收单确认。');
}
