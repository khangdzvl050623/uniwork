# 001 — Dừng animation khi khối nằm ngoài khung nhìn

- **Status**: TODO
- **Commit**: 720242b (nhánh `dev`)
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 1 hook mới (~30 dòng), 1 khối CSS (~12 dòng), 5 chỗ gắn vào

## Problem

Trang chủ có **21 animation lặp vô hạn chỉ riêng ở hero**, cộng thêm marquee,
pulse-ring và một `setInterval`. Không cái nào dừng lại khi người dùng đã cuộn
qua. Trình duyệt không tự tắt giúp: animation chạy trên compositor vẫn tiếp tục
tiêu tốn GPU dù khối đã ra khỏi màn hình từ lâu.

Trên máy tầm trung, chi phí này cộng dồn và không bao giờ giảm — càng thêm
animation thì đáy trang càng nặng, kể cả khi người dùng còn đang ở đầu trang.

Các nguồn chuyển động vô hạn, đo tại commit trên:

```tsx
// apps/web/src/components/HeroAurora.tsx:22-49 — hiện tại
// 5 vệt sáng, mỗi vệt tới 736x736px, animation gắn NỘI TUYẾN
const BLOBS = [
  {
    box: 'left-[-18%] top-[-32%] h-[46rem] w-[46rem]',
    color: 'rgba(20,196,171,0.52)',
    motion: 'blob-drift-a 26s ease-in-out infinite alternate',
  },
  // ... 4 vệt nữa
]
```

```tsx
// apps/web/src/components/HeroAurora.tsx:83-92 — hiện tại
<span
  key={b.box}
  className={cn('hero-blob', b.box)}
  style={{
    backgroundImage: `radial-gradient(circle at center, ${b.color} 0%, transparent 68%)`,
    animation: b.motion,
  }}
/>
```

```css
/* apps/web/src/index.css:135-141 — hiện tại (4 khối hình học) */
.floaty {
  animation-name: floaty;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
  will-change: transform;
}

/* apps/web/src/index.css:155-159 — hiện tại (12 hạt sáng) */
.twinkle {
  animation-name: twinkle;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}

/* apps/web/src/index.css:220-227 — hiện tại, chạy trên ::after */
.sheen::after {
  /* ... */
  animation: sheen 6s ease-in-out infinite;
}

/* apps/web/src/index.css:243-249 — hiện tại, chạy trên ::before */
.live-dot::before {
  /* ... */
  animation: live-dot 2s cubic-bezier(0.24, 0, 0.38, 1) infinite;
}

/* apps/web/src/index.css:660-666 — hiện tại, chạy trên ::before */
.pulse-ring::before {
  /* ... */
  animation: pulse-ring 2.4s cubic-bezier(0.24, 0, 0.38, 1) infinite;
}

/* apps/web/src/index.css:637-639 — hiện tại */
.animate-marquee {
  animation: marquee-x 32s linear infinite;
}
```

```tsx
// apps/web/src/components/SloganBand.tsx:39-44 — hiện tại
// Không phải CSS: đây là setInterval khiến React vẽ lại cả section mỗi 2.6 giây,
// vĩnh viễn, kể cả khi section nằm ngoài màn hình.
const [index, setIndex] = useState(0)

useEffect(() => {
  const timer = setInterval(() => setIndex((i) => (i + 1) % SWAPPED.length), SWAP_MS)
  return () => clearInterval(timer)
}, [])
```

## Target

Một hook dùng chung + một quy tắc CSS. Sau khi xong, chi phí animation tỉ lệ với
**những gì đang hiện trên màn hình**, không tỉ lệ với tổng số animation trong trang.

### Hook mới, thêm vào cuối `apps/web/src/hooks/useInView.ts`

```ts
/**
 * Theo dõi LIÊN TỤC việc khối có nằm trong khung nhìn hay không, và trả sẵn
 * các props để rải vào thẻ.
 *
 * Khác `useInView` ở đúng một điểm: `useInView` bật cờ một lần rồi ngắt
 * observer, vì hiệu ứng "hiện ra khi cuộn tới" chỉ được chạy một lần. Hook này
 * thì ngược lại — nó phải biết cả lúc khối RỜI khung nhìn để còn tắt animation.
 *
 * Trạng thái đầu là `true` (coi như đang thấy). Nếu JS chưa chạy kịp hoặc trình
 * duyệt không có IntersectionObserver thì animation chạy y như hôm nay, chứ
 * không đứng hình vĩnh viễn — hỏng theo hướng an toàn.
 */
export function useOnScreen<T extends Element>({
  /** Nới khung nhìn ra để chuyển động đã chạy sẵn trước khi khối lọt vào tầm
      mắt. Không có phần nới này, người dùng bắt được đúng khoảnh khắc animation
      khởi động ngay ở mép màn hình. */
  rootMargin = '200px',
}: { rootMargin?: string } = {}) {
  const ref = useRef<T>(null)
  const [onScreen, setOnScreen] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), {
      rootMargin,
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin])

  return [{ ref, 'data-offscreen': onScreen ? undefined : '' }, onScreen] as const
}
```

