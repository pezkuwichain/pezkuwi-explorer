// The stored keystore is already encrypted; this only hands it to the browser as a file.
export const exportFileName = (address: string) => `i-wallet-${address.slice(0, 6)}….json`;

export function downloadJson(filename: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked after the download has started (Safari needs the URL to outlive the click).
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
