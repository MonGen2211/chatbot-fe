# Tasks

Tất cả checkbox dưới đây là công việc cho bước apply; chưa thực hiện trong propose. `FE` là `ai-chat-ui`, `BE` là `../ai-chat-be`. Hợp đồng hành vi nằm trong `specs/chat-generation-stop/spec.md`; các quyết định triển khai nằm trong `design.md`.

## 1. Phạm vi và lưu trữ BE

- [ ] 1.1 Bảo đảm apply có scope hợp lệ cho cả FE và BE theo workflow đã chọn trước khi ghi source; kiểm tra actionContext/allowedEditRoots và ghi nhận mapping hai repo trong báo cáo apply, không tự sửa cấu hình workflow để vượt scope.
- [ ] 1.2 Thêm migration mới cho `stop_requested_at`, mở rộng stopped trong message/operation/database types và reset intent khi tạo generation; kiểm tra migration trên DB test với record cũ và chạy `npm.cmd run db:types`, `npm.cmd run typecheck` tại BE.
- [ ] 1.3 Thêm repository stop-intent có lock conversation, kiểm tra owner/role/token, idempotency và terminal response; kiểm chứng PostgreSQL tests cho hai request lặp, khác owner, token cũ và completed đã tồn tại.
- [ ] 1.4 Thêm checkpoint theo token/lease/stop intent và reset checkpoint trước attempt mới; kiểm chứng test rằng text attempt cũ không xuất hiện sau reset và checkpoint sau intent không ghi thêm chữ.
- [ ] 1.5 Thống nhất finalize và tất cả stale recovery ở ChatRepository/MessageRepository để ưu tiên stopped khi có intent, giữ checkpoint và không ghi đè terminal; kiểm chứng tests Stop thắng/completion thắng, lease hết, parent bị xóa và worker cũ đến muộn.
- [ ] 1.6 Cập nhật `BE/docs/chat-operations.md` cho status, checkpoint, locking và stale recovery; đối chiếu mô tả với SQL và các test ở nhóm này.

## 2. Hủy generation và hợp đồng HTTP/SSE BE

- [ ] 2.1 Thêm polling stop 250ms không chồng lặp, kiểm tra trước provider/retry và kết hợp cancellation với transport/timeout/superseded; kiểm chứng service tests dùng provider mock đang chờ token, đang backoff và hai service instance dùng chung store.
- [ ] 2.2 Refactor service outcome/cleanup để Stop đã chấp nhận lưu stopped cả khi consumer đóng lúc yield, không retry và dọn timer/listener; kiểm chứng tests partial, empty, reset, disconnect sau intent và disconnect không có intent, không dùng Google thật.
- [ ] 2.3 Thêm route/controller/validator `POST /api/chat/messages/:message_id/stop` theo contract 200/202/400/401/404/409; kiểm chứng HTTP tests đủ auth, owner, body, role, mismatch và gọi lặp, không lộ thông tin người khác.
- [ ] 2.4 Thêm generation_id vào SSE conversation cho active job và stopped vào done/history; kiểm chứng SSE contract tests cho send/retry/edit/replay, đảm bảo legacy send route vẫn hoạt động.
- [ ] 2.5 Cập nhật history context để gồm stopped không rỗng theo thứ tự/giới hạn hiện có, giữ Retry chỉ failed; kiểm chứng provider mock nhận đúng context, bỏ stopped rỗng và API retry stopped trả 409.
- [ ] 2.6 Cập nhật `BE/docs/frontend-api.md` và `BE/docs/chat-operations.md` cho API Stop, status, SSE token, timeout/đối soát và lỗi; đối chiếu examples với HTTP/SSE tests rồi chạy `npm.cmd test` tại BE.

## 3. State, service và giao diện FE

- [ ] 3.1 Mở rộng ApiMessage/Message/ChatEvent và stream state với stopped, generationId và phase running/stopping; thêm service Stop dùng controller riêng; kiểm chứng `tests/chat.test.cjs` đọc đúng token và parse response 200/202/error.
- [ ] 3.2 Thay hành vi nút Stop bằng intent/phase stopping, bỏ delta đã đệm và gửi Stop khi conversation identity tới; kiểm chứng tests Stop trước conversation, trước token đầu và trong delay 200ms, bao gồm generation được tạo từ send/retry/edit.
- [ ] 3.3 Hợp nhất terminal từ Stop 200 và SSE done theo requestId/generationId, loại callback cũ và xử lý completed thắng; kiểm chứng hai thứ tự response, bấm Stop lặp và response đến sau khi chuyển conversation hoặc tạo generation khác.
- [ ] 3.4 Thêm đối soát sau 202/lỗi mạng/EOF: history 500ms tối đa 10s mỗi đợt, trạng thái chưa xác nhận và thao tác thử lại/tải lại/focus; kiểm chứng tests không mở composer vì 202 hoặc timeout và không để history cũ ghi đè generation mới.
- [ ] 3.5 Điều chỉnh canSend/thunk guards để stopped không chặn gửi, giữ chặn unresolved khác; hiển thị Đã dừng và empty fallback, bỏ spinner/Retry cho stopped; kiểm chứng tests gửi tiếp, reload partial, retry bị từ chối và Stop không báo toast lỗi provider.
- [ ] 3.6 Tách transport abort của logout/unmount/edit/delete khỏi explicit Stop và xử lý backend chưa có token; kiểm chứng tests không tự gọi API Stop khi đóng/logout, intent đã commit vẫn được đối soát và không gửi Stop nhầm lượt sau edit.
- [ ] 3.7 Cập nhật `FE/README.md` về Stop, nội dung authoritative có thể dài hơn phần đã render và yêu cầu BE tương thích; chạy `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build` tại FE và đối chiếu tài liệu với hành vi UI.

## 4. Kiểm tra tích hợp và chuẩn bị triển khai

- [ ] 4.1 Chạy PostgreSQL integration có cờ `RUN_PG_INTEGRATION=1` theo hướng dẫn BE trong môi trường test; kiểm chứng Stop/completion cạnh tranh, Stop ở instance khác, checkpoint/worker crash/stale recovery và không hồi sinh message sau edit/delete.
- [ ] 4.2 Smoke test FE/BE cùng nhau: Stop trước identity, giữa partial, trong backoff, sát done, mất mạng lúc Stop, refresh rồi gửi tiếp; xác nhận nội dung/status trong UI khớp DB và mock upstream nhận abort, không sinh attempt mới.
- [ ] 4.3 Kiểm tra tài nguyên polling/checkpoint và cleanup khi kết thúc nhiều lượt mock; xác nhận không còn timer/query tiếp diễn sau terminal và không giữ DB transaction lúc chờ provider/SSE.
- [ ] 4.4 Bổ sung checklist deploy/rollback vào docs BE: migration rồi BE toàn bộ instance, drain worker cũ rồi FE; kiểm chứng trên staging hoặc môi trường local tương đương, ghi rõ kết quả và giới hạn nếu chưa có staging, không rollback làm mất partial/stopped.
