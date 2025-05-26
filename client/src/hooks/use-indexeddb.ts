import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { indexedDBStorage } from '@/lib/indexeddb';
import { Meeting } from '@/lib/types';

export function useIndexedDBMeetings() {
  const queryClient = useQueryClient();

  // Get all meetings from IndexedDB
  const { data: meetings, isLoading, error } = useQuery({
    queryKey: ['indexeddb-meetings'],
    queryFn: async () => {
      await indexedDBStorage.init();
      return indexedDBStorage.getAllMeetings();
    },
  });

  // Save meeting to IndexedDB
  const saveMutation = useMutation({
    mutationFn: async (meeting: Omit<Meeting, 'id'>) => {
      await indexedDBStorage.init();
      return indexedDBStorage.saveMeeting(meeting);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indexeddb-meetings'] });
    },
  });

  // Update meeting in IndexedDB
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Meeting> }) => {
      await indexedDBStorage.init();
      return indexedDBStorage.updateMeeting(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indexeddb-meetings'] });
    },
  });

  // Delete meeting from IndexedDB
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await indexedDBStorage.init();
      return indexedDBStorage.deleteMeeting(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indexeddb-meetings'] });
    },
  });

  // Search meetings
  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      await indexedDBStorage.init();
      return indexedDBStorage.searchMeetings(query);
    },
  });

  return {
    meetings: meetings || [],
    isLoading,
    error,
    saveMeeting: saveMutation.mutate,
    updateMeeting: updateMutation.mutate,
    deleteMeeting: deleteMutation.mutate,
    searchMeetings: searchMutation.mutate,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isSaving: saveMutation.isPending,
  };
}

export function useIndexedDBTemplates() {
  const queryClient = useQueryClient();

  // Get all email templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ['indexeddb-templates'],
    queryFn: async () => {
      await indexedDBStorage.init();
      return indexedDBStorage.getEmailTemplates();
    },
  });

  // Save template
  const saveTemplateMutation = useMutation({
    mutationFn: async (template: any) => {
      await indexedDBStorage.init();
      return indexedDBStorage.saveEmailTemplate(template);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indexeddb-templates'] });
    },
  });

  return {
    templates: templates || [],
    isLoading,
    saveTemplate: saveTemplateMutation.mutate,
    isSaving: saveTemplateMutation.isPending,
  };
}

export function useIndexedDBPreferences() {
  const [preferences, setPreferences] = useState<any>({});

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      await indexedDBStorage.init();
      const prefs = {
        defaultEmailRecipients: await indexedDBStorage.getPreference('defaultEmailRecipients') || [],
        autoSendSummary: await indexedDBStorage.getPreference('autoSendSummary') || false,
        preferredTemplate: await indexedDBStorage.getPreference('preferredTemplate') || 'summary',
      };
      setPreferences(prefs);
    };

    loadPreferences();
  }, []);

  // Get preference
  const getPreference = async (key: string) => {
    await indexedDBStorage.init();
    return indexedDBStorage.getPreference(key);
  };

  // Save preference
  const savePreference = async (key: string, value: any) => {
    await indexedDBStorage.init();
    await indexedDBStorage.savePreference(key, value);
    setPreferences((prev: any) => ({ ...prev, [key]: value }));
  };

  return {
    preferences,
    getPreference,
    savePreference,
  };
}