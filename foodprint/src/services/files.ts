import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
export async function exportFile(content: string, name: string, mime = 'application/json') {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable on this device.');
  const file = new File(Paths.cache, name);
  file.write(content);
  try { await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: 'Export your Bellywise diary', UTI: mime === 'application/json' ? 'public.json' : 'public.plain-text' }); }
  finally { if (file.exists) file.delete(); }
}
export async function importFile(): Promise<string | undefined> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return;
  const file = new File(result.assets[0].uri);
  try { if (file.size > 20_000_000) throw new Error('Choose a backup smaller than 20 MB.'); return await file.text(); }
  finally { if (file.exists) file.delete(); }
}
