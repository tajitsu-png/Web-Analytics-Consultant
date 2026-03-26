/**
 * ウェブ解析士 演習問題集 - メインアプリロジック
 * 
 * 設計仕様：
 * - 章選択 → 開始確認（OK入力） → 10問演習 → 結果表示 → 章選択
 * - 各問題: 問題表示 → 回答 → 解説表示 → 次の問題
 * - ブロック配分: 前半3問・中盤4問・後半3問（非復元抽出）
 * - タイプ配分: A（正しいものを選ぶ）5問・B（誤っているものを選ぶ）5問
 */

// ===== 問題バンク（全章データ） =====
const QUESTION_BANK = {
  1: questionsChapter1,
  2: questionsChapter2,
  3: questionsChapter3,
  4: questionsChapter4,
  5: questionsChapter5,
  6: questionsChapter6,
  7: questionsChapter7,
  8: questionsChapter8,
};

const CHAPTER_NAMES = {
  1: "第1章 ウェブ解析と基本的な指標",
  2: "第2章 事業戦略とマーケティング解析",
  3: "第3章 デジタル化戦略と計画立案",
  4: "第4章 ウェブ解析の設計",
  5: "第5章 インプレッションの解析",
  6: "第6章 エンゲージメントと間接効果",
  7: "第7章 オウンドメディアの解析と改善",
  8: "第8章 ウェブ解析士のレポーティング",
};

// ===== アプリ状態管理 =====
const State = {
  currentChapter: null,         // 選択中の章番号
  sessionQuestions: [],          // 今回のセッションの10問リスト
  currentQIndex: 0,              // 現在の問題番号（0始まり）
  results: [],                   // [{questionId, userChoice, correct: bool}]
  answeredCurrent: false,        // 現在の問題を回答済みか
};

// ===== 画面切り替えユーティリティ =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ===== ヘッダー進捗管理 =====
function updateHeaderProgress(show, current, total) {
  const hp = document.getElementById('headerProgress');
  if (!show) { hp.style.display = 'none'; return; }
  hp.style.display = 'flex';
  document.getElementById('progressText').textContent = `第${current}問 / 全${total}問`;
  const pct = ((current - 1) / total) * 100;
  document.getElementById('progressBar').style.width = pct + '%';
}

// ===== 問題セット生成 =====
/**
 * 指定章の問題プールから、ブロック配分・タイプ配分ルールに従って10問を選出する。
 * 前半3問 / 中盤4問 / 後半3問
 * タイプA 5問 / タイプB 5問
 */
function buildSessionQuestions(chapter) {
  const pool = QUESTION_BANK[chapter];
  const front = shuffle(pool.filter(q => q.block === "前半"));
  const mid   = shuffle(pool.filter(q => q.block === "中盤"));
  const back  = shuffle(pool.filter(q => q.block === "後半"));

  // ブロック配分に従い候補を選出
  const candidates = [
    ...front.slice(0, 3),
    ...mid.slice(0, 4),
    ...back.slice(0, 3),
  ];

  // タイプ均等チェック・調整（可能な限り A:5, B:5 に近づける）
  // 現在の各章は丁度A5・B5になっているが、将来的な増問に備え柔軟に処理
  const finalSet = adjustTypeBalance(candidates, pool);

  return shuffle(finalSet);
}

/**
 * タイプAとタイプBが5:5になるよう調整する
 */
function adjustTypeBalance(candidates, pool) {
  let typeA = candidates.filter(q => q.type === 'A');
  let typeB = candidates.filter(q => q.type === 'B');

  // すでに5:5なら何もしない
  if (typeA.length === 5 && typeB.length === 5) return candidates;

  // 多すぎる側を減らし、少ない側をプールから補充
  const usedIds = new Set(candidates.map(q => q.id));
  const unusedA = shuffle(pool.filter(q => q.type === 'A' && !usedIds.has(q.id)));
  const unusedB = shuffle(pool.filter(q => q.type === 'B' && !usedIds.has(q.id)));

  let result = [...candidates];

  while (typeA.length > 5 && unusedB.length > 0) {
    const removeIdx = result.findIndex(q => q.type === 'A');
    if (removeIdx === -1) break;
    result.splice(removeIdx, 1);
    result.push(unusedB.shift());
    typeA = result.filter(q => q.type === 'A');
  }
  while (typeB.length > 5 && unusedA.length > 0) {
    const removeIdx = result.findIndex(q => q.type === 'B');
    if (removeIdx === -1) break;
    result.splice(removeIdx, 1);
    result.push(unusedA.shift());
    typeB = result.filter(q => q.type === 'B');
  }

  return result.slice(0, 10);
}

/**
 * 配列をFisher-Yatesアルゴリズムでシャッフル
 */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ===== 問題表示 =====
