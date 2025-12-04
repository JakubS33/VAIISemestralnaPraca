'use client'
import styles from './hPage.module.css';
import { useState } from 'react'

export default function HomePage() {
  const [showNameForm, setShowNameForm] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [userName, setUserName] = useState<string | null>(null)

  const isLoggedIn = userName !== null

  const handleOpenForm = () => {
    setShowNameForm(true)
  }

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = nameInput.trim()
    if (!trimmed) return

    setUserName(trimmed)      
    setShowNameForm(false)    
    setNameInput('')          
  }

  const handleCloseForm = () => {
    setShowNameForm(false)
  }

  return (
    <div className={styles.page}>
      {!isLoggedIn && (
        <>
          <header className={styles.header}>
            <h1 className={styles.title}>
              Welcome to My Finance Hub – the easiest way to see your real financial picture
            </h1>

            <button className={styles.authButton} onClick={handleOpenForm}>
              sign up / log in
            </button>
          </header>

          <main className={styles.main}>
            <p className={styles.mainText}>Dizajn stranky popis atd</p>
          </main>
        </>
      )}

      
      {isLoggedIn && (
        <>
          <header className={styles.dashboardHeader}>
            <div className={styles.dashboardTitleLeft}>My Finance Hub</div>
            <div className={styles.dashboardTitleCenter}>Choose your action</div>
            <button className={styles.dashboardButton}>
              My account ({userName})
            </button>
            <button className={styles.dashboardButton} onClick={() => setUserName(null)}>
              Log out
            </button>
          </header>

          {/* Banner */}
          <section className={styles.banner}>
            <div className={styles.actionBox}>
              <p>Check my wallet</p>
              <p>Add wallet</p>
              <p>See overall status</p>
            </div>
            <div className={styles.bannerCenter}>
              Banner stránky / logo
            </div>
          </section>

          {/* zbytok stranky dizajn atd */}
          <main className={styles.dashboardMain}>
            <p className={styles.mainText}>Dizajn, popisky stránky</p>
          </main>
        </>
      )}

      {showNameForm && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <button className={styles.modalClose} onClick={handleCloseForm}>
              ×
            </button>

            <h2>Write your name</h2>

            <form onSubmit={handleNameSubmit} className={styles.modalForm}>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Your name"
                className={styles.modalInput}
              />
              <button type="submit" className={styles.modalButton}>
                Confirm
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