`useRef` và `useState` đã được import sẵn ở đầu file, không cần thêm.

### Quy tắc CSS, thêm vào `apps/web/src/index.css` ngay TRƯỚC khối `@media (prefers-reduced-motion: reduce)` ở dòng 522

```css
/* ------------------------------------- dừng khi khối ra ngoài khung nhìn ---- */

/* Khối nào bị đánh dấu `data-offscreen` thì mọi animation bên trong đứng lại.

   `paused` GIỮ NGUYÊN vị trí đang chạy dở chứ không tua về đầu — nên cuộn ngược
   lên là chuyển động chạy tiếp từ đúng chỗ, mắt không bắt được điểm nối. Đây là
   lý do dùng `animation-play-state` chứ không phải `animation: none`.

   Vì sao phải có `!important`: HeroAurora gắn animation bằng `style={{ animation }}`
   nội tuyến, mà cú pháp rút gọn `animation:` ghi luôn `animation-play-state:
   running` vào style nội tuyến. Style nội tuyến thắng mọi quy tắc thường trong
   stylesheet; chỉ `!important` của stylesheet mới thắng ngược lại được.

   Mấy dòng pseudo-element không thừa: sheen, live-dot và pulse-ring đều chạy
   animation trên ::before / ::after chứ không phải trên chính thẻ. */
[data-offscreen],
[data-offscreen]::before,
[data-offscreen]::after,
[data-offscreen] *,
[data-offscreen] *::before,
[data-offscreen] *::after {
  animation-play-state: paused !important;
}
```

## Repo conventions to follow

- Hook trả về **tuple** `[a, b] as const`, không trả object rời — theo đúng
  `useInView` ở `apps/web/src/hooks/useInView.ts:16-58`.
- Observer luôn `disconnect()` trong hàm dọn của `useEffect`; danh sách phụ
  thuộc chỉ chứa số/chuỗi, không chứa object options — lời giải thích cho quy
  ước này đã có sẵn ở `apps/web/src/hooks/useInView.ts:53-56`.
- Data-attribute đặt tên tiếng Anh, kebab-case: xem `data-dash-theme` ở
  `apps/web/src/components/layout/AdminLayout.tsx:133`.
- Class CSS đặt tên tiếng Anh (`.hero-blob`, `.card-lift`, `.pulse-ring`); chú
  thích trong CSS và TSX viết tiếng Việt, giải thích **vì sao** chứ không mô tả
  lại code.
- Token easing đã có sẵn ở `apps/web/src/index.css:72-76`; plan này không thêm
  curve mới.

## Steps

1. **`apps/web/src/hooks/useInView.ts`** — thêm `useOnScreen` vào cuối file,
   nguyên văn như khối ở mục Target. Giữ nguyên `useInView`, không đụng tới.

2. **`apps/web/src/index.css`** — chèn khối CSS ở mục Target vào ngay trước dòng
   522 (`@media (prefers-reduced-motion: reduce) {`).

3. **`apps/web/src/pages/Home.tsx`** — import hook và gắn vào section hero ở
   dòng 261. Riêng chỗ này phủ luôn HeroAurora (vệt sáng + khối lơ lửng + hạt
   sáng), `sheen` và `live-dot` ở dòng 266-267.

   ```tsx
   // thêm vào phần import
   import { useOnScreen } from '@/hooks/useInView'

   // trong thân component Home, trước phần return
   const [heroProps] = useOnScreen<HTMLElement>()
   const [toolsProps] = useOnScreen<HTMLElement>()
   const [videoProps] = useOnScreen<HTMLElement>()

   // dòng 261 — từ
   <section className="hero-sky relative isolate overflow-hidden px-4 pt-10 pb-2...
   // thành
   <section {...heroProps} className="hero-sky relative isolate overflow-hidden px-4 pt-10 pb-2...
   ```

4. **`apps/web/src/pages/Home.tsx:758`** — rải `{...toolsProps}` vào
   `<section className="mt-12 bg-brand-50 px-4 py-12">` (section này chứa
   `pulse-ring` ở dòng 781).

5. **`apps/web/src/pages/Home.tsx:870`** — rải `{...videoProps}` vào
   `<section className="relative overflow-hidden bg-brand-950 px-4 py-14">`
   (chứa `pulse-ring` ở dòng 901).

