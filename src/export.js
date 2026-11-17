// ============================================================
// 导出工具：JSON / 骰娘 .st 字符串 / 图片 / PDF
// ============================================================
import { character, skillValue, getAllocation, effectiveAttributes } from './store.js';
import { skills, skillNameAlias, getEraSkillList } from './data/skills.js';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// ---- JSON ----
export function exportJSON() {
  return JSON.stringify(JSON.parse(JSON.stringify(character)), null, 2);
}

export function downloadText(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadJSON() {
  downloadText(`${character.name || 'investigator'}.json`, exportJSON(), 'application/json');
}

// ---- 花名册备份（lz-string 压缩后的 JSON） ----
export function downloadRosterBackup(text) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  downloadText(`调查员备份_${stamp}.coc.json`, text, 'application/json');
}

// ---- 骰娘 .st 字符串 ----
function displayName(name) {
  return name.replace(/Ω/g, '');
}

export function buildStString() {
  const a = effectiveAttributes.value;
  const str = (k) => a[k] != null ? a[k] : 0;
  const parts = [`.st`];

  // 属性
  const attrSeg = [
    ['str', '力量', 'str'], ['dex', '敏捷', 'dex'], ['con', '体质', 'con'], ['app', '外貌', 'app'],
    ['int', '智力', 'int'], ['pow', '意志', 'pow'], ['siz', '体型', 'siz'], ['edu', '教育', 'edu'],
    ['luc', '幸运', 'luck'],
  ];
  attrSeg.forEach(([k, cn, en]) => {
    const v = str(k);
    parts.push(`${cn}${v} ${en}${v} `);
    if (k === 'int') parts.push(`灵感${v} `);
    if (k === 'luc') parts.push(`运气${v} `);
  });

  // 衍生
  const hp = character.derivedOverrides?.hp ?? Math.floor(((a.con || 0) + (a.siz || 0)) / 10);
  const mp = character.derivedOverrides?.mp ?? Math.floor((a.pow || 0) / 5);
  const san = character.derivedOverrides?.san ?? (a.pow || 0);
  parts.push(`hp${hp} 体力${hp} mp${mp} 魔法${mp} san${san} 理智${san} 理智值${san} san值${san}`);

  // 技能
  const emitted = new Set();
  const emit = (name, val) => {
    const dn = displayName(name);
    parts.push(`${dn}${val}`);
    const aliases = skillNameAlias[name];
    if (aliases) aliases.forEach(al => parts.push(`${al}${val}`));
    emitted.add(name);
  };

  skills.forEach((sk) => {
    const name = sk.name;
    if (!name) return; // 自定义技能占位
    if (sk.group && (sk.group.skills.length || name === '自定义')) {
      // 分组技能：输出每个子技能
      const children = character.groupedOrder[name] || [];
      children.forEach((childName) => {
        const key = `${name}(${childName})`;
        const val = skillValue(key);
        const alloc = getAllocation(key);
        const hasPoint = (alloc.pro || 0) + (alloc.interest || 0) + (alloc.growth || 0) + (alloc.package || 0) > 0;
        if (childName && (hasPoint || sk.group.show.includes(childName) || name === '母语')) {
          emit(childName, val);
          if (name === '母语') emit('母语', val);
        }
      });
    } else {
      // 所有标准技能：无论是否分配点数，均输出当前值（含初始值，如 信用评级0 / 克苏鲁神话0）
      emit(name, skillValue(name));
    }
  });

  // 时代技能（当前时代的扩展技能，如 战术/造梦/拾荒 等）：
  // 无论是否分配点数，均输出当前值（含初始值，如 预言0 / 梦境学问0）
  getEraSkillList(character.era).forEach((sk) => {
    const name = sk.name;
    if (!name || emitted.has(name)) return;
    emit(name, skillValue(name));
  });

  return parts.join(' ');
}

export function downloadSt() {
  const st = buildStString();
  // 复制到剪贴板 + 下载
  if (navigator.clipboard) navigator.clipboard.writeText(st).catch(() => {});
  downloadText(`${character.name || 'investigator'}.st.txt`, st);
}

export function copySt() {
  const st = buildStString();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(st).then(() => {
      return true;
    }).catch(() => {});
  }
  return st;
}

