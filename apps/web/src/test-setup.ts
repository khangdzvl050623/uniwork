import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

/**
 * Gỡ component ra khỏi DOM sau mỗi ca test.
 *
 * `@testing-library/react` chỉ tự làm việc này khi biến toàn cục `afterEach`
 * tồn tại lúc nó được nạp. Gọi tay ở đây thì không phụ thuộc vào thứ tự nạp
 * module — chắc chắn hơn, và nếu ai đó tắt `globals` trong config thì test vẫn
 * không rò rỉ DOM sang ca sau.
 */
afterEach(() => {
  cleanup()
})
