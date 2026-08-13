import { QueryClient } from '@tanstack/react-query'

/**
 * Cấu hình mặc định cho mọi truy vấn.
 *
 * Mấy con số dưới đây chọn theo đúng hoàn cảnh của dự án: API chạy trên gói
 * free của Render, ngủ sau 15 phút và mất tới ~50 giây để dậy.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /**
       * Dữ liệu coi là còn tươi trong 1 phút. Trong khoảng đó, chuyển qua lại
       * giữa các trang sẽ lấy từ cache thay vì gọi lại API — vừa nhanh, vừa đỡ
       * đánh thức Neon một cách vô ích.
       */
      staleTime: 60_000,

      /**
       * Giữ trong bộ nhớ 5 phút sau khi không còn component nào dùng tới.
       * Người dùng bấm quay lại là thấy ngay nội dung cũ trong lúc chờ dữ liệu mới.
       */
      gcTime: 5 * 60_000,

      /**
       * Thử lại 2 lần. Lần gọi đầu sau khi Render ngủ dậy rất hay timeout —
       * không phải lỗi thật, chỉ là instance đang khởi động.
       */
      retry: 2,

      /**
       * Giãn dần thời gian chờ giữa các lần thử: 1s, 2s, 4s... tối đa 30s.
       * Thử lại dồn dập không giúp instance dậy nhanh hơn, chỉ tốn request.
       */
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),

      /**
       * Tắt tự gọi lại khi người dùng quay lại tab. Mặc định của thư viện là
       * bật, hợp với ứng dụng cần dữ liệu thời gian thực. Ở đây tin tuyển dụng
       * không đổi từng giây, mà mỗi lần gọi lại là một lần đánh thức server.
       */
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Thao tác ghi (ứng tuyển, đăng tin) thì không tự thử lại: rủi ro tạo
      // trùng bản ghi lớn hơn lợi ích. Để người dùng tự bấm lại.
      retry: 0,
    },
  },
})
