# 002 — Quả cầu WebGL chỉ quay khi đã cuộn tới, và không vẽ thừa pixel

- **Status**: TODO
- **Commit**: 720242b (nhánh `dev`)
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 1 file (`apps/web/src/components/Earth.tsx`), ~25 dòng đổi

## Problem

`<Earth>` được đặt ở `apps/web/src/pages/Home.tsx:900` — gần đáy một trang dài
975 dòng, người dùng phải cuộn qua 11 section mới thấy. Nhưng vòng lặp
`requestAnimationFrame` khởi động ngay lúc component gắn vào cây, tức là **ngay
khi mở trang chủ**. Trong suốt lúc người dùng còn đang nhìn hero, GPU đã vẽ một
quả địa cầu WebGL 60 khung hình mỗi giây cho thứ chưa ai nhìn thấy.

```tsx
// apps/web/src/components/Earth.tsx:88-95 — hiện tại
if (!reduceMotion) {
  const spin = () => {
    phi += 0.0032
    globe?.update({ phi })
    frame = requestAnimationFrame(spin)
  }
  frame = requestAnimationFrame(spin)
}
```

Chồng lên đó là một khoản vẽ thừa. `devicePixelRatio` ghi cứng bằng 2 và khung
vẽ nhân đôi theo:

```tsx
// apps/web/src/components/Earth.tsx:57-70 — hiện tại
globe = createGlobe(canvas, {
  devicePixelRatio: 2,
  width: width * 2,
  height: width * 2,
  phi,
  theta: 0.26,
  // ...
  mapSamples: 22_000,
```

Máy tầm trung phần lớn là màn hình 1× (1366×768, 1920×1080 không HiDPI). Trên
những máy đó, quả cầu đang được dựng ở **4 lần số pixel** cần thiết rồi thu nhỏ
lại khi hiển thị — tốn gấp bốn mà mắt không thấy khác gì. Đây đúng là nhóm máy
đang bị chậm.

Hai vấn đề này độc lập nhau nhưng ở cùng một file và cùng một `createGlobe`, nên
gộp chung một plan.

## Target

```tsx
// apps/web/src/components/Earth.tsx — thân useEffect sau khi sửa
useEffect(() => {
  const canvas = canvasRef.current
  if (!canvas) return

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  let phi = 0
  let width = 0
  let globe: ReturnType<typeof createGlobe> | null = null
  let frame = 0
  let dangQuay = false

  const build = () => {
    const next = canvas.offsetWidth
    // Bề rộng 0 nghĩa là khối chưa được dựng xong. Gọi cobe lúc này sẽ tạo một
    // canvas rỗng và không bao giờ tự sửa, nên thà không dựng rồi để
    // ResizeObserver gọi lại khi có kích thước thật.
    if (!next || next === width) return
    width = next

    // Lấy đúng mật độ điểm ảnh của màn hình, chặn trần ở 2. Ghi cứng bằng 2 thì
    // màn hình 1× — phần lớn laptop tầm trung — phải dựng gấp bốn số pixel cần
    // thiết rồi thu nhỏ lại, tốn GPU mà mắt không thấy khác gì. Chặn trần vì
    // trên màn 3× thì phần nét thêm không bù nổi chi phí.
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    // Huỷ trước khi tạo mới. Mỗi quả cầu giữ một ngữ cảnh WebGL, mà trình
    // duyệt chỉ cho phép chừng 16 cái cùng lúc — không dọn thì kéo giãn cửa
    // sổ vài chục lần là cái cũ nhất bị thu hồi và canvas trắng bóc.
    globe?.destroy()
    globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: width * dpr,
      height: width * dpr,
      phi,
      theta: 0.26,
      dark: 1,
      diffuse: 1.3,
      scale: 1.15,
      mapSamples: 22_000,
      mapBrightness: 6.2,
      baseColor: [0.07, 0.46, 0.42],
      markerColor: [0.07, 0.46, 0.42],
      glowColor: [0.09, 0.68, 0.61],
      opacity: 1,
      offset: [0, 0],
      markers: [],
    })
  }

  const spin = () => {
    phi += 0.0032
    globe?.update({ phi })
    frame = requestAnimationFrame(spin)
  }

  const batDau = () => {
    // Người bật giảm chuyển động thì quả cầu đứng yên: vẫn thấy đủ Trái Đất,
    // chỉ không quay. Không dựng vòng lặp luôn, thay vì dựng rồi cộng 0 vào phi
    // mỗi khung hình.
    if (dangQuay || reduceMotion) return
    dangQuay = true
    frame = requestAnimationFrame(spin)
  }

  const dungLai = () => {
    if (!dangQuay) return
    dangQuay = false
    cancelAnimationFrame(frame)
  }

  // Dựng lại khi kích thước đổi. cobe khoá kích thước canvas ngay lúc tạo nên
  // không có cách nào chỉnh sau, buộc phải huỷ rồi tạo mới.
  const sizeObserver = new ResizeObserver(build)
  sizeObserver.observe(canvas)
  build()

  // Quả cầu nằm gần đáy trang chủ. Không có phần này thì WebGL vẽ 60 khung hình
  // mỗi giây ngay từ lúc mở trang, trong khi người dùng còn đang ở hero — tốn
  // GPU cho thứ chưa ai thấy. Nới 200px để lúc nó lọt vào tầm mắt thì đã quay
  // sẵn, chứ không đứng im rồi mới giật mình chuyển động.
  const viewObserver = new IntersectionObserver(
    ([entry]) => (entry.isIntersecting ? batDau() : dungLai()),
    { rootMargin: '200px' },
  )
  viewObserver.observe(canvas)

  return () => {
    sizeObserver.disconnect()
    viewObserver.disconnect()
    dungLai()
    globe?.destroy()
  }
}, [])
```

