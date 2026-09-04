import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { khoiPhucPhien } from './lib/api'
import { queryClient } from './lib/queryClient'
import './index.css'

/*
 * Khôi phục phiên đăng nhập trước cả khi React dựng cây component (T44).
 *
 * Gọi ở đây chứ không trong `useEffect` vì hai lý do. Một: request bắt đầu sớm
 * hơn vài chục mili giây, nên khoảnh khắc hiện vòng xoay chờ ngắn lại. Hai:
 * `StrictMode` cố ý chạy effect hai lần ở môi trường phát triển, mà gọi refresh
 * hai lần liên tiếp chính là thứ kích hoạt cơ chế chống trộm token phía server.
 * Ở phạm vi module thì nó chạy đúng một lần, không phụ thuộc React.
 *
 * Không cần `await`: hàm này tự ghi kết quả vào auth-store, còn giao diện đã
 * biết chờ qua trạng thái 'dang-kiem-tra'.
 */
void khoiPhucPhien()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
