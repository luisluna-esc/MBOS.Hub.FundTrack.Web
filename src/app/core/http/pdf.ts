import { saveBlob } from './save-blob';

// Igual que InvenTrack: Chrome en Android no muestra PDFs dentro de la página ni en una pestaña
// abierta desde un archivo temporal; ahí el PDF se descarga con un nombre legible.

/** true si el navegador puede mostrar un PDF (false en Chrome de Android). */
export function canPreviewPdf(): boolean {
  return (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled !== false;
}

/**
 * Pestaña en blanco abierta en el mismo clic: si se abre después de un await, el navegador la
 * bloquea como ventana emergente. En celulares no se abre porque el PDF se va a descargar.
 */
export function openPdfTab(): Window | null {
  return canPreviewPdf() ? window.open('', '_blank') : null;
}

/** Muestra el PDF en la pestaña de openPdfTab() (para imprimirlo desde ahí) o lo descarga. */
export function showPdf(blob: Blob, fileName: string, tab: Window | null): void {
  if (!canPreviewPdf()) {
    tab?.close();
    saveBlob(blob, fileName);
    return;
  }
  const url = URL.createObjectURL(blob);
  if (tab) {
    tab.location.href = url;
  } else {
    window.open(url, '_blank');
  }
}