**Không thêm xử lý `visibilitychange`.** Trình duyệt đã ngừng gọi
`requestAnimationFrame` khi tab bị ẩn — thêm nữa chỉ là code chết.

## Repo conventions to follow

- `Earth.tsx` đã dùng ResizeObserver + dọn dẹp đầy đủ; plan này thêm một
  observer nữa **theo đúng khuôn đó**, kể cả việc `disconnect()` trong hàm dọn.
- Chú thích viết tiếng Việt và giải thích **vì sao**, không mô tả lại code —
  xem khối chú thích đầu file `apps/web/src/components/Earth.tsx:5-29` làm mẫu.
- Biến cục bộ trong effect đặt tên tiếng Việt được (`dangQuay`, `batDau`,
  `dungLai`) — repo đã trộn như vậy: `apps/web/src/components/LuoiKhungGio.tsx`.
- Giữ nguyên phần `prefers-reduced-motion`; cách repo xử lý nó nhất quán ở
  `useInView.ts`, `useTween.ts`, `CountUp.tsx`, `SpotlightCompanies.tsx`.

## Steps

1. Mở `apps/web/src/components/Earth.tsx`.
2. Trong thân `useEffect`, thêm biến `let dangQuay = false` cạnh `let frame = 0`
   (dòng 43).
3. Trong `build()`, thêm `const dpr = Math.min(window.devicePixelRatio || 1, 2)`
   ngay trước `globe?.destroy()`, rồi đổi ba dòng `devicePixelRatio: 2`,
   `width: width * 2`, `height: width * 2` thành `dpr`. Mọi tham số còn lại của
   `createGlobe` **giữ nguyên**.
4. Tách `spin` ra khỏi khối `if (!reduceMotion)` để nó thành hàm ở cấp effect,
   rồi thêm `batDau` / `dungLai` như mục Target.
5. Đổi tên `const observer = new ResizeObserver(build)` thành `sizeObserver`
   (dòng 78), sửa luôn `observer.observe(canvas)` phía dưới.
6. Thêm `viewObserver` (IntersectionObserver) sau lệnh `build()`.
7. Xoá khối `if (!reduceMotion) { ... }` cũ ở dòng 88-95 — logic đó giờ nằm
   trong `batDau`.
8. Cập nhật hàm dọn: `sizeObserver.disconnect()`, `viewObserver.disconnect()`,
   `dungLai()`, `globe?.destroy()`.
