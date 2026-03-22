# b-messenger 전용 Supabase MCP 서버

## 연결 정보

| 항목 | 값 |
|------|-----|
| Project Name | aos_erp1 (b-messenger) |
| Project Ref | `jsdqmsbqtgdacccqkrjm` |
| Organization | dsuc-supabase |
| MCP URL | `https://mcp.supabase.com/mcp?project_ref=jsdqmsbqtgdacccqkrjm` |

## Claude CLI 등록 방법

```bash
# 프로젝트 root에서 실행
claude mcp add --scope project --transport http supabase "https://mcp.supabase.com/mcp?project_ref=jsdqmsbqtgdacccqkrjm"
```

위 명령 실행 시 프로젝트 root에 `.mcp.json` 이 자동 생성됩니다.

## VS Code Copilot 등록 방법

`.vscode/mcp.json` 에 이미 `bm-supabase` 서버가 등록되어 있습니다.

```json
{
  "servers": {
    "bm-supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=jsdqmsbqtgdacccqkrjm"
    }
  }
}
```

## 테이블 명명 규칙

모든 테이블에 `b-messenger_` 접두사를 붙입니다.

| 상수명 | 실제 테이블명 |
|--------|-------------|
| USERS | b-messenger_users |
| CONTACTS | b-messenger_contacts |
| GROUPS | b-messenger_groups |
| GROUP_MEMBERS | b-messenger_group_members |
| GROUP_MEMBER_COUNTS | b-messenger_group_member_counts (VIEW) |
| TEMPLATES | b-messenger_templates |
| CAMPAIGNS | b-messenger_campaigns |
| SEND_LOGS | b-messenger_send_logs |
| SEND_TARGETS | b-messenger_send_targets |
| CAMPAIGN_FILTERS | b-messenger_campaign_filters |
| API_KEYS | b-messenger_api_keys |
| SUBSCRIPTIONS | b-messenger_subscriptions |
| ADDRESS_BOOKS | b-messenger_address_books |

## 마이그레이션

`supabase/migrations/` 폴더의 SQL 파일을 Supabase SQL Editor 또는 MCP를 통해 순서대로 실행합니다.
