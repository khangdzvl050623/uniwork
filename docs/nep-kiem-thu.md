# Nếp kiểm thử — ghi chú kỹ thuật

Viết ra vì tới Sprint 4 nếp này đã ổn định nhưng chỉ tồn tại trong đầu người làm và trong comment rải rác. Tài liệu này để đội sau, hoặc dự án sau, không phải suy lại từ đầu.

Không phải quy trình bắt buộc. Là **lý do đằng sau những việc trông như thừa**.

---

## 1. Test đỏ không tự nói ai sai

Ba nguyên nhân, cùng một biểu hiện:

| Ai sai | Sửa gì | Đã gặp |
| --- | --- | --- |
| **Code** | Sửa code, giữ nguyên test | Thường xuyên |
| **Yêu cầu** đổi | Sửa test theo yêu cầu mới | Đổi `salaryMin` → `salaryMax` (Sprint 3) |
| **Test** sai | Sửa test, không đụng code | `expect(d).toBe(48)` — số học trong test sai, code đúng là 73 (Sprint 4) |

Loại thứ ba nguy hiểm nhất vì nó **trông giống hệt loại một**, và cám dỗ là chạy test, đọc giá trị code trả về, dán vào cho xanh.

Làm vậy biến test từ **bản đặc tả** thành **bản chép lại hành vi hiện tại**. Nó sẽ không bao giờ bắt lỗi nữa, vì nó luôn đồng ý với code — kể cả khi code sai.

**Cách tránh:** giá trị kỳ vọng phải đến từ nguồn NGOÀI code — tính tay, tài liệu, hoặc dữ liệu thật. Trường hợp `73` ở trên: tính tay ra `58/0.8 = 72.5 → 73`, rồi đối chiếu ví dụ 2 trong `sprint-4.md` cũng ghi 73. Hai nguồn độc lập trùng nhau thì mới sửa.

Ca đã có test fixture SAI: `tinHopLe()` trong `jobs.test.ts` từng có `minShiftsPerWeek: 3` với 2 ca — dữ liệu không hợp lệ mà test vẫn xanh, cho tới khi luật Zod mới bắt được nó.

---

## 2. Test xanh không chứng minh test có canh gác gì

461 ca xanh chỉ nói: code chạy hết mà không ném lỗi. Nó **không** nói có ai đứng gác.

Cách kiểm: **cố ý phá code, xem test có đỏ đúng chỗ không.** Phá xong khôi phục ngay.

Năm đột biến chạy trên module ứng tuyển (Sprint 4):

| Phá gì | Ca đỏ |
| --- | --- |
| Mẫu số độ phủ cứng bằng 3 | 5 — "ví dụ 1 → 1/1, KHÔNG phải 1/3" |
| Quên chuẩn hoá lại trọng số | 5 — "chia lại theo tổng trọng số CÒN LẠI" |
| `eligible` suy từ điểm thay vì từ số ca | 1 — "CỔNG không bị điểm kéo lên" |
| Bỏ `jobId` khi tìm đơn (lỗ ownership) | 1 — "truy vấn có LỌC KÈM jobId" |
| Nhánh "kín" cũng xin `phone`/`email` | 1 — "đến từ CÂU TRUY VẤN KHÁC" |

Đột biến nào **không** làm ca nào đỏ là một lỗ hổng test, không phải một đột biến vô hại.

### Hai đột biến cuối dạy một chuyện riêng

Chúng không làm sai bất kỳ kết quả nào người dùng nhìn thấy. Đơn vẫn đổi trạng thái, danh sách vẫn hiện đủ. Thứ chúng phá là **một lỗ hổng quyền** và **một chỗ rò dữ liệu** — loại lỗi không bao giờ tự lộ, chỉ lộ khi có người đi tìm.

Nên hai ca test đó kiểm **hình dạng truy vấn**, không kiểm kết quả:

```ts
// Không đủ: response ở PENDING không có phone.
// Đủ: câu truy vấn cho nhánh PENDING KHÔNG XIN phone.
const selectKin = donFindMany.mock.calls[0][0].select.studentProfile.select
expect(selectKin.phone).toBeUndefined()

expect(donFindFirst.mock.calls[0][0].where).toEqual({ id: 'app-1', jobId: 'job-1' })
```

Nguyên tắc: **thứ gì sai mà không có biểu hiện thì phải kiểm ở chỗ nó được quyết định, không ở chỗ nó hiện ra.**

---

## 3. Kiểm bằng EXIT CODE, không bằng output đã lọc

```bash
# ❌ Pipe nuốt mã thoát — lệnh này "thành công" kể cả khi lint hỏng
pnpm lint | grep error

# ✅
pnpm lint > /tmp/lint.log 2>&1; echo "EXIT=$?"
```

CI đã fail một lần ở Sprint 3 vì tôi tin vào output đã lọc: `eslint-disable` trỏ tới rule chưa cài, `grep error` không khớp dòng nào nên trông như sạch.

Cùng loại bẫy: `| tail`, `| head`, `| jq`.

---

## 4. Test bảo vệ giả định; dữ liệu thật kiểm chính giả định đó

Đây là chỗ test **không** đi tới được.

Bug slug ở Sprint 3 qua sạch mọi unit test: test dùng id dạng cuid, còn `seed.ts` dùng `demo-job-cafe-toi`. Phép tách id "cắt ở dấu gạch cuối" đúng với cuid và sai với 7 trên 9 tin thật — **404 toàn bộ**, mà test vẫn xanh.

Nên sau khi test xanh vẫn phải chạy thật:

```bash
curl ... | grep -cE "0[0-9]{9}|@"     # 0 = không rò liên hệ
docker exec ... psql -c "SELECT ..."   # dữ liệu ghi xuống có đúng hình dạng không
```

Sprint 4 làm lượt này bắt được ba xác nhận mà unit test không cho được: ràng buộc `@@unique` bắn thật trên đơn trùng, `required: 2` nằm đúng trong JSON đã đóng băng, và `grep` số điện thoại ra 0 kết quả trên response thật.

---

## 5. Chạy TOÀN BỘ, không chỉ test vừa viết

Thêm 31 ca cho module mới thì vẫn chạy cả 461. Câu hỏi cần trả lời là *"tôi có làm hỏng gì ngoài ý muốn không"* — và chỉ **file khác** trả lời được câu đó.

---

## 6. Ca âm nhiều hơn ca dương

Ca dương ("lọc ra đúng kết quả") gần như luôn đúng ngay lần đầu. Lỗi nằm ở ca âm:

- Người khác gọi → **403**, không phải 404, không phải mảng rỗng. Ba thứ đó nói ba chuyện khác nhau.
- Không tồn tại → **404**.
- Đúng người nhưng sai trạng thái → **409**.
- Lọc không ra gì → mảng rỗng, không phải lỗi.

Mỗi endpoint đụng tới dữ liệu của một người phải có **cả ba** ca đầu, và ba mã trả về khác nhau.

---

## Tóm tắt một dòng cho mỗi mục

1. Quyết định ai sai **trước khi** gõ, bằng một nguồn ngoài code.
2. Phá code để chứng minh test có canh gác.
3. `echo $?`, đừng `| grep`.
4. Test xanh xong vẫn `curl` vào dữ liệu thật.
5. Chạy hết, không chạy mỗi phần mình vừa viết.
6. Ca âm mới là chỗ có lỗi.
