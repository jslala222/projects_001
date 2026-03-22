// ================================================================
// templates/page.tsx — 템플릿 관리 페이지 (탭 구조)
// 탭 1: 그룹 템플릿 (샘플 4단계 그룹 가져오기)
// 탭 2: 메시지 템플릿 (기존 기능)
// ================================================================
"use client";

import { useState, useEffect, useTransition } from "react";
import { dataStore, Template } from "@/lib/store";
import { PlanGate } from "@/components/PlanGate";
import { SAMPLE_DOMAINS, SampleNode } from "@/lib/sampleGroups";
import { createGroup } from "@/app/actions/groups";
import { toast } from "sonner";
import styles from "@/styles/templates.module.css";

// ── 메시지 템플릿 탭 ───────────────────────────────────────────

const channelLabels: Record<string, { icon: string; label: string; color: string }> = {
  kakao_alim: { icon: "💬", label: "알림톡", color: "var(--kakao-yellow)" },
  kakao_friend: { icon: "💛", label: "친구톡", color: "var(--kakao-yellow)" },
  sms: { icon: "📱", label: "SMS", color: "var(--info)" },
  mms: { icon: "🖼️", label: "MMS", color: "var(--info)" },
};

function MessageTemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [formName, setFormName] = useState("");
  const [formChannel, setFormChannel] = useState("sms");
  const [formContent, setFormContent] = useState("");

  useEffect(() => { refresh(); }, []);

  async function refresh() { setTemplates(await dataStore.getTemplates()); }

  function openAdd() {
    setEditTemplate(null); setFormName(""); setFormChannel("sms"); setFormContent("");
    setShowModal(true);
  }
  function openEdit(t: Template) {
    setEditTemplate(t); setFormName(t.name); setFormChannel(t.channel); setFormContent(t.content);
    setShowModal(true);
  }
  async function handleSave() {
    if (!formName || !formContent) return;
    if (editTemplate) {
      await dataStore.updateTemplate(editTemplate.id, { name: formName, channel: formChannel as Template["channel"], content: formContent });
    } else {
      await dataStore.addTemplate({ name: formName, channel: formChannel as Template["channel"], content: formContent });
    }
    setShowModal(false);
    refresh();
  }

  async function handleDelete(id: string) {
    if (confirm("정말 삭제하시겠습니까?")) {
      await dataStore.deleteTemplate(id);
      refresh();
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={openAdd}>➕ 새 템플릿</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
        {templates.map((t) => {
          const ch = channelLabels[t.channel] || channelLabels.sms;
          return (
            <div key={t.id} className="glass-card" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{ch.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: ch.color }}>{ch.label}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(t)}>✏️</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)}>🗑️</button>
                </div>
              </div>
              <div style={{ background: "var(--bg-glass)", borderRadius: "var(--radius-md)", padding: 14, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, minHeight: 80, whiteSpace: "pre-wrap", maxHeight: 120, overflow: "hidden" }}>
                {t.content}
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
                생성: {new Date(t.createdAt).toLocaleDateString("ko-KR")}
              </div>
            </div>
          );
        })}
      </div>
      {templates.length === 0 && (
        <div className="empty-state glass-card">
          <div className="empty-state-icon">📝</div>
          <div className="empty-state-title">등록된 템플릿이 없습니다</div>
          <div className="empty-state-desc">자주 사용하는 메시지를 템플릿으로 저장하세요</div>
          <button className="btn btn-primary" onClick={openAdd}>➕ 첫 템플릿 만들기</button>
        </div>
      )}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
              {editTemplate ? "✏️ 템플릿 수정" : "➕ 새 템플릿"}
            </h2>
            <div className="form-group">
              <label className="form-label">템플릿 이름</label>
              <input className="input" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="주문 완료 알림" />
            </div>
            <div className="form-group">
              <label className="form-label">발송 채널</label>
              <select className="select" value={formChannel} onChange={(e) => setFormChannel(e.target.value)}>
                <option value="kakao_alim">💬 카카오 알림톡</option>
                <option value="kakao_friend">💛 카카오 친구톡</option>
                <option value="sms">📱 SMS</option>
                <option value="mms">🖼️ MMS</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">메시지 내용</label>
              <textarea className="textarea" value={formContent} onChange={(e) => setFormContent(e.target.value)}
                placeholder="#{이름}님 안녕하세요! 변수를 사용할 수 있습니다."
                style={{ minHeight: 160 }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editTemplate ? "수정 완료" : "저장하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 그룹 템플릿 탭 ─────────────────────────────────────────────

function countNodes(nodes: SampleNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + (n.children ? countNodes(n.children) : 0), 0);
}

