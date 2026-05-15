import { useState, useEffect, useCallback, useRef, useMemo } from "react";

/* ═══════════════════════════════════════════════════════
   OZKIZ Styling Board — AI-Powered Kids Fashion Coordinator
   
   Flow: Upload images → Claude auto-analyzes each image
   → category/color/style extracted → recommendations auto-generated
   ═══════════════════════════════════════════════════════ */

// ─── Constants ───
const CATEGORIES = ["상의","하의","원피스","아우터","신발","가방","모자","액세서리"];
const SEASONS = ["봄","여름","가을","겨울","사계절"];
const STYLES = ["러블리","데일리","캐주얼","스포티","프렌치","공주풍","키치","베이직","등원룩","여행룩","바캉스룩","장마룩","겨울룩"];
const COLORS_LIST = ["핑크","아이보리","화이트","블루","네이비","베이지","브라운","옐로우","민트","블랙","라벤더","레드","그린","그레이","오렌지","퍼플"];

const COLOR_PAIRS = [
  // 핑크 계열
  ["핑크","아이보리"],["핑크","화이트"],["핑크","라벤더"],["핑크","베이지"],["핑크","그레이"],["핑크","민트"],
  // 블루 계열
  ["블루","화이트"],["블루","베이지"],["블루","아이보리"],["블루","그레이"],
  // 네이비 계열
  ["네이비","아이보리"],["네이비","화이트"],["네이비","베이지"],["네이비","그레이"],["네이비","레드"],
  // 뉴트럴 계열
  ["베이지","브라운"],["베이지","화이트"],["베이지","아이보리"],["베이지","그린"],
  ["아이보리","브라운"],["아이보리","그레이"],["아이보리","라벤더"],["아이보리","민트"],
  ["화이트","그레이"],["화이트","블랙"],
  // 포인트 컬러
  ["옐로우","화이트"],["옐로우","아이보리"],["옐로우","블루"],
  ["민트","화이트"],["민트","아이보리"],
  ["라벤더","아이보리"],["라벤더","화이트"],["라벤더","그레이"],
  ["그린","베이지"],["그린","화이트"],["그린","아이보리"],
  ["퍼플","화이트"],["퍼플","아이보리"],["퍼플","라벤더"],
  ["레드","화이트"],["레드","아이보리"],["레드","네이비"],
  ["오렌지","아이보리"],["오렌지","화이트"],["오렌지","베이지"],
  ["블랙","화이트"],["블랙","그레이"],["블랙","핑크"],["블랙","레드"],
  ["그레이","핑크"],["그레이","네이비"],["그레이","블루"],["그레이","라벤더"],
];

const COMBO_TEMPLATES = [
  {cats:["상의","하의","신발"], label:"상의+하의+신발"},
];

const NAME_DATA = {
  "봄": { pre: ["싱그러운","봄날의","꽃향기","설레는","산뜻한"], suf: ["소풍룩","나들이룩","데일리룩","외출룩"] },
  "여름": { pre: ["햇살가득","시원한","청량한","반짝이는","상큼한"], suf: ["바캉스 코디","나들이룩","데일리룩","외출룩","여름 코디"] },
  "가을": { pre: ["가을감성","포근한","따스한","감성가득","낭만의"], suf: ["산책룩","데일리룩","외출룩","나들이룩"] },
  "겨울": { pre: ["포근한","따뜻한","겨울왕국","눈꽃","꿈꾸는"], suf: ["겨울 코디","산책룩","외출룩","데일리룩"] },
  "러블리": { pre: ["사랑스러운","달콤한","말랑","꿈꾸는","소녀감성"], suf: ["공주룩","파티룩","데일리룩"] },
  "캐주얼": { pre: ["자유로운","편한","쿨한","활동적인","무드있는"], suf: ["데일리룩","외출룩","등원룩"] },
  "스포티": { pre: ["활동적인","에너지넘치는","쿨한","발랄한"], suf: ["데일리룩","등원룩","외출룩"] },
  "기본": { pre: ["말랑","달콤한","반짝이는","구름같은","무지개빛","꿈꾸는"], suf: ["데일리룩","나들이룩","외출룩","등원룩"] },
};

function genName(items) {
  const kws = items.flatMap(i=>i.styleKeywords||[]);
  const season = items.find(i=>i.season&&i.season!=="사계절")?.season;
  
  // 시즌 우선, 스타일 보조
  let pool;
  if (season && NAME_DATA[season]) {
    pool = NAME_DATA[season];
  } else if (kws.includes("러블리") || kws.includes("공주풍") || kws.includes("프렌치")) {
    pool = NAME_DATA["러블리"];
  } else if (kws.includes("캐주얼") || kws.includes("데일리") || kws.includes("베이직")) {
    pool = NAME_DATA["캐주얼"];
  } else if (kws.includes("스포티")) {
    pool = NAME_DATA["스포티"];
  } else {
    pool = NAME_DATA["기본"];
  }
  
  const pre = pool.pre[Math.floor(Math.random()*pool.pre.length)];
  
  // suffix는 키워드 우선
  let suf;
  if (kws.includes("등원룩")) suf = "등원룩";
  else if (kws.includes("바캉스룩")) suf = "바캉스 코디";
  else if (kws.includes("여행룩")) suf = "여행 코디";
  else suf = pool.suf[Math.floor(Math.random()*pool.suf.length)];
  
  return `${pre} ${suf}`;
}

// ─── Utility ───
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,9);
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));

// ─── Storage ───
async function loadData(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
async function saveData(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) { console.error(e); }
}

// ─── AI Image Analysis via Claude API (with timeout + fallback) ───
let _fallbackIdx = 0;
function fallbackAnalysis() {
  const catCycle = ["상의","하의","원피스","아우터","신발","가방","모자","액세서리"];
  const cat = catCycle[_fallbackIdx % catCycle.length];
  _fallbackIdx++;
  const color = COLORS_LIST[Math.floor(Math.random() * COLORS_LIST.length)];
  const season = SEASONS[Math.floor(Math.random() * SEASONS.length)];
  const kwCount = 1 + Math.floor(Math.random() * 2);
  const shuffled = [...STYLES].sort(() => Math.random() - 0.5);
  const styleKeywords = shuffled.slice(0, kwCount);
  const name = `${color} ${cat}`;
  return { name, category: cat, color, season, styleKeywords, gender: "공용" };
}

async function analyzeImage(base64Data, fileName) {
  const TIMEOUT = 15000;
  try {
    const mediaType = base64Data.startsWith("data:image/png") ? "image/png"
      : base64Data.startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
    const raw = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    const res = await fetch("/api/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", max_tokens: 1000,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: raw } },
          { type: "text", text: `이 아동복/키즈 패션 제품 이미지를 분석해주세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력하세요.

{
  "name": "제품명 (한국어, 구체적으로. 예: 핑크 프릴 블라우스, 데님 와이드 반바지, 화이트 메리제인 슈즈)",
  "category": "카테고리 (반드시 아래 기준으로 정확하게 1개만 선택):
    - 상의: 티셔츠, 블라우스, 셔츠, 맨투맨, 후드티, 니트, 조끼, 탑, 크롭탑, 카라티 등 상체에만 입는 옷
    - 하의: 바지, 반바지, 치마, 스커트, 레깅스, 청바지, 쇼츠, 큐롯 등 하체에만 입는 옷. 치마와 스커트는 반드시 하의!
    - 원피스: 상하의가 하나로 연결된 옷 (드레스, 점프수트, 멜빵바지+상의 일체형)
    - 아우터: 자켓, 코트, 가디건, 점퍼, 바람막이 등 위에 걸쳐 입는 겉옷
    - 신발: 운동화, 구두, 샌들, 슬리퍼, 부츠, 메리제인, 슈즈 등 발에 신는 것
    - 가방: 백팩, 크로스백, 에코백, 파우치 등
    - 모자: 캡, 버킷햇, 비니, 베레모 등
    - 액세서리: 헤어밴드, 머리핀, 목걸이, 팔찌, 양말 등",
  "color": "메인 컬러 (다음 중 하나: 핑크, 아이보리, 화이트, 블루, 네이비, 베이지, 브라운, 옐로우, 민트, 블랙, 라벤더, 레드, 그린, 그레이, 오렌지, 퍼플)",
  "season": "시즌 (다음 중 하나: 봄, 여름, 가을, 겨울, 사계절). 반팔/민소매/얇은 소재 → 여름. 긴팔/두꺼운 소재/기모 → 겨울. 얇은 긴팔/가디건 → 봄 또는 가을.",
  "styleKeywords": ["스타일 키워드 배열 (다음에서 1-3개 선택: 러블리, 데일리, 캐주얼, 스포티, 프렌치, 공주풍, 키치, 베이직, 등원룩, 여행룩, 바캉스룩, 장마룩, 겨울룩)"],
  "gender": "성별 (다음 중 하나만 선택: 여아, 남아, 공용).

성별 판단 기준 (매우 중요, 반드시 따라주세요):
여아 → 다음 중 하나라도 해당하면 여아:
  - 치마, 스커트, 원피스, 드레스
  - 프릴, 러플, 레이스, 리본 장식
  - 핑크, 라벤더, 퍼플 컬러가 메인
  - 꽃무늬, 하트, 나비, 공주풍 패턴
  - 메리제인 슈즈, 발레 슈즈
  
남아 → 다음 중 하나라도 해당하면 남아:
  - 공룡, 자동차, 로봇, 상어, 우주 패턴
  - 밀리터리, 카모플라주 패턴
  - 스포츠 로고, 축구/야구 관련
  
공용 → 위 조건 어디에도 해당하지 않는 경우만 공용:
  - 무지 티셔츠 (흰색, 검정, 회색 등 무채색)
  - 기본 데님 팬츠
  - 기본 운동화/스니커즈"
}

중요:
1. 치마/스커트는 반드시 '하의'로 분류
2. 치마/스커트/프릴/리본이 있으면 반드시 '여아'로 분류
3. category와 gender를 정확하게 판단해주세요` }
        ]}],
      })
    });
    clearTimeout(timer);
    const data = await res.json();
    const text = (data.content || []).map(b => b.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    const GENDERS_VALID = ["여아","남아","공용"];
    return {
      name: parsed.name || "아동복 제품",
      category: CATEGORIES.includes(parsed.category) ? parsed.category : "",
      color: COLORS_LIST.includes(parsed.color) ? parsed.color : "",
      season: SEASONS.includes(parsed.season) ? parsed.season : "사계절",
      styleKeywords: (parsed.styleKeywords || []).filter(k => STYLES.includes(k)),
      gender: GENDERS_VALID.includes(parsed.gender) ? parsed.gender : "공용",
      aiAnalyzed: true,
    };
  } catch (err) {
    console.warn("AI analysis failed, using fallback:", err.message);
    return { ...fallbackAnalysis(), aiAnalyzed: false };
  }
}

