export async function exportFile(content: string, name: string, mime = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function importFile(): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
    input.oncancel = () => resolve(undefined);
    input.onchange = async () => {
      try { const file = input.files?.[0]; if (!file) return resolve(undefined); if (file.size > 20_000_000) throw new Error('Choose a backup smaller than 20 MB.'); resolve(await file.text()); }
      catch (error) { reject(error); }
    };
    input.click();
  });
}