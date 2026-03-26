// ================================================================
// messages/page.tsx — 메시지 작성 페이지
// 채널 선택 + 그룹 선택 + 메시지 편집기 + 폰 미리보기 + 실제 발송
// ================================================================
"use client";

import { useState, useEffect } from "react";
import { getGroups, getGroupMembersForSend } from "@/app/actions/groups";
import { sendToGroup, type GroupSendParams } from "@/app/actions/send";
import { useTemplates } from "@/hooks/useTemplates";
import { usePlan } from "@/hooks/usePlan";
import { dataStore } from "@/lib/store";
import type { Group, Customer } from "@/types";
import styles from "@/styles/messages.module.css";

const CHANNELS = [
  { id: "sms" as const,         icon: "📱", label: "SMS 문자",      desc: "90바이트 이하 단문" },
  { id: "lms" as const,         icon: "📄", label: "LMS 문자",      desc: "장문 문자 (2000자)" },
  { id: "kakao_friend" as const, icon: "💛", label: "카카오 친구톡", desc: "친구에게 자유 발송" },
  { id: "kakao_alim" as const,  icon: "💬", label: "카카오 알림톡", desc: "인증된 템플릿 발송" },
];

const DEPTH_COLORS = ["#a78bfa", "#4ade80", "#fbbf24", "#f87171"];

