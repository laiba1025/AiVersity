import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Document } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

export const useDocuments = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch documents
  const {
    data: documents,
    isLoading,
    error,
  } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
  });

  // Get document info
  const getDocumentInfo = async (documentId: number): Promise<string> => {
    try {
      const response = await apiRequest('GET', `/api/documents/${documentId}/info`, null);
      const data = await response.json();
      return data.info;
    } catch (error) {
      console.error('Failed to get document info:', error);
      return 'Unable to load document information at this time.';
    }
  };

  // Upload document mutation
  const uploadDocumentMutation = useMutation({
    mutationFn: async (documentData: {
      title: string;
      description: string;
      fileContent: string;
      filename: string;
      fileType: string;
      status: string;
      deadline?: Date | null;
      mandatoryKey?: string; // helps server map correct mandatory doc for upsert
    }) => {
      // Serialize deadline as YYYY-MM-DD if present
      const payload: any = { ...documentData };
      if (payload.deadline instanceof Date && !isNaN(payload.deadline.getTime())) {
        const iso = payload.deadline.toISOString().split('T')[0];
        payload.deadline = iso;
      }
  const response = await apiRequest('POST', '/api/documents', payload);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Upload failed');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      // Also refresh mandatory docs badge count in side nav
      queryClient.invalidateQueries({ queryKey: ['mandatory-docs'] });
      toast({
        title: 'Success',
        description: 'Document uploaded successfully',
      });
      setSelectedFile(null);
      setUploadType(null);
    },
    onError: (error: any) => {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to upload document',
        variant: 'destructive',
      });
    },
  });

  // Update document status mutation
  const updateDocumentStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await apiRequest('PATCH', `/api/documents/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['mandatory-docs'] });
      toast({
        title: 'Success',
        description: 'Document status updated',
      });
    },
    onError: (error) => {
      console.error('Status update error:', error);
      toast({
        title: 'Error',
        description: 'Failed to update document status',
        variant: 'destructive',
      });
    },
  });

  // Helper to read file as base64
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Extract the base64 part from data URL
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle file selection
  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
  };

  // Handle document upload
  const uploadDocument = async (documentInfo: {
    title: string;
    description: string;
    status: string;
    deadline?: Date | null;
    mandatoryKey?: string;
    fileTypeOverride?: string; // allow overriding MIME with a logical key
  }) => {
    if (!selectedFile) {
      toast({
        title: 'Error',
        description: 'Please select a file to upload',
        variant: 'destructive',
      });
      return;
    }

    try {
      const base64Content = await readFileAsBase64(selectedFile);
      await uploadDocumentMutation.mutate({
        ...documentInfo,
        fileContent: base64Content,
        filename: selectedFile.name,
        fileType: documentInfo.fileTypeOverride || selectedFile.type,
        mandatoryKey: documentInfo.mandatoryKey,
      });
    } catch (error) {
      console.error('File processing error:', error);
      toast({
        title: 'Error',
        description: 'Failed to process file',
        variant: 'destructive',
      });
    }
  };

  // Update document status
  const updateDocumentStatus = async (id: number, status: string) => {
    await updateDocumentStatusMutation.mutate({ id, status });
  };

  // Get document counts by status
  const getDocumentCounts = () => {
    if (!documents) return { total: 0, completed: 0, pending: 0, required: 0 };
    
    const completed = documents.filter(doc => doc.status === 'completed').length;
    const pending = documents.filter(doc => doc.status === 'pending').length;
    const required = documents.filter(doc => doc.status === 'required').length;
    
    return {
      total: documents.length,
      completed,
      pending,
      required,
    };
  };

  return {
    documents: documents || [],
    isLoading,
    error,
    selectedFile,
    uploadType,
    setUploadType,
    handleFileSelect,
    uploadDocument,
    updateDocumentStatus,
    getDocumentCounts,
    getDocumentInfo,
    isUploading: uploadDocumentMutation.isPending,
    isUpdating: updateDocumentStatusMutation.isPending,
  };
};
