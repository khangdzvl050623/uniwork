# Môi trường máy chạy dự án — chẩn đoán khi máy crash

Viết ra vì đã mất một buổi đi sai hướng: API báo lỗi Prisma, tưởng lỗi code, hoá
ra máy hết bộ nhớ và hết đĩa.

Tài liệu này để lần sau nhìn triệu chứng là biết đo ở đâu, và biết những gì đã
được thiết lập rồi để chỉnh lại cho đúng.

---

## Triệu chứng đã gặp thật (2026-09-12)

```
@uniwork/api:dev: prisma:error Error in PostgreSQL connection: Error { kind: Closed, cause: None }
```

Kèm theo: mở DevTools là Docker sập, container Postgres chết, đôi khi cả máy đơ.

**Đây KHÔNG phải lỗi code.** `kind: Closed` nghĩa là kết nối bị đóng **từ phía
Postgres** — Prisma chỉ phát hiện ống dẫn đã đứt. Container chết vì Windows giết
nó khi hết bộ nhớ, không phải vì truy vấn sai.

Chuỗi nhân quả:

```
RAM cạn
  → mở DevTools, trình duyệt xin thêm vài trăm MB
    → Windows phải nhường chỗ, đẩy WSL2 ra
      → Docker Desktop sập, Postgres chết theo
        → API mất kết nối → "kind: Closed"
```

---

## Chẩn đoán: chạy hai lệnh này TRƯỚC khi đoán bất cứ điều gì

```powershell
# 1. Áp lực bộ nhớ
Get-Counter '\Memory\Available MBytes', '\Memory\Committed Bytes', '\Memory\Commit Limit'

# 2. Dung lượng đĩa
Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
  Select-Object DeviceID,
    @{N='Tong_GB';E={[math]::Round($_.Size/1GB,1)}},
    @{N='Trong_GB';E={[math]::Round($_.FreeSpace/1GB,1)}},
    @{N='Trong_pct';E={"$([math]::Round($_.FreeSpace/$_.Size*100))%"}}
```

### Đọc kết quả

| Chỉ số | Ngưỡng | Nghĩa |
| --- | --- | --- |
| `Available MBytes` | < 500 MB | Sắp swap hoặc giết tiến trình |
| `Committed / Commit Limit` | > 90% | ⚠ Nguy hiểm nhất — chạm 100% là app bị kill |
| Ổ C trống | < 10% | Windows không mở rộng nổi paging file |

### ⚠ Cạm bẫy: ĐỪNG dùng `FreePhysicalMemory`

Đã mắc bẫy này một lần. `Win32_OperatingSystem.FreePhysicalMemory` là RAM **hoàn
toàn trống**, mà Windows cố ý giữ con số đó thấp — RAM rảnh không dùng là RAM phí,
nên nó luôn đem đi làm cache.

Lần đó đo ra "còn 1.9 GB" rồi sau khi sửa lại thành "0.2 GB", tưởng tệ đi trong
khi thực tế đã tốt lên. Phải xem `Available MBytes` (= trống + standby, tức phần
cấp được ngay) và `Committed / Commit Limit`.

---

## Những gì đã thiết lập

### 1. File phân trang — chuyển sang ổ D

`sysdm.cpl` → Advanced → Performance Settings → Advanced → Virtual memory

| Ổ | Thiết lập | Vì sao |
| --- | --- | --- |
| C: | **No paging file** | Ổ hệ điều hành chỉ 149 GB và từng xuống 3% trống |
| D: | **Custom: 16384 – 32768 MB** | Còn 155 GB, cùng ổ NVMe nên tốc độ như nhau |

Kết quả: `Commit Limit` từ **20.2 GB → 31.7 GB**, mức dùng từ **96% → 51%**.

> Đổi kích thước paging file trên ổ ĐÃ CÓ sẵn thì có hiệu lực ngay, không cần
> khởi động lại. Chỉ khi tạo mới trên ổ khác hoặc xoá hẳn mới cần reboot.
> Kiểm bằng `Get-CimInstance Win32_PageFileUsage`.

**Vì sao cần:** `Commit Limit` = RAM thật + file phân trang. Hết hạn mức đó thì
Windows **từ chối cấp bộ nhớ**, và phần lớn phần mềm không xử lý nổi tình huống
bị từ chối — chúng chết tại chỗ. Có paging file thì máy **chậm đi một chút thay
vì crash**: Windows đẩy phần bộ nhớ nguội xuống đĩa thay vì giết tiến trình.

Paging file **không thay thế được RAM**. Nó là lưới an toàn.

### 2. `C:\Users\<user>\.wslconfig` — chặn WSL2 phình

```ini
[wsl2]
memory=4GB
processors=8
swap=2GB
autoMemoryReclaim=gradual
```

