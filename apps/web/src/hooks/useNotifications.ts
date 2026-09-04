import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  MarkAllNotificationsReadResponse,
  MarkNotificationReadResponse,
  NotificationListResponse,
} from '@uniwork/shared'
import { apiFetch } from '@/lib/api'

export const KHOA_THONG_BAO = ['thong-bao'] as const

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: KHOA_THONG_BAO,
    queryFn: () => apiFetch<NotificationListResponse>('/api/toi/thong-bao'),
    enabled,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<MarkNotificationReadResponse>(`/api/toi/thong-bao/${id}/da-doc`, {
        method: 'PUT',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KHOA_THONG_BAO })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<MarkAllNotificationsReadResponse>('/api/toi/thong-bao/da-doc-het', {
        method: 'PUT',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KHOA_THONG_BAO })
    },
  })
}
