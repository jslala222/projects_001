"use client";

/**
 * GroupSendModal.tsx — 그룹 발송 4단계 마법사
 *
 * Step 1: 채널 선택 (SMS / LMS / 카카오 친구톡 / 알림톡)
 * Step 2: 메시지 작성 (#{이름} #{전화번호} #{메모} 치환 지원)
 * Step 3: 발송 대상 확인 (재귀 포함 인원 미리보기)
 * Step 4: 발송 실행 → 진행 상황 + 결과
 */

import {
  useState,
  useEffect,
  useRef,
  useTransition,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import {
  X,
  MessageSquare,
  Send,
  Users,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import type { Group, Customer } from "@/types";
import { getGroupMembersForSend } from "@/app/actions/groups";
import { sendToGroup, type GroupSendParams } from "@/app/actions/send";
import styles from "@/styles/groupSend.module.css";

// ── 채널 정의 ─────────────────────────────────────────────────────
type Channel = "sms" | "lms" | "kakao_friend" | "kakao_alim";

const CHANNELS: {
  id: Channel;
  label: string;
  icon: string;
  desc: string;
  maxLen: number;
  badge: string;
}[] = [
  {
    id: "sms",
    label: "SMS",
    icon: "💬",
    desc: "단문 문자 (90자 이내)",
    maxLen: 90,
    badge: "green",
  },
  {
    id: "lms",
    label: "LMS",
    icon: "📄",
    desc: "장문 문자 (2,000자 이내)",
    maxLen: 2000,
    badge: "blue",
  },
  {
    id: "kakao_friend",
    label: "카카오 친구톡",
    icon: "💛",
    desc: "카카오채널 친구 대상 발송",
    maxLen: 1000,
    badge: "yellow",
  },
  {
    id: "kakao_alim",
    label: "카카오 알림톡",
    icon: "🔔",
    desc: "승인된 알림톡 템플릿 사용",
    maxLen: 1000,
    badge: "yellow",
  },
];

// ── 치환 변수 미리보기 ────────────────────────────────────────────
function applyVariables(
  text: string,
  sample?: Customer
): string {
  if (!sample) return text;
  return text
    .replace(/#{이름}/g, sample.name)
    .replace(/#{전화번호}/g, sample.phone)
    .replace(/#{메모}/g, sample.memo ?? "");
}

// ── 스텝 인디케이터 ──────────────────────────────────────────────
function StepIndicator({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const LABELS = ["채널 선택", "메시지 작성", "대상 확인", "발송"];
  return (
    <div className={styles.stepRow}>
      {LABELS.map((label, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={label} className={styles.stepItem}>
            <div
              className={[
                styles.stepCircle,
                done ? styles.stepDone : "",
                active ? styles.stepActive : "",
              ].join(" ")}
            >
              {done ? <CheckCircle size={14} /> : idx}
            </div>
            <span
              className={[
                styles.stepLabel,
                active ? styles.stepLabelActive : "",
              ].join(" ")}
            >
              {label}
            </span>
            {i < total - 1 && <div className={styles.stepLine} />}
          </div>
        );
      })}
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
interface Props {
  group: Group;
  onClose: () => void;
}

export default function GroupSendModal({ group, onClose }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1
  const [channel, setChannel] = useState<Channel>("sms");

  // Step 2
  const [message, setMessage] = useState("");
  const [templateId, setTemplateId] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Step 3
  const [members, setMembers] = useState<Customer[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState("");

  // Step 4 (결과)
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    campaignId?: string;
    successCount: number;
    failCount: number;
    error?: string;
  } | null>(null);

  const [, startTransition] = useTransition();
  const currentChannel = CHANNELS.find((c) => c.id === channel)!;

  // ── Step 3 진입 시 멤버 로드 ─────────────────────────────────
  useEffect(() => {
    if (step === 3) {
      setLoadingMembers(true);
      setMembersError("");
      getGroupMembersForSend(group.id).then(({ data, error }) => {
        setLoadingMembers(false);
        if (error || !data) {
          setMembersError(error ?? "멤버 조회에 실패했습니다");
        } else {
          setMembers(data);
        }
      });
    }
  }, [step, group.id]);

  // ── 유효성 검사 ────────────────────────────────────────────────
  const canProceedStep1 = !!channel;
  const canProceedStep2 =
    message.trim().length > 0 &&
    message.length <= currentChannel.maxLen &&
    (channel !== "kakao_alim" || templateId.trim().length > 0);
  const canProceedStep3 = !loadingMembers && !membersError && members.length > 0;

  // ── 발송 실행 ─────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    setSending(true);
    setDone(false);
    startTransition(async () => {
      const params: GroupSendParams = {
        groupId: group.id,
        groupName: group.name,
        channel,
        message,
        kakaoTemplateId: channel === "kakao_alim" ? templateId : undefined,
        fallback: channel.startsWith("kakao"),
      };
      const res = await sendToGroup(params, members);
      setResult(res);
      setSending(false);
      setDone(true);
      if (res.success) {
        toast.success(
          `발송 완료: 성공 ${res.successCount}건 / 실패 ${res.failCount}건`
        );
      } else {
        toast.error(res.error ?? "발송에 실패했습니다");
      }
    });
  }, [group.id, group.name, channel, message, templateId, members, startTransition]);

  // ── 인서트 변수 ───────────────────────────────────────────────
  const insertVar = (v: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next =
      message.substring(0, start) + v + message.substring(end);
    setMessage(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + v.length, start + v.length);
    });
  };

  // ── 렌더: Step 1 — 채널 선택 ─────────────────────────────────
  const renderStep1 = () => (
    <>
      <p className={styles.stepDesc}>발송할 채널을 선택하세요.</p>
      <div className={styles.channelGrid}>
        {CHANNELS.map((ch) => (
          <button
            key={ch.id}
            className={[
              styles.channelCard,
              channel === ch.id ? styles.channelCardSelected : "",
            ].join(" ")}
            onClick={() => setChannel(ch.id)}
          >
            <span className={styles.channelIcon}>{ch.icon}</span>
            <span className={styles.channelLabel}>{ch.label}</span>
            <span className={styles.channelDesc}>{ch.desc}</span>
          </button>
        ))}
      </div>
    </>
  );

  // ── 렌더: Step 2 — 메시지 작성 ───────────────────────────────
  const sampleMember = members[0];
  const preview = applyVariables(message, sampleMember);

  const renderStep2 = () => (
    <>
      <div className={styles.msgEditorLayout}>
        {/* 좌: 편집기 */}
        <div className={styles.msgEditorLeft}>
          <p className={styles.stepDesc}>
            메시지를 입력하세요 ({message.length}/{currentChannel.maxLen}자)
          </p>
          {channel === "kakao_alim" && (
            <input
              className={styles.templateInput}
              placeholder="솔라피 알림톡 templateId 입력"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            />
          )}
          <div className={styles.varBtns}>
            {["#{이름}", "#{전화번호}", "#{메모}"].map((v) => (
              <button
                key={v}
                className={styles.varBtn}
                onClick={() => insertVar(v)}
              >
                {v}
              </button>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            className={[
              styles.msgTextarea,
              message.length > currentChannel.maxLen ? styles.msgTextareaError : "",
            ].join(" ")}
            placeholder={`메시지를 입력하세요 (최대 ${currentChannel.maxLen}자)`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={8}
          />
          {message.length > currentChannel.maxLen && (
            <p className={styles.msgLenError}>
              최대 글자 수({currentChannel.maxLen}자)를 초과했습니다
            </p>
          )}
        </div>

        {/* 우: 미리보기 */}
        <div className={styles.msgPreviewBox}>
          <p className={styles.msgPreviewLabel}>
            <MessageSquare size={13} /> 미리보기
          </p>
          <div className={styles.msgBubble}>{preview || "메시지를 입력하면 여기에 표시됩니다"}</div>
          {sampleMember && (
            <p className={styles.msgPreviewNote}>
              👤 &quot;{sampleMember.name}&quot; 님을 기준으로 치환 적용됨
            </p>
          )}
        </div>
      </div>
    </>
  );

  // ── 렌더: Step 3 — 대상 확인 ────────────────────────────────
  const renderStep3 = () => {
    if (loadingMembers) {
      return (
        <div className={styles.loadingWrap}>
          <Loader2 size={28} className={styles.spinIcon} />
          <p>발송 대상 집계 중…</p>
        </div>
      );
    }
    if (membersError) {
      return (
        <div className={styles.errorWrap}>
          <AlertCircle size={24} style={{ color: "#ef4444" }} />
          <p>{membersError}</p>
        </div>
      );
    }
    return (
      <>
        <div className={styles.recipientSummary}>
          <div className={styles.recipientCount}>{members.length.toLocaleString()}</div>
          <p className={styles.recipientLabel}>총 발송 대상 (하위 그룹 포함 중복 제거)</p>
        </div>
        <div className={styles.recipientSampleWrap}>
          <p className={styles.recipientSampleTitle}>발송 대상 일부 (최대 10명)</p>
          <ul className={styles.recipientList}>
            {members.slice(0, 10).map((m) => (
              <li key={m.id} className={styles.recipientItem}>
                <span className={styles.recipientName}>{m.name}</span>
                <span className={styles.recipientPhone}>{m.phone}</span>
              </li>
            ))}
            {members.length > 10 && (
              <li className={styles.recipientMore}>
                …외 {members.length - 10}명
              </li>
            )}
          </ul>
        </div>
        <div className={styles.sendSummaryBox}>
          <p>채널: <strong>{currentChannel.label}</strong></p>
          <p>메시지 길이: <strong>{message.length}자</strong></p>
          <p className={styles.sendWarning}>
            ⚠️ 발송 후 취소할 수 없습니다. 대상과 메시지를 한 번 더 확인하세요.
          </p>
        </div>
      </>
    );
  };

  // ── 렌더: Step 4 — 발송 실행 & 결과 ─────────────────────────
  const renderStep4 = () => {
    if (sending) {
      return (
        <div className={styles.sendingWrap}>
          <Loader2 size={40} className={styles.spinIcon} />
          <p className={styles.sendingTitle}>발송 중…</p>
          <p className={styles.sendingDesc}>
            총 {members.length.toLocaleString()}명에게 {currentChannel.label}을 발송하고 있습니다
          </p>
        </div>
      );
    }
    if (done && result) {
      return (
        <div className={styles.resultWrap}>
          {result.success ? (
            <CheckCircle size={48} style={{ color: "#22c55e" }} />
          ) : (
            <AlertCircle size={48} style={{ color: "#ef4444" }} />
          )}
          <p className={styles.resultTitle}>
            {result.success ? "발송 완료" : "발송 실패"}
          </p>
          {result.success ? (
            <div className={styles.resultStats}>
              <div className={styles.resultStat}>
                <span className={styles.resultStatNum} style={{ color: "#22c55e" }}>
                  {result.successCount}
                </span>
                <span>성공</span>
              </div>
              <div className={styles.resultStat}>
                <span
                  className={styles.resultStatNum}
                  style={{ color: result.failCount > 0 ? "#ef4444" : "#94a3b8" }}
                >
                  {result.failCount}
                </span>
                <span>실패</span>
              </div>
            </div>
          ) : (
            <p className={styles.resultError}>{result.error}</p>
          )}
          {result.campaignId && (
            <p className={styles.resultCampaignId}>캠페인 ID: {result.campaignId}</p>
          )}
        </div>
      );
    }
    // 발송 전 최종 확인
    return (
      <div className={styles.sendConfirmWrap}>
        <Send size={40} style={{ color: "var(--brand-primary)" }} />
        <p className={styles.sendConfirmTitle}>발송 준비 완료</p>
        <div className={styles.sendConfirmDetails}>
          <p>그룹: <strong>{group.name}</strong></p>
          <p>채널: <strong>{currentChannel.label}</strong></p>
          <p>수신자: <strong>{members.length.toLocaleString()}명</strong></p>
        </div>
        <button className={styles.sendNowBtn} onClick={handleSend} disabled={sending}>
          <Send size={16} /> 지금 발송하기
        </button>
      </div>
    );
  };

  // ── 네비 버튼 ────────────────────────────────────────────────
  const handleNext = () => {
    if (step < 4) setStep((s) => (s + 1) as typeof step);
  };
  const handlePrev = () => {
    if (step > 1) setStep((s) => (s - 1) as typeof step);
  };

  const canNext =
    (step === 1 && canProceedStep1) ||
    (step === 2 && canProceedStep2) ||
    (step === 3 && canProceedStep3) ||
    step === 4;

  return createPortal(
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* 헤더 */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleWrap}>
            <Users size={18} style={{ color: "var(--brand-primary)" }} />
            <h2 className={styles.modalTitle}>
              그룹 발송 — <span style={{ fontWeight: 400 }}>{group.name}</span>
            </h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* 스텝 인디케이터 */}
        <div className={styles.stepIndicatorWrap}>
          <StepIndicator current={step} total={4} />
        </div>

        {/* 바디 */}
        <div className={styles.modalBody}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>

        {/* 푸터 */}
        {!(step === 4 && (sending || done)) && (
          <div className={styles.modalFooter}>
            {step > 1 ? (
              <button className={styles.btnPrev} onClick={handlePrev} disabled={sending}>
                <ChevronLeft size={15} /> 이전
              </button>
            ) : (
              <button className={styles.btnCancel} onClick={onClose}>
                취소
              </button>
            )}
            {step < 4 ? (
              <button
                className={styles.btnNext}
                onClick={handleNext}
                disabled={!canNext}
              >
                다음 <ChevronRight size={15} />
              </button>
            ) : null}
          </div>
        )}
        {step === 4 && done && (
          <div className={styles.modalFooter}>
            <button className={styles.btnClose} onClick={onClose}>
              닫기
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
