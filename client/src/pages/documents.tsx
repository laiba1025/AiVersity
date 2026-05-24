import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTranslation } from '@/lib/translations';
import { useDocuments } from '@/hooks/use-documents';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const Documents: React.FC = () => {
  const { t } = useTranslation();
  const { documents, isLoading, handleFileSelect, uploadDocument, updateDocumentStatus, getDocumentInfo, isUploading } = useDocuments();
  // Mandatory documents integration
  interface MandatoryDocStatus { key: string; title: string; description: string; uploaded: boolean; documentId: number | null; filename: string | null; expiryDate: string | null; status: string | null; hasBlob?: boolean; hasInline?: boolean; }
  const { data: mandatoryData, isLoading: isMandatoryLoading, refetch: refetchMandatory } = useQuery<{ mandatory: MandatoryDocStatus[] }>({
    queryKey: ['mandatory-docs'],
    queryFn: async () => {
      const r = await apiRequest('GET', '/api/mandatory-docs');
      return r.json();
    },
    staleTime: 10_000,
  });
  const [mandSelectedKey, setMandSelectedKey] = useState<string | null>(null);
  const [mandExpiry, setMandExpiry] = useState<string>('');
  const [mandError, setMandError] = useState<string | null>(null);
  const beginMandatory = (key: string) => { setMandSelectedKey(key); setMandExpiry(''); setMandError(null); };
  const submitMandatory = async () => {
    if (!mandSelectedKey) return;
    try {
      const item = mandatoryData?.mandatory.find(m => m.key === mandSelectedKey);
      if (!item) throw new Error('Invalid mandatory document key');
      if (!mandExpiry) throw new Error('Select expiry date');
      // Reuse existing upload flow (selectedFile already captured via handleFileSelect)
      // Force fileType to mandatory key (overriding native MIME) so backend identification is consistent
      await uploadDocument({
        title: item.title,
        description: item.description,
        status: 'required',
        deadline: new Date(mandExpiry),
        mandatoryKey: item.key,
        // keep real MIME type; mandatoryKey used for matching instead of hijacking fileType
      });
      setMandSelectedKey(null);
      setMandExpiry('');
      setMandError(null);
      refetchMandatory();
    } catch (e: any) {
      setMandError(e.message || 'Upload failed');
    }
  };
  const [quickFile, setQuickFile] = useState<File | null>(null);
  const [quickUploading, setQuickUploading] = useState(false);
  const [quickUrl, setQuickUrl] = useState<string | null>(null);
  const [quickFilename, setQuickFilename] = useState<string | null>(null);
  const showQuick = (import.meta as any).env?.VITE_FEATURE_QUICK_UPLOAD === 'true';

  const quickBlobUpload = async () => {
    if (!quickFile) return;
    setQuickUploading(true);
    setQuickUrl(null);
    try {
      const form = new FormData();
      form.append('file', quickFile);
      const r = await fetch('/api/documents/upload', { method: 'POST', body: form });
      if (!r.ok) throw new Error('Upload failed');
      const data = await r.json();
      if (data.blobUrl) setQuickUrl(data.blobUrl);
      if (data.filename) {
        setQuickFilename(data.filename as string);
      } else if (data.blobUrl) {
        try {
          const u = new URL(data.blobUrl as string);
          const parts = u.pathname.split('/');
          setQuickFilename(parts[parts.length - 1] || null);
        } catch (_) {
          // ignore URL parse errors
        }
      }
    } catch (e) {
      console.error('Quick upload failed', e);
      alert('Upload failed');
    } finally {
      setQuickUploading(false);
    }
  };
  
  const [documentInfo, setDocumentInfo] = useState({
    title: '',
    description: '',
  });
  
  const [documentViewContent, setDocumentViewContent] = useState<{
    title: string;
    content: string;
    fileContent?: string;
    fileType?: string;
    filename?: string;
  } | null>(null);

  const handleUpload = () => {
    uploadDocument({
      ...documentInfo,
      status: 'pending',
      deadline: null,
    });
  };

  const handleViewDocument = async (documentId: number, title: string, fileContent?: string, fileType?: string, filename?: string) => {
    const info = await getDocumentInfo(documentId);
    setDocumentViewContent({
      title,
      content: info,
      fileContent,
      fileType,
      filename,
    });
  };

  const closeDocumentView = () => {
    setDocumentViewContent(null);
  };
  // View mandatory document by id: fetch document and display in modal
  const viewMandatoryById = async (docId: number | null) => {
    if (!docId) return;
    try {
      const r = await fetch(`/api/documents/${docId}`);
      if (!r.ok) throw new Error('Failed to load document');
      const d = await r.json();
      setDocumentViewContent({
        title: d.title,
        content: 'Preview below if supported by your browser.',
        fileContent: d.fileContent,
        fileType: d.fileType,
        filename: d.filename,
      });
    } catch (e) {
      console.error('View mandatory doc failed', e);
      alert('Could not open document');
    }
  };

  // Helper: download inline base64 file
  const downloadInlineFile = () => {
    if (!documentViewContent?.fileContent || !documentViewContent?.fileType) return;
    try {
      const byteChars = atob(documentViewContent.fileContent);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: documentViewContent.fileType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = documentViewContent.fileType.includes('pdf') ? 'pdf' : '';
      a.download = `${documentViewContent.title || 'document'}${ext ? '.' + ext : ''}`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (e) {
      console.error('Download failed', e);
      alert('Could not download file');
    }
  };

  // Helper: open SAS for blob-backed documents
  const openSasForFilename = async (fname?: string) => {
    if (!fname) return;
    try {
      const p = new URLSearchParams({ filename: fname });
      const r = await fetch(`/api/documents/sas?${p.toString()}`);
      if (!r.ok) throw new Error('SAS not available');
      const d = await r.json();
      if (d.sasUrl) window.open(d.sasUrl as string, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error('SAS open failed', e);
      alert('Could not open secure link');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="outline" className="bg-success/10 text-success text-xs px-2 py-1 rounded-full flex items-center">
            <span className="material-icons text-sm mr-1">check_circle</span>
            {t('completed')}
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" className="bg-warning/10 text-warning text-xs px-2 py-1 rounded-full flex items-center">
            <span className="material-icons text-sm mr-1">schedule</span>
            {t('pending')}
          </Badge>
        );
      case 'required':
        return (
          <Badge variant="outline" className="bg-error/10 text-error text-xs px-2 py-1 rounded-full flex items-center">
            <span className="material-icons text-sm mr-1">priority_high</span>
            {t('required')}
          </Badge>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Make a set of mandatory document IDs to filter them out of general list
  const mandatoryIds = new Set((mandatoryData?.mandatory || []).map(m => m.documentId).filter(Boolean) as number[]);
  const nonMandatoryDocuments = documents.filter(d => !mandatoryIds.has(d.id));

  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">{t('documentChecklist')}</h2>
        <p className="text-sm text-neutral-600 mb-4">{t('uploadAndManage')}</p>
        {/* Mandatory Documents Grid */}
        <div className="mb-8">
          <h3 className="text-lg font-medium mb-3">Mandatory Documents</h3>
          {isMandatoryLoading && (
            <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            {mandatoryData?.mandatory.map(m => (
              <Card key={m.key}>
                <CardContent className="pt-5">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium mb-1">{m.title}</h4>
                      <p className="text-xs text-neutral-600">{m.description}</p>
                      {m.expiryDate && (
                        <p className="text-xs mt-1 text-neutral-500">Expiry: {format(new Date(m.expiryDate), 'MMM d, yyyy')}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {m.uploaded && (
                        <Badge variant="outline" className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full">Uploaded</Badge>
                      )}
                      <Button size="sm" onClick={() => beginMandatory(m.key)} disabled={isUploading} variant={m.uploaded ? 'secondary' : 'default'}>
                        Upload
                      </Button>
                    </div>
                  </div>
                  {mandSelectedKey === m.key && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <Label className="text-xs">File</Label>
                        <Input type="file" onChange={(e) => handleFileSelect(e.target.files?.[0] || null)} />
                      </div>
                      <div>
                        <Label className="text-xs">Expiry Date</Label>
                        <Input type="date" value={mandExpiry} onChange={(e) => setMandExpiry(e.target.value)} />
                      </div>
                      {mandError && <p className="text-xs text-red-600">{mandError}</p>}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={submitMandatory} disabled={isUploading || !mandExpiry}>Submit</Button>
                        <Button size="sm" variant="outline" onClick={() => { setMandSelectedKey(null); setMandError(null); }}>Cancel</Button>
                      </div>
                    </div>
                  )}
                  {m.uploaded && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" onClick={() => viewMandatoryById(m.documentId)}>View</Button>
                      {m.hasBlob && m.filename && (
                        <Button size="sm" variant="outline" onClick={() => openSasForFilename(m.filename!)}>Secure Link</Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {!isMandatoryLoading && mandatoryData && mandatoryData.mandatory.length === 0 && (
              <p className="text-sm text-neutral-500">No mandatory documents defined.</p>
            )}
          </div>
        </div>

        {/* Quick Blob Upload (new) */}
        {showQuick && (
          <div className="p-4 mb-4 border rounded-lg bg-white">
            <h3 className="font-medium mb-2">Quick Blob Upload (beta)</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <Input type="file" onChange={(e) => setQuickFile(e.target.files?.[0] || null)} className="max-w-xs" />
              <Button onClick={quickBlobUpload} disabled={!quickFile || quickUploading} className="bg-primary text-white">
                {quickUploading ? 'Uploading…' : 'Upload to Blob'}
              </Button>
              {quickUrl && (
                <Button
                  variant="outline"
                  className="text-sm"
                  onClick={() => window.open(quickUrl!, '_blank', 'noopener,noreferrer')}
                >
                  Open file
                </Button>
              )}
              {quickFilename && (
                <Button
                  variant="outline"
                  className="text-sm"
                  onClick={async () => {
                    try {
                      const p = new URLSearchParams({ filename: quickFilename! });
                      const r = await fetch(`/api/documents/sas?${p.toString()}`);
                      if (!r.ok) throw new Error('Failed to get SAS');
                      const d = await r.json();
                      if (d.sasUrl) {
                        window.open(d.sasUrl as string, '_blank', 'noopener,noreferrer');
                      }
                    } catch (e) {
                      console.error('SAS error', e);
                      alert('Could not generate secure link');
                    }
                  }}
                >
                  Get secure link
                </Button>
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-2">This uploads to Azure Blob and creates a minimal document entry.</p>
          </div>
        )}
        
        <div className="space-y-3">
          {nonMandatoryDocuments.map(document => (
            <Card key={document.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">{document.title}</h3>
                  {getStatusBadge(document.status)}
                </div>
                <p className="text-sm text-neutral-600 mb-3">{document.description}</p>
                
                {document.deadline && (
                  <div className="bg-neutral-100 rounded p-3 mb-3">
                    <p className="text-xs text-neutral-700">
                      Deadline: {format(new Date(document.deadline), 'MMM d, yyyy')}
                    </p>
                  </div>
                )}
                
                {document.status === 'completed' ? (
                  <div className="flex items-center gap-3">
                    <Button
                      variant="link"
                      className="flex items-center text-sm text-primary px-0"
                          onClick={() => handleViewDocument(document.id, document.title, document.fileContent, document.fileType, document.filename)}
                    >
                      <span className="material-icons text-sm mr-1">visibility</span>
                      <span>{t('viewDocument')}</span>
                    </Button>
                    {document.filename && !document.fileContent && (
                      <Button
                        variant="outline"
                        className="text-xs"
                        onClick={async () => {
                          try {
                            const p = new URLSearchParams({ filename: document.filename! });
                            const r = await fetch(`/api/documents/sas?${p.toString()}`);
                            if (!r.ok) throw new Error('Failed to get SAS');
                            const d = await r.json();
                            if (d.sasUrl) window.open(d.sasUrl as string, '_blank', 'noopener,noreferrer');
                          } catch (e) {
                            console.error('SAS error', e);
                            alert('Could not generate secure link');
                          }
                        }}
                      >
                        Secure link
                      </Button>
                    )}
                  </div>
                ) : (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="bg-primary text-white text-sm rounded-lg px-4 py-2 flex items-center">
                        <span className="material-icons text-sm mr-1">upload_file</span>
                        {t('uploadDocument')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Upload {document.title}</DialogTitle>
                        <DialogDescription>{document.description}</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="document-file" className="col-span-4">
                            File
                          </Label>
                          <Input
                            id="document-file"
                            type="file"
                            className="col-span-4"
                            onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => {
                            uploadDocument({
                              title: document.title,
                              description: document.description ?? '',
                              status: 'completed',
                              deadline: document.deadline ? new Date(document.deadline as any) : null,
                            });
                          }}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            'Upload'
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </CardContent>
            </Card>
          ))}
          
          <Dialog>
            <DialogTrigger asChild>
              <Button className="w-full bg-primary text-white py-2 mt-4">
                <span className="material-icons mr-2">add</span>
                Add New Document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Document</DialogTitle>
                <DialogDescription>Upload a new document to your checklist</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="title" className="col-span-4">Title</Label>
                  <Input
                    id="title"
                    placeholder="Document Title"
                    className="col-span-4"
                    value={documentInfo.title}
                    onChange={(e) => setDocumentInfo({ ...documentInfo, title: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="description" className="col-span-4">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Document Description"
                    className="col-span-4"
                    value={documentInfo.description}
                    onChange={(e) => setDocumentInfo({ ...documentInfo, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="file" className="col-span-4">File</Label>
                  <Input
                    id="file"
                    type="file"
                    className="col-span-4"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleUpload} disabled={isUploading || !documentInfo.title}>
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Upload'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {/* Document Info Dialog */}
      {documentViewContent && (
        <Dialog open={!!documentViewContent} onOpenChange={closeDocumentView}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{documentViewContent.title}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm whitespace-pre-wrap">{documentViewContent.content}</p>
              
              {documentViewContent.fileContent ? (
                <div className="mt-4 p-4 border rounded-md">
                  <p className="font-medium mb-2">Uploaded Document:</p>
                  {/* Derive effective type: if stored fileType is a logical mandatory key, infer from filename extension */}
                  {(() => {
                    const logicalKeys = ['passport','residence_permit','student_card','taj_card'];
                    let effectiveType = documentViewContent.fileType || '';
                    if (logicalKeys.includes(effectiveType)) {
                      const fname = documentViewContent.filename || '';
                      if (/\.pdf$/i.test(fname)) effectiveType = 'application/pdf';
                      else if (/\.(png|jpe?g|gif|webp|bmp)$/i.test(fname)) effectiveType = 'image/*';
                      else if (/\.(txt|md|csv|log)$/i.test(fname)) effectiveType = 'text/plain';
                    }
                    // Render based on effectiveType
                    if (effectiveType.startsWith('image/')) {
                      return <img src={`data:${documentViewContent.fileType};base64,${documentViewContent.fileContent}`} alt="Document preview" className="max-w-full h-auto" />;
                    }
                    if (effectiveType === 'image/*') {
                      return <img src={`data:${documentViewContent.fileType};base64,${documentViewContent.fileContent}`} alt="Document preview" className="max-w-full h-auto" />;
                    }
                    if (effectiveType === 'application/pdf') {
                      return <iframe title="PDF preview" src={`data:application/pdf;base64,${documentViewContent.fileContent}`} className="w-full" style={{ height: '70vh' }} />;
                    }
                    if (effectiveType.startsWith('text/')) {
                      return <pre className="max-h-[60vh] overflow-auto text-xs bg-neutral-50 p-3 rounded">{atob(documentViewContent.fileContent)}</pre>;
                    }
                    return <p className="text-sm text-neutral-600">Preview not available. You can download the file.</p>;
                  })()}
                  <div className="mt-3">
                    <Button size="sm" onClick={downloadInlineFile}>Download</Button>
                  </div>
                </div>
              ) : (
                documentViewContent.filename ? (
                  <div className="mt-4 p-4 border rounded-md">
                    <p className="text-sm mb-2">This file is stored securely. Open with a time-limited link:</p>
                    <Button size="sm" onClick={() => openSasForFilename(documentViewContent.filename!)}>Open secure link</Button>
                  </div>
                ) : null
              )}
            </div>
            <DialogFooter>
              <Button onClick={closeDocumentView}>{t('close')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Documents;
