import { useState } from 'react'
import './App.css'

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void
    }
  }
}

const TABS = ['Home', 'Today', 'Stats', 'Settings'] as const
type Tab = (typeof TABS)[number]

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Home')

  const sendPingToNative = () => {
    const payload = {
      type: 'PING',
      source: 'web-ui',
      timestamp: Date.now(),
    }

    if (!window.ReactNativeWebView) {
      console.warn('ReactNativeWebView is not available in this environment.', payload)
      return
    }

    window.ReactNativeWebView.postMessage(JSON.stringify(payload))
  }

  return (
    <main className="screen">
      <div className="phone-shell">
        <header className="header">
          <h1>Focus Hybrid</h1>
          <p>WebView test UI</p>
        </header>

        <nav className="tabs" aria-label="Dummy tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`tab ${activeTab === tab ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>

        <section className="content">
          {activeTab === 'Home' && (
            <p>Home tab dummy content. 모바일 웹뷰 레이아웃 테스트 중입니다.</p>
          )}
          {activeTab === 'Today' && (
            <div className="today-panel">
              <p>Today tab dummy content.</p>
              <button type="button" className="send-button" onClick={sendPingToNative}>
                RN으로 메시지 보내기
              </button>
            </div>
          )}
          {activeTab === 'Stats' && (
            <p>Stats tab dummy content. 실제 통계 로직은 아직 없습니다.</p>
          )}
          {activeTab === 'Settings' && (
            <p>Settings tab dummy content. 설정 기능은 추후 구현 예정입니다.</p>
          )}
        </section>
      </div>
    </main>
  )
}

export default App
