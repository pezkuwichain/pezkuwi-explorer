import qrcode from 'qrcode-generator';

// The address as a QR code, made on the device (qrcode-generator, MIT). The result is an SVG path of 1×1
// squares on a size×size grid, so it renders under the CSP with no image or script from elsewhere.
export function qrModules(text: string): { size: number; path: string } {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const size = qr.getModuleCount();
  let path = '';
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (qr.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
  return { size, path };
}