// ---- html2canvas 兼容修补 ----
// html2canvas 1.4.1 渲染 linear-gradient 背景时，会按元素的浮点尺寸新建离屏 canvas：
//   canvas.width = width;  // 0.59 → 0，赋值即取整
//   if (width > 0 && height > 0) pattern = ctx.createPattern(canvas, 'repeat');  // 守卫仍按 0.59 放行
// 于是宽或高不足 1px 的元素（1px 分隔线被布局压缩、页面缩放、不同字号组合都会出现）
// 会让 createPattern 抛 InvalidStateError，整次导出失败。
// 这里把退化尺寸的图案换成 1×1 透明画布：该元素本身不足 1px，视觉上没有区别。
let patternGuardInstalled = false;
function installPatternGuard() {
  if (patternGuardInstalled) return;
  const proto = typeof CanvasRenderingContext2D !== 'undefined' && CanvasRenderingContext2D.prototype;
  if (!proto || typeof proto.createPattern !== 'function') return;
  const orig = proto.createPattern;
  const blank = document.createElement('canvas');
  blank.width = 1;
  blank.height = 1;
  proto.createPattern = function (image, repeat) {
    const w = image && image.width;
    const h = image && image.height;
    if (typeof w === 'number' && typeof h === 'number' && (!isFinite(w) || !isFinite(h) || w < 1 || h < 1)) {
      return orig.call(this, blank, repeat);
    }
    return orig.call(this, image, repeat);
  };
  patternGuardInstalled = true;
}

// 统一渲染入口：正常路径失败且属于 createPattern 退化异常时，
// 去掉克隆树的背景图重试一次（卡片底色是白纸，只丢渐变装饰），保证至少能出文件。
async function capture(el, options) {
  installPatternGuard();
  try {
    return await html2canvas(el, options);
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (!/createPattern|width or height of 0/i.test(msg)) throw e;
    return await html2canvas(el, {
      ...options,
      onclone: (doc) => {
        const style = doc.createElement('style');
        style.textContent = '*,*::before,*::after{background-image:none!important}';
        doc.head.appendChild(style);
      },
    });
  }
}

// ---- 图片 / PDF ----
// 微信等内嵌浏览器不执行 a.download，导出前先识别环境
export function isEmbeddedBrowser() {
  try { return /MicroMessenger|QQ\/|FB_IAB|Line\//i.test(navigator.userAgent); } catch (e) { return false; }
}

// 通用下载触发：Blob URL 的兼容性远好于 data URL（后者在移动端常被静默吞掉）
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 延迟回收，给慢速浏览器留足落盘时间
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return url;
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    if (canvas.toBlob) canvas.toBlob((b) => resolve(b), 'image/png');
    else resolve(null);
  });
}

export async function exportImage(el, name) {
  const canvas = await capture(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#161d18',
  });
  const blob = await canvasToBlob(canvas);
  if (blob) return triggerDownload(blob, `${name || 'investigator'}.png`);
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `${name || 'investigator'}.png`;
  a.click();
}

export async function exportPDF(el, name) {
  const canvas = await capture(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;
  let heightLeft = imgH;
  let position = 0;
  pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
  heightLeft -= pageH;
  while (heightLeft > 0) {
    position -= pageH;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
    heightLeft -= pageH;
  }
  pdf.save(`${name || 'investigator'}.pdf`);
}

// 导出多张纸：每张纸一页 PDF（正反面）
export async function exportPDFPages(elements, name) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  for (let i = 0; i < elements.length; i++) {
    if (!elements[i]) continue;
    const canvas = await capture(elements[i], { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    // 纸张比例即 A4，直接铺满一页
    const ratio = pageW / canvas.width;
    const imgH = canvas.height * ratio;
    if (imgH <= pageH + 1) {
      pdf.addImage(imgData, 'PNG', 0, 0, pageW, imgH);
    } else {
      // 兜底：若超出，按高度适配
      const r2 = pageH / canvas.height;
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width * r2, pageH);
    }
    if (i < elements.length - 1) pdf.addPage();
  }
  const blob = pdf.output('blob');
  if (blob) return triggerDownload(blob, `${name || 'investigator'}.pdf`);
  pdf.save(`${name || 'investigator'}.pdf`);
}

// 导出多张图片（每张纸一张 PNG）
export async function exportImages(elements, name) {
  for (let i = 0; i < elements.length; i++) {
    if (!elements[i]) continue;
    const canvas = await capture(elements[i], { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const suffix = elements.length > 1 ? `-${i + 1}` : '';
    const blob = await canvasToBlob(canvas);
    if (blob) {
      triggerDownload(blob, `${name || 'investigator'}${suffix}.png`);
    } else {
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${name || 'investigator'}${suffix}.png`;
      a.click();
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}
