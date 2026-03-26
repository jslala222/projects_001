"use client";

import { useState, useTransition, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Users2, Plus, Pencil, Trash2, UserPlus, X, Search, ChevronRight, ChevronDown, FolderPlus, AlertTriangle, Send } from "lucide-react";
import { toast } from "sonner";
import type { Group, Customer } from "@/types";
import { dataStore, type AddressBook } from "@/lib/store";
import {
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  addCustomersToGroup,
  removeCustomerFromGroup,
} from "@/app/actions/groups";
import { getCustomers } from "@/app/actions/customers";
import { checkPhoneType, PHONE_TYPE_LABEL, PHONE_TYPE_BADGE_CLASS } from "@/lib/phoneUtils";
import { formatPhone } from "@/lib/phoneUtils";
import GroupSendModal from "@/components/groups/GroupSendModal";
import styles from "@/styles/groups.module.css";

const GROUP_COLORS = [
  "#ffffff", "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#10b981", "#14b8a6", "#3b82f6", "#6366f1",
  "#8b5cf6", "#ec4899", "#64748b", "#0f172a",
];

const GROUP_GRADIENTS = [
  "linear-gradient(135deg, #667eea, #764ba2)",
  "linear-gradient(135deg, #f093fb, #f5576c)",
  "linear-gradient(135deg, #4facfe, #00f2fe)",
  "linear-gradient(135deg, #43e97b, #38f9d7)",
  "linear-gradient(135deg, #fa709a, #fee140)",
  "linear-gradient(135deg, #a18cd1, #fbc2eb)",
  "linear-gradient(135deg, #fda085, #f6d365)",
  "linear-gradient(135deg, #30cfd0, #330867)",
  "linear-gradient(135deg, #c471f5, #fa71cd)",
  "linear-gradient(135deg, #11998e, #38ef7d)",
  "linear-gradient(135deg, #f7971e, #ffd200)",
  "linear-gradient(135deg, #0f2027, #2c5364)",
];

