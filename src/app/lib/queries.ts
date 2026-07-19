import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './api';

export interface User {
  id: string;
  email: string;
  name: string;
  subscriptionTier: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Event {
  id: string;
  slug: string;
  eventName: string;
  eventDate: string | null;
  coverImageUrl: string | null;
  qrCodeData: string | null;
  maxPhotosAllowed: number;
  isLocked: boolean;
  createdAt: string;
  _count?: { photos: number };
  photos?: Photo[];
}

export interface Photo {
  id: string;
  eventId: string;
  url: string;
  thumbnailUrl: string | null;
  fileName: string | null;
  likes: number;
  featured: boolean;
  width: number | null;
  height: number | null;
  uploadedAt: string;
}

export function useLogin() {
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (data: { email: string; password: string; name: string }) =>
      apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    },
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: () => apiRequest<{ user: User }>('/auth/me'),
    enabled: !!localStorage.getItem('auth_token'),
    retry: false,
  });
}

export function useMyEvents() {
  return useQuery({
    queryKey: ['myEvents'],
    queryFn: () => apiRequest<{ events: Event[] }>('/events/my'),
    enabled: !!localStorage.getItem('auth_token'),
  });
}

export function useEvent(eventId: string) {
  return useQuery({
    queryKey: ['event', eventId],
    queryFn: () => apiRequest<{ event: Event }>(`/events/${eventId}`),
    enabled: !!eventId,
  });
}

export function useEventBySlug(slug: string) {
  return useQuery({
    queryKey: ['eventSlug', slug],
    queryFn: () => apiRequest<{ id: string; eventName: string; eventDate: string | null; coverImageUrl: string | null; slug: string; photoCount: number; subscriptionTier: string }>(`/events/slug/${slug}`),
    enabled: !!slug,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { eventName: string; eventDate?: string }) =>
      apiRequest<{ event: Event; eventUrl: string }>('/events', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['myEvents'] }); },
  });
}

export function useEventPhotos(eventId: string) {
  return useQuery({
    queryKey: ['eventPhotos', eventId],
    queryFn: () => apiRequest<{ photos: Photo[] }>(`/photos/${eventId}`),
    enabled: !!eventId,
  });
}

export function useUploadPhotos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, files }: { eventId: string; files: File[] }) => {
      const formData = new FormData();
      files.forEach((file) => formData.append('photos', file));
      return apiRequest<{ message: string; photos: Photo[]; totalPhotos: number; maxAllowed: number }>(
        `/photos/${eventId}/upload`, { method: 'POST', body: formData }
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['eventPhotos', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['myEvents'] });
    },
  });
}

export function useDeletePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => apiRequest<{ message: string }>(`/photos/${photoId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventPhotos'] });
      queryClient.invalidateQueries({ queryKey: ['myEvents'] });
    },
  });
}

export function useDeleteAllPhotos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => apiRequest<{ message: string; deletedCount: number }>(`/photos/event/${eventId}/all`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventPhotos'] });
      queryClient.invalidateQueries({ queryKey: ['event'] });
      queryClient.invalidateQueries({ queryKey: ['myEvents'] });
    },
  });
}

export function useReindexPhotos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => apiRequest<{ message: string; queued: number }>(`/photos/reindex/${eventId}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventPhotos'] });
      queryClient.invalidateQueries({ queryKey: ['event'] });
    },
  });
}


export function useFaceSearch() {
  return useMutation({
    mutationFn: ({ eventId, selfie }: { eventId: string; selfie: File }) => {
      const formData = new FormData();
      formData.append('selfie', selfie);
      return apiRequest<{ matchedPhotos: Photo[]; totalMatches: number }>(
        `/search/${eventId}/face`, { method: 'POST', body: formData }
      );
    },
  });
}

export function useToggleEventLock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, isLocked }: { eventId: string; isLocked: boolean }) =>
      apiRequest<{ event: Event }>(`/events/${eventId}/lock`, { method: 'PUT', body: JSON.stringify({ isLocked }) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['myEvents'] });
    },
  });
}

export function useUpdateEventCover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, file }: { eventId: string; file: File }) => {
      const formData = new FormData();
      formData.append('cover', file);
      return apiRequest<{ event: Event }>(`/events/${eventId}/cover`, { method: 'POST', body: formData });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['myEvents'] });
    },
  });
}

export function useUpgradeSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tier: string) =>
      apiRequest<{ user: User }>('/auth/upgrade', { method: 'POST', body: JSON.stringify({ tier }) }),
    onSuccess: (data) => {
      localStorage.setItem('user', JSON.stringify(data.user));
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });
}
