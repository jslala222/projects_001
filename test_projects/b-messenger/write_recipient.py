#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import pathlib

TARGET = pathlib.Path(__file__).parent / "src" / "components" / "RecipientInput.tsx"

CONTENT = '''\
// ================================================================
// components/RecipientInput.tsx — 수신자 입력 (태그 UI + 검증 + DB선택 + CSV)
// ================================================================
"use client";

import { useState, useRef, useCallback } from "react";
import { supabase, TABLES } from "@/lib/supabase";
import styles from "@/styles/RecipientInput.module.css";

export interface Recipient {
  name: string;
  phone: string;
  valid: boolean;
}

interface ContactRow {
  id: string;
  name: string;
  phone: string;
}

interface GroupRow {
  id: string;
  name: string;
  color: string;
  memberCount: number;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\\D/g, "");
  if (/^01[016789]\\d{7,8}$/.test(digits)) {
    if (digits.length === 10) return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
    if (digits.length === 11) return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
  }
  return digits.length > 0 ? digits : raw.trim();
}

function isValidPhone(phone: string): boolean {
  return /^01[016789]-\\d{3,4}-\\d{4}$/.test(phone);
}

function parseLine(line: string): Recipient | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const commaIdx = trimmed.indexOf(",");
  let name = "";
  let rawPhone = "";
  if (commaIdx !== -1) {
    name = trimmed.slice(0, commaIdx).trim();
    rawPhone = trimmed.slice(commaIdx + 1).trim();
  } else {
    const spaceMatch = trimmed.match(/^(.+?)\\s+(01[016789][\\d\\s-]{7,})$/);
    if (spaceMatch) { name = spaceMatch[1].trim(); rawPhone = spaceMatch[2].trim(); }
    else { rawPhone = trimmed; }
  }
  const phone = normalizePhone(rawPhone);
  return { name, phone, valid: isValidPhone(phone) };
}

interface Props {
  value: Recipient[];
  onChange: (recipients: Recipient[]) => void;
}

export default function RecipientInput({ value, onChange }: Props) {
  const [inputText, setInputText] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"contacts" | "groups">("contacts");

  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [contactsLoading, setContactsLoading] = useState(false);

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<ContactRow[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFromText = useCallback((text: string) => {
    const lines = text.split(/[\\n;]+/);
    const newItems: Recipient[] = [];
    for (const line of lines) {
      const r = parseLine(line);
      if (r) newItems.push(r);
    }
    if (newItems.length > 0) {
      const existingPhones = new Set(value.map(v => v.phone));
      const unique = newItems.filter(r => !existingPhones.has(r.phone));
      onChange([...value, ...unique]);
    }
  }, [value, onChange]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (["Enter", "Tab", ","].includes(e.key)) {
      e.preventDefault();
      if (inputText.trim()) { addFromText(inputText); setInputText(""); }
    } else if (e.key === "Backspace" && inputText === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (text.includes("\\n") || text.includes(";")) {
      e.preventDefault();
      addFromText(text);
      setInputText("");
    }
  }

  function handleBlur() {
    if (inputText.trim()) { addFromText(inputText); setInputText(""); }
  }

  function removeRecipient(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string).replace(/^\\uFEFF/, "");
      const lines = text.split(/\\r?\\n/).filter(l => l.trim());
      const startIdx = /01[016789]/.test(lines[0]) ? 0 : 1;
      const parsed: Recipient[] = [];
      for (let i = startIdx; i < lines.length; i++) {
        const r = parseLine(lines[i]);
        if (r) parsed.push(r);
      }
      if (parsed.length > 0) {
        const existingPhones = new Set(value.map(v => v.phone));
        onChange([...value, ...parsed.filter(r => !existingPhones.has(r.phone))]);
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  }

  async function openModal() {
    setShowModal(true);
    setSelected(new Set());
    setContactSearch("");
    setSelectedGroupId(null);
    setGroupMembers([]);
    await Promise.all([loadContacts(), loadGroups()]);
  }

  async function loadContacts() {
    setContactsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from(TABLES.CONTACTS)
        .select("id, name, phone")
        .eq("tenant_id", user.id)
        .order("name");
      setContacts((data as ContactRow[]) ?? []);
    } finally {
      setContactsLoading(false);
    }
  }

  async function loadGroups() {
    setGroupsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: groupData } = await supabase
        .from(TABLES.GROUPS)
        .select("id, name, color")
        .eq("tenant_id", user.id)
        .order("name");
      if (!groupData) return;
      const { data: allContacts } = await supabase
        .from(TABLES.CONTACTS)
        .select("id, group_ids")
        .eq("tenant_id", user.id);
      const gRows: GroupRow[] = groupData.map(g => ({
        id: g.id as string,
        name: g.name as string,
        color: (g.color as string) || "#667eea",
        memberCount: (allContacts ?? []).filter(
          (c: Record<string, unknown>) =>
            Array.isArray(c.group_ids) && (c.group_ids as string[]).includes(g.id as string)
        ).length,
      }));
      setGroups(gRows);
    } finally {
      setGroupsLoading(false);
    }
  }

  async function handleGroupClick(groupId: string) {
    if (selectedGroupId === groupId) {
      setSelectedGroupId(null);
      setGroupMembers([]);
      return;
    }
    setSelectedGroupId(groupId);
    setMembersLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from(TABLES.CONTACTS)
        .select("id, name, phone")
        .eq("tenant_id", user.id)
        .contains("group_ids", [groupId])
        .order("name");
      setGroupMembers((data as ContactRow[]) ?? []);
    } finally {
      setMembersLoading(false);
    }
  }

  function toggleGroupAll() {
    const ids = groupMembers.map(m => m.id);
    const allSelected = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) { ids.forEach(id => next.delete(id)); }
      else { ids.forEach(id => next.add(id)); }
      return next;
    });
  }

  function toggleItem(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function confirmSelection() {
    const allPool = new Map<string, ContactRow>();
    contacts.forEach(c => allPool.set(c.id, c));
    groupMembers.forEach(c => allPool.set(c.id, c));
    const existingPhones = new Set(value.map(v => v.phone));
    const toAdd: Recipient[] = [];
    selected.forEach(id => {
      const c = allPool.get(id);
      if (!c) return;
      const phone = normalizePhone(c.phone);
      if (!existingPhones.has(phone)) {
        existingPhones.add(phone);
        toAdd.push({ name: c.name, phone, valid: isValidPhone(phone) });
      }
    });
    onChange([...value, ...toAdd]);
    setShowModal(false);
  }

  const filteredContacts = contacts.filter(c =>
    contactSearch === "" ||
    c.name.includes(contactSearch) ||
    c.phone.includes(contactSearch)
  );

  const invalidCount = value.filter(r => !r.valid).length;
  const allGroupMembersSelected =
    groupMembers.length > 0 && groupMembers.every(m => selected.has(m.id));

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={openModal}>
          👥 주소록 / 그룹에서 선택
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
          📂 CSV 업로드
        </button>
        {value.length > 0 && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.3)", marginLeft: "auto" }}
            onClick={() => onChange([])}
          >
            전체 삭제
          </button>
        )}
        <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={handleCsvFile} />
      </div>

      <div
        className={`${styles.inputBox} ${invalidCount > 0 ? styles.hasError : ""}`}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((r, i) => (
          <span
            key={i}
            className={`${styles.chip} ${r.valid ? styles.chipValid : styles.chipInvalid}`}
            title={r.valid ? `${r.name} ${r.phone}` : `⚠️ 번호 형식 오류: ${r.phone}`}
          >
            <span className={styles.chipText}>
              {r.name ? `${r.name} · ${r.phone}` : r.phone}
            </span>
            <button
              type="button"
              className={styles.chipRemove}
              onClick={(e) => { e.stopPropagation(); removeRecipient(i); }}
            >✕</button>
          </span>
        ))}
        <input
          ref={inputRef}
          className={styles.textInput}
          placeholder={value.length === 0 ? "010-1234-5678 입력 후 Enter, 또는 위 버튼 사용" : ""}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={handleBlur}
        />
      </div>

      <div className={styles.footer}>
        <span>
          {invalidCount > 0
            ? <span className={styles.errorCount}>⚠️ 번호 오류 {invalidCount}건 — 수정 후 발송하세요</span>
            : value.length > 0
            ? <span style={{ color: "#4ade80" }}>✅ {value.length}명 정상</span>
            : <span>수신자를 추가해주세요</span>}
        </span>
        <span>{value.length}명</span>
      </div>

      {showModal && (
        <div className={styles.dbModalOverlay} onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className={styles.dbModal}>
            <div className={styles.dbModalTitle}>👥 수신자 선택</div>

            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${activeTab === "contacts" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("contacts")}
              >
                📇 주소록 ({contacts.length})
              </button>
              <button
                className={`${styles.tab} ${activeTab === "groups" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("groups")}
              >
                👥 그룹 ({groups.length})
              </button>
            </div>

            {activeTab === "contacts" && (
              <>
                <input
                  className={styles.dbSearch}
                  placeholder="이름 또는 번호로 검색…"
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  autoFocus
                />
                <div className={styles.dbList}>
                  {contactsLoading ? (
                    <div className={styles.dbEmpty}>불러오는 중…</div>
                  ) : filteredContacts.length === 0 ? (
                    <div className={styles.dbEmpty}>
                      {contactSearch ? `\'${contactSearch}\' 검색 결과 없음` : "주소록이 비어있습니다"}
                    </div>
                  ) : (
                    filteredContacts.map(c => {
                      const isSel = selected.has(c.id);
                      return (
                        <div
                          key={c.id}
                          className={`${styles.dbItem} ${isSel ? styles.selected : ""}`}
                          onClick={() => toggleItem(c.id)}
                        >
                          <div className={`${styles.dbItemCheck} ${isSel ? styles.dbItemCheckActive : ""}`}>{isSel ? "✓" : ""}</div>
                          <span className={styles.dbItemName}>{c.name}</span>
                          <span className={styles.dbItemPhone}>{c.phone}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {activeTab === "groups" && (
              <div className={styles.dbList}>
                {groupsLoading ? (
                  <div className={styles.dbEmpty}>불러오는 중…</div>
                ) : groups.length === 0 ? (
                  <div className={styles.dbEmpty}>그룹이 없습니다. 그룹 관리에서 먼저 그룹을 만들어주세요.</div>
                ) : (
                  groups.map(g => {
                    const isExpanded = selectedGroupId === g.id;
                    return (
                      <div key={g.id}>
                        <div
                          className={`${styles.groupRow} ${isExpanded ? styles.groupRowExpanded : ""}`}
                          onClick={() => handleGroupClick(g.id)}
                        >
                          <span className={styles.groupDot} style={{ background: g.color }} />
                          <span className={styles.groupName}>{g.name}</span>
                          <span className={styles.groupCount}>{g.memberCount}명</span>
                          <span className={styles.groupArrow}>{isExpanded ? "▲" : "▼"}</span>
                        </div>
                        {isExpanded && (
                          <div className={styles.memberList}>
                            {membersLoading ? (
                              <div className={styles.dbEmpty} style={{ padding: "12px 20px" }}>불러오는 중…</div>
                            ) : groupMembers.length === 0 ? (
                              <div className={styles.dbEmpty} style={{ padding: "12px 20px" }}>멤버가 없습니다</div>
                            ) : (
                              <>
                                <div
                                  className={`${styles.memberItem} ${styles.memberSelectAll}`}
                                  onClick={toggleGroupAll}
                                >
                                  <div className={`${styles.dbItemCheck} ${allGroupMembersSelected ? styles.dbItemCheckActive : ""}`}>
                                    {allGroupMembersSelected ? "✓" : ""}
                                  </div>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: "#a5b4fc" }}>
                                    {allGroupMembersSelected ? "전체 해제" : `전체 선택 (${groupMembers.length}명)`}
                                  </span>
                                </div>
                                {groupMembers.map(m => {
                                  const isSel = selected.has(m.id);
                                  return (
                                    <div
                                      key={m.id}
                                      className={`${styles.memberItem} ${isSel ? styles.selected : ""}`}
                                      onClick={() => toggleItem(m.id)}
                                    >
                                      <div className={`${styles.dbItemCheck} ${isSel ? styles.dbItemCheckActive : ""}`}>{isSel ? "✓" : ""}</div>
                                      <span className={styles.dbItemName}>{m.name}</span>
                                      <span className={styles.dbItemPhone}>{m.phone}</span>
                                    </div>
                                  );
                                })}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <div className={styles.dbModalFooter}>
              <span className={styles.selectionCount}>
                {selected.size > 0 ? `${selected.size}명 선택됨` : ""}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>취소</button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={confirmSelection}
                  disabled={selected.size === 0}
                >
                  {selected.size > 0 ? `${selected.size}명 추가` : "선택하세요"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
'''

TARGET.write_text(CONTENT, encoding='utf-8')
lines = CONTENT.splitlines()
print(f"Done! {len(lines)} lines, {TARGET.stat().st_size} bytes")
print(f"Line 1: {lines[0]}")
print(f"Line 4: {lines[3]}")