function renderQuestion() {
  const q = State.sessionQuestions[State.currentQIndex];
  const qNum = State.currentQIndex + 1;
  const total = State.sessionQuestions.length;

  // ヘッダー進捗更新
  updateHeaderProgress(true, qNum, total);

  // 問題番号・タイプ
  document.getElementById('questionBadge').textContent = `第${qNum}問 / 全${total}問`;
  const typeBadge = document.getElementById('questionTypeBadge');
  if (q.type === 'A') {
    typeBadge.textContent = '正しいものを選ぶ';
    typeBadge.className = 'question-type-badge type-a';
  } else {
    typeBadge.textContent = '誤っているものを選ぶ';
    typeBadge.className = 'question-type-badge type-b';
  }

  // 設問文
  const instrText = q.type === 'A'
    ? '下記の中から最も適切な選択肢を選びなさい。'
    : '下記の中から誤っている選択肢を選びなさい。';
  document.getElementById('questionInstruction').textContent = instrText;

  // 問題文
  document.getElementById('questionText').textContent = q.question;

  // 選択肢
  ['A', 'B', 'C', 'D'].forEach(key => {
    document.getElementById(`choiceText${key}`).textContent = q.choices[key];
    const btn = document.getElementById(`choice${key}`);
    btn.className = 'choice-btn';
    btn.disabled = false;
  });

  State.answeredCurrent = false;
  showScreen('screenQuestion');
}

// ===== 回答処理 =====
function handleAnswer(chosen) {
  if (State.answeredCurrent) return;
  State.answeredCurrent = true;

  const q = State.sessionQuestions[State.currentQIndex];
  const isCorrect = chosen === q.correct;

  // 選択肢のスタイルを更新
  ['A', 'B', 'C', 'D'].forEach(key => {
    const btn = document.getElementById(`choice${key}`);
    btn.disabled = true;
    if (key === q.correct) {
      btn.classList.add('correct-choice');
    } else if (key === chosen && !isCorrect) {
      btn.classList.add('wrong-choice');
    } else {
      btn.classList.add('other-choice');
    }
  });

  // 結果を記録
  State.results.push({
    questionId: q.id,
    qNum: State.currentQIndex + 1,
    question: q.question,
    userChoice: chosen,
    correct: isCorrect,
    correctAnswer: q.correct,
  });

  // 少し遅らせて解説画面へ
  setTimeout(() => {
    renderExplain(q, chosen, isCorrect);
  }, 600);
}

// ===== 解説表示 =====
function renderExplain(q, chosen, isCorrect) {
  const qNum = State.currentQIndex + 1;
  const total = State.sessionQuestions.length;

  document.getElementById('explainBadge').textContent = `第${qNum}問 / 全${total}問`;

  // 正誤バッジ
  const rb = document.getElementById('resultBadge');
  if (isCorrect) {
    rb.textContent = '✓ 正解！';
    rb.className = 'result-badge correct';
  } else {
    rb.textContent = '✗ 不正解';
    rb.className = 'result-badge wrong';
  }

  // 問題文（設問文付き）
  const instrText = q.type === 'A'
    ? '【下記の中から最も適切な選択肢を選びなさい。】'
    : '【下記の中から誤っている選択肢を選びなさい。】';
  document.getElementById('explainQuestion').innerHTML =
    `<span style="font-size:0.82rem;color:var(--primary);font-weight:700;">${instrText}</span><br>${q.question}`;

  // 正解表示
  const caBox = document.getElementById('correctAnswerBox');
  caBox.innerHTML = `<i class="fas fa-check-circle"></i> <strong>正解：${q.correct} &nbsp;「${q.choices[q.correct]}」</strong>`;

  // 解説（全選択肢）
  const ec = document.getElementById('explainContent');
  ec.innerHTML = '';
  ['A', 'B', 'C', 'D'].forEach(key => {
    const isCorrectChoice = key === q.correct;
    const div = document.createElement('div');
    div.className = `explain-item ${isCorrectChoice ? 'correct-item' : 'wrong-item'}`;
    div.innerHTML = `
      <div>
        <span class="explain-item-label">${key}：</span>
        <span class="explain-item-text">${q.choices[key]}</span>
      </div>
      <div class="explain-item-reason">${q.explanations[key]}</div>
    `;
    ec.appendChild(div);
  });

  // 出典
  document.getElementById('sourceBox').innerHTML =
    `<strong>【出典】</strong><br>2026年ウェブ解析士認定試験公式テキスト<br>${q.source}`;

  // 次へボタンのテキスト変更
  const btnNext = document.getElementById('btnNext');
  if (qNum >= total) {
    btnNext.innerHTML = '結果を見る <i class="fas fa-flag-checkered"></i>';
  } else {
    btnNext.innerHTML = `次の問題へ <i class="fas fa-arrow-right"></i>`;
  }

  showScreen('screenExplain');
}

