export default function QuizModal({ quiz, nextRegionName, onAnswer, onProceed }) {
  const { question, options, correct, explanation, selectedAnswer } = quiz

  const answered = selectedAnswer != null
  const isCorrect = answered && selectedAnswer === correct

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        width: 520, background: '#0d0d0d', border: '1px solid #333',
        borderRadius: 8, padding: 28, boxShadow: '0 0 40px rgba(0,0,0,0.8)',
      }}>
        <div style={{ fontSize: 10, color: '#555', letterSpacing: 2, marginBottom: 12 }}>
          区域测验
        </div>
        <div style={{ color: '#e8e0d0', fontSize: 15, lineHeight: 1.7, marginBottom: 20 }}>
          {question}
        </div>

        {!answered && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(options).map(([key, text]) => (
              <button key={key} onClick={() => onAnswer(key)} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 14px', background: '#141414',
                border: '1px solid #333', borderRadius: 4,
                color: '#a09080', fontSize: 13, textAlign: 'left',
                cursor: 'pointer', lineHeight: 1.5,
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#555'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#333'}
              >
                <span style={{ color: '#ffd700', fontWeight: 'bold', flexShrink: 0 }}>{key}.</span>
                <span>{text}</span>
              </button>
            ))}
          </div>
        )}

        {answered && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {Object.entries(options).map(([key, text]) => {
                const isSelected = key === selectedAnswer
                const isRight = key === correct
                let borderColor = '#222'
                let color = '#555'
                if (isRight) { borderColor = '#4ade80'; color = '#4ade80' }
                else if (isSelected && !isRight) { borderColor = '#dc2626'; color = '#f87171' }
                return (
                  <div key={key} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 14px', background: '#141414',
                    border: `1px solid ${borderColor}`, borderRadius: 4,
                    color, fontSize: 13, lineHeight: 1.5,
                  }}>
                    <span style={{ fontWeight: 'bold', flexShrink: 0 }}>{key}.</span>
                    <span>{text}</span>
                    {isRight && <span style={{ marginLeft: 'auto', flexShrink: 0 }}>✓</span>}
                    {isSelected && !isRight && <span style={{ marginLeft: 'auto', flexShrink: 0 }}>✗</span>}
                  </div>
                )
              })}
            </div>

            <div style={{
              padding: '12px 14px', background: isCorrect ? '#0f1a0f' : '#1a0f0f',
              border: `1px solid ${isCorrect ? '#2a4a2a' : '#4a2a2a'}`,
              borderRadius: 4, marginBottom: 16,
            }}>
              <div style={{ color: isCorrect ? '#4ade80' : '#f87171', fontWeight: 'bold', marginBottom: 6, fontSize: 13 }}>
                {isCorrect ? '答对了！' : `答错了，正确答案是 ${correct}`}
              </div>
              <div style={{ color: '#a09080', fontSize: 13, lineHeight: 1.6 }}>
                {explanation}
              </div>
            </div>

            <button onClick={onProceed} style={{
              width: '100%', padding: '11px 0',
              background: '#ffd700', border: 'none', borderRadius: 4,
              color: '#0d0d0d', fontWeight: 'bold', fontSize: 14,
              cursor: 'pointer', letterSpacing: 1,
            }}>
              进入 {nextRegionName} →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
