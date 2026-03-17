"use client"

import { useState, useRef, useEffect } from "react"
import { Plus, Download, Image as ImageIcon, Trash2, GripVertical, FileText } from "lucide-react"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { v4 as uuidv4 } from "uuid"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"

// 스텝 데이터 구조
interface ManualStep {
  id: string
  title: string
  description: string
  narration: string
  imageUrl: string | null
}

export default function Home() {
  const [isMounted, setIsMounted] = useState(false)
  const [title, setTitle] = useState("Farm Manager 로그인 가이드")
  const [steps, setSteps] = useState<ManualStep[]>([
    { 
      id: uuidv4(), 
      title: "1. Farm Manager 접속 및 로그인", 
      description: "주소창에 접속 후 로그인 화면이 나타나면 발급받은 사원 번호와 비밀번호를 입력하고 파란색 로그인 버튼을 클릭합니다.", 
      narration: "여러분 안녕하세요! 첫 번째 단계입니다. 브라우저를 열고 로그인 페이지에 접속해 주세요. 화면 중앙에 아이디와 비밀번호를 입력하고 로그인합니다.", 
      imageUrl: "/step1.png" 
    },
    { 
      id: uuidv4(), 
      title: "2. 대시보드 - 종합 현황 모니터링", 
      description: "로그인 직후 표시되는 메인 대시보드입니다. 전체 농장의 요약 정보와 실시간 통계, 주요 알림 등을 한눈에 파악할 수 있는 중심 뷰입니다.", 
      narration: "로그인이 완료되면 가장 먼저 보이는 대시보드입니다. 여기서는 농장의 전반적인 요약 정보와 오늘 꼭 처리해야 할 현황들을 빠르게 파악할 수 있어요.", 
      imageUrl: "/step2.png" 
    },
    { 
      id: uuidv4(), 
      title: "3. 고객 관리 (Customers)", 
      description: "좌측 메뉴에서 '고객' 아이콘을 클릭합니다. 신규 고객 등록, 기존 고객 정보 수정 및 등급 관리, 구매 이력 등을 조회하는 페이지입니다.", 
      narration: "이제 좌측 메뉴 두 번째, '고객 관리'에 들어왔습니다. 이곳에서 우리 농장의 소중한 고객 목록을 조회하고, 새로운 연락처 정보를 꼼꼼히 등록해 보세요.", 
      imageUrl: "/step3.png" 
    },
    { 
      id: uuidv4(), 
      title: "4. 쇼핑/판매 내역 관리 (Shopping)", 
      description: "주문 건들을 관리하는 페이지입니다. 상태별 배송 처리, 매출 통계, 개별 주문의 상세 내역을 파악하여 판매의 흐름을 관리합니다.", 
      narration: "다음은 '쇼핑 내역 관리' 탭입니다. 농산물 주문이 들어오면 바로바로 이곳에서 상태를 '배송 중'으로 업데이트하고, 이번 달 매출을 직관적으로 확인하실 수 있습니다.", 
      imageUrl: "/step4.png" 
    },
    { 
      id: uuidv4(), 
      title: "5. 영농 일지 작성 (Notes)", 
      description: "매일의 농작업을 기록하는 다이어리 메뉴입니다. 작업자, 날씨, 핵심 수행 업무, 그리고 농작물의 특이사항 등을 상세히 남길 수 있습니다.", 
      narration: "농장 관리의 핵심 중의 핵심! '영농 일지' 메뉴입니다. 밭에 다녀오셨다면 잊지 말고 오늘 어떤 작업을 했는지 기록하여 내년 농사를 위한 최고의 데이터를 쌓아보세요.", 
      imageUrl: "/step5.png" 
    },
    { 
      id: uuidv4(), 
      title: "6. 가공품 레시피 관리 (Recipes)", 
      description: "단순 농산물 판매를 넘어선 2차 가공품에 대한 레시피 리스트입니다. 투입 재료 비율, 제조 공정 매뉴얼 등을 표준화하여 관리합니다.", 
      narration: "만약 딸기잼이나 배즙 같은 가공품을 만드신다면 '레시피' 메뉴를 열어보세요. 황금 비율을 여기에 꼼꼼히 기록해서 항상 일정한 품질의 제품을 생산할 수 있습니다.", 
      imageUrl: "/step6.png" 
    },
    { 
      id: uuidv4(), 
      title: "7. 체험/예약 관리 (Reservations)", 
      description: "농장 체험 프로그램, 외부 투어 등의 방문 일정을 캘린더 기반으로 관리합니다. 중복 예약을 방지하고 인원수를 파악할 수 있습니다.", 
      narration: "마지막으로 '예약 관리' 메뉴입니다. 언제 몇 명의 손님이 우리 농장에 오는지 한 치의 오차 없이 조율해 줍니다. 여기까지 Farm Manager 시스템 전체 투어를 마칩니다. 감사합니다!", 
      imageUrl: "/step7.png" 
    }
  ])
  const [isGenerating, setIsGenerating] = useState(false)
  
  // 브라우저 렌더링 타이밍 방어 (DnD 하이드레이션 에러용)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // PDF로 렌더링될 DOM 영역을 참조하는 ref
  const printRef = useRef<HTMLDivElement>(null)

  // 1. 새 스텝 추가
  const addStep = () => {
    setSteps([...steps, { id: uuidv4(), title: "", description: "", narration: "", imageUrl: null }])
  }

  // 2. 스텝 삭제
  const removeStep = (id: string) => {
    if(steps.length <= 1) return; // 최소 1개는 유지
    setSteps(steps.filter(step => step.id !== id))
  }

  // 3. 스텝 내용 업데이트
  const updateStep = (id: string, field: keyof ManualStep, value: string | null) => {
    setSteps(steps.map(step => step.id === id ? { ...step, [field]: value } : step))
  }

  // 동영상 대본(마크다운) 추출 로직
  const exportScript = () => {
    let scriptContent = `# ${title || '무제 매뉴얼'} - 동영상 촬영 대본\n\n`;
    steps.forEach((step, index) => {
      scriptContent += `## 씬(Scene) ${index + 1}: ${step.title || '제목 없음'}\n`;
      if (step.narration) {
        scriptContent += `🗣️ 대사/자막:\n${step.narration}\n\n`;
      } else {
        scriptContent += `🗣️ 대사/자막: (작성 안 됨)\n\n`;
      }
      if (step.description) {
        scriptContent += `📝 추가 설명(참고용):\n${step.description}\n\n`;
      }
      scriptContent += `----------------------------------------\n\n`;
    });

    const blob = new Blob([scriptContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || 'manual'}_script.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 4. 로컬 이미지 업로드 핸들러
  const handleImageUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        updateStep(id, 'imageUrl', reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // 5. 드래그 앤 드롭 종료 이벤트 핸들러
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const startIndex = result.source.index
    const endIndex = result.destination.index

    const newSteps = Array.from(steps)
    const [removed] = newSteps.splice(startIndex, 1)
    newSteps.splice(endIndex, 0, removed)

    setSteps(newSteps)
  }

  // 6. PDF 생성 핵심 로직
  const generatePDF = async () => {
    if (!printRef.current) return
    setIsGenerating(true)

    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2, 
        useCORS: true, 
        logging: false,
      })

      const imgData = canvas.toDataURL("image/png")

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight)
      pdf.save(`${title || 'manual'}.pdf`)
      
    } catch (error) {
      console.error("PDF 생성 중 오류 발생:", error)
      alert("PDF 생성에 실패했습니다.")
    } finally {
      setIsGenerating(false)
    }
  }

  // 하이드레이션 대응
  if (!isMounted) return null

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans selection:bg-blue-500/30">
      {/* 헤더 */}
      <header className="h-16 shrink-0 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="font-bold text-white text-lg leading-none">B</span>
          </div>
          <div>
            <h1 className="font-semibold text-slate-100 leading-tight">비키트 매뉴얼 스튜디오</h1>
            <p className="text-xs text-slate-400">PDF 가이드 자동 생성기</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={exportScript}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-purple-300 px-4 py-2 rounded-md font-medium transition-colors shadow-sm border border-slate-700"
          >
            <FileText size={18} />
            대본 추출
          </button>
          <button 
            onClick={generatePDF}
            disabled={isGenerating}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md font-medium transition-colors shadow-sm"
          >
            <Download size={18} />
            {isGenerating ? "PDF 굽는 중..." : "PDF 내보내기"}
          </button>
        </div>
      </header>

      {/* 메인 캔버스 영역 */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* 좌측: 에디터 패널 (컨트롤 보드) */}
        <aside className="w-[450px] shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col overflow-y-auto">
          <div className="p-6 pb-2 border-b border-slate-800">
            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">매뉴얼 제목</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/50 rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium text-lg placeholder:text-slate-600"
              placeholder="예: 농장 관리 시스템 로그인 가이드"
            />
          </div>

          <div className="flex-1 p-6 space-y-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-300">단계별 스크린샷 캔버스</h2>
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{steps.length} Steps</span>
            </div>

            {/* DnD Context */}
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="steps-list">
                {(provided) => (
                  <div 
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-6"
                  >
                    {steps.map((step, index) => (
                      <Draggable key={step.id} draggableId={step.id} index={index}>
                        {(provided, snapshot) => (
                          <div 
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`bg-slate-950/50 border rounded-xl p-4 transition-all ${
                              snapshot.isDragging ? "border-blue-500 ring-2 ring-blue-500/20 shadow-2xl z-50 bg-slate-900" : "border-slate-800 hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                {/* 드래그 핸들 */}
                                <div 
                                  {...provided.dragHandleProps} 
                                  className="text-slate-600 hover:text-slate-300 transition-colors p-1 cursor-grab active:cursor-grabbing"
                                >
                                  <GripVertical size={16} />
                                </div>
                                <span className="bg-blue-900/40 text-blue-400 text-xs font-bold px-2.5 py-1 rounded-md">STEP {index + 1}</span>
                              </div>
                              {steps.length > 1 && (
                                <button onClick={() => removeStep(step.id)} className="text-slate-500 hover:text-red-400 transition-colors text-sm flex items-center gap-1 p-1">
                                   <Trash2 size={14} /> 삭제
                                </button>
                              )}
                            </div>

                            {/* 이미지 업로드 영역 */}
                            <label className="aspect-video w-full bg-slate-900 border border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 hover:border-slate-500 transition-all cursor-pointer mb-4 group relative overflow-hidden">
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(step.id, e)} />
                              {step.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={step.imageUrl} alt={`Step ${index + 1}`} className="w-full h-full object-cover" />
                              ) : (
                                <>
                                  <ImageIcon size={28} className="mb-2 opacity-50 group-hover:opacity-100 transition-opacity" />
                                  <span className="text-sm font-medium">클릭하여 스크린샷 업로드</span>
                                </>
                              )}
                            </label>

                            {/* 설명 입력 영역 */}
                            <div className="space-y-3">
                              <input 
                                type="text" 
                                value={step.title}
                                onChange={(e) => updateStep(step.id, 'title', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700/50 rounded-md px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                placeholder="단계를 설명하는 간단한 제목 (예: 아이디/비밀번호 입력)"
                              />
                              <textarea 
                                rows={3}
                                value={step.description}
                                onChange={(e) => updateStep(step.id, 'description', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700/50 rounded-md px-3 py-2 text-slate-300 text-sm resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                placeholder="상세한 설명이나 주의사항을 적어주세요."
                              />
                              <div className="pt-2 border-t border-slate-800">
                                <label className="block text-xs font-semibold text-purple-400 mb-1 flex items-center gap-1">
                                  <FileText size={12} /> 동영상 씬(Scene) 대본/자막
                                </label>
                                <textarea 
                                  rows={2}
                                  value={step.narration}
                                  onChange={(e) => updateStep(step.id, 'narration', e.target.value)}
                                  className="w-full bg-slate-900 border-l-4 border-purple-500 border-y border-r border-slate-700/50 rounded-r-md px-3 py-2 text-purple-200 text-sm resize-none focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                                  placeholder="화면이 넘어갈 때 읽어줄 멘트나 자막을 작성하세요."
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            {/* 스텝 추가 버튼 */}
            <button 
              onClick={addStep}
              className="w-full py-4 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 font-medium flex items-center justify-center gap-2 hover:bg-slate-800/50 hover:border-slate-500 hover:text-slate-200 transition-all"
            >
              <Plus size={20} />
              새로운 단계(Step) 추가
            </button>
          </div>
        </aside>

        {/* 우측: 프리뷰 패널 (실제 PDF 형태로 보임) */}
        <section className="flex-1 bg-slate-950 p-8 overflow-y-auto flex justify-center custom-scrollbar relative">
          
          <div 
            ref={printRef}
            className="w-[210mm] min-h-[297mm] h-max bg-white flex flex-col shrink-0 relative print-area text-slate-900" 
            style={{ boxShadow: isGenerating ? 'none' : '0 0 40px rgba(0,0,0,0.5)' }}
          >
            
            {/* 문서 헤더 */}
            <div className="h-24 bg-slate-50 border-b border-slate-200 flex flex-col justify-center px-12 shrink-0">
               <p className="text-blue-600 font-bold text-sm tracking-widest mb-1">B-KIT SOFTWARE MANUAL</p>
               <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">{title || '무제 매뉴얼'}</h1>
            </div>

            {/* 본문 콘텐츠 렌더링 영역 */}
            <div className="flex-1 px-12 py-10 flex flex-col gap-12">
              
              {/* 입력받은 스텝들 순회하며 표시 */}
              {steps.map((step, index) => (
                <div key={step.id} className="flex flex-col">
                  {/* 스텝 번호 & 제목 */}
                  <div className="flex items-center gap-4 mb-5">
                    <div className="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl shrink-0 shadow-md">
                      {index + 1}
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 leading-tight">
                      {step.title || '제목을 입력해주세요'}
                    </h2>
                  </div>
                  
                  {/* 이미지 영역 */}
                  <div className="w-full bg-slate-50 rounded-xl flex items-center justify-center border border-slate-200 mb-5 shadow-sm overflow-hidden min-h-[200px]">
                    {step.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={step.imageUrl} alt={`Step ${index + 1} preview`} className="w-full h-auto object-contain max-h-[400px]" />
                    ) : (
                      <p className="text-slate-400 font-medium py-16">이미지가 여기에 표시됩니다</p>
                    )}
                  </div>
                  
                  {/* 설명 텍스트 영역 */}
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                    <p className="text-slate-700 leading-relaxed text-[15px] whitespace-pre-wrap">
                      {step.description || '상세 설명 텍스트가 렌더링되는 공간입니다. 좌측 패널에서 내용을 작성하면 이 위치에 실시간으로 반영됩니다.'}
                    </p>
                  </div>

                  {/* 동영상 대본/자막 표시 영역 (PDF에도 노출) */}
                  {step.narration && (
                    <div className="bg-slate-800 text-white p-4 rounded-xl shadow-inner mt-4 flex items-start gap-4 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-2 h-full bg-purple-500"></div>
                      <div className="mt-0.5 bg-purple-500/20 p-2 rounded-lg text-purple-300 shrink-0">
                        <FileText size={20} />
                      </div>
                      <div className="flex-1 pt-0.5">
                        <p className="text-xs font-bold text-purple-400 mb-1 uppercase tracking-wider">Video Script / 대본 및 자막</p>
                        <p className="text-slate-200 leading-relaxed text-[15px] whitespace-pre-wrap font-medium">
                          {step.narration}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}

            </div>

            {/* 문서 푸터 */}
            <div className="h-16 mt-auto border-t border-slate-200 flex items-center justify-between px-12 text-xs text-slate-400 font-medium shrink-0 bg-white">
              <span>Copyright © B-KIT All rights reserved.</span>
              <span>Confidential / Internal Use Only</span>
            </div>
            
          </div>

        </section>

      </main>
    </div>
  )
}