9. Cập nhật khối chú thích đầu file: đoạn ở dòng 19-21 đang nói vòng quay chạy
   bằng rAF "như bản gốc" — thêm một câu rằng nay nó bị chặn theo khung nhìn.

## Tuỳ chọn, chỉ làm nếu đo xong vẫn thấy nặng

`mapSamples: 22_000` là số chấm dựng nên bề mặt quả cầu. Hạ xuống `16_000` giảm
được việc cho GPU nhưng **đổi hình dáng thật sự** — đường bờ biển thưa hạt hơn.
Đây là quyết định thẩm mỹ, không phải kỹ thuật: chỉ làm khi đã đo ở bước
Verification mà quả cầu vẫn là điểm nghẽn, và phải chụp ảnh so sánh trước/sau để
Oxa duyệt. **Không tự ý đổi.**

## Boundaries

- **KHÔNG đổi** `theta`, `scale`, `diffuse`, `mapBrightness`, `baseColor`,
  `glowColor`, `opacity`, `offset`, `markers` — đó là các lựa chọn thẩm mỹ đã
  chốt, có ghi lý do trong chú thích đầu file.
- **KHÔNG đổi** tốc độ quay `phi += 0.0032`.
- **KHÔNG đổi** `mapSamples` trong phần Steps (xem mục Tuỳ chọn).
- **KHÔNG đụng** `apps/web/src/pages/Home.tsx` — Earth tự lo phần của mình.
- **KHÔNG thêm thư viện**, không đổi phiên bản `cobe`.
- **KHÔNG bỏ** phần xử lý `prefers-reduced-motion`.
- Nếu code thực tế khác đoạn trích (đã có người sửa sau `720242b`), **DỪNG và
  báo lại**.

## Verification

**Máy kiểm:**

```bash
pnpm --filter @uniwork/web typecheck   # kỳ vọng: thoát 0
pnpm --filter @uniwork/web lint        # kỳ vọng: thoát 0
pnpm --filter @uniwork/web test        # kỳ vọng: thoát 0
```

**Mắt kiểm** — mở trang chủ trong Edge, tắt **Efficiency mode** trước
(`edge://settings/system`):

1. **Lúc còn ở hero:** DevTools → Performance → ghi 5 giây mà không cuộn. Trong
   phần Main, **không được có** khung hình nào gọi `spin`/`globe.update`. Trước
   khi sửa thì có đều đặn 60 lần mỗi giây — đây là phép so sánh chính.
2. **Cuộn xuống tới quả cầu:** nó phải **đang quay sẵn** khi vừa lọt vào tầm
   mắt, không đứng im vài phần giây rồi mới bắt đầu. Nếu thấy nó khựng thì
   `rootMargin: '200px'` chưa được áp dụng.
3. **Cuộn qua khỏi rồi quay lại:** quả cầu quay tiếp, canvas **không trắng
   bóc**. Trắng bóc nghĩa là ngữ cảnh WebGL bị huỷ nhầm — kiểm lại là `dungLai()`
   chỉ gọi `cancelAnimationFrame`, tuyệt đối không gọi `globe?.destroy()`.
4. **Kéo giãn cửa sổ** vài lần rồi cuộn tới quả cầu: vẫn hiện đúng, không méo,
   không trắng. Đây là phép thử cho việc `build()` bị đổi.
5. **Đổi độ nét:** nếu có màn hình ngoài, kéo cửa sổ sang màn 1× rồi tải lại —
   quả cầu vẫn nét ở mức chấp nhận được. Xem `canvas.width` trong Elements:
   trên màn 1× phải bằng `offsetWidth`, không phải gấp đôi.
6. Bật `prefers-reduced-motion` (Rendering panel) → quả cầu **hiện đủ hình
   nhưng đứng yên**. Không được biến mất.

**Done when:**

- Ghi hình Performance ở hero không còn khung hình nào của quả cầu.
- `canvas.width === canvas.offsetWidth * Math.min(devicePixelRatio, 2)`.
- Cuộn qua lại nhiều lần không làm canvas trắng.
- Ba lệnh ở mục Máy kiểm đều thoát 0.
