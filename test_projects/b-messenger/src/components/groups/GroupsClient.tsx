"use client";

import { useState, useTransition, useEffect } from "react";
import { Users2, Plus, Pencil, Trash2, UserPlus, X, Search } from "lucide-react";
import { toast } from "sonner";
import type { Group, Customer } from "@/types";
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

const GROUP_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899",
];

/* ──────────────────────── 그룹 폼 모달 ──────────────────────── */
function GroupFormModal({
  group,
  onClose,
  onSave,
}: {
  group?: Group | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState(group?.name ?? "");
  const [desc, setDesc] = useState(group?.description ?? "");
  const [color, setColor] = useState(group?.color ?? GROUP_COLORS[0]);
  const [pending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!name.trim()) return toast.error("그룹 이름을 입력하세요");
    startTransition(async () => {
      const result = group
        ? await updateGroup(group.id, name.trim(), desc, color)
        : await createGroup(name.trim(), desc, color);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(group ? "그룹을 수정했습니다" : "그룹을 생성했습니다");
        onSave();
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">{group ? "그룹 수정" : "새 그룹"}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">그룹 이름 *</label>
            <input
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="그룹 이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">설명</label>
            <input
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="그룹 설명 (선택)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">색상</label>
            <div className="mt-2 flex gap-2 flex-wrap">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full ring-offset-2 transition-all"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? `3px solid ${c}` : "none",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">취소</button>
          <button
            onClick={handleSubmit}
            disabled={pending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {pending ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────── 멤버 관리 모달 ──────────────────────── */
function MembersModal({
  group,
  onClose,
}: {
  group: Group;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<Customer[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"members" | "add">("members");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);

  const load = () => {
    startTransition(async () => {
      const [m, c] = await Promise.all([
        getGroupMembers(group.id),
        getCustomers({ pageSize: 1000 }),
      ]);
      setMembers((m.data ?? []) as Customer[]);
      setAllCustomers((c.data ?? []) as Customer[]);
      setLoaded(true);
    });
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id]);

  if (!loaded) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 text-center">불러오는 중...</div>
      </div>
    );
  }

  const memberIds = new Set(members.map((m) => m.id));
  const candidates = allCustomers
    .filter((c) => !memberIds.has(c.id) && (c.name.includes(search) || c.phone.includes(search)))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const handleRemove = (customerId: string) => {
    startTransition(async () => {
      const r = await removeCustomerFromGroup(group.id, customerId);
      if (r.error) toast.error(r.error);
      else {
        toast.success("멤버를 제거했습니다");
        setMembers((prev) => prev.filter((m) => m.id !== customerId));
      }
    });
  };

  const handleAdd = () => {
    if (selected.size === 0) return toast.error("추가할 고객을 선택하세요");
    startTransition(async () => {
      const r = await addCustomersToGroup(group.id, Array.from(selected));
      if (r.error) toast.error(r.error);
      else {
        toast.success(`${selected.size}명을 추가했습니다`);
        setSelected(new Set());
        setTab("members");
        const m = await getGroupMembers(group.id);
        setMembers((m.data ?? []) as Customer[]);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: group.color }} />
            {group.name} 멤버 관리
          </h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="flex border-b mb-4">
          <button
            onClick={() => setTab("members")}
            className={`px-4 py-2 text-sm font-medium ${tab === "members" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}
          >
            멤버 목록 ({members.length})
          </button>
          <button
            onClick={() => setTab("add")}
            className={`px-4 py-2 text-sm font-medium ${tab === "add" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}
          >
            고객 추가
          </button>
        </div>

        {tab === "members" && (
          <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
            {members.length === 0 && <p className="text-sm text-gray-400 text-center py-8">멤버가 없습니다</p>}
            {members.map((m) => {
              return (
                <div key={m.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium">{m.name ?? "-"}</p>
                    <p className="text-xs text-gray-500 font-mono">{m.phone ? formatPhone(m.phone) : "-"}</p>
                  </div>
                  <button
                    onClick={() => handleRemove(m.id)}
                    className="text-red-400 hover:text-red-600"
                    disabled={pending}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {tab === "add" && (
          <div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
                placeholder="이름 또는 전화번호 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-3 custom-scrollbar">
              {candidates.length === 0 && <p className="text-sm text-gray-400 text-center py-4">추가할 고객이 없습니다</p>}
              {candidates.map((c) => {
                const pType = checkPhoneType(c.phone);
                return (
                  <label key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(c.id); else next.delete(c.id);
                        setSelected(next);
                      }}
                      className="w-4 h-4"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{c.name}</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs text-gray-500 font-mono">{formatPhone(c.phone)}</p>
                        {pType !== "mobile" && (
                          <span className={`text-xs px-1 py-0.5 rounded ${PHONE_TYPE_BADGE_CLASS[pType]}`}>
                            {PHONE_TYPE_LABEL[pType]}
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
            <button
              onClick={handleAdd}
              disabled={pending || selected.size === 0}
              className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50"
            >
              {pending ? "추가 중..." : `${selected.size}명 추가`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────── 메인 컴포넌트 ──────────────────────── */
export default function GroupsClient({ initialGroups }: { initialGroups: Group[] }) {
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [showForm, setShowForm] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [membersGroup, setMembersGroup] = useState<Group | null>(null);

  const [pending, startTransition] = useTransition();

  const reload = () => {
    startTransition(async () => {
      const { getGroups } = await import("@/app/actions/groups");
      const r = await getGroups();
      if (!r.error) setGroups(r.data as Group[]);
    });
  };

  const handleDelete = (group: Group) => {
    if (!confirm(`"${group.name}" 그룹을 삭제할까요?`)) return;
    startTransition(async () => {
      const r = await deleteGroup(group.id);
      if (r.error) toast.error(r.error);
      else {
        toast.success("그룹을 삭제했습니다");
        reload();
      }
    });
  };

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users2 className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">그룹 관리</h1>
          <span className="text-sm text-gray-500">({groups.length}개)</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditGroup(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            새 그룹
          </button>
        </div>
      </div>

      {/* 그룹 목록 */}
      {groups.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Users2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg">그룹이 없습니다</p>
          <p className="text-sm mt-1">새 그룹을 만들어 고객을 관리해보세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {groups.map((group) => (
            <div
              key={group.id}
              className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  <h3 className="font-semibold text-gray-900 truncate">{group.name}</h3>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditGroup(group); setShowForm(true); }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(group)}
                    disabled={pending}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {group.description && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{group.description}</p>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">{group.member_count ?? 0}</span>명
                </span>
                <button
                  onClick={() => setMembersGroup(group)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                >
                  <UserPlus className="w-3 h-3" />
                  멤버 관리
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 모달들 */}
      {showForm && (
        <GroupFormModal
          group={editGroup}
          onClose={() => { setShowForm(false); setEditGroup(null); }}
          onSave={reload}
        />
      )}
      {membersGroup && (
        <MembersModal group={membersGroup} onClose={() => { setMembersGroup(null); reload(); }} />
      )}
    </div>
  );
}
