# Design

## Context

Xem `proposal.md` cho động cơ và `specs/chat-generation-stop/spec.md` cho hành vi bắt buộc. FE React/Redux đang dùng fetch SSE; `useChat.stop()` hủy AbortController. Parser cố ý đợi 200ms mỗi delta nên BE có thể sinh xong trước khi FE hiển thị hết. `chatSlice` đánh dấu interrupted và chặn gửi khi có pending/failed/interrupted.

BE Express gọi Gemini qua fetch và `retryStream`. Response close hủy provider, service bắt lỗi và repository lưu failed với content rỗng. `answer` hiện nằm bên trong nhánh sinh; cleanup lúc generator đang yield còn có thể finalize bằng chuỗi rỗng. PostgreSQL đã có generation_id, transaction lock conversation, heartbeat 20s và stale lease 2 phút. Retry giữ assistant ID nhưng đổi generation_id. Có nhiều đường expire trong ChatRepository và MessageRepository phải cùng thay đổi.

Planning home ở repo FE; BE là sibling `../ai-chat-be`. Tài liệu này mô tả cả hai nhưng không sửa cấu hình OpenSpec hay mở rộng allowedEditRoots. Khi apply cần bảo đảm workflow có phạm vi implementation hợp lệ cho cả hai repo; không tự lách phạm vi từ planning home.

## Goals / Non-Goals

**Goals:** Có stop intent bền vững, hủy đúng generation trên nhiều instance, giữ nội dung dở và một kết quả terminal duy nhất; FE không mở lượt mới khi BE còn pending.

**Non-Goals:** Không yêu cầu client gửi nội dung trả lời dở lên BE; không đảm bảo thu hồi chi phí tại Gemini; không thêm Redis, Continue hay Retry cho stopped. Các lựa chọn dưới đây là quyết định kỹ thuật của proposal để review, không phải khẳng định đã tồn tại trong code.

## Decisions

### 1. API Stop riêng; giữ transport nhận xác nhận

Thêm `POST /api/chat/messages/:message_id/stop`, Bearer auth, body `{ generation_id: UUID }`. SSE `conversation` thêm `generation_id` cho job thực sự sinh; replay không có generation đang chạy không cấp token Stop mới. FE lưu token cùng requestId, assistantId và conversationId; token dùng cho concurrency, không thay thế quyền sở hữu.

HTTP contract:

| HTTP | Body / ý nghĩa |
| --- | --- |
| 200 | `{ success: true, data: { conversation_id, message } }`, message đã terminal |
| 202 | `{ success: true, data: { conversation_id, assistant_message_id, generation_id, stop_requested: true } }`, intent đã commit nhưng chưa terminal |
| 400 | `invalid_stop_request` cho UUID/body sai; `invalid_message_role` cho user message |
| 401 | Auth hiện có |
| 404 | `message_not_found` chung cho thiếu record/khác owner |
| 409 | `generation_mismatch` khi pending đã mang token khác |

Sử dụng envelope lỗi hiện có `{ success: false, code, message }`. Stop handler commit intent rồi đọc lại một lần: trả 200 nếu worker đã finalize, còn lại trả 202; không giữ HTTP chờ worker. Terminal hiện có được trả nguyên trạng, kể cả completed/failed; terminal không có active token nên không cần token match để trả bản ghi nhưng vẫn phải xác thực/validate body. Không cho terminal thay đổi trạng thái bởi Stop.

Không abort SSE ngay khi bấm Stop: FE cần nhận định danh và kết quả cuối, nhất là lúc bấm trước event conversation. Thay thế hành vi nút Stop, tách transport abort cho logout/unmount và edit/delete. Nếu backend cũ không cấp token, FE đối soát và báo chưa thể xác nhận Stop, không giả vờ thành công.

Alternative: chỉ abort fetch như hiện tại không phân biệt chủ động với mất mạng, không có xác nhận lưu; registry trong RAM đơn lẻ không xử lý request vào instance khác.

### 2. PostgreSQL làm nguồn stop intent và checkpoint

Migration mới thêm `stop_requested_at timestamptz NULL` vào messages; status hiện là text nên mở rộng union/generated types thành stopped, không sửa migration đã áp dụng. Mọi prepare generation mới đặt stop_requested_at NULL, cấp token mới. Cột content của pending dùng làm checkpoint BE, không nhận nội dung do client cung cấp.