// ─── Recommendation Engine ───
function colorsMatch(a, b) {
  return COLOR_PAIRS.some(([x,y]) => (x===a&&y===b)||(x===b&&y===a));
}

// Colors that truly clash (hard reject)
const COLOR_CLASH = [
  ["핑크","그린"],["핑크","오렌지"],["레드","핑크"],["레드","오렌지"],
  ["블루","브라운"],["네이비","브라운"],["옐로우","라벤더"],["옐로우","퍼플"],
  ["민트","오렌지"],["레드","그린"],
];
function colorsClash(a,b) { return COLOR_CLASH.some(([x,y])=>(x===a&&y===b)||(x===b&&y===a)); }

function scoreCombo(items) {
  let s = 0;
  
  // ── 카테고리 중복 → 즉시 탈락 ──
  const cats = items.map(i=>i.category).filter(Boolean);
  if (new Set(cats).size < cats.length) return 0;

  // ── 성별 매칭 (필수) ──
  const genders = items.map(i=>i.gender).filter(Boolean);
  const hasGirl = genders.includes("여아");
  const hasBoy = genders.includes("남아");
  if (hasGirl && hasBoy) return 0; // 남아+여아 혼합 → 탈락

  // ── 컬러 매칭 ──
  const cols = items.map(i=>i.color).filter(Boolean);
  if (cols.length >= 2) {
    // 확실히 안 어울리는 컬러 조합 → 탈락
    for (let i=0;i<cols.length;i++)
      for (let j=i+1;j<cols.length;j++)
        if (colorsClash(cols[i],cols[j])) return 0;
    
    // 잘 어울리는 컬러 → 높은 가점
    let bestColor = 0;
    for (let i=0;i<cols.length;i++)
      for (let j=i+1;j<cols.length;j++) {
        if (cols[i]===cols[j]) bestColor = Math.max(bestColor, 20); // 동일 컬러
        else if (colorsMatch(cols[i],cols[j])) bestColor = Math.max(bestColor, 30); // 궁합 좋은 컬러
        else bestColor = Math.max(bestColor, 5); // 클래시는 아니지만 매칭 테이블에 없음
      }
    s += bestColor;
  } else {
    s += 10; // 컬러 정보 부족 → 기본점
  }

  // ── 시즌 매칭 ──
  const seasons = items.map(i=>i.season).filter(Boolean);
  const realSeasons = seasons.filter(x=>x!=="사계절");
  const uqSeasons = [...new Set(realSeasons)];
  if (uqSeasons.length > 1) {
    // 봄+여름, 가을+겨울은 허용 (인접 시즌)
    const adjacent = (uqSeasons.includes("봄")&&uqSeasons.includes("여름")) || (uqSeasons.includes("가을")&&uqSeasons.includes("겨울"));
    if (!adjacent) return 0; // 봄+겨울 같은 건 탈락
    s += 10;
  } else {
    s += 25; // 같은 시즌
  }

  // ── 스타일 키워드 매칭 ──
  const kwAll = items.flatMap(i=>i.styleKeywords||[]);
  const kwCnt = {};
  kwAll.forEach(k => kwCnt[k]=(kwCnt[k]||0)+1);
  const sharedKw = Object.values(kwCnt).filter(v=>v>1).length;
  if (sharedKw > 0) s += Math.min(sharedKw * 12, 25);
  else if (kwAll.length > 0) s += 5; // 키워드는 있지만 겹치지 않음
  
  // ── 카테고리 조합 가점 ──
  if (cats.length >= 2) s += 15;

  return clamp(Math.round(s), 0, 100);
}


function genReason(items) {
  const cols = items.map(i=>i.color).filter(Boolean);
  const kws = [...new Set(items.flatMap(i=>i.styleKeywords||[]))];
  const seasons = items.map(i=>i.season).filter(s=>s&&s!=="사계절");
  const reasons = [];

  // Color harmony explanation
  if (cols.length >= 2) {
    if (cols[0]===cols[1]) {
      reasons.push(`${cols[0]} 톤온톤 매칭으로 통일감이 있어요`);
    } else {
      const warmCols = ["핑크","아이보리","베이지","브라운","옐로우","오렌지","레드"];
      const coolCols = ["블루","네이비","민트","라벤더","퍼플","그린"];
      const bothWarm = cols.every(c=>warmCols.includes(c));
      const bothCool = cols.every(c=>coolCols.includes(c));
      if (colorsMatch(cols[0],cols[1])) {
        if (bothWarm) reasons.push(`${cols[0]}과 ${cols[1]}의 따뜻한 컬러 조합이 사랑스러워요`);
        else if (bothCool) reasons.push(`${cols[0]}과 ${cols[1]}의 시원한 컬러 조합이 세련돼요`);
        else reasons.push(`${cols[0]}과 ${cols[1]} 컬러가 부드럽게 어울려요`);
      }
    }
  }
  if (kws.length > 0) reasons.push(`${kws.slice(0,2).join(", ")} 분위기가 잘 맞아요`);
  if (seasons.length > 0) reasons.push(`${seasons[0]} 시즌에 딱 맞는 조합이에요`);
  const cats = items.map(i=>i.category).filter(Boolean);
  if (cats.includes("신발")) reasons.push("슈즈까지 매칭해서 완성도를 높였어요");
  return reasons.length ? reasons.join(". ")+"." : "자연스러운 조합이에요.";
}

// Check if a set of categories forms a valid outfit
function isValidOutfit(cats) {
  const catSet = new Set(cats);
  // 같은 복종 중복 → 무조건 불가
  if (catSet.size < cats.length) return false;
  
  const has = (c) => catSet.has(c);
  // 반드시 상의+하의 포함
  if (!has("상의") || !has("하의")) return false;
  // 반드시 신발 포함
  if (!has("신발")) return false;
  
  return true;
}

function recommend(products) {
  const ready = products.filter(p => p.category && p.status === "done");
  if (ready.length < 2) return [];
  const byCat = {};
  ready.forEach(p => { if (!byCat[p.category]) byCat[p.category]=[]; byCat[p.category].push(p); });

  const all = [];
  const seen = new Set();

  // Template-based combos — each category slot picks exactly 1 product
  for (const tpl of COMBO_TEMPLATES) {
    if (!tpl.cats.every(c => byCat[c]?.length > 0)) continue;
    if (!isValidOutfit(tpl.cats)) continue;
    const arrs = tpl.cats.map(c => byCat[c]);
    const limit = Math.min(arrs.reduce((a,c)=>a*c.length,1), 80);
    for (let attempt = 0; attempt < limit; attempt++) {
      const pick = arrs.map(arr => arr[Math.floor(Math.random()*arr.length)]);
      const pickIds = pick.map(p=>p.id);
      // 같은 제품이 중복 선택 방지
      if (new Set(pickIds).size < pickIds.length) continue;
      // 같은 카테고리 중복 방지 (최종 검증)
      const pickCats = pick.map(p=>p.category);
      if (new Set(pickCats).size < pickCats.length) continue;
      const key = pickIds.sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      const sc = scoreCombo(pick);
      if (sc >= 60) {
        all.push({ id: uid(), products: pick, score: sc, name: genName(pick), reason: genReason(pick),
          template: tpl.label });
      }
    }
  }
  
  // Fallback: try to build combos with shoes included
  if (all.length < 5) {
    const shoeProducts = ready.filter(p => p.category === "신발");
    
    for (let i=0;i<ready.length;i++)
      for (let j=i+1;j<ready.length;j++) {
        if (ready[i].category === ready[j].category) continue;
        const pair = [ready[i], ready[j]];
        const pairCats = pair.map(p=>p.category);
        if (!isValidOutfit(pairCats)) continue;
        
        // Try adding a shoe to make a 3-piece combo
        if (!pairCats.includes("신발") && shoeProducts.length > 0) {
          for (const shoe of shoeProducts) {
            if (pair.some(p => p.id === shoe.id)) continue;
            const trio = [...pair, shoe];
            const trioCats = trio.map(p=>p.category);
            if (new Set(trioCats).size < trioCats.length) continue;
            const key = trio.map(p=>p.id).sort().join("|");
            if (seen.has(key)) continue;
            seen.add(key);
            const sc = scoreCombo(trio);
            if (sc >= 55) {
              all.push({ id: uid(), products: trio, score: sc, name: genName(trio), reason: genReason(trio),
                template: "커스텀 매칭" });
            }
          }
        }
        
        // Allow 2-piece only if it already includes shoes (원피스+신발 etc.)
        if (pairCats.includes("신발")) {
          const key = pair.map(p=>p.id).sort().join("|");
          if (seen.has(key)) continue;
          seen.add(key);
          const sc = scoreCombo(pair);
          if (sc >= 35) {
            all.push({ id: uid(), products: pair, score: sc, name: genName(pair), reason: genReason(pair),
              template: "커스텀 매칭" });
          }
        }
      }
  }

  // 최종 안전장치: 반드시 상의+하의+신발 3개 조합만 허용
  const clean = all.filter(c => {
    if (c.products.length !== 3) return false;
    const cats = c.products.map(p => p.category);
    if (new Set(cats).size < cats.length) return false;
    if (!cats.includes("상의")) return false;
    if (!cats.includes("하의")) return false;
    if (!cats.includes("신발")) return false;
    return true;
  });

  clean.sort((a,b) => b.score - a.score);
  return clean.slice(0, 12);
}