// ===== 結果表示 =====
function renderResult() {
  const total = State.results.length; // 10
  const correct = State.results.filter(r => r.correct).length;
  const rate = Math.round((correct / total) * 100);

  // ヘッダー進捗更新（完了状態）
  updateHeaderProgress(true, total, total);
  document.getElementById('progressBar').style.width = '100%';

  // アイコン
  const icon = document.getElementById('resultIcon');
  if (rate >= 80)      icon.textContent = '🎉';
  else if (rate >= 60) icon.textContent = '📚';
  else                 icon.textContent = '💪';

  // スコア
  const sc = document.getElementById('scoreCircle');
  sc.className = 'score-circle';
  if (rate >= 80)      sc.classList.add('great');
  else if (rate >= 60) sc.classList.add('ok');
  else                 sc.classList.add('low');

  document.getElementById('scoreNumber').textContent = correct;
  document.getElementById('scoreRate').textContent = `正答率 ${rate}%`;

  // 評価コメント
  const ec = document.getElementById('evalComment');
  if (rate >= 80) {
    ec.className = 'eval-comment eval-great';
    ec.innerHTML = `<strong>優秀！十分理解できています。</strong><br>この章の内容はしっかり定着しています。他の章の演習にも挑戦してみましょう。`;
  } else if (rate >= 60) {
    ec.className = 'eval-comment eval-ok';
    ec.innerHTML = `<strong>要復習。理解が不十分な箇所があります。</strong><br>不正解だった問題の解説を振り返り、公式テキストで該当箇所を再確認しましょう。`;
  } else {
    ec.className = 'eval-comment eval-low';
    ec.innerHTML = `<strong>再読を推奨します。</strong><br>基礎的な概念の理解が不十分です。公式テキストをこの章の最初から読み直してから再演習することをお勧めします。`;
  }

  // 詳細（各問の正誤）
  const rd = document.getElementById('resultDetail');
  rd.innerHTML = '';
  State.results.forEach(r => {
    const div = document.createElement('div');
    div.className = `detail-row ${r.correct ? 'correct-row' : 'wrong-row'}`;
    const icon = r.correct ? '✓' : '✗';
    const q = State.sessionQuestions.find(q => q.id === r.questionId);
    const shortQ = q ? q.question.substring(0, 40) + (q.question.length > 40 ? '…' : '') : '';
    div.innerHTML = `
      <span style="font-size:1.1rem;font-weight:700;min-width:20px;">${icon}</span>
      <span>第${r.qNum}問：${shortQ}</span>
      ${!r.correct ? `<span style="margin-left:auto;font-size:0.8rem;font-weight:700;">正解：${r.correctAnswer}</span>` : ''}
    `;
    rd.appendChild(div);
  });

  showScreen('screenResult');
  // ヘッダー進捗非表示
  setTimeout(() => updateHeaderProgress(false), 100);
}

// ===== イベントリスナー =====

// 章選択ボタン
document.querySelectorAll('.chapter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const ch = parseInt(btn.dataset.chapter);
    State.currentChapter = ch;
    document.getElementById('confirmTitle').textContent =
      `${CHAPTER_NAMES[ch]}の演習を開始します`;
    showScreen('screenConfirm');
  });
});

// OKボタン
document.getElementById('btnOk').addEventListener('click', () => {
  startSession();
});

// 確認画面の「戻る」ボタン
document.getElementById('btnConfirmBack').addEventListener('click', () => {
  showScreen('screenChapter');
});

// 選択肢ボタン（A〜D）
['A', 'B', 'C', 'D'].forEach(key => {
  document.getElementById(`choice${key}`).addEventListener('click', () => {
    handleAnswer(key);
  });
});

// 次の問題へボタン
document.getElementById('btnNext').addEventListener('click', () => {
  State.currentQIndex++;
  if (State.currentQIndex >= State.sessionQuestions.length) {
    renderResult();
  } else {
    renderQuestion();
  }
});

// 再演習ボタン
document.getElementById('btnRetry').addEventListener('click', () => {
  startSession();
});

// 別の章を選ぶボタン
document.getElementById('btnChapterSelect').addEventListener('click', () => {
  const desc = document.getElementById('welcomeDesc');
  desc.innerHTML = '引き続き2026年ウェブ解析士認定資格試験の演習問題を出題します。<br>演習したい章を選んでください。';
  updateHeaderProgress(false);
  showScreen('screenChapter');
});

// ===== セッション開始 =====
function startSession() {
  State.sessionQuestions = buildSessionQuestions(State.currentChapter);
  State.currentQIndex = 0;
  State.results = [];
  renderQuestion();
}

// ===== 初期化 =====
(function init() {
  updateHeaderProgress(false);
  showScreen('screenChapter');
})();