Stop transaction khóa conversation theo thứ tự hiện có, xác minh owner/role, đọc lại message sau lock. Pending đúng token được đặt stop_requested_at bằng timestamp đầu tiên; gọi lặp không đổi timestamp hay gia hạn lease. Không xóa generation_id tại lúc nhận intent: worker cần token để finalize. Generation_id được xóa khi terminal như hiện tại.

Worker có vòng kiểm tra stop độc lập với việc generator đang yield/backpressure, mặc định mỗi 250ms, không để hai poll chồng nhau. Kiểm tra trước lần gọi provider đầu và trước retry; stop intent hủy AbortController riêng kết hợp với signal transport, timeout, superseded. Poll không gia hạn lease. Khi không còn record/token hoặc status đã terminal thì hủy worker cũ. Heartbeat giữ chu kỳ 20s, không hồi sinh lease hết hạn.

Mỗi delta checkpoint toàn bộ answer của attempt hiện tại trước khi emit, có điều kiện đúng token/pending/lease còn hiệu lực và chưa có stop intent. Khi checkpoint không ghi được vì Stop, worker ngừng thêm text, lấy checkpoint cuối làm nội dung dừng. Reset cũng checkpoint chuỗi rỗng trước khi emit reset và gọi attempt mới. Nhờ vậy không nối lại chữ từ attempt cũ. Stop có thể thêm độ trễ tối đa một chu kỳ poll ngoài độ trễ DB/upstream; không chờ heartbeat 20s để dừng.

Đây là lựa chọn ưu tiên tính đúng cho khối lượng hiện tại; không giữ transaction/connection trong khi chờ network, backoff hay SSE drain. Alternative: chỉ giữ answer trong RAM mất toàn bộ partial khi worker chết; ghi Stop terminal ngay ở endpoint có thể cho gửi mới khi upstream chưa được worker hủy.

### 3. Một đường finalize có phân loại nguyên nhân

Thay boolean failed bằng kết quả có nguyên nhân rõ ràng: completed, failed hoặc stop_requested; đọc stop intent trong transaction finalize, không chỉ dựa AbortError. Đưa answer/checkpoint ra phạm vi cleanup để consumer đóng trong lúc yield vẫn giữ nội dung đúng. Nếu Stop đã commit, cleanup do disconnect/timeout cũng ưu tiên stopped.

```text
pending -- completion transaction first --> completed
pending -- accepted stop intent ----------> pending + stop_requested
pending + stop_requested -- finalize -----> stopped
pending -- error/disconnect, no intent ---> failed
pending + expired lease -----------------> failed or stopped by intent
```

Finalize và Stop cùng lock conversation, kiểm tra generation_id, pending, parent còn tồn tại và lease. Transaction finalize thấy intent thì lưu stopped từ checkpoint, xóa generation_id, giữ content và error_text NULL. Nếu completion commit trước thì Stop trả completed. Cleanup/finish gọi lặp không ghi đè terminal. superseded chỉ dùng khi message/token không còn hợp lệ; không xóa bubble stopped do chính worker vừa finalize.

Stale recovery ở mọi đường send/retry/finish/GET messages chọn stopped khi có intent và giữ checkpoint; không có intent giữ chính sách failed hiện có. Stop không cập nhật updated_at để tránh kéo dài lease của worker đã chết. Crash recovery chỉ bảo đảm checkpoint đã commit; không bảo đảm text còn trong RAM/chưa checkpoint. Sau lỗi DB không báo terminal thành công.

### 4. FE phân biệt stopping với interrupted

Stream state thêm phase `running | stopping`, generationId và stop intent cục bộ. Bấm Stop chuyển stopping ngay, giữ bubble; parser bỏ qua các delta đang đệm hoặc sắp tới thay vì tiếp tục delay và render. Khi chưa có identity, chờ conversation rồi dispatch request Stop đúng một lần. Dùng controller riêng cho request Stop để không bị hủy cùng stream.