function TreePreview({ nodes, depth = 0 }: { nodes: SampleNode[]; depth?: number }) {
  if (depth >= 2) return null;
  return (
    <ul className={styles.previewTree}>
      {nodes.map((n, i) => (
        <li key={i} className={styles.previewTreeItem}>
          <span className={styles.previewTreeDot} />
          <span className={styles.previewTreeName}>{n.name}</span>
          {n.children && n.children.length > 0 && (
            <TreePreview nodes={n.children} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

// 이름 충돌 방지: "금융/보험 (2)" 형태로 suffix 추가
async function resolveGroupName(baseName: string): Promise<string> {
  const { getGroups } = await import("@/app/actions/groups");
  const r = await getGroups();
  const existingNames = new Set((r.data ?? []).map((g: { name: string }) => g.name));
  if (!existingNames.has(baseName)) return baseName;
  let i = 2;
  while (existingNames.has(`${baseName} (${i})`)) i++;
  return `${baseName} (${i})`;
}

function GroupTemplatesTab() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // 이름 입력 모달
  const [nameModal, setNameModal] = useState<{ domain: typeof SAMPLE_DOMAINS[0]; customName: string } | null>(null);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // 카드 클릭 → 이름 입력 모달
  function handleCardClick(domain: typeof SAMPLE_DOMAINS[0]) {
    setNameModal({ domain, customName: domain.name });
  }

  async function insertNodes(nodes: SampleNode[], color: string, parentId: string | null): Promise<boolean> {
    for (const node of nodes) {
      const result = await createGroup(node.name, node.description ?? "", color, parentId);
      if (result.error) { toast.error(`"${node.name}" 생성 실패: ${result.error}`); return false; }
      if (node.children && node.children.length > 0) {
        const ok = await insertNodes(node.children, color, result.data!.id);
        if (!ok) return false;
      }
    }
    return true;
  }

  // 단일 도메인 → 모달에서 이름 확정 후 가져오기
  function confirmNameModal() {
    if (!nameModal) return;
    const { domain, customName } = nameModal;
    const trimmed = customName.trim() || domain.name;
    setNameModal(null);
    startTransition(async () => {
      const finalName = await resolveGroupName(trimmed);
      const topResult = await createGroup(finalName, domain.description, "#ffffff", null);
      if (topResult.error) { toast.error(`"${finalName}" 생성 실패: ${topResult.error}`); return; }
      const ok = await insertNodes(domain.tree, "#ffffff", topResult.data!.id);
      if (ok) toast.success(`"${finalName}" 그룹 구조를 가져왔습니다! 그룹 관리 페이지에서 확인하세요.`);
    });
  }

  // 다중 선택 → 기본 이름 그대로 일괄 가져오기 (suffix 자동처리)
  function handleBulkImport() {
    if (selected.size === 0) return toast.error("가져올 도메인을 선택하세요");
    startTransition(async () => {
      const domains = SAMPLE_DOMAINS.filter((d) => selected.has(d.id));
      let allOk = true;
      for (const domain of domains) {
        const finalName = await resolveGroupName(domain.name);
        const topResult = await createGroup(finalName, domain.description, "#ffffff", null);
        if (topResult.error) { toast.error(`"${finalName}" 생성 실패: ${topResult.error}`); allOk = false; break; }
        const ok = await insertNodes(domain.tree, "#ffffff", topResult.data!.id);
        if (!ok) { allOk = false; break; }
      }
      if (allOk) {
        setSelected(new Set());
        toast.success(`${domains.length}개 도메인의 그룹 구조를 가져왔습니다! 그룹 관리 페이지에서 확인하세요.`);
      }
    });
  }

  return (
    <div>
      <div className={styles.infoBanner}>
        <span className={styles.infoBannerIcon}>💡</span>
        <div>
          <strong>샘플 그룹 구조를 내 계정에 바로 적용하세요</strong>
          <p>카드를 클릭하면 이름을 지정해서 가져올 수 있습니다. 같은 템플릿을 여러 번 가져와 "금융", "보험"처럼 별도 그룹 트리로 활용하세요.</p>
        </div>
      </div>

      <div className={styles.domainGrid}>
        {SAMPLE_DOMAINS.map((domain) => {
          const isSelected = selected.has(domain.id);
          const nodeCount = domain.tree.reduce((s, n) => s + 1 + countNodes(n.children ?? []), 0) + 1;
          return (
            <div
              key={domain.id}
              className={`${styles.domainCard} ${isSelected ? styles.domainCardSelected : ""}`}
              style={{ "--domain-color": domain.color } as React.CSSProperties}
            >
              <div className={styles.domainCardBar} style={{ background: domain.color }} />
              <div className={styles.domainCardBody}>
                <div className={styles.domainCardHeader}>
                  <span className={styles.domainIcon}>{domain.icon}</span>
                  <div className={styles.domainCardTitle}>
                    <span className={styles.domainName}>{domain.name}</span>
                    <span className={styles.domainGroupCount}>{nodeCount}개 그룹</span>
                  </div>
                  <div className={styles.domainCardCheck}>
                    <input
                      type="checkbox"
                      className={styles.cardCheckbox}
                      checked={isSelected}
                      onChange={(e) => { e.stopPropagation(); toggleSelect(domain.id); }}
                      title="일괄 선택"
                    />
                  </div>
                </div>
                <p className={styles.domainDesc}>{domain.description}</p>
                <div className={styles.cardActions}>
                  <button
                    className={styles.previewBtn}
                    onClick={(e) => { e.stopPropagation(); setPreview(preview === domain.id ? null : domain.id); }}
                  >
                    {preview === domain.id ? "▲ 미리보기 닫기" : "▼ 구조 미리보기"}
                  </button>
                  <button
                    className={styles.applyBtn}
                    onClick={() => handleCardClick(domain)}
                    disabled={pending}
                  >
                    📥 가져오기
                  </button>
                </div>
                {preview === domain.id && (
                  <div className={styles.previewBox}>
                    <div className={styles.previewRootRow}>
                      <span className={styles.previewRootIcon}>{domain.icon}</span>
                      <strong className={styles.previewRootName}>{domain.name}</strong>
                      <span className={styles.previewLevelBadge} style={{ background: domain.color }}>최상위</span>
                    </div>
                    <TreePreview nodes={domain.tree} />
                    <p className={styles.previewNote}>* 세분류(L4) 포함 총 {nodeCount}개 그룹이 생성됩니다</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 다중 선택 일괄 가져오기 바 */}
      {selected.size > 0 && (
        <div className={styles.importBar}>
          <span className={styles.importBarText}>
            <strong>{selected.size}개 도메인</strong> 선택됨 —&nbsp;
            {SAMPLE_DOMAINS.filter((d) => selected.has(d.id)).map((d) => d.name).join(", ")}
          </span>
          <button className={styles.importBtn} onClick={handleBulkImport} disabled={pending}>
            {pending ? "⏳ 생성 중..." : "📥 일괄 가져오기"}
          </button>
        </div>
      )}

      {/* 이름 입력 모달 */}
      {nameModal && (
        <div className="modal-overlay" onClick={() => setNameModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>{nameModal.domain.icon}</span>
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>{nameModal.domain.name} 가져오기</h2>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.6 }}>
              최상위 그룹 이름을 지정하세요. 원하는 이름으로 변경하면 같은 템플릿을 여러 번 가져올 수 있습니다.
            </p>
            <div className="form-group">
              <label className="form-label">최상위 그룹 이름</label>
              <input
                className="input"
                value={nameModal.customName}
                onChange={(e) => setNameModal({ ...nameModal, customName: e.target.value })}
                placeholder={nameModal.domain.name}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") confirmNameModal(); if (e.key === "Escape") setNameModal(null); }}
              />
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                예: "금융", "보험", "금융팀A" — 같은 이름 입력 시 자동으로 (2), (3) suffix 추가
              </p>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setNameModal(null)}>취소</button>
              <button className="btn btn-primary" onClick={confirmNameModal} disabled={pending}>
                {pending ? "⏳ 생성 중..." : "이 이름으로 가져오기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────────

type TabKey = "groups" | "messages";

export default function TemplatesPage() {
  const [tab, setTab] = useState<TabKey>("groups");

  return (
    <PlanGate require="pro" feature="템플릿 관리">
      <div style={{ animation: "slideInUp 400ms ease both" }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">📋 템플릿 관리</h1>
            <p className="page-subtitle">그룹 구조와 메시지 템플릿을 관리하세요</p>
          </div>
        </div>
        <div className={styles.tabBar}>
          <button className={`${styles.tabBtn} ${tab === "groups" ? styles.tabBtnActive : ""}`} onClick={() => setTab("groups")}>
            👥 그룹 템플릿
          </button>
          <button className={`${styles.tabBtn} ${tab === "messages" ? styles.tabBtnActive : ""}`} onClick={() => setTab("messages")}>
            📝 메시지 템플릿
          </button>
          <button className={`${styles.tabBtn} ${styles.tabBtnDisabled}`} disabled title="준비 중">
            🏷️ 태그 템플릿 <span className={styles.comingSoon}>준비 중</span>
          </button>
        </div>
        <div style={{ marginTop: 24 }}>
          {tab === "groups" && <GroupTemplatesTab />}
          {tab === "messages" && <MessageTemplatesTab />}
        </div>
      </div>
    </PlanGate>
  );
}
