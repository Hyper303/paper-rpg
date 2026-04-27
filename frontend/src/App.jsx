import { useState } from 'react'
import UploadScreen from './screens/UploadScreen'
import LoadingScreen from './screens/LoadingScreen'
import GameScreen from './screens/GameScreen'

export default function App() {
  const [screen, setScreen] = useState('upload')
  const [questionnaire, setQuestionnaire] = useState(null)
  const [pdfFile, setPdfFile] = useState(null)
  const [gameData, setGameData] = useState(null)

  function handleStart(file, q) {
    setPdfFile(file)
    setQuestionnaire(q)
    setScreen('loading')
  }

  function handleGameReady(data) {
    setGameData(data)
    setScreen('game')
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: '#0d0d0d', color: '#e8e0d0' }}>
      {screen === 'upload' && <UploadScreen onStart={handleStart} />}
      {screen === 'loading' && (
        <LoadingScreen
          pdfFile={pdfFile}
          questionnaire={questionnaire}
          onReady={handleGameReady}
        />
      )}
      {screen === 'game' && (
        <GameScreen gameData={gameData} questionnaire={questionnaire} />
      )}
    </div>
  )
}
