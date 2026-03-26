/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { X, Loader2, MapPin, Search } from "lucide-react";
import DaumPostcode, { Address } from "react-daum-postcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCustomer, updateCustomer } from "@/app/actions/customers";
import { isValidKoreanPhone } from "@/lib/phoneUtils";
import type { Customer, CustomerFormData } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  editTarget: Customer | null;
  onSuccess: (customer: Customer, isNew: boolean) => void;
}

// 전화번호 자동 포맷 (입력 중 하이픈 자동 삽입)
function formatPhoneInput(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.startsWith("02")) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0,2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0,2)}-${d.slice(2,5)}-${d.slice(5)}`;
    return `${d.slice(0,2)}-${d.slice(2,6)}-${d.slice(6,10)}`;
  }
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
  return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
}

const CURRENT_YEAR = new Date().getFullYear();
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
function getDays(year: number, month: number) {
  return Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => i + 1);
}
function parseBirthDate(dateStr?: string | null) {
  if (!dateStr) return { year: "", month: "", day: "" };
  const [y, m, d] = dateStr.split("-");
  return { year: y ?? "", month: m ? String(Number(m)) : "", day: d ? String(Number(d)) : "" };
}

const EMPTY: CustomerFormData = {
  name: "", phone: "", email: "", birth_date: "",
  investment_tendency: "", status: "active", tags: "", memo: "",
  address: "", detail_address: "", postal_code: "",
};

export default function CustomerModal({ open, onClose, editTarget, onSuccess }: Props) {
  const [form, setForm] = useState<CustomerFormData>(EMPTY);
  const [birthY, setBirthY] = useState("");
  const [birthM, setBirthM] = useState("");
  const [birthD, setBirthD] = useState("");
  const [addrOpen, setAddrOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (editTarget) {
        const { year, month, day } = parseBirthDate(editTarget.birth_date);
        setBirthY(year); setBirthM(month); setBirthD(day);
        setForm({
          name: editTarget.name,
          phone: editTarget.phone,
          email: editTarget.email ?? "",
          birth_date: editTarget.birth_date ?? "",
          investment_tendency: editTarget.investment_tendency ?? "",
          status: editTarget.status,
          tags: (editTarget.tags ?? []).filter(t => !t.startsWith("__")).join(", "),
          memo: editTarget.memo ?? "",
          address: editTarget.address ?? "",
          detail_address: editTarget.detail_address ?? "",
          postal_code: editTarget.postal_code ?? "",
        });
      } else {
        setBirthY(""); setBirthM(""); setBirthD("");
        setForm(EMPTY);
      }
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open, editTarget]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && !addrOpen && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, addrOpen]);

  useEffect(() => {
    if (birthY && birthM && birthD) {
      const m = birthM.padStart(2, "0");
      const d = birthD.padStart(2, "0");
      setForm((prev) => ({ ...prev, birth_date: `${birthY}-${m}-${d}` }));
    } else {
      setForm((prev) => ({ ...prev, birth_date: "" }));
    }
  }, [birthY, birthM, birthD]);

  function set<K extends keyof CustomerFormData>(key: K, value: CustomerFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleAddressComplete(data: Address) {
    let fullAddress = data.address;
    let extra = "";
    if (data.addressType === "R") {
      if (data.bname) extra += data.bname;
      if (data.buildingName) extra += (extra ? `, ${data.buildingName}` : data.buildingName);
      if (extra) fullAddress += ` (${extra})`;
    }
    setForm((prev) => ({
      ...prev,
      address: fullAddress,
      postal_code: data.zonecode,
      detail_address: "",
    }));
    setAddrOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("이름을 입력해주세요"); return; }
    if (!form.phone.trim()) { toast.error("전화번호를 입력해주세요"); return; }
    if (!isValidKoreanPhone(form.phone)) {
      toast.error("올바른 전화번호 형식이 아닙니다. (예: 010-1234-5678)");
      return;
    }

    startTransition(async () => {
      const payload = { ...form };
      if (editTarget) {
        const { error } = await updateCustomer(editTarget.id, payload);
        if (error) { toast.error(error); return; }
        toast.success("수정되었습니다");
        const updated: Customer = {
          ...editTarget,
          name: form.name, phone: form.phone,
          email: form.email || null,
          birth_date: form.birth_date || null,
          investment_tendency: (form.investment_tendency as Customer["investment_tendency"]) || null,
          status: form.status,
          tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
          memo: form.memo || null,
          address: form.address || null,
          detail_address: form.detail_address || null,
          postal_code: form.postal_code || null,
          updated_at: new Date().toISOString(),
        };
        onSuccess(updated, false);
      } else {
        const { error } = await createCustomer(payload);
        if (error) { toast.error(error); return; }
        toast.success("회원이 등록되었습니다");
        const newCustomer: Customer = {
          id: crypto.randomUUID(), user_id: "",
          name: form.name, phone: form.phone,
          email: form.email || null,
          birth_date: form.birth_date || null,
          investment_tendency: (form.investment_tendency as Customer["investment_tendency"]) || null,
          status: form.status,
          tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
          memo: form.memo || null,
          address: form.address || null,
          detail_address: form.detail_address || null,
          postal_code: form.postal_code || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        onSuccess(newCustomer, true);
      }
    });
  }

  if (!open) return null;

  const days = birthY && birthM ? getDays(Number(birthY), Number(birthM)) : getDays(2000, 1);
  const sel = "h-9 rounded-md border border-slate-200 px-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !addrOpen && onClose()} />

      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">
            {editTarget ? "고객 수정" : "회원 등록"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">

          {/* 이름 + 전화번호 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-medium text-slate-700">
                이름 <span className="text-red-500">*</span>
              </Label>
              <Input id="name" ref={nameRef} value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-medium text-slate-700">
                전화번호 <span className="text-red-500">*</span>
              </Label>
              <Input id="phone" value={form.phone}
                onChange={(e) => set("phone", formatPhoneInput(e.target.value))}
                className="h-9 text-sm" />
            </div>
          </div>

          {/* 이메일 */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium text-slate-700">이메일</Label>
            <Input id="email" type="email" value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className="h-9 text-sm" />
          </div>

          {/* 생년월일 - 안 C */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-700">생년월일</Label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1930} max={CURRENT_YEAR}
                value={birthY}
                onChange={(e) => {
                  setBirthY(e.target.value);
                  if (birthD && birthM && e.target.value) {
                    const maxDay = new Date(Number(e.target.value), Number(birthM), 0).getDate();
                    if (Number(birthD) > maxDay) setBirthD(String(maxDay));
                  }
                }}
                className="w-24 h-9 rounded-md border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-slate-500 text-sm shrink-0">년</span>
              <select className={`w-20 ${sel}`} value={birthM}
                onChange={(e) => {
                  setBirthM(e.target.value);
                  if (birthD && birthY && e.target.value) {
                    const maxDay = new Date(Number(birthY), Number(e.target.value), 0).getDate();
                    if (Number(birthD) > maxDay) setBirthD(String(maxDay));
                  }
                }}>
                <option value="">월</option>
                {MONTHS.map((m) => <option key={m} value={String(m)}>{m}</option>)}
              </select>
              <span className="text-slate-500 text-sm shrink-0">월</span>
              <select className={`w-20 ${sel}`} value={birthD}
                onChange={(e) => setBirthD(e.target.value)}>
                <option value="">일</option>
                {days.map((d) => <option key={d} value={String(d)}>{d}</option>)}
              </select>
              <span className="text-slate-500 text-sm shrink-0">일</span>
            </div>
          </div>

          {/* 성별 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-700">성별</Label>
            <div className="flex gap-4">
              {(["male", "female", "business", "other"] as const).map((v) => (
                <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="investment_tendency" value={v}
                    checked={form.investment_tendency === v}
                    onChange={() => set("investment_tendency", v)}
                    className="accent-slate-900" />
                  <span className={`text-sm font-medium ${
                    v === "male" ? "text-blue-600" :
                    v === "female" ? "text-pink-500" :
                    v === "business" ? "text-purple-600" :
                    "text-slate-600"
                  }`}>{v === "male" ? "남" : v === "female" ? "여" : v === "business" ? "사업장" : "기타"}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 주소 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> 주소
              </Label>
              <button type="button" onClick={() => setAddrOpen(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors border border-blue-100">
                <Search className="w-3 h-3" /> 주소 검색
              </button>
            </div>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)}
              placeholder="주소 검색 버튼을 눌러 검색하세요" className="h-9 text-sm bg-slate-50" />
            <div className="grid grid-cols-3 gap-2">
              <Input value={form.detail_address} onChange={(e) => set("detail_address", e.target.value)}
                placeholder="동, 호수, 상세주소" className="col-span-2 h-9 text-sm" />
              <Input value={form.postal_code} readOnly placeholder="우편번호"
                className="h-9 text-sm bg-slate-50 text-center text-slate-500" />
            </div>
          </div>

          {/* 특이사항 */}
          <div className="space-y-1.5">
            <Label htmlFor="tags" className="text-xs font-medium text-slate-700">특이사항 (쉼표나 / 로 구분)</Label>
            <Input id="tags" value={form.tags} onChange={(e) => set("tags", e.target.value)}
              placeholder="" className="h-9 text-sm" />
          </div>

          {/* 메모 */}
          <div className="space-y-1.5">
            <Label htmlFor="memo" className="text-xs font-medium text-slate-700">메모</Label>
            <textarea id="memo" value={form.memo} onChange={(e) => set("memo", e.target.value)}
              placeholder="중요한 일 메모하세요." rows={3}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/20 resize-none" />
          </div>

          {/* 상태 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-700">상태</Label>
            <div className="flex gap-3">
              {(["active", "inactive"] as const).map((s) => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="status" value={s}
                    checked={form.status === s} onChange={() => set("status", s)}
                    className="accent-slate-900" />
                  <span className="text-sm text-slate-700">{s === "active" ? "활성" : "비활성"}</span>
                </label>
              ))}
            </div>
          </div>
        </form>

        {/* 푸터 */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending} className="h-9 text-sm">
            취소
          </Button>
          <Button onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={isPending}
            className="h-9 text-sm bg-slate-900 hover:bg-slate-700 gap-1.5">
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {editTarget ? "수정 완료" : "등록"}
          </Button>
        </div>
      </div>

      {/* 카카오 주소 검색 팝업 */}
      {addrOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold text-slate-900 text-sm">주소 검색</h3>
              <button onClick={() => setAddrOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="h-[420px]">
              <DaumPostcode onComplete={handleAddressComplete} style={{ height: "100%", width: "100%" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
