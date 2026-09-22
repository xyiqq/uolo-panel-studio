/** Decode locally and store a bounded JPEG with browser-corrected camera orientation. */
export async function readSitePhoto(file) {
  if(!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 照片');
  if(file.size>12*1024*1024) throw new Error('照片不能超过 12 MB，请先缩小图片');
  const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('照片无法读取，请重新选择有效图片');});
  try {
    const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    let dataUrl=canvas.toDataURL('image/jpeg',.84);
    if(dataUrl.length>1200000)dataUrl=canvas.toDataURL('image/jpeg',.65);
    if(dataUrl.length>1500000)throw new Error('照片压缩后仍过大，请选择尺寸更小的图片');
    return {dataUrl,name:file.name.slice(0,160)};
  } finally {bitmap.close();}
}