Không có file này, WSL2 được phép lấy **một nửa RAM máy** và **không trả lại**
sau khi dùng xong. `autoMemoryReclaim=gradual` (cần WSL ≥ 2.0) bắt nó trả dần.

Chỉnh giá trị rồi chạy `wsl --shutdown` để áp dụng.

> Ghi chú trung thực: WSL **không phải** thủ phạm chính của lần crash 2026-09-12
> — đo ra `vmmemWSL` chỉ 1.5 GB, dưới xa trần. File này là phòng ngừa cho về sau,
> không phải thứ đã chữa được sự cố.

---

## Khi cần dọn đĩa

Đo trước, đừng xoá mò:

```powershell
# Thư mục nào trong AppData đang chiếm chỗ
foreach ($p in @($env:LOCALAPPDATA, $env:APPDATA)) {
  Write-Output "=== $p ==="
  Get-ChildItem $p -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $gb = [math]::Round((Get-ChildItem $_.FullName -Recurse -File -Force -ErrorAction SilentlyContinue |
      Measure-Object Length -Sum).Sum / 1GB, 2)
    if ($gb -ge 0.3) { [PSCustomObject]@{ Ten = $_.Name; GB = $gb } }
  } | Sort-Object GB -Descending | Format-Table -AutoSize
}
```

### Xoá được an toàn

| Chỗ | Cách | Mất gì |
| --- | --- | --- |
| `%TEMP%` | `Get-ChildItem $env:TEMP -Force \| Remove-Item -Recurse -Force -ErrorAction SilentlyContinue` | Không |
| Cache Chrome/Edge | Chỉ xoá thư mục tên `Cache`, `Code Cache`, `GPUCache`, `CacheStorage`, `ScriptCache` trong `User Data` | Lần mở sau chậm một chút |
| Docker | `docker system prune -a` | Phải tải lại image (`postgres:17-alpine` ~80 MB) |

⚠ **Đừng xoá cả thư mục `User Data` của trình duyệt** — mất bookmark, mật khẩu,
lịch sử, phiên đăng nhập. Chỉ xoá đúng các thư mục có tên chứa `Cache`.

### Gỡ phần mềm: uninstaller TRƯỚC, xoá thư mục SAU

Đã suýt làm sai với WPS Office: `UninstallString` của nó nằm **ngay trong thư mục
định xoá** (`AppData\Local\Kingsoft\...\utility\uninst.exe`). Xoá thư mục trước là
mất luôn đường gỡ sạch, còn lại registry trỏ vào file không tồn tại và phần mềm
vẫn hiện trong Apps & Features mà gỡ không được.

Đúng thứ tự:

```powershell
# 1. Tìm đường gỡ
Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
                 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
                 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*' |
  Where-Object DisplayName | Select-Object DisplayName, UninstallString

# 2. Chạy uninstaller, 3. rồi mới dọn thư mục còn sót
```

Sau khi gỡ, các file dạng `*.dll_d_76908a_d_76a7fa` còn lại là DLL shell extension
đã được hẹn xoá — Windows tự dọn ở lần khởi động lại. Không cần làm gì.

---

## Kết quả lần dọn 2026-09-12

| | Trước | Sau |
| --- | --- | --- |
| Commit Limit | 20.2 GB (dùng 96%) | **31.7 GB** (dùng 51%) |
| RAM Available | 319 MB | **3530 MB** |
| Ổ C trống | 4.0 GB (**3%**) | **19.4 GB** (13%) |

Lấy lại 15.4 GB: Temp 5.04 + WPS Office 7.7 + cache Chrome 2.69.

Còn dư nếu cần thêm: `docker system prune -a` (~3 GB), `Local\Packages` (7.55 GB).

Ngưỡng an toàn cho ổ hệ điều hành là **≥ 15% và ≥ 20 GB** — hiện 13%, vẫn nên
để mắt.

---

## Ghi chú cho việc đo hiệu năng web

Máy đang thiếu bộ nhớ thì **mọi số đo hiệu năng đều không đáng tin**. Khi
`Memory Compression` phải hoạt động, nó ăn CPU liên tục và làm chậm mọi thứ —
nên "trang web lag" có thể chỉ là máy đang vật lộn.

Sửa máy trước, rồi mới kết luận về code.

Đo FPS đúng cách: Edge/Chrome DevTools → `Ctrl+Shift+P` → `Show Rendering` →
bật **Frame Rendering Stats**, và nhớ đặt **CPU throttling 4×–6×** trong tab
Performance (máy khoẻ không tái hiện được lag của máy yếu).

⚠ Trên Edge, tắt **Efficiency mode** (`edge://settings/system`) trước khi đo —
nó tự bóp hiệu năng tab và làm số liệu sai lệch.
