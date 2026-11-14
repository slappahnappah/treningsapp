/** Kopierer tekst til utklippstavla. Returnerer false hvis nettleseren nekter. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Eldre nettlesere og visninger uten tilgang til utklippstavla.
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

/** Åpner delingsarket med tekst. Returnerer false hvis deling ikke er støttet. */
export async function shareText(text: string): Promise<boolean> {
  if (!navigator.share) return false;
  try {
    await navigator.share({ text });
  } catch {
    // Brukeren lukket delingsarket.
  }
  return true;
}

/** Lagrer en fil: delingsarket på telefon når det støtter filer, ellers vanlig nedlasting. */
export async function saveFile(name: string, content: string, type: string): Promise<void> {
  const file = new File([content], name, { type });
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
