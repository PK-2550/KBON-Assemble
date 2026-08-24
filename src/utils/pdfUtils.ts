/**
 * PDF and File Helper Utilities
 * Converts Data URLs (base64) to Object Blob URLs to prevent blank screens
 * caused by Chromium / Safari blocking top-level data: navigation.
 */

export function createBlobUrlFromDataUrl(dataUrlOrUrl: string): string {
  if (!dataUrlOrUrl) return '';
  if (!dataUrlOrUrl.startsWith('data:')) {
    return dataUrlOrUrl;
  }

  try {
    const parts = dataUrlOrUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
    const base64Data = parts[1];
    
    // Decode base64
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const blob = new Blob([byteNumbers], { type: mime });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('Error creating Blob URL from Data URL:', err);
    return dataUrlOrUrl;
  }
}

export function openPdfDocument(dataUrlOrUrl: string, fileName?: string): void {
  if (!dataUrlOrUrl) return;
  try {
    const blobUrl = createBlobUrlFromDataUrl(dataUrlOrUrl);
    
    // Safely trigger download or open via standard programmatic anchor without cross-origin target leak
    const link = document.createElement('a');
    link.href = blobUrl;
    link.rel = 'noopener noreferrer';
    const effectiveName = fileName 
      ? (fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`)
      : 'durian_document.pdf';
    link.download = effectiveName;
    document.body.appendChild(link);
    
    // Defer click to avoid blocking synchronous React render phase
    setTimeout(() => {
      try {
        link.click();
      } catch (clickErr) {
        console.warn('Deferred link click failed:', clickErr);
      } finally {
        setTimeout(() => {
          try {
            if (link.parentNode) {
              link.parentNode.removeChild(link);
            }
          } catch {
            // ignore if already removed
          }
        }, 300);
      }
    }, 0);
  } catch (err) {
    console.warn('Could not process document via link:', err);
  }
}

export function downloadPdfDocument(dataUrlOrUrl: string, fileName: string = 'document.pdf'): void {
  if (!dataUrlOrUrl) return;
  try {
    const blobUrl = createBlobUrlFromDataUrl(dataUrlOrUrl);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.rel = 'noopener noreferrer';
    link.download = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    document.body.appendChild(link);
    
    // Defer click to avoid blocking synchronous React render phase
    setTimeout(() => {
      try {
        link.click();
      } catch (clickErr) {
        console.warn('Deferred download link click failed:', clickErr);
      } finally {
        setTimeout(() => {
          try {
            if (link.parentNode) {
              link.parentNode.removeChild(link);
            }
          } catch {
            // ignore
          }
        }, 300);
      }
    }, 0);
  } catch (err) {
    console.warn('Could not download document:', err);
  }
}

