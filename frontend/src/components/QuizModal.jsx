import { useState } from 'react'

// phase: 'mc' → one MC question per NPC → 'free_text' → 'result'
export default function QuizModal({ quizData, npcs, recruitedNpcIds, onProceed, onClose }) {
  const [phase, setPhase] = useState('mc')
  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [mcScore, setMcScore] = useState(0)
  const [freeText, setFreeText] = useState('')
  const [evaluating, setEvaluating] = useState(false)
  const [evalResult, setEvalResult] = useState(null)

  const mcQuestions = quizData?.mc_questions || []
  const ftQuestion = quizData?.free_text || null
  const recruited = recruitedNpcIds || []

  const getNpc = (id) => npcs?.find(n => n.npc_id === id)

  // ── MC phase ──────────────────────────────────────────
  const q = mcQuestions[qIndex]

  function confirmAnswer() {
    if (!selected || confirmed) return
    setConfirmed(true)
    if (selected === q.correct) setMcScore(s => s + 1)
  }

  function nextQuestion() {
    if (qIndex < mcQuestions.length - 1) {
      setQIndex(i => i + 1)
      setSelected(null)
      setConfirmed(false)
    } else {
      setPhase(ftQuestion ? 'free_text' : 'result')
    }
  }

  // ── Free text phase ───────────────────────────────────
  async function submitFreeText() {
    if (!freeText.trim() || evaluating) return
    setEvaluating(true)
    try {
      const res = await fetch('/api/evaluate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: ftQuestion.question,
          answer: freeText,
          key_concepts: ftQuestion.key_concepts || [],
        }),
      })
      const data = await res.json()
      setEvalResult(data)
    } catch {
      setEvalResult({ passed: true, feedback: 'Keep going!' })
    } finally {
      setEvaluating(false)
      setPhase('result')
    }
  }

  // ── Render ────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 24,
    }}>
      <div style={{
        background: '#111', border: '1px solid #333', borderRadius: 8,
        width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto',
        padding: 32, position: 'relative',
      }}>
        {onClose && phase !== 'result' && (
          <button onClick={onClose} style={{
            position: 'absolute', top: 12, right: 14,
            background: 'none', border: '1px solid #333', borderRadius: 4,
            color: '#555', padding: '3px 9px', fontSize: 13, cursor: 'pointer',
            lineHeight: 1,
          }}>✕</button>
        )}

        {phase === 'mc' && q && (
          <MCQuestion
            q={q} qIndex={qIndex} total={mcQuestions.length}
            selected={selected} confirmed={confirmed}
            recruited={recruited} getNpc={getNpc}
            onSelect={setSelected} onConfirm={confirmAnswer} onNext={nextQuestion}
          />
        )}

        {phase === 'mc' && !q && (
          // No MC questions — skip straight
          <div style={{ textAlign: 'center', padding: 32 }}>
            <button onClick={() => setPhase(ftQuestion ? 'free_text' : 'result')}
              style={{ padding: '12px 32px', background: '#ffd700', color: '#0d0d0d', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>
              Start Quiz
            </button>
          </div>
        )}

        {phase === 'free_text' && ftQuestion && (
          <FreeTextQuestion
            q={ftQuestion} recruited={recruited} getNpc={getNpc}
            value={freeText} onChange={setFreeText}
            evaluating={evaluating} onSubmit={submitFreeText}
          />
        )}

        {phase === 'result' && (
          <Result
            mcScore={mcScore} mcTotal={mcQuestions.length}
            evalResult={evalResult} onProceed={onProceed}
          />
        )}

      </div>
    </div>
  )
}

