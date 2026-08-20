/**
 * Dấu hiệu nhận diện UniWork — hai ô lịch chồng lệch, phần giao nhau đặc.
 *
 * Là bản rút gọn của icon 04-B "Schedule Match" (bản đầy đủ kèm hoạt ảnh ở
 * docs/icons/schedule-match.html, bản favicon ở public/favicon.svg).
 *
 * Vẽ hoàn toàn bằng `currentColor` và KHÔNG tự có nền. Nhờ vậy nó thả được vào
 * đúng những ô vuông màu sẵn có ở header, footer, trang đăng nhập và sidebar
 * quản trị mà không phải chỉnh màu riêng cho từng chỗ — mỗi nơi giữ nguyên lớp
 * nền và màu chữ của mình, chỉ phần hình bên trong đổi.
 *
 * Hai ô ngoài để mờ 45%, ô giao nhau để đặc. Chênh lệch đó chính là toàn bộ ý
 * nghĩa: chỗ hai lịch trùng nhau là chỗ đi làm được.
 */
export function UniWorkMark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      {/* Lịch của sinh viên */}
      <rect x="3" y="3" width="12" height="12" rx="3" fillOpacity="0.45" />
      {/* Lịch của ca làm, lệch xuống-phải */}
      <rect x="9" y="9" width="12" height="12" rx="3" fillOpacity="0.45" />
      {/* Phần giao nhau: đúng vùng 9→15 của cả hai ô. Toạ độ suy ra từ hình học
          chứ không đặt tay, nên dời hai ô thì ô này vẫn khớp. */}
      <rect x="9" y="9" width="6" height="6" rx="2" />
    </svg>
  )
}
