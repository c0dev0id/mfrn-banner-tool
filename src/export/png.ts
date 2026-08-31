/** "Sunset Ride.JPG" -> "sunset-ride" */
export function slugify(filename: string): string {
  const stem = filename.replace(/\.[^./\\]+$/, '');
  const slug = stem
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'banner';
}

export function exportFilename(sourceName: string, width: number, height: number): string {
  return `${slugify(sourceName)}-${width}x${height}.png`;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the PNG.'))),
      'image/png',
    );
  });
}

export async function downloadCanvasAsPng(
  canvas: HTMLCanvasElement,
  sourceName: string,
): Promise<void> {
  const blob = await canvasToPngBlob(canvas);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFilename(sourceName, canvas.width, canvas.height);
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next frame; revoking synchronously can cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