export default function MessagesPage() {
  const { can } = usePlan();
  const [channel, setChannel] = useState<"sms" | "lms" | "kakao_friend" | "kakao_alim">("sms");
  const [message, setMessage] = useState("");
  const [fallback, setFallback] = useState(true);

  // 저장된 템플릿
  const { templates: savedTemplates, loading: templatesLoading } = useTemplates(channel);

  // 그룹 트리
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // 체크된 리프 그룹 IDs + 멤버 캐시
  const [checkedLeafs, setCheckedLeafs] = useState<Set<string>>(new Set());
  const [memberCache, setMemberCache] = useState<Map<string, { members: Customer[]; loading: boolean }>>(new Map());

  // 발송 상태
  const [sending, setSending] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    successCount: number;
    failCount: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    async function loadGroups() {
      setGroupsLoading(true);
      const { data } = await getGroups();
      if (data) setGroups(data);
      setGroupsLoading(false);
    }
    loadGroups();
  }, []);

  // 자식이 있는지 여부
  function hasChildren(groupId: string): boolean {
    return groups.some(g => g.parent_id === groupId);
  }

  // 모든 부모가 열려 있어야 보임
  function isVisible(group: Group): boolean {
    if ((group.depth ?? 0) === 0) return true;
    const parent = groups.find(g => g.id === group.parent_id);
    if (!parent) return false;
    return expandedGroups.has(parent.id) && isVisible(parent);
  }

  // ── 리프 그룹 계산 헬퍼 ───────────────────────────────────────
  function getLeafDescendants(groupId: string): string[] {
    const children = groups.filter(g => g.parent_id === groupId);
    if (children.length === 0) return [groupId];
    return children.flatMap(c => getLeafDescendants(c.id));
  }

  type CheckState = 'none' | 'partial' | 'all';
  function getCheckState(groupId: string): CheckState {
    const leaves = getLeafDescendants(groupId);
    const n = leaves.filter(id => checkedLeafs.has(id)).length;
    if (n === 0) return 'none';
    if (n === leaves.length) return 'all';
    return 'partial';
  }

  // 멤버 캐시 fetch (리프 단위)
  async function fetchGroupMembers(groupId: string) {
    if (memberCache.get(groupId)?.loading) return;
    setMemberCache(prev => {
      const next = new Map(prev);
      next.set(groupId, { members: prev.get(groupId)?.members ?? [], loading: true });
      return next;
    });
    const { data } = await getGroupMembersForSend(groupId);
    setMemberCache(prev => {
      const next = new Map(prev);
      next.set(groupId, { members: data ?? [], loading: false });
      return next;
    });
  }

  // 체크박스 클릭 (3단계 토글)
  function handleCheckClick(e: React.MouseEvent, group: Group) {
    e.stopPropagation();
    const leaves = getLeafDescendants(group.id);
    const state = getCheckState(group.id);
    if (state === 'all') {
      setCheckedLeafs(prev => {
        const next = new Set(prev);
        leaves.forEach(id => next.delete(id));
        return next;
      });
    } else {
      const toAdd = leaves.filter(id => !checkedLeafs.has(id));
      setCheckedLeafs(prev => {
        const next = new Set(prev);
        toAdd.forEach(id => next.add(id));
        return next;
      });
      toAdd.forEach(id => fetchGroupMembers(id));
    }
  }

  // 중복 제거된 전체 멤버 (phone 기준)
  const allMembers = (() => {
    const seen = new Set<string>();
    const result: Customer[] = [];
    for (const id of checkedLeafs) {
      const cache = memberCache.get(id);
      if (!cache || cache.loading) continue;
      for (const m of cache.members) {
        if (!seen.has(m.phone)) {
          seen.add(m.phone);
          result.push(m);
        }
      }
    }
    return result;
  })();
  const anyLoading = [...checkedLeafs].some(id => memberCache.get(id)?.loading);

  // 변수 치환 미리보기
  function getPreview() {
    const sample = allMembers[0];
    return message
      .replace(/#{이름}/g, sample?.name ?? "홍길동")
      .replace(/#{전화번호}/g, sample?.phone ?? "010-0000-0000")
      .replace(/#{메모}/g, sample?.memo ?? "메모")
      .replace(/#{주문번호}/g, "ORD-20260320")
      .replace(/#{금액}/g, "59,000");
  }

  // 글자 수 계산
  const byteLength = new TextEncoder().encode(message).length;
  const isOverSMS = channel === "sms" && byteLength > 90;

  const isKakao = channel.startsWith("kakao");

  // 발송 실행
  async function handleSend() {
    if (checkedLeafs.size === 0) {
      alert("발송할 그룹을 선택하세요.");
      return;
    }
    if (allMembers.length === 0) {
      alert("선택한 그룹에 멤버가 없습니다.");
      return;
    }
    if (!message.trim()) {
      alert("메시지를 입력하세요.");
      return;
    }

    setSending(true);
    setShowResult(true);
    setResult(null);

    const [firstGroupId] = checkedLeafs;
    const groupName = [...checkedLeafs].map(id => groups.find(g => g.id === id)?.name ?? id).join(", ");

    // 클라이언트에서 API 설정 읽기 (Server Action RLS 세션 문제 방지)
    const apiSettingsList = await dataStore.getApiSettings();
    const apiSetting = apiSettingsList.find(s => s.provider === "solapi" && s.apiKey && s.apiSecret)
      ?? apiSettingsList[0];

    const params: GroupSendParams = {
      groupId: firstGroupId,
      groupName,
      channel,
      message,
      fallback: fallback && isKakao,
      apiKey: apiSetting?.apiKey,
      apiSecret: apiSetting?.apiSecret,
      senderNumber: apiSetting?.senderNumber,
      kakaoChannelId: apiSetting?.kakaoChannelId ?? undefined,
    };

    const res = await sendToGroup(params, allMembers);
    setResult(res);
    setSending(false);
  }

  return (
    <div className={styles.messagePage}>
      {/* 페이지 헤더 */}
      <div className="page-header">
        <div>
          <h1 className="page-title">✉️ 새 메시지 작성</h1>
          <p className="page-subtitle">채널을 선택하고 메시지를 작성하세요</p>
        </div>
      </div>

      {/* 3단 레이아웃: 좌(채널+대상) | 중(편집기) | 우(미리보기) */}
      <div className={styles.composer}>
        {/* ── 왼쪽: 채널 선택 + 수신 대상 ── */}
        <div className={styles.leftPanel}>
          {/* 채널 선택 */}
          <div className={styles.panel}>
            <div className={styles.panelTitle}>📌 발송 채널</div>
            <div className={styles.channelList}>
              {CHANNELS.map((ch) => {
                const isKakao = ch.id.startsWith("kakao");
                const locked = isKakao && !can("kakaoChannels");
                return (
                  <button
                    key={ch.id}
                    className={`${styles.channelOption} ${channel === ch.id ? styles.channelActive : ""} ${locked ? styles.channelLocked : ""}`}
                    onClick={() => {
                      if (locked) {
                        alert("카카오 채널은 PRO 이상 플랜에서 사용할 수 있습니다.\n요금제 페이지에서 업그레이드해 주세요.");
                        return;
                      }
                      setChannel(ch.id);
                    }}
                    title={locked ? "PRO 이상 플랜에서 사용 가능" : undefined}
                  >
                    <span className={styles.channelIcon}>{locked ? "🔒" : ch.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {ch.label}
                        {locked && <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 4 }}>PRO+</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ch.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 수신 대상 — 그룹 다중 선택 */}
          <div className={styles.panel}>
            <div className={styles.panelTitle}>
              📋 수신 대상
              {anyLoading && (
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>집계 중...</span>
              )}
            </div>
            <div className={styles.groupList} style={{ gap: 1 }}>
              {groupsLoading ? (
                <p style={{ color: "var(--text-muted)", fontSize: 13, padding: "8px 0" }}>로딩 중...</p>
              ) : groups.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: 13, padding: "8px 0" }}>그룹이 없습니다</p>
              ) : (
                groups.filter(g => isVisible(g)).map((g) => {
                  const depth = g.depth ?? 0;
                  const depthColor = DEPTH_COLORS[depth] ?? DEPTH_COLORS[0];
                  const checkState = getCheckState(g.id);
                  const _hasChildren = hasChildren(g.id);
                  const leafLoading = !_hasChildren && memberCache.get(g.id)?.loading;
                  return (
                    <button
                      key={g.id}
                      className={`${styles.groupOption} ${checkState !== 'none' ? styles.groupActive : ""}`}
                      style={{
                        paddingLeft: 10 + depth * 16,
                        paddingTop: 7,
                        paddingBottom: 7,
                        borderLeft: depth > 0
                          ? `2px solid ${depthColor}55`
                          : "2px solid transparent",
                        fontWeight: _hasChildren ? 600 : 400,
                      }}
                      onClick={() => {
                        if (_hasChildren) {
                          setExpandedGroups(prev => {
                            const next = new Set(prev);
                            next.has(g.id) ? next.delete(g.id) : next.add(g.id);
                            return next;
                          });
                        }
                      }}
                    >
                      {/* 체크박스 — 클릭 독립 */}
                      <span
                        className={`${styles.groupCheckbox} ${
                          checkState === 'all' ? styles.groupCheckboxChecked :
                          checkState === 'partial' ? styles.groupCheckboxPartial : ""
                        }`}
                        onClick={(e) => handleCheckClick(e, g)}
                      >
                        {checkState === 'all' ? "✓" : checkState === 'partial' ? "−" : ""}
                      </span>
                      <span className={styles.groupDot} style={{ background: depthColor }} />
                      {g.name}
                      <span className={styles.groupCount}>
                        {leafLoading ? "…" : (g.member_count ?? 0)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* 선택 현황 패널 */}
            {checkedLeafs.size > 0 && (
              <div className={styles.selectedSummary}>
                {[...checkedLeafs].map(id => {
                  const g = groups.find(gr => gr.id === id);
                  const cache = memberCache.get(id);
                  return (
                    <div key={id} className={styles.selectedGroupRow}>
                      <span className={styles.selectedGroupName}>• {g?.name ?? id}</span>
                      {cache?.loading
                        ? <span className={styles.selectedGroupLoading}>집계 중...</span>
                        : <span className={styles.selectedGroupCount}>{cache?.members.length ?? 0}명</span>
                      }
                    </div>
                  );
                })}
                {checkedLeafs.size > 1 && (
                  <div className={styles.selectedTotalRow}>
                    <span>합계 (중복제거)</span>
                    <span style={{ color: "var(--brand-primary)" }}>
                      {anyLoading ? "…" : `${allMembers.length}명`}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── 가운데: 메시지 편집기 ── */}
        <div className={styles.centerPanel}>
          <div className={styles.editorCard}>
            <div className={styles.panelTitle}>💬 메시지 내용</div>

            {/* 저장된 템플릿 불러오기 */}
            <div className={styles.templatePickerRow}>
              <select
                className={styles.templatePicker}
                defaultValue=""
                disabled={templatesLoading}
                onChange={(e) => {
                  const selected = savedTemplates.find(t => t.id === e.target.value);
                  if (selected) setMessage(selected.content);
                  e.target.value = "";
                }}
              >
                <option value="" disabled>
                  {templatesLoading ? "템플릿 불러오는 중…" : savedTemplates.length === 0 ? "저장된 템플릿 없음" : "📂 저장된 템플릿 불러오기"}
                </option>
                {savedTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* 변수 힌트 */}
            <div className={styles.variableHint}>
              💡 변수 삽입:
              {["이름", "전화번호", "메모", "금액"].map((v) => (
                <span
                  key={v}
                  className={styles.variableTag}
                  onClick={() => setMessage(prev => prev + `#{${v}}`)}
                >
                  #{`{${v}}`}
                </span>
              ))}
            </div>

            {/* 텍스트 편집기 */}
            <textarea
              className="textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="메시지를 입력하세요... #{이름}님 같은 변수를 사용할 수 있습니다."
              style={{ minHeight: 200 }}
            />

            {/* 글자 수 */}
            <div className={`${styles.charCount} ${isOverSMS ? styles.charOver : ""}`}>
              {byteLength} 바이트
              {channel === "sms" && ` / 90 바이트`}
              {isOverSMS && " ⚠️ SMS 한도 초과 (LMS 전환 필요)"}
            </div>

            {/* 옵션 */}
            <div style={{ marginTop: 20 }}>
              <div className={styles.optionRow}>
                <span className={styles.optionLabel}>🔄 카카오 실패 시 문자 자동 전환</span>
                <div
                  className={`${styles.toggle} ${fallback ? styles.active : ""}`}
                  onClick={() => setFallback(!fallback)}
                  style={fallback ? { background: "var(--brand-primary)", borderColor: "var(--brand-primary)" } : {}}
                >
                  <div
                    className={styles.toggleDot}
                    style={fallback ? { transform: "translateX(20px)" } : {}}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 발송 버튼 */}
          <div className={styles.sendActions}>
            <button
              className="btn btn-primary btn-lg"
              onClick={handleSend}
              disabled={checkedLeafs.size === 0 || anyLoading || sending}
            >
              🚀 {checkedLeafs.size === 0
                ? "그룹을 선택하세요"
                : anyLoading
                  ? "인원 집계 중..."
                  : `${allMembers.length}명에게 발송하기`}
            </button>
          </div>
        </div>

        {/* ── 오른쪽: 폰 미리보기 ── */}
        <div className={styles.rightPanel}>
          <div className={styles.previewCard}>
            <div className={styles.panelTitle}>📱 미리보기</div>

            {/* 폰 */}
            <div className={styles.phone}>
              <div className={styles.phoneScreen}>
                <div className={`${styles.phoneHeader} ${isKakao ? styles.phoneHeaderKakao : ""}`}>
                  <div className={styles.phoneAvatar}>{isKakao ? "💛" : "📱"}</div>
                  <span>{isKakao ? "카카오톡" : "문자"}</span>
                </div>
                <div className={styles.phoneBody}>
                  <div className={`${styles.messageBubble} ${isKakao ? styles.messageBubbleKakao : ""}`}>
                    {getPreview().split("\n").map((line, i, arr) => (
                      <span key={i}>
                        {line}
                        {i < arr.length - 1 && <br />}
                      </span>
                    ))}
                    {isKakao && (
                      <div className={styles.kakaoButtons}>
                        <div className={styles.kakaoBtn}>자세히 보기</div>
                      </div>
                    )}
                  </div>
                  <div className={styles.messageTime}>오후 2:30</div>
                </div>
              </div>
            </div>

            {/* 발송 요약 */}
            <div style={{ marginTop: 16, width: "100%", fontSize: 13, color: "var(--text-secondary)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span>채널</span>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {CHANNELS.find(c => c.id === channel)?.label}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span>수신자</span>
                <span style={{ fontWeight: 600, color: "var(--brand-primary)" }}>
                  {anyLoading ? "집계 중..." : checkedLeafs.size > 0 ? `${allMembers.length}명` : "미선택"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>폴백</span>
                <span style={{ fontWeight: 600, color: fallback ? "var(--success)" : "var(--text-muted)" }}>
                  {fallback ? "✅ 활성" : "비활성"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 발송 결과 모달 */}
      {showResult && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className={styles.progressModal}>
              {sending ? (
                <>
                  <div className={styles.progressTitle}>🚀 발송 중...</div>
                  <div className={styles.progressBarLarge}>
                    <div className={styles.progressFillLarge} style={{ width: "60%", animationName: "pulse" }} />
                  </div>
                  <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 12 }}>
                    {[...checkedLeafs].map(id => groups.find(g => g.id === id)?.name ?? id).join(", ")} · {allMembers.length.toLocaleString()}명
                  </p>
                </>
              ) : result ? (
                <>
                  <div style={{ fontSize: 40 }}>{result.success ? "🎉" : "❌"}</div>
                  <div className={styles.progressTitle}>
                    {result.success ? "발송 완료!" : "발송 실패"}
                  </div>
                  {result.success && (
                    <div className={styles.progressStats}>
                      <div className={styles.progressStat}>
                        <div className={`${styles.progressStatValue} ${styles.progressSuccess}`}>
                          {result.successCount}
                        </div>
                        <div className={styles.progressStatLabel}>✅ 성공</div>
                      </div>
                      <div className={styles.progressStat}>
                        <div className={`${styles.progressStatValue} ${styles.progressFail}`}>
                          {result.failCount}
                        </div>
                        <div className={styles.progressStatLabel}>❌ 실패</div>
                      </div>
                    </div>
                  )}
                  {result.error && (
                    <p style={{ color: "var(--error)", fontSize: 13, textAlign: "center", margin: "8px 0" }}>
                      {result.error}
                    </p>
                  )}
                  <button
                    className="btn btn-primary btn-lg"
                    style={{ width: "100%", marginTop: 16 }}
                    onClick={() => { setShowResult(false); setResult(null); }}
                  >
                    확인
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
