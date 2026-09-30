-- Chống trùng ticket hỗ trợ: neo vào NGHIỆP VỤ, không vào `state`.
--
-- ---------------------------------------------------------------------------
-- CÙNG MỘT LỖI, LẦN THỨ HAI
-- ---------------------------------------------------------------------------
-- Migration 20260928130000 đã sửa đúng chuyện này cho `chat_mot_handoff_moi_ntd`
-- nhưng chỉ sửa chỉ mục của nhà tuyển dụng. Chỉ mục hỗ trợ vẫn neo vào `state`:
--
--   WHERE kind = 'AI_SUPPORT' AND state IN ('WAITING_ADMIN', 'HUMAN_ACTIVE')
--
-- `quayLaiAi` không kiểm `kind`, nên chủ phiên gọi được nó trên một ticket admin
-- đang trả lời. State về `AI_ACTIVE` -> chỉ mục nhả hàng đó ra, trong khi
-- `handoffAdminUserId` vẫn còn nguyên. Lặp lại vòng "xin hỗ trợ -> admin nhận ->
-- quay lại AI" là mở được vô hạn ticket cùng lúc.
--
-- ---------------------------------------------------------------------------
-- VÌ SAO VẪN LÀM Ở TẦNG DATABASE DÙ ĐÃ CHẶN Ở SERVICE
-- ---------------------------------------------------------------------------
-- `quayLaiAi` giờ từ chối kênh hỗ trợ, và chỉ riêng nó đã bịt đường khai thác.
-- Nhưng một luật chống trùng sống bằng việc "không hàm nào quên kiểm" là luật
-- sẽ hỏng ở hàm thứ năm người ta viết thêm. Neo đúng thì nó đúng bất kể ai gọi.
--
-- Điều kiện đúng: ĐÃ xin hỗ trợ (`handoffRequestedAt` khác NULL) và CHƯA đóng.
--   yeuCauHoTro    -> đặt handoffRequestedAt, state WAITING_ADMIN  : phủ
--   tiepNhanHoTro  -> HUMAN_ACTIVE, handoffRequestedAt giữ nguyên  : phủ
--   huyYeuCauHoTro -> handoffRequestedAt = NULL                    : NHẢ, đúng ý
--   ketThuc / quét quá hạn -> CLOSED                               : NHẢ, đúng ý
DROP INDEX "chat_mot_ho_tro_dang_mo";

CREATE UNIQUE INDEX "chat_mot_ho_tro_dang_mo"
  ON "chat_sessions" ("ownerUserId")
  WHERE kind = 'AI_SUPPORT' AND "handoffRequestedAt" IS NOT NULL AND state <> 'CLOSED';