// ═══════════════ COMPONENTS ═══════════════

const I = ({children, sz=20, ...p}) => <svg xmlns="http://www.w3.org/2000/svg" width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>{children}</svg>;
const IcoUpload = (p) => <I {...p}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></I>;
const IcoList = (p) => <I {...p}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r=".7" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r=".7" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r=".7" fill="currentColor" stroke="none"/></I>;
const IcoStar = (p) => <I {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></I>;
const IcoEdit = (p) => <I {...p}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></I>;
const IcoSave = (p) => <I {...p}><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></I>;
const IcoX = (p) => <I {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></I>;
const IcoTrash = (p) => <I {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></I>;
const IcoCheck = (p) => <I {...p}><polyline points="20 6 9 17 4 12"/></I>;
const IcoFilter = (p) => <I {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></I>;
const IcoSearch = (p) => <I {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></I>;
const IcoHeart = (p) => <I {...p}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></I>;
const IcoRefresh = (p) => <I {...p}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></I>;
const IcoSparkle = (p) => <I {...p}><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></I>;

// ── Small UI pieces ──
function Badge({children, color="rose"}) {
  const m = { rose:"bg-rose-50 text-rose-600 ring-rose-200", amber:"bg-amber-50 text-amber-600 ring-amber-200",
    emerald:"bg-emerald-50 text-emerald-600 ring-emerald-200", gray:"bg-gray-100 text-gray-500 ring-gray-200",
    violet:"bg-violet-50 text-violet-600 ring-violet-200", sky:"bg-sky-50 text-sky-600 ring-sky-200",
    orange:"bg-orange-50 text-orange-600 ring-orange-200" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${m[color]||m.gray}`}>{children}</span>;
}
function ScoreBadge({score}) { return <Badge color={score>=75?"emerald":score>=50?"amber":"gray"}>⭐ {score}점</Badge>; }
function Btn({children, variant="primary", size="md", className="", ...p}) {
  const base = "inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl transition-all active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none";
  const sz = {sm:"px-3 py-1.5 text-xs", md:"px-4 py-2 text-sm", lg:"px-5 py-2.5 text-sm"};
  const vr = { primary:"bg-rose-500 text-white hover:bg-rose-600 shadow-sm shadow-rose-200",
    secondary:"bg-gray-100 text-gray-600 hover:bg-gray-200", ghost:"text-gray-500 hover:bg-gray-100",
    danger:"text-red-500 hover:bg-red-50", outline:"border border-gray-200 text-gray-600 hover:border-rose-300 hover:text-rose-600" };
  return <button className={`${base} ${sz[size]} ${vr[variant]} ${className}`} {...p}>{children}</button>;
}
function Select({options, value, onChange, placeholder="선택", label, className=""}) {
  return (<div className={className}>{label && <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>}
    <select value={value||""} onChange={e=>onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300 transition appearance-none cursor-pointer"
      style={{backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,backgroundRepeat:"no-repeat",backgroundPosition:"right 10px center"}}>
      <option value="">{placeholder}</option>{options.map(o=><option key={o} value={o}>{o}</option>)}
    </select></div>);
}
function Input({label, className="", ...p}) {
  return (<div className={className}>{label && <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>}
    <input {...p} className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300 transition"/></div>);
}
function TagSelect({options, selected=[], onChange, label}) {
  const toggle = v => onChange(selected.includes(v)?selected.filter(s=>s!==v):[...selected,v]);
  return (<div>{label && <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</label>}
    <div className="flex flex-wrap gap-1.5">{options.map(o => {
      const on = selected.includes(o);
      return <button key={o} type="button" onClick={()=>toggle(o)}
        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${on?"bg-rose-500 text-white border-rose-500":"bg-white text-gray-500 border-gray-200 hover:border-rose-300"}`}>{o}</button>;
    })}</div></div>);
}
function Empty({emoji="📦",title,sub,action,onAction}) {
  return (<div className="flex flex-col items-center justify-center py-20 select-none">
    <div className="text-5xl mb-4 opacity-80">{emoji}</div>
    <p className="text-sm font-semibold text-gray-500 mb-1">{title}</p>
    {sub && <p className="text-xs text-gray-400 mb-4 text-center max-w-xs leading-relaxed">{sub}</p>}
    {action && <Btn onClick={onAction} size="sm">{action}</Btn>}
  </div>);
}

// ─── Product Card with AI status ───
function ProductCard({product:p, onClick, selectable, selected, onToggle}) {
  const analyzing = p.status === "analyzing";
  const failed = p.status === "failed";
  return (
    <div onClick={onClick}
      className={`group relative rounded-2xl overflow-hidden cursor-pointer transition-all border-2 ${
        selected ? "border-rose-400 shadow-lg shadow-rose-100/60 scale-[1.02]"
        : analyzing ? "border-orange-200 shadow-sm"
        : "border-transparent hover:border-rose-200 shadow-sm hover:shadow-md"
      } bg-white`}>
      {selectable && (
        <button onClick={e=>{e.stopPropagation();onToggle?.()}}
          className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all border-2 ${
            selected?"bg-rose-500 border-rose-500 text-white":"bg-white/90 border-gray-300 text-transparent hover:border-rose-400"
          }`}><IcoCheck sz={13}/></button>
      )}
      {/* AI status overlay */}
      {analyzing && (
        <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[2px] flex flex-col items-center justify-center">
          <div className="w-7 h-7 border-2 border-rose-400 border-t-transparent rounded-full animate-spin mb-2"/>
          <p className="text-[10px] font-bold text-rose-500">AI 분석중...</p>
        </div>
      )}
      {p.status === "done" && p.aiAnalyzed === false && (
        <div className="absolute top-2 right-2 z-10">
          <span className="text-[9px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-bold">자동 분류</span>
        </div>
      )}
      <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
        {p.imageData ? <img src={p.imageData} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
          : <div className="w-full h-full flex items-center justify-center text-3xl opacity-20 select-none">👗</div>}
      </div>
      <div className="p-2.5">
        <p className="text-xs font-bold text-gray-800 truncate">{p.name || "분석 대기중..."}</p>
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {p.category && <Badge color="rose">{p.category}</Badge>}
          {p.color && <Badge color="violet">{p.color}</Badge>}
          {p.season && p.season !== "사계절" && <Badge color="sky">{p.season}</Badge>}
          {p.gender && p.gender !== "공용" && <Badge color={p.gender==="여아"?"rose":"sky"}>{p.gender}</Badge>}
        </div>
        {(p.styleKeywords||[]).length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {p.styleKeywords.slice(0,2).map(k => <span key={k} className="text-[9px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-500 font-medium">{k}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Product Edit Modal (optional override) ───
function ProductModal({product, onSave, onClose, onDelete}) {
  const [f, setF] = useState({...product});
  const u = (k,v) => setF(prev=>({...prev,[k]:v}));
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/25 backdrop-blur-sm"/>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="sticky top-0 bg-white/90 backdrop-blur-md z-10 flex items-center justify-between px-6 py-4 border-b border-gray-100 rounded-t-3xl">
          <h3 className="text-base font-bold text-gray-800">제품 정보</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 transition"><IcoX sz={18}/></button>
        </div>
        <div className="p-6 space-y-5">
          {f.imageData && <div className="w-full h-52 rounded-2xl overflow-hidden bg-gray-50"><img src={f.imageData} alt="" className="w-full h-full object-contain"/></div>}
          {f.status === "analyzing" && (
            <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-xl">
              <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"/>
              <span className="text-xs text-orange-600 font-medium">AI가 이미지를 분석하고 있어요...</span>
            </div>
          )}
          {f.status === "done" && f.aiAnalyzed && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl">
              <IcoCheck sz={16} style={{color:"#059669"}}/>
              <span className="text-xs text-emerald-600 font-medium">AI 분석 완료! 아래 정보를 수정할 수 있어요</span>
            </div>
          )}
          {f.status === "done" && f.aiAnalyzed === false && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl">
              <IcoCheck sz={16} style={{color:"#d97706"}}/>
              <span className="text-xs text-amber-600 font-medium">자동 분류됨 · 카드를 클릭해 정보를 수정할 수 있어요</span>
            </div>
          )}
          <Input label="제품명" value={f.name||""} onChange={e=>u("name",e.target.value)} placeholder="제품명"/>
          <div className="grid grid-cols-2 gap-4">
            <Select label="카테고리" options={CATEGORIES} value={f.category} onChange={v=>u("category",v)}/>
            <Select label="컬러" options={COLORS_LIST} value={f.color} onChange={v=>u("color",v)}/>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="시즌" options={SEASONS} value={f.season} onChange={v=>u("season",v)}/>
          </div>
          <TagSelect label="스타일 키워드" options={STYLES} selected={f.styleKeywords||[]} onChange={v=>u("styleKeywords",v)}/>
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">메모</label>
            <textarea value={f.memo||""} onChange={e=>u("memo",e.target.value)} rows={2} placeholder="메모"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-200 resize-none"/>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white/90 backdrop-blur-md flex items-center justify-between px-6 py-4 border-t border-gray-100 rounded-b-3xl">
          <Btn variant="danger" size="sm" onClick={()=>{onDelete(product.id);onClose()}}><IcoTrash sz={14}/> 삭제</Btn>
          <div className="flex gap-2">
            <Btn variant="secondary" size="sm" onClick={onClose}>취소</Btn>
            <Btn size="sm" onClick={()=>{onSave({...f, status: f.status === "analyzing" ? "analyzing" : "done"});onClose()}}>저장</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Coord gender helper ───
function coordGender(products) {
  const genders = products.map(p=>p.gender).filter(Boolean);
  const hasGirl = genders.includes("여아");
  const hasBoy = genders.includes("남아");
  if (hasGirl && !hasBoy) return "여아";
  if (hasBoy && !hasGirl) return "남아";
  if (hasGirl && hasBoy) return "공용";
  return "공용";
}
function GenderBadge({products}) {
  const g = coordGender(products);
  if (g === "여아") return <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 text-pink-600 ring-1 ring-pink-200">👧 여아</span>;
  if (g === "남아") return <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-600 ring-1 ring-blue-200">👦 남아</span>;
  return <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 ring-1 ring-gray-200">👶 공용</span>;
}

// ─── Coord Card ───
function CoordCard({coord:c, onDetail, onSave, onDelete, isSaved}) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 group border border-gray-100/80">
      <div className={`grid gap-[2px] bg-gray-200/50 ${c.products.length>=3?"grid-cols-3":"grid-cols-2"}`}>
        {c.products.slice(0,3).map((p,i) => (
          <div key={p.id+"-"+i} className="aspect-square overflow-hidden bg-white">
            {p.imageData ? <img src={p.imageData} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
              : <div className="w-full h-full flex items-center justify-center bg-gray-50 text-xl opacity-20">👗</div>}
          </div>
        ))}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="text-sm font-bold text-gray-800 leading-snug flex-1">{c.name}</h4>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <GenderBadge products={c.products}/>
            <ScoreBadge score={c.score}/>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          {c.products.map((p,i) => <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-lg bg-gray-50 text-gray-500 font-medium">{p.name||p.category||"제품"}</span>)}
        </div>
        <p className="text-xs text-gray-400 leading-relaxed mb-3 line-clamp-2">{c.reason}</p>
        <div className="flex items-center justify-between">
          <button onClick={()=>onDetail(c)} className="text-[11px] text-rose-500 hover:text-rose-600 font-semibold transition">상세보기 →</button>
          <div className="flex gap-1">
            <button onClick={async()=>{const d=await generateLookbookImage(c);const a=document.createElement("a");a.download=`${c.name.replace(/\s+/g,"_")}_lookbook.png`;a.href=d;document.body.appendChild(a);a.click();document.body.removeChild(a);}} className="p-1.5 rounded-lg hover:bg-violet-50 text-violet-400 transition" title="룩북 이미지 저장"><IcoDownload sz={15}/></button>
            {isSaved
              ? <button onClick={()=>onDelete(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition" title="삭제"><IcoTrash sz={15}/></button>
              : <button onClick={()=>onSave(c)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-400 transition" title="저장"><IcoSave sz={15}/></button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Lookbook Image Generator (Canvas API) ───
function generateLookbookImage(coord) {
  return new Promise((resolve) => {
    const W = 1080, H = 1440; // Instagram-friendly ratio
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#FFF7F5");
    grad.addColorStop(0.5, "#FFFFFF");
    grad.addColorStop(1, "#FFF0ED");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Subtle pattern dots
    ctx.fillStyle = "rgba(244,63,94,0.03)";
    for (let x = 0; x < W; x += 30) for (let y = 0; y < H; y += 30) {
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    }

    // Header area
    ctx.fillStyle = "#1f2937";
    ctx.font = "bold 22px 'Pretendard Variable','Noto Sans KR',sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("OZKIZ", 60, 70);
    ctx.fillStyle = "#f43f5e";
    ctx.font = "bold 12px 'Pretendard Variable','Noto Sans KR',sans-serif";
    ctx.fillText("STYLING BOARD", 60, 90);

    // Score badge
    ctx.fillStyle = coord.score >= 75 ? "#ecfdf5" : coord.score >= 50 ? "#fffbeb" : "#f3f4f6";
    const scoreText = `⭐ ${coord.score}점`;
    ctx.beginPath();
    roundRect(ctx, W - 160, 52, 100, 32, 16);
    ctx.fill();
    ctx.fillStyle = coord.score >= 75 ? "#059669" : coord.score >= 50 ? "#d97706" : "#6b7280";
    ctx.font = "bold 14px 'Pretendard Variable','Noto Sans KR',sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(scoreText, W - 110, 73);

    // Coord name
    ctx.textAlign = "left";
    ctx.fillStyle = "#1f2937";
    ctx.font = "bold 36px 'Pretendard Variable','Noto Sans KR',sans-serif";
    ctx.fillText(coord.name, 60, 150);

    // Reason
    ctx.fillStyle = "#9ca3af";
    ctx.font = "400 16px 'Pretendard Variable','Noto Sans KR',sans-serif";
    const reasonLines = wrapText(ctx, coord.reason, W - 120);
    reasonLines.forEach((line, i) => ctx.fillText(line, 60, 185 + i * 24));

    const productsY = 185 + reasonLines.length * 24 + 30;

    // Load all product images
    const imgPromises = coord.products.map(p => {
      return new Promise(res => {
        if (!p.imageData) return res(null);
        const im = new Image();
        im.crossOrigin = "anonymous";
        im.onload = () => res(im);
        im.onerror = () => res(null);
        im.src = p.imageData;
      });
    });

    Promise.all(imgPromises).then(images => {
      const count = images.length;
      const gap = 20;
      const totalW = W - 120;

      // Layout: if 2 items side by side, if 3 in a row, if 4 in 2x2
      let cols, rows;
      if (count <= 2) { cols = count; rows = 1; }
      else if (count === 3) { cols = 3; rows = 1; }
      else { cols = 2; rows = 2; }

      const cellW = Math.floor((totalW - (cols - 1) * gap) / cols);
      const cellH = Math.min(cellW, Math.floor((H - productsY - 200) / rows - gap));

      coord.products.forEach((p, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 60 + col * (cellW + gap);
        const y = productsY + row * (cellH + gap + 60);

        // Card background
        ctx.fillStyle = "#FFFFFF";
        ctx.shadowColor = "rgba(0,0,0,0.06)";
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 4;
        ctx.beginPath();
        roundRect(ctx, x, y, cellW, cellH + 50, 20);
        ctx.fill();
        ctx.shadowColor = "transparent";

        // Image
        if (images[i]) {
          ctx.save();
          ctx.beginPath();
          roundRect(ctx, x + 8, y + 8, cellW - 16, cellH - 16, 14);
          ctx.clip();
          const img = images[i];
          const scale = Math.max((cellW - 16) / img.width, (cellH - 16) / img.height);
          const dw = img.width * scale, dh = img.height * scale;
          ctx.drawImage(img, x + 8 + (cellW - 16 - dw) / 2, y + 8 + (cellH - 16 - dh) / 2, dw, dh);
          ctx.restore();
        } else {
          ctx.fillStyle = "#f3f4f6";
          ctx.beginPath();
          roundRect(ctx, x + 8, y + 8, cellW - 16, cellH - 16, 14);
          ctx.fill();
        }

        // Product name below image
        ctx.fillStyle = "#374151";
        ctx.font = "bold 14px 'Pretendard Variable','Noto Sans KR',sans-serif";
        ctx.textAlign = "left";
        const label = p.name || p.category || "제품";
        ctx.fillText(label.length > 12 ? label.slice(0,12)+"…" : label, x + 12, y + cellH + 8);

        // Category + color tags
        ctx.fillStyle = "#f43f5e";
        ctx.font = "600 11px 'Pretendard Variable','Noto Sans KR',sans-serif";
        const tagText = [p.category, p.color].filter(Boolean).join(" · ");
        ctx.fillText(tagText, x + 12, y + cellH + 28);
      });

      // Footer
      const footerY = H - 70;
      ctx.fillStyle = "rgba(244,63,94,0.06)";
      ctx.fillRect(0, footerY - 10, W, 80);

      ctx.fillStyle = "#d1d5db";
      ctx.font = "400 11px 'Pretendard Variable','Noto Sans KR',sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("OZKIZ Styling Board", W - 60, footerY + 30);

      resolve(canvas.toDataURL("image/png"));
    });
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function wrapText(ctx, text, maxW) {
  const words = text.split("");
  const lines = [];
  let line = "";
  for (const ch of words) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line.length > 0) {
      lines.push(line);
      line = ch;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

const IcoDownload = (p) => <I {...p}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></I>;


// ─── Accessory Shopping Recommender ───
// Analyzes coord → generates shopping search links for matching accessories
function AccessoryRecommender({ products }) {
  const [recs, setRecs] = useState(null);
  const [loading, setLoading] = useState(false);

  // Summarize coord info for prompt
  const coordSummary = products.map(p => 
    `${p.category}: ${p.name||"제품"} (컬러:${p.color||"미정"}, 스타일:${(p.styleKeywords||[]).join("/")||"미정"}, 시즌:${p.season||"미정"}, 성별:${p.gender||"공용"})`
  ).join("\n");
  const mainColors = products.map(p=>p.color).filter(Boolean);
  const mainStyles = [...new Set(products.flatMap(p=>p.styleKeywords||[]))];
  const season = products.map(p=>p.season).find(s=>s&&s!=="사계절")||"사계절";
  const gender = products.find(p=>p.gender&&p.gender!=="공용")?.gender || "공용";

  const generate = async () => {
    setLoading(true);
    try {
      const content = [];
      products.forEach(p => {
        if (p.imageData) {
          const mt = p.imageData.startsWith("data:image/png") ? "image/png" : "image/jpeg";
          content.push({ type: "image", source: { type: "base64", media_type: mt, data: p.imageData.replace(/^data:image\/\w+;base64,/, "") } });
        }
      });
      content.push({ type: "text", text: `아동복 코디 구성:
${coordSummary}

메인 컬러: ${mainColors.join(", ")||"미정"}
스타일: ${mainStyles.join(", ")||"미정"}
시즌: ${season}
성별: ${gender}

이 코디에 컬러와 스타일이 잘 어울리는 악세서리를 추천해주세요.

중요한 규칙:
1. 악세서리 컬러는 반드시 코디의 메인 컬러(${mainColors.join(", ")})와 어울려야 합니다
   - 같은 컬러 또는 톤온톤 매칭
   - 또는 보색/조화 컬러 (예: 핑크옷→아이보리/화이트 악세서리, 네이비옷→화이트/베이지 악세서리)
2. 시즌(${season})에 맞는 소재와 스타일이어야 합니다
   - 여름: 시원한 소재, 밀짚모자, 샌들, 메쉬양말
   - 겨울: 따뜻한 소재, 니트비니, 부츠, 기모양말
3. 성별(${gender})에 맞아야 합니다
4. keyword는 네이버 쇼핑에서 실제로 검색되는 구체적인 한국어 검색어

아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만.

[
  { "type": "모자", "emoji": "🧢", "keyword": "네이버쇼핑 검색어", "reason": "이 코디와 어울리는 이유 (컬러 매칭 포인트 포함)" },
  { "type": "헤어악세서리", "emoji": "🎀", "keyword": "검색어", "reason": "이유" },
  { "type": "가방", "emoji": "👜", "keyword": "검색어", "reason": "이유" },
  { "type": "양말", "emoji": "🧦", "keyword": "검색어", "reason": "이유" }
]` });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content }] })
      });
      clearTimeout(timer);
      const data = await res.json();
      const text = (data.content||[]).map(b=>b.text||"").join("").trim();
      setRecs(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch(e) {
      console.warn("Shopping rec failed, using fallback:", e);
      
      // 컬러 조화 맵: 메인컬러 → 어울리는 악세서리 컬러
      const harmonyMap = {
        "핑크": "아이보리", "아이보리": "베이지", "화이트": "베이지",
        "블루": "화이트", "네이비": "화이트", "베이지": "브라운",
        "브라운": "베이지", "옐로우": "화이트", "민트": "화이트",
        "블랙": "화이트", "라벤더": "아이보리", "레드": "화이트",
        "그린": "베이지", "그레이": "화이트", "오렌지": "아이보리", "퍼플": "화이트",
      };
      const c1 = mainColors[0]||"화이트";
      const accColor = harmonyMap[c1] || "화이트";
      const isLovely = mainStyles.some(k=>["러블리","공주풍","프렌치"].includes(k));
      const isBoy = gender === "남아";
      const isSummer = season === "여름";
      const isWinter = season === "겨울";
      
      setRecs([
        { type:"모자", emoji:"🧢",
          keyword: isSummer ? `키즈 ${accColor} 밀짚모자 여름` : isWinter ? `아동 ${accColor} 니트 비니` : isLovely ? `아동 ${accColor} 프릴 보닛햇` : `키즈 ${accColor} 버킷햇`,
          reason: `${c1} 코디에 ${accColor} 모자로 톤 매칭` },
        { type:"헤어악세서리", emoji:"🎀",
          keyword: isBoy ? `남아 ${c1} 스포츠 헤어밴드` : isLovely ? `여아 ${c1} 새틴 리본 헤어밴드` : `키즈 ${c1} 헤어핀 세트`,
          reason: `${c1} 컬러 포인트로 통일감을 줘요` },
        { type:"가방", emoji:"👜",
          keyword: isBoy ? `남아 ${accColor} 크로스백` : isLovely ? `여아 ${accColor} 미니 크로스백 리본` : `아동 ${accColor} 미니백`,
          reason: `${accColor} 가방으로 ${c1} 코디와 조화롭게` },
        { type:"양말", emoji:"🧦",
          keyword: isSummer ? `키즈 ${accColor} 페이크삭스` : isWinter ? `아동 ${accColor} 기모 타이즈` : isLovely ? `여아 ${accColor} 프릴 양말` : `키즈 ${accColor} 크루삭스`,
          reason: `${accColor} 양말로 슈즈와 자연스럽게 연결` },
      ]);
    }
    setLoading(false);
  };

  const productKey = products.map(p=>p.id).join("|");
  useEffect(() => { setRecs(null); generate(); }, [productKey]);

  const naverUrl = (kw) => `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(kw)}`;

  if (loading) return (
    <div className="flex items-center gap-3 p-4 bg-violet-50/50 rounded-2xl border border-violet-100">
      <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin flex-shrink-0"/>
      <div>
        <p className="text-xs font-bold text-violet-700">코디에 어울리는 악세서리를 찾고 있어요...</p>
        <p className="text-[10px] text-violet-400">{mainColors.join("+")} 컬러에 맞는 제품을 검색하는 중</p>
      </div>
    </div>
  );

  if (!recs) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🛍️</span>
          <p className="text-sm font-bold text-gray-800">이 코디에 어울리는 악세서리</p>
        </div>
        <button onClick={generate} className="text-[10px] text-gray-400 hover:text-gray-600 font-medium transition flex items-center gap-1">🔄 다시 찾기</button>
      </div>
      <div className="space-y-2">
        {recs.map((r,i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-100 hover:border-rose-200 hover:shadow-sm transition-all">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-50 to-orange-50 flex items-center justify-center text-lg flex-shrink-0">{r.emoji||"✨"}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[11px] font-bold text-gray-700">{r.type}</span>
              </div>
              <p className="text-[10px] text-gray-400 mb-0.5">{r.reason}</p>
              <p className="text-[11px] text-rose-500 font-medium truncate">🔍 {r.keyword}</p>
            </div>
            <a href={naverUrl(r.keyword)} target="_blank" rel="noopener noreferrer"
              className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-[11px] font-bold hover:bg-emerald-600 transition-all shadow-sm shadow-emerald-200/50 no-underline">
              쇼핑하기
            </a>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-300 text-center mt-2">네이버 쇼핑으로 연결됩니다</p>
    </div>
  );
}

// ─── Coord Detail Modal with Accessory Recs + Lookbook Export ───
function CoordDetail({coord:c, onClose, onSave, isSaved}) {
  const [exporting, setExporting] = useState(false);

  if (!c) return null;

  const handleExport = async () => {
    setExporting(true);
    try {
      const dataUrl = await generateLookbookImage(c);
      const link = document.createElement("a");
      link.download = `${c.name.replace(/\s+/g,"_")}_lookbook.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch(e) { console.error(e); }
    setExporting(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/25 backdrop-blur-sm"/>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="sticky top-0 bg-white/90 backdrop-blur-md z-10 flex items-center justify-between px-6 py-4 border-b border-gray-100 rounded-t-3xl">
          <h3 className="text-base font-bold text-gray-800">{c.name}</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400"><IcoX sz={18}/></button>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <ScoreBadge score={c.score}/><GenderBadge products={c.products}/><Badge color="gray">{c.template||"조합"}</Badge>
            {c.manual && <Badge color="sky">직접 구성</Badge>}
          </div>

          {/* Products */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            {c.products.map((p,i) => (
              <div key={i} className="rounded-2xl border border-gray-100 overflow-hidden bg-white">
                <div className="aspect-square overflow-hidden bg-gray-50">
                  {p.imageData ? <img src={p.imageData} alt={p.name} className="w-full h-full object-cover"/>
                    : <div className="w-full h-full flex items-center justify-center text-2xl opacity-20">👗</div>}
                </div>
                <div className="p-3">
                  <p className="text-sm font-bold text-gray-700 truncate">{p.name||"제품"}</p>
                  <div className="flex gap-1 mt-1">
                    {p.category && <Badge color="rose">{p.category}</Badge>}
                    {p.color && <Badge color="violet">{p.color}</Badge>}
                    {p.season && p.season!=="사계절" && <Badge color="sky">{p.season}</Badge>}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5">{[...(p.styleKeywords||[])].join(", ")}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Recommendation reason */}
          <div className="bg-gradient-to-r from-rose-50/80 to-orange-50/50 rounded-2xl p-5 mb-5">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">추천 이유</p>
            <p className="text-sm text-gray-700 leading-relaxed">{c.reason}</p>
          </div>

          {/* AI Accessory Recommendations */}
          <div className="mb-5">
            <AccessoryRecommender key={c.id} products={c.products}/>
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-3">
            {!isSaved && (
              <Btn className="flex-1" onClick={()=>{onSave(c);onClose()}}><IcoHeart sz={16}/> 코디 저장</Btn>
            )}
            <Btn variant="outline" className="flex-1" onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <><div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/> 생성중...</>
              ) : (
                <><IcoDownload sz={16}/> 룩북 이미지 저장</>
              )}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Filter Bar ───
function FilterBar({filters:f, onChange}) {
  const [open, setOpen] = useState(false);
  const cnt = [f.season,f.category,f.color,f.style,f.gender].filter(Boolean).length;
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2">
        <Btn variant={cnt?"primary":"outline"} size="sm" onClick={()=>setOpen(!open)}><IcoFilter sz={14}/> 필터 {cnt>0&&<span className="bg-white/20 text-[10px] px-1.5 rounded-full ml-0.5">{cnt}</span>}</Btn>
        {cnt>0 && <Btn variant="ghost" size="sm" onClick={()=>onChange({season:"",category:"",color:"",style:"",gender:""})}>초기화</Btn>}
      </div>
      {open && (
        <div className="mt-3 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <Select label="성별" options={["여아","남아","공용"]} value={f.gender} onChange={v=>onChange({...f,gender:v})} placeholder="전체"/>
            <Select label="시즌" options={SEASONS} value={f.season} onChange={v=>onChange({...f,season:v})} placeholder="전체"/>
            <Select label="카테고리" options={CATEGORIES} value={f.category} onChange={v=>onChange({...f,category:v})} placeholder="전체"/>
            <Select label="컬러" options={COLORS_LIST} value={f.color} onChange={v=>onChange({...f,color:v})} placeholder="전체"/>
            <Select label="스타일" options={STYLES} value={f.style} onChange={v=>onChange({...f,style:v})} placeholder="전체"/>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════ MAIN APP ═══════════════
const NAV = [
  {id:"upload", label:"제품 업로드", ico:IcoUpload, emoji:"📤"},
  {id:"products", label:"제품 목록", ico:IcoList, emoji:"📋"},
  {id:"recommend", label:"AI 추천 코디", ico:IcoStar, emoji:"✨"},
  {id:"manual", label:"수동 코디", ico:IcoEdit, emoji:"🎨"},
  {id:"saved", label:"저장된 코디", ico:IcoSave, emoji:"💾"},
];

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [products, setProducts] = useState([]);
  const [savedCoords, setSaved] = useState([]);
  const [tab, setTab] = useState("upload");
  const [editProd, setEditProd] = useState(null);
  const [detailCoord, setDetailCoord] = useState(null);
  const [filters, setFilters] = useState({season:"",category:"",color:"",style:"",gender:""});
  const [manualSel, setManualSel] = useState([]);
  const [manualName, setManualName] = useState("");
  const [toast, setToast] = useState(null);
  const [analyzingCount, setAnalyzingCount] = useState(0);
  const fileRef = useRef();
  const [dragOver, setDragOver] = useState(false);

  // Persistence — fix stuck "analyzing" products on load
  useEffect(() => { (async()=>{
    const [p,s] = await Promise.all([loadData("ozkiz-products",[]),loadData("ozkiz-saved-coords",[])]);
    // Force-complete any stuck "analyzing" products from previous session
    // Also assign gender to products that don't have it
    const fixed = p.map(prod => {
      let updated = prod;
      if (prod.status === "analyzing") {
        updated = {
          ...prod,
          status: "done",
          aiAnalyzed: false,
          name: prod.name === "분석중..." ? fallbackAnalysis().name : prod.name,
          category: prod.category || fallbackAnalysis().category,
          color: prod.color || fallbackAnalysis().color,
          season: prod.season || "사계절",
          styleKeywords: (prod.styleKeywords && prod.styleKeywords.length > 0) ? prod.styleKeywords : fallbackAnalysis().styleKeywords,
        };
      }
      // Auto-assign gender if missing
      if (!updated.gender) {
        const col = updated.color||"";
        const kws = (updated.styleKeywords||[]).join(" ");
        const name = (updated.name||"");
        const cat = updated.category||"";
        // 치마/스커트/원피스/드레스 → 무조건 여아
        const isSkirtOrDress = cat==="원피스" || name.includes("치마") || name.includes("스커트") || name.includes("원피스") || name.includes("드레스");
        const girlSignals = isSkirtOrDress
          || ["핑크","라벤더","퍼플"].includes(col)
          || kws.includes("러블리") || kws.includes("공주풍") || kws.includes("프렌치")
          || name.includes("리본") || name.includes("프릴") || name.includes("레이스")
          || name.includes("플라워") || name.includes("하트") || name.includes("메리제인");
        const boySignals = name.includes("공룡") || name.includes("자동차") || name.includes("로봇")
          || name.includes("상어") || name.includes("밀리터리") || name.includes("카모")
          || kws.includes("스포티");
        if (girlSignals && !boySignals) updated = {...updated, gender: "여아"};
        else if (boySignals && !girlSignals) updated = {...updated, gender: "남아"};
        else updated = {...updated, gender: "공용"};
      }
      return updated;
    });
    setProducts(fixed);
    setSaved(s);
    setAnalyzingCount(0);
    setLoaded(true);
  })(); }, []);
  useEffect(() => { if (loaded) saveData("ozkiz-products", products); }, [products, loaded]);
  useEffect(() => { if (loaded) saveData("ozkiz-saved-coords", savedCoords); }, [savedCoords, loaded]);

  const showToast = useCallback((msg) => { setToast(msg); setTimeout(()=>setToast(null), 2500); }, []);

  // ─── AI-powered upload: analyze image automatically ───
  const handleFiles = useCallback((files) => {
    const fileArr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!fileArr.length) return;
    
    fileArr.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          // Resize
          const MAX = 600;
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) { const r = Math.min(MAX/w,MAX/h); w=Math.round(w*r); h=Math.round(h*r); }
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);

          const prodId = uid();
          // Add product immediately with "analyzing" status
          setProducts(prev => [...prev, {
            id: prodId, imageData: dataUrl, name: "분석중...",
            category:"", color:"", season:"", styleKeywords:[], memo:"",
            status: "analyzing",
          }]);
          setAnalyzingCount(c => c + 1);

          // Fire AI analysis (always completes — falls back to smart assignment if API fails)
          analyzeImage(dataUrl, file.name).then(result => {
            setProducts(prev => prev.map(p => {
              if (p.id !== prodId) return p;
              return { ...p, ...result, status: "done" };
            }));
            setAnalyzingCount(c => Math.max(0, c - 1));
          });
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
    showToast(`${fileArr.length}개 이미지 업로드 · AI 분석 시작 🔍`);
  }, [showToast]);

  // Product CRUD
  const updateProduct = useCallback((p) => { setProducts(prev=>prev.map(x=>x.id===p.id?p:x)); showToast("제품 정보가 저장되었습니다"); }, [showToast]);
  const deleteProduct = useCallback((id) => { setProducts(prev=>prev.filter(x=>x.id!==id)); showToast("제품이 삭제되었습니다"); }, [showToast]);

  // Coord
  const saveCoord = useCallback((c) => { setSaved(prev => { if (prev.some(s=>s.id===c.id)) return prev; return [...prev, {...c, savedAt:Date.now()}]; }); showToast("코디가 저장되었습니다 💕"); }, [showToast]);
  const deleteCoord = useCallback((id) => { setSaved(prev=>prev.filter(x=>x.id!==id)); showToast("코디가 삭제되었습니다"); }, [showToast]);

  // Recommendations (auto-generated from analyzed products)
  const recs = useMemo(() => recommend(products), [products]);

  // Auto-navigate to recommend tab whenever new recommendations become available
  const prevRecCount = useRef(0);
  const hasAutoNavd = useRef(false);
  useEffect(() => {
    const newRecs = recs.length;
    const hadRecs = prevRecCount.current;
    
    // Navigate when: new recs appeared AND we're still on upload tab
    // Or: recs count increased (more products analyzed) and user hasn't left upload
    if (newRecs > 0 && newRecs !== hadRecs && (tab === "upload" || tab === "products")) {
      // Small delay so user sees the "분석 완료" state briefly
      const delay = hasAutoNavd.current ? 500 : 1200;
      const timer = setTimeout(() => {
        setTab("recommend");
        if (!hasAutoNavd.current) {
          showToast("AI 코디 추천이 완료되었어요! ✨");
          hasAutoNavd.current = true;
        } else {
          showToast(`추천 코디가 ${newRecs}개로 업데이트됐어요 ✨`);
        }
      }, delay);
      prevRecCount.current = newRecs;
      return () => clearTimeout(timer);
    }
    prevRecCount.current = newRecs;
  }, [recs.length, tab, showToast]);

  // Filters
  const applyF = (coords) => coords.filter(c => {
    const ps = c.products;
    if (filters.season && !ps.some(p=>p.season===filters.season)) return false;
    if (filters.category && !ps.some(p=>p.category===filters.category)) return false;
    if (filters.color && !ps.some(p=>p.color===filters.color)) return false;
    if (filters.style && !ps.some(p=>(p.styleKeywords||[]).includes(filters.style))) return false;
    if (filters.gender && !ps.some(p=>p.gender===filters.gender || p.gender==="공용")) return false;
    return true;
  });
  const filteredRecs = applyF(recs);
  const filteredSaved = applyF(savedCoords);
  const savedIds = useMemo(() => new Set(savedCoords.map(c=>c.id)), [savedCoords]);

  // Manual coord
  const doneProducts = products.filter(p => p.status === "done");
  const manualProducts = doneProducts.filter(p=>manualSel.includes(p.id));
  const manualCats = manualProducts.map(p=>p.category).filter(Boolean);
  const manualHasDupe = new Set(manualCats).size < manualCats.length;
  const manualIsValidOutfit = manualProducts.length >= 2 && isValidOutfit(manualCats);
  const manualScore = manualIsValidOutfit ? scoreCombo(manualProducts) : 0;
  
  const toggleManualSafe = (id) => {
    const prod = doneProducts.find(p => p.id === id);
    if (!prod) return;
    if (manualSel.includes(id)) {
      setManualSel(prev => prev.filter(s => s !== id));
      return;
    }
    if (prod.category && manualProducts.some(mp => mp.category === prod.category)) {
      showToast(`이미 ${prod.category}가 선택되어 있어요. 같은 복종은 중복할 수 없어요!`);
      return;
    }
    setManualSel(prev => [...prev, id]);
  };

  const handleManualSave = () => {
    if (manualProducts.length < 2) return;
    if (manualHasDupe) {
      showToast("같은 복종이 중복되어 있어요. 하나를 빼주세요!");
      return;
    }
    if (!isValidOutfit(manualCats)) {
      showToast("상의+하의 또는 원피스가 포함된 코디만 저장할 수 있어요!");
      return;
    }
    saveCoord({ id: uid(), products: manualProducts, score: manualScore,
      name: manualName || genName(manualProducts), reason: genReason(manualProducts),
      template:"수동 구성", manual:true });
    setManualSel([]); setManualName("");
  };

  if (!loaded) return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center"><div className="w-10 h-10 border-3 border-rose-300 border-t-transparent rounded-full animate-spin mx-auto mb-3"/><p className="text-sm text-gray-400">불러오는 중...</p></div>
    </div>
  );

  const analyzingProducts = products.filter(p => p.status === "analyzing");
  const doneCount = products.filter(p => p.status === "done").length;

  return (
    <div className="flex h-screen bg-[#fafafa] overflow-hidden" style={{fontFamily:"'Pretendard Variable','Noto Sans KR',-apple-system,BlinkMacSystemFont,sans-serif"}}>
      
      {/* ═══ SIDEBAR ═══ */}
      <aside className="w-[220px] flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-400 to-orange-300 flex items-center justify-center text-white text-sm font-black shadow-sm shadow-rose-200">O</div>
            <div><h1 className="text-sm font-black text-gray-800 tracking-tight leading-none">OZKIZ</h1><p className="text-[10px] text-rose-400 font-bold tracking-wider">STYLING BOARD</p></div>
          </div>
        </div>
        
        {/* Analyzing indicator in sidebar */}
        {analyzingProducts.length > 0 && (
          <div className="mx-3 mb-2 p-2.5 bg-orange-50 rounded-xl border border-orange-100">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin flex-shrink-0"/>
              <p className="text-[11px] text-orange-600 font-bold flex-1">AI 분석중 {analyzingProducts.length}개</p>
              <button onClick={() => {
                setProducts(prev => prev.map(p => p.status === "analyzing" 
                  ? {...p, ...fallbackAnalysis(), status:"done", aiAnalyzed:false} : p));
                setAnalyzingCount(0);
                showToast("분석을 중단하고 자동 분류했어요");
              }} className="text-[10px] text-orange-500 hover:text-orange-700 font-bold underline whitespace-nowrap">중단</button>
            </div>
          </div>
        )}

        <nav className="flex-1 px-3 py-1 space-y-0.5">
          {NAV.map(n => {
            const active = tab===n.id;
            const Ico = n.ico;
            let badge = null;
            if (n.id==="products" && products.length>0) badge = products.length;
            if (n.id==="saved" && savedCoords.length>0) badge = savedCoords.length;
            if (n.id==="recommend" && recs.length>0) badge = recs.length;
            return (
              <button key={n.id} onClick={()=>setTab(n.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] transition-all ${
                  active?"bg-rose-50 text-rose-600 font-bold shadow-sm shadow-rose-100/50":"text-gray-500 hover:bg-gray-50 hover:text-gray-700 font-medium"
                }`}>
                <Ico sz={17} style={{opacity:active?1:0.5}}/><span className="flex-1 text-left">{n.label}</span>
                {badge!=null && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active?"bg-rose-200/60 text-rose-600":"bg-gray-100 text-gray-400"}`}>{badge}</span>}
              </button>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-gray-100">
          <p className="text-[10px] text-gray-300 font-medium">v2.1 · 상의+하의+슈즈 코디</p>
          <p className="text-[10px] text-gray-300 mb-2">데이터 자동 저장 ✓</p>
          <button onClick={() => {
            if (confirm("모든 제품과 코디 데이터를 초기화할까요?")) {
              setProducts([]);
              setSaved([]);
              setAnalyzingCount(0);
              showToast("데이터가 초기화되었습니다. 제품을 새로 업로드하세요!");
            }
          }} className="w-full py-1.5 rounded-lg text-[10px] text-red-400 hover:bg-red-50 transition border border-transparent hover:border-red-200">
            🗑 데이터 초기화
          </button>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto px-8 py-7">
          
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{NAV.find(n=>n.id===tab)?.emoji}</span>
              <h2 className="text-xl font-black text-gray-800">{NAV.find(n=>n.id===tab)?.label}</h2>
            </div>
            <p className="text-xs text-gray-400 font-medium pl-8">
              {tab==="upload" && "이미지를 업로드하면 AI가 자동으로 분석하고 코디를 추천해요"}
              {tab==="products" && `총 ${products.length}개 제품 (AI 분석 완료 ${doneCount}개)`}
              {tab==="recommend" && `${filteredRecs.length}개의 AI 추천 코디`}
              {tab==="manual" && "원하는 제품을 골라 나만의 코디를 만들어보세요"}
              {tab==="saved" && `${filteredSaved.length}개의 코디가 저장되어 있어요`}
            </p>
          </div>

          {/* ──── UPLOAD ──── */}
          {tab==="upload" && (
            <div>
              <div
                onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)}
                onDrop={e=>{e.preventDefault();setDragOver(false);handleFiles(e.dataTransfer.files)}}
                onClick={()=>fileRef.current?.click()}
                className={`relative border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                  dragOver?"border-rose-400 bg-rose-50/60 scale-[1.01]":"border-gray-200 hover:border-rose-300 hover:bg-rose-50/30"}`}>
                <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={e=>{handleFiles(e.target.files);e.target.value="";}}/>
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all ${dragOver?"bg-rose-200 scale-110":"bg-rose-100"}`}>
                  <IcoSparkle sz={28} style={{color:"#e11d48"}}/>
                </div>
                <p className="text-sm font-bold text-gray-700 mb-1">이미지만 올리면 AI가 알아서 분석해요</p>
                <p className="text-xs text-gray-400">카테고리, 컬러, 스타일을 자동 인식 → 바로 코디 추천!</p>
                <p className="text-[10px] text-gray-300 mt-2">JPG, PNG, WEBP · 여러 장 동시 업로드</p>
              </div>

              {/* AI analysis progress */}
              {analyzingProducts.length > 0 && (
                <div className="mt-6 p-5 bg-gradient-to-r from-orange-50 to-amber-50/50 rounded-2xl border border-orange-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 border-3 border-orange-400 border-t-transparent rounded-full animate-spin flex-shrink-0"/>
                    <div>
                      <p className="text-sm font-bold text-gray-700">AI가 {analyzingProducts.length}개 제품을 분석하고 있어요...</p>
                      <p className="text-xs text-gray-400">완료되면 자동으로 코디를 추천해드릴게요</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {analyzingProducts.map(p => (
                      <div key={p.id} className="w-14 h-14 rounded-xl overflow-hidden border-2 border-orange-200 opacity-70">
                        {p.imageData && <img src={p.imageData} alt="" className="w-full h-full object-cover"/>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Analyzed products */}
              {products.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-700">업로드한 제품 ({doneCount}개 분석 완료)</h3>
                    <Btn variant="ghost" size="sm" onClick={()=>setTab("products")}>전체 보기 →</Btn>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {products.slice(-12).reverse().map(p => <ProductCard key={p.id} product={p} onClick={()=>setEditProd(p)}/>)}
                  </div>
                </div>
              )}

              {/* Rec preview */}
              {recs.length > 0 && (
                <div className="mt-8 p-5 bg-gradient-to-r from-rose-50 via-orange-50/60 to-amber-50/40 rounded-2xl border border-rose-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-base">✨</span>
                      <h3 className="text-sm font-bold text-gray-700">AI 추천 코디 미리보기</h3>
                      <Badge color="rose">{recs.length}개</Badge>
                    </div>
                    <Btn size="sm" onClick={()=>setTab("recommend")}>전체 보기 →</Btn>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {recs.slice(0,3).map(c => (
                      <div key={c.id} className="bg-white rounded-xl p-3 shadow-sm border border-white hover:shadow-md transition-all cursor-pointer" onClick={()=>setDetailCoord(c)}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex -space-x-2">
                            {c.products.slice(0,3).map((p,i) => (
                              <div key={i} className="w-9 h-9 rounded-lg overflow-hidden border-2 border-white shadow-sm bg-gray-50 flex-shrink-0">
                                {p.imageData ? <img src={p.imageData} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs opacity-30">👗</div>}
                              </div>
                            ))}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-700 truncate">{c.name}</p>
                            <p className="text-[10px] text-gray-400">{c.products.map(p=>p.category).join(" + ")}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <GenderBadge products={c.products}/>
                            <ScoreBadge score={c.score}/>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ──── PRODUCTS ──── */}
          {tab==="products" && (
            products.length===0
              ? <Empty emoji="👗" title="아직 등록된 제품이 없어요" sub="이미지를 업로드하면 AI가 자동 분석해요" action="제품 업로드" onAction={()=>setTab("upload")}/>
              : (<div>
                  <div className="flex flex-wrap gap-2 mb-5">
                    {CATEGORIES.map(cat => { const c=products.filter(p=>p.category===cat).length; return c?<Badge key={cat} color="gray">{cat} {c}</Badge>:null; })}
                    {analyzingProducts.length>0 && <Badge color="orange">분석중 {analyzingProducts.length}</Badge>}
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {products.map(p => <ProductCard key={p.id} product={p} onClick={()=>setEditProd(p)}/>)}
                  </div>
                  {recs.length>0 && (
                    <div className="mt-6 p-4 bg-gradient-to-r from-rose-50 to-orange-50/50 rounded-2xl border border-rose-100 flex items-center justify-between cursor-pointer hover:shadow-md transition-all" onClick={()=>setTab("recommend")}>
                      <div className="flex items-center gap-3"><span className="text-xl">✨</span><div><p className="text-sm font-bold text-gray-700">AI 추천 코디 {recs.length}개 준비 완료!</p></div></div>
                      <Btn size="sm">보러 가기</Btn>
                    </div>
                  )}
                </div>)
          )}

          {/* ──── RECOMMEND ──── */}
          {tab==="recommend" && (
            <div>
              <div className="flex items-center gap-3 mb-5 flex-wrap">
                <FilterBar filters={filters} onChange={setFilters}/>
                <Btn variant="outline" size="sm" onClick={()=>fileRef.current?.click()}><IcoUpload sz={14}/> 제품 추가</Btn>
              </div>

              {/* Analyzing banner inside recommend tab */}
              {analyzingProducts.length > 0 && (
                <div className="mb-5 p-4 bg-orange-50 rounded-2xl border border-orange-100 flex items-center gap-3">
                  <div className="w-8 h-8 border-3 border-orange-400 border-t-transparent rounded-full animate-spin flex-shrink-0"/>
                  <div>
                    <p className="text-sm font-bold text-orange-700">AI가 {analyzingProducts.length}개 제품을 분석하고 있어요...</p>
                    <p className="text-xs text-orange-500">분석이 끝날 때마다 추천 코디가 자동 업데이트돼요</p>
                  </div>
                </div>
              )}

              {doneCount < 2
                ? <Empty emoji="✨" title="제품 2개 이상 업로드하면 코디를 추천해드려요" sub="이미지만 올리면 AI가 자동 분석 → 코디 추천까지 한번에!" action="제품 업로드" onAction={()=>fileRef.current?.click()}/>
                : filteredRecs.length === 0
                  ? <Empty emoji="🔍" title="조건에 맞는 추천이 없어요" sub="필터를 조정하거나, 제품을 더 업로드해보세요"/>
                  : (<div>
                      <div className="mb-5 p-4 bg-gradient-to-r from-rose-50 via-orange-50/50 to-amber-50/30 rounded-2xl border border-rose-100/80 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-lg flex-shrink-0">✨</div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-700">{doneCount}개 제품을 분석해서 {filteredRecs.length}개 코디를 추천했어요!</p>
                          <p className="text-xs text-gray-400 mt-0.5">사진만으로 카테고리, 컬러, 스타일을 자동 인식했어요</p>
                        </div>
                        <Btn variant="ghost" size="sm" onClick={()=>setProducts(p=>[...p])}><IcoRefresh sz={14}/> 새로 추천</Btn>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredRecs.map(c => <CoordCard key={c.id} coord={c} onDetail={setDetailCoord} onSave={saveCoord} onDelete={deleteCoord} isSaved={savedIds.has(c.id)}/>)}
                      </div>
                    </div>)
              }
            </div>
          )}

          {/* ──── MANUAL ──── */}
          {tab==="manual" && (
            doneProducts.length===0
              ? <Empty emoji="🎨" title="먼저 제품을 업로드해주세요" sub="AI 분석이 완료된 제품으로 코디를 구성할 수 있어요" action="제품 업로드" onAction={()=>setTab("upload")}/>
              : (<div>
                  <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 shadow-sm">
                    <Input label="코디명 (비워두면 자동 생성)" value={manualName} onChange={e=>setManualName(e.target.value)} placeholder="예: 봄날의 소풍룩" className="mb-4"/>
                    
                    {/* Show selected categories */}
                    {manualSel.length >= 1 && (
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="text-[11px] text-gray-400 font-medium">선택된 복종:</span>
                        {[...new Set(manualProducts.map(p=>p.category).filter(Boolean))].map(cat => (
                          <Badge key={cat} color="rose">{cat}</Badge>
                        ))}
                      </div>
                    )}

                    {manualSel.length >= 2 && (
                      <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-100 mb-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold text-gray-600">선택된 제품 {manualSel.length}개</span>
                          <ScoreBadge score={manualScore}/>
                        </div>
                        <div className="flex gap-2 flex-wrap mb-3">
                          {manualProducts.map(p => (
                            <div key={p.id} className="flex items-center gap-1.5 bg-white rounded-xl px-2 py-1.5 shadow-sm">
                              {p.imageData && <img src={p.imageData} alt="" className="w-7 h-7 rounded-lg object-cover"/>}
                              <span className="text-xs text-gray-600 font-medium">{p.name||p.category}</span>
                              <button onClick={()=>toggleManualSafe(p.id)} className="text-gray-300 hover:text-red-400"><IcoX sz={12}/></button>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 mb-2">{genReason(manualProducts)}</p>
                        {!manualIsValidOutfit && manualProducts.length >= 2 && (
                          <p className="text-xs text-red-400 mb-2 font-medium">⚠️ 상의+하의 또는 원피스가 포함되어야 코디를 저장할 수 있어요</p>
                        )}
                        <Btn className="w-full" onClick={handleManualSave} disabled={!manualIsValidOutfit}><IcoHeart sz={15}/> 코디 저장하기</Btn>
                      </div>
                    )}
                    {manualSel.length===1 && (
                      <p className="text-xs text-rose-400 mb-3 font-medium">
                        {manualProducts[0]?.category === "상의" ? "하의를 선택해주세요" 
                          : manualProducts[0]?.category === "하의" ? "상의를 선택해주세요"
                          : manualProducts[0]?.category === "원피스" ? "신발이나 소품을 추가해보세요"
                          : "상의+하의 또는 원피스가 포함되도록 선택해주세요"}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-600">제품 선택</h3>
                    <p className="text-[11px] text-gray-400">상의+하의 또는 원피스 기반으로 코디해주세요</p>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {doneProducts.map(p => <ProductCard key={p.id} product={p} selectable selected={manualSel.includes(p.id)} onToggle={()=>toggleManualSafe(p.id)}/>)}
                  </div>
                </div>)
          )}

          {/* ──── SAVED ──── */}
          {tab==="saved" && (
            <div>
              <FilterBar filters={filters} onChange={setFilters}/>
              {filteredSaved.length===0
                ? <Empty emoji="💾" title="저장된 코디가 없어요" sub="추천 코디에서 마음에 드는 코디를 저장해보세요"/>
                : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredSaved.map(c => <CoordCard key={c.id} coord={c} onDetail={setDetailCoord} onSave={saveCoord} onDelete={deleteCoord} isSaved/>)}
                  </div>}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {editProd && <ProductModal product={editProd} onSave={updateProduct} onClose={()=>setEditProd(null)} onDelete={deleteProduct}/>}
      {detailCoord && <CoordDetail coord={detailCoord} onClose={()=>setDetailCoord(null)} onSave={saveCoord} isSaved={savedIds.has(detailCoord.id)}/>}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-5 py-2.5 bg-gray-800 text-white text-sm font-semibold rounded-2xl shadow-lg shadow-gray-900/20" style={{animation:"slideUp .25s ease-out"}}>{toast}</div>
      )}
      <style>{`@keyframes slideUp { from{opacity:0;transform:translate(-50%,12px)} to{opacity:1;transform:translate(-50%,0)} }`}</style>
    </div>
  );
}
