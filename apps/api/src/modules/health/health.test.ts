import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.js'
import { getHealth } from './health.service.js'

/**
 * Hai tầng test, mỗi tầng bắt một loại lỗi khác nhau.
 *
 * - Test service: gọi thẳng hàm, nhanh, không dựng gì cả. Bắt lỗi logic.
 * - Test qua HTTP: đi qua toàn bộ chuỗi middleware. Bắt lỗi lắp ráp — sai
 *   đường dẫn, quên gắn router, middleware đặt nhầm thứ tự.
 *
 * Nhờ createApp() không gọi listen, Supertest tự mở cổng ngẫu nhiên rồi dẹp.
 * Các file test chạy song song không tranh nhau cổng 4000.
 */

describe('health service', () => {
  it('trả về trạng thái ok kèm uptime và version', () => {
    const result = getHealth()

    expect(result.status).toBe('ok')
    expect(result.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(result.uptime).toBeGreaterThanOrEqual(0)
  })
})

describe('GET /api/health', () => {
  it('trả 200 và đúng hình dạng ApiSuccess', async () => {
    const response = await request(createApp()).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      ok: true,
      data: { status: 'ok' },
    })
  })

  it('không trả về header X-Powered-By', async () => {
    const response = await request(createApp()).get('/api/health')

    expect(response.headers['x-powered-by']).toBeUndefined()
  })
})

describe('đường dẫn không tồn tại', () => {
  it('trả 404 dưới dạng JSON chứ không phải HTML', async () => {
    const response = await request(createApp()).get('/api/khong-co-that')

    expect(response.status).toBe(404)
    expect(response.headers['content-type']).toMatch(/json/)
    expect(response.body).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    })
  })
})

describe('CORS', () => {
  it('cấp header cho origin nằm trong danh sách', async () => {
    const response = await request(createApp())
      .get('/api/health')
      .set('Origin', 'http://localhost:5173')

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173')
  })

  it('không cấp header cho origin lạ', async () => {
    const response = await request(createApp())
      .get('/api/health')
      .set('Origin', 'http://ke-xau.example')

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })
})
