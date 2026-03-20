// ================================================================
// templates/page.tsx — 템플릿 관리 페이지
// 자주 쓰는 메시지를 미리 등록해두고 재사용
// ================================================================
"use client";

import { useState, useEffect } from "react";
import { dataStore, Template } from "@/lib/store";

const channelLabels: Record<string, { icon: string; label: string; color: string }> = {
  kakao_alim: { icon: "💬", label: "알림톡", color: "var(--kakao-yellow)" },
  kakao_friend: { icon: "💛", label: "친구톡", color: "var(--kakao-yellow)" },
  sms: { icon: "📱", label: "SMS", color: "var(--info)" },
  mms: { icon: "🖼️", label: "MMS", color: "var(--info)" },
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [formName, setFormName] = useState("");
  const [formChannel, setFormChannel] = useState("sms");
  const [formContent, setFormContent] = useState("");

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setTemplates(await dataStore.getTemplates());
  }

  function openAdd() {
    setEditTemplate(null);
    setFormName(""); setFormChannel("sms"); setFormContent("");
    setShowModal(true);
  }

  function openEdit(t: Template) {
    setEditTemplate(t);
    setFormName(t.name); setFormChannel(t.channel); setFormContent(t.content);
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
    <div style={{ animation: "slideInUp 400ms ease both" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">📝 템플릿 관리</h1>
          <p className="page-subtitle">자주 쓰는 메시지를 미리 등록해두세요</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>➕ 새 템플릿</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
        {templates.map((t) => {
          const ch = channelLabels[t.channel] || channelLabels.sms;
          return (
            <div key={t.id} className="glass-card" style={{ padding: 20 }}>
              {/* 헤더 */}
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

              {/* 내용 미리보기 */}
              <div style={{
                background: "var(--bg-glass)",
                borderRadius: "var(--radius-md)",
                padding: 14,
                fontSize: 13,
                color: "var(--text-secondary)",
                lineHeight: 1.6,
                minHeight: 80,
                whiteSpace: "pre-wrap",
                maxHeight: 120,
                overflow: "hidden",
              }}>
                {t.content}
              </div>

              {/* 날짜 */}
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

      {/* 모달 */}
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
