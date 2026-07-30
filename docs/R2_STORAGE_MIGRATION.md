# R2 Storage Migration

## File: `src/lib/verification.js`

### Add import

```jsx
import { uploadToR2, getR2Url, deleteFromR2 } from './r2'
```

### uploadVerificationDoc — upload

**Before:**
```jsx
const { error: upErr } = await supabase.storage
  .from('verification-docs')
  .upload(path, file, { upsert: false, contentType: file.type || undefined })
if (upErr) throw upErr
```

**After:**
```jsx
const url = await uploadToR2(file, 'verification-docs/' + path)
if (!url) throw new Error('Upload failed')
```

### uploadVerificationDoc — cleanup on DB failure

**Before:**
```jsx
try { await supabase.storage.from('verification-docs').remove([path]) } catch { /* ignore */ }
```

**After:**
```jsx
try { await deleteFromR2('verification-docs/' + path) } catch { /* ignore */ }
```

### deleteVerificationDocument

**Before:**
```jsx
await supabase.storage.from('verification-docs').remove([doc.storage_path])
```

**After:**
```jsx
await deleteFromR2('verification-docs/' + doc.storage_path)
```

### uploadPaymentReceipt

**Before:**
```jsx
const { error: upErr } = await supabase.storage
  .from('verification-docs')
  .upload(path, file, { upsert: false, contentType: file.type || undefined })
if (upErr) throw upErr
```

**After:**
```jsx
const url = await uploadToR2(file, 'verification-docs/' + path)
if (!url) throw new Error('Upload failed')
```

### createVerificationDocSignedUrl (NOT CHANGED)

No R2 equivalent — uses `createSignedUrl` which has no matching export in `r2.js`.

```jsx
const { data, error } = await supabase.storage
  .from('verification-docs')
  .createSignedUrl(storagePath, expiresIn)
if (error) throw error
return data?.signedUrl || null
```

---

## Pattern

| Supabase Storage | R2 Utility |
|---|---|
| `supabase.storage.from('BUCKET').upload(path, file, opts)` | `uploadToR2(file, 'BUCKET/' + path)` |
| `supabase.storage.from('BUCKET').getPublicUrl(path)` | `getR2Url('BUCKET/' + path)` |
| `supabase.storage.from('BUCKET').remove([path])` | `deleteFromR2('BUCKET/' + path)` |

## R2 Utility

Located at `src/lib/r2.js`. Exports:
- `uploadToR2(file, path)` → public URL string
- `deleteFromR2(path)` → deletes file
- `getR2Url(path)` → returns public URL string
