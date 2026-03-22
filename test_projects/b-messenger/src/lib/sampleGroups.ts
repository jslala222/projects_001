// ================================================================
// sampleGroups.ts — 4단계 그룹 샘플 데이터 (주소록 분류 체계)
// 보고서 "주소록 4단계 분류 체계 보고서" 기반
// ================================================================

export interface SampleNode {
  name: string;
  description?: string;
  children?: SampleNode[];
}

export interface SampleDomain {
  id: string;          // 도메인 식별키
  name: string;        // 대분류 이름
  icon: string;        // 이모지
  color: string;       // 대표 색상
  description: string; // 설명
  totalGroups: number; // 전체 그룹 수 (대략)
  tree: SampleNode[];  // 중분류부터 시작 (대분류는 도메인 자체)
}

export const SAMPLE_DOMAINS: SampleDomain[] = [
  // ── 1. 금융/보험 ──────────────────────────────────────────
  {
    id: "finance",
    name: "금융/보험",
    icon: "🏦",
    color: "#3b82f6",
    description: "보험 상품 갱신 알림, 타겟 맞춤형 금융 상품 안내 발송 시 활용",
    totalGroups: 19,
    tree: [
      {
        name: "보험",
        children: [
          {
            name: "생명보험",
            children: [
              { name: "종신/정기보험", description: "삼성생명, 교보생명, 한화생명" },
              { name: "연금보험", description: "미래에셋생명, 동양생명" },
            ],
          },
          {
            name: "손해보험",
            children: [
              { name: "자동차보험", description: "삼성화재, 현대해상, DB손해보험, KB손해보험" },
              { name: "화재/해상보험", description: "메리츠화재, 흥국화재" },
              { name: "실손의료비", description: "우체국보험, 농협손보" },
            ],
          },
        ],
      },
      {
        name: "금융/투자",
        children: [
          {
            name: "은행",
            children: [
              { name: "입출금/예적금", description: "시중은행 (KB, 신한, 하나, 우리)" },
            ],
          },
          {
            name: "증권/투자",
            children: [
              { name: "국내주식/해외주식", description: "키움증권, 토스증권, NH투자증권" },
            ],
          },
        ],
      },
    ],
  },

  // ── 2. B2B 거래처 ──────────────────────────────────────────
  {
    id: "b2b",
    name: "B2B 거래처",
    icon: "🏢",
    color: "#6366f1",
    description: "B2B 영업, 협력사 관리, 세금계산서 발행 안내 등에 활용",
    totalGroups: 17,
    tree: [
      {
        name: "거래처",
        children: [
          {
            name: "공급사 (매입)",
            children: [
              { name: "원자재/부품", description: "철강소재, 전자부품, 화학원료 납품사" },
              { name: "IT/소프트웨어", description: "서버호스팅, SaaS솔루션, 보안업체" },
            ],
          },
          {
            name: "고객사 (매출)",
            children: [
              { name: "대기업", description: "삼성그룹 계열사, 현대차그룹, SK그룹" },
              { name: "중견/중소기업", description: "제조강소기업, IT스타트업, 유통벤더" },
              { name: "공공기관/지자체", description: "서울시청, 한국전력, 정부부처" },
            ],
          },
          {
            name: "협력사/외주",
            children: [
              { name: "마케팅/디자인", description: "광고대행사, 웹에이전시, 영상제작사" },
              { name: "물류/배송", description: "CJ대한통운, 한진택배, 퀵서비스" },
            ],
          },
        ],
      },
    ],
  },

  // ── 3. 취미/개인관심사 ──────────────────────────────────────
  {
    id: "hobby",
    name: "취미/개인관심사",
    icon: "🎯",
    color: "#22c55e",
    description: "쇼핑몰, 동호회, 이벤트 기획 시 고객 성향 파악 및 맞춤 광고 발송",
    totalGroups: 19,
    tree: [
      {
        name: "취미/여가",
        children: [
          {
            name: "스포츠/운동",
            children: [
              { name: "구기종목", description: "축구, 야구, 농구, 테니스, 골프" },
              { name: "아웃도어", description: "등산, 캠핑, 낚시, 자전거" },
              { name: "피트니스", description: "헬스, 요가, 필라테스, 수영" },
            ],
          },
          {
            name: "문화/예술",
            children: [
              { name: "공연/전시", description: "뮤지컬, 클래식, 미술관 관람" },
              { name: "서브컬쳐", description: "웹툰, 애니메이션, 게임(PC/모바일)" },
            ],
          },
          {
            name: "여행",
            children: [
              { name: "국내여행", description: "제주도, 강원도, 호캉스" },
              { name: "해외여행", description: "동남아, 일본, 유럽, 미주" },
            ],
          },
        ],
      },
    ],
  },

  // ── 4. 직업/산업군 ──────────────────────────────────────────
  {
    id: "profession",
    name: "직업/산업군",
    icon: "💼",
    color: "#f97316",
    description: "구인구직, 세미나 초청, 전문 서적 판매, B2B 콜드콜 등에 활용",
    totalGroups: 20,
    tree: [
      {
        name: "직업/산업",
        children: [
          {
            name: "IT/정보통신",
            children: [
              { name: "소프트웨어 개발", description: "프론트엔드, 백엔드, 모바일앱, AI/데이터" },
              { name: "기획/디자인", description: "서비스기획(PM), UI/UX디자인" },
            ],
          },
          {
            name: "의료/보건",
            children: [
              { name: "의사/치과의사", description: "내과, 피부과, 성형외과, 정형외과" },
              { name: "간호/약무", description: "종합병원 간호사, 개업 약사" },
            ],
          },
          {
            name: "교육/학술",
            children: [
              { name: "공교육", description: "초/중/고 교사, 대학교수" },
              { name: "사교육/학원", description: "입시학원강사, 어학원, 예체능학원" },
            ],
          },
          {
            name: "자영업/소상공인",
            children: [
              { name: "요식업", description: "카페/베이커리, 한식, 배달전문점" },
            ],
          },
        ],
      },
    ],
  },

  // ── 5. 부동산/자산 ──────────────────────────────────────────
  {
    id: "realestate",
    name: "부동산/자산",
    icon: "🏘️",
    color: "#eab308",
    description: "고액 자산가 관리, 분양 안내, 프라이빗 뱅킹(PB) 영업 시 활용",
    totalGroups: 18,
    tree: [
      {
        name: "부동산/자산",
        children: [
          {
            name: "주거용 부동산",
            children: [
              { name: "아파트/주상복합", description: "강남구, 서초구, 송파구, 마용성 (초고가 지역)" },
              { name: "단독/다가구", description: "판교 단독주택단지, 한남동" },
            ],
          },
          {
            name: "상업용 부동산",
            children: [
              { name: "빌딩/건물", description: "꼬마빌딩, 대형오피스, 상가" },
              { name: "수익형", description: "오피스텔, 지식산업센터, 숙박시설" },
            ],
          },
          {
            name: "토지",
            children: [
              { name: "개발예정지", description: "3기 신도시, 역세권 개발지" },
            ],
          },
          {
            name: "자동차 (차량)",
            children: [
              { name: "수입차", description: "벤츠, BMW, 포르쉐, 테슬라" },
              { name: "국산차", description: "제네시스, 그랜저, SUV" },
            ],
          },
        ],
      },
    ],
  },

  // ── 6. 인맥/관계망 ──────────────────────────────────────────
  {
    id: "network",
    name: "인맥/관계망",
    icon: "🤝",
    color: "#14b8a6",
    description: "선거 캠프, 총동문회, VIP 사교 모임 관리에 활용되는 한국형 분류",
    totalGroups: 16,
    tree: [
      {
        name: "관계망",
        children: [
          {
            name: "학연 (학교)",
            children: [
              { name: "대학교/대학원", description: "OO대 학부 동문, OO대 최고위과정(AMP)" },
              { name: "초/중/고", description: "OO고등학교 총동문회, 지역 향우회 연계 학교" },
            ],
          },
          {
            name: "사교/친목",
            children: [
              { name: "경제인 연합", description: "상공회의소, 로타리클럽, 라이온스클럽" },
              { name: "종교 모임", description: "기독교(교회명), 불교(사찰명), 천주교" },
            ],
          },
          {
            name: "지연 (지역)",
            children: [
              { name: "수도권 출신", description: "서울, 경기, 인천 향우회" },
              { name: "영남/호남 출신", description: "영남향우회, 호남향우회, 충청향우회" },
            ],
          },
        ],
      },
    ],
  },

  // ── 7. 쇼핑/소비 ──────────────────────────────────────────
  {
    id: "shopping",
    name: "쇼핑/소비",
    icon: "🛍️",
    color: "#ec4899",
    description: "쇼핑몰 및 온/오프라인 유통업체의 프로모션, 쿠폰 발송에 활용",
    totalGroups: 19,
    tree: [
      {
        name: "쇼핑/소비",
        children: [
          {
            name: "패션/의류",
            children: [
              { name: "여성의류", description: "2030여성, 명품, SPA브랜드, 임부복" },
              { name: "남성의류", description: "정장/클래식, 스트릿패션, 스포츠웨어" },
            ],
          },
          {
            name: "뷰티/화장품",
            children: [
              { name: "스킨케어", description: "안티에이징, 트러블케어, 더마코스메틱" },
              { name: "메이크업", description: "색조화장, 향수, 남성그루밍" },
            ],
          },
          {
            name: "가전/디지털",
            children: [
              { name: "대형가전", description: "TV, 냉장고, 세탁기/건조기" },
              { name: "IT/모바일", description: "스마트폰, 태블릿PC, 웨어러블 기기" },
            ],
          },
          {
            name: "식품/생필품",
            children: [
              { name: "신선/가공식품", description: "밀키트, 유기농/친환경, 정육/수산" },
            ],
          },
        ],
      },
    ],
  },

  // ── 8. 라이프스타일 ──────────────────────────────────────────
  {
    id: "lifestyle",
    name: "라이프스타일",
    icon: "🏠",
    color: "#10b981",
    description: "생애주기 맞춤형 상품(유아용품, 1인가구 서비스 등) 발송에 활용",
    totalGroups: 21,
    tree: [
      {
        name: "라이프스타일",
        children: [
          {
            name: "영유아/육아",
            children: [
              { name: "출산/임산부", description: "산후조리, 태아보험, 임부복" },
              { name: "미취학아동", description: "유모차/카시트, 이유식, 유아동복" },
            ],
          },
          {
            name: "가구형태",
            children: [
              { name: "1인가구", description: "자취생/원룸, 배달음식선호, 소포장식품" },
              { name: "신혼부부", description: "혼수가전, 인테리어/가구, 웨딩컨설팅" },
            ],
          },
          {
            name: "반려동물",
            children: [
              { name: "반려견 (강아지)", description: "소형견, 대형견, 노령견 사료/간식" },
              { name: "반려묘 (고양이)", description: "캣타워, 츄르, 고양이모래" },
            ],
          },
          {
            name: "주거환경",
            children: [
              { name: "거주형태", description: "자가, 전세, 월세" },
            ],
          },
        ],
      },
    ],
  },

  // ── 9. 건강/웰니스 ──────────────────────────────────────────
  {
    id: "health",
    name: "건강/웰니스",
    icon: "💊",
    color: "#ef4444",
    description: "건강기능식품 판매, 병의원 내원 안내, 웰니스 프로그램 홍보에 활용",
    totalGroups: 20,
    tree: [
      {
        name: "건강/웰니스",
        children: [
          {
            name: "건강기능식품",
            children: [
              { name: "비타민/미네랄", description: "종합비타민, 오메가3, 유산균" },
              { name: "한방/전통", description: "홍삼진액, 녹용, 공진단" },
            ],
          },
          {
            name: "질환/케어",
            children: [
              { name: "만성질환", description: "당뇨 관리, 고혈압, 관절염" },
              { name: "뷰티/모발", description: "남성탈모, 여성탈모, 피부트러블/아토피" },
            ],
          },
          {
            name: "병의원/시술",
            children: [
              { name: "치과/안과", description: "임플란트/틀니, 라식/라섹" },
              { name: "성형/피부", description: "보톡스/필러, 리프팅, 지방흡입" },
            ],
          },
          {
            name: "다이어트",
            children: [
              { name: "체중감량", description: "식단조절/도시락, 다이어트보조제" },
            ],
          },
        ],
      },
    ],
  },

  // ── 10. 교육/학습 ──────────────────────────────────────────
  {
    id: "education",
    name: "교육/학습",
    icon: "📚",
    color: "#8b5cf6",
    description: "학원 설명회, 온라인 강의 할인, 자격증 프로모션에 활용",
    totalGroups: 19,
    tree: [
      {
        name: "교육/학습",
        children: [
          {
            name: "유/초/중/고",
            children: [
              { name: "입시/수능", description: "고3수험생, 재수생, 논술/면접" },
              { name: "내신/단과", description: "수학전문, 영어전문, 국어/논술" },
              { name: "예체능/특기", description: "피아노/음악, 미술/입시, 태권도/체육" },
            ],
          },
          {
            name: "성인/자기계발",
            children: [
              { name: "외국어", description: "토익/토플, 영어회화, 제2외국어" },
              { name: "직무역량", description: "코딩/프로그래밍, 엑셀/데이터, 마케팅" },
            ],
          },
          {
            name: "자격증/공무원",
            children: [
              { name: "국가고시", description: "공인중개사, 주택관리사, 세무사" },
              { name: "공무원", description: "9급/7급 공무원, 경찰/소방, 임용고시" },
            ],
          },
        ],
      },
    ],
  },
];
