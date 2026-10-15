import jsQR from 'jsqr';

// Decodes in the browser; frames never leave the device. The camera is always released.
export async function scanQr(video: HTMLVideoElement, signal: AbortSignal): Promise<string> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  try {
    video.srcObject = stream;
    await video.play();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    while (!signal.aborted) {
      await new Promise((r) => requestAnimationFrame(r));
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      if (!canvas.width) continue;
      ctx.drawImage(video, 0, 0);
      const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
      // Wallet QR codes may be "substrate:<address>:<pubkey>:<name>"; take the address part.
      if (code?.data) return code.data.startsWith('substrate:') ? code.data.split(':')[1] : code.data;
    }
    throw new DOMException('aborted', 'AbortError');
  } finally {
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  }
}