// ── MC Question ───────────────────────────────────────────────────────────────
function MCQuestion({ q, qIndex, total, selected, confirmed, recruited, getNpc, onSelect, onConfirm, onNext }) {
  const isRecruited = recruited.includes(q.npc_id)

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: '#555', letterSpacing: 2, marginBottom: 8 }}>
          Question {qIndex + 1} / {total}
          {isRecruited && (
            <span style={{ color: '#4ade80', marginLeft: 12 }}>
              ● {q.npc_name} is recruited — they've eliminated wrong options for you
            </span>
          )}
        </div>
        <div style={{ fontSize: 16, color: '#e8e0d0', lineHeight: 1.6 }}>{q.question}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {Object.entries(q.options || {}).map(([key, text]) => {
          const isCorrect = key === q.correct
          const isSelectedWrong = confirmed && selected === key && !isCorrect
          const isCorrectRevealed = confirmed && isCorrect
          const hint = isRecruited && !isCorrect && q.wrong_hints?.[key]
          const eliminated = isRecruited && !isCorrect && !confirmed

          return (
            <div key={key}>
              <button
                onClick={() => !confirmed && onSelect(key)}
                style={{
                  width: '100%', textAlign: 'left', padding: '12px 16px',
                  background: isCorrectRevealed ? '#0f2a0f' : isSelectedWrong ? '#2a0f0f' : selected === key ? '#1a1a2a' : '#141414',
                  border: `1px solid ${isCorrectRevealed ? '#4ade80' : isSelectedWrong ? '#ff4444' : selected === key ? '#555' : '#2a2a2a'}`,
                  borderRadius: 6, cursor: confirmed ? 'default' : 'pointer',
                  color: eliminated ? '#444' : '#e8e0d0',
                  fontSize: 14, lineHeight: 1.5,
                  textDecoration: eliminated ? 'line-through' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ color: '#888', marginRight: 10 }}>{key}.</span>
                {text}
                {isCorrectRevealed && <span style={{ float: 'right', color: '#4ade80' }}>✓</span>}
                {isSelectedWrong && <span style={{ float: 'right', color: '#ff4444' }}>✗</span>}
              </button>

              {hint && !confirmed && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  marginTop: 4, padding: '6px 12px',
                  background: '#0d0d0d', borderLeft: '2px solid #4ade80',
                }}>
                  <div style={{ fontSize: 10, color: '#4ade80', flexShrink: 0, marginTop: 2 }}>
                    {q.npc_name}：
                  </div>
                  <div style={{ fontSize: 12, color: '#4ade80', lineHeight: 1.5 }}>{hint}</div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {confirmed && (
        <div style={{
          padding: '12px 16px', background: '#141414',
          border: '1px solid #2a2a2a', borderRadius: 6, marginBottom: 20,
          fontSize: 13, color: '#a09080', lineHeight: 1.6,
        }}>
          {q.explanation}
        </div>
      )}

      {!confirmed ? (
        <button onClick={onConfirm} disabled={!selected} style={{
          width: '100%', padding: '12px', borderRadius: 6, border: 'none',
          background: selected ? '#ffd700' : '#222',
          color: selected ? '#0d0d0d' : '#444',
          fontSize: 14, fontWeight: 'bold', cursor: selected ? 'pointer' : 'not-allowed',
        }}>
          Confirm Answer
        </button>
      ) : (
        <button onClick={onNext} style={{
          width: '100%', padding: '12px', borderRadius: 6, border: 'none',
          background: '#ffd700', color: '#0d0d0d',
          fontSize: 14, fontWeight: 'bold', cursor: 'pointer',
        }}>
          {qIndex < total - 1 ? 'Next →' : 'Open Question →'}
        </button>
      )}
    </>
  )
}

// ── Free Text Question ────────────────────────────────────────────────────────
function FreeTextQuestion({ q, recruited, getNpc, value, onChange, evaluating, onSubmit }) {
  const recruitedInsights = Object.entries(q.npc_insights || {})
    .filter(([id]) => recruited.includes(id))

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: '#555', letterSpacing: 2, marginBottom: 8 }}>Open Question</div>
        <div style={{ fontSize: 16, color: '#e8e0d0', lineHeight: 1.6 }}>{q.question}</div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Answer in your own words..."
          rows={7}
          style={{
            flex: 1, background: '#141414', border: '1px solid #333', borderRadius: 6,
            color: '#e8e0d0', fontSize: 13, padding: '12px', resize: 'vertical',
            outline: 'none', lineHeight: 1.6,
          }}
        />

        {recruitedInsights.length > 0 && (
          <div style={{ width: 180, flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, marginBottom: 8 }}>
              Ally hints ({recruitedInsights.length} recruited)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recruitedInsights.map(([id, insight]) => {
                const npc = getNpc(id)
                return (
                  <div key={id} style={{
                    padding: '8px 10px', background: '#141414',
                    border: '1px solid #2a4a2a', borderRadius: 6,
                  }}>
                    <div style={{ fontSize: 10, color: '#4ade80', marginBottom: 4 }}>
                      {npc?.name || id}
                    </div>
                    <div style={{ fontSize: 11, color: '#888', lineHeight: 1.5 }}>{insight}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <button onClick={onSubmit} disabled={!value.trim() || evaluating} style={{
        width: '100%', padding: '12px', borderRadius: 6, border: 'none',
        background: value.trim() && !evaluating ? '#ffd700' : '#222',
        color: value.trim() && !evaluating ? '#0d0d0d' : '#444',
        fontSize: 14, fontWeight: 'bold',
        cursor: value.trim() && !evaluating ? 'pointer' : 'not-allowed',
      }}>
        {evaluating ? 'Evaluating...' : 'Submit Answer'}
      </button>
    </>
  )
}

// ── Result ────────────────────────────────────────────────────────────────────
function Result({ mcScore, mcTotal, evalResult, onProceed }) {
  const mcPassed = mcTotal === 0 || mcScore >= Math.ceil(mcTotal * 0.5)

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 22, color: '#ffd700', fontWeight: 'bold', marginBottom: 20 }}>
          Quiz Complete
        </div>

        {mcTotal > 0 && (
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 14, color: '#a09080' }}>Multiple choice </span>
            <span style={{ fontSize: 24, color: mcPassed ? '#4ade80' : '#fbbf24', fontWeight: 'bold' }}>
              {mcScore}/{mcTotal}
            </span>
            <span style={{ fontSize: 14, color: '#a09080' }}> correct</span>
          </div>
        )}

        {evalResult && (
          <div style={{
            padding: '14px 18px', background: '#141414',
            border: `1px solid ${evalResult.passed ? '#2a4a2a' : '#333'}`,
            borderRadius: 6, marginBottom: 16, textAlign: 'left',
          }}>
            <div style={{ color: evalResult.passed ? '#4ade80' : '#fbbf24', fontSize: 13, marginBottom: 6 }}>
              {evalResult.passed ? '✅ Open question: Well understood' : '💬 Open question: Keep exploring'}
            </div>
            <div style={{ color: '#888', fontSize: 13, lineHeight: 1.6 }}>{evalResult.feedback}</div>
          </div>
        )}
      </div>

      <button onClick={onProceed} style={{
        width: '100%', padding: '14px', borderRadius: 6, border: 'none',
        background: '#ffd700', color: '#0d0d0d',
        fontSize: 15, fontWeight: 'bold', cursor: 'pointer',
      }}>
        Go to Next Region →
      </button>
    </>
  )
}