SSE `done` giữ schema hiện có, `message.status` thêm stopped; `conversation` có token. Dùng requestId + generationId để loại response cũ. Chỉ áp dụng terminal authoritative một lần; body trả từ Stop 200 và SSE done có thể đến theo bất kỳ thứ tự nào. Nội dung authoritative có thể dài hơn chữ lúc bấm do BE đi trước FE; đồng bộ một lần, hiển thị nhãn Đã dừng nếu status stopped. Nếu completed thắng, hiển thị completed.

Stop 202 giữ composer khóa. Khi SSE mất hoặc sau 202 chưa có done, đối soát toàn bộ history bằng luồng pagination hiện có mỗi 500ms, không để load cũ đè stream mới. Sau 10s chưa có terminal, hiện trạng thái chưa xác nhận, cho thử lại Stop/tải lại; chỉ poll lại theo thao tác hoặc khi cửa sổ được focus. Không coi hết 10s là thành công; stale recovery hiện có có thể cần 2 phút. 401 theo auth flow; 404 đồng bộ conversation đã xóa/sửa; 409 đối soát, không tự Stop token mới.

`stopped` được thêm ở ApiMessage, Message, operation/database types. Điều kiện gửi tại hook, thunk và BE đều bỏ stopped khỏi unresolved; giữ pending/failed và interrupted chưa đối soát. Message stopped không có spinner, Retry hay nút tải lại trạng thái bắt buộc. Logout/unmount vẫn chỉ abort transport, không tự gọi API Stop; logout trong khi stopping không được thu hồi intent đã commit.

### 5. Context và Retry sau Stop

History dùng completed và assistant stopped có content.trim() không rỗng, giữ giới hạn 40 messages/48000 ký tự và thứ tự sequence_no; kiểm tra cả ChatRepository.history và các đường MessageRepository.history đang được dùng. User message giữ completed. Không gửi assistant stopped rỗng vào Gemini. Retry vẫn chỉ failed, tránh retry một stopped cũ xóa nghĩa của lịch sử khi đã có tin sau. Edit giữ quy tắc truncate hiện có và được phép tạo lượt mới; kết quả worker đã bị xóa không hồi sinh record.

Alternative: loại tất cả stopped khỏi context đơn giản hơn nhưng câu hỏi tiếp theo về phần trả lời dở sẽ thiếu ngữ cảnh.

## Risks / Trade-offs

- Poll 250ms và checkpoint mỗi delta tăng SQL/write load -> dùng query có index ID/token, không poll chồng, test số query và cleanup timer; tối ưu gom checkpoint chỉ bằng change sau nếu vẫn giữ hợp đồng lưu trữ.
- FE có delay 200ms -> nội dung xác nhận có thể dài hơn chữ lúc bấm; spec xác định BE là nguồn nội dung, không tin nội dung client.
- Provider có thể tiếp tục tính token sau khi hủy fetch -> chỉ cam kết truyền abort và ngừng attempt ở hệ thống này.
- DB outage hoặc worker crash -> không mở composer sớm; có đối soát, retry Stop và stale recovery. Không cam kết khôi phục text chưa checkpoint.
- Pending checkpoint chứa partial -> mọi API đọc phải giữ status pending và không đưa vào context; không diễn giải partial thành completed.
- Hai repo triển khai lệch phiên bản -> triển khai schema/BE trước FE; cần kiểm tra client cũ trước rollback.

## Migration Plan

1. Ở bước apply, xác nhận phạm vi hai repo hợp lệ với workflow; không sửa source ngoài allowedEditRoots chỉ vì có trong tasks.
2. Thêm migration kế tiếp sau 002, chạy db:migrate/db:types và kiểm tra schema mới trên PostgreSQL test. Record cũ giữ nguyên status/content, stop_requested_at mặc định NULL.
3. Deploy BE hỗ trợ status/API/SSE mới trên tất cả instance; drain worker phiên bản cũ trước khi bật FE Stop mới để không có worker không hiểu intent.
4. Deploy FE; smoke test Stop trước token, sau partial, trong backoff, completed race và refresh/send tiếp. Giữ legacy send route.
5. Rollback FE về bản tương thích stopped nếu cần; không hạ BE về phiên bản không hiểu stopped khi còn dữ liệu này. Drain generation, tắt entry Stop và dùng bản BE tương thích hoặc data migration riêng được review. Không tự chuyển stopped thành completed/failed hay xóa partial. Cột mới có thể giữ lại khi rollback.
