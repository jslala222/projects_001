"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Search, Users, X, ChevronLeft, ChevronRight, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import CustomerModal from "./CustomerModal";
import ContactImportModal from "./ContactImportModal";
import { deleteCustomer, deleteCustomers, deleteImportedCustomers, getCustomers } from "@/app/actions/customers";
import { formatPhone } from "@/lib/phoneUtils";
import { checkPhoneType, PHONE_TYPE_LABEL, PHONE_TYPE_BADGE_CLASS } from "@/lib/phoneUtils";
import type { Customer } from "@/types";

const GENDER_LABEL: Record<string, { label: string; color: string }> = {
  male:     { label: "남",   color: "bg-blue-100 text-blue-700" },
  female:   { label: "여",   color: "bg-pink-100 text-pink-600" },
  business: { label: "사업장", color: "bg-purple-100 text-purple-600" },
  other:    { label: "기타", color: "bg-slate-100 text-slate-500" },
};

interface Props {
  initialData: Customer[];
  initialCount: number;
}

// ── 모바일 카드 컴포넌트 ─────────────────────────────────
function CustomerCard({
  c, selected, onToggle, onEdit, onDelete, isPending,
}: {
  c: Customer; selected: boolean;
  onToggle: () => void; onEdit: () => void; onDelete: () => void; isPending: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className={`relative flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 transition-colors ${selected ? "bg-blue-50" : "hover:bg-slate-50"}`}>
      <input type="checkbox" className="rounded border-slate-300 flex-shrink-0" checked={selected} onChange={onToggle} />
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${
        c.status === "inactive" ? "bg-slate-300" :
        c.investment_tendency === "male" ? "bg-blue-500" :
        c.investment_tendency === "female" ? "bg-pink-400" :
        c.investment_tendency === "business" ? "bg-purple-500" :
        "bg-slate-700"
      }`}>
        {c.name[0]}
      </div>
      <div className="flex-1 min-w-0" onClick={onEdit}>
        <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
        <p className="text-xs text-slate-500 font-mono mt-0.5">{formatPhone(c.phone)}</p>
        {(() => { const t = checkPhoneType(c.phone); return t !== "mobile" ? (
          <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 ${PHONE_TYPE_BADGE_CLASS[t]}`}>{PHONE_TYPE_LABEL[t]}</span>
        ) : null; })()}
      </div>
      <span className={`flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
        c.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${c.status === "active" ? "bg-green-500" : "bg-slate-300"}`} />
        {c.status === "active" ? "활성" : "비활성"}
      </span>
      <div className="relative flex-shrink-0">
        <button onClick={() => setMenuOpen(v => !v)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <MoreVertical className="w-4 h-4" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-8 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 w-28 text-sm">
              <button onClick={() => { setMenuOpen(false); onEdit(); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700">
                <Pencil className="w-3.5 h-3.5" /> 수정
              </button>
              <button onClick={() => { setMenuOpen(false); onDelete(); }} disabled={isPending}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-red-600">
                <Trash2 className="w-3.5 h-3.5" /> 삭제
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function CustomerTable({ initialData, initialCount }: Props) {
  const [customers, setCustomers] = useState<Customer[]>(initialData);
  const [count, setCount] = useState(initialCount);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [tendencyFilter, setTendencyFilter] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [sort, setSort] = useState<"name_asc" | "name_desc" | "created_desc" | "created_asc" | "updated_desc">("name_asc");

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  // 서버에서 데이터 재조회 (페이지/검색/필터 변경 시)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await getCustomers({
          search,
          status: statusFilter,
          tendency: tendencyFilter,
          page,
          pageSize: PAGE_SIZE,
          sort,
        });
        if (!res.error) {
          setCustomers(res.data as Customer[]);
          setCount(res.count);
        }
      });
    }, search ? 300 : 0); // 검색은 300ms 디바운스, 페이지/필터는 즉시
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [page, search, statusFilter, tendencyFilter, sort]);

  // 필터 변경 시 1페이지로 리셋
  function handleSearchChange(v: string) { setSearch(v); setPage(1); setSelectedIds(new Set()); }
  function handleStatusChange(v: "all" | "active" | "inactive") { setStatusFilter(v); setPage(1); setSelectedIds(new Set()); }
  function handleTendencyChange(v: string) { setTendencyFilter(v); setPage(1); setSelectedIds(new Set()); }
  function handleSortChange(v: typeof sort) { setSort(v); setPage(1); setSelectedIds(new Set()); }

  function handleEdit(c: Customer) {
    setEditTarget(c);
    setModalOpen(true);
  }

  function handleAdd() {
    setEditTarget(null);
    setModalOpen(true);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === customers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(customers.map((c) => c.id)));
    }
  }

  function handleDelete(id: string) {
    if (!confirm("이 고객을 삭제하시겠습니까?")) return;
    startTransition(async () => {
      const { error } = await deleteCustomer(id);
      if (error) toast.error(error);
      else {
        toast.success("삭제되었습니다");
        setCustomers((prev) => prev.filter((c) => c.id !== id));
        setCount((p) => p - 1);
      }
    });
  }

  function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택된 ${selectedIds.size}명을 삭제하시겠습니까?`)) return;
    startTransition(async () => {
      const { error } = await deleteCustomers([...selectedIds]);
      if (error) toast.error(error);
      else {
        toast.success(`${selectedIds.size}명 삭제되었습니다`);
        setCustomers((prev) => prev.filter((c) => !selectedIds.has(c.id)));
        setCount((p) => p - selectedIds.size);
        setSelectedIds(new Set());
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">고객 관리</h1>
          <p className="text-sm text-slate-500 mt-0.5">전체 {count.toLocaleString()}명</p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <Button onClick={handleAdd} className="bg-slate-900 hover:bg-slate-700 gap-2">
            <Plus className="w-4 h-4" />
            회원 등록
          </Button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 transition-colors"
          >
            📥 vcf / csv 가져오기
          </button>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-2 border border-red-400 text-red-500 rounded-lg px-3 py-2 text-sm font-medium hover:bg-red-50 transition-colors"
          >
            🗑 가져오기 초기화
          </button>
        </div>
      </div>

      {/* 가져오기 초기화 확인 모달 */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowResetConfirm(false)} />
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="text-base font-semibold text-red-600">📥 가져오기 초기화</h3>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-slate-700 leading-relaxed">
                <strong>vcf / csv 파일로 가져온 연락처만</strong> 삭제합니다.
              </p>
              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3">
                <p className="text-sm text-green-700 font-medium">✅ 유지되는 항목</p>
                <p className="text-xs text-green-600 mt-1">직접 입력·등록한 고객은 <strong>삭제되지 않습니다.</strong></p>
              </div>
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-700 font-medium">🗑 삭제되는 항목</p>
                <p className="text-xs text-red-600 mt-1">vcf / csv 파일로 가져온 연락처만 삭제됩니다.</p>
                <p className="text-xs text-red-500 mt-1">직접 등록한 고객을 삭제하려면 목록에서 개별 삭제 버튼을 사용하세요.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-white transition-colors"
              >
                취소
              </button>
              <button
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    const res = await deleteImportedCustomers();
                    if (res.error) toast.error(res.error);
                    else {
                      toast.success(`가져온 연락처 ${res.count ?? 0}명이 삭제되었습니다`);
                      const fresh = await getCustomers({ page: 1, pageSize: PAGE_SIZE, sort });
                      if (!fresh.error) {
                        setCustomers(fresh.data as Customer[]);
                        setCount(fresh.count);
                      }
                      setSelectedIds(new Set());
                      setShowResetConfirm(false);
                    }
                  });
                }}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? "삭제 중..." : "가져온 연락처만 삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 필터 바 */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="이름, 전화번호, 이메일 검색..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          {search && (
            <button onClick={() => handleSearchChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          className="h-9 rounded-md border border-slate-200 px-3 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value as "all" | "active" | "inactive")}
        >
          <option value="all">전체 상태</option>
          <option value="active">활성</option>
          <option value="inactive">비활성</option>
        </select>

        <select
          className="h-9 rounded-md border border-slate-200 px-3 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          value={tendencyFilter}
          onChange={(e) => handleTendencyChange(e.target.value)}
        >
          <option value="all">전체 성별</option>
          <option value="male">남</option>
          <option value="female">여</option>
          <option value="business">사업장</option>
          <option value="other">기타</option>
        </select>

        <select
          className="h-9 rounded-md border border-slate-200 px-3 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          value={sort}
          onChange={(e) => handleSortChange(e.target.value as typeof sort)}
        >
          <option value="created_desc">최근 등록순</option>
          <option value="created_asc">오래된 순</option>
          <option value="name_asc">가나다순</option>
          <option value="name_desc">가나다 역순</option>
          <option value="updated_desc">최근 수정순</option>
        </select>

        {selectedIds.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkDelete}
            disabled={isPending}
            className="border-red-200 text-red-600 hover:bg-red-50 gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {selectedIds.size}명 삭제
          </Button>
        )}
      </div>

      {/* 테이블 */}
      <div className={`rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm transition-opacity ${isPending ? "opacity-60 pointer-events-none" : ""}`}>

        {/* PC: 테이블 (md 이상) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="w-10 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={customers.length > 0 && selectedIds.size === customers.length}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">이름</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">전화번호</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">이메일</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 hidden lg:table-cell">성별</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 hidden xl:table-cell">태그</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">상태</th>
                <th className="w-24 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Users className="w-8 h-8" />
                      <p className="text-sm">고객이 없습니다. 먼저 고객을 추가해보세요.</p>
                    </div>
                  </td>
                </tr>
              ) : customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="font-mono text-xs">{formatPhone(c.phone)}</span>
                    {(() => { const t = checkPhoneType(c.phone); return t !== "mobile" ? (
                      <span className={`ml-1.5 inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${PHONE_TYPE_BADGE_CLASS[t]}`}>{PHONE_TYPE_LABEL[t]}</span>
                    ) : null; })()}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {c.investment_tendency ? (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${GENDER_LABEL[c.investment_tendency]?.color ?? ""}`}>
                        {GENDER_LABEL[c.investment_tendency]?.label}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(c.tags ?? []).filter(t => !t.startsWith("__")).slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs h-5 px-1.5">{tag}</Badge>
                      ))}
                      {(c.tags ?? []).filter(t => !t.startsWith("__")).length > 3 && (
                        <span className="text-xs text-slate-400">+{(c.tags ?? []).filter(t => !t.startsWith("__")).length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${c.status === "active" ? "text-green-600" : "text-slate-400"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${c.status === "active" ? "bg-green-500" : "bg-slate-300"}`} />
                      {c.status === "active" ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(c)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="수정"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={isPending}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 모바일: 카드 리스트 (md 미만) */}
        <div className="md:hidden">
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border-b border-slate-100">
            <input type="checkbox" className="rounded border-slate-300"
              checked={customers.length > 0 && selectedIds.size === customers.length}
              onChange={toggleAll} />
            <span className="text-xs text-slate-500 font-medium">전체 선택</span>
          </div>
          {customers.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center gap-2 text-slate-400">
              <Users className="w-8 h-8" />
              <p className="text-sm">고객이 없습니다. 먼저 고객을 추가해보세요.</p>
            </div>
          ) : customers.map((c) => (
            <CustomerCard
              key={c.id}
              c={c}
              selected={selectedIds.has(c.id)}
              onToggle={() => toggleSelect(c.id)}
              onEdit={() => handleEdit(c)}
              onDelete={() => handleDelete(c.id)}
              isPending={isPending}
            />
          ))}
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-white">
            <p className="text-sm font-medium text-slate-600">
              {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, count)} / {count}명
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold disabled:opacity-30 hover:bg-slate-100 active:bg-slate-200 transition-colors shadow-sm"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-bold text-slate-800 min-w-[4rem] text-center">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold disabled:opacity-30 hover:bg-slate-100 active:bg-slate-200 transition-colors shadow-sm"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 고객 추가/수정 모달 */}
      <CustomerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editTarget={editTarget}
        onSuccess={(customer, isNew) => {
          if (isNew) {
            setCustomers((prev) => [customer, ...prev]);
            setCount((p) => p + 1);
          } else {
            setCustomers((prev) => prev.map((c) => (c.id === customer.id ? customer : c)));
          }
          setModalOpen(false);
        }}
      />

      {/* vcf / csv 가져오기 모달 */}
      {showImportModal && (
        <ContactImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={(insertedCount) => {
            setShowImportModal(false);
            toast.success(`${insertedCount}명의 고객이 추가되었습니다`);
            setSort("name_asc");
            setPage(1);
            setSelectedIds(new Set());
          }}
        />
      )}
    </div>
  );
}