function isGradient(c: string) { return c.startsWith("linear-gradient"); }
function extractFirstColor(c: string) {
  if (!isGradient(c)) return c;
  const m = c.match(/#[0-9a-f]{3,6}/i);
  return m ? m[0] : "#6366f1";
}
function getBgTint(c: string) {
  if (!c || c === "#ffffff" || c === "#FFFFFF") return "#f8fafc";
  if (isGradient(c)) {
    // 흰색 55% 오버레이 + 그라데이션 → 파스텔 그라데이션 배경
    return `linear-gradient(rgba(255,255,255,0.55), rgba(255,255,255,0.55)), ${c}`;
  }
  return `${c}44`; // ~27% 투명도 — 카드 전체 배경색이 확실하게 보임
}
function getBarColor(c: string) {
  // 흰색 선택 시 좌측 바는 회색으로
  if (!c || c === "#ffffff" || c === "#FFFFFF") return "#cbd5e1";
  return c;
}

// flat 배열 → 트리 구조 변환
function buildTree(groups: Group[]): Group[] {
  const map = new Map<string, Group>();
  groups.forEach((g) => map.set(g.id, { ...g, children: [] }));
  const roots: Group[] = [];
  map.forEach((g) => {
    if (g.parent_id && map.has(g.parent_id)) {
      map.get(g.parent_id)!.children!.push(g);
    } else {
      roots.push(g);
    }
  });
  return roots;
}

/* ──────────────────────── 2단계 삭제 확인 모달 ──────────────────────── */
function DeleteConfirmModal({
  group,
  hasChildren,
  onClose,
  onConfirm,
}: {
  group: Group;
  hasChildren: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 2) setTimeout(() => inputRef.current?.focus(), 50);
  }, [step]);

  const memberCount = group.member_count ?? 0;

  return createPortal(
    <div className={styles.overlay} style={{ zIndex: 1200 }}>
      <div className={styles.modal} style={{ maxWidth: 420 }}>
        {step === 1 ? (
          <>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle} style={{ color: "#ef4444" }}>
                <AlertTriangle size={18} style={{ color: "#ef4444" }} />
                그룹 삭제 — 1차 경고
              </h2>
              <button className={styles.modalCloseBtn} onClick={onClose}><X size={18} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.deleteWarningBox}>
                <p className={styles.deleteWarningTitle}>
                  <strong>&ldquo;{group.name}&rdquo;</strong> 그룹을 삭제하려고 합니다.
                </p>
                <ul className={styles.deleteWarningList}>
                  {hasChildren && (
                    <li>모든 <strong>하위 그룹</strong>이 함께 삭제됩니다</li>
                  )}
                  {memberCount > 0 && (
                    <li>그룹에 포함된 <strong>{memberCount}명의 멤버</strong>가 모두 해제됩니다</li>
                  )}
                  <li className={styles.deleteWarningCritical}>
                    ⚠️ <strong>삭제 후 되돌릴 수 없습니다</strong>
                  </li>
                </ul>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button onClick={onClose} className={styles.btnCancel}>취소</button>
              <button
                onClick={() => setStep(2)}
                className={styles.btnDelete}
              >
                계속 진행
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle} style={{ color: "#ef4444" }}>
                <AlertTriangle size={18} style={{ color: "#ef4444" }} />
                그룹 삭제 — 2차 확인
              </h2>
              <button className={styles.modalCloseBtn} onClick={onClose}><X size={18} /></button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.deleteConfirmDesc}>
                삭제를 최종 확인하려면 아래에 그룹 이름을 정확히 입력하세요.
              </p>
              <p className={styles.deleteGroupNameHint}>
                입력 필요: <strong>{group.name}</strong>
              </p>
              <input
                ref={inputRef}
                className={styles.formInput}
                placeholder={group.name}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && inputValue === group.name) onConfirm();
                }}
              />
            </div>
            <div className={styles.modalFooter}>
              <button onClick={onClose} className={styles.btnCancel}>취소</button>
              <button
                onClick={onConfirm}
                disabled={inputValue !== group.name}
                className={styles.btnDelete}
              >
                영구 삭제
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ──────────────────────── 그룹 폼 모달 ──────────────────────── */
function GroupFormModal({
  group,
  parentGroup,
  onClose,
  onSave,
}: {
  group?: Group | null;
  parentGroup?: Group | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState(group?.name ?? "");
  const [desc, setDesc] = useState(group?.description ?? "");
  const [color, setColor] = useState(group?.color ?? (parentGroup?.color ?? GROUP_COLORS[0]));
  const [colorTab, setColorTab] = useState<"solid" | "gradient">(
    isGradient(group?.color ?? "") ? "gradient" : "solid"
  );
  const [pending, startTransition] = useTransition();

  const depthLabel = ["최상위", "대", "중", "소"][parentGroup ? (parentGroup.depth ?? 0) + 1 : 0] ?? "소";

  const handleSubmit = () => {
    if (!name.trim()) return toast.error("그룹 이름을 입력하세요");
    startTransition(async () => {
      const result = group
        ? await updateGroup(group.id, name.trim(), desc, color)
        : await createGroup(name.trim(), desc, color, parentGroup?.id ?? null);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(group ? "그룹을 수정했습니다" : "그룹을 생성했습니다");
        onSave();
        onClose();
      }
    });
  };

  return createPortal(
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {group ? "그룹 수정" : `새 그룹`}
            {!group && parentGroup && (
              <span className={styles.parentBadge} style={{ borderColor: parentGroup.color, color: parentGroup.color }}>
                {parentGroup.name} 하위
              </span>
            )}
            {!group && !parentGroup && (
              <span className={styles.depthBadge}>최상위</span>
            )}
          </h2>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div className={styles.modalBody}>
          {parentGroup && (
            <div className={styles.parentInfo}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: parentGroup.color, display: "inline-block", marginRight: 6 }} />
              <span className={styles.parentInfoText}>{depthLabel}단계 그룹 — <strong>{parentGroup.name}</strong> 하위에 생성됩니다</span>
            </div>
          )}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>그룹 이름 *</label>
            <input
              className={styles.formInput}
              placeholder="그룹 이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>설명</label>
            <input
              className={styles.formInput}
              placeholder="그룹 설명 (선택)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
          {/* 배경색 팔레트: 최상위 그룹(depth 0)만 표시 */}
          {!parentGroup && (!group || (group.depth ?? 0) === 0) && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>배경색</label>
              <div className={styles.colorTabBar}>
                <button
                  type="button"
                  className={`${styles.colorTabBtn} ${colorTab === "solid" ? styles.colorTabBtnActive : ""}`}
                  onClick={() => setColorTab("solid")}
                >단색</button>
                <button
                  type="button"
                  className={`${styles.colorTabBtn} ${colorTab === "gradient" ? styles.colorTabBtnActive : ""}`}
                  onClick={() => setColorTab("gradient")}
                >그라데이션</button>
              </div>
              {colorTab === "solid" && (
                <div className={styles.colorPicker}>
                  {GROUP_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`${styles.colorSwatch} ${color === c ? styles.colorSwatchActive : ""} ${c === "#ffffff" ? styles.colorSwatchWhite : ""}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              )}
              {colorTab === "gradient" && (
                <div className={styles.gradientPicker}>
                  {GROUP_GRADIENTS.map((g) => (
                    <button
                      key={g}
                      onClick={() => setColor(g)}
                      className={`${styles.gradientSwatch} ${color === g ? styles.gradientSwatchActive : ""}`}
                      style={{ background: g }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button onClick={onClose} className={styles.btnCancel}>취소</button>
          <button onClick={handleSubmit} disabled={pending} className={styles.btnSave}>
            {pending ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ──────────────────────── 멤버 관리 모달 ──────────────────────── */
function MembersModal({
  group,
  onClose,
  onMembersChanged,
  allGroups,
  addressBooks,
}: {
  group: Group;
  onClose: () => void;
  onMembersChanged: () => void;
  allGroups: Group[];
  addressBooks: AddressBook[];
}) {
  const [members, setMembers] = useState<Customer[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tab, setTab] = useState<"members" | "add">("members");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [dupWarning, setDupWarning] = useState<{
    show: boolean;
    dups: { id: string; name: string; groups: string[] }[];
  }>({ show: false, dups: [] });

  const load = (bookId?: string | null, searchTerm?: string) => {
    startTransition(async () => {
      const [m, c] = await Promise.all([
        getGroupMembers(group.id),
        getCustomers({
          pageSize: 50,
          addressBookId: bookId ?? undefined,
          search: searchTerm ?? "",
        }),
      ]);
      setMembers((m.data ?? []) as Customer[]);
      setAllCustomers((c.data ?? []) as Customer[]);
      setLoaded(true);
      setSearching(false);
    });
  };

  // debounce: 검색어 입력 300ms 후 서버 요청
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!loaded) return;
    setSearching(true);
    startTransition(async () => {
      const c = await getCustomers({
        pageSize: 50,
        addressBookId: selectedBookId ?? undefined,
        search: debouncedSearch,
      });
      setAllCustomers((c.data ?? []) as Customer[]);
      setSearching(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    load(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id]);

  if (!loaded) {
    return createPortal(
      <div className={styles.overlay}>
        <div className={`${styles.modal} ${styles.modalLg}`} style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#64748b" }}>불러오는 중...</p>
        </div>
      </div>,
      document.body
    );
  }

  const memberIds = new Set(members.map((m) => m.id));
  // 서버사이드 검색 결과에서 이미 멤버인 사람만 제외
  const candidates = allCustomers
    .filter((c) => !memberIds.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const handleRemove = (customerId: string) => {
    startTransition(async () => {
      const r = await removeCustomerFromGroup(group.id, customerId);
      if (r.error) toast.error(r.error);
      else {
        toast.success("멤버를 제거했습니다");
        setMembers((prev) => prev.filter((m) => m.id !== customerId));
        onMembersChanged();
      }
    });
  };

  const doAdd = () => {
    startTransition(async () => {
      const r = await addCustomersToGroup(group.id, Array.from(selected));
      if (r.error) toast.error(r.error);
      else {
        toast.success(`${selected.size}명을 추가했습니다`);
        setSelected(new Set());
        setTab("members");
        const m = await getGroupMembers(group.id);
        setMembers((m.data ?? []) as Customer[]);
        onMembersChanged();
      }
    });
  };

  const handleAddClick = () => {
    if (selected.size === 0) return toast.error("추가할 고객을 선택하세요");
    const selectedCustomers = allCustomers.filter((c) => selected.has(c.id));
    const dups = selectedCustomers
      .filter((c) => (c.group_ids ?? []).length > 0)
      .map((c) => ({
        id: c.id,
        name: c.name,
        groups: (c.group_ids ?? [])
          .map((gid) => allGroups.find((g) => g.id === gid)?.name)
          .filter(Boolean) as string[],
      }))
      .filter((d) => d.groups.length > 0);

    if (dups.length > 0) {
      setDupWarning({ show: true, dups });
    } else {
      doAdd();
    }
  };

  const handleBookTab = (bookId: string | null) => {
    setSelectedBookId(bookId);
    setSearch("");
    setDebouncedSearch("");
    setLoaded(false);
    load(bookId, "");
  };

  return createPortal(
    <>
      <div className={styles.overlay}>
        <div className={`${styles.modal} ${styles.modalLg}`}>
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>
              <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", backgroundColor: group.color, flexShrink: 0 }} />
              {group.name} 멤버 관리
            </h2>
            <button className={styles.modalCloseBtn} onClick={onClose}><X size={18} /></button>
          </div>

          <div className={styles.modalBody}>
            <div className={styles.tabs}>
              <button
                onClick={() => setTab("members")}
                className={`${styles.tab} ${tab === "members" ? styles.tabActive : ""}`}
              >
                멤버 목록 ({members.length})
              </button>
              <button
                onClick={() => setTab("add")}
                className={`${styles.tab} ${tab === "add" ? styles.tabActive : ""}`}
              >
                고객 추가
              </button>
            </div>

            {tab === "members" && (
              <div className={styles.memberList}>
                {members.length === 0 && <p className={styles.emptyState}>멤버가 없습니다</p>}
                {members.map((m) => (
                  <div key={m.id} className={styles.memberRow}>
                    <div>
                      <p className={styles.memberName}>{m.name ?? "-"}</p>
                      <p className={styles.memberPhone}>{m.phone ? formatPhone(m.phone) : "-"}</p>
                    </div>
                    <button
                      onClick={() => handleRemove(m.id)}
                      className={styles.removeMemberBtn}
                      disabled={pending}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {tab === "add" && (
              <div>
                {/* 주소록 탭 필터 */}
                {addressBooks.length > 0 && (
                  <div className={styles.bookTabs}>
                    <button
                      onClick={() => handleBookTab(null)}
                      className={`${styles.bookTab} ${selectedBookId === null ? styles.bookTabActive : ""}`}
                    >
                      전체
                    </button>
                    {addressBooks.map((ab) => (
                      <button
                        key={ab.id}
                        onClick={() => handleBookTab(ab.id)}
                        className={`${styles.bookTab} ${selectedBookId === ab.id ? styles.bookTabActive : ""}`}
                      >
                        {ab.name}
                      </button>
                    ))}
                  </div>
                )}

                <div className={styles.searchWrap}>
                  <Search size={14} className={styles.searchIcon} />
                  <input
                    className={styles.searchInput}
                    placeholder="이름 또는 전화번호 검색 (서버 검색)"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {searching && <span style={{ fontSize: 11, color: "#94a3b8", paddingRight: 8 }}>검색 중...</span>}
                </div>
                <div className={styles.memberList}>
                  {!searching && candidates.length === 0 && <p className={styles.emptyState}>{search ? `'${search}' 검색 결과가 없습니다` : "추가할 고객이 없습니다"}</p>}
                  {searching && <p className={styles.emptyState}>검색 중...</p>}
                  {candidates.map((c) => {
                    const pType = checkPhoneType(c.phone);
                    const existingGroups = (c.group_ids ?? [])
                      .map((gid) => allGroups.find((g) => g.id === gid))
                      .filter(Boolean) as Group[];
                    return (
                      <label key={c.id} className={styles.candidateRow}>
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(c.id); else next.delete(c.id);
                            setSelected(next);
                          }}
                          className={styles.candidateCheckbox}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <p className={styles.memberName}>{c.name}</p>
                            {c.investment_tendency && (
                              <span className={styles.genderBadge} data-gender={c.investment_tendency}>
                                {c.investment_tendency === "male" ? "남" : c.investment_tendency === "female" ? "여" : c.investment_tendency === "business" ? "법인" : "기타"}
                              </span>
                            )}
                          </div>
                          <p className={styles.memberPhone}>
                            {formatPhone(c.phone)}
                            {pType !== "mobile" && (
                              <span className={`${styles.phoneBadge} ${PHONE_TYPE_BADGE_CLASS[pType]}`}>
                                {PHONE_TYPE_LABEL[pType]}
                              </span>
                            )}
                            {c.created_at && (
                              <span className={styles.joinDate}>
                                가입 {c.created_at.slice(0, 10)}
                              </span>
                            )}
                          </p>
                          {existingGroups.length > 0 && (
                            <div className={styles.groupBadgeRow}>
                              {existingGroups.map((g) => (
                                <span
                                  key={g.id}
                                  className={styles.groupBadge}
                                  style={{ borderColor: g.color, color: g.color }}
                                >
                                  {g.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
                <button
                  onClick={handleAddClick}
                  disabled={pending || selected.size === 0}
                  className={styles.addMembersBtn}
                >
                  {pending ? "추가 중..." : `${selected.size}명 추가`}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 중복 그룹 확인 모달 */}
      {dupWarning.show && (
        <div className={styles.overlay} style={{ zIndex: 1100 }}>
          <div className={styles.modal} style={{ maxWidth: 420 }}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>⚠️ 중복 그룹 안내</h2>
              <button
                className={styles.modalCloseBtn}
                onClick={() => setDupWarning({ show: false, dups: [] })}
              >
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.dupDesc}>아래 고객님은 이미 다른 그룹에 추가되어 있습니다.</p>
              <ul className={styles.dupList}>
                {dupWarning.dups.map((d) => (
                  <li key={d.id} className={styles.dupItem}>
                    <strong>{d.name}님</strong>은{" "}
                    {d.groups.map((gname, i) => (
                      <span key={i} className={styles.dupGroupTag}>{gname}</span>
                    ))}{" "}
                    에 이미 추가되어 있습니다.
                  </li>
                ))}
              </ul>
              <p className={styles.dupConfirmText}>그래도 이 그룹에 추가하시겠습니까?</p>
            </div>
            <div className={styles.modalFooter}>
              <button
                onClick={() => setDupWarning({ show: false, dups: [] })}
                className={styles.btnCancel}
              >
                취소
              </button>
              <button
                onClick={() => { setDupWarning({ show: false, dups: [] }); doAdd(); }}
                className={styles.btnSave}
              >
                추가하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}

/* ──────────────────────── 메인 컴포넌트 ──────────────────────── */
const PLAN_LIMITS: Record<string, number> = {
  free: 0,
  starter: 5,
  pro: 20,
  enterprise: Infinity,
  admin: Infinity,
};

/* ─────────────────── 트리 노드 (재귀) ─────────────────── */
const DEPTH_LABELS = ["최상위", "대", "중", "소"];
const DEPTH_COLORS = ["#a78bfa", "#4ade80", "#fbbf24", "#f87171"];

function GroupTreeNode({
  node,
  expandedIds,
  onToggle,
  onEdit,
  onDelete,
  onAddChild,
  onMembers,
  onSend,
  deletingId,
}: {
  node: Group;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (g: Group) => void;
  onDelete: (g: Group) => void;
  onAddChild: (g: Group) => void;
  onMembers: (g: Group) => void;
  onSend: (g: Group) => void;
  deletingId: string | null;
}) {
  const depth = node.depth ?? 0;
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isExpanded = expandedIds.has(node.id);
  const depthLabel = DEPTH_LABELS[depth] ?? "소";

  return (
    <div className={depth === 0 ? styles.treeNodeWrapRoot : `${styles.treeNodeWrap} ${depth === 1 ? styles.treeNodeDepth1 : depth === 2 ? styles.treeNodeDepth2 : styles.treeNodeDepth3}`}>
      {/* 행 */}
      <div
        className={`${styles.treeRow} ${depth === 0 ? styles.treeRowRoot : depth === 1 ? styles.treeRowDepth1 : depth === 2 ? styles.treeRowDepth2 : styles.treeRowDepth3}`}
        style={{
          paddingLeft: "12px",
          minHeight: depth === 0 ? "80px" : depth === 1 ? "54px" : depth === 2 ? "44px" : "36px",
          ...(depth === 0 ? ({
            "--group-color-bar": getBarColor(node.color),
          } as React.CSSProperties) : {}),
        }}
      >
        {/* 메인 라인 */}
        <div className={styles.treeRowMain}>
          {/* 토글 버튼 */}
          <button
            className={styles.treeToggleBtn}
            onClick={() => hasChildren && onToggle(node.id)}
            style={{ visibility: hasChildren ? "visible" : "hidden" }}
            title={isExpanded ? "접기" : "펼치기"}
          >
            {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>

          {/* 색상 점 */}
          <span
            className={styles.treeColorDot}
            style={{ backgroundColor: node.color }}
          />

          {/* 깊이 배지 */}
          <span
            className={styles.treeDepthBadge}
            data-depth={depth}
          >
            {depthLabel}
          </span>

          {/* 이름 */}
          <span className={styles.treeNodeName}>{node.name}</span>

          {/* 설명 (depth > 0만 인라인 표시) */}
          {depth > 0 && node.description && (
            <span className={styles.treeNodeDesc}>{node.description}</span>
          )}

          {/* 멤버 수 */}
          <span className={styles.treeMemberCount}>
            {node.member_count ?? 0}명
          </span>

          {/* 액션 버튼들 */}
          <div className={styles.treeActions}>
            {depth < 3 && (
              <button
                className={`${styles.treeActionBtn} ${styles.treeActionAdd}`}
                onClick={() => onAddChild(node)}
                title="하위 그룹 추가"
              >
                <FolderPlus size={14} />
                <span>하위</span>
              </button>
            )}
            <button
              className={`${styles.treeActionBtn} ${styles.treeActionMembers}`}
              onClick={() => onMembers(node)}
              title="멤버 관리"
            >
              <UserPlus size={14} />
              <span>멤버</span>
            </button>
            <button
              className={`${styles.treeActionBtn} ${styles.treeActionSend}`}
              onClick={() => onSend(node)}
              title="그룹 발송"
            >
              <Send size={14} />
              <span>발송</span>
            </button>
            <button
              className={`${styles.treeActionBtn} ${styles.treeActionEdit}`}
              onClick={() => onEdit(node)}
              title="수정"
            >
              <Pencil size={13} />
            </button>
            <button
              className={`${styles.treeActionBtn} ${styles.treeActionDelete}`}
              onClick={() => onDelete(node)}
              disabled={deletingId === node.id}
              title="삭제"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* 서브 라인 (최상위 depth=0만) */}
        {depth === 0 && (
          <div className={styles.treeRowSub}>
            {node.description ? (
              <span className={styles.treeNodeDesc}>{node.description}</span>
            ) : hasChildren ? (
              <span className={styles.treeRowSubHint}>하위 그룹 {node.children!.length}개</span>
            ) : null}
          </div>
        )}
      </div>

      {/* 자식 노드 */}
      {hasChildren && isExpanded && (
        <div className={styles.treeChildren}>
          {node.children!.map((child) => (
            <GroupTreeNode
              key={child.id}
              node={child}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onMembers={onMembers}
              onSend={onSend}
              deletingId={deletingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────── 메인 컴포넌트 ─────────────────── */
export default function GroupsClient({
  initialGroups,
  plan = "free",
  onRefresh,
}: {
  initialGroups: Group[];
  plan?: string;
  onRefresh?: () => void;
}) {
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [showForm, setShowForm] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [addChildGroup, setAddChildGroup] = useState<Group | null>(null);
  const [membersGroup, setMembersGroup] = useState<Group | null>(null);
  const [addressBooks, setAddressBooks] = useState<AddressBook[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // 2단계 삭제 확인 모달
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  // 그룹 발송 모달
  const [sendGroup, setSendGroup] = useState<Group | null>(null);
  // 2단 패널 — 선택된 최상위 그룹 ID
  const [selectedRootId, setSelectedRootId] = useState<string | null>(null);
  // 첫 방문 배너
  const [showBanner, setShowBanner] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("bm_groups_banner_dismissed");
  });

  const [pending, startTransition] = useTransition();

  useEffect(() => {
    dataStore.getAddressBooks().then(setAddressBooks);
  }, []);

  const maxGroups = PLAN_LIMITS[plan] ?? Infinity;
  const canAddMore = maxGroups === Infinity || groups.length < maxGroups;

  const reload = useCallback(() => {
    startTransition(async () => {
      const { getGroups } = await import("@/app/actions/groups");
      const r = await getGroups();
      if (!r.error) setGroups(r.data as Group[]);
      onRefresh?.();
    });
  }, [onRefresh]);

  const handleToggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDelete = (group: Group) => {
    // 2단계 삭제 확인 모달 열기
    setDeleteTarget(group);
  };

  const executeDelete = useCallback(() => {
    if (!deleteTarget) return;
    const group = deleteTarget;
    setDeleteTarget(null);
    setDeletingId(group.id);
    startTransition(async () => {
      const r = await deleteGroup(group.id);
      setDeletingId(null);
      if (r.error) toast.error(r.error);
      else {
        toast.success("그룹을 삭제했습니다");
        reload();
      }
    });
  }, [deleteTarget, reload]);

  const openAddRoot = () => {
    setEditGroup(null);
    setAddChildGroup(null);
    setShowForm(true);
  };

  const openAddChild = (parent: Group) => {
    setEditGroup(null);
    setAddChildGroup(parent);
    setShowForm(true);
    // 부모 노드를 펼침
    setExpandedIds((prev) => new Set([...prev, parent.id]));
  };

  const openEdit = (group: Group) => {
    setEditGroup(group);
    setAddChildGroup(null);
    setShowForm(true);
  };

  const treeRoots = buildTree(groups);
  // selectedRootId가 없거나 삭제된 경우 첫 번째 루트로 폴백
  const selectedRoot = treeRoots.find((r) => r.id === selectedRootId) ?? treeRoots[0] ?? null;

  return (
    <div className={styles.page}>
      {/* 헤더 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.headerTitle}>
            <Users2 size={26} style={{ color: "var(--brand-primary)" }} />
            그룹 관리
            <span className={styles.headerCount}>( {groups.length} )</span>
          </h1>
          {maxGroups !== Infinity && (
            <div className={styles.progressWrap}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${Math.min((groups.length / maxGroups) * 100, 100)}%`,
                    background: groups.length >= maxGroups ? "var(--error)" : "var(--brand-gradient)",
                  }}
                />
              </div>
              <span className={styles.progressLabel}>{groups.length}/{maxGroups}</span>
            </div>
          )}
        </div>
        <div className={styles.headerRight}>
          {!canAddMore && (
            <a href="/pricing" className={styles.upgradeBtn}>
              🔓 한도 업그레이드
            </a>
          )}
          <button
            onClick={openAddRoot}
            disabled={!canAddMore}
            className={styles.addBtn}
            title={!canAddMore ? `${plan} 플랜 최대 ${maxGroups}개` : "최상위 그룹 추가"}
          >
            <Plus size={16} />
            + 최상위 그룹
          </button>
        </div>
      </div>

      {/* 첫 방문 배너 */}
      {showBanner && (
        <div className={styles.firstVisitBanner}>
          <span className={styles.firstVisitIcon}>💡</span>
          <div className={styles.firstVisitText}>
            <strong>샘플 그룹 구조를 바로 가져올 수 있어요!</strong>
            <span>10개 도메인의 4단계 분류 체계 템플릿을 제공합니다 —&nbsp;
              <a href="/templates" className={styles.firstVisitLink}>템플릿 관리 → 그룹 템플릿</a>에서 확인하세요.
            </span>
          </div>
          <button
            className={styles.firstVisitClose}
            onClick={() => {
              setShowBanner(false);
              localStorage.setItem("bm_groups_banner_dismissed", "1");
            }}
            aria-label="닫기"
          >✕</button>
        </div>
      )}

      {/* 깊이 범례 */}
      <div className={styles.depthLegend}>
        {DEPTH_LABELS.map((label, i) => (
          <span key={label} className={styles.depthLegendItem}>
            <span
              className={styles.depthLegendDot}
              style={{ background: DEPTH_COLORS[i] }}
            />
            {label}
          </span>
        ))}
      </div>

      {/* 그룹 트리 — 2단 패널 */}
      {groups.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>👥</div>
          <p className={styles.emptyTitle}>그룹이 없습니다</p>
          <p className={styles.emptyDesc}>최상위 그룹을 만들어 계층 구조를 구성해보세요</p>
        </div>
      ) : (
        <div className={styles.treeContainer}>
          {/* 모바일: panelLeft를 wrapper로 감싸서 오른쪽 페이드 인디케이터 표시 */}
          <div className={styles.mobileTabsWrap}>
          {/* 좌측 패널: 최상위 그룹 선택 목록 */}
          <div className={styles.panelLeft}>
            <div className={styles.panelLeftTitle}>최상위 그룹 ({treeRoots.length})</div>
            {treeRoots.map((root) => (
              <button
                key={root.id}
                className={`${styles.panelItem} ${selectedRoot?.id === root.id ? styles.panelItemActive : ""}`}
                onClick={() => setSelectedRootId(root.id)}
              >
                <span
                  className={styles.panelItemDot}
                  style={{ background: extractFirstColor(root.color) }}
                />
                <span className={styles.panelItemName}>{root.name}</span>
                <span className={styles.panelItemCount}>
                  ( {root.children?.length ?? 0} )
                </span>
              </button>
            ))}
            <button
              className={styles.panelAddRootBtn}
              onClick={openAddRoot}
              disabled={!canAddMore}
            >
              <Plus size={13} />
              최상위 추가
            </button>
          </div>
          </div>{/* /mobileTabsWrap */}

          {/* 우측 패널: 선택된 최상위 그룹의 트리 */}
          <div className={styles.panelRight}>
            {selectedRoot ? (
              <GroupTreeNode
                key={selectedRoot.id}
                node={selectedRoot}
                expandedIds={expandedIds}
                onToggle={handleToggle}
                onEdit={openEdit}
                onDelete={handleDelete}
                onAddChild={openAddChild}
                onMembers={setMembersGroup}
                onSend={setSendGroup}
                deletingId={deletingId}
              />
            ) : (
              <div className={styles.panelRightEmpty}>
                <div style={{ fontSize: 36, opacity: 0.3 }}>👈</div>
                <p className={styles.panelRightEmptyText}>좌측에서 그룹을 선택하세요</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 모달들 */}
      {showForm && (
        <GroupFormModal
          group={editGroup}
          parentGroup={addChildGroup}
          onClose={() => { setShowForm(false); setEditGroup(null); setAddChildGroup(null); }}
          onSave={reload}
        />
      )}
      {membersGroup && (
        <MembersModal
          group={membersGroup}
          onClose={() => { setMembersGroup(null); reload(); }}
          onMembersChanged={reload}
          allGroups={groups}
          addressBooks={addressBooks}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          group={deleteTarget}
          hasChildren={groups.some((g) => g.parent_id === deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={executeDelete}
        />
      )}
      {sendGroup && (
        <GroupSendModal
          group={sendGroup}
          onClose={() => setSendGroup(null)}
        />
      )}
    </div>
  );
}