6. **`apps/web/src/components/Marquee.tsx`** — gắn ngay trong component để mọi
   trang dùng Marquee đều hưởng, không phải nhớ gắn ở từng chỗ gọi:

   ```tsx
   import type { ReactNode } from 'react'
   import { useOnScreen } from '@/hooks/useInView'

   export function Marquee({ children }: { children: ReactNode }) {
     const [props] = useOnScreen<HTMLDivElement>()

     return (
       <div {...props} className="marquee-wrap marquee-mask overflow-hidden">
         {/* phần bên trong giữ nguyên */}
   ```

7. **`apps/web/src/components/SloganBand.tsx`** — chỗ này CSS không giải quyết
   được, vì cái chạy là `setInterval` trong JS. Gắn ref vào `<section>` ở dòng
   47 và cho `onScreen` vào danh sách phụ thuộc của effect:

   ```tsx
   const [bandProps, onScreen] = useOnScreen<HTMLElement>()
   const [index, setIndex] = useState(0)

   useEffect(() => {
     // Ngoài màn hình thì không hẹn giờ. Quay lại thì cụm từ được trọn 2.6 giây
     // để đọc, thay vì đổi ngay lập tức — đúng ý đồ hơn là chạy ngầm suốt.
     if (!onScreen) return
     const timer = setInterval(() => setIndex((i) => (i + 1) % SWAPPED.length), SWAP_MS)
     return () => clearInterval(timer)
   }, [onScreen])

   // dòng 47 — từ
   <section className="bg-brand-deep relative overflow-hidden px-4 py-16">
   // thành
   <section {...bandProps} className="bg-brand-deep relative overflow-hidden px-4 py-16">
   ```

## Boundaries

- **KHÔNG sửa `useInView`.** Hành vi bật-một-lần của nó là đúng cho `Reveal` và
  `CountUp`: hiệu ứng "hiện ra khi cuộn tới" mà chạy lại mỗi lượt cuộn qua sẽ
  thành nhấp nháy.
- **KHÔNG đụng khối `@media (prefers-reduced-motion: reduce)`** ở
  `apps/web/src/index.css:522`. Nó đã xử lý đúng và độc lập với plan này.
- **KHÔNG đổi bất kỳ keyframe, thời lượng, easing hay màu nào.** Plan này chỉ
  đổi *thời điểm* animation chạy, không đổi animation.
- **KHÔNG đụng `components/Earth.tsx`** — quả cầu WebGL cần cơ chế khác, nằm ở
  plan 002.
- **KHÔNG thêm thư viện.**
- Nếu code thực tế khác với đoạn trích trong plan (đã có người sửa sau commit
  `720242b`), **DỪNG và báo lại**, đừng tự suy diễn.

## Verification

**Máy kiểm:**

```bash
pnpm --filter @uniwork/web typecheck   # kỳ vọng: thoát 0
pnpm --filter @uniwork/web lint        # kỳ vọng: thoát 0
pnpm --filter @uniwork/web test        # kỳ vọng: thoát 0, không test nào đỏ
```

Kiểm bằng mã thoát, không phải bằng cách đọc chữ trong log — theo
`docs/nep-kiem-thu.md`.

**Mắt kiểm** — mở trang chủ trong Edge:

1. DevTools → `Ctrl+Shift+P` → `Show Rendering` → bật **Frame Rendering Stats**.
   Tắt **Efficiency mode** ở `edge://settings/system` trước khi đo.
2. Cuộn xuống đáy trang. Chọn một `.hero-blob` trong tab Elements → **Computed**
   → xác nhận `animation-play-state: paused`, và thẻ `<section>` hero có thuộc
   tính `data-offscreen`.
3. **Cuộn ngược lên hero.** Vệt sáng phải **chạy tiếp từ vị trí đang dở**, không
   nhảy về điểm xuất phát. Nếu thấy nó giật về đầu thì đã dùng nhầm
   `animation: none` thay vì `animation-play-state: paused`.
4. Trong Performance, đặt **CPU throttling 6×**, ghi lại một lượt cuộn từ đầu
   xuống đáy. So với bản trước khi sửa: thời gian **Rendering** và **Painting**
   ở đoạn cuối trang phải giảm.
5. Bật `prefers-reduced-motion` (Rendering panel) → xác nhận không có gì hỏng
   thêm; các khối vẫn hiện đủ nội dung.

**Done when:**

- Cuộn qua hero thì `<section>` hero mang `data-offscreen`, cuộn lại thì mất.
- Marquee ở `Home.tsx:941` đứng yên khi chưa cuộn tới, tự chạy khi tới.
- Chữ trong SloganBand ngừng đổi khi section ngoài màn hình (kiểm bằng
  breakpoint hoặc `console.count` tạm trong `setIndex`, rồi **xoá đi** trước khi
  commit).
- Ba lệnh ở mục Máy kiểm đều thoát 0.
