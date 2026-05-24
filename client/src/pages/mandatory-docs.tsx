import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';

interface MandatoryDocStatus {
  key: string;
  title: string;
  description: string;
  uploaded: boolean;
  documentId: number | null;
  filename: string | null;
  expiryDate: string | null;
  status: string | null;
}

interface CreateDocumentPayload {
  title: string;
  description: string;
  filename: string;
  fileContent: string;
  fileType: string;
  status: string;
  deadline: string; // expiry date
}

const MandatoryDocs: React.FC = () => {
  const qc = useQueryClient();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [expiry, setExpiry] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ mandatory: MandatoryDocStatus[] }>(['mandatory-docs'], async () => {
    const r = await apiRequest('GET', '/api/mandatory-docs');
    return r.json();
  }, { staleTime: 10_000 });

  const createDocMutation = useMutation(async (payload: CreateDocumentPayload) => {
    const r = await apiRequest('POST', '/api/documents', payload);
    return r.json();
  }, {
    onSuccess: () => {
      qc.invalidateQueries(['mandatory-docs']);
      setSelectedKey(null);
      setFile(null);
      setExpiry('');
    }
  });

  const toBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const beginUpload = (key: string) => {
    setSelectedKey(key);
    setFile(null);
    setExpiry('');
    setError(null);
  };

  const submit = async () => {
    if (!selectedKey) return;
    setUploading(true);
    setError(null);
    try {
      if (!file) throw new Error('Choose a file');
      if (!expiry) throw new Error('Select expiry date');
      const statusItem = data?.mandatory.find(m => m.key === selectedKey);
      if (!statusItem) throw new Error('Invalid document key');
      const b64 = await toBase64(file);
      await createDocMutation.mutateAsync({
        title: statusItem.title,
        description: statusItem.description,
        filename: file.name,
        fileContent: b64,
        fileType: statusItem.key,
        status: 'required',
        deadline: expiry,
      });
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const renderBadge = (uploaded: boolean, status: string | null) => {
    if (!uploaded) return <Badge variant="outline" className="text-xs bg-neutral-100">Missing</Badge>;
    return <Badge variant="outline" className="text-xs bg-green-100 text-green-700">{status || 'Uploaded'}</Badge>;
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-2">Mandatory Documents</h2>
      <p className="text-sm text-neutral-600 mb-4">Upload all required identification / permit documents with their expiry dates.</p>
      {isLoading && <div>Loading…</div>}
      <div className="grid gap-4 md:grid-cols-2">
        {data?.mandatory.map(m => (
          <Card key={m.key} className="shadow-sm">
            <CardContent className="pt-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-medium">{m.title}</h3>
                  <p className="text-xs text-neutral-600 mt-1">{m.description}</p>
                </div>
                {renderBadge(m.uploaded, m.status)}
              </div>
              {m.expiryDate && (
                <p className="text-xs mb-2">Expiry: {format(new Date(m.expiryDate), 'MMM d, yyyy')}</p>
              )}
              {!m.uploaded && (
                <Button size="sm" onClick={() => beginUpload(m.key)}>Upload</Button>
              )}
              {m.uploaded && m.documentId && m.filename && (
                <Button size="sm" variant="outline" onClick={async () => {
                  try {
                    const p = new URLSearchParams({ filename: m.filename });
                    const r = await apiRequest('GET', `/api/documents/sas?${p.toString()}`);
                    const d = await r.json();
                    if (d.sasUrl) window.open(d.sasUrl, '_blank', 'noopener,noreferrer');
                  } catch (e) {
                    alert('Could not generate link');
                  }
                }}>View Secure</Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedKey && (
        <div className="mt-6 p-4 border rounded-lg bg-white max-w-md">
          <h3 className="font-medium mb-2">Upload {selectedKey.replace('_',' ')}</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="file">File</Label>
              <Input id="file" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            <div>
              <Label htmlFor="expiry">Expiry Date</Label>
              <Input id="expiry" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={submit} disabled={uploading || !file || !expiry}>
                {uploading ? 'Uploading…' : 'Submit'}
              </Button>
              <Button variant="outline" onClick={() => { setSelectedKey(null); setError(null); }} disabled={uploading}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MandatoryDocs;
